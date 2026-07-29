import type { User, MessageMap, TicketStatus } from '../generated/prisma/client.js';
import { InputFile } from 'grammy';
import { userRepository } from '../db/repositories/user.repository.js';
import { messageRepository } from '../db/repositories/message.repository.js';
import { webLinkTokenRepository } from '../db/repositories/web-link-token.repository.js';
import { sendTicketCard, type SendTicketCardOptions } from './topic.service.js';
import { cancelAllSlaTimers, startSlaTimers } from './sla.service.js';
import { autoChangeStatus } from './status.service.js';
import { cancelAutocloseTimer } from './autoclose.service.js';
import { acquireLock, releaseLock } from './lock.service.js';
import { sendToUser } from '../http/ws/connection-manager.js';
import { messages } from '../config/messages.js';
import { bot } from '../bot/bot.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { FileCategory } from '../utils/file-validation.js';

export interface InitSessionResult {
  sessionId: string;
  isNewSession: boolean;
  hasHistory: boolean;
  telegramLinked: boolean;
  status: TicketStatus;
}

export interface ChatMessage {
  id: string;
  text: string;
  from: 'user' | 'support';
  channel: 'web' | 'telegram';
  timestamp: string;
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
}

export interface HistoryResult {
  messages: ChatMessage[];
  hasMore: boolean;
  oldestId?: string | undefined;
}

export interface ChatStatus {
  ticketId: string;
  status: TicketStatus;
  telegramLinked: boolean;
  telegramUsername?: string | undefined;
  createdAt: string;
  lastMessageAt?: string | undefined;
}

export interface LinkTelegramResult {
  token: string;
  telegramUrl: string;
  expiresAt: string;
}

export interface FileUploadResult {
  messageId: string;
  type: FileCategory;
  fileName: string;
  fileSize: number;
  mimeType: string;
  timestamp: string;
}

function mapMessageToChat(msg: MessageMap): ChatMessage {
  // Build media URLs from stored file_id
  const isVoice = msg.mediaDuration !== null;
  const imageUrl = msg.mediaFileId && !isVoice ? `/api/media/${msg.mediaFileId}` : undefined;
  const voiceUrl = msg.mediaFileId && isVoice ? `/api/media/${msg.mediaFileId}` : undefined;

  return {
    id: msg.id,
    text: msg.text ?? '',
    from: msg.direction === 'USER_TO_SUPPORT' ? 'user' : 'support',
    channel: msg.channel === 'WEB' ? 'web' : 'telegram',
    timestamp: msg.createdAt.toISOString(),
    ...(imageUrl && { imageUrl }),
    ...(voiceUrl && { voiceUrl }),
    ...(msg.mediaDuration !== null && { voiceDuration: msg.mediaDuration }),
  };
}

/**
 * Send onboarding messages to a web user after their first message.
 * Messages are saved to database and sent via WebSocket.
 */
async function sendWebOnboardingMessages(userId: string, topicId: number): Promise<void> {
  const onboardingTexts = [
    messages.webOnboarding.ticketCreated,
    messages.webOnboarding.askPhone,
  ];

  for (const text of onboardingTexts) {
    // Save to database
    const savedMessage = await messageRepository.createWebMessage({
      userId,
      topicMessageId: undefined, // System messages, not from topic
      direction: 'SUPPORT_TO_USER',
      channel: 'WEB',
      text,
    });

    // Send via WebSocket
    sendToUser(userId, 'message', {
      id: savedMessage.id,
      text,
      from: 'support',
      channel: 'web',
      timestamp: savedMessage.createdAt.toISOString(),
    });
  }

  logger.info({ userId, topicId }, 'Web onboarding messages sent');
}

/**
 * Create a forum topic for a web user together with its ticket card,
 * onboarding messages and SLA timers.
 */
async function createTopic(user: User, sessionId: string): Promise<number> {
  const topicName = `Web: ${sessionId.slice(0, 8)}`;
  logger.info({ sessionId, topicName }, 'Creating forum topic for web user');

  const topic = await bot.api.createForumTopic(env.SUPPORT_GROUP_ID, topicName);
  const topicId = topic.message_thread_id;
  await userRepository.updateTopicId(user.id, topicId);

  logger.info({ sessionId, topicId }, 'Forum topic created for web user');

  const webUserInfo = {
    tgUserId: 0,
    firstName: 'Web User',
  };
  const cardOptions: SendTicketCardOptions = {
    sourceUrl: user.sourceUrl ?? undefined,
    sourceCity: user.sourceCity ?? undefined,
    sourceIp: user.sourceIp ?? undefined,
  };
  await sendTicketCard(bot.api, topicId, user.id, webUserInfo, cardOptions);

  await sendWebOnboardingMessages(user.id, topicId);
  await startSlaTimers(user.id, topicId);

  return topicId;
}

/**
 * Return the topic of a web user, creating it on first contact.
 * A message and a file upload can arrive at the same time, so topic creation
 * runs under a lock and re-reads the user: a parallel request may have created
 * the topic while we were waiting. Without the lock (Redis down) the re-read
 * still removes most of the race.
 */
async function ensureTopic(user: User, sessionId: string): Promise<number> {
  if (user.topicId) {
    return user.topicId;
  }

  const lockKey = `topic:${user.id}`;
  const lockToken = await acquireLock(lockKey);

  try {
    const currentUser = await userRepository.findById(user.id);
    if (currentUser?.topicId) {
      logger.info(
        { userId: user.id, topicId: currentUser.topicId },
        'Topic already created by a parallel request'
      );
      return currentUser.topicId;
    }

    return await createTopic(user, sessionId);
  } finally {
    if (lockToken) {
      await releaseLock(lockKey, lockToken);
    }
  }
}

/**
 * Reopen a closed ticket before mirroring a new client message.
 * Mirrors the Telegram flow in bot/handlers/message.ts: notify support
 * and restart SLA timers from scratch.
 */
async function reopenIfClosed(user: User, topicId: number): Promise<void> {
  if (user.status !== 'CLOSED') {
    return;
  }

  const result = await autoChangeStatus(bot.api, user, 'CLIENT_REOPEN');
  if (!result.changed) {
    return;
  }

  await bot.api.sendMessage(env.SUPPORT_GROUP_ID, messages.reopened, {
    message_thread_id: topicId,
  });

  await cancelAllSlaTimers(user.id, topicId);
  await startSlaTimers(user.id, topicId);
}

/**
 * Apply status changes caused by a client message: drop the autoclose
 * timer and move WAITING_CLIENT → IN_PROGRESS.
 */
async function applyClientReply(user: User, topicId: number): Promise<void> {
  if (user.status === 'WAITING_CLIENT') {
    await cancelAutocloseTimer(user.id, topicId);
  }

  await autoChangeStatus(bot.api, user, 'CLIENT_REPLY');
}

/**
 * Initialize or resume a web chat session
 */
export async function initSession(
  sessionId: string,
  sourceUrl?: string,
  sourceCity?: string,
  sourceIp?: string
): Promise<InitSessionResult> {
  let user = await userRepository.findByWebSessionId(sessionId);
  let isNewSession = false;

  if (!user) {
    user = await userRepository.createWebUser({
      webSessionId: sessionId,
      sourceUrl,
      sourceCity,
      sourceIp,
    });
    isNewSession = true;
    logger.info({ userId: user.id, sessionId }, 'Created new web chat user');
  }

  const history = await messageRepository.getHistory(user.id, { limit: 1 });
  const hasHistory = history.length > 0;

  return {
    sessionId,
    isNewSession,
    hasHistory,
    telegramLinked: user.tgUserId !== null,
    status: user.status,
  };
}

/**
 * Get chat history for a user
 */
export async function getHistory(
  sessionId: string,
  options: { limit?: number | undefined; before?: string | undefined; after?: string | undefined } = {}
): Promise<HistoryResult> {
  const user = await userRepository.findByWebSessionId(sessionId);
  if (!user) {
    throw new Error('Session not found');
  }

  const limit = Math.min(options.limit ?? 50, 100);
  const history = await messageRepository.getHistory(user.id, {
    limit: limit + 1, // Fetch one extra to check if there are more
    before: options.before,
    after: options.after,
  });

  const hasMore = history.length > limit;
  const resultMessages = hasMore ? history.slice(0, -1) : history;

  // Reverse if fetching new messages (after) to get chronological order
  if (options.after) {
    resultMessages.reverse();
  }

  // After reverse, first element is oldest; without reverse, last element is oldest
  const oldestId = resultMessages.length > 0
    ? (options.after ? resultMessages[0]?.id : resultMessages[resultMessages.length - 1]?.id)
    : undefined;

  return {
    messages: resultMessages.map(mapMessageToChat),
    hasMore,
    oldestId,
  };
}

/**
 * Get chat status
 */
export async function getStatus(sessionId: string): Promise<ChatStatus> {
  const user = await userRepository.findByWebSessionId(sessionId);
  if (!user) {
    throw new Error('Session not found');
  }

  const history = await messageRepository.getHistory(user.id, { limit: 1 });
  const lastMessage = history[0];

  return {
    ticketId: user.id,
    status: user.status,
    telegramLinked: user.tgUserId !== null,
    telegramUsername: user.tgUsername ?? undefined,
    createdAt: user.createdAt.toISOString(),
    lastMessageAt: lastMessage?.createdAt.toISOString(),
  };
}

/**
 * Send a message from web chat
 */
export async function sendMessage(sessionId: string, text: string, replyTo?: string): Promise<ChatMessage> {
  const user = await userRepository.findByWebSessionId(sessionId);
  if (!user) {
    throw new Error('Session not found');
  }

  const topicId = await ensureTopic(user, sessionId);
  await reopenIfClosed(user, topicId);

  // Look up replyTo message to get topic message ID (only if belongs to same user)
  let replyToMessageId: number | undefined;
  if (replyTo) {
    const replyToMessage = await messageRepository.findById(replyTo);
    if (replyToMessage?.topicMessageId && replyToMessage.userId === user.id) {
      replyToMessageId = replyToMessage.topicMessageId;
    }
  }

  // Send message to topic
  const sendOptions: { message_thread_id: number; reply_to_message_id?: number } = {
    message_thread_id: topicId,
  };
  if (replyToMessageId) {
    sendOptions.reply_to_message_id = replyToMessageId;
  }
  const topicMessage = await bot.api.sendMessage(env.SUPPORT_GROUP_ID, `[WEB] ${text}`, sendOptions);

  // Save to message map
  const message = await messageRepository.createWebMessage({
    userId: user.id,
    topicMessageId: topicMessage.message_id,
    direction: 'USER_TO_SUPPORT',
    channel: 'WEB',
    text,
  });

  logger.info({ userId: user.id, messageId: message.id }, 'Web message sent to topic');

  await applyClientReply(user, topicId);

  return mapMessageToChat(message);
}

/**
 * Generate link for migrating to Telegram
 */
export async function linkTelegram(sessionId: string): Promise<LinkTelegramResult> {
  const user = await userRepository.findByWebSessionId(sessionId);
  if (!user) {
    throw new Error('Session not found');
  }

  const linkToken = await webLinkTokenRepository.create(user.id);
  const botUsername = env.BOT_USERNAME;
  const telegramUrl = `https://t.me/${botUsername}?start=${linkToken.token}`;

  logger.info({ userId: user.id, token: linkToken.token }, 'Created Telegram link token');

  return {
    token: linkToken.token,
    telegramUrl,
    expiresAt: linkToken.expiresAt.toISOString(),
  };
}

/**
 * Close ticket from web chat
 */
export async function closeTicket(
  sessionId: string,
  resolved: boolean,
  feedback?: string
): Promise<{ ticketId: string; status: string; closedAt: string }> {
  const user = await userRepository.findByWebSessionId(sessionId);
  if (!user) {
    throw new Error('Session not found');
  }

  if (user.status === 'CLOSED') {
    throw new Error('Ticket already closed');
  }

  const result = await autoChangeStatus(bot.api, user, 'CLIENT_RESOLVED');
  if (!result.changed) {
    throw new Error('Failed to close ticket');
  }

  // Notify in topic
  if (user.topicId) {
    const supportGroupId = Number(env.SUPPORT_GROUP_ID);
    const message = resolved
      ? `[WEB] ✅ Клиент закрыл тикет: "${feedback ?? 'Вопрос решён'}"`
      : `[WEB] ❌ Клиент закрыл тикет без решения`;

    await bot.api.sendMessage(supportGroupId, message, {
      message_thread_id: user.topicId,
    });
  }

  logger.info({ userId: user.id, resolved, feedback }, 'Web ticket closed');

  return {
    ticketId: user.id,
    status: 'CLOSED',
    closedAt: new Date().toISOString(),
  };
}

/**
 * Process link token from Telegram /start command
 */
export async function processLinkToken(
  token: string,
  tgUserId: bigint,
  tgUsername: string | null,
  tgFirstName: string
): Promise<User | null> {
  const linkToken = await webLinkTokenRepository.findValidByToken(token);
  if (!linkToken) {
    return null;
  }

  // Mark token as used
  await webLinkTokenRepository.markUsed(linkToken.id);

  // Link Telegram account to web user
  const user = await userRepository.linkTelegramAccount(
    linkToken.userId,
    tgUserId,
    tgUsername,
    tgFirstName
  );

  logger.info(
    { userId: user.id, tgUserId: String(tgUserId), token },
    'Telegram account linked to web session'
  );

  return user;
}

/**
 * Send a file from web chat
 */
export async function sendFile(
  sessionId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  category: FileCategory
): Promise<FileUploadResult> {
  const user = await userRepository.findByWebSessionId(sessionId);
  if (!user) {
    throw new Error('Session not found');
  }

  const topicId = await ensureTopic(user, sessionId);
  await reopenIfClosed(user, topicId);

  const inputFile = new InputFile(fileBuffer, fileName);
  let topicMessageId: number;
  let fileId: string;

  if (category === 'image') {
    const result = await bot.api.sendPhoto(env.SUPPORT_GROUP_ID, inputFile, {
      message_thread_id: topicId,
      caption: `[WEB] 📎 ${fileName}`,
    });
    topicMessageId = result.message_id;
    // Get file_id from the largest photo size
    const photo = result.photo;
    fileId = photo[photo.length - 1]?.file_id ?? '';
  } else {
    const result = await bot.api.sendDocument(env.SUPPORT_GROUP_ID, inputFile, {
      message_thread_id: topicId,
      caption: `[WEB] 📎 ${fileName}`,
    });
    topicMessageId = result.message_id;
    fileId = result.document.file_id;
  }

  // Save to message map with media info
  // For images, don't show filename (image speaks for itself)
  // For documents, show filename with icon
  const messageText = category === 'image' ? '' : `📎 ${fileName}`;
  const message = await messageRepository.createWebMessage({
    userId: user.id,
    topicMessageId,
    direction: 'USER_TO_SUPPORT',
    channel: 'WEB',
    text: messageText,
    mediaFileId: fileId,
  });

  logger.info(
    { userId: user.id, messageId: message.id, fileName, category },
    'Web file sent to topic'
  );

  await applyClientReply(user, topicId);

  return {
    messageId: message.id,
    type: category,
    fileName,
    fileSize: fileBuffer.length,
    mimeType,
    timestamp: message.createdAt.toISOString(),
  };
}

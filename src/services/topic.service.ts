import { InlineKeyboard } from 'grammy';
import type { Api } from 'grammy';
import type { ForumTopic } from 'grammy/types';
import type { TicketStatus } from '../generated/prisma/client.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { formatDateTime } from '../utils/datetime.js';
import { STATUS_LABELS_WITH_EMOJI } from '../constants/status.js';

function buildStatusKeyboard(userId: string, currentStatus: TicketStatus): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (currentStatus !== 'IN_PROGRESS') {
    keyboard.text('🔧 В работу', `status:IN_PROGRESS:${userId}`);
  }
  if (currentStatus !== 'WAITING_CLIENT') {
    keyboard.text('⏳ Ждём клиента', `status:WAITING_CLIENT:${userId}`);
  }
  if (currentStatus !== 'CLOSED') {
    keyboard.text('✅ Закрыть', `status:CLOSED:${userId}`);
  }

  return keyboard;
}

export interface TopicUserInfo {
  tgUserId: number;
  firstName: string;
  username?: string | undefined;
}

export interface TicketCardData {
  tgUserId: number;
  firstName: string;
  username?: string | undefined;
  phone?: string | undefined;
  sourceUrl?: string | undefined;
  sourceCity?: string | undefined;
  sourceIp?: string | undefined;
  status: TicketStatus;
  createdAt: Date;
}

/**
 * The card is sent as HTML, so everything coming from outside — the visitor
 * name, the page address, the city — has to be escaped. Markdown would be worse
 * here: a page address like /catalog/dell_poweredge_r740 breaks its parser and
 * Telegram rejects the whole message.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatCardText(data: TicketCardData): string {
  const usernameLine = data.username ? `\n👤 Username: @${escapeHtml(data.username)}` : '';
  const phoneLine = data.phone ? `\n📱 Телефон: ${escapeHtml(data.phone)}` : '';
  const sourceLine = data.sourceUrl ? `\n🔗 Источник: ${escapeHtml(data.sourceUrl)}` : '';

  // Combine IP and city: "🌐 IP: 95.67.12.34 (Саратов)" or just IP if no city
  let ipLine = '';
  if (data.sourceIp) {
    const cityPart = data.sourceCity ? ` (${escapeHtml(data.sourceCity)})` : '';
    ipLine = `\n🌐 IP: <code>${escapeHtml(data.sourceIp)}</code>${cityPart}`;
  }

  return (
    `📋 <b>Тикет</b>\n\n` +
    `👤 Пользователь: ${escapeHtml(data.firstName)}` +
    usernameLine +
    phoneLine +
    sourceLine +
    ipLine +
    `\n📅 Создан: ${formatDateTime(data.createdAt)}\n\n` +
    `Статус: ${STATUS_LABELS_WITH_EMOJI[data.status]}`
  );
}

function formatTopicName(user: TopicUserInfo): string {
  return `${user.firstName} (${String(user.tgUserId)})`;
}

export async function createTopic(api: Api, user: TopicUserInfo): Promise<ForumTopic> {
  const topicName = formatTopicName(user);

  logger.info({ tgUserId: user.tgUserId, topicName }, 'Creating forum topic');

  const topic = await api.createForumTopic(env.SUPPORT_GROUP_ID, topicName);

  logger.info(
    { tgUserId: user.tgUserId, topicId: topic.message_thread_id },
    'Forum topic created'
  );

  return topic;
}

export interface SendTicketCardOptions {
  sourceUrl?: string | undefined;
  sourceCity?: string | undefined;
  sourceIp?: string | undefined;
}

export async function sendTicketCard(
  api: Api,
  topicId: number,
  userId: string,
  user: TopicUserInfo,
  options?: SendTicketCardOptions
): Promise<number> {
  const cardData: TicketCardData = {
    tgUserId: user.tgUserId,
    firstName: user.firstName,
    username: user.username,
    sourceUrl: options?.sourceUrl,
    sourceCity: options?.sourceCity,
    sourceIp: options?.sourceIp,
    status: 'NEW',
    createdAt: new Date(),
  };

  const cardText = formatCardText(cardData);
  const keyboard = buildStatusKeyboard(userId, 'NEW');

  const message = await api.sendMessage(env.SUPPORT_GROUP_ID, cardText, {
    message_thread_id: topicId,
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });

  try {
    await api.pinChatMessage(env.SUPPORT_GROUP_ID, message.message_id);
  } catch (error) {
    logger.warn({ topicId, error }, 'Failed to pin ticket card');
  }

  return message.message_id;
}

export async function updateTicketCard(
  api: Api,
  messageId: number,
  userId: string,
  cardData: TicketCardData
): Promise<void> {
  const cardText = formatCardText(cardData);
  const keyboard = buildStatusKeyboard(userId, cardData.status);

  await api.editMessageText(env.SUPPORT_GROUP_ID, messageId, cardText, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

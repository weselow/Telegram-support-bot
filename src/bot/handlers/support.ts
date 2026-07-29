import type { Context } from 'grammy';
import { GrammyError } from 'grammy';
import type { Message } from 'grammy/types';
import type { MessageMap } from '../../generated/prisma/client.js';
import { findUserByTopicId } from '../../services/ticket.service.js';
import { mirrorSupportMessage } from '../../services/message.service.js';
import { autoChangeStatus } from '../../services/status.service.js';
import { cancelAllSlaTimers } from '../../services/sla.service.js';
import { sendToUser } from '../../http/ws/connection-manager.js';
import { messageRepository } from '../../db/repositories/message.repository.js';
import { messages } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';
import { captureError, addBreadcrumb } from '../../config/sentry.js';

function isBotBlockedError(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 403 &&
    typeof error.description === 'string' &&
    error.description.includes('blocked by the user')
  );
}

/**
 * Вложение ответа поддержки в том виде, в каком его показывает виджет:
 * ссылки идут на собственный прокси /api/media/:fileId, токен бота наружу не уходит.
 */
interface WebMedia {
  imageUrl?: string | undefined;
  voiceUrl?: string | undefined;
  voiceDuration?: number | undefined;
  mediaFileId?: string | undefined;
  placeholder: string;
}

function extractWebMedia(message: Message): WebMedia {
  const voice = message.voice;
  if (voice) {
    return {
      voiceUrl: `/api/media/${voice.file_id}`,
      voiceDuration: voice.duration,
      mediaFileId: voice.file_id,
      placeholder: '[Голосовое сообщение]',
    };
  }

  const photo = message.photo;
  const largestPhoto = photo && photo.length > 0 ? photo[photo.length - 1] : undefined;
  if (largestPhoto) {
    return {
      imageUrl: `/api/media/${largestPhoto.file_id}`,
      mediaFileId: largestPhoto.file_id,
      placeholder: '[Изображение]',
    };
  }

  return { placeholder: '' };
}

/**
 * Доставить ответ поддержки в веб-чат.
 * Если сообщение уже записано зеркалированием в Telegram, переиспользуем ту же
 * запись: на пару (user_id, topic_message_id) стоит уникальный указатель,
 * и вторая вставка была бы отвергнута базой.
 */
async function deliverToWebChat(
  userId: string,
  message: Message,
  mirrored: MessageMap | null
): Promise<void> {
  const text = message.text ?? message.caption ?? '';
  const media = extractWebMedia(message);

  if (!text && !media.imageUrl && !media.voiceUrl) {
    return;
  }

  const savedMessage =
    mirrored ??
    (await messageRepository.createWebMessage({
      userId,
      topicMessageId: message.message_id,
      direction: 'SUPPORT_TO_USER',
      channel: 'TELEGRAM',
      text: text || media.placeholder,
      mediaFileId: media.mediaFileId,
      mediaDuration: media.voiceDuration,
    }));

  sendToUser(userId, 'message', {
    id: savedMessage.id,
    text,
    from: 'support',
    channel: 'telegram',
    timestamp: savedMessage.createdAt.toISOString(),
    ...(media.imageUrl && { imageUrl: media.imageUrl }),
    ...(media.voiceUrl && { voiceUrl: media.voiceUrl }),
    ...(media.voiceDuration !== undefined && { voiceDuration: media.voiceDuration }),
  });
}

export async function supportMessageHandler(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message) {
    return;
  }

  // Ignore bot's own messages
  if (ctx.from.is_bot) {
    return;
  }

  // Get topic ID from message
  const topicId = ctx.message.message_thread_id;
  if (!topicId) {
    // Message in General topic or not in a topic - ignore
    return;
  }

  // Filter internal messages (not forwarded to user)
  const text = ctx.message.text ?? ctx.message.caption ?? '';
  if (text.startsWith('//') || text.startsWith('#internal')) {
    return;
  }

  // Find user by topic ID
  const user = await findUserByTopicId(topicId);
  if (!user) {
    logger.warn({ topicId }, 'No user found for topic');
    return;
  }

  addBreadcrumb('message', 'Support reply', 'info', { topicId, userId: user.id });

  try {
    // Mirror to Telegram only if user has Telegram ID
    let mirrored: MessageMap | null = null;
    if (user.tgUserId) {
      mirrored = await mirrorSupportMessage(ctx.api, ctx.message, user.id, user.tgUserId);
    }

    // Send to WebSocket if user has web session
    if (user.webSessionId) {
      await deliverToWebChat(user.id, ctx.message, mirrored);
    }

    // Cancel SLA timers on support reply
    if (user.topicId) {
      await cancelAllSlaTimers(user.id, user.topicId);
    }

    // Auto change status: NEW → IN_PROGRESS
    await autoChangeStatus(ctx.api, user, 'SUPPORT_REPLY');
  } catch (error) {
    captureError(error, { topicId, userId: user.id, action: 'mirrorSupportMessage' });

    if (isBotBlockedError(error)) {
      logger.warn({ topicId, userId: user.id }, 'Bot blocked by user');
      try {
        await ctx.reply(messages.support.botBlocked, {
          message_thread_id: topicId,
        });
      } catch (notifyError) {
        captureError(notifyError, { topicId, userId: user.id, action: 'notifyBotBlocked' });
        logger.error({ error: notifyError, topicId }, 'Failed to notify about bot blocked');
      }
    } else {
      logger.error({ error, topicId, userId: user.id }, 'Failed to mirror support message');
      try {
        await ctx.reply(messages.support.deliveryFailed, {
          message_thread_id: topicId,
        });
      } catch (notifyError) {
        captureError(notifyError, { topicId, userId: user.id, action: 'notifyDeliveryFailed' });
        logger.error({ error: notifyError, topicId }, 'Failed to notify about delivery failure');
      }
    }
  }
}

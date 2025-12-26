import type { Context } from 'grammy';
import { findUserByTopicId } from '../../services/ticket.service.js';
import { mirrorSupportMessage } from '../../services/message.service.js';
import { autoChangeStatus } from '../../services/status.service.js';
import { cancelAllSlaTimers } from '../../services/sla.service.js';
import { logger } from '../../utils/logger.js';

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

  try {
    await mirrorSupportMessage(ctx.api, ctx.message, user.id, user.tgUserId);

    // Cancel SLA timers on support reply
    await cancelAllSlaTimers(user.id, user.topicId);

    // Auto change status: NEW → IN_PROGRESS
    await autoChangeStatus(ctx.api, user, 'SUPPORT_REPLY');
  } catch (error) {
    logger.error({ error, topicId, userId: user.id }, 'Failed to mirror support message');
    await ctx.reply('⚠️ Не удалось доставить сообщение пользователю. Попробуйте ещё раз.', {
      message_thread_id: topicId,
    });
  }
}

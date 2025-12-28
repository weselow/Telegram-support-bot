import type { Context } from 'grammy';
import { GrammyError } from 'grammy';
import { findUserByTopicId } from '../../services/ticket.service.js';
import { mirrorSupportMessage } from '../../services/message.service.js';
import { autoChangeStatus } from '../../services/status.service.js';
import { cancelAllSlaTimers } from '../../services/sla.service.js';
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
    if (user.tgUserId) {
      await mirrorSupportMessage(ctx.api, ctx.message, user.id, user.tgUserId);
    }
    // TODO: Phase 4 - also send to WebSocket if user has webSessionId

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

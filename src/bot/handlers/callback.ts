import type { Context } from 'grammy';
import type { TicketStatus } from '../../generated/prisma/client.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { updateTicketCard, type TicketCardData } from '../../services/topic.service.js';
import { startAutocloseTimer, cancelAutocloseTimer } from '../../services/autoclose.service.js';
import { connectionManager } from '../../http/ws/connection-manager.js';
import { messages, formatMessage } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';
import { captureError } from '../../config/sentry.js';
import { STATUS_LABELS } from '../../constants/status.js';

const VALID_STATUSES: TicketStatus[] = ['IN_PROGRESS', 'WAITING_CLIENT', 'CLOSED'];

function parseCallbackData(data: string): { status: TicketStatus; userId: string } | null {
  const parts = data.split(':');
  if (parts.length !== 3 || parts[0] !== 'status') {
    return null;
  }

  const status = parts[1] as TicketStatus;
  const userId = parts[2];

  if (!VALID_STATUSES.includes(status) || !userId) {
    return null;
  }

  return { status, userId };
}

export async function callbackHandler(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery?.data) {
    return;
  }

  const parsed = parseCallbackData(ctx.callbackQuery.data);
  if (!parsed) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.unknownCommand });
    return;
  }

  const { status, userId } = parsed;

  const user = await userRepository.findById(userId);
  if (!user) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.userNotFound });
    return;
  }

  if (user.status === status) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.statusAlreadySet });
    return;
  }

  const oldStatus = user.status;

  try {
    await userRepository.updateStatus(userId, status);

    await eventRepository.create({
      userId,
      eventType: status === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
      oldValue: oldStatus,
      newValue: status,
    });

    // Notify web client about status change
    if (user.webSessionId) {
      const sent = connectionManager.sendToUser(userId, 'status', { status });
      if (!sent) {
        logger.warn({ userId, webSessionId: user.webSessionId }, 'Failed to send status update to web client');
      }
    }

    let cardUpdateFailed = false;
    let autocloseTimerFailed = false;

    if (user.cardMessageId && user.tgUserId && user.tgFirstName) {
      const cardData: TicketCardData = {
        tgUserId: Number(user.tgUserId),
        firstName: user.tgFirstName,
        username: user.tgUsername ?? undefined,
        phone: user.phone ?? undefined,
        sourceUrl: user.sourceUrl ?? undefined,
        status,
        createdAt: user.createdAt,
      };

      try {
        await updateTicketCard(ctx.api, user.cardMessageId, userId, cardData);
      } catch (cardError) {
        cardUpdateFailed = true;
        captureError(cardError, { userId, messageId: user.cardMessageId, action: 'updateTicketCard' });
        logger.error({ error: cardError, userId, messageId: user.cardMessageId }, 'Failed to update ticket card');
      }
    }

    // Manage autoclose timers based on status transitions (only for users with topics)
    if (user.topicId) {
      if (status === 'WAITING_CLIENT') {
        const timerStarted = await startAutocloseTimer(userId, user.topicId);
        if (!timerStarted) {
          autocloseTimerFailed = true;
          logger.warn({ userId, topicId: user.topicId }, 'Autoclose timer failed to start');
        }
      } else if (oldStatus === 'WAITING_CLIENT') {
        await cancelAutocloseTimer(userId, user.topicId);
      }
    }

    await ctx.answerCallbackQuery({
      text: formatMessage(messages.callbacks.statusChanged, { status: STATUS_LABELS[status] }),
    });

    if (ctx.chat && user.topicId) {
      let notification = formatMessage(messages.status.changed, {
        oldStatus: STATUS_LABELS[oldStatus],
        newStatus: STATUS_LABELS[status],
      });
      if (cardUpdateFailed) {
        notification += '\n' + messages.status.cardUpdateFailed;
      }
      if (autocloseTimerFailed) {
        notification += '\n' + messages.status.autocloseTimerFailed;
      }
      try {
        await ctx.api.sendMessage(ctx.chat.id, notification, {
          message_thread_id: user.topicId,
        });
      } catch (notifyError) {
        captureError(notifyError, { userId, topicId: user.topicId, action: 'sendStatusNotification' });
        logger.error({ error: notifyError, userId, topicId: user.topicId }, 'Failed to send status notification');
      }
    }

    logger.info({ userId, oldStatus, newStatus: status, cardUpdateFailed, autocloseTimerFailed }, 'Ticket status changed');
  } catch (error) {
    captureError(error, { userId, status, action: 'updateTicketStatus' });
    logger.error({ error, userId, status }, 'Failed to update ticket status');
    await ctx.answerCallbackQuery({ text: messages.callbacks.statusChangeError }).catch((err: unknown) => {
      captureError(err, { userId, action: 'answerCallbackQuery' });
      logger.error({ error: err, userId }, 'Failed to answer error callback');
    });
  }
}

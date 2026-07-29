import type { Api } from 'grammy';
import type { User, TicketStatus } from '../generated/prisma/client.js';
import { userRepository } from '../db/repositories/user.repository.js';
import { eventRepository } from '../db/repositories/event.repository.js';
import { updateTicketCard, type TicketCardData } from './topic.service.js';
import { cancelAllSlaTimers, startSlaTimers } from './sla.service.js';
import { sendToUser } from '../http/ws/connection-manager.js';
import { messages } from '../config/messages.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type StatusTrigger = 'SUPPORT_REPLY' | 'CLIENT_REPLY' | 'CLIENT_RESOLVED' | 'CLIENT_REOPEN';

interface StatusChangeResult {
  changed: boolean;
  oldStatus: TicketStatus;
  newStatus: TicketStatus;
}

function getNewStatus(currentStatus: TicketStatus, trigger: StatusTrigger): TicketStatus | null {
  if (trigger === 'SUPPORT_REPLY' && currentStatus === 'NEW') {
    return 'IN_PROGRESS';
  }
  if (trigger === 'CLIENT_REPLY' && currentStatus === 'WAITING_CLIENT') {
    return 'IN_PROGRESS';
  }
  if (trigger === 'CLIENT_RESOLVED' && currentStatus !== 'CLOSED') {
    return 'CLOSED';
  }
  if (trigger === 'CLIENT_REOPEN' && currentStatus === 'CLOSED') {
    return 'NEW';
  }
  return null;
}

function getEventType(trigger: StatusTrigger): 'CLOSED' | 'REOPENED' | 'STATUS_CHANGED' {
  if (trigger === 'CLIENT_RESOLVED') return 'CLOSED';
  if (trigger === 'CLIENT_REOPEN') return 'REOPENED';
  return 'STATUS_CHANGED';
}

export async function autoChangeStatus(
  api: Api,
  user: User,
  trigger: StatusTrigger
): Promise<StatusChangeResult> {
  const oldStatus = user.status;
  const newStatus = getNewStatus(oldStatus, trigger);

  if (!newStatus) {
    return { changed: false, oldStatus, newStatus: oldStatus };
  }

  try {
    await userRepository.updateStatus(user.id, newStatus);

    await eventRepository.create({
      userId: user.id,
      eventType: getEventType(trigger),
      oldValue: oldStatus,
      newValue: newStatus,
    });

    // Notify web client about status change
    if (user.webSessionId) {
      const sent = sendToUser(user.id, 'status', { status: newStatus });
      if (!sent) {
        logger.warn({ userId: user.id, webSessionId: user.webSessionId }, 'Failed to send status update to web client');
      }
    }

    // Update ticket card (only for Telegram users with required fields)
    if (user.cardMessageId && user.tgUserId && user.tgFirstName) {
      const cardData: TicketCardData = {
        tgUserId: Number(user.tgUserId),
        firstName: user.tgFirstName,
        username: user.tgUsername ?? undefined,
        phone: user.phone ?? undefined,
        sourceUrl: user.sourceUrl ?? undefined,
        status: newStatus,
        createdAt: user.createdAt,
      };

      try {
        await updateTicketCard(api, user.cardMessageId, user.id, cardData);
      } catch (cardError) {
        logger.error({ error: cardError, userId: user.id }, 'Failed to update ticket card on auto status change');
      }
    }

    logger.info({ userId: user.id, oldStatus, newStatus, trigger }, 'Auto status change');
    return { changed: true, oldStatus, newStatus };
  } catch (error) {
    logger.error({ error, userId: user.id, trigger }, 'Failed to auto change status');
    return { changed: false, oldStatus, newStatus: oldStatus };
  }
}

/**
 * Вернуть закрытое обращение в работу: перевести статус, сообщить об этом
 * в тему поддержки и завести отсчёт SLA заново, сняв прежние таймеры.
 *
 * Единственный порядок переоткрытия для всех каналов — личных сообщений,
 * онбординга и веб-чата. Возвращает true, если обращение действительно
 * переоткрыто; для незакрытого обращения не делает ничего.
 *
 * Ошибки наружу не глушатся: каждый вызывающий обрабатывает их по-своему.
 */
export async function reopenTicket(api: Api, user: User, topicId: number): Promise<boolean> {
  const result = await autoChangeStatus(api, user, 'CLIENT_REOPEN');

  if (!result.changed) {
    return false;
  }

  await api.sendMessage(Number(env.SUPPORT_GROUP_ID), messages.reopened, {
    message_thread_id: topicId,
  });

  await cancelAllSlaTimers(user.id, topicId);
  await startSlaTimers(user.id, topicId);

  return true;
}

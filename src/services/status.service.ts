import type { Api } from 'grammy';
import type { User, TicketStatus } from '../generated/prisma/client.js';
import { userRepository } from '../db/repositories/user.repository.js';
import { eventRepository } from '../db/repositories/event.repository.js';
import { updateTicketCard, type TicketCardData } from './topic.service.js';
import { connectionManager } from '../http/ws/connection-manager.js';
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
      connectionManager.sendToUser(user.id, 'status', {
        status: newStatus,
      });
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

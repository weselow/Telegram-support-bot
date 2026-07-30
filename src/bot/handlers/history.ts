import type { Context } from 'grammy';
import type { EventType, TicketStatus } from '../../generated/prisma/client.js';
import { findUserByTopicId } from '../../services/ticket.service.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { STATUS_LABELS } from '../../constants/status.js';
import { messages } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';
import { formatDateShort, getTimezoneLabel } from '../../utils/datetime.js';

const EVENT_LABELS: Record<EventType, string> = {
  OPENED: '📩 Открыт',
  REOPENED: '🔄 Переоткрыт',
  CLOSED: '✅ Закрыт',
  STATUS_CHANGED: '📝 Статус',
  PHONE_UPDATED: '📱 Телефон',
};

function formatEvent(event: {
  eventType: EventType;
  createdAt: Date;
  oldValue: string | null;
  newValue: string | null;
  question: string | null;
}): string {
  const date = formatDateShort(event.createdAt);
  const label = EVENT_LABELS[event.eventType];

  switch (event.eventType) {
    case 'OPENED':
    case 'REOPENED': {
      const question = event.question ? `: "${truncate(event.question, 50)}"` : '';
      return `• ${date} — ${label}${question}`;
    }
    case 'STATUS_CHANGED': {
      const oldStatus = event.oldValue as TicketStatus | null;
      const newStatus = event.newValue as TicketStatus | null;
      const oldLabel = oldStatus ? STATUS_LABELS[oldStatus] : (event.oldValue ?? '?');
      const newLabel = newStatus ? STATUS_LABELS[newStatus] : (event.newValue ?? '?');
      return `• ${date} — ${label}: ${oldLabel} → ${newLabel}`;
    }
    case 'PHONE_UPDATED': {
      const oldPhone = event.oldValue ?? 'не указан';
      const newPhone = event.newValue ?? 'не указан';
      return `• ${date} — ${label}: ${oldPhone} → ${newPhone}`;
    }
    case 'CLOSED':
      return `• ${date} — ${label}`;
    default:
      return `• ${date} — ${label}`;
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

const MAX_EVENTS = 20;

export async function historyHandler(ctx: Context): Promise<void> {
  const topicId = ctx.message?.message_thread_id;
  if (!topicId) {
    await ctx.reply(messages.history.topicOnly);
    return;
  }

  try {
    const user = await findUserByTopicId(topicId);
    if (!user) {
      logger.warn({ topicId }, 'History requested for unknown topic');
      await ctx.reply(messages.history.userNotFound, {
        message_thread_id: topicId,
      });
      return;
    }

    const events = await eventRepository.findByUserId(user.id);

    if (events.length === 0) {
      await ctx.reply(messages.history.empty, {
        message_thread_id: topicId,
      });
      return;
    }

    // Events are ordered desc, take last MAX_EVENTS and reverse for chronological order
    const limited = events.slice(0, MAX_EVENTS);
    const chronological = limited.slice().reverse();
    const formatted = chronological.map(formatEvent).join('\n');

    // Зона указана один раз в заголовке, чтобы не повторять её в каждой строке
    const zone = `время ${getTimezoneLabel()}`;
    const scope = events.length > MAX_EVENTS
      ? `последние ${String(MAX_EVENTS)} из ${String(events.length)}, ${zone}`
      : zone;
    const header = `📋 История тикета (${scope}):\n\n`;

    await ctx.reply(header + formatted, {
      message_thread_id: topicId,
    });

    logger.debug({ userId: user.id, eventCount: events.length }, 'History displayed');
  } catch (error) {
    logger.error({ error, topicId }, 'Failed to fetch ticket history');
    await ctx.reply(messages.history.loadError, {
      message_thread_id: topicId,
    });
  }
}

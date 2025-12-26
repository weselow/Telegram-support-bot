import type { Context } from 'grammy';
import type { EventType, TicketStatus } from '../../generated/prisma/client.js';
import { findUserByTopicId } from '../../services/ticket.service.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { STATUS_LABELS } from '../../constants/status.js';
import { logger } from '../../utils/logger.js';

const EVENT_LABELS: Record<EventType, string> = {
  OPENED: '📩 Открыт',
  REOPENED: '🔄 Переоткрыт',
  CLOSED: '✅ Закрыт',
  STATUS_CHANGED: '📝 Статус',
  PHONE_UPDATED: '📱 Телефон',
};

function formatDate(date: Date): string {
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEvent(event: {
  eventType: EventType;
  createdAt: Date;
  oldValue: string | null;
  newValue: string | null;
  question: string | null;
}): string {
  const date = formatDate(event.createdAt);
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

export async function historyHandler(ctx: Context): Promise<void> {
  const topicId = ctx.message?.message_thread_id;
  if (!topicId) {
    await ctx.reply('Эта команда работает только в топиках.');
    return;
  }

  const user = await findUserByTopicId(topicId);
  if (!user) {
    await ctx.reply('Пользователь не найден для этого топика.', {
      message_thread_id: topicId,
    });
    return;
  }

  const events = await eventRepository.findByUserId(user.id);

  if (events.length === 0) {
    await ctx.reply('📋 История пуста.', {
      message_thread_id: topicId,
    });
    return;
  }

  // Events are ordered desc, reverse for chronological order
  const chronological = events.slice().reverse();
  const formatted = chronological.map(formatEvent).join('\n');

  await ctx.reply(`📋 История тикета:\n\n${formatted}`, {
    message_thread_id: topicId,
  });

  logger.debug({ userId: user.id, eventCount: events.length }, 'History displayed');
}

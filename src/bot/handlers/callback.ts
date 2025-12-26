import type { Context } from 'grammy';
import type { TicketStatus } from '../../generated/prisma/client.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { updateTicketCard, type TicketCardData } from '../../services/topic.service.js';
import { logger } from '../../utils/logger.js';

const VALID_STATUSES: TicketStatus[] = ['IN_PROGRESS', 'WAITING_CLIENT', 'CLOSED'];

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'Новый',
  IN_PROGRESS: 'В работе',
  WAITING_CLIENT: 'Ждём клиента',
  CLOSED: 'Закрыт',
};

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
    await ctx.answerCallbackQuery({ text: 'Неизвестная команда' });
    return;
  }

  const { status, userId } = parsed;

  const user = await userRepository.findById(userId);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
    return;
  }

  if (user.status === status) {
    await ctx.answerCallbackQuery({ text: 'Статус уже установлен' });
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

    if (user.cardMessageId) {
      const cardData: TicketCardData = {
        tgUserId: Number(user.tgUserId),
        firstName: user.tgFirstName,
        username: user.tgUsername ?? undefined,
        phone: user.phone ?? undefined,
        sourceUrl: user.sourceUrl ?? undefined,
        status,
        createdAt: user.createdAt,
      };

      await updateTicketCard(ctx.api, user.cardMessageId, userId, cardData);
    }

    await ctx.answerCallbackQuery({ text: `Статус изменён на "${STATUS_LABELS[status]}"` });

    if (ctx.chat) {
      const notification = `📝 Статус изменён: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[status]}`;
      await ctx.api.sendMessage(ctx.chat.id, notification, {
        message_thread_id: user.topicId,
      });
    }

    logger.info({ userId, oldStatus, newStatus: status }, 'Ticket status changed');
  } catch (error) {
    logger.error({ error, userId, status }, 'Failed to update ticket status');
    await ctx.answerCallbackQuery({ text: 'Ошибка при обновлении статуса' });
  }
}

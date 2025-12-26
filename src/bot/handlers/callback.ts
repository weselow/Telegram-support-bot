import type { Context } from 'grammy';
import type { TicketStatus } from '../../generated/prisma/client.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { updateTicketCard, type TicketCardData } from '../../services/topic.service.js';
import { logger } from '../../utils/logger.js';
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

    let cardUpdateFailed = false;

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

      try {
        await updateTicketCard(ctx.api, user.cardMessageId, userId, cardData);
      } catch (cardError) {
        cardUpdateFailed = true;
        logger.error({ error: cardError, userId, messageId: user.cardMessageId }, 'Failed to update ticket card');
      }
    }

    await ctx.answerCallbackQuery({ text: `Статус изменён на "${STATUS_LABELS[status]}"` });

    if (ctx.chat) {
      let notification = `📝 Статус изменён: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[status]}`;
      if (cardUpdateFailed) {
        notification += '\n⚠️ Не удалось обновить карточку тикета';
      }
      try {
        await ctx.api.sendMessage(ctx.chat.id, notification, {
          message_thread_id: user.topicId,
        });
      } catch (notifyError) {
        logger.error({ error: notifyError, userId, topicId: user.topicId }, 'Failed to send status notification');
      }
    }

    logger.info({ userId, oldStatus, newStatus: status, cardUpdateFailed }, 'Ticket status changed');
  } catch (error) {
    logger.error({ error, userId, status }, 'Failed to update ticket status');
    await ctx.answerCallbackQuery({ text: 'Ошибка при обновлении статуса' }).catch((err: unknown) => {
      logger.error({ error: err, userId }, 'Failed to answer error callback');
    });
  }
}

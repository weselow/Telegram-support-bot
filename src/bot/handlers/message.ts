import type { Context } from 'grammy';
import { findUserByTgId, createTicket } from '../../services/ticket.service.js';
import { createTopic, sendTicketCard } from '../../services/topic.service.js';
import { mirrorUserMessage } from '../../services/message.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export async function privateMessageHandler(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message) {
    return;
  }

  const tgUserId = BigInt(ctx.from.id);
  const firstName = ctx.from.first_name;
  const username = ctx.from.username ?? null;

  let user = await findUserByTgId(tgUserId);

  if (!user) {
    logger.info({ tgUserId: ctx.from.id }, 'New user, creating topic');

    try {
      const topic = await createTopic(ctx.api, {
        tgUserId: ctx.from.id,
        firstName,
        username: username ?? undefined,
      });

      user = await createTicket({
        tgUserId,
        tgUsername: username,
        tgFirstName: firstName,
        topicId: topic.message_thread_id,
        question: ctx.message.text,
      });

      await sendTicketCard(ctx.api, topic.message_thread_id, {
        tgUserId: ctx.from.id,
        firstName,
        username: username ?? undefined,
      });

      await ctx.reply(
        'Спасибо за обращение! Ваш запрос принят в работу. ' +
          'Сотрудник поддержки свяжется с вами в ближайшее время.'
      );
    } catch (error) {
      logger.error({ error, tgUserId: ctx.from.id }, 'Failed to create ticket');
      await ctx.reply(
        'Произошла ошибка при создании обращения. Пожалуйста, попробуйте позже.'
      );
      return;
    }
  }

  try {
    const supportGroupId = Number(env.SUPPORT_GROUP_ID);
    await mirrorUserMessage(ctx.api, ctx.message, user.id, user.topicId, supportGroupId);
  } catch (error) {
    logger.error({ error, tgUserId: ctx.from.id }, 'Failed to mirror message');
  }
}

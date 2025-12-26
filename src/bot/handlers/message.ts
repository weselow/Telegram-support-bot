import type { Context } from 'grammy';
import { GrammyError } from 'grammy';
import { findUserByTgId, createTicket } from '../../services/ticket.service.js';
import { createTopic, sendTicketCard } from '../../services/topic.service.js';
import { mirrorUserMessage } from '../../services/message.service.js';
import { autoChangeStatus } from '../../services/status.service.js';
import { startSlaTimers, cancelAllSlaTimers } from '../../services/sla.service.js';
import { cancelAutocloseTimer } from '../../services/autoclose.service.js';
import { buildPhoneConfirmKeyboard, buildPhoneConfirmMessage } from './phone.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { env } from '../../config/env.js';
import { messages } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';
import { captureError, addBreadcrumb } from '../../config/sentry.js';

export async function privateMessageHandler(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message) {
    return;
  }

  // Contact messages are handled by contactHandler
  if (ctx.message.contact) {
    return;
  }

  addBreadcrumb('message', 'Incoming private message', 'info', {
    tgUserId: ctx.from.id,
    messageType: ctx.message.text ? 'text' : 'media',
  });

  const tgUserId = BigInt(ctx.from.id);
  const firstName = ctx.from.first_name;
  const username = ctx.from.username ?? null;

  let user = await findUserByTgId(tgUserId);
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
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

      const cardMessageId = await sendTicketCard(
        ctx.api,
        topic.message_thread_id,
        user.id,
        {
          tgUserId: ctx.from.id,
          firstName,
          username: username ?? undefined,
        }
      );

      await userRepository.updateCardMessageId(user.id, cardMessageId);

      // Start SLA timers for new ticket
      await startSlaTimers(user.id, topic.message_thread_id);

      await ctx.reply(messages.ticketCreated);
    } catch (error) {
      captureError(error, { tgUserId: String(ctx.from.id), action: 'createTicket' });
      logger.error({ error, tgUserId: ctx.from.id }, 'Failed to create ticket');
      await ctx.reply(messages.ticketCreateError);
      return;
    }
  }

  // Skip mirroring for new users - first message is saved as question in ticket
  if (isNewUser) {
    return;
  }

  try {
    const supportGroupId = Number(env.SUPPORT_GROUP_ID);

    // Handle reopening closed tickets
    if (user.status === 'CLOSED') {
      const result = await autoChangeStatus(ctx.api, user, 'CLIENT_REOPEN');
      if (result.changed) {
        // Notify support about reopening
        await ctx.api.sendMessage(supportGroupId, messages.reopened, {
          message_thread_id: user.topicId,
        });

        // Cancel any stale timers and start fresh SLA timers
        await cancelAllSlaTimers(user.id, user.topicId);
        await startSlaTimers(user.id, user.topicId);

        // Ask for phone confirmation
        await ctx.reply(buildPhoneConfirmMessage(user.phone), {
          reply_markup: buildPhoneConfirmKeyboard(user.id, !!user.phone),
        });
      }
    }

    const mirrorResult = await mirrorUserMessage(ctx.api, ctx.message, user.id, user.topicId, supportGroupId);

    if (mirrorResult === null) {
      await ctx.reply(messages.unsupportedMessageType);
      return;
    }

    // Cancel autoclose timer if user was waiting for client
    if (user.status === 'WAITING_CLIENT') {
      await cancelAutocloseTimer(user.id, user.topicId);
    }

    // Auto change status: WAITING_CLIENT → IN_PROGRESS
    await autoChangeStatus(ctx.api, user, 'CLIENT_REPLY');
  } catch (error) {
    captureError(error, { tgUserId: String(ctx.from.id), userId: user.id, action: 'mirrorMessage' });

    if (error instanceof GrammyError) {
      if (error.error_code === 429) {
        logger.warn({ tgUserId: ctx.from.id }, 'Rate limit hit');
        await ctx.reply(messages.rateLimitError);
        return;
      }
      if (error.error_code === 403) {
        logger.error({ topicId: user.topicId }, 'Bot removed from support group or topic deleted');
        await ctx.reply(messages.technicalError);
        return;
      }
    }

    logger.error({ error, tgUserId: ctx.from.id }, 'Failed to mirror message');
    await ctx.reply(messages.deliveryFailed);
  }
}

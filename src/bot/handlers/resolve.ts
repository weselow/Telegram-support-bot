import type { Context } from 'grammy';
import { userRepository } from '../../db/repositories/user.repository.js';
import { autoChangeStatus } from '../../services/status.service.js';
import { env } from '../../config/env.js';
import { messages } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';

function parseResolveCallback(data: string): string | null {
  const parts = data.split(':');
  if (parts.length !== 2 || parts[0] !== 'resolve') {
    return null;
  }
  return parts[1] ?? null;
}

export async function resolveCallbackHandler(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery?.data || !ctx.from) {
    return;
  }

  const userId = parseResolveCallback(ctx.callbackQuery.data);
  if (!userId) {
    return;
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.ticketNotFound });
    return;
  }

  // Verify the callback is from the ticket owner
  if (user.tgUserId !== BigInt(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.notYourTicket });
    return;
  }

  if (user.status === 'CLOSED') {
    await ctx.answerCallbackQuery({ text: messages.callbacks.alreadyClosed });
    return;
  }

  const result = await autoChangeStatus(ctx.api, user, 'CLIENT_RESOLVED');

  if (result.changed) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.thanksClosed });

    // Notify in topic (only if user has a topic)
    if (user.topicId) {
      try {
        const supportGroupId = Number(env.SUPPORT_GROUP_ID);
        await ctx.api.sendMessage(supportGroupId, messages.resolve.clientClosed, {
          message_thread_id: user.topicId,
        });
      } catch (error) {
        logger.error({ error, userId, topicId: user.topicId }, 'Failed to send resolve notification');
      }
    }
  } else {
    await ctx.answerCallbackQuery({ text: messages.callbacks.closeError });
  }
}

import type { Context } from 'grammy';
import { userRepository } from '../../db/repositories/user.repository.js';
import { autoChangeStatus } from '../../services/status.service.js';
import { env } from '../../config/env.js';
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
    await ctx.answerCallbackQuery({ text: 'Неизвестная команда' });
    return;
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Тикет не найден' });
    return;
  }

  // Verify the callback is from the ticket owner
  if (user.tgUserId !== BigInt(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: 'Это не ваш тикет' });
    return;
  }

  if (user.status === 'CLOSED') {
    await ctx.answerCallbackQuery({ text: 'Тикет уже закрыт' });
    return;
  }

  const result = await autoChangeStatus(ctx.api, user, 'CLIENT_RESOLVED');

  if (result.changed) {
    await ctx.answerCallbackQuery({ text: 'Спасибо! Тикет закрыт.' });

    // Notify in topic
    try {
      const supportGroupId = Number(env.SUPPORT_GROUP_ID);
      await ctx.api.sendMessage(supportGroupId, '✅ Клиент закрыл тикет', {
        message_thread_id: user.topicId,
      });
    } catch (error) {
      logger.error({ error, userId, topicId: user.topicId }, 'Failed to send resolve notification');
    }
  } else {
    await ctx.answerCallbackQuery({ text: 'Не удалось закрыть тикет' });
  }
}

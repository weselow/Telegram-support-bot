import type { Context } from 'grammy';
import { GrammyError } from 'grammy';
import { findUserByTgId } from '../../services/ticket.service.js';
import { mirrorUserMessage } from '../../services/message.service.js';
import { autoChangeStatus } from '../../services/status.service.js';
import { cancelAllSlaTimers, startSlaTimers } from '../../services/sla.service.js';
import { cancelAutocloseTimer } from '../../services/autoclose.service.js';
import { checkRateLimit } from '../../services/rate-limit.service.js';
import { handleOnboarding } from './onboarding.js';
import { setOnboardingState } from '../../services/onboarding.service.js';
import { buildPhoneConfirmKeyboard, buildPhoneConfirmMessage } from './phone.js';
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

  // Check rate limit before processing
  const rateLimitResult = await checkRateLimit(tgUserId);
  if (!rateLimitResult.allowed) {
    await ctx.reply(messages.rateLimitError);
    return;
  }

  // Check if user is in onboarding flow
  const handledByOnboarding = await handleOnboarding(ctx);
  if (handledByOnboarding) {
    return;
  }

  // Get existing user
  const user = await findUserByTgId(tgUserId);

  if (!user?.topicId) {
    // User has no ticket yet and is not in onboarding
    // This can happen if they skip /start and write directly
    // Start onboarding and send welcome
    await setOnboardingState(tgUserId, { step: 'awaiting_question' });
    await ctx.reply(messages.welcome);
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

    // Add [TG] prefix if user has both web and Telegram channels linked
    const mirrorOptions = user.webSessionId ? { channelPrefix: 'TG' as const } : undefined;
    const mirrorResult = await mirrorUserMessage(ctx.api, ctx.message, user.id, user.topicId, supportGroupId, mirrorOptions);

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
        const retryAfter = error.parameters.retry_after ?? 'unknown';
        logger.warn({ tgUserId: ctx.from.id, retryAfter }, 'Telegram rate limit hit (429)');
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

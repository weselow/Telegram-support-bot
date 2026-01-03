import type { Context } from 'grammy';
import { messages } from '../../config/messages.js';
import { getRedirectData } from '../../http/routes/ask-support.js';
import { setOnboardingState, type OnboardingState } from '../../services/onboarding.service.js';
import { webChatService } from '../../services/web-chat.service.js';
import { connectionManager } from '../../http/ws/connection-manager.js';
import { logger } from '../../utils/logger.js';

const SHORT_ID_PATTERN = /^[0-9a-f]{8}$/i;
const LINK_TOKEN_PATTERN = /^link_[0-9a-f]{32}$/i;

export async function startHandler(ctx: Context): Promise<void> {
  const tgUserId = ctx.from?.id;

  if (!tgUserId) {
    return;
  }

  // Check for deep link payload
  const payload = ctx.match as string | undefined;

  // Handle link token (web chat -> Telegram migration)
  if (payload && LINK_TOKEN_PATTERN.test(payload)) {
    await handleLinkToken(ctx, payload);
    return;
  }

  let onboardingState: OnboardingState = {
    step: 'awaiting_question',
  };

  // Handle SHORT_ID from /ask-support redirect
  if (payload && SHORT_ID_PATTERN.test(payload)) {
    logger.debug({ tgUserId, payload }, 'Processing start with payload');

    const redirectData = await getRedirectData(payload);

    if (redirectData) {
      logger.info(
        { tgUserId, ip: redirectData.ip, city: redirectData.city },
        'User arrived from website redirect',
      );

      const sourceUrl = redirectData.sourceUrl;
      const sourceCity = redirectData.city;
      const ip = redirectData.ip;

      onboardingState = {
        step: 'awaiting_question',
        ...(sourceUrl && { sourceUrl }),
        ...(sourceCity && { sourceCity }),
        ...(ip && { ip }),
      };
    } else {
      logger.debug({ tgUserId, payload }, 'No redirect data found for payload');
    }
  }

  // Start onboarding flow
  await setOnboardingState(BigInt(tgUserId), onboardingState);

  await ctx.reply(messages.welcome);
}

async function handleLinkToken(ctx: Context, token: string): Promise<void> {
  const tgUserId = ctx.from?.id;
  const tgUsername = ctx.from?.username ?? null;
  const tgFirstName = ctx.from?.first_name ?? 'User';

  if (!tgUserId) {
    return;
  }

  logger.info({ tgUserId, token }, 'Processing Telegram link token');

  const user = await webChatService.processLinkToken(
    token,
    BigInt(tgUserId),
    tgUsername,
    tgFirstName
  );

  if (!user) {
    logger.warn({ tgUserId, token }, 'Invalid or expired link token');
    await ctx.reply('Ссылка недействительна или устарела. Попробуйте получить новую ссылку в веб-чате.');
    return;
  }

  // Notify web client about successful linking
  if (user.webSessionId) {
    connectionManager.sendToUser(user.id, 'channel_linked', {
      telegram: tgUsername ? `@${tgUsername}` : tgFirstName,
      historyCopied: true,
    });
  }

  logger.info({ tgUserId, userId: user.id }, 'Telegram account linked to web session');

  // Send welcome message for web→telegram transition
  await ctx.reply(messages.webToTelegram.welcome);

  // Send phone request message
  await ctx.reply(messages.webToTelegram.askPhone);
}

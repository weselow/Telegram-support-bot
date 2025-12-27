import type { Context } from 'grammy';
import { messages } from '../../config/messages.js';
import { getRedirectData } from '../../http/routes/ask-support.js';
import { setOnboardingState, type OnboardingState } from '../../services/onboarding.service.js';
import { logger } from '../../utils/logger.js';

const SHORT_ID_PATTERN = /^[0-9a-f]{8}$/i;

export async function startHandler(ctx: Context): Promise<void> {
  const tgUserId = ctx.from?.id;

  if (!tgUserId) {
    return;
  }

  // Check for deep link payload (SHORT_ID from /ask-support redirect)
  const payload = ctx.match as string | undefined;

  let onboardingState: OnboardingState = {
    step: 'awaiting_question',
  };

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

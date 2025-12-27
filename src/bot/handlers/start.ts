import type { Context } from 'grammy';
import { messages, formatMessage } from '../../config/messages.js';
import { getRedirectData } from '../../http/routes/ask-support.js';
import { storeRedirectContext } from '../../services/redirect-context.service.js';
import { logger } from '../../utils/logger.js';

const SHORT_ID_PATTERN = /^[0-9a-f]{8}$/i;

export async function startHandler(ctx: Context): Promise<void> {
  const firstName = ctx.from?.first_name ?? 'пользователь';
  const tgUserId = ctx.from?.id;

  // Check for deep link payload (SHORT_ID from /ask-support redirect)
  const payload = ctx.match as string | undefined;

  if (payload && tgUserId && SHORT_ID_PATTERN.test(payload)) {
    logger.debug({ tgUserId, payload }, 'Processing start with payload');

    const redirectData = await getRedirectData(payload);

    if (redirectData) {
      logger.info(
        { tgUserId, ip: redirectData.ip, city: redirectData.city },
        'User arrived from website redirect',
      );

      // Store context for use when user sends first message
      await storeRedirectContext(BigInt(tgUserId), {
        sourceUrl: redirectData.sourceUrl,
        sourceCity: redirectData.city,
        ip: redirectData.ip,
        geoipResponse: redirectData.geoipResponse,
      });
    } else {
      logger.debug({ tgUserId, payload }, 'No redirect data found for payload');
    }
  }

  await ctx.reply(formatMessage(messages.welcome, { firstName }));
}

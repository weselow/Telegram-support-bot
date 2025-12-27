import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import { getRedisClient } from '../../config/redis-client.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { botFilterHook } from '../middleware/bot-filter.js';
import { getLocationByIp, type DaDataLocation } from '../../services/geoip.service.js';

const REDIRECT_PREFIX = 'redirect:';
const REDIRECT_TTL = 60 * 60; // 1 hour in seconds
const SHORT_ID_LENGTH = 8;

export interface RedirectData {
  ip: string;
  sourceUrl: string | null;
  city: string | null;
  geoipResponse: DaDataLocation | null;
  createdAt: string;
}

function generateShortId(): string {
  return randomBytes(SHORT_ID_LENGTH / 2).toString('hex');
}

export function askSupportRoute(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', botFilterHook);

  fastify.get('/ask-support', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip;
    const referer = request.headers.referer ?? request.headers.referrer ?? null;

    // Get GeoIP data
    const geoResult = await getLocationByIp(ip);

    // Generate short ID and save redirect data
    const shortId = generateShortId();
    const redirectData: RedirectData = {
      ip,
      sourceUrl: referer as string | null,
      city: geoResult.city,
      geoipResponse: geoResult.fullResponse,
      createdAt: new Date().toISOString(),
    };

    const redis = getRedisClient();
    const cacheKey = `${REDIRECT_PREFIX}${shortId}`;

    try {
      await redis.setex(cacheKey, REDIRECT_TTL, JSON.stringify(redirectData));
      logger.info({ shortId, ip, referer }, 'Created redirect entry');
    } catch (error) {
      logger.error({ error, shortId }, 'Failed to save redirect data');
      // Continue anyway - bot will work without extra data
    }

    // Redirect to Telegram deep link
    const telegramUrl = `https://t.me/${env.BOT_USERNAME}?start=${shortId}`;
    return reply.redirect(telegramUrl);
  });
}

export async function getRedirectData(shortId: string): Promise<RedirectData | null> {
  const redis = getRedisClient();
  const cacheKey = `${REDIRECT_PREFIX}${shortId}`;

  try {
    // Atomic get + delete (one-time use)
    const data = await redis.getdel(cacheKey);
    if (!data) {
      return null;
    }

    return JSON.parse(data) as RedirectData;
  } catch (error) {
    logger.error({ error, shortId }, 'Failed to get redirect data');
    return null;
  }
}

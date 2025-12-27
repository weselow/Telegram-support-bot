import { getRedisClient } from '../config/redis-client.js';
import { logger } from '../utils/logger.js';
import type { DaDataLocation } from './geoip.service.js';

const CONTEXT_PREFIX = 'user_context:';
const CONTEXT_TTL = 24 * 60 * 60; // 24 hours in seconds

export interface UserRedirectContext {
  sourceUrl: string | null;
  sourceCity: string | null;
  ip: string | null;
  geoipResponse: DaDataLocation | null;
}

export async function storeRedirectContext(
  tgUserId: bigint,
  context: UserRedirectContext,
): Promise<void> {
  const redis = getRedisClient();
  const cacheKey = `${CONTEXT_PREFIX}${tgUserId.toString()}`;

  try {
    await redis.setex(cacheKey, CONTEXT_TTL, JSON.stringify(context));
    logger.debug({ tgUserId: tgUserId.toString() }, 'Stored redirect context');
  } catch (error) {
    logger.warn({ error, tgUserId: tgUserId.toString() }, 'Failed to store redirect context');
  }
}

export async function getRedirectContext(
  tgUserId: bigint,
): Promise<UserRedirectContext | null> {
  const redis = getRedisClient();
  const cacheKey = `${CONTEXT_PREFIX}${tgUserId.toString()}`;

  try {
    const data = await redis.get(cacheKey);
    if (!data) {
      return null;
    }

    // Delete after reading (one-time use)
    await redis.del(cacheKey);

    return JSON.parse(data) as UserRedirectContext;
  } catch (error) {
    logger.warn({ error, tgUserId: tgUserId.toString() }, 'Failed to get redirect context');
    return null;
  }
}

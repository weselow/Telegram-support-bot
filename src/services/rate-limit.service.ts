import { getRedisClient } from '../config/redis-client.js';
import { logger } from '../utils/logger.js';

const RATE_LIMIT = 10; // messages per window
const RATE_WINDOW = 60; // seconds

const IP_RATE_LIMIT = 10; // requests per window
const IP_RATE_WINDOW = 60; // seconds

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

export async function checkRateLimit(userId: bigint): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `rate:user:${String(userId)}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, RATE_WINDOW);
    }

    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, RATE_LIMIT - count);
    const allowed = count <= RATE_LIMIT;

    if (!allowed) {
      logger.warn({ userId: userId.toString(), count }, 'Rate limit exceeded');
    }

    return {
      allowed,
      remaining,
      resetInSeconds: ttl > 0 ? ttl : RATE_WINDOW,
    };
  } catch (error) {
    logger.error({ error, userId: userId.toString() }, 'Rate limit check failed');
    // Fail open: allow request if Redis is unavailable
    return {
      allowed: true,
      remaining: RATE_LIMIT,
      resetInSeconds: RATE_WINDOW,
    };
  }
}

export async function checkIpRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `rate:ip:${ip}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, IP_RATE_WINDOW);
    }

    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, IP_RATE_LIMIT - count);
    const allowed = count <= IP_RATE_LIMIT;

    if (!allowed) {
      logger.warn({ ip, count }, 'IP rate limit exceeded');
    }

    return {
      allowed,
      remaining,
      resetInSeconds: ttl > 0 ? ttl : IP_RATE_WINDOW,
    };
  } catch (error) {
    logger.error({ error, ip }, 'IP rate limit check failed');
    // Fail open: allow request if Redis is unavailable
    return {
      allowed: true,
      remaining: IP_RATE_LIMIT,
      resetInSeconds: IP_RATE_WINDOW,
    };
  }
}

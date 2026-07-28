import { randomUUID } from 'node:crypto';
import { getRedisClient } from '../config/redis-client.js';
import { logger } from '../utils/logger.js';

const LOCK_PREFIX = 'lock:';
const LOCK_TTL_MS = 15_000;
const RETRY_DELAY_MS = 100;
const MAX_WAIT_MS = 5_000;

// Release only our own lock: another worker may already hold it after a TTL expiry
const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export interface AcquireLockOptions {
  ttlMs?: number | undefined;
  retryDelayMs?: number | undefined;
  maxWaitMs?: number | undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Take a distributed lock, waiting for it to be released by another worker.
 * Returns the lock token, or null when the lock stayed busy or Redis failed —
 * callers must treat null as "no lock held" and stay correct without it.
 */
export async function acquireLock(
  key: string,
  options: AcquireLockOptions = {}
): Promise<string | null> {
  const ttlMs = options.ttlMs ?? LOCK_TTL_MS;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  const maxWaitMs = options.maxWaitMs ?? MAX_WAIT_MS;

  const redis = getRedisClient();
  const redisKey = `${LOCK_PREFIX}${key}`;
  const token = randomUUID();

  try {
    for (let waited = 0; waited <= maxWaitMs; waited += retryDelayMs) {
      const result = await redis.set(redisKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return token;
      }

      await delay(retryDelayMs);
    }

    logger.warn({ key, maxWaitMs }, 'Lock is still busy, giving up');
    return null;
  } catch (error) {
    logger.error({ error, key }, 'Failed to acquire lock');
    return null;
  }
}

export async function releaseLock(key: string, token: string): Promise<void> {
  const redis = getRedisClient();
  const redisKey = `${LOCK_PREFIX}${key}`;

  try {
    await redis.eval(RELEASE_SCRIPT, 1, redisKey, token);
  } catch (error) {
    logger.error({ error, key }, 'Failed to release lock');
  }
}

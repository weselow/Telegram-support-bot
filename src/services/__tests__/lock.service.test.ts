import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { acquireLock, releaseLock } from '../lock.service.js';

vi.mock('../../config/redis-client.js', () => ({
  getRedisClient: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('lock.service', () => {
  let redis: { set: Mock; eval: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();

    redis = { set: vi.fn(), eval: vi.fn() };
    const redisClient = await import('../../config/redis-client.js');
    (redisClient.getRedisClient as Mock).mockReturnValue(redis);
  });

  describe('acquireLock', () => {
    it('should return token when lock is free', async () => {
      redis.set.mockResolvedValue('OK');

      const token = await acquireLock('topic:user-1');

      expect(token).toBeTruthy();
      expect(redis.set).toHaveBeenCalledWith(
        'lock:topic:user-1',
        token,
        'PX',
        expect.any(Number),
        'NX'
      );
    });

    it('should retry until the lock is released', async () => {
      redis.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');

      const token = await acquireLock('topic:user-1', { retryDelayMs: 1 });

      expect(token).toBeTruthy();
      expect(redis.set).toHaveBeenCalledTimes(2);
    });

    it('should return null when waiting time is over', async () => {
      redis.set.mockResolvedValue(null);

      const token = await acquireLock('topic:user-1', { retryDelayMs: 1, maxWaitMs: 3 });

      expect(token).toBeNull();
    });

    it('should return null when Redis is unavailable', async () => {
      redis.set.mockRejectedValue(new Error('Redis down'));

      const token = await acquireLock('topic:user-1', { retryDelayMs: 1 });

      expect(token).toBeNull();
    });
  });

  describe('releaseLock', () => {
    it('should release the lock only when the token matches', async () => {
      redis.eval.mockResolvedValue(1);

      await releaseLock('topic:user-1', 'token-1');

      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'lock:topic:user-1',
        'token-1'
      );
    });

    it('should not throw when Redis is unavailable', async () => {
      redis.eval.mockRejectedValue(new Error('Redis down'));

      await expect(releaseLock('topic:user-1', 'token-1')).resolves.toBeUndefined();
    });
  });
});

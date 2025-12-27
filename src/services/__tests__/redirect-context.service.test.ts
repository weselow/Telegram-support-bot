import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../config/redis-client.js', () => ({
  getRedisClient: vi.fn(() => ({
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  })),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  storeRedirectContext,
  getRedirectContext,
  type UserRedirectContext,
} from '../redirect-context.service.js';
import { getRedisClient } from '../../config/redis-client.js';
import { logger } from '../../utils/logger.js';

describe('redirect-context.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeRedirectContext', () => {
    it('should store context in Redis with correct TTL', async () => {
      const mockRedis = {
        setex: vi.fn().mockResolvedValue('OK'),
        get: vi.fn(),
        del: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const context: UserRedirectContext = {
        sourceUrl: 'https://example.com',
        sourceCity: 'Москва',
        ip: '8.8.8.8',
        geoipResponse: null,
      };

      await storeRedirectContext(BigInt(123456), context);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'user_context:123456',
        86400, // 24 hours
        JSON.stringify(context),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { tgUserId: '123456' },
        'Stored redirect context',
      );
    });

    it('should log error but not throw on Redis failure', async () => {
      const mockRedis = {
        setex: vi.fn().mockRejectedValue(new Error('Redis error')),
        get: vi.fn(),
        del: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const context: UserRedirectContext = {
        sourceUrl: null,
        sourceCity: null,
        ip: null,
        geoipResponse: null,
      };

      // Should not throw
      await expect(storeRedirectContext(BigInt(123456), context)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ tgUserId: '123456' }),
        'Failed to store redirect context',
      );
    });
  });

  describe('getRedirectContext', () => {
    it('should return context and delete from Redis', async () => {
      const storedContext: UserRedirectContext = {
        sourceUrl: 'https://example.com',
        sourceCity: 'Москва',
        ip: '8.8.8.8',
        geoipResponse: null,
      };

      const mockRedis = {
        setex: vi.fn(),
        get: vi.fn().mockResolvedValue(JSON.stringify(storedContext)),
        del: vi.fn().mockResolvedValue(1),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectContext(BigInt(123456));

      expect(result).toEqual(storedContext);
      expect(mockRedis.get).toHaveBeenCalledWith('user_context:123456');
      expect(mockRedis.del).toHaveBeenCalledWith('user_context:123456');
    });

    it('should return null when context not found', async () => {
      const mockRedis = {
        setex: vi.fn(),
        get: vi.fn().mockResolvedValue(null),
        del: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectContext(BigInt(123456));

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return null and log error on Redis failure', async () => {
      const mockRedis = {
        setex: vi.fn(),
        get: vi.fn().mockRejectedValue(new Error('Redis error')),
        del: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectContext(BigInt(123456));

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ tgUserId: '123456' }),
        'Failed to get redirect context',
      );
    });

    it('should handle large BigInt user IDs', async () => {
      const largeUserId = BigInt('9007199254740991'); // Max safe integer

      const storedContext: UserRedirectContext = {
        sourceUrl: null,
        sourceCity: 'Санкт-Петербург',
        ip: '1.2.3.4',
        geoipResponse: null,
      };

      const mockRedis = {
        setex: vi.fn(),
        get: vi.fn().mockResolvedValue(JSON.stringify(storedContext)),
        del: vi.fn().mockResolvedValue(1),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectContext(largeUserId);

      expect(result).toEqual(storedContext);
      expect(mockRedis.get).toHaveBeenCalledWith('user_context:9007199254740991');
    });
  });
});

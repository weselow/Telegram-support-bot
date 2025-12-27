import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../config/redis-client.js', () => ({
  getRedisClient: vi.fn(() => ({
    getdel: vi.fn(),
    setex: vi.fn(),
  })),
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { getRedirectData, type RedirectData } from '../ask-support.js';
import { getRedisClient } from '../../../config/redis-client.js';
import { logger } from '../../../utils/logger.js';

describe('ask-support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRedirectData', () => {
    it('should return data and delete from Redis atomically', async () => {
      const redirectData: RedirectData = {
        ip: '8.8.8.8',
        sourceUrl: 'https://example.com',
        city: 'Москва',
        geoipResponse: null,
        createdAt: '2025-12-27T12:00:00.000Z',
      };

      const mockRedis = {
        getdel: vi.fn().mockResolvedValue(JSON.stringify(redirectData)),
        setex: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectData('abc12345');

      expect(result).toEqual(redirectData);
      expect(mockRedis.getdel).toHaveBeenCalledWith('redirect:abc12345');
    });

    it('should return null when data not found', async () => {
      const mockRedis = {
        getdel: vi.fn().mockResolvedValue(null),
        setex: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectData('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null and log error on Redis failure', async () => {
      const mockRedis = {
        getdel: vi.fn().mockRejectedValue(new Error('Redis error')),
        setex: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectData('abc12345');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ shortId: 'abc12345' }),
        'Failed to get redirect data',
      );
    });

    it('should return null on invalid JSON', async () => {
      const mockRedis = {
        getdel: vi.fn().mockResolvedValue('not valid json'),
        setex: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectData('abc12345');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle redirect data with null optional fields', async () => {
      const redirectData: RedirectData = {
        ip: '1.2.3.4',
        sourceUrl: null,
        city: null,
        geoipResponse: null,
        createdAt: '2025-12-27T12:00:00.000Z',
      };

      const mockRedis = {
        getdel: vi.fn().mockResolvedValue(JSON.stringify(redirectData)),
        setex: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectData('abc12345');

      expect(result).toEqual(redirectData);
      expect(result?.sourceUrl).toBeNull();
      expect(result?.city).toBeNull();
    });

    it('should handle redirect data with full geoipResponse', async () => {
      const redirectData: RedirectData = {
        ip: '8.8.8.8',
        sourceUrl: 'https://example.com/page',
        city: 'Москва',
        geoipResponse: {
          value: 'Москва',
          unrestricted_value: 'Москва',
          data: {
            country: 'Россия',
            country_iso_code: 'RU',
            federal_district: 'Центральный',
            region_with_type: 'г Москва',
            region: 'Москва',
            city_with_type: 'г Москва',
            city: 'Москва',
            settlement_with_type: null,
            settlement: null,
            postal_code: '101000',
          },
        },
        createdAt: '2025-12-27T12:00:00.000Z',
      };

      const mockRedis = {
        getdel: vi.fn().mockResolvedValue(JSON.stringify(redirectData)),
        setex: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getRedirectData('abc12345');

      expect(result).toEqual(redirectData);
      expect(result?.geoipResponse?.data.city).toBe('Москва');
    });
  });
});

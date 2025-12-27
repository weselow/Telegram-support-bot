import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Mock dependencies before imports
vi.mock('../../../config/redis-client.js', () => ({
  getRedisClient: vi.fn(() => ({
    getdel: vi.fn(),
    setex: vi.fn().mockResolvedValue('OK'),
  })),
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../config/env.js', () => ({
  env: {
    BOT_USERNAME: 'test_bot',
  },
}));

vi.mock('../../middleware/bot-filter.js', () => ({
  botFilterHook: vi.fn().mockImplementation(async () => {}),
}));

vi.mock('../../../services/rate-limit.service.js', () => ({
  checkIpRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../../../services/geoip.service.js', () => ({
  getLocationByIp: vi.fn().mockResolvedValue({ city: null, fullResponse: null }),
}));

import { getRedirectData, askSupportRoute, type RedirectData } from '../ask-support.js';
import { getRedisClient } from '../../../config/redis-client.js';
import { logger } from '../../../utils/logger.js';
import { checkIpRateLimit } from '../../../services/rate-limit.service.js';
import { getLocationByIp } from '../../../services/geoip.service.js';
import { botFilterHook } from '../../middleware/bot-filter.js';

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

  describe('GET /ask-support route', () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      fastify = Fastify();
      askSupportRoute(fastify);
      await fastify.ready();
    });

    afterEach(async () => {
      await fastify.close();
    });

    it('should redirect to Telegram deep link on valid request', async () => {
      const mockRedis = {
        getdel: vi.fn(),
        setex: vi.fn().mockResolvedValue('OK'),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);
      vi.mocked(checkIpRateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 60 });

      const response = await fastify.inject({
        method: 'GET',
        url: '/ask-support',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toMatch(/^https:\/\/t\.me\/test_bot\?start=[0-9a-f]{8}$/);
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ shortId: expect.any(String) }),
        'Created redirect entry',
      );
    });

    it('should return 429 when rate limited', async () => {
      vi.mocked(checkIpRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetInSeconds: 30,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/ask-support',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBe('30');
      expect(JSON.parse(response.body)).toEqual({
        error: 'Too Many Requests',
        retryAfter: 30,
      });
    });

    it('should include referer in redirect data', async () => {
      const mockRedis = {
        getdel: vi.fn(),
        setex: vi.fn().mockResolvedValue('OK'),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);
      vi.mocked(checkIpRateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 60 });

      await fastify.inject({
        method: 'GET',
        url: '/ask-support',
        headers: {
          'user-agent': 'Mozilla/5.0',
          referer: 'https://example.com/page',
        },
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^redirect:[0-9a-f]{8}$/),
        3600,
        expect.stringContaining('"sourceUrl":"https://example.com/page"'),
      );
    });

    it('should include city from GeoIP in redirect data', async () => {
      const mockRedis = {
        getdel: vi.fn(),
        setex: vi.fn().mockResolvedValue('OK'),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);
      vi.mocked(checkIpRateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 60 });
      vi.mocked(getLocationByIp).mockResolvedValue({
        city: 'Москва',
        fullResponse: null,
      });

      await fastify.inject({
        method: 'GET',
        url: '/ask-support',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        3600,
        expect.stringContaining('"city":"Москва"'),
      );
    });

    it('should continue redirect even if Redis fails', async () => {
      const mockRedis = {
        getdel: vi.fn(),
        setex: vi.fn().mockRejectedValue(new Error('Redis error')),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);
      vi.mocked(checkIpRateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 60 });

      const response = await fastify.inject({
        method: 'GET',
        url: '/ask-support',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toMatch(/^https:\/\/t\.me\/test_bot\?start=/);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ shortId: expect.any(String) }),
        'Failed to save redirect data',
      );
    });

    it('should call botFilterHook', async () => {
      vi.mocked(checkIpRateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 60 });

      await fastify.inject({
        method: 'GET',
        url: '/ask-support',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      });

      expect(botFilterHook).toHaveBeenCalled();
    });
  });
});

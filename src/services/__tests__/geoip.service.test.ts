import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../config/redis-client.js', () => ({
  getRedisClient: vi.fn(() => ({
    get: vi.fn(),
    setex: vi.fn(),
  })),
}));

vi.mock('../../config/env.js', () => ({
  env: {
    DADATA_API_KEY: 'test-api-key',
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { getLocationByIp, type DaDataLocation } from '../geoip.service.js';
import { getRedisClient } from '../../config/redis-client.js';
import { env } from '../../config/env.js';

describe('geoip.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPrivateIp (tested via getLocationByIp)', () => {
    it('should skip 127.x.x.x (localhost)', async () => {
      const result = await getLocationByIp('127.0.0.1');
      expect(result).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip 10.x.x.x (Class A private)', async () => {
      const result = await getLocationByIp('10.0.0.1');
      expect(result).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip 172.16-31.x.x (Class B private)', async () => {
      const result1 = await getLocationByIp('172.16.0.1');
      const result2 = await getLocationByIp('172.31.255.255');
      expect(result1).toEqual({ city: null, fullResponse: null });
      expect(result2).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip 192.168.x.x (Class C private)', async () => {
      const result = await getLocationByIp('192.168.1.1');
      expect(result).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip ::1 (IPv6 localhost)', async () => {
      const result = await getLocationByIp('::1');
      expect(result).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip fe80: (IPv6 link-local)', async () => {
      const result = await getLocationByIp('fe80::1');
      expect(result).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip fc00: and fd00: (IPv6 unique local)', async () => {
      const result1 = await getLocationByIp('fc00::1');
      const result2 = await getLocationByIp('fd00::1');
      expect(result1).toEqual({ city: null, fullResponse: null });
      expect(result2).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT skip public IP', async () => {
      const mockRedis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ location: null }),
      });

      await getLocationByIp('8.8.8.8');
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('getLocationByIp', () => {
    it('should return null when DADATA_API_KEY is not configured', async () => {
      vi.mocked(env).DADATA_API_KEY = '';

      const result = await getLocationByIp('8.8.8.8');
      expect(result).toEqual({ city: null, fullResponse: null });
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore
      vi.mocked(env).DADATA_API_KEY = 'test-api-key';
    });

    it('should return cached result on cache hit', async () => {
      const cachedLocation: DaDataLocation = {
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
          postal_code: null,
        },
      };

      const mockRedis = {
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedLocation)),
        setex: vi.fn(),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getLocationByIp('8.8.8.8');

      expect(result.city).toBe('Москва');
      expect(result.fullResponse).toEqual(cachedLocation);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch from API on cache miss and cache result', async () => {
      const apiLocation: DaDataLocation = {
        value: 'Санкт-Петербург',
        unrestricted_value: 'Санкт-Петербург',
        data: {
          country: 'Россия',
          country_iso_code: 'RU',
          federal_district: 'Северо-Западный',
          region_with_type: 'г Санкт-Петербург',
          region: 'Санкт-Петербург',
          city_with_type: 'г Санкт-Петербург',
          city: 'Санкт-Петербург',
          settlement_with_type: null,
          settlement: null,
          postal_code: null,
        },
      };

      const mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        setex: vi.fn().mockResolvedValue('OK'),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ location: apiLocation }),
      });

      const result = await getLocationByIp('8.8.8.8');

      expect(result.city).toBe('Санкт-Петербург');
      expect(mockFetch).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return null when API returns error', async () => {
      const mockRedis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getLocationByIp('8.8.8.8');

      expect(result).toEqual({ city: null, fullResponse: null });
    });

    it('should return null when API returns no location', async () => {
      const mockRedis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ location: null }),
      });

      const result = await getLocationByIp('8.8.8.8');

      expect(result).toEqual({ city: null, fullResponse: null });
    });

    it('should handle fetch error gracefully', async () => {
      const mockRedis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getLocationByIp('8.8.8.8');

      expect(result).toEqual({ city: null, fullResponse: null });
    });

    it('should handle cache read error gracefully', async () => {
      const apiLocation: DaDataLocation = {
        value: 'Москва',
        unrestricted_value: 'Москва',
        data: {
          country: 'Россия',
          country_iso_code: 'RU',
          federal_district: null,
          region_with_type: null,
          region: null,
          city_with_type: null,
          city: 'Москва',
          settlement_with_type: null,
          settlement: null,
          postal_code: null,
        },
      };

      const mockRedis = {
        get: vi.fn().mockRejectedValue(new Error('Redis error')),
        setex: vi.fn().mockResolvedValue('OK'),
      };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ location: apiLocation }),
      });

      const result = await getLocationByIp('8.8.8.8');

      expect(result.city).toBe('Москва');
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('extractCity (tested via getLocationByIp)', () => {
    it('should prioritize city over settlement and region', async () => {
      const location: DaDataLocation = {
        value: 'test',
        unrestricted_value: 'test',
        data: {
          country: 'Россия',
          country_iso_code: 'RU',
          federal_district: null,
          region_with_type: null,
          region: 'Московская область',
          city_with_type: null,
          city: 'Москва',
          settlement_with_type: null,
          settlement: 'Поселок',
          postal_code: null,
        },
      };

      const mockRedis = { get: vi.fn().mockResolvedValue(JSON.stringify(location)), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getLocationByIp('8.8.8.8');
      expect(result.city).toBe('Москва');
    });

    it('should use settlement when city is null', async () => {
      const location: DaDataLocation = {
        value: 'test',
        unrestricted_value: 'test',
        data: {
          country: 'Россия',
          country_iso_code: 'RU',
          federal_district: null,
          region_with_type: null,
          region: 'Московская область',
          city_with_type: null,
          city: null,
          settlement_with_type: null,
          settlement: 'Поселок',
          postal_code: null,
        },
      };

      const mockRedis = { get: vi.fn().mockResolvedValue(JSON.stringify(location)), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getLocationByIp('8.8.8.8');
      expect(result.city).toBe('Поселок');
    });

    it('should use region when city and settlement are null', async () => {
      const location: DaDataLocation = {
        value: 'test',
        unrestricted_value: 'test',
        data: {
          country: 'Россия',
          country_iso_code: 'RU',
          federal_district: null,
          region_with_type: null,
          region: 'Московская область',
          city_with_type: null,
          city: null,
          settlement_with_type: null,
          settlement: null,
          postal_code: null,
        },
      };

      const mockRedis = { get: vi.fn().mockResolvedValue(JSON.stringify(location)), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getLocationByIp('8.8.8.8');
      expect(result.city).toBe('Московская область');
    });

    it('should return null when all location fields are null', async () => {
      const location: DaDataLocation = {
        value: 'test',
        unrestricted_value: 'test',
        data: {
          country: 'Россия',
          country_iso_code: 'RU',
          federal_district: null,
          region_with_type: null,
          region: null,
          city_with_type: null,
          city: null,
          settlement_with_type: null,
          settlement: null,
          postal_code: null,
        },
      };

      const mockRedis = { get: vi.fn().mockResolvedValue(JSON.stringify(location)), setex: vi.fn() };
      vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);

      const result = await getLocationByIp('8.8.8.8');
      expect(result.city).toBeNull();
    });
  });
});

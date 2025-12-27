import { getRedisClient } from '../config/redis-client.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const GEOIP_CACHE_PREFIX = 'geoip:';
const GEOIP_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const DADATA_API_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/iplocate/address';

export interface DaDataLocation {
  value: string;
  unrestricted_value: string;
  data: {
    country: string | null;
    country_iso_code: string | null;
    federal_district: string | null;
    region_with_type: string | null;
    region: string | null;
    city_with_type: string | null;
    city: string | null;
    settlement_with_type: string | null;
    settlement: string | null;
    postal_code: string | null;
  };
}

export interface GeoIpResult {
  city: string | null;
  fullResponse: DaDataLocation | null;
}

export async function getLocationByIp(ip: string): Promise<GeoIpResult> {
  if (!env.DADATA_API_KEY) {
    logger.debug('DADATA_API_KEY not configured, skipping GeoIP lookup');
    return { city: null, fullResponse: null };
  }

  // Skip private/local IPs
  if (isPrivateIp(ip)) {
    logger.debug({ ip }, 'Skipping GeoIP for private IP');
    return { city: null, fullResponse: null };
  }

  const redis = getRedisClient();
  const cacheKey = `${GEOIP_CACHE_PREFIX}${ip}`;

  // Check cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as DaDataLocation;
      logger.debug({ ip }, 'GeoIP cache hit');
      return {
        city: extractCity(parsed),
        fullResponse: parsed,
      };
    }
  } catch (error) {
    logger.error({ error, ip }, 'Failed to read GeoIP cache');
  }

  // Fetch from DaData
  try {
    const response = await fetch(DADATA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${env.DADATA_API_KEY}`,
      },
      body: JSON.stringify({ ip }),
    });

    if (!response.ok) {
      logger.warn(
        { ip, status: response.status },
        'DaData API returned error',
      );
      return { city: null, fullResponse: null };
    }

    const data = (await response.json()) as { location: DaDataLocation | null };

    if (!data.location) {
      logger.debug({ ip }, 'DaData returned no location');
      return { city: null, fullResponse: null };
    }

    // Cache the response
    try {
      await redis.setex(cacheKey, GEOIP_CACHE_TTL, JSON.stringify(data.location));
      logger.debug({ ip }, 'Cached GeoIP response');
    } catch (error) {
      logger.error({ error, ip }, 'Failed to cache GeoIP response');
    }

    return {
      city: extractCity(data.location),
      fullResponse: data.location,
    };
  } catch (error) {
    logger.error({ error, ip }, 'Failed to fetch GeoIP from DaData');
    return { city: null, fullResponse: null };
  }
}

function extractCity(location: DaDataLocation): string | null {
  // Priority: city > settlement > region
  return (
    location.data.city ??
    location.data.settlement ??
    location.data.region ??
    null
  );
}

function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^127\./, // localhost
    /^10\./, // Class A private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
    /^192\.168\./, // Class C private
    /^::1$/, // IPv6 localhost
    /^fe80:/i, // IPv6 link-local
    /^fc00:/i, // IPv6 unique local
    /^fd00:/i, // IPv6 unique local
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * CORS utilities for origin validation
 *
 * Extracts base domain from SUPPORT_DOMAIN and validates origins
 * against the base domain and its subdomains.
 */

import { env } from '../config/env.js';

/**
 * Extract base domain (last 2 parts) from a hostname
 *
 * @example
 * getBaseDomain('chat.dellshop.ru') → 'dellshop.ru'
 * getBaseDomain('api.staging.example.com') → 'example.com'
 * getBaseDomain('localhost') → 'localhost'
 */
export function getBaseDomain(hostname: string): string {
  // Remove port if present
  const host = hostname.split(':')[0] ?? hostname;

  const parts = host.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return host;
}

/**
 * Check if an origin is allowed based on the base domain
 *
 * Allowed:
 * - Exact match: https://dellshop.ru
 * - Subdomain match: https://*.dellshop.ru
 * - In development: http://localhost:*
 *
 * @param origin - The Origin header value
 * @param baseDomain - The base domain to check against
 * @returns true if origin is allowed
 */
export function isOriginAllowed(origin: string | undefined, baseDomain: string): boolean {
  if (!origin || !baseDomain) {
    return false;
  }

  try {
    const url = new URL(origin);
    const host = url.hostname;

    // Exact match: dellshop.ru
    if (host === baseDomain) {
      return true;
    }

    // Subdomain match: *.dellshop.ru
    if (host.endsWith('.' + baseDomain)) {
      return true;
    }

    // Development mode: allow localhost
    if (env.NODE_ENV === 'development' && host === 'localhost') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get the base domain from SUPPORT_DOMAIN environment variable
 *
 * @returns Base domain or empty string if not configured
 */
export function getConfiguredBaseDomain(): string {
  if (!env.SUPPORT_DOMAIN) {
    return '';
  }
  return getBaseDomain(env.SUPPORT_DOMAIN);
}

/**
 * Validate origin against configured SUPPORT_DOMAIN
 *
 * @param origin - The Origin header value
 * @returns true if origin is allowed
 */
export function isOriginAllowedByConfig(origin: string | undefined): boolean {
  const baseDomain = getConfiguredBaseDomain();
  if (!baseDomain) {
    return false;
  }
  return isOriginAllowed(origin, baseDomain);
}

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
 * Normalize an ALLOWED_ORIGINS entry to a bare hostname
 *
 * @example
 * normalizeDomain(' https://example.com/ ') → 'example.com'
 * normalizeDomain('dellshop.ru') → 'dellshop.ru'
 */
function normalizeDomain(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return '';
  }

  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, '');
  const host = withoutScheme.split('/')[0] ?? '';
  return host.split(':')[0] ?? '';
}

/**
 * All domains the widget may be embedded on:
 * base domain of SUPPORT_DOMAIN plus everything listed in ALLOWED_ORIGINS
 */
export function getAllowedDomains(): string[] {
  const domains: string[] = [];

  const baseDomain = getConfiguredBaseDomain();
  if (baseDomain) {
    domains.push(baseDomain);
  }

  for (const entry of env.ALLOWED_ORIGINS?.split(',') ?? []) {
    const domain = normalizeDomain(entry);
    if (domain) {
      domains.push(domain);
    }
  }

  return domains;
}

/**
 * Whether origin checking is configured at all.
 * With no domains configured every origin would be rejected,
 * so callers skip the check instead of blocking everyone.
 */
export function isOriginCheckEnabled(): boolean {
  return getAllowedDomains().length > 0;
}

/**
 * Validate origin against SUPPORT_DOMAIN and ALLOWED_ORIGINS
 *
 * @param origin - The Origin header value
 * @returns true if origin is allowed
 */
export function isOriginAllowedByConfig(origin: string | undefined): boolean {
  return getAllowedDomains().some((domain) => isOriginAllowed(origin, domain));
}

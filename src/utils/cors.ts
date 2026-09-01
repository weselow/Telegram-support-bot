/**
 * CORS utilities for origin validation
 *
 * Extracts base domain from SUPPORT_DOMAIN and validates origins
 * against the base domain and its subdomains.
 */

import { domainToASCII } from 'url';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** Entries like 192.168.1.10 have no parent domain to talk about */
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * ALLOWED_ORIGINS entry that turns the domain check off: the widget is then
 * accepted on any site. Kept as a setting rather than removed from the code,
 * so the door is opened and closed without a new release.
 */
const ALLOW_ANY_ORIGIN = '*';

/** ALLOWED_ORIGINS as written: a comma separated list, entries not trimmed yet */
function getOriginEntries(): string[] {
  return env.ALLOWED_ORIGINS?.split(',') ?? [];
}

/** Whether ALLOWED_ORIGINS opens the widget to every site */
export function isAnyOriginAllowed(): boolean {
  return getOriginEntries().some((entry) => entry.trim() === ALLOW_ANY_ORIGIN);
}

/**
 * Whether the value is an origin a browser could have sent.
 *
 * Even with the domain check off the origin has to be an http(s) address:
 * it is echoed back in Access-Control-Allow-Origin, and addresses like
 * file:// or chrome-extension:// are not sites the widget is embedded on.
 */
function isHttpOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return false;
  }

  try {
    const { protocol } = new URL(origin);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Host in the form a browser sends it: ascii and lower case
 *
 * A browser never sends a domain in cyrillic — сервер-для-1с.рф arrives in the
 * Origin header as xn----1-eddldb4czbcgk3p.xn--p1ai. Settings are compared with
 * that header as plain strings, so a domain written in cyrillic would never
 * match anything. Both ways of writing it are brought to the same form here.
 *
 * Anything that is not a domain at all (an IP address, a broken entry) is kept
 * as written: it either matches a host as is or does not match at all.
 */
function toAsciiHost(host: string): string {
  return domainToASCII(host) || host.toLowerCase();
}

/**
 * Extract base domain (last 2 parts) from a hostname
 *
 * @example
 * getBaseDomain('chat.clientsite.test') → 'clientsite.test'
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
 * - Exact match: https://clientsite.test
 * - Subdomain match: https://*.clientsite.test
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

    // Exact match: clientsite.test
    if (host === baseDomain) {
      return true;
    }

    // Subdomain match: *.clientsite.test
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
  return toAsciiHost(getBaseDomain(env.SUPPORT_DOMAIN));
}

/**
 * Normalize an ALLOWED_ORIGINS entry to a bare hostname
 *
 * @example
 * normalizeDomain(' https://example.com/ ') → 'example.com'
 * normalizeDomain('clientsite.test') → 'clientsite.test'
 * normalizeDomain('сервер-для-1с.рф') → 'xn----1-eddldb4czbcgk3p.xn--p1ai'
 */
function normalizeDomain(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return '';
  }

  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, '');
  const host = withoutScheme.split('/')[0] ?? '';
  return toAsciiHost(host.split(':')[0] ?? '');
}

/**
 * All domains the widget may be embedded on:
 * base domain of SUPPORT_DOMAIN plus everything listed in ALLOWED_ORIGINS
 *
 * The two settings deliberately differ. SUPPORT_DOMAIN is reduced to its base
 * domain, so chat.clientsite.test also allows clientsite.test and its other subdomains.
 * ALLOWED_ORIGINS entries are taken as written: an entry allows itself and its
 * own subdomains, never its parent domain. So 'shop.clientsite.test' allows
 * shop.clientsite.test and api.shop.clientsite.test, but not clientsite.test — list the
 * parent domain explicitly if that is what you want.
 *
 * The * entry is not a domain and is left out of the list: it is handled in
 * isOriginAllowedByConfig, which then accepts every site.
 */
export function getAllowedDomains(): string[] {
  const domains: string[] = [];

  const baseDomain = getConfiguredBaseDomain();
  if (baseDomain) {
    domains.push(baseDomain);
  }

  for (const entry of getOriginEntries()) {
    if (entry.trim() === ALLOW_ANY_ORIGIN) {
      continue;
    }

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
  return isAnyOriginAllowed() || getAllowedDomains().length > 0;
}

/**
 * Validate origin against SUPPORT_DOMAIN and ALLOWED_ORIGINS
 *
 * With ALLOWED_ORIGINS set to * any site is accepted, but a request still has
 * to carry an http(s) Origin header — a request without one is nobody's site.
 *
 * @param origin - The Origin header value
 * @returns true if origin is allowed
 */
export function isOriginAllowedByConfig(origin: string | undefined): boolean {
  if (isAnyOriginAllowed()) {
    return isHttpOrigin(origin);
  }

  return getAllowedDomains().some((domain) => isOriginAllowed(origin, domain));
}

/**
 * Domain one level up from the given one, or null if there is none
 *
 * @example
 * getParentDomain('shop.clientsite.test') → 'clientsite.test'
 * getParentDomain('clientsite.test') → null
 * getParentDomain('192.168.1.10') → null
 */
function getParentDomain(domain: string): string | null {
  if (IPV4_PATTERN.test(domain)) {
    return null;
  }

  const parts = domain.split('.');
  if (parts.length <= 2) {
    return null;
  }
  return parts.slice(1).join('.');
}

/**
 * Warn about ALLOWED_ORIGINS entries that likely do not do what the operator expected
 *
 * SUPPORT_DOMAIN is reduced to its base domain, ALLOWED_ORIGINS entries are not
 * (see getAllowedDomains). Two settings that look alike but behave differently are
 * easy to mix up, so both suspicious shapes are reported once at startup:
 *
 * 1. the entry repeats the base domain of SUPPORT_DOMAIN — it grants nothing new
 * 2. the entry is a subdomain and its parent domain is not allowed by anything else
 *
 * A * entry replaces both checks with a single warning: with the door open to
 * every site, hints about individual domains say nothing.
 *
 * Warnings only: nothing is blocked and origin resolution stays unchanged.
 */
export function warnAboutOriginConfig(): void {
  if (isAnyOriginAllowed()) {
    logger.warn(
      {
        allowedOrigins: env.ALLOWED_ORIGINS,
        hint: 'Every site may embed the widget and open tickets in the support group. Replace the * entry in ALLOWED_ORIGINS with the domains of your own sites to close this.',
      },
      'ALLOWED_ORIGINS contains *: requests are accepted from any site',
    );
    return;
  }

  const supportBaseDomain = getConfiguredBaseDomain();

  for (const entry of getOriginEntries()) {
    const domain = normalizeDomain(entry);
    if (!domain) {
      continue;
    }

    if (domain === supportBaseDomain) {
      logger.warn(
        {
          entry: domain,
          supportDomain: env.SUPPORT_DOMAIN,
          supportBaseDomain,
          hint: 'SUPPORT_DOMAIN is already reduced to this base domain and allows all of its subdomains, so the entry grants nothing. Remove it, or replace it with the domain you actually need — ALLOWED_ORIGINS entries are used as written and are never reduced.',
        },
        'ALLOWED_ORIGINS entry repeats the base domain of SUPPORT_DOMAIN',
      );
      continue;
    }

    const parentDomain = getParentDomain(domain);
    if (parentDomain && !isOriginAllowedByConfig(`https://${parentDomain}`)) {
      logger.warn(
        {
          entry: domain,
          parentDomain,
          hint: 'Unlike SUPPORT_DOMAIN, ALLOWED_ORIGINS entries are used as written: this entry allows only itself and its own subdomains. Add the parent domain to ALLOWED_ORIGINS as a separate entry if the widget is embedded there as well.',
        },
        'ALLOWED_ORIGINS entry does not allow its parent domain',
      );
    }
  }
}

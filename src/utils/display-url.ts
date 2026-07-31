/**
 * Turning a page address into something a support agent can read.
 *
 * A browser always reports the address in its ascii form: the domain
 * сервер-для-1с.рф arrives as xn----1-eddldb4czbcgk3p.xn--p1ai and a cyrillic
 * path arrives as a row of percent codes. Both are unreadable in a ticket card,
 * so they are turned back for display only — nothing else uses the result.
 */

import { domainToUnicode } from 'url';

/** Whitespace inside an address breaks the automatic link in Telegram */
const BREAKS_LINK = /\s/;

/**
 * Readable form of a page address
 *
 * @param url - Address as the browser reported it
 * @returns Readable address, or the input unchanged when it cannot be parsed
 */
export function toDisplayUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // Credentials are dropped on purpose: they are of no use in a ticket card
  const host = domainToUnicode(parsed.hostname) || parsed.hostname;
  const port = parsed.port ? `:${parsed.port}` : '';
  const address = `${parsed.protocol}//${host}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;

  return decodeIfReadable(address);
}

/**
 * Address without percent codes, as long as decoding keeps it usable as a link
 */
function decodeIfReadable(address: string): string {
  try {
    const decoded = decodeURI(address);
    return BREAKS_LINK.test(decoded) ? address : decoded;
  } catch {
    // A broken percent sequence — leave the address as it is
    return address;
  }
}

/**
 * Resolving the page a web chat visitor came from.
 *
 * The Referer header is not enough: for a request to another origin the browser
 * cuts it down to the origin (default policy strict-origin-when-cross-origin),
 * so the support group would only ever see https://shop.example.com/ instead of
 * the page the visitor actually wrote from. The widget therefore sends
 * window.location.href in the body, and the Referer stays as a fallback.
 *
 * The body is client input, so the url is only trusted when it belongs to the
 * origin of the request itself — otherwise anyone could put any address into a
 * ticket card. Without an Origin header (same-origin request) there is nothing
 * to compare against, but then the Referer is not truncated either.
 *
 * The link to Telegram (/ask-support) has the same problem and one difference:
 * a plain link click is a top level navigation and carries no Origin header at
 * all, so resolveClickedPageUrl compares against the Referer instead.
 */

const PAGE_URL_MAX_LENGTH = 1000;
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Page url to store for a session
 *
 * @param pageUrl - Page url sent by the widget in the request body
 * @param origin - The Origin header value
 * @param referer - The Referer header value
 * @returns Page url to store, or undefined when the page is unknown
 */
export function resolvePageUrl(
  pageUrl: string | undefined,
  origin: string | undefined,
  referer: string | undefined
): string | undefined {
  if (isOwnPageUrl(pageUrl, origin)) {
    return pageUrl;
  }

  return referer;
}

/**
 * Page url for a plain link click
 *
 * A top level navigation sends no Origin header, so the only thing telling
 * where the visitor came from is the Referer — cut down by the browser to
 * exactly that origin whenever the link points at another site. Useless as an
 * address, perfect as an anchor: the query parameter is believed only when it
 * belongs to the same origin.
 *
 * That check is what stops the parameter from becoming a way to show a support
 * agent any address at all. Checking against ALLOWED_ORIGINS instead would give
 * nothing — the setting is allowed to hold `*`, and then it accepts everything.
 *
 * No Referer at all (rel="noreferrer", a strict referrer policy, a privacy
 * extension) leaves nothing to compare against, and the address is dropped
 * rather than believed.
 *
 * @param pageUrl - Page url from the query string of the link
 * @param referer - The Referer header value
 * @returns Page url to store, or undefined when the page is unknown
 */
export function resolveClickedPageUrl(
  pageUrl: string | undefined,
  referer: string | undefined
): string | undefined {
  if (isOwnPageUrl(pageUrl, getOrigin(referer))) {
    return pageUrl;
  }

  return referer;
}

/** Origin of an address, or undefined when it is not an address at all */
function getOrigin(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function isOwnPageUrl(pageUrl: string | undefined, origin: string | undefined): boolean {
  if (typeof pageUrl !== 'string' || !origin) {
    return false;
  }

  if (pageUrl.length > PAGE_URL_MAX_LENGTH) {
    return false;
  }

  try {
    const url = new URL(pageUrl);
    return ALLOWED_PROTOCOLS.includes(url.protocol) && url.origin === origin;
  } catch {
    return false;
  }
}

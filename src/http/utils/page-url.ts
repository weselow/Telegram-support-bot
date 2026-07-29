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

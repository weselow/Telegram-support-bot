/**
 * Session utilities for web chat
 *
 * Shared logic for parsing session ID from cookies.
 * Used by both HTTP routes and WebSocket handler.
 */

export const SESSION_COOKIE_NAME = 'webchat_session';
export const SESSION_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate session ID as UUID v4
 *
 * @param sessionId - Session ID to validate
 * @returns true if valid UUID v4 format
 */
export function isValidSessionId(sessionId: string | undefined | null): sessionId is string {
  return !!sessionId && UUID_REGEX.test(sessionId);
}

/**
 * Parse session ID from cookie header
 *
 * @param cookieHeader - The Cookie header value
 * @returns Session ID if valid UUID v4, null otherwise
 */
export function parseSessionIdFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const regex = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`);
  const match = regex.exec(cookieHeader);
  const sessionId = match?.[1] ?? null;

  if (!isValidSessionId(sessionId)) {
    return null;
  }

  return sessionId;
}

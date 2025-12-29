import { describe, it, expect } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  UUID_REGEX,
  isValidSessionId,
  parseSessionIdFromCookie,
} from '../session.js';

describe('Session utilities', () => {
  describe('Constants', () => {
    it('should have correct cookie name', () => {
      expect(SESSION_COOKIE_NAME).toBe('webchat_session');
    });

    it('should have correct cookie max age (1 year)', () => {
      expect(SESSION_COOKIE_MAX_AGE).toBe(365 * 24 * 60 * 60);
    });

    it('should have correct UUID regex', () => {
      expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(UUID_REGEX.test('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
    });
  });

  describe('isValidSessionId', () => {
    it('should return true for valid UUID v4', () => {
      expect(isValidSessionId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should return true for uppercase UUID', () => {
      expect(isValidSessionId('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should return false for undefined', () => {
      expect(isValidSessionId(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidSessionId(null)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidSessionId('')).toBe(false);
    });

    it('should return false for invalid format', () => {
      expect(isValidSessionId('not-a-uuid')).toBe(false);
      expect(isValidSessionId('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidSessionId('550e8400e29b41d4a716446655440000')).toBe(false);
    });

    it('should return false for UUID v1 (wrong version)', () => {
      // UUID v1 has version 1 in position 14
      expect(isValidSessionId('550e8400-e29b-11d4-a716-446655440000')).toBe(false);
    });

    it('should return false for UUID with wrong variant', () => {
      // Valid UUID v4 has variant bits 10xx (8, 9, a, b)
      expect(isValidSessionId('550e8400-e29b-41d4-0716-446655440000')).toBe(false);
    });
  });

  describe('parseSessionIdFromCookie', () => {
    it('should return null for undefined cookie', () => {
      expect(parseSessionIdFromCookie(undefined)).toBeNull();
    });

    it('should return null for empty cookie', () => {
      expect(parseSessionIdFromCookie('')).toBeNull();
    });

    it('should extract session ID from simple cookie', () => {
      const cookie = 'webchat_session=550e8400-e29b-41d4-a716-446655440000';
      expect(parseSessionIdFromCookie(cookie)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should extract session ID from cookie with multiple values', () => {
      const cookie =
        'other=value; webchat_session=550e8400-e29b-41d4-a716-446655440000; another=test';
      expect(parseSessionIdFromCookie(cookie)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return null when session cookie not present', () => {
      const cookie = 'other=value; another=test';
      expect(parseSessionIdFromCookie(cookie)).toBeNull();
    });

    it('should return null for invalid UUID in cookie', () => {
      const cookie = 'webchat_session=not-a-valid-uuid';
      expect(parseSessionIdFromCookie(cookie)).toBeNull();
    });

    it('should return null for empty session value', () => {
      const cookie = 'webchat_session=';
      expect(parseSessionIdFromCookie(cookie)).toBeNull();
    });

    it('should handle uppercase UUID in cookie', () => {
      const cookie = 'webchat_session=550E8400-E29B-41D4-A716-446655440000';
      expect(parseSessionIdFromCookie(cookie)).toBe('550E8400-E29B-41D4-A716-446655440000');
    });
  });
});

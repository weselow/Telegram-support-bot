import { describe, it, expect } from 'vitest';
import { formatDateTime, formatDateShort, getTimezoneLabel } from '../datetime.js';

describe('datetime', () => {
  describe('formatDateTime', () => {
    it('should format UTC date in display timezone with zone label', () => {
      const date = new Date('2026-07-30T12:39:41Z');

      expect(formatDateTime(date)).toBe('30.07.2026, 16:39:41 (UTC+4)');
    });

    it('should shift date to the next day when offset crosses midnight', () => {
      const date = new Date('2026-07-30T21:30:00Z');

      expect(formatDateTime(date)).toBe('31.07.2026, 01:30:00 (UTC+4)');
    });
  });

  describe('formatDateShort', () => {
    it('should format day, month and time without zone label', () => {
      const date = new Date('2026-07-30T12:39:41Z');

      expect(formatDateShort(date)).toBe('30.07, 16:39');
    });

    it('should shift date to the next day when offset crosses midnight', () => {
      const date = new Date('2026-12-31T21:30:00Z');

      expect(formatDateShort(date)).toBe('01.01, 01:30');
    });
  });

  describe('getTimezoneLabel', () => {
    it('should return offset label for the display timezone', () => {
      expect(getTimezoneLabel()).toBe('UTC+4');
    });

    it('should return offset label without minutes when they are zero', () => {
      expect(getTimezoneLabel(new Date('2026-01-15T00:00:00Z'), 'Europe/Moscow')).toBe('UTC+3');
    });

    it('should keep minutes when the offset is not a whole hour', () => {
      expect(getTimezoneLabel(new Date('2026-01-15T00:00:00Z'), 'Asia/Kolkata')).toBe('UTC+5:30');
    });

    it('should return negative offset label', () => {
      expect(getTimezoneLabel(new Date('2026-01-15T00:00:00Z'), 'America/New_York')).toBe('UTC-5');
    });

    it('should return plain UTC for zero offset', () => {
      expect(getTimezoneLabel(new Date('2026-01-15T00:00:00Z'), 'UTC')).toBe('UTC');
    });
  });
});

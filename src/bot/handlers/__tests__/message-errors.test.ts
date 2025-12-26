import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GrammyError } from 'grammy';

// Test helper functions for error type checking
function isRateLimitError(error: unknown): boolean {
  return error instanceof GrammyError && error.error_code === 429;
}

function isForbiddenError(error: unknown): boolean {
  return error instanceof GrammyError && error.error_code === 403;
}

function createGrammyError(errorCode: number, description: string): GrammyError {
  return new GrammyError(description, {
    ok: false,
    error_code: errorCode,
    description,
  });
}

describe('Message error handling', () => {
  describe('isRateLimitError', () => {
    it('should return true for 429 error', () => {
      const error = createGrammyError(429, 'Too Many Requests');
      expect(isRateLimitError(error)).toBe(true);
    });

    it('should return false for other GrammyError codes', () => {
      const error = createGrammyError(400, 'Bad Request');
      expect(isRateLimitError(error)).toBe(false);
    });

    it('should return false for non-GrammyError', () => {
      const error = new Error('Regular error');
      expect(isRateLimitError(error)).toBe(false);
    });
  });

  describe('isForbiddenError', () => {
    it('should return true for 403 error', () => {
      const error = createGrammyError(403, 'Forbidden');
      expect(isForbiddenError(error)).toBe(true);
    });

    it('should return false for other GrammyError codes', () => {
      const error = createGrammyError(400, 'Bad Request');
      expect(isForbiddenError(error)).toBe(false);
    });

    it('should return false for non-GrammyError', () => {
      const error = new Error('Regular error');
      expect(isForbiddenError(error)).toBe(false);
    });
  });

  describe('GrammyError creation', () => {
    it('should have correct error_code property', () => {
      const error = createGrammyError(429, 'Too Many Requests');
      expect(error.error_code).toBe(429);
    });

    it('should be instance of GrammyError', () => {
      const error = createGrammyError(403, 'Forbidden');
      expect(error).toBeInstanceOf(GrammyError);
    });

    it('should be instance of Error', () => {
      const error = createGrammyError(500, 'Internal Server Error');
      expect(error).toBeInstanceOf(Error);
    });
  });
});

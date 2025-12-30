import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Mock dependencies
vi.mock('../../../config/env.js', () => ({
  env: {
    SUPPORT_DOMAIN: 'chat.dellshop.ru',
    NODE_ENV: 'production',
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../config/sentry.js', () => ({
  captureMessage: vi.fn(),
}));

import { widgetErrorsRoutes } from '../widget-errors.js';
import { captureMessage } from '../../../config/sentry.js';

const mockCaptureMessage = vi.mocked(captureMessage);

describe('Widget Errors Route', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    mockCaptureMessage.mockClear();
    fastify = Fastify();
    widgetErrorsRoutes(fastify);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('OPTIONS /api/widget/errors', () => {
    it('should allow preflight from valid origin', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://dellshop.ru');
      expect(response.headers['access-control-allow-methods']).toBe('POST, OPTIONS');
    });

    it('should reject preflight from invalid origin', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://evil.com',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: { code: 'CORS_ERROR', message: 'Origin not allowed' },
      });
    });
  });

  describe('POST /api/widget/errors', () => {
    it('should accept valid error batch', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            {
              level: 'error',
              message: 'Test error',
              context: {
                userAgent: 'TestBrowser/1.0',
                url: 'https://dellshop.ru/shop',
                timestamp: '2025-12-30T12:00:00Z',
              },
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: { processed: 1 },
      });

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Test error',
        'error',
        expect.objectContaining({
          userAgent: 'TestBrowser/1.0',
          pageUrl: 'https://dellshop.ru/shop',
        }),
        { source: 'widget' }
      );
    });

    it('should accept warning level', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            {
              level: 'warn',
              message: 'Test warning',
              context: {
                userAgent: 'TestBrowser/1.0',
                url: 'https://dellshop.ru/shop',
                timestamp: '2025-12-30T12:00:00Z',
              },
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Test warning',
        'warning',
        expect.any(Object),
        { source: 'widget' }
      );
    });

    it('should include sessionId in context', async () => {
      await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            {
              level: 'error',
              message: 'Test error',
              context: {
                sessionId: 'test-session-123',
                userAgent: 'TestBrowser/1.0',
                url: 'https://dellshop.ru/shop',
                timestamp: '2025-12-30T12:00:00Z',
              },
            },
          ],
        },
      });

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          sessionId: 'test-session-123',
        }),
        expect.any(Object)
      );
    });

    it('should include stack trace in context', async () => {
      await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            {
              level: 'error',
              message: 'Test error',
              context: {
                userAgent: 'TestBrowser/1.0',
                url: 'https://dellshop.ru/shop',
                timestamp: '2025-12-30T12:00:00Z',
              },
              stack: 'Error: Test error\n    at test.js:1:1',
            },
          ],
        },
      });

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          stack: 'Error: Test error\n    at test.js:1:1',
        }),
        expect.any(Object)
      );
    });

    it('should process multiple errors in batch', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            {
              level: 'error',
              message: 'Error 1',
              context: { userAgent: 'Test', url: 'https://x.ru', timestamp: '2025-12-30T12:00:00Z' },
            },
            {
              level: 'warn',
              message: 'Warning 2',
              context: { userAgent: 'Test', url: 'https://x.ru', timestamp: '2025-12-30T12:00:00Z' },
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: { processed: 2 },
      });
      expect(mockCaptureMessage).toHaveBeenCalledTimes(2);
    });

    it('should reject request without errors array', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          message: 'invalid format',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: { code: 'INVALID_BODY', message: 'errors array is required' },
      });
    });

    it('should skip invalid errors in batch', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            { level: 'invalid', message: 'Bad level' }, // Invalid level
            {
              level: 'error',
              message: 'Valid error',
              context: { userAgent: 'Test', url: 'https://x.ru', timestamp: '2025-12-30T12:00:00Z' },
            },
            { message: 'No context' }, // Missing context
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: { processed: 1 },
      });
    });

    it('should limit batch size to 10', async () => {
      const errors = Array.from({ length: 15 }, (_, i) => ({
        level: 'error' as const,
        message: `Error ${i}`,
        context: { userAgent: 'Test', url: 'https://x.ru', timestamp: '2025-12-30T12:00:00Z' },
      }));

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: { errors },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data: { processed: 10 },
      });
    });

    it('should truncate long messages', async () => {
      const longMessage = 'A'.repeat(2000);

      await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            {
              level: 'error',
              message: longMessage,
              context: { userAgent: 'Test', url: 'https://x.ru', timestamp: '2025-12-30T12:00:00Z' },
            },
          ],
        },
      });

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        expect.stringMatching(/^A{1000}$/),
        expect.any(String),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should reject request from invalid origin', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/widget/errors',
        headers: {
          origin: 'https://malicious.com',
          'content-type': 'application/json',
        },
        payload: {
          errors: [
            {
              level: 'error',
              message: 'Test error',
              context: { userAgent: 'Test', url: 'https://x.ru', timestamp: '2025-12-30T12:00:00Z' },
            },
          ],
        },
      });

      expect(response.statusCode).toBe(403);
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });
  });
});

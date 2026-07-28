import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

import { securityHeadersHook } from '../security-headers.js';

describe('security-headers', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    fastify.addHook('onRequest', securityHeadersHook);
    fastify.get('/test', () => ({ ok: true }));
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('securityHeadersHook', () => {
    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/test' });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options to DENY', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/test' });

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should set Referrer-Policy to strict-origin-when-cross-origin', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/test' });

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should set headers on not found responses', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/unknown' });

      expect(response.statusCode).toBe(404);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should not block the request', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/test' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });
  });
});

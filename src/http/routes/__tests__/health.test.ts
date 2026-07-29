import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../../../config/env.js', () => ({
  env: {
    APP_COMMIT: '9f1c2b3d4e5f60718293a4b5c6d7e8f901234567',
  },
}));

import { healthRoute } from '../health.js';

describe('health', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    healthRoute(fastify);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /health', () => {
    it('should answer 200 with ok status', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({ status: 'ok' });
    });

    it('should return the build commit hash', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/health' });

      const body = JSON.parse(response.body) as { commit: string };
      expect(body.commit).toBe('9f1c2b3d4e5f60718293a4b5c6d7e8f901234567');
    });

    it('should return an ISO timestamp', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/health' });

      const body = JSON.parse(response.body) as { timestamp: string };
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });
  });
});

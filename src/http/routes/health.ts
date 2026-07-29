import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';

export function healthRoute(fastify: FastifyInstance): void {
  fastify.get('/health', () => {
    return { status: 'ok', timestamp: new Date().toISOString(), commit: env.APP_COMMIT };
  });
}

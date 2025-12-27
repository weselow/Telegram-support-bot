import type { FastifyInstance } from 'fastify';

export function healthRoute(fastify: FastifyInstance): void {
  fastify.get('/health', () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}

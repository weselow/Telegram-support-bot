import Fastify, { type FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { healthRoute } from './routes/health.js';
import { askSupportRoute } from './routes/ask-support.js';
import { chatRoutes } from './routes/chat.js';

let server: FastifyInstance | null = null;

export async function startHttpServer(): Promise<FastifyInstance> {
  server = Fastify({
    logger: false, // We use our own logger
    trustProxy: true, // Trust X-Forwarded-For from Caddy/nginx
  });

  // Register routes
  await server.register(healthRoute);
  await server.register(askSupportRoute);
  await server.register(chatRoutes);

  const port = parseInt(env.HTTP_PORT, 10);

  await server.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'HTTP server started');

  return server;
}

export async function stopHttpServer(): Promise<void> {
  if (server) {
    await server.close();
    server = null;
    logger.info('HTTP server stopped');
  }
}

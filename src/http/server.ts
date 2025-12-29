import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { healthRoute } from './routes/health.js';
import { askSupportRoute } from './routes/ask-support.js';
import { chatRoutes } from './routes/chat.js';
import { mediaRoutes } from './routes/media.routes.js';
import { registerWebSocket } from './ws/websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let server: FastifyInstance | null = null;

export async function startHttpServer(): Promise<FastifyInstance> {
  server = Fastify({
    logger: false, // We use our own logger
    trustProxy: true, // Trust X-Forwarded-For from Caddy/nginx
  });

  // Serve chat widget static files
  await server.register(fastifyStatic, {
    root: join(__dirname, '../../public/chat-widget'),
    prefix: '/chat-widget/',
    decorateReply: false,
    cacheControl: true,
    maxAge: 86400000, // 1 day in ms
  });

  // Register routes
  await server.register(healthRoute);
  await server.register(askSupportRoute);
  await server.register(chatRoutes);
  server.register(mediaRoutes);

  // Register WebSocket
  await registerWebSocket(server);

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

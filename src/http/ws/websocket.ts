import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { userRepository } from '../../db/repositories/user.repository.js';
import { connectionManager } from './connection-manager.js';
import { handleWebSocketMessage } from './handler.js';
import { logger } from '../../utils/logger.js';
import { isOriginAllowedByConfig, getConfiguredBaseDomain } from '../../utils/cors.js';
import { parseSessionIdFromCookie, isValidSessionId } from '../utils/session.js';

const PING_INTERVAL = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000; // 1 minute

export async function registerWebSocket(fastify: FastifyInstance): Promise<void> {
  await fastify.register(websocket, {
    options: {
      maxPayload: 65536, // 64KB max message size
    },
  });

  // Start ping/cleanup intervals
  const pingInterval = setInterval(() => {
    const timestamp = Date.now();
    for (const conn of connectionManager.getAll()) {
      connectionManager.send(conn.sessionId, 'ping', { timestamp });
    }
  }, PING_INTERVAL);

  const cleanupInterval = setInterval(() => {
    connectionManager.cleanup(5 * 60 * 1000); // 5 minutes inactive
  }, CLEANUP_INTERVAL);

  fastify.addHook('onClose', () => {
    clearInterval(pingInterval);
    clearInterval(cleanupInterval);
  });

  fastify.get('/ws/chat', { websocket: true }, async (socket, request) => {
    // Origin validation (TD-034)
    const baseDomain = getConfiguredBaseDomain();
    if (baseDomain) {
      const origin = request.headers.origin;
      if (!isOriginAllowedByConfig(origin)) {
        logger.warn({ origin }, 'WebSocket connection rejected: origin not allowed');
        socket.close(4003, 'Origin not allowed');
        return;
      }
    }

    // Get session ID from cookie or query parameter
    const cookieSessionId = parseSessionIdFromCookie(request.headers.cookie);
    const querySessionId = (request.query as { session?: string }).session;
    const sessionId = cookieSessionId ?? (isValidSessionId(querySessionId) ? querySessionId : null);

    if (!sessionId) {
      socket.close(4001, 'Session not found');
      return;
    }

    // Validate session
    const user = await userRepository.findByWebSessionId(sessionId);
    if (!user) {
      socket.close(4001, 'Session not found');
      return;
    }

    // Register connection
    connectionManager.add(sessionId, user.id, socket);

    // Send connected event
    connectionManager.send(sessionId, 'connected', {
      sessionId,
      ticketStatus: user.status,
      unreadCount: 0,
    });

    logger.info({ sessionId, userId: user.id }, 'WebSocket client connected');

    // Handle messages
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      void (async () => {
        try {
          const message = Buffer.isBuffer(data)
            ? data.toString('utf8')
            : Array.isArray(data)
              ? Buffer.concat(data).toString('utf8')
              : Buffer.from(data).toString('utf8');
          await handleWebSocketMessage(socket, message, { sessionId, userId: user.id });
        } catch (error) {
          logger.error({ error, sessionId }, 'Error handling WebSocket message');
        }
      })();
    });

    // Handle close
    socket.on('close', (code: number, reason: Buffer) => {
      connectionManager.remove(sessionId);
      logger.info({ sessionId, code, reason: reason.toString() }, 'WebSocket client disconnected');
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      logger.error({ error, sessionId }, 'WebSocket error');
      connectionManager.remove(sessionId);
    });
  });
}


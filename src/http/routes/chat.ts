import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { webChatService } from '../../services/web-chat.service.js';
import { getLocationByIp } from '../../services/geoip.service.js';
import { checkIpRateLimit } from '../../services/rate-limit.service.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

const SESSION_COOKIE_NAME = 'webchat_session';
const SESSION_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds
const MESSAGE_MAX_LENGTH = 4000;

interface InitBody {
  fingerprint?: string;
}

interface MessageBody {
  text: string;
  replyTo?: string;
}

interface CloseBody {
  resolved?: boolean | undefined;
  feedback?: string | undefined;
}

interface HistoryQuery {
  limit?: string | undefined;
  before?: string | undefined;
  after?: string | undefined;
}

function getSessionId(request: FastifyRequest): string | null {
  const cookies = request.headers.cookie;
  if (!cookies) return null;

  const regex = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`);
  const match = regex.exec(cookies);
  return match?.[1] ?? null;
}

function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  const isProduction = env.NODE_ENV === 'production';
  reply.header(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; Max-Age=${String(SESSION_COOKIE_MAX_AGE)}; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`
  );
}

function setCorsHeaders(reply: FastifyReply): void {
  const allowedOrigin = env.SUPPORT_DOMAIN
    ? `https://${env.SUPPORT_DOMAIN.replace('chat.', '')}`
    : '*';

  reply.header('Access-Control-Allow-Origin', allowedOrigin);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
}

export function chatRoutes(fastify: FastifyInstance): void {
  // CORS preflight handler
  fastify.options('/api/chat/*', async (_request, reply) => {
    setCorsHeaders(reply);
    return reply.status(204).send();
  });

  // POST /api/chat/init - Initialize session
  fastify.post('/api/chat/init', async (request: FastifyRequest<{ Body: InitBody }>, reply) => {
    setCorsHeaders(reply);

    const ip = request.ip;

    // Rate limiting
    const rateLimitResult = await checkIpRateLimit(ip);
    if (!rateLimitResult.allowed) {
      reply.header('Retry-After', rateLimitResult.resetInSeconds);
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
    }

    // Get or create session ID
    let sessionId = getSessionId(request);
    let isNewCookie = false;

    if (!sessionId) {
      sessionId = randomUUID();
      isNewCookie = true;
    }

    // Get GeoIP for source city
    const geoResult = await getLocationByIp(ip);
    const referer = request.headers.referer ?? request.headers.referrer ?? undefined;

    try {
      const result = await webChatService.initSession(
        sessionId,
        referer as string | undefined,
        geoResult.city ?? undefined
      );

      if (isNewCookie) {
        setSessionCookie(reply, sessionId);
      }

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to init chat session');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to initialize session' },
      });
    }
  });

  // GET /api/chat/history - Get message history
  fastify.get('/api/chat/history', async (request: FastifyRequest<{ Querystring: HistoryQuery }>, reply) => {
    setCorsHeaders(reply);

    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'No session cookie' },
      });
    }

    const { limit, before, after } = request.query;

    try {
      const result = await webChatService.getHistory(sessionId, {
        limit: limit ? parseInt(limit, 10) : undefined,
        before,
        after,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message === 'Session not found') {
        return reply.status(401).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        });
      }
      logger.error({ error, sessionId }, 'Failed to get chat history');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get history' },
      });
    }
  });

  // GET /api/chat/status - Get ticket status
  fastify.get('/api/chat/status', async (request: FastifyRequest, reply) => {
    setCorsHeaders(reply);

    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'No session cookie' },
      });
    }

    try {
      const result = await webChatService.getStatus(sessionId);
      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message === 'Session not found') {
        return reply.status(401).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        });
      }
      logger.error({ error, sessionId }, 'Failed to get chat status');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get status' },
      });
    }
  });

  // POST /api/chat/message - Send a message (fallback for no WebSocket)
  fastify.post('/api/chat/message', async (request: FastifyRequest<{ Body: MessageBody }>, reply) => {
    setCorsHeaders(reply);

    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'No session cookie' },
      });
    }

    const { text } = request.body;

    if (!text || typeof text !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_MESSAGE', message: 'Message text is required' },
      });
    }

    if (text.length > MESSAGE_MAX_LENGTH) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MESSAGE_TOO_LONG', message: `Message exceeds ${String(MESSAGE_MAX_LENGTH)} characters` },
      });
    }

    // Rate limiting
    const rateLimitResult = await checkIpRateLimit(request.ip);
    if (!rateLimitResult.allowed) {
      reply.header('Retry-After', rateLimitResult.resetInSeconds);
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
    }

    try {
      const message = await webChatService.sendMessage(sessionId, text);
      return await reply.status(201).send({
        success: true,
        data: {
          messageId: message.id,
          timestamp: message.timestamp,
        },
      });
    } catch (error) {
      if ((error as Error).message === 'Session not found') {
        return reply.status(401).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        });
      }
      logger.error({ error, sessionId }, 'Failed to send chat message');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to send message' },
      });
    }
  });

  // POST /api/chat/link-telegram - Get Telegram deep link
  fastify.post('/api/chat/link-telegram', async (request: FastifyRequest, reply) => {
    setCorsHeaders(reply);

    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'No session cookie' },
      });
    }

    try {
      const result = await webChatService.linkTelegram(sessionId);
      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      if ((error as Error).message === 'Session not found') {
        return reply.status(401).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        });
      }
      logger.error({ error, sessionId }, 'Failed to generate Telegram link');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to generate link' },
      });
    }
  });

  // POST /api/chat/close - Close ticket
  fastify.post('/api/chat/close', async (request: FastifyRequest<{ Body: CloseBody }>, reply) => {
    setCorsHeaders(reply);

    const sessionId = getSessionId(request);
    if (!sessionId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'No session cookie' },
      });
    }

    const { resolved, feedback } = request.body;
    const resolvedValue = resolved ?? true;

    try {
      const result = await webChatService.closeTicket(sessionId, resolvedValue, feedback);
      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'Session not found') {
        return reply.status(401).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        });
      }
      if (message === 'Ticket already closed') {
        return reply.status(400).send({
          success: false,
          error: { code: 'TICKET_CLOSED', message: 'Ticket is already closed' },
        });
      }
      logger.error({ error, sessionId }, 'Failed to close ticket');
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to close ticket' },
      });
    }
  });
}

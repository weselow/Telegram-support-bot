import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import websocket from '@fastify/websocket';
import { userRepository } from '../../db/repositories/user.repository.js';
import { messageRepository } from '../../db/repositories/message.repository.js';
import {
  addConnection,
  cleanupInactiveConnections,
  getAllConnections,
  removeConnection,
  sendToSession,
} from './connection-manager.js';
import { handleWebSocketMessage } from './handler.js';
import { messages } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';
import { isOriginAllowedByConfig, isOriginCheckEnabled } from '../../utils/cors.js';
import { parseSessionIdFromCookie, isValidSessionId } from '../utils/session.js';

const PING_INTERVAL = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000; // 1 minute
// Сколько кадров держать до проверки сессии. Окно — два запроса к базе,
// за это время добросовестный клиент шлёт единицы кадров; ограничение
// защищает от роста памяти, если кадры польются потоком.
const PENDING_FRAMES_LIMIT = 50;

interface SessionInfo {
  sessionId: string;
  userId: string;
}

interface FrameQueue {
  /** Принять кадр: обработать сразу либо отложить до готовности сессии. */
  push: (raw: string) => void;
  /** Сессия проверена — обработать накопленное и всё последующее. */
  open: (session: SessionInfo) => void;
  /** Соединение закрыто или отклонено — накопленное выбросить. */
  clear: () => void;
}

function decodeFrame(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

/**
 * Очередь кадров сокета.
 *
 * Подписка на события сокета выполняется до запросов к базе: с точки зрения
 * клиента соединение уже открыто, а библиотека ws выбрасывает событие message
 * независимо от наличия слушателей — кадр, пришедший раньше подписки, пропал бы
 * молча. Пока сессия не проверена, кадры копятся здесь; после проверки
 * обрабатываются строго по одному, в порядке поступления.
 */
function createFrameQueue(socket: WebSocket): FrameQueue {
  const frames: string[] = [];
  let session: SessionInfo | null = null;
  let draining = false;

  async function runFrame(raw: string, ready: SessionInfo): Promise<void> {
    try {
      await handleWebSocketMessage(socket, raw, ready);
    } catch (error) {
      logger.error({ error, sessionId: ready.sessionId }, 'Error handling WebSocket message');
    }
  }

  async function drain(): Promise<void> {
    if (draining || !session) return;
    draining = true;
    const ready = session;
    try {
      let raw = frames.shift();
      while (raw !== undefined) {
        await runFrame(raw, ready);
        raw = frames.shift();
      }
    } finally {
      draining = false;
    }
  }

  return {
    push(raw: string): void {
      if (!session && frames.length >= PENDING_FRAMES_LIMIT) {
        logger.warn({ limit: PENDING_FRAMES_LIMIT }, 'WebSocket frame dropped: buffer is full');
        return;
      }
      frames.push(raw);
      void drain();
    },
    open(ready: SessionInfo): void {
      session = ready;
      void drain();
    },
    clear(): void {
      frames.length = 0;
    },
  };
}

function isOriginRejected(request: FastifyRequest): boolean {
  if (!isOriginCheckEnabled()) return false;

  const origin = request.headers.origin;
  if (isOriginAllowedByConfig(origin)) return false;

  logger.warn({ origin }, 'WebSocket connection rejected: origin not allowed');
  return true;
}

function resolveSessionId(request: FastifyRequest): string | null {
  const cookieSessionId = parseSessionIdFromCookie(request.headers.cookie);
  const querySessionId = (request.query as { session?: string }).session;
  return cookieSessionId ?? (isValidSessionId(querySessionId) ? querySessionId : null);
}

function subscribe(socket: WebSocket, queue: FrameQueue, sessionId: string): void {
  socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    queue.push(decodeFrame(data));
  });

  socket.on('close', (code: number, reason: Buffer) => {
    queue.clear();
    removeConnection(sessionId);
    logger.info({ sessionId, code, reason: reason.toString() }, 'WebSocket client disconnected');
  });

  socket.on('error', (error: Error) => {
    queue.clear();
    logger.error({ error, sessionId }, 'WebSocket error');
    removeConnection(sessionId);
  });
}

async function sendWelcomeMessage(sessionId: string, userId: string): Promise<void> {
  const welcomeMessage = await messageRepository.createWebMessage({
    userId,
    topicMessageId: undefined,
    direction: 'SUPPORT_TO_USER',
    channel: 'WEB',
    text: messages.webOnboarding.welcome,
  });

  sendToSession(sessionId, 'message', {
    id: welcomeMessage.id,
    text: messages.webOnboarding.welcome,
    from: 'support',
    channel: 'web',
    timestamp: welcomeMessage.createdAt.toISOString(),
  });

  logger.info({ sessionId, userId }, 'Web welcome message sent to new user');
}

export async function registerWebSocket(fastify: FastifyInstance): Promise<void> {
  await fastify.register(websocket, {
    options: {
      maxPayload: 65536, // 64KB max message size
    },
  });

  // Start ping/cleanup intervals
  const pingInterval = setInterval(() => {
    const timestamp = Date.now();
    for (const conn of getAllConnections()) {
      sendToSession(conn.sessionId, 'ping', { timestamp });
    }
  }, PING_INTERVAL);

  const cleanupInterval = setInterval(() => {
    cleanupInactiveConnections(5 * 60 * 1000); // 5 minutes inactive
  }, CLEANUP_INTERVAL);

  fastify.addHook('onClose', () => {
    clearInterval(pingInterval);
    clearInterval(cleanupInterval);
  });

  fastify.get('/ws/chat', { websocket: true }, async (socket, request) => {
    if (isOriginRejected(request)) {
      socket.close(4003, 'Origin not allowed');
      return;
    }

    const sessionId = resolveSessionId(request);
    if (!sessionId) {
      socket.close(4001, 'Session not found');
      return;
    }

    // Подписки — до первого обращения к базе, иначе ранние кадры теряются
    const queue = createFrameQueue(socket);
    subscribe(socket, queue, sessionId);

    const user = await userRepository.findByWebSessionId(sessionId);
    if (!user) {
      queue.clear();
      socket.close(4001, 'Session not found');
      return;
    }

    addConnection(sessionId, user.id, socket);

    const history = await messageRepository.getHistory(user.id, { limit: 1 });

    sendToSession(sessionId, 'connected', {
      sessionId,
      ticketStatus: user.status,
      unreadCount: 0,
    });

    // Приветствие — только новым пользователям, у которых ещё нет переписки
    if (history.length === 0) {
      await sendWelcomeMessage(sessionId, user.id);
    }

    logger.info({ sessionId, userId: user.id }, 'WebSocket client connected');

    queue.open({ sessionId, userId: user.id });
  });
}

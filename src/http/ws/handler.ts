import type { WebSocket } from 'ws';
import type { ClientMessage } from './types.js';
import { connectionManager } from './connection-manager.js';
import { webChatService } from '../../services/web-chat.service.js';
import { checkKeyRateLimit } from '../../services/rate-limit.service.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { bot } from '../../bot/bot.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const MESSAGE_MAX_LENGTH = 4000;
const WS_RATE_LIMIT_KEY_PREFIX = 'ws:';

interface SessionInfo {
  sessionId: string;
  userId: string;
}

function isValidClientMessage(data: unknown): data is ClientMessage {
  if (!data || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== 'string') return false;
  if (typeof msg.data !== 'object' || msg.data === null) return false;
  return true;
}

export async function handleWebSocketMessage(
  ws: WebSocket,
  rawData: string,
  session: SessionInfo
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    sendError(ws, 'INVALID_MESSAGE', 'Invalid JSON');
    return;
  }

  if (!isValidClientMessage(parsed)) {
    sendError(ws, 'INVALID_MESSAGE', 'Invalid message format');
    return;
  }

  const { type, data } = parsed;
  connectionManager.updateActivity(session.sessionId);

  switch (type) {
    case 'message':
      await handleMessage(ws, data as { text: string; replyTo?: string }, session);
      break;

    case 'typing':
      await handleTyping(data as { isTyping: boolean }, session);
      break;

    case 'close':
      await handleClose(ws, data as { resolved: boolean; feedback?: string }, session);
      break;

    case 'pong':
      // Just update activity, already done above
      break;

    default:
      sendError(ws, 'INVALID_MESSAGE', `Unknown message type: ${String(type)}`);
  }
}

async function handleMessage(
  ws: WebSocket,
  data: { text: string; replyTo?: string },
  session: SessionInfo
): Promise<void> {
  const { text } = data;

  if (!text || typeof text !== 'string') {
    sendError(ws, 'INVALID_MESSAGE', 'Message text is required');
    return;
  }

  if (text.length > MESSAGE_MAX_LENGTH) {
    sendError(ws, 'MESSAGE_TOO_LONG', `Message exceeds ${String(MESSAGE_MAX_LENGTH)} characters`);
    return;
  }

  // Rate limiting
  const rateLimitKey = `${WS_RATE_LIMIT_KEY_PREFIX}${session.userId}`;
  const rateLimitResult = await checkKeyRateLimit(rateLimitKey, { maxRequests: 20, windowSeconds: 60 });
  if (!rateLimitResult.allowed) {
    sendError(ws, 'RATE_LIMITED', 'Too many messages');
    return;
  }

  try {
    const message = await webChatService.sendMessage(session.sessionId, text, data.replyTo);

    // Confirm message to sender
    connectionManager.send(session.sessionId, 'message', {
      id: message.id,
      text: message.text,
      from: 'user',
      channel: 'web',
      timestamp: message.timestamp,
    });
  } catch (error) {
    logger.error({ error, sessionId: session.sessionId }, 'Failed to send message via WebSocket');
    sendError(ws, 'INTERNAL_ERROR', 'Failed to send message');
  }
}

async function handleTyping(
  data: { isTyping: boolean },
  session: SessionInfo
): Promise<void> {
  // Only forward when user starts typing
  if (!data.isTyping) {
    return;
  }

  try {
    const user = await userRepository.findByWebSessionId(session.sessionId);
    if (!user?.topicId) {
      logger.debug({ sessionId: session.sessionId }, 'No topic for typing indicator');
      return;
    }

    // Send typing action to support topic
    await bot.api.sendChatAction(env.SUPPORT_GROUP_ID, 'typing', {
      message_thread_id: user.topicId,
    });

    logger.debug({ sessionId: session.sessionId, topicId: user.topicId }, 'Typing indicator sent to topic');
  } catch (error) {
    // Non-critical, just log
    logger.debug({ error, sessionId: session.sessionId }, 'Failed to send typing indicator');
  }
}

async function handleClose(
  ws: WebSocket,
  data: { resolved: boolean; feedback?: string },
  session: SessionInfo
): Promise<void> {
  try {
    const result = await webChatService.closeTicket(
      session.sessionId,
      data.resolved,
      data.feedback
    );

    connectionManager.send(session.sessionId, 'status', {
      status: result.status,
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'Ticket already closed') {
      sendError(ws, 'TICKET_CLOSED', 'Ticket is already closed');
      return;
    }
    logger.error({ error, sessionId: session.sessionId }, 'Failed to close ticket via WebSocket');
    sendError(ws, 'INTERNAL_ERROR', 'Failed to close ticket');
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { code, message },
    }));
  }
}

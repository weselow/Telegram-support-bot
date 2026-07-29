import type { WebSocket } from 'ws';
import type { WebSocketConnection, ServerMessage, ServerMessageType, ServerMessageData } from './types.js';
import { logger } from '../../utils/logger.js';

const connections = new Map<string, WebSocketConnection>();

export function addConnection(sessionId: string, userId: string, ws: WebSocket): void {
  const existing = connections.get(sessionId);
  if (existing) {
    try {
      existing.ws.close(1000, 'New connection established');
    } catch (error) {
      logger.debug({ error, sessionId }, 'Failed to close existing connection');
    }
  }

  connections.set(sessionId, {
    ws,
    sessionId,
    userId,
    lastActivity: Date.now(),
  });

  logger.info({ sessionId, userId }, 'WebSocket connection added');
}

export function removeConnection(sessionId: string): void {
  const conn = connections.get(sessionId);
  if (conn) {
    connections.delete(sessionId);
    logger.info({ sessionId, userId: conn.userId }, 'WebSocket connection removed');
  }
}

export function getConnection(sessionId: string): WebSocketConnection | undefined {
  return connections.get(sessionId);
}

export function getConnectionByUserId(userId: string): WebSocketConnection | undefined {
  for (const conn of connections.values()) {
    if (conn.userId === userId) {
      return conn;
    }
  }
  return undefined;
}

export function updateConnectionActivity(sessionId: string): void {
  const conn = connections.get(sessionId);
  if (conn) {
    conn.lastActivity = Date.now();
  }
}

export function sendToSession<T extends ServerMessageType>(
  sessionId: string,
  type: T,
  data: ServerMessageData[T]
): boolean {
  const conn = connections.get(sessionId);
  if (conn?.ws.readyState !== 1) {
    return false;
  }

  try {
    const message: ServerMessage<T> = { type, data };
    conn.ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to send WebSocket message');
    return false;
  }
}

export function sendToUser<T extends ServerMessageType>(
  userId: string,
  type: T,
  data: ServerMessageData[T]
): boolean {
  const conn = getConnectionByUserId(userId);
  if (!conn) {
    return false;
  }
  return sendToSession(conn.sessionId, type, data);
}

export function broadcast<T extends ServerMessageType>(type: T, data: ServerMessageData[T]): void {
  const message: ServerMessage<T> = { type, data };
  const payload = JSON.stringify(message);

  for (const conn of connections.values()) {
    if (conn.ws.readyState === 1) {
      try {
        conn.ws.send(payload);
      } catch (error) {
        logger.debug({ error, sessionId: conn.sessionId }, 'Failed to send broadcast message');
      }
    }
  }
}

export function getConnectionCount(): number {
  return connections.size;
}

export function getAllConnections(): WebSocketConnection[] {
  return Array.from(connections.values());
}

export function cleanupInactiveConnections(maxInactiveMs: number = 5 * 60 * 1000): void {
  const now = Date.now();
  for (const [sessionId, conn] of connections.entries()) {
    if (now - conn.lastActivity > maxInactiveMs) {
      try {
        conn.ws.close(1000, 'Inactive');
      } catch (error) {
        logger.debug({ error, sessionId }, 'Failed to close inactive connection');
      }
      connections.delete(sessionId);
      logger.info({ sessionId }, 'Cleaned up inactive WebSocket connection');
    }
  }
}

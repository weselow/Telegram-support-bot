import type { WebSocket } from 'ws';
import type { WebSocketConnection, ServerMessage, ServerMessageType, ServerMessageData } from './types.js';
import { logger } from '../../utils/logger.js';

const connections = new Map<string, WebSocketConnection>();

export const connectionManager = {
  add(sessionId: string, userId: string, ws: WebSocket): void {
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
  },

  remove(sessionId: string): void {
    const conn = connections.get(sessionId);
    if (conn) {
      connections.delete(sessionId);
      logger.info({ sessionId, userId: conn.userId }, 'WebSocket connection removed');
    }
  },

  get(sessionId: string): WebSocketConnection | undefined {
    return connections.get(sessionId);
  },

  getByUserId(userId: string): WebSocketConnection | undefined {
    for (const conn of connections.values()) {
      if (conn.userId === userId) {
        return conn;
      }
    }
    return undefined;
  },

  updateActivity(sessionId: string): void {
    const conn = connections.get(sessionId);
    if (conn) {
      conn.lastActivity = Date.now();
    }
  },

  send<T extends ServerMessageType>(
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
  },

  sendToUser<T extends ServerMessageType>(
    userId: string,
    type: T,
    data: ServerMessageData[T]
  ): boolean {
    const conn = this.getByUserId(userId);
    if (!conn) {
      return false;
    }
    return this.send(conn.sessionId, type, data);
  },

  broadcast<T extends ServerMessageType>(type: T, data: ServerMessageData[T]): void {
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
  },

  getConnectionCount(): number {
    return connections.size;
  },

  getAll(): WebSocketConnection[] {
    return Array.from(connections.values());
  },

  cleanup(maxInactiveMs: number = 5 * 60 * 1000): void {
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
  },
};

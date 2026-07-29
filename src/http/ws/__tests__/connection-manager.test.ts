import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WebSocket } from 'ws';

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

/** Поддельный сокет: запоминает отправленное и факт закрытия. */
interface FakeSocket {
  readyState: number;
  sent: string[];
  closeCalls: { code: number; reason: string }[];
  send: (raw: string) => void;
  close: (code: number, reason: string) => void;
  asWebSocket: WebSocket;
}

const OPEN = 1;
const CLOSED = 3;

function createSocket(): FakeSocket {
  const socket: FakeSocket = {
    readyState: OPEN,
    sent: [],
    closeCalls: [],
    send(raw: string): void {
      socket.sent.push(raw);
    },
    close(code: number, reason: string): void {
      socket.closeCalls.push({ code, reason });
      socket.readyState = CLOSED;
    },
    asWebSocket: null as unknown as WebSocket,
  };
  socket.asWebSocket = socket as unknown as WebSocket;
  return socket;
}

const SESSION = 'session-1';
const USER = 'user-1';

describe('connection-manager', () => {
  let manager: typeof import('../connection-manager.js');

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    manager = await import('../connection-manager.js');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addConnection', () => {
    it('should register connection for session and user', () => {
      const socket = createSocket();

      manager.addConnection(SESSION, USER, socket.asWebSocket);

      const all = manager.getAllConnections();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ sessionId: SESSION, userId: USER });
      expect(manager.getConnectionByUserId(USER)?.ws).toBe(socket.asWebSocket);
    });

    it('should close previous socket when same session connects again', () => {
      const first = createSocket();
      const second = createSocket();

      manager.addConnection(SESSION, USER, first.asWebSocket);
      manager.addConnection(SESSION, USER, second.asWebSocket);

      expect(first.closeCalls).toHaveLength(1);
      expect(manager.getAllConnections()).toHaveLength(1);
      expect(manager.getConnectionByUserId(USER)?.ws).toBe(second.asWebSocket);
    });
  });

  describe('removeConnection', () => {
    it('should remove connection when socket owns the entry', () => {
      const socket = createSocket();
      manager.addConnection(SESSION, USER, socket.asWebSocket);

      manager.removeConnection(SESSION, socket.asWebSocket);

      expect(manager.getAllConnections()).toHaveLength(0);
    });

    it('should keep connection when socket does not own the entry', () => {
      const owner = createSocket();
      const stranger = createSocket();
      manager.addConnection(SESSION, USER, owner.asWebSocket);

      manager.removeConnection(SESSION, stranger.asWebSocket);

      expect(manager.getConnectionByUserId(USER)?.ws).toBe(owner.asWebSocket);
    });

    it('should do nothing for unknown session', () => {
      const socket = createSocket();

      expect(() => {
        manager.removeConnection('unknown-session', socket.asWebSocket);
      }).not.toThrow();
      expect(manager.getAllConnections()).toHaveLength(0);
    });
  });

  describe('reconnect with same session', () => {
    it('should keep new connection when late close of old socket arrives', () => {
      const first = createSocket();
      const second = createSocket();
      manager.addConnection(SESSION, USER, first.asWebSocket);
      manager.addConnection(SESSION, USER, second.asWebSocket);

      // Событие close старого сокета приходит уже после регистрации нового
      manager.removeConnection(SESSION, first.asWebSocket);

      expect(manager.getAllConnections()).toHaveLength(1);
      expect(manager.getConnectionByUserId(USER)?.ws).toBe(second.asWebSocket);
    });

    it('should deliver sendToSession to new socket after late close of old one', () => {
      const first = createSocket();
      const second = createSocket();
      manager.addConnection(SESSION, USER, first.asWebSocket);
      manager.addConnection(SESSION, USER, second.asWebSocket);
      manager.removeConnection(SESSION, first.asWebSocket);

      const sent = manager.sendToSession(SESSION, 'ping', { timestamp: 42 });

      expect(sent).toBe(true);
      expect(second.sent).toHaveLength(1);
      expect(JSON.parse(second.sent[0]!)).toEqual({ type: 'ping', data: { timestamp: 42 } });
    });

    it('should deliver sendToUser to new socket after late close of old one', () => {
      const first = createSocket();
      const second = createSocket();
      manager.addConnection(SESSION, USER, first.asWebSocket);
      manager.addConnection(SESSION, USER, second.asWebSocket);
      manager.removeConnection(SESSION, first.asWebSocket);

      const sent = manager.sendToUser(USER, 'status', { status: 'IN_PROGRESS' });

      expect(sent).toBe(true);
      expect(second.sent).toHaveLength(1);
    });
  });

  describe('sendToSession', () => {
    it('should return false for unknown session', () => {
      expect(manager.sendToSession('unknown-session', 'ping', { timestamp: 1 })).toBe(false);
    });

    it('should return false when socket is not open', () => {
      const socket = createSocket();
      socket.readyState = CLOSED;
      manager.addConnection(SESSION, USER, socket.asWebSocket);

      expect(manager.sendToSession(SESSION, 'ping', { timestamp: 1 })).toBe(false);
      expect(socket.sent).toHaveLength(0);
    });

    it('should return false when send throws', () => {
      const socket = createSocket();
      socket.send = (): never => {
        throw new Error('socket is broken');
      };
      manager.addConnection(SESSION, USER, socket.asWebSocket);

      expect(manager.sendToSession(SESSION, 'ping', { timestamp: 1 })).toBe(false);
    });
  });

  describe('sendToUser', () => {
    it('should return false for unknown user', () => {
      expect(manager.sendToUser('unknown-user', 'ping', { timestamp: 1 })).toBe(false);
    });
  });

  describe('updateConnectionActivity', () => {
    it('should protect connection from cleanup', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-29T00:00:00Z'));
      const socket = createSocket();
      manager.addConnection(SESSION, USER, socket.asWebSocket);

      vi.advanceTimersByTime(10_000);
      manager.updateConnectionActivity(SESSION);
      manager.cleanupInactiveConnections(5_000);

      expect(manager.getAllConnections()).toHaveLength(1);
    });

    it('should do nothing for unknown session', () => {
      expect(() => {
        manager.updateConnectionActivity('unknown-session');
      }).not.toThrow();
    });
  });

  describe('cleanupInactiveConnections', () => {
    it('should close and remove inactive connection', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-29T00:00:00Z'));
      const socket = createSocket();
      manager.addConnection(SESSION, USER, socket.asWebSocket);

      vi.advanceTimersByTime(10_000);
      manager.cleanupInactiveConnections(5_000);

      expect(socket.closeCalls).toHaveLength(1);
      expect(manager.getAllConnections()).toHaveLength(0);
    });

    it('should keep active connection', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-29T00:00:00Z'));
      const socket = createSocket();
      manager.addConnection(SESSION, USER, socket.asWebSocket);

      vi.advanceTimersByTime(1_000);
      manager.cleanupInactiveConnections(5_000);

      expect(socket.closeCalls).toHaveLength(0);
      expect(manager.getAllConnections()).toHaveLength(1);
    });

    it('should keep reconnected socket when late close of cleaned socket arrives', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-29T00:00:00Z'));
      const first = createSocket();
      manager.addConnection(SESSION, USER, first.asWebSocket);

      vi.advanceTimersByTime(10_000);
      manager.cleanupInactiveConnections(5_000);

      // Клиент переподключился с тем же идентификатором сессии
      const second = createSocket();
      manager.addConnection(SESSION, USER, second.asWebSocket);

      // Только теперь приходит событие close закрытого при очистке сокета
      manager.removeConnection(SESSION, first.asWebSocket);

      expect(manager.getAllConnections()).toHaveLength(1);
      expect(manager.sendToUser(USER, 'ping', { timestamp: 1 })).toBe(true);
      expect(second.sent).toHaveLength(1);
    });
  });
});

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import type { ServerMessage } from '../types.js';

// Create shared test prisma instance
const { testPrisma: prisma } = await vi.hoisted(async () => {
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('../../../generated/prisma/client.js');

  const TEST_DATABASE_URL =
    process.env.DATABASE_URL_TEST ||
    'postgresql://postgres:postgres@localhost:5433/support_bot_test';

  const adapter = new PrismaPg({
    connectionString: TEST_DATABASE_URL,
  });

  return { testPrisma: new PrismaClient({ adapter }) };
});

// Mock the config/env module with test values
vi.mock('../../../config/env.js', () => ({
  env: {
    SUPPORT_GROUP_ID: '-1001234567890',
    BOT_USERNAME: 'test_bot',
    DATABASE_URL:
      process.env.DATABASE_URL_TEST ||
      'postgresql://postgres:postgres@localhost:5433/support_bot_test',
  },
}));

// Mock db client to use test prisma
vi.mock('../../../db/client.js', () => ({
  prisma,
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}));

// Mock external services that we don't want to call in tests
vi.mock('../../../bot/bot.js', () => ({
  bot: {
    api: {
      createForumTopic: vi.fn().mockResolvedValue({ message_thread_id: 100 }),
      sendMessage: vi.fn().mockResolvedValue({ message_id: 200 }),
      sendChatAction: vi.fn().mockResolvedValue(true),
    },
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../services/rate-limit.service.js', () => ({
  checkKeyRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
}));

// Import after mocks
import { registerWebSocket } from '../websocket.js';
import { connectionManager } from '../connection-manager.js';
import { bot } from '../../../bot/bot.js';
import { checkKeyRateLimit } from '../../../services/rate-limit.service.js';

describe('WebSocket Integration', () => {
  let server: FastifyInstance;
  let serverAddress: string;
  let testUserId: string;
  const testSessionId = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(async () => {
    // Clean up any leftover test data first
    await prisma.messageMap.deleteMany({ where: { user: { webSessionId: testSessionId } } });
    await prisma.user.deleteMany({ where: { webSessionId: testSessionId } });

    // Create test user in real database
    const user = await prisma.user.create({
      data: {
        webSessionId: testSessionId,
        status: 'NEW',
        topicId: 100,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test user and related messages
    await prisma.messageMap.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(checkKeyRateLimit).mockResolvedValue({ allowed: true, remaining: 19 });
    vi.mocked(bot.api.sendMessage).mockResolvedValue({ message_id: 200 } as never);
    vi.mocked(bot.api.sendChatAction).mockResolvedValue(true as never);

    server = Fastify();
    await registerWebSocket(server);
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (address && typeof address === 'object') {
      serverAddress = `ws://127.0.0.1:${address.port}`;
    }
  });

  afterEach(async () => {
    await server.close();
  });

  function createClient(sessionId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${sessionId}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  // Create user with existing message history (prevents welcome message)
  async function createUserWithHistory(data: {
    webSessionId: string;
    status: 'NEW' | 'IN_PROGRESS' | 'WAITING_CLIENT' | 'CLOSED';
    topicId: number;
  }) {
    const user = await prisma.user.create({ data });
    await prisma.messageMap.create({
      data: {
        userId: user.id,
        direction: 'USER_TO_SUPPORT',
        channel: 'WEB',
        text: 'Previous message',
      },
    });
    return user;
  }

  // Creates client and waits for connected message atomically to avoid race condition
  function createClientWithConnected(
    sessionId: string
  ): Promise<{ ws: WebSocket; connected: ServerMessage }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${sessionId}`);
      ws.once('message', (data) => {
        const message = JSON.parse(data.toString()) as ServerMessage;
        resolve({ ws, connected: message });
      });
      ws.on('error', reject);
      // Timeout for connection
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  function waitForMessage(ws: WebSocket, timeout = 2000): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);
      ws.once('message', (data) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()));
      });
    });
  }

  function waitForClose(ws: WebSocket, timeout = 2000): Promise<{ code: number; reason: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for close')), timeout);
      ws.on('close', (code, reason) => {
        clearTimeout(timer);
        resolve({ code, reason: reason.toString() });
      });
    });
  }

  function closeClient(ws: WebSocket): Promise<void> {
    return new Promise((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      ws.on('close', () => resolve());
      ws.close();
    });
  }

  describe('Connection', () => {
    it('should connect with valid session in query', async () => {
      // Create a fresh user for this test
      const testUser = await prisma.user.create({
        data: {
          webSessionId: '550e8400-e29b-41d4-a716-446655440010',
          status: 'NEW',
          topicId: 110,
        },
      });

      try {
        // Use atomic create+wait to avoid race condition where server sends
        // 'connected' before client starts listening for messages
        const { ws, connected } = await createClientWithConnected(testUser.webSessionId!);

        expect(connected.type).toBe('connected');
        expect(connected.data).toMatchObject({
          sessionId: testUser.webSessionId,
          ticketStatus: 'NEW',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should reject connection without session', async () => {
      const ws = new WebSocket(`${serverAddress}/ws/chat`);
      const result = await waitForClose(ws);

      expect(result.code).toBe(4001);
      expect(result.reason).toBe('Session not found');
    });

    it('should reject connection with invalid session', async () => {
      const ws = new WebSocket(
        `${serverAddress}/ws/chat?session=550e8400-e29b-41d4-a716-446655440001`
      );
      const result = await waitForClose(ws);

      expect(result.code).toBe(4001);
    });

    it('should reject connection with malformed UUID session', async () => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=not-a-uuid`);
      const result = await waitForClose(ws);

      expect(result.code).toBe(4001);
    });
  });

  describe('Messages', () => {
    it('should send message and receive confirmation', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440011',
        status: 'NEW',
        topicId: 111,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'message', data: { text: 'Hello support' } }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('message');
        expect(message.data).toMatchObject({
          text: 'Hello support',
          from: 'user',
          channel: 'web',
        });

        await closeClient(ws);
      } finally {
        await prisma.messageMap.deleteMany({ where: { userId: testUser.id } });
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should reject empty message', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440012',
        status: 'NEW',
        topicId: 112,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'message', data: { text: '' } }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('error');
        expect(message.data).toMatchObject({
          code: 'INVALID_MESSAGE',
          message: 'Message text is required',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should reject message exceeding max length', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440013',
        status: 'NEW',
        topicId: 113,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        const longText = 'a'.repeat(4001);
        ws.send(JSON.stringify({ type: 'message', data: { text: longText } }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('error');
        expect(message.data).toMatchObject({
          code: 'MESSAGE_TOO_LONG',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should reject invalid JSON', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440014',
        status: 'NEW',
        topicId: 114,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send('not json');
        const message = await waitForMessage(ws);

        expect(message.type).toBe('error');
        expect(message.data).toMatchObject({
          code: 'INVALID_MESSAGE',
          message: 'Invalid JSON',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should reject invalid message format', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440015',
        status: 'NEW',
        topicId: 115,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ foo: 'bar' }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('error');
        expect(message.data).toMatchObject({
          code: 'INVALID_MESSAGE',
          message: 'Invalid message format',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });
  });

  describe('Typing', () => {
    it('should forward typing indicator to topic', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440016',
        status: 'NEW',
        topicId: 116,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'typing', data: { isTyping: true } }));

        // Wait a bit for async processing
        await new Promise((r) => setTimeout(r, 100));

        expect(vi.mocked(bot.api.sendChatAction)).toHaveBeenCalledWith(
          '-1001234567890',
          'typing',
          { message_thread_id: 116 }
        );

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should not forward typing=false', async () => {
      const testUser = await prisma.user.create({
        data: {
          webSessionId: '550e8400-e29b-41d4-a716-446655440017',
          status: 'NEW',
          topicId: 117,
        },
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'typing', data: { isTyping: false } }));

        await new Promise((r) => setTimeout(r, 100));

        expect(vi.mocked(bot.api.sendChatAction)).not.toHaveBeenCalled();

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });
  });

  describe('Close Ticket', () => {
    it('should close ticket with resolved status', async () => {
      const closeTestUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'NEW',
        topicId: 101,
      });

      try {
        const ws = await createClient(closeTestUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'close', data: { resolved: true, feedback: 'Great!' } }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('status');
        expect(message.data).toMatchObject({ status: 'CLOSED' });

        await closeClient(ws);
      } finally {
        await prisma.messageMap.deleteMany({ where: { userId: closeTestUser.id } });
        await prisma.user.delete({ where: { id: closeTestUser.id } }).catch(() => {});
      }
    });

    it('should reject closing already closed ticket', async () => {
      const closedUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440003',
        status: 'CLOSED',
        topicId: 102,
      });

      try {
        const ws = await createClient(closedUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'close', data: { resolved: true } }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('error');
        expect(message.data).toMatchObject({
          code: 'TICKET_CLOSED',
        });

        await closeClient(ws);
      } finally {
        await prisma.messageMap.deleteMany({ where: { userId: closedUser.id } });
        await prisma.user.delete({ where: { id: closedUser.id } }).catch(() => {});
      }
    });
  });

  describe('Pong', () => {
    it('should handle pong message', async () => {
      const testUser = await prisma.user.create({
        data: {
          webSessionId: '550e8400-e29b-41d4-a716-446655440018',
          status: 'NEW',
          topicId: 118,
        },
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        // Send pong - should not error
        ws.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));

        // Wait and verify no error
        await new Promise((r) => setTimeout(r, 100));
        expect(ws.readyState).toBe(WebSocket.OPEN);

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should reject messages when rate limited', async () => {
      vi.mocked(checkKeyRateLimit).mockResolvedValue({ allowed: false, remaining: 0 });

      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440019',
        status: 'NEW',
        topicId: 119,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'message', data: { text: 'Hello' } }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('error');
        expect(message.data).toMatchObject({
          code: 'RATE_LIMITED',
          message: 'Too many messages',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });
  });

  describe('Unknown Message Type', () => {
    it('should reject unknown message type', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440020',
        status: 'NEW',
        topicId: 120,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        ws.send(JSON.stringify({ type: 'unknown', data: {} }));
        const message = await waitForMessage(ws);

        expect(message.type).toBe('error');
        expect(message.data).toMatchObject({
          code: 'INVALID_MESSAGE',
          message: 'Unknown message type: unknown',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });
  });

  describe('Receiving Messages from Support', () => {
    it('should receive message from support via connectionManager', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440021',
        status: 'NEW',
        topicId: 121,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        // Simulate support sending a message via connectionManager
        const sent = connectionManager.sendToUser(testUser.id, 'message', {
          id: 'support-msg-1',
          text: 'Hello from support!',
          from: 'support' as const,
          channel: 'telegram' as const,
          timestamp: new Date().toISOString(),
        });

        expect(sent).toBe(true);

        const message = await waitForMessage(ws);
        expect(message.type).toBe('message');
        expect(message.data).toMatchObject({
          id: 'support-msg-1',
          text: 'Hello from support!',
          from: 'support',
          channel: 'telegram',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });

    it('should receive status update from support', async () => {
      const testUser = await createUserWithHistory({
        webSessionId: '550e8400-e29b-41d4-a716-446655440022',
        status: 'NEW',
        topicId: 122,
      });

      try {
        const ws = await createClient(testUser.webSessionId!);
        await waitForMessage(ws); // connected

        // Simulate status change notification
        const sent = connectionManager.sendToUser(testUser.id, 'status', {
          status: 'IN_PROGRESS',
        });

        expect(sent).toBe(true);

        const message = await waitForMessage(ws);
        expect(message.type).toBe('status');
        expect(message.data).toMatchObject({
          status: 'IN_PROGRESS',
        });

        await closeClient(ws);
      } finally {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    });
  });
});

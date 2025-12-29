import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import WebSocket from 'ws';

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

// Mock the config/env module with CORS enabled
vi.mock('../../../config/env.js', () => ({
  env: {
    SUPPORT_DOMAIN: 'chat.dellshop.ru',
    SUPPORT_GROUP_ID: '-1001234567890',
    BOT_USERNAME: 'test_bot',
    NODE_ENV: 'production',
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

// Mock external services
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
import { logger } from '../../../utils/logger.js';

describe('WebSocket CORS Integration', () => {
  let server: FastifyInstance;
  let serverAddress: string;
  let testUserId: string;
  const testSessionId = '550e8400-e29b-41d4-a716-446655440099';

  beforeAll(async () => {
    // Clean up any leftover test data first
    await prisma.messageMap.deleteMany({ where: { user: { webSessionId: testSessionId } } });
    await prisma.user.deleteMany({ where: { webSessionId: testSessionId } });

    // Create test user in real database
    const user = await prisma.user.create({
      data: {
        webSessionId: testSessionId,
        status: 'NEW',
        topicId: 199,
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

  function waitForClose(ws: WebSocket, timeout = 2000): Promise<{ code: number; reason: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for close')), timeout);
      ws.on('close', (code, reason) => {
        clearTimeout(timer);
        resolve({ code, reason: reason.toString() });
      });
    });
  }

  function waitForOpen(ws: WebSocket, timeout = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for open')), timeout);
      ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.on('error', reject);
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

  describe('Origin Validation', () => {
    it('should reject connection with invalid origin', async () => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${testSessionId}`, {
        headers: {
          origin: 'https://evil.com',
        },
      });

      const result = await waitForClose(ws);

      expect(result.code).toBe(4003);
      expect(result.reason).toBe('Origin not allowed');
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        { origin: 'https://evil.com' },
        'WebSocket connection rejected: origin not allowed'
      );
    });

    it('should reject connection with suffix attack origin', async () => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${testSessionId}`, {
        headers: {
          origin: 'https://evildellshop.ru',
        },
      });

      const result = await waitForClose(ws);

      expect(result.code).toBe(4003);
      expect(result.reason).toBe('Origin not allowed');
    });

    it('should allow connection with valid exact domain origin', async () => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${testSessionId}`, {
        headers: {
          origin: 'https://dellshop.ru',
        },
      });

      await waitForOpen(ws);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      await closeClient(ws);
    });

    it('should allow connection with valid subdomain origin', async () => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${testSessionId}`, {
        headers: {
          origin: 'https://www.dellshop.ru',
        },
      });

      await waitForOpen(ws);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      await closeClient(ws);
    });

    it('should allow connection with chat subdomain origin', async () => {
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${testSessionId}`, {
        headers: {
          origin: 'https://chat.dellshop.ru',
        },
      });

      await waitForOpen(ws);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      await closeClient(ws);
    });

    it('should reject connection without origin header', async () => {
      // Note: When no origin header is sent, isOriginAllowedByConfig returns false
      // because origin is undefined
      const ws = new WebSocket(`${serverAddress}/ws/chat?session=${testSessionId}`);

      const result = await waitForClose(ws);

      expect(result.code).toBe(4003);
      expect(result.reason).toBe('Origin not allowed');
    });
  });
});

describe('WebSocket CORS in Development', () => {
  let server: FastifyInstance;
  let serverAddress: string;
  let testUserId: string;
  const testSessionId = '550e8400-e29b-41d4-a716-446655440098';

  // Re-use shared prisma for dev tests (same database, different test user)
  const prismaDev = prisma;

  beforeAll(async () => {
    vi.resetModules();

    // Clean up any leftover test data first
    await prismaDev.messageMap.deleteMany({ where: { user: { webSessionId: testSessionId } } });
    await prismaDev.user.deleteMany({ where: { webSessionId: testSessionId } });

    // Create test user
    const user = await prismaDev.user.create({
      data: {
        webSessionId: testSessionId,
        status: 'NEW',
        topicId: 198,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prismaDev.messageMap.deleteMany({ where: { userId: testUserId } });
    await prismaDev.user.delete({ where: { id: testUserId } }).catch(() => {});
    // Don't disconnect - using shared prisma instance from main test block
  });

  beforeEach(async () => {
    vi.resetModules();

    // Re-mock with development mode
    vi.doMock('../../../config/env.js', () => ({
      env: {
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        SUPPORT_GROUP_ID: '-1001234567890',
        BOT_USERNAME: 'test_bot',
        NODE_ENV: 'development',
        DATABASE_URL:
          process.env.DATABASE_URL_TEST ||
          'postgresql://postgres:postgres@localhost:5433/support_bot_test',
      },
    }));

    vi.doMock('../../../db/client.js', () => ({
      prisma: prismaDev,
      connectDatabase: vi.fn(),
      disconnectDatabase: vi.fn(),
    }));

    vi.doMock('../../../bot/bot.js', () => ({
      bot: {
        api: {
          sendMessage: vi.fn().mockResolvedValue({ message_id: 200 }),
          sendChatAction: vi.fn().mockResolvedValue(true),
        },
      },
    }));

    vi.doMock('../../../utils/logger.js', () => ({
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    }));

    vi.doMock('../../../services/rate-limit.service.js', () => ({
      checkKeyRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
    }));

    const { registerWebSocket: registerWebSocketDev } = await import('../websocket.js');

    server = Fastify();
    await registerWebSocketDev(server);
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (address && typeof address === 'object') {
      serverAddress = `ws://127.0.0.1:${address.port}`;
    }
  });

  afterEach(async () => {
    await server.close();
    vi.resetModules();
  });

  function waitForOpen(ws: WebSocket, timeout = 2000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for open')), timeout);
      ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.on('error', reject);
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

  it('should allow localhost in development mode', async () => {
    const ws = new WebSocket(`${serverAddress}/ws/chat?session=${testSessionId}`, {
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    await waitForOpen(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeClient(ws);
  });
});

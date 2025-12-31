import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Mock dependencies
vi.mock('../../../config/env.js', () => ({
  env: {
    SUPPORT_DOMAIN: 'chat.dellshop.ru',
    NODE_ENV: 'production',
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../services/rate-limit.service.js', () => ({
  checkIpRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 60 }),
}));

vi.mock('../../../services/geoip.service.js', () => ({
  getLocationByIp: vi.fn().mockResolvedValue({ city: null, fullResponse: null }),
}));

vi.mock('../../../services/web-chat.service.js', () => ({
  webChatService: {
    initSession: vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      ticketStatus: 'NEW',
      unreadCount: 0,
    }),
    getHistory: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
    getStatus: vi.fn().mockResolvedValue({ status: 'NEW' }),
  },
}));

vi.mock('../../../services/bot-info.service.js', () => ({
  getBotInfo: vi.fn().mockResolvedValue({
    name: 'Test Bot',
    username: 'test_bot',
    avatarUrl: '/api/chat/bot-avatar',
  }),
}));

import { chatRoutes } from '../chat.js';

describe('Chat Routes CORS Integration', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    await chatRoutes(fastify);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('OPTIONS preflight', () => {
    it('should allow preflight from valid origin (exact domain)', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/chat/init',
        headers: {
          origin: 'https://dellshop.ru',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://dellshop.ru');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toBe('GET, POST, OPTIONS');
    });

    it('should allow preflight from subdomain', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/chat/init',
        headers: {
          origin: 'https://www.dellshop.ru',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://www.dellshop.ru');
    });

    it('should allow preflight from chat subdomain', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/chat/init',
        headers: {
          origin: 'https://chat.dellshop.ru',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://chat.dellshop.ru');
    });

    it('should reject preflight from invalid origin', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/chat/init',
        headers: {
          origin: 'https://evil.com',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: { code: 'CORS_ERROR', message: 'Origin not allowed' },
      });
    });

    it('should reject preflight from suffix attack domain', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/chat/init',
        headers: {
          origin: 'https://evildellshop.ru',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject preflight without origin', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/chat/init',
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/chat/init CORS', () => {
    it('should include CORS headers for valid origin', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/chat/init',
        headers: {
          origin: 'https://dellshop.ru',
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('https://dellshop.ru');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject request from invalid origin', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/chat/init',
        headers: {
          origin: 'https://malicious.com',
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: { code: 'CORS_ERROR', message: 'Origin not allowed' },
      });
    });
  });

  describe('GET /api/chat/history CORS', () => {
    it('should reject request from invalid origin', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/chat/history',
        headers: {
          origin: 'https://attacker.com',
          cookie: 'webchat_session=550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.body).error.code).toBe('CORS_ERROR');
    });
  });

  describe('GET /api/chat/status CORS', () => {
    it('should reject request from invalid origin', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/chat/status',
        headers: {
          origin: 'https://hacker.net',
          cookie: 'webchat_session=550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/chat/message CORS', () => {
    it('should reject request from invalid origin', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/chat/message',
        headers: {
          origin: 'https://phishing.org',
          'content-type': 'application/json',
          cookie: 'webchat_session=550e8400-e29b-41d4-a716-446655440000',
        },
        payload: { text: 'test' },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

describe('Chat Routes CORS in Development', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../../config/env.js', () => ({
      env: {
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        NODE_ENV: 'development',
      },
    }));

    vi.doMock('../../../utils/logger.js', () => ({
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    }));

    vi.doMock('../../../services/rate-limit.service.js', () => ({
      checkIpRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetInSeconds: 60 }),
    }));

    vi.doMock('../../../services/geoip.service.js', () => ({
      getLocationByIp: vi.fn().mockResolvedValue({ city: null, fullResponse: null }),
    }));

    vi.doMock('../../../services/web-chat.service.js', () => ({
      webChatService: {
        initSession: vi.fn().mockResolvedValue({
          sessionId: 'test-session',
          ticketStatus: 'NEW',
          unreadCount: 0,
        }),
      },
    }));

    vi.doMock('../../../services/bot-info.service.js', () => ({
      getBotInfo: vi.fn().mockResolvedValue({
        name: 'Test Bot',
        username: 'test_bot',
        avatarUrl: '/api/chat/bot-avatar',
      }),
    }));

    const { chatRoutes: chatRoutesDev } = await import('../chat.js');

    fastify = Fastify();
    await chatRoutesDev(fastify);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.resetModules();
  });

  it('should allow localhost in development mode', async () => {
    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/api/chat/init',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('should set cookie with SameSite=Lax in development (no Secure)', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/init',
      headers: {
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'] as string;
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('SameSite=None');
    expect(setCookie).not.toContain('Secure');
    expect(setCookie).not.toContain('Partitioned');
  });
});

describe('Chat Routes Cookie Attributes in Production', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
    await chatRoutes(fastify);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should set cookie with SameSite=None; Secure; Partitioned in production', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/init',
      headers: {
        origin: 'https://dellshop.ru',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'] as string;
    expect(setCookie).toContain('SameSite=None');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('Partitioned');
    expect(setCookie).toContain('HttpOnly');
  });
});

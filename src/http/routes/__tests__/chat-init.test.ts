import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../../../config/env.js', () => ({
  env: {
    SUPPORT_DOMAIN: 'chat.clientsite.test',
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
  getLocationByIp: vi.fn().mockResolvedValue({ city: 'Saratov', fullResponse: null }),
}));

vi.mock('../../../services/web-chat.service.js', () => ({
  initSession: vi.fn().mockResolvedValue({
    sessionId: 'test-session',
    isNewSession: true,
    hasHistory: false,
    telegramLinked: false,
    status: 'OPEN',
  }),
  getHistory: vi.fn(),
  getStatus: vi.fn(),
  sendMessage: vi.fn(),
  sendFile: vi.fn(),
  linkTelegram: vi.fn(),
  closeTicket: vi.fn(),
}));

vi.mock('../../../services/bot-info.service.js', () => ({
  getBotInfo: vi.fn(),
}));

import { chatRoutes } from '../chat.js';

describe('chat-init', () => {
  let fastify: FastifyInstance;
  let initSession: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const webChatService = await import('../../../services/web-chat.service.js');
    initSession = webChatService.initSession as Mock;
    initSession.mockResolvedValue({
      sessionId: 'test-session',
      isNewSession: true,
      hasHistory: false,
      telegramLinked: false,
      status: 'OPEN',
    });

    fastify = Fastify();
    await chatRoutes(fastify);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should use the page url from the body when it belongs to the request origin', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/init',
      headers: {
        origin: 'https://clientsite.test',
        referer: 'https://clientsite.test/',
        'content-type': 'application/json',
      },
      payload: { pageUrl: 'https://clientsite.test/catalog/product-42' },
    });

    expect(response.statusCode).toBe(200);
    expect(initSession).toHaveBeenCalledWith(
      expect.any(String),
      'https://clientsite.test/catalog/product-42',
      'Saratov',
      expect.any(String)
    );
  });

  it('should fall back to the referer when the body has no page url', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/init',
      headers: {
        origin: 'https://clientsite.test',
        referer: 'https://clientsite.test/',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(initSession).toHaveBeenCalledWith(
      expect.any(String),
      'https://clientsite.test/',
      'Saratov',
      expect.any(String)
    );
  });

  it('should still create a session when the body is not an object', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/init',
      headers: {
        origin: 'https://clientsite.test',
        referer: 'https://clientsite.test/',
        'content-type': 'application/json',
      },
      payload: 'null',
    });

    expect(response.statusCode).toBe(200);
    expect(initSession).toHaveBeenCalledWith(
      expect.any(String),
      'https://clientsite.test/',
      'Saratov',
      expect.any(String)
    );
  });

  it('should ignore a page url from a foreign origin', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/chat/init',
      headers: {
        origin: 'https://clientsite.test',
        referer: 'https://clientsite.test/',
        'content-type': 'application/json',
      },
      payload: { pageUrl: 'https://evil.com/fake' },
    });

    expect(response.statusCode).toBe(200);
    expect(initSession).toHaveBeenCalledWith(
      expect.any(String),
      'https://clientsite.test/',
      'Saratov',
      expect.any(String)
    );
  });
});

import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../utils/logger.js';

const BOT_PATTERNS = [
  // Search engines
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /baiduspider/i,
  /duckduckbot/i,
  /slurp/i, // Yahoo

  // CLI tools
  /curl/i,
  /wget/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\//i,
  /okhttp/i,

  // Headless browsers
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,

  // Other bots
  /bot/i,
  /spider/i,
  /crawler/i,
  /scraper/i,
];

export function isBot(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.trim() === '') {
    return true;
  }

  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export async function botFilterHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userAgent = request.headers['user-agent'];

  if (isBot(userAgent)) {
    logger.warn(
      { userAgent, ip: request.ip, path: request.url },
      'Blocked bot request',
    );
    return reply.status(403).send({ error: 'Forbidden' });
  }
}

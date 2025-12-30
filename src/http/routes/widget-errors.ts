import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { captureMessage, type SeverityLevel } from '../../config/sentry.js';
import { logger } from '../../utils/logger.js';
import { isOriginAllowedByConfig } from '../../utils/cors.js';

interface WidgetErrorContext {
  sessionId?: string;
  userAgent: string;
  url: string;
  timestamp: string;
}

interface WidgetErrorBody {
  level: 'error' | 'warn';
  message: string;
  context: WidgetErrorContext;
  stack?: string;
}

interface WidgetErrorBatchBody {
  errors: WidgetErrorBody[];
}

const MAX_ERRORS_PER_REQUEST = 10;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_STACK_LENGTH = 4000;

function setCorsHeaders(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;

  if (!isOriginAllowedByConfig(origin)) {
    return false;
  }

  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('Access-Control-Max-Age', '86400');

  return true;
}

function sendCorsError(reply: FastifyReply) {
  return reply.status(403).send({
    success: false,
    error: { code: 'CORS_ERROR', message: 'Origin not allowed' },
  });
}

function validateErrorBody(error: unknown): error is WidgetErrorBody {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as Record<string, unknown>;

  if (e.level !== 'error' && e.level !== 'warn') return false;
  if (typeof e.message !== 'string' || e.message.length === 0) return false;
  if (typeof e.context !== 'object' || e.context === null) return false;

  const ctx = e.context as Record<string, unknown>;
  if (typeof ctx.userAgent !== 'string') return false;
  if (typeof ctx.url !== 'string') return false;
  if (typeof ctx.timestamp !== 'string') return false;

  return true;
}

function sanitizeMessage(msg: string): string {
  // Remove control characters (CRLF injection protection)
  return msg.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, MAX_MESSAGE_LENGTH);
}

function processError(error: WidgetErrorBody): void {
  const level: SeverityLevel = error.level === 'warn' ? 'warning' : 'error';
  const message = sanitizeMessage(error.message);

  const context: Record<string, unknown> = {
    userAgent: error.context.userAgent,
    pageUrl: error.context.url,
    clientTimestamp: error.context.timestamp,
  };

  if (error.context.sessionId) {
    context.sessionId = error.context.sessionId;
  }

  if (error.stack) {
    context.stack = error.stack.slice(0, MAX_STACK_LENGTH);
  }

  // Send to Sentry with widget source tag
  captureMessage(message, level, context, { source: 'widget' });

  // Also log locally
  if (level === 'error') {
    logger.error({ ...context, source: 'widget' }, `[Widget] ${message}`);
  } else {
    logger.warn({ ...context, source: 'widget' }, `[Widget] ${message}`);
  }
}

export function widgetErrorsRoutes(fastify: FastifyInstance): void {
  // CORS preflight handler
  fastify.options('/api/widget/errors', async (request, reply) => {
    if (!setCorsHeaders(request, reply)) {
      return sendCorsError(reply);
    }
    return reply.status(204).send();
  });

  // POST /api/widget/errors - Receive widget errors (batched)
  fastify.post('/api/widget/errors', async (request: FastifyRequest<{ Body: WidgetErrorBatchBody }>, reply) => {
    if (!setCorsHeaders(request, reply)) {
      return sendCorsError(reply);
    }

    const { errors } = request.body;

    if (!Array.isArray(errors)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_BODY', message: 'errors array is required' },
      });
    }

    // Limit batch size
    const toProcess = errors.slice(0, MAX_ERRORS_PER_REQUEST);

    let processed = 0;
    for (const error of toProcess) {
      if (validateErrorBody(error)) {
        processError(error);
        processed++;
      }
    }

    return reply.send({
      success: true,
      data: { processed },
    });
  });
}

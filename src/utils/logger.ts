import pino from 'pino';
import type { LoggerOptions } from 'pino';
import { env } from '../config/env.js';

const options: LoggerOptions =
  env.NODE_ENV === 'development'
    ? {
        level: env.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        level: env.LOG_LEVEL,
      };

export const logger = pino(options);

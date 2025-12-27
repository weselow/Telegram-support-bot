import './config/sentry.js';
import { logger } from './utils/logger.js';
import { startBot, stopBot } from './bot/bot.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';
import { startWorkers, stopWorkers } from './jobs/index.js';
import { startHttpServer, stopHttpServer } from './http/server.js';
import { captureError } from './config/sentry.js';

async function main(): Promise<void> {
  logger.info('Telegram Support Bot starting...');

  await connectDatabase();
  logger.info('Database connected');

  startWorkers();
  logger.info('Job workers started');

  await startHttpServer();

  await startBot();
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  try {
    await stopBot();
    await stopHttpServer();
    await stopWorkers();
    await disconnectDatabase();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    captureError(error, { action: 'shutdown' });
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

main().catch((error: unknown) => {
  captureError(error, { action: 'startup' });
  logger.error({ error }, 'Failed to start bot');
  process.exit(1);
});

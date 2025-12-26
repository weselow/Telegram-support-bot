import { startSlaWorker, stopSlaWorker } from './sla.worker.js';
import { startAutocloseWorker, stopAutocloseWorker } from './autoclose.worker.js';
import { closeQueues } from './queues.js';
import { logger } from '../utils/logger.js';

export function startWorkers(): void {
  startSlaWorker();
  startAutocloseWorker();
  logger.info('All workers started');
}

export async function stopWorkers(): Promise<void> {
  await Promise.all([
    stopSlaWorker(),
    stopAutocloseWorker(),
  ]);
  await closeQueues();
  logger.info('All workers stopped');
}

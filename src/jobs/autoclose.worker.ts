import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import type { AutocloseJobData } from './queues.js';

let worker: Worker<AutocloseJobData> | null = null;

async function processAutocloseJob(job: Job<AutocloseJobData>): Promise<void> {
  const { userId, topicId } = job.data;

  logger.info({ userId, topicId, jobId: job.id }, 'Processing autoclose job');

  // TODO: Implement autoclose logic in task 014
  // - Check if ticket is still in WAITING_CLIENT status
  // - Check last activity timestamp from tickets table
  // - Close ticket if no activity for 7 days
  await Promise.resolve();
}

export function startAutocloseWorker(): Worker<AutocloseJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<AutocloseJobData>('autoclose', processAutocloseJob, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Autoclose job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Autoclose job failed');
  });

  worker.on('error', (error) => {
    logger.error({ error }, 'Autoclose worker error');
  });

  logger.info('Autoclose worker started');
  return worker;
}

export async function stopAutocloseWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('Autoclose worker stopped');
  }
}

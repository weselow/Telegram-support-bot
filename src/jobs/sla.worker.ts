import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import type { SlaJobData } from './queues.js';

let worker: Worker<SlaJobData> | null = null;

// SLA levels: first = 10 min, second = 30 min, escalation = 2 hours
async function processSlaJob(job: Job<SlaJobData>): Promise<void> {
  const { userId, topicId, level } = job.data;

  logger.info({ userId, topicId, level, jobId: job.id }, 'Processing SLA job');

  // TODO: Implement SLA notification logic in task 013
  // - Check if ticket is still open
  // - Send reminder to support group
  // - Schedule next level if needed
  await Promise.resolve();
}

export function startSlaWorker(): Worker<SlaJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<SlaJobData>('sla', processSlaJob, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'SLA job completed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'SLA job failed');
  });

  worker.on('error', (error) => {
    logger.error({ error }, 'SLA worker error');
  });

  logger.info('SLA worker started');
  return worker;
}

export async function stopSlaWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('SLA worker stopped');
  }
}

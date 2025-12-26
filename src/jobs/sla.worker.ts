import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import type { SlaJobData } from './queues.js';

let worker: Worker<SlaJobData> | null = null;

function processSlaJob(job: Job<SlaJobData>): void {
  const { userId, topicId, level } = job.data;

  logger.info({ userId, topicId, level, jobId: job.id }, 'Processing SLA job');

  // TODO: Implement SLA notification logic in task 013
  // - Check if ticket is still open
  // - Send reminder to support group
  // - Schedule next level if needed
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

import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';

const connection = getRedisConnection();

export interface SlaJobData {
  userId: string;
  topicId: number;
  level: 'first' | 'second' | 'escalation';
}

export interface AutocloseJobData {
  userId: string;
  topicId: number;
}

export const slaQueue = new Queue<SlaJobData>('sla', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export const autocloseQueue = new Queue<AutocloseJobData>('autoclose', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export async function closeQueues(): Promise<void> {
  await slaQueue.close();
  await autocloseQueue.close();
}

// Utility: schedule SLA job with delay
export async function scheduleSlaJob(
  data: SlaJobData,
  delayMs: number,
): Promise<string> {
  const job = await slaQueue.add(`sla-${data.userId}-${data.level}`, data, {
    delay: delayMs,
    jobId: `sla-${data.userId}-${String(data.topicId)}-${data.level}`,
  });
  return job.id ?? '';
}

// Utility: schedule autoclose job with delay
export async function scheduleAutocloseJob(
  data: AutocloseJobData,
  delayMs: number,
): Promise<string> {
  const job = await autocloseQueue.add(`autoclose-${data.userId}`, data, {
    delay: delayMs,
    jobId: `autoclose-${data.userId}-${String(data.topicId)}`,
  });
  return job.id ?? '';
}

// Utility: cancel job by ID
export async function cancelSlaJob(
  userId: string,
  topicId: number,
  level: SlaJobData['level'],
): Promise<void> {
  const jobId = `sla-${userId}-${String(topicId)}-${level}`;
  const job = await slaQueue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}

export async function cancelAutocloseJob(
  userId: string,
  topicId: number,
): Promise<void> {
  const jobId = `autoclose-${userId}-${String(topicId)}`;
  const job = await autocloseQueue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}

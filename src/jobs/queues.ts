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

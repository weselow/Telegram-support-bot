import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';

export interface SlaJobData {
  userId: string;
  topicId: number;
  level: 'first' | 'second' | 'escalation';
}

export interface AutocloseJobData {
  userId: string;
  topicId: number;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: 100,
} as const;

/**
 * Очереди создаются по требованию, а не при импорте модуля.
 *
 * BullMQ открывает соединение с Redis прямо в конструкторе Queue. Пока очереди
 * создавались на уровне модуля, любой импорт из этой цепочки (сервисы SLA и
 * автозакрытия, а через них — обработчики бота) уводил процесс в сеть. В
 * юнит-тестах это давало поток ошибок подключения, а на машине разработчика —
 * обращения к постороннему Redis из переменной REDIS_URL.
 */
let slaQueue: Queue<SlaJobData> | null = null;
let autocloseQueue: Queue<AutocloseJobData> | null = null;

export function getSlaQueue(): Queue<SlaJobData> {
  slaQueue ??= new Queue<SlaJobData>('sla', {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  return slaQueue;
}

export function getAutocloseQueue(): Queue<AutocloseJobData> {
  autocloseQueue ??= new Queue<AutocloseJobData>('autoclose', {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  return autocloseQueue;
}

/** Закрывает только те очереди, которые действительно создавались. */
export async function closeQueues(): Promise<void> {
  const opened = [slaQueue, autocloseQueue].filter((queue) => queue !== null);
  slaQueue = null;
  autocloseQueue = null;

  await Promise.all(opened.map((queue) => queue.close()));
}

// Utility: schedule SLA job with delay
export async function scheduleSlaJob(
  data: SlaJobData,
  delayMs: number,
): Promise<string> {
  const job = await getSlaQueue().add(`sla-${data.userId}-${data.level}`, data, {
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
  const job = await getAutocloseQueue().add(`autoclose-${data.userId}`, data, {
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
  const job = await getSlaQueue().getJob(jobId);
  if (job) {
    await job.remove();
  }
}

export async function cancelAutocloseJob(
  userId: string,
  topicId: number,
): Promise<void> {
  const jobId = `autoclose-${userId}-${String(topicId)}`;
  const job = await getAutocloseQueue().getJob(jobId);
  if (job) {
    await job.remove();
  }
}

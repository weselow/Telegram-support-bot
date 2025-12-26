import { scheduleSlaJob, cancelSlaJob } from '../jobs/queues.js';
import { logger } from '../utils/logger.js';

// SLA timing in milliseconds
const SLA_FIRST_MS = 10 * 60 * 1000; // 10 minutes
const SLA_SECOND_MS = 30 * 60 * 1000; // 30 minutes
const SLA_ESCALATION_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function startSlaTimers(userId: string, topicId: number): Promise<boolean> {
  logger.info({ userId, topicId }, 'Starting SLA timers');

  try {
    await Promise.all([
      scheduleSlaJob({ userId, topicId, level: 'first' }, SLA_FIRST_MS),
      scheduleSlaJob({ userId, topicId, level: 'second' }, SLA_SECOND_MS),
      scheduleSlaJob({ userId, topicId, level: 'escalation' }, SLA_ESCALATION_MS),
    ]);
    logger.debug({ userId, topicId }, 'SLA timers scheduled');
    return true;
  } catch (error) {
    logger.error({ error, userId, topicId }, 'Failed to start SLA timers (non-blocking)');
    return false;
  }
}

export async function cancelAllSlaTimers(userId: string, topicId: number): Promise<void> {
  logger.info({ userId, topicId }, 'Cancelling all SLA timers');

  const results = await Promise.allSettled([
    cancelSlaJob(userId, topicId, 'first'),
    cancelSlaJob(userId, topicId, 'second'),
    cancelSlaJob(userId, topicId, 'escalation'),
  ]);

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    logger.warn({ userId, topicId, failedCount: failed.length }, 'Some SLA timers failed to cancel');
  } else {
    logger.debug({ userId, topicId }, 'SLA timers cancelled');
  }
}

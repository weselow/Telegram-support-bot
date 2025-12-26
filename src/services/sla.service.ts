import { scheduleSlaJob, cancelSlaJob } from '../jobs/queues.js';
import { logger } from '../utils/logger.js';

// SLA timing in milliseconds
const SLA_FIRST_MS = 10 * 60 * 1000; // 10 minutes
const SLA_SECOND_MS = 30 * 60 * 1000; // 30 minutes
const SLA_ESCALATION_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function startSlaTimers(userId: string, topicId: number): Promise<void> {
  logger.info({ userId, topicId }, 'Starting SLA timers');

  await Promise.all([
    scheduleSlaJob({ userId, topicId, level: 'first' }, SLA_FIRST_MS),
    scheduleSlaJob({ userId, topicId, level: 'second' }, SLA_SECOND_MS),
    scheduleSlaJob({ userId, topicId, level: 'escalation' }, SLA_ESCALATION_MS),
  ]);

  logger.debug({ userId, topicId }, 'SLA timers scheduled');
}

export async function cancelAllSlaTimers(userId: string, topicId: number): Promise<void> {
  logger.info({ userId, topicId }, 'Cancelling all SLA timers');

  await Promise.all([
    cancelSlaJob(userId, topicId, 'first'),
    cancelSlaJob(userId, topicId, 'second'),
    cancelSlaJob(userId, topicId, 'escalation'),
  ]);

  logger.debug({ userId, topicId }, 'SLA timers cancelled');
}

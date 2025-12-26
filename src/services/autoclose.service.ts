import { scheduleAutocloseJob, cancelAutocloseJob } from '../jobs/queues.js';
import { logger } from '../utils/logger.js';
import { autocloseTimings, settings } from '../config/settings.js';

export async function startAutocloseTimer(userId: string, topicId: number): Promise<boolean> {
  logger.info({ userId, topicId, days: settings.autoclose.days }, 'Starting autoclose timer');

  try {
    await scheduleAutocloseJob({ userId, topicId }, autocloseTimings.delayMs);
    logger.debug({ userId, topicId }, 'Autoclose timer scheduled');
    return true;
  } catch (error) {
    logger.error({ error, userId, topicId }, 'Failed to start autoclose timer (non-blocking)');
    return false;
  }
}

export async function cancelAutocloseTimer(userId: string, topicId: number): Promise<void> {
  logger.info({ userId, topicId }, 'Cancelling autoclose timer');

  try {
    await cancelAutocloseJob(userId, topicId);
    logger.debug({ userId, topicId }, 'Autoclose timer cancelled');
  } catch (error) {
    logger.warn({ error, userId, topicId }, 'Failed to cancel autoclose timer');
  }
}

import { scheduleAutocloseJob, cancelAutocloseJob } from '../jobs/queues.js';
import { logger } from '../utils/logger.js';

// 7 days in milliseconds
const AUTOCLOSE_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export async function startAutocloseTimer(userId: string, topicId: number): Promise<boolean> {
  logger.info({ userId, topicId }, 'Starting autoclose timer (7 days)');

  try {
    await scheduleAutocloseJob({ userId, topicId }, AUTOCLOSE_DELAY_MS);
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

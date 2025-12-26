import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { userRepository } from '../db/repositories/user.repository.js';
import { eventRepository } from '../db/repositories/event.repository.js';
import { updateTicketCard, type TicketCardData } from '../services/topic.service.js';
import { bot } from '../bot/bot.js';
import { messages, formatMessage } from '../config/messages.js';
import { settings } from '../config/settings.js';
import { captureError, addBreadcrumb } from '../config/sentry.js';
import type { AutocloseJobData } from './queues.js';

let worker: Worker<AutocloseJobData> | null = null;

const CLIENT_MESSAGE = formatMessage(messages.autoclose.client, { days: settings.autoclose.days });
const TOPIC_MESSAGE = formatMessage(messages.autoclose.topic, { days: settings.autoclose.days });

async function processAutocloseJob(job: Job<AutocloseJobData>): Promise<void> {
  const { userId, topicId } = job.data;

  addBreadcrumb('autoclose', 'Autoclose ticket', 'info', { userId, topicId });
  logger.info({ userId, topicId, jobId: job.id }, 'Processing autoclose job');

  const user = await userRepository.findById(userId);
  if (!user) {
    logger.warn({ userId, topicId }, 'Autoclose job: user not found');
    return;
  }

  if (user.status !== 'WAITING_CLIENT') {
    logger.debug(
      { userId, topicId, status: user.status },
      'Autoclose job: status changed, skipping'
    );
    return;
  }

  const supportGroupId = Number(env.SUPPORT_GROUP_ID);

  try {
    await userRepository.updateStatus(userId, 'CLOSED');
  } catch (error) {
    captureError(error, { userId, topicId, action: 'autocloseUpdateStatus' });
    logger.error({ error, userId, topicId }, 'Failed to update status to CLOSED');
    throw error;
  }

  try {
    await eventRepository.create({
      userId,
      eventType: 'CLOSED',
      oldValue: 'WAITING_CLIENT',
      newValue: 'CLOSED',
    });
  } catch (error) {
    captureError(error, { userId, topicId, action: 'autocloseCreateEvent' });
    logger.error({ error, userId, topicId }, 'Failed to create autoclose event');
  }

  if (user.cardMessageId) {
    try {
      const cardData: TicketCardData = {
        tgUserId: Number(user.tgUserId),
        firstName: user.tgFirstName,
        username: user.tgUsername ?? undefined,
        phone: user.phone ?? undefined,
        sourceUrl: user.sourceUrl ?? undefined,
        status: 'CLOSED',
        createdAt: user.createdAt,
      };
      await updateTicketCard(bot.api, user.cardMessageId, userId, cardData);
    } catch (error) {
      captureError(error, { userId, topicId, action: 'autocloseUpdateCard' });
      logger.error({ error, userId, topicId }, 'Failed to update ticket card on autoclose');
    }
  }

  try {
    await bot.api.sendMessage(Number(user.tgUserId), CLIENT_MESSAGE);
  } catch (error) {
    captureError(error, { userId, topicId, action: 'autocloseNotifyClient' });
    logger.warn({ error, userId, topicId }, 'Failed to notify client about autoclose');
  }

  try {
    await bot.api.sendMessage(supportGroupId, TOPIC_MESSAGE, {
      message_thread_id: topicId,
    });
  } catch (error) {
    captureError(error, { userId, topicId, action: 'autocloseNotifyTopic' });
    logger.error({ error, userId, topicId }, 'Failed to send autoclose message to topic');
  }

  logger.info({ userId, topicId }, 'Ticket autoclosed successfully');
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
    captureError(error, { jobId: job?.id, jobData: job?.data, action: 'autocloseJobFailed' });
    logger.error({ jobId: job?.id, error }, 'Autoclose job failed');
  });

  worker.on('error', (error) => {
    captureError(error, { action: 'autocloseWorkerError' });
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

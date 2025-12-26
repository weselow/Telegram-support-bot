import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { userRepository } from '../db/repositories/user.repository.js';
import { bot } from '../bot/bot.js';
import {
  getGroupAdmins,
  formatAdminMentions,
  sendDmToAdmins,
} from '../services/group.service.js';
import { messages, formatMessage } from '../config/messages.js';
import { settings } from '../config/settings.js';
import { captureError, addBreadcrumb } from '../config/sentry.js';
import type { SlaJobData } from './queues.js';

let worker: Worker<SlaJobData> | null = null;

const SLA_MESSAGES = {
  first: formatMessage(messages.sla.first, { minutes: settings.sla.firstReminderMinutes }),
  second: formatMessage(messages.sla.second, { minutes: settings.sla.secondReminderMinutes }),
  escalation: formatMessage(messages.sla.escalation, { hours: settings.sla.escalationMinutes / 60 }),
} as const;

async function processSlaJob(job: Job<SlaJobData>): Promise<void> {
  const { userId, topicId, level } = job.data;

  addBreadcrumb('sla', `SLA ${level} reminder`, 'warning', { userId, topicId, level });
  logger.info({ userId, topicId, level, jobId: job.id }, 'Processing SLA job');

  const user = await userRepository.findById(userId);
  if (!user) {
    logger.warn({ userId, topicId, level }, 'SLA job: user not found');
    return;
  }

  if (user.status === 'CLOSED') {
    logger.debug({ userId, topicId, level }, 'SLA job: ticket already closed, skipping');
    return;
  }

  const supportGroupId = Number(env.SUPPORT_GROUP_ID);

  let admins;
  try {
    admins = await getGroupAdmins(bot.api);
  } catch (error) {
    captureError(error, { userId, topicId, level, action: 'getGroupAdmins' });
    logger.error({ error, userId, topicId, level }, 'Failed to get group admins for SLA reminder');
    throw error;
  }

  const mentions = formatAdminMentions(admins);
  const baseMessage = SLA_MESSAGES[level];
  const message = `// ${baseMessage}\n${mentions}`;

  try {
    await bot.api.sendMessage(supportGroupId, message, {
      message_thread_id: topicId,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    captureError(error, { userId, topicId, level, action: 'sendSlaReminder' });
    logger.error({ error, userId, topicId, level }, 'Failed to send SLA reminder to topic');
    throw error;
  }

  if (level === 'escalation') {
    const groupIdForLink = String(supportGroupId).replace('-100', '');
    const topicLink = `https://t.me/c/${groupIdForLink}/${String(topicId)}`;
    const dmMessage = formatMessage(messages.sla.dmEscalation, {
      hours: settings.sla.escalationMinutes / 60,
      firstName: user.tgFirstName,
      topicLink,
    });

    await sendDmToAdmins(bot.api, admins, dmMessage);
  }

  logger.info({ userId, topicId, level }, 'SLA reminder sent');
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
    captureError(error, { jobId: job?.id, jobData: job?.data, action: 'slaJobFailed' });
    logger.error({ jobId: job?.id, error }, 'SLA job failed');
  });

  worker.on('error', (error) => {
    captureError(error, { action: 'slaWorkerError' });
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

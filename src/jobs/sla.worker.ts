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
import type { SlaJobData } from './queues.js';

let worker: Worker<SlaJobData> | null = null;

const SLA_MESSAGES = {
  first: '⏰ SLA: 10 минут без ответа',
  second: '⚠️ SLA: 30 минут без ответа',
  escalation: '🚨 SLA BREACH: 2 часа без ответа!',
} as const;

async function processSlaJob(job: Job<SlaJobData>): Promise<void> {
  const { userId, topicId, level } = job.data;

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
  const admins = await getGroupAdmins(bot.api);
  const mentions = formatAdminMentions(admins);

  const baseMessage = SLA_MESSAGES[level];
  const message = `// ${baseMessage}\n${mentions}`;

  await bot.api.sendMessage(supportGroupId, message, {
    message_thread_id: topicId,
    parse_mode: 'Markdown',
  });

  if (level === 'escalation') {
    const groupIdForLink = String(supportGroupId).replace('-100', '');
    const dmMessage =
      `🚨 *SLA BREACH*\n\n` +
      `Тикет без ответа более 2 часов!\n` +
      `Пользователь: ${user.tgFirstName}\n` +
      `[Открыть тикет](https://t.me/c/${groupIdForLink}/${String(topicId)})`;

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
    logger.error({ jobId: job?.id, error }, 'SLA job failed');
  });

  worker.on('error', (error) => {
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

import type { Api } from 'grammy';
import type { ForumTopic } from 'grammy/types';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface TopicUserInfo {
  tgUserId: number;
  firstName: string;
  username?: string | undefined;
}

function formatTopicName(user: TopicUserInfo): string {
  return `${user.firstName} (${String(user.tgUserId)})`;
}

export async function createTopic(api: Api, user: TopicUserInfo): Promise<ForumTopic> {
  const topicName = formatTopicName(user);

  logger.info({ tgUserId: user.tgUserId, topicName }, 'Creating forum topic');

  const topic = await api.createForumTopic(env.SUPPORT_GROUP_ID, topicName);

  logger.info(
    { tgUserId: user.tgUserId, topicId: topic.message_thread_id },
    'Forum topic created'
  );

  return topic;
}

export async function sendTicketCard(
  api: Api,
  topicId: number,
  user: TopicUserInfo,
  sourceUrl?: string
): Promise<number> {
  const usernameLine = user.username ? `\n👤 Username: @${user.username}` : '';
  const sourceLine = sourceUrl ? `\n🔗 Источник: ${sourceUrl}` : '';

  const cardText =
    `📋 *Новый тикет*\n\n` +
    `👤 Пользователь: ${user.firstName}` +
    usernameLine +
    `\n🆔 Telegram ID: \`${String(user.tgUserId)}\`` +
    sourceLine +
    `\n📅 Создан: ${new Date().toLocaleString('ru-RU')}\n\n` +
    `Статус: 🆕 Новый`;

  const message = await api.sendMessage(env.SUPPORT_GROUP_ID, cardText, {
    message_thread_id: topicId,
    parse_mode: 'Markdown',
  });

  try {
    await api.pinChatMessage(env.SUPPORT_GROUP_ID, message.message_id);
  } catch (error) {
    logger.warn({ topicId, error }, 'Failed to pin ticket card');
  }

  return message.message_id;
}

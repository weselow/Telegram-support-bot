import type { Context } from 'grammy';
import { findUserByTgId, findUserByTopicId } from '../../services/ticket.service.js';
import { editMirroredUserMessage, editMirroredSupportMessage } from '../../services/message.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export async function privateEditHandler(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.editedMessage) {
    return;
  }

  const tgUserId = BigInt(ctx.from.id);
  const user = await findUserByTgId(tgUserId);

  if (!user) {
    // User not registered yet, nothing to mirror
    return;
  }

  try {
    const supportGroupId = Number(env.SUPPORT_GROUP_ID);
    await editMirroredUserMessage(ctx.api, ctx.editedMessage, user.id, supportGroupId);
  } catch (error) {
    logger.error({ error, tgUserId: ctx.from.id }, 'Failed to mirror edited message');
  }
}

export async function supportEditHandler(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.editedMessage) {
    return;
  }

  // Ignore bot's own messages
  if (ctx.from.is_bot) {
    return;
  }

  // Filter internal messages (not forwarded to user)
  const text = ctx.editedMessage.text ?? ctx.editedMessage.caption ?? '';
  if (text.startsWith('//') || text.startsWith('#internal')) {
    return;
  }

  // Get topic ID from message
  const topicId = ctx.editedMessage.message_thread_id;
  if (!topicId) {
    return;
  }

  // Find user by topic ID
  const user = await findUserByTopicId(topicId);
  if (!user) {
    return;
  }

  try {
    await editMirroredSupportMessage(ctx.api, ctx.editedMessage, user.id, user.tgUserId);
  } catch (error) {
    logger.error({ error, topicId, userId: user.id }, 'Failed to mirror edited support message');
  }
}

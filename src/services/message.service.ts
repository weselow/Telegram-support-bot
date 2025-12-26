import { InlineKeyboard } from 'grammy';
import type { Api } from 'grammy';
import type { Message } from 'grammy/types';
import { messageRepository } from '../db/repositories/message.repository.js';
import { logger } from '../utils/logger.js';

interface TopicSendOptions {
  message_thread_id: number;
  caption?: string;
}

interface DmSendOptions {
  caption?: string;
}

type TopicMessageSender = (
  api: Api,
  message: Message,
  groupId: number,
  topicId: number
) => Promise<Message | null>;

type DmMessageSender = (
  api: Api,
  message: Message,
  chatId: number,
  userId: string
) => Promise<Message | null>;

function buildResolveKeyboard(userId: string): InlineKeyboard {
  return new InlineKeyboard().text('✅ Спасибо, вопрос решён', `resolve:${userId}`);
}

function buildTopicOptions(topicId: number, caption?: string): TopicSendOptions {
  const options: TopicSendOptions = { message_thread_id: topicId };
  if (caption) {
    options.caption = caption;
  }
  return options;
}

function buildDmOptions(caption?: string): DmSendOptions {
  const options: DmSendOptions = {};
  if (caption) {
    options.caption = caption;
  }
  return options;
}

// Topic senders (user → support group)
const sendTextToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.text) return null;
  return api.sendMessage(groupId, msg.text, { message_thread_id: topicId });
};

const sendPhotoToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.photo || msg.photo.length === 0) return null;
  const photo = msg.photo[msg.photo.length - 1];
  if (!photo) {
    logger.warn({ messageId: msg.message_id }, 'Photo array empty unexpectedly');
    return null;
  }
  return api.sendPhoto(groupId, photo.file_id, buildTopicOptions(topicId, msg.caption));
};

const sendVideoToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.video) return null;
  return api.sendVideo(groupId, msg.video.file_id, buildTopicOptions(topicId, msg.caption));
};

const sendDocumentToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.document) return null;
  return api.sendDocument(groupId, msg.document.file_id, buildTopicOptions(topicId, msg.caption));
};

const sendVoiceToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.voice) return null;
  return api.sendVoice(groupId, msg.voice.file_id, { message_thread_id: topicId });
};

const sendAudioToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.audio) return null;
  return api.sendAudio(groupId, msg.audio.file_id, buildTopicOptions(topicId, msg.caption));
};

const sendVideoNoteToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.video_note) return null;
  return api.sendVideoNote(groupId, msg.video_note.file_id, { message_thread_id: topicId });
};

const sendStickerToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.sticker) return null;
  return api.sendSticker(groupId, msg.sticker.file_id, { message_thread_id: topicId });
};

const sendAnimationToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.animation) return null;
  return api.sendAnimation(groupId, msg.animation.file_id, buildTopicOptions(topicId, msg.caption));
};

const sendContactToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.contact) return null;
  return api.sendContact(groupId, msg.contact.phone_number, msg.contact.first_name, {
    message_thread_id: topicId,
  });
};

const sendLocationToTopic: TopicMessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.location) return null;
  return api.sendLocation(groupId, msg.location.latitude, msg.location.longitude, {
    message_thread_id: topicId,
  });
};

const topicSenders: TopicMessageSender[] = [
  sendTextToTopic,
  sendPhotoToTopic,
  sendVideoToTopic,
  sendDocumentToTopic,
  sendVoiceToTopic,
  sendAudioToTopic,
  sendVideoNoteToTopic,
  sendStickerToTopic,
  sendAnimationToTopic,
  sendContactToTopic,
  sendLocationToTopic,
];

// DM senders (support → user)
const sendTextToDm: DmMessageSender = async (api, msg, chatId, userId) => {
  if (!msg.text) return null;
  return api.sendMessage(chatId, msg.text, {
    reply_markup: buildResolveKeyboard(userId),
  });
};

const sendPhotoToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.photo || msg.photo.length === 0) return null;
  const photo = msg.photo[msg.photo.length - 1];
  if (!photo) return null;
  return api.sendPhoto(chatId, photo.file_id, buildDmOptions(msg.caption));
};

const sendVideoToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.video) return null;
  return api.sendVideo(chatId, msg.video.file_id, buildDmOptions(msg.caption));
};

const sendDocumentToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.document) return null;
  return api.sendDocument(chatId, msg.document.file_id, buildDmOptions(msg.caption));
};

const sendVoiceToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.voice) return null;
  return api.sendVoice(chatId, msg.voice.file_id);
};

const sendAudioToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.audio) return null;
  return api.sendAudio(chatId, msg.audio.file_id, buildDmOptions(msg.caption));
};

const sendVideoNoteToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.video_note) return null;
  return api.sendVideoNote(chatId, msg.video_note.file_id);
};

const sendStickerToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.sticker) return null;
  return api.sendSticker(chatId, msg.sticker.file_id);
};

const sendAnimationToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.animation) return null;
  return api.sendAnimation(chatId, msg.animation.file_id, buildDmOptions(msg.caption));
};

const sendContactToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.contact) return null;
  return api.sendContact(chatId, msg.contact.phone_number, msg.contact.first_name);
};

const sendLocationToDm: DmMessageSender = async (api, msg, chatId, _userId) => {
  if (!msg.location) return null;
  return api.sendLocation(chatId, msg.location.latitude, msg.location.longitude);
};

const dmSenders: DmMessageSender[] = [
  sendTextToDm,
  sendPhotoToDm,
  sendVideoToDm,
  sendDocumentToDm,
  sendVoiceToDm,
  sendAudioToDm,
  sendVideoNoteToDm,
  sendStickerToDm,
  sendAnimationToDm,
  sendContactToDm,
  sendLocationToDm,
];

export async function mirrorUserMessage(
  api: Api,
  message: Message,
  userId: string,
  topicId: number,
  supportGroupId: number
): Promise<number | null> {
  let sentMessage: Message | null = null;

  for (const sender of topicSenders) {
    sentMessage = await sender(api, message, supportGroupId, topicId);
    if (sentMessage) break;
  }

  if (!sentMessage) {
    logger.warn({ messageId: message.message_id }, 'Unsupported message type, not mirrored');
    return null;
  }

  await messageRepository.create({
    userId,
    dmMessageId: message.message_id,
    topicMessageId: sentMessage.message_id,
    direction: 'USER_TO_SUPPORT',
  });

  return sentMessage.message_id;
}

export async function mirrorSupportMessage(
  api: Api,
  message: Message,
  userId: string,
  userTgId: bigint
): Promise<number | null> {
  let sentMessage: Message | null = null;

  for (const sender of dmSenders) {
    sentMessage = await sender(api, message, Number(userTgId), userId);
    if (sentMessage) break;
  }

  if (!sentMessage) {
    logger.warn({ messageId: message.message_id }, 'Unsupported message type, not mirrored to user');
    return null;
  }

  await messageRepository.create({
    userId,
    dmMessageId: sentMessage.message_id,
    topicMessageId: message.message_id,
    direction: 'SUPPORT_TO_USER',
  });

  return sentMessage.message_id;
}

export async function editMirroredUserMessage(
  api: Api,
  editedMessage: Message,
  userId: string,
  supportGroupId: number
): Promise<boolean> {
  const mapping = await messageRepository.findByDmMessageId(userId, editedMessage.message_id);
  if (!mapping) {
    logger.debug({ messageId: editedMessage.message_id, userId }, 'No mapping found for edited message');
    return false;
  }

  try {
    if (editedMessage.text) {
      await api.editMessageText(supportGroupId, mapping.topicMessageId, editedMessage.text);
    } else if (editedMessage.caption !== undefined) {
      await api.editMessageCaption(supportGroupId, mapping.topicMessageId, {
        caption: editedMessage.caption,
      });
    } else {
      logger.debug({ messageId: editedMessage.message_id }, 'Edited message has no editable content');
      return false;
    }

    logger.info(
      { dmMessageId: editedMessage.message_id, topicMessageId: mapping.topicMessageId },
      'User message edit mirrored to topic'
    );
    return true;
  } catch (error) {
    logger.error({ error, messageId: editedMessage.message_id }, 'Failed to edit mirrored message in topic');
    return false;
  }
}

export async function editMirroredSupportMessage(
  api: Api,
  editedMessage: Message,
  userId: string,
  userTgId: bigint
): Promise<boolean> {
  const mapping = await messageRepository.findByTopicMessageId(userId, editedMessage.message_id);
  if (!mapping) {
    logger.debug({ messageId: editedMessage.message_id, userId }, 'No mapping found for edited support message');
    return false;
  }

  try {
    const chatId = Number(userTgId);

    if (editedMessage.text) {
      await api.editMessageText(chatId, mapping.dmMessageId, editedMessage.text);
    } else if (editedMessage.caption !== undefined) {
      await api.editMessageCaption(chatId, mapping.dmMessageId, {
        caption: editedMessage.caption,
      });
    } else {
      logger.debug({ messageId: editedMessage.message_id }, 'Edited support message has no editable content');
      return false;
    }

    logger.info(
      { topicMessageId: editedMessage.message_id, dmMessageId: mapping.dmMessageId },
      'Support message edit mirrored to DM'
    );
    return true;
  } catch (error) {
    logger.error({ error, messageId: editedMessage.message_id }, 'Failed to edit mirrored message in DM');
    return false;
  }
}

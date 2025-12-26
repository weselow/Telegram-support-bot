import type { Api } from 'grammy';
import type { Message } from 'grammy/types';
import { messageRepository } from '../db/repositories/message.repository.js';
import { logger } from '../utils/logger.js';

interface SendOptions {
  message_thread_id: number;
  caption?: string;
}

type MessageSender = (
  api: Api,
  message: Message,
  groupId: number,
  topicId: number
) => Promise<Message | null>;

function buildOptions(topicId: number, caption?: string): SendOptions {
  const options: SendOptions = { message_thread_id: topicId };
  if (caption) {
    options.caption = caption;
  }
  return options;
}

const sendText: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.text) return null;
  return api.sendMessage(groupId, msg.text, { message_thread_id: topicId });
};

const sendPhoto: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.photo || msg.photo.length === 0) return null;
  const photo = msg.photo[msg.photo.length - 1];
  if (!photo) {
    logger.warn({ messageId: msg.message_id }, 'Photo array empty unexpectedly');
    return null;
  }
  return api.sendPhoto(groupId, photo.file_id, buildOptions(topicId, msg.caption));
};

const sendVideo: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.video) return null;
  return api.sendVideo(groupId, msg.video.file_id, buildOptions(topicId, msg.caption));
};

const sendDocument: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.document) return null;
  return api.sendDocument(groupId, msg.document.file_id, buildOptions(topicId, msg.caption));
};

const sendVoice: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.voice) return null;
  return api.sendVoice(groupId, msg.voice.file_id, { message_thread_id: topicId });
};

const sendAudio: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.audio) return null;
  return api.sendAudio(groupId, msg.audio.file_id, buildOptions(topicId, msg.caption));
};

const sendVideoNote: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.video_note) return null;
  return api.sendVideoNote(groupId, msg.video_note.file_id, { message_thread_id: topicId });
};

const sendSticker: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.sticker) return null;
  return api.sendSticker(groupId, msg.sticker.file_id, { message_thread_id: topicId });
};

const sendAnimation: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.animation) return null;
  return api.sendAnimation(groupId, msg.animation.file_id, buildOptions(topicId, msg.caption));
};

const sendContact: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.contact) return null;
  return api.sendContact(groupId, msg.contact.phone_number, msg.contact.first_name, {
    message_thread_id: topicId,
  });
};

const sendLocation: MessageSender = async (api, msg, groupId, topicId) => {
  if (!msg.location) return null;
  return api.sendLocation(groupId, msg.location.latitude, msg.location.longitude, {
    message_thread_id: topicId,
  });
};

const messageSenders: MessageSender[] = [
  sendText,
  sendPhoto,
  sendVideo,
  sendDocument,
  sendVoice,
  sendAudio,
  sendVideoNote,
  sendSticker,
  sendAnimation,
  sendContact,
  sendLocation,
];

export async function mirrorUserMessage(
  api: Api,
  message: Message,
  userId: string,
  topicId: number,
  supportGroupId: number
): Promise<number | null> {
  let sentMessage: Message | null = null;

  for (const sender of messageSenders) {
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

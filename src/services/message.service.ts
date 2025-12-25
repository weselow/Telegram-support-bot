import type { Api } from 'grammy';
import type { Message } from 'grammy/types';
import { messageRepository } from '../db/repositories/message.repository.js';

interface SendOptions {
  message_thread_id: number;
  caption?: string;
}

function buildOptions(topicId: number, caption?: string): SendOptions {
  const options: SendOptions = { message_thread_id: topicId };
  if (caption) {
    options.caption = caption;
  }
  return options;
}

export async function mirrorUserMessage(
  api: Api,
  message: Message,
  userId: string,
  topicId: number,
  supportGroupId: number
): Promise<number | null> {
  let sentMessage: Message | null = null;

  if (message.text) {
    sentMessage = await api.sendMessage(supportGroupId, message.text, {
      message_thread_id: topicId,
    });
  } else if (message.photo && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1];
    if (!largestPhoto) {
      return null;
    }
    sentMessage = await api.sendPhoto(
      supportGroupId,
      largestPhoto.file_id,
      buildOptions(topicId, message.caption)
    );
  } else if (message.video) {
    sentMessage = await api.sendVideo(
      supportGroupId,
      message.video.file_id,
      buildOptions(topicId, message.caption)
    );
  } else if (message.document) {
    sentMessage = await api.sendDocument(
      supportGroupId,
      message.document.file_id,
      buildOptions(topicId, message.caption)
    );
  } else if (message.voice) {
    sentMessage = await api.sendVoice(supportGroupId, message.voice.file_id, {
      message_thread_id: topicId,
    });
  } else if (message.sticker) {
    sentMessage = await api.sendSticker(supportGroupId, message.sticker.file_id, {
      message_thread_id: topicId,
    });
  } else if (message.animation) {
    sentMessage = await api.sendAnimation(
      supportGroupId,
      message.animation.file_id,
      buildOptions(topicId, message.caption)
    );
  } else if (message.contact) {
    sentMessage = await api.sendContact(
      supportGroupId,
      message.contact.phone_number,
      message.contact.first_name,
      { message_thread_id: topicId }
    );
  } else if (message.location) {
    sentMessage = await api.sendLocation(
      supportGroupId,
      message.location.latitude,
      message.location.longitude,
      { message_thread_id: topicId }
    );
  } else if (message.audio) {
    sentMessage = await api.sendAudio(
      supportGroupId,
      message.audio.file_id,
      buildOptions(topicId, message.caption)
    );
  } else if (message.video_note) {
    sentMessage = await api.sendVideoNote(supportGroupId, message.video_note.file_id, {
      message_thread_id: topicId,
    });
  }

  if (!sentMessage) {
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

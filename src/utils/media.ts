import type { Message } from 'grammy/types';
import type { MediaType } from '../generated/prisma/client.js';

/**
 * Вложение сообщения: короткая подпись для истории и ссылка на файл Telegram,
 * чтобы веб-чат открывал вложение через /api/media/:fileId.
 */
interface MediaContent {
  placeholder: string;
  mediaFileId?: string | undefined;
  mediaType?: MediaType | undefined;
  mediaDuration?: number | undefined;
}

export interface StoredContent {
  text: string;
  mediaFileId?: string | undefined;
  mediaType?: MediaType | undefined;
  mediaDuration?: number | undefined;
}

const mediaReaders: ((msg: Message) => MediaContent | null)[] = [
  (msg) => {
    const photo = msg.photo;
    const largest = photo && photo.length > 0 ? photo[photo.length - 1] : undefined;
    return largest
      ? { placeholder: '[Изображение]', mediaFileId: largest.file_id, mediaType: 'IMAGE' }
      : null;
  },
  (msg) =>
    msg.voice
      ? {
          placeholder: '[Голосовое сообщение]',
          mediaFileId: msg.voice.file_id,
          mediaType: 'VOICE',
          mediaDuration: msg.voice.duration,
        }
      : null,
  (msg) =>
    msg.video
      ? { placeholder: '[Видео]', mediaFileId: msg.video.file_id, mediaType: 'VIDEO' }
      : null,
  (msg) =>
    msg.document
      ? { placeholder: '[Документ]', mediaFileId: msg.document.file_id, mediaType: 'DOCUMENT' }
      : null,
  (msg) =>
    msg.audio
      ? { placeholder: '[Аудиозапись]', mediaFileId: msg.audio.file_id, mediaType: 'AUDIO' }
      : null,
  (msg) =>
    msg.video_note
      ? {
          placeholder: '[Видеосообщение]',
          mediaFileId: msg.video_note.file_id,
          mediaType: 'VIDEO_NOTE',
        }
      : null,
  (msg) =>
    msg.sticker
      ? { placeholder: '[Стикер]', mediaFileId: msg.sticker.file_id, mediaType: 'STICKER' }
      : null,
  (msg) =>
    msg.animation
      ? { placeholder: '[Анимация]', mediaFileId: msg.animation.file_id, mediaType: 'ANIMATION' }
      : null,
  (msg) => (msg.contact ? { placeholder: '[Контакт]' } : null),
  (msg) => (msg.location ? { placeholder: '[Геопозиция]' } : null),
];

/**
 * Собрать то, что попадёт в историю: текст сообщения либо подпись вложения,
 * а если нет ни того ни другого — короткую заглушку по типу вложения.
 */
export function extractStoredContent(message: Message): StoredContent {
  let media: MediaContent | null = null;
  for (const read of mediaReaders) {
    media = read(message);
    if (media) break;
  }

  return {
    text: message.text ?? message.caption ?? media?.placeholder ?? '',
    mediaFileId: media?.mediaFileId,
    mediaType: media?.mediaType,
    mediaDuration: media?.mediaDuration,
  };
}

/**
 * Вложение в том виде, в каком его ждёт виджет: картинка рисуется тегом img,
 * голосовое — проигрывателем, всё остальное — ссылкой на файл.
 */
export interface MediaUrls {
  imageUrl?: string | undefined;
  voiceUrl?: string | undefined;
  fileUrl?: string | undefined;
  voiceDuration?: number | undefined;
}

interface StoredMedia {
  mediaFileId?: string | null | undefined;
  mediaType?: MediaType | null | undefined;
  mediaDuration?: number | null | undefined;
}

/**
 * Разложить сохранённое вложение по полям виджета.
 * Записи без типа сделаны до его появления в схеме — отдаём их ссылкой:
 * ссылка работает для любого файла, а тег img на документе даёт битую картинку.
 */
export function buildMediaUrls(media: StoredMedia): MediaUrls {
  if (!media.mediaFileId) {
    return {};
  }

  const url = `/api/media/${media.mediaFileId}`;

  if (media.mediaType === 'IMAGE') {
    return { imageUrl: url };
  }

  if (media.mediaType === 'VOICE') {
    return { voiceUrl: url, voiceDuration: media.mediaDuration ?? undefined };
  }

  return { fileUrl: url };
}

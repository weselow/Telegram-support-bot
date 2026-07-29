-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VOICE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'ANIMATION', 'VIDEO_NOTE');

-- AlterTable
ALTER TABLE "messages_map" ADD COLUMN     "media_type" "MediaType";

-- Заполнение уже накопленных записей: тип вложения восстанавливается по заглушке в тексте.
-- Голосовые узнаются по длительности, файлы из веб-чата — по значку скрепки в тексте.
-- Записи с подписью вместо заглушки останутся без типа: веб-чат покажет их ссылкой на файл.
UPDATE "messages_map" SET "media_type" = 'VOICE'
  WHERE "media_file_id" IS NOT NULL AND "media_duration" IS NOT NULL;

UPDATE "messages_map" SET "media_type" = 'IMAGE'
  WHERE "media_file_id" IS NOT NULL AND "media_type" IS NULL
    AND ("text" = '[Изображение]' OR "text" = '');

UPDATE "messages_map" SET "media_type" = 'VIDEO'
  WHERE "media_file_id" IS NOT NULL AND "media_type" IS NULL AND "text" = '[Видео]';

UPDATE "messages_map" SET "media_type" = 'AUDIO'
  WHERE "media_file_id" IS NOT NULL AND "media_type" IS NULL AND "text" = '[Аудиозапись]';

UPDATE "messages_map" SET "media_type" = 'VIDEO_NOTE'
  WHERE "media_file_id" IS NOT NULL AND "media_type" IS NULL AND "text" = '[Видеосообщение]';

UPDATE "messages_map" SET "media_type" = 'STICKER'
  WHERE "media_file_id" IS NOT NULL AND "media_type" IS NULL AND "text" = '[Стикер]';

UPDATE "messages_map" SET "media_type" = 'ANIMATION'
  WHERE "media_file_id" IS NOT NULL AND "media_type" IS NULL AND "text" = '[Анимация]';

UPDATE "messages_map" SET "media_type" = 'DOCUMENT'
  WHERE "media_file_id" IS NOT NULL AND "media_type" IS NULL
    AND ("text" = '[Документ]' OR "text" LIKE '📎%');

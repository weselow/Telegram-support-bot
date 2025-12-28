-- Web Chat API Support Migration
-- Добавляет поддержку веб-чата: webSessionId, MessageChannel, WebLinkToken

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('TELEGRAM', 'WEB');

-- AlterTable: users
-- tgUserId, tgFirstName, topicId становятся nullable для web-only пользователей
ALTER TABLE "users" ADD COLUMN     "web_session_id" TEXT,
ALTER COLUMN "tg_user_id" DROP NOT NULL,
ALTER COLUMN "tg_first_name" DROP NOT NULL,
ALTER COLUMN "topic_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_web_session_id_key" ON "users"("web_session_id");

-- AlterTable: messages_map
-- dmMessageId, topicMessageId становятся nullable; добавлены channel и text
ALTER TABLE "messages_map" ADD COLUMN     "channel" "MessageChannel" NOT NULL DEFAULT 'TELEGRAM',
ADD COLUMN     "text" TEXT,
ALTER COLUMN "dm_message_id" DROP NOT NULL,
ALTER COLUMN "topic_message_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "messages_map_user_id_idx" ON "messages_map"("user_id");

-- CreateTable: web_link_tokens
CREATE TABLE "web_link_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "web_link_tokens_token_key" ON "web_link_tokens"("token");
CREATE INDEX "web_link_tokens_token_idx" ON "web_link_tokens"("token");
CREATE INDEX "web_link_tokens_expires_at_idx" ON "web_link_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "web_link_tokens" ADD CONSTRAINT "web_link_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_CLIENT', 'CLOSED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('OPENED', 'REOPENED', 'CLOSED', 'STATUS_CHANGED', 'PHONE_UPDATED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('USER_TO_SUPPORT', 'SUPPORT_TO_USER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tg_user_id" BIGINT NOT NULL,
    "tg_username" TEXT,
    "tg_first_name" TEXT NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "phone" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "question" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_map" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dm_message_id" INTEGER NOT NULL,
    "topic_message_id" INTEGER NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_tg_user_id_key" ON "users"("tg_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_topic_id_key" ON "users"("topic_id");

-- CreateIndex
CREATE INDEX "ticket_events_user_id_idx" ON "ticket_events"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_map_user_id_dm_message_id_key" ON "messages_map"("user_id", "dm_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_map_user_id_topic_message_id_key" ON "messages_map"("user_id", "topic_message_id");

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages_map" ADD CONSTRAINT "messages_map_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

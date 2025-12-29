import type { MessageMap, MessageDirection, MessageChannel } from '../../generated/prisma/client.js';
import { prisma } from '../client.js';

export interface CreateMessageMapData {
  userId: string;
  dmMessageId: number;
  topicMessageId: number;
  direction: MessageDirection;
}

export interface CreateWebMessageData {
  userId: string;
  topicMessageId?: number | undefined;
  direction: MessageDirection;
  channel: MessageChannel;
  text: string;
  mediaFileId?: string | undefined;
  mediaDuration?: number | undefined;
}

export interface GetHistoryOptions {
  limit?: number | undefined;
  before?: string | undefined;
  after?: string | undefined;
}

export const messageRepository = {
  async create(data: CreateMessageMapData): Promise<MessageMap> {
    return prisma.messageMap.create({
      data: {
        userId: data.userId,
        dmMessageId: data.dmMessageId,
        topicMessageId: data.topicMessageId,
        direction: data.direction,
      },
    });
  },

  async findByDmMessageId(userId: string, dmMessageId: number): Promise<MessageMap | null> {
    return prisma.messageMap.findUnique({
      where: {
        userId_dmMessageId: {
          userId,
          dmMessageId,
        },
      },
    });
  },

  async findByTopicMessageId(userId: string, topicMessageId: number): Promise<MessageMap | null> {
    return prisma.messageMap.findUnique({
      where: {
        userId_topicMessageId: {
          userId,
          topicMessageId,
        },
      },
    });
  },

  // Web chat methods
  async createWebMessage(data: CreateWebMessageData): Promise<MessageMap> {
    return prisma.messageMap.create({
      data: {
        userId: data.userId,
        topicMessageId: data.topicMessageId ?? null,
        direction: data.direction,
        channel: data.channel,
        text: data.text,
        mediaFileId: data.mediaFileId ?? null,
        mediaDuration: data.mediaDuration ?? null,
      },
    });
  },

  async getHistory(userId: string, options: GetHistoryOptions = {}): Promise<MessageMap[]> {
    const { limit = 50, before, after } = options;

    const where: { userId: string; id?: { lt?: string; gt?: string } } = { userId };

    if (before) {
      where.id = { lt: before };
    } else if (after) {
      where.id = { gt: after };
    }

    return prisma.messageMap.findMany({
      where,
      orderBy: { createdAt: after ? 'asc' : 'desc' },
      take: Math.min(limit, 100),
    });
  },

  async findById(id: string): Promise<MessageMap | null> {
    return prisma.messageMap.findUnique({
      where: { id },
    });
  },
};

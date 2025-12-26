import type { MessageMap, MessageDirection } from '../../generated/prisma/client.js';
import { prisma } from '../client.js';

export interface CreateMessageMapData {
  userId: string;
  dmMessageId: number;
  topicMessageId: number;
  direction: MessageDirection;
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
};

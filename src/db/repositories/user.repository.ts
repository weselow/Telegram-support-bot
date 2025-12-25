import type { User, TicketStatus } from '../../generated/prisma/client.js';
import { prisma } from '../client.js';

export interface CreateUserData {
  tgUserId: bigint;
  tgUsername: string | null;
  tgFirstName: string;
  topicId: number;
  sourceUrl?: string | undefined;
}

export const userRepository = {
  async findByTgUserId(tgUserId: bigint): Promise<User | null> {
    return prisma.user.findUnique({
      where: { tgUserId },
    });
  },

  async create(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        tgUserId: data.tgUserId,
        tgUsername: data.tgUsername,
        tgFirstName: data.tgFirstName,
        topicId: data.topicId,
        sourceUrl: data.sourceUrl ?? null,
      },
    });
  },

  async updateStatus(id: string, status: TicketStatus): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { status },
    });
  },

  async findByTopicId(topicId: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { topicId },
    });
  },
};

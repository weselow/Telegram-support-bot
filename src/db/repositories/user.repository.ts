import type { User, TicketStatus } from '../../generated/prisma/client.js';
import { prisma } from '../client.js';

export interface CreateUserData {
  tgUserId: bigint;
  tgUsername: string | null;
  tgFirstName: string;
  topicId: number;
  sourceUrl?: string | undefined;
  sourceCity?: string | undefined;
}

export interface CreateWebUserData {
  webSessionId: string;
  sourceUrl?: string | undefined;
  sourceCity?: string | undefined;
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
        sourceCity: data.sourceCity ?? null,
      },
    });
  },

  async updateStatus(id: string, status: TicketStatus): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { status },
    });
  },

  async updateCardMessageId(id: string, cardMessageId: number): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { cardMessageId },
    });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  async findByTopicId(topicId: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { topicId },
    });
  },

  async updatePhone(id: string, phone: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { phone },
    });
  },

  async updateSourceUrl(id: string, sourceUrl: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { sourceUrl },
    });
  },

  // Web chat methods
  async findByWebSessionId(webSessionId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { webSessionId },
    });
  },

  async createWebUser(data: CreateWebUserData): Promise<User> {
    return prisma.user.create({
      data: {
        webSessionId: data.webSessionId,
        sourceUrl: data.sourceUrl ?? null,
        sourceCity: data.sourceCity ?? null,
      },
    });
  },

  async linkTelegramAccount(
    userId: string,
    tgUserId: bigint,
    tgUsername: string | null,
    tgFirstName: string
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tgUserId,
        tgUsername,
        tgFirstName,
      },
    });
  },

  async linkWebSession(userId: string, webSessionId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { webSessionId },
    });
  },

  async updateTopicId(id: string, topicId: number): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { topicId },
    });
  },
};

import type { WebLinkToken } from '../../generated/prisma/client.js';
import { prisma } from '../client.js';
import { randomBytes } from 'crypto';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export const webLinkTokenRepository = {
  async create(userId: string): Promise<WebLinkToken> {
    const token = `link_${randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    return prisma.webLinkToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  },

  async findByToken(token: string): Promise<WebLinkToken | null> {
    return prisma.webLinkToken.findUnique({
      where: { token },
    });
  },

  async findValidByToken(token: string): Promise<WebLinkToken | null> {
    return prisma.webLinkToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });
  },

  async markUsed(id: string): Promise<WebLinkToken> {
    return prisma.webLinkToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },

  async deleteExpired(): Promise<number> {
    const result = await prisma.webLinkToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });
    return result.count;
  },
};

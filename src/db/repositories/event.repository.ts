import type { TicketEvent, EventType } from '../../generated/prisma/client.js';
import { prisma } from '../client.js';

export interface CreateEventData {
  userId: string;
  eventType: EventType;
  oldValue?: string | undefined;
  newValue?: string | undefined;
  question?: string | undefined;
  sourceUrl?: string | undefined;
}

export const eventRepository = {
  async create(data: CreateEventData): Promise<TicketEvent> {
    return prisma.ticketEvent.create({
      data: {
        userId: data.userId,
        eventType: data.eventType,
        oldValue: data.oldValue ?? null,
        newValue: data.newValue ?? null,
        question: data.question ?? null,
        sourceUrl: data.sourceUrl ?? null,
      },
    });
  },

  async findByUserId(userId: string): Promise<TicketEvent[]> {
    return prisma.ticketEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },
};

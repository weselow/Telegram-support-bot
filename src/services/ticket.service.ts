import type { User } from '../generated/prisma/client.js';
import { userRepository } from '../db/repositories/user.repository.js';
import { eventRepository } from '../db/repositories/event.repository.js';
import { logger } from '../utils/logger.js';

export interface CreateTicketData {
  tgUserId: bigint;
  tgUsername: string | null;
  tgFirstName: string;
  topicId: number;
  sourceUrl?: string | undefined;
  question?: string | undefined;
}

export async function findUserByTgId(tgUserId: bigint): Promise<User | null> {
  return userRepository.findByTgUserId(tgUserId);
}

export async function createTicket(data: CreateTicketData): Promise<User> {
  logger.info({ tgUserId: data.tgUserId.toString() }, 'Creating new ticket');

  const user = await userRepository.create({
    tgUserId: data.tgUserId,
    tgUsername: data.tgUsername,
    tgFirstName: data.tgFirstName,
    topicId: data.topicId,
    sourceUrl: data.sourceUrl,
  });

  await eventRepository.create({
    userId: user.id,
    eventType: 'OPENED',
    question: data.question,
    sourceUrl: data.sourceUrl,
  });

  logger.info(
    { tgUserId: data.tgUserId.toString(), ticketId: user.id },
    'Ticket created'
  );

  return user;
}

export async function findUserByTopicId(topicId: number): Promise<User | null> {
  return userRepository.findByTopicId(topicId);
}

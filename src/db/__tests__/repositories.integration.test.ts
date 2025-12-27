import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  testPrisma,
  connectTestDatabase,
  disconnectTestDatabase,
  cleanDatabase,
} from './test-client.js';

describe('Repositories Integration Tests', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('User Repository', () => {
    it('should create and find user by tgUserId', async () => {
      const user = await testPrisma.user.create({
        data: {
          tgUserId: BigInt(123456789),
          tgUsername: 'testuser',
          tgFirstName: 'Test',
          topicId: 100,
        },
      });

      const found = await testPrisma.user.findUnique({
        where: { tgUserId: BigInt(123456789) },
      });

      expect(found).not.toBeNull();
      expect(found?.id).toBe(user.id);
      expect(found?.tgFirstName).toBe('Test');
    });

    it('should find user by topicId', async () => {
      await testPrisma.user.create({
        data: {
          tgUserId: BigInt(111222333),
          tgUsername: null,
          tgFirstName: 'Jane',
          topicId: 200,
        },
      });

      const found = await testPrisma.user.findUnique({
        where: { topicId: 200 },
      });

      expect(found).not.toBeNull();
      expect(found?.tgFirstName).toBe('Jane');
    });

    it('should update user status', async () => {
      const user = await testPrisma.user.create({
        data: {
          tgUserId: BigInt(444555666),
          tgFirstName: 'Bob',
          topicId: 300,
        },
      });

      expect(user.status).toBe('NEW');

      const updated = await testPrisma.user.update({
        where: { id: user.id },
        data: { status: 'IN_PROGRESS' },
      });

      expect(updated.status).toBe('IN_PROGRESS');
    });

    it('should update user phone', async () => {
      const user = await testPrisma.user.create({
        data: {
          tgUserId: BigInt(777888999),
          tgFirstName: 'Alice',
          topicId: 400,
        },
      });

      expect(user.phone).toBeNull();

      const updated = await testPrisma.user.update({
        where: { id: user.id },
        data: { phone: '+79001234567' },
      });

      expect(updated.phone).toBe('+79001234567');
    });

    it('should handle BigInt correctly', async () => {
      const largeTgId = BigInt('9223372036854775807'); // Max BigInt

      const user = await testPrisma.user.create({
        data: {
          tgUserId: largeTgId,
          tgFirstName: 'BigUser',
          topicId: 500,
        },
      });

      const found = await testPrisma.user.findUnique({
        where: { tgUserId: largeTgId },
      });

      expect(found?.tgUserId).toBe(largeTgId);
    });

    it('should store sourceUrl and sourceCity', async () => {
      const user = await testPrisma.user.create({
        data: {
          tgUserId: BigInt(101010),
          tgFirstName: 'Visitor',
          topicId: 600,
          sourceUrl: 'https://example.com/product/123',
          sourceCity: 'Москва',
        },
      });

      expect(user.sourceUrl).toBe('https://example.com/product/123');
      expect(user.sourceCity).toBe('Москва');
    });
  });

  describe('MessageMap Repository', () => {
    let testUserId: string;

    beforeEach(async () => {
      await cleanDatabase();
      const user = await testPrisma.user.create({
        data: {
          tgUserId: BigInt(999888777),
          tgFirstName: 'MsgUser',
          topicId: 700,
        },
      });
      testUserId = user.id;
    });

    it('should create message mapping', async () => {
      const mapping = await testPrisma.messageMap.create({
        data: {
          userId: testUserId,
          dmMessageId: 1,
          topicMessageId: 100,
          direction: 'USER_TO_SUPPORT',
        },
      });

      expect(mapping.dmMessageId).toBe(1);
      expect(mapping.topicMessageId).toBe(100);
      expect(mapping.direction).toBe('USER_TO_SUPPORT');
    });

    it('should find by dmMessageId (composite unique)', async () => {
      await testPrisma.messageMap.create({
        data: {
          userId: testUserId,
          dmMessageId: 5,
          topicMessageId: 500,
          direction: 'USER_TO_SUPPORT',
        },
      });

      const found = await testPrisma.messageMap.findUnique({
        where: {
          userId_dmMessageId: {
            userId: testUserId,
            dmMessageId: 5,
          },
        },
      });

      expect(found).not.toBeNull();
      expect(found?.topicMessageId).toBe(500);
    });

    it('should find by topicMessageId (composite unique)', async () => {
      await testPrisma.messageMap.create({
        data: {
          userId: testUserId,
          dmMessageId: 10,
          topicMessageId: 1000,
          direction: 'SUPPORT_TO_USER',
        },
      });

      const found = await testPrisma.messageMap.findUnique({
        where: {
          userId_topicMessageId: {
            userId: testUserId,
            topicMessageId: 1000,
          },
        },
      });

      expect(found).not.toBeNull();
      expect(found?.dmMessageId).toBe(10);
      expect(found?.direction).toBe('SUPPORT_TO_USER');
    });

    it('should cascade delete when user is deleted', async () => {
      await testPrisma.messageMap.create({
        data: {
          userId: testUserId,
          dmMessageId: 20,
          topicMessageId: 200,
          direction: 'USER_TO_SUPPORT',
        },
      });

      await testPrisma.user.delete({ where: { id: testUserId } });

      const messages = await testPrisma.messageMap.findMany({
        where: { userId: testUserId },
      });

      expect(messages).toHaveLength(0);
    });
  });

  describe('TicketEvent Repository', () => {
    let testUserId: string;

    beforeEach(async () => {
      await cleanDatabase();
      const user = await testPrisma.user.create({
        data: {
          tgUserId: BigInt(666555444),
          tgFirstName: 'EventUser',
          topicId: 800,
        },
      });
      testUserId = user.id;
    });

    it('should create event with all fields', async () => {
      const event = await testPrisma.ticketEvent.create({
        data: {
          userId: testUserId,
          eventType: 'OPENED',
          question: 'Как заказать товар?',
          sourceUrl: 'https://shop.example.com/item/42',
        },
      });

      expect(event.eventType).toBe('OPENED');
      expect(event.question).toBe('Как заказать товар?');
      expect(event.sourceUrl).toBe('https://shop.example.com/item/42');
    });

    it('should create status change event', async () => {
      const event = await testPrisma.ticketEvent.create({
        data: {
          userId: testUserId,
          eventType: 'STATUS_CHANGED',
          oldValue: 'NEW',
          newValue: 'IN_PROGRESS',
        },
      });

      expect(event.eventType).toBe('STATUS_CHANGED');
      expect(event.oldValue).toBe('NEW');
      expect(event.newValue).toBe('IN_PROGRESS');
    });

    it('should find events by userId ordered by createdAt desc', async () => {
      await testPrisma.ticketEvent.create({
        data: { userId: testUserId, eventType: 'OPENED' },
      });

      await testPrisma.ticketEvent.create({
        data: { userId: testUserId, eventType: 'STATUS_CHANGED' },
      });

      await testPrisma.ticketEvent.create({
        data: { userId: testUserId, eventType: 'CLOSED' },
      });

      const events = await testPrisma.ticketEvent.findMany({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' },
      });

      expect(events).toHaveLength(3);
      expect(events[0]?.eventType).toBe('CLOSED');
      expect(events[2]?.eventType).toBe('OPENED');
    });

    it('should cascade delete when user is deleted', async () => {
      await testPrisma.ticketEvent.create({
        data: { userId: testUserId, eventType: 'OPENED' },
      });

      await testPrisma.user.delete({ where: { id: testUserId } });

      const events = await testPrisma.ticketEvent.findMany({
        where: { userId: testUserId },
      });

      expect(events).toHaveLength(0);
    });
  });
});

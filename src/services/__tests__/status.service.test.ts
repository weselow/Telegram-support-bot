import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { User } from '../../generated/prisma/client.js';
import { reopenTicket } from '../status.service.js';
import { messages } from '../../config/messages.js';

const SUPPORT_GROUP_ID = -1001234567890;
const TOPIC_ID = 342;

vi.mock('../../config/env.js', () => ({
  env: {
    SUPPORT_GROUP_ID: '-1001234567890',
  },
}));

vi.mock('../../db/repositories/user.repository.js', () => ({
  userRepository: {
    updateStatus: vi.fn(),
  },
}));

vi.mock('../../db/repositories/event.repository.js', () => ({
  eventRepository: {
    create: vi.fn(),
  },
}));

vi.mock('../topic.service.js', () => ({
  updateTicketCard: vi.fn(),
}));

vi.mock('../sla.service.js', () => ({
  startSlaTimers: vi.fn(),
  cancelAllSlaTimers: vi.fn(),
}));

vi.mock('../../http/ws/connection-manager.js', () => ({
  sendToUser: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function buildUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    status: 'CLOSED',
    topicId: TOPIC_ID,
    webSessionId: null,
    cardMessageId: null,
    tgUserId: null,
    tgUsername: null,
    tgFirstName: null,
    phone: null,
    sourceUrl: null,
    createdAt: new Date('2026-07-29T10:00:00Z'),
    ...overrides,
  } as User;
}

describe('status.service', () => {
  let updateStatus: Mock;
  let createEvent: Mock;
  let startSlaTimers: Mock;
  let cancelAllSlaTimers: Mock;
  let api: { sendMessage: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();

    const userRepo = await import('../../db/repositories/user.repository.js');
    updateStatus = userRepo.userRepository.updateStatus as Mock;

    const eventRepo = await import('../../db/repositories/event.repository.js');
    createEvent = eventRepo.eventRepository.create as Mock;

    const slaService = await import('../sla.service.js');
    startSlaTimers = slaService.startSlaTimers as Mock;
    cancelAllSlaTimers = slaService.cancelAllSlaTimers as Mock;

    // clearAllMocks сбрасывает вызовы, но не заглушенное поведение,
    // поэтому удачный путь задаётся заново перед каждой проверкой
    updateStatus.mockResolvedValue(undefined);
    createEvent.mockResolvedValue(undefined);

    api = { sendMessage: vi.fn() };
  });

  describe('reopenTicket', () => {
    it('should move a closed ticket back to NEW', async () => {
      const user = buildUser({ status: 'CLOSED' });

      const reopened = await reopenTicket(api as never, user, TOPIC_ID);

      expect(reopened).toBe(true);
      expect(updateStatus).toHaveBeenCalledWith('user-1', 'NEW');
      expect(createEvent).toHaveBeenCalledWith({
        userId: 'user-1',
        eventType: 'REOPENED',
        oldValue: 'CLOSED',
        newValue: 'NEW',
      });
    });

    it('should notify the support topic about the reopen', async () => {
      const user = buildUser({ status: 'CLOSED' });

      await reopenTicket(api as never, user, TOPIC_ID);

      expect(api.sendMessage).toHaveBeenCalledWith(SUPPORT_GROUP_ID, messages.reopened, {
        message_thread_id: TOPIC_ID,
      });
    });

    it('should restart SLA timers from scratch', async () => {
      const user = buildUser({ status: 'CLOSED' });

      await reopenTicket(api as never, user, TOPIC_ID);

      expect(cancelAllSlaTimers).toHaveBeenCalledWith('user-1', TOPIC_ID);
      expect(startSlaTimers).toHaveBeenCalledWith('user-1', TOPIC_ID);

      const cancelOrder = cancelAllSlaTimers.mock.invocationCallOrder[0] ?? 0;
      const startOrder = startSlaTimers.mock.invocationCallOrder[0] ?? 0;
      expect(cancelOrder).toBeLessThan(startOrder);
    });

    it('should do nothing when the ticket is not closed', async () => {
      const user = buildUser({ status: 'IN_PROGRESS' });

      const reopened = await reopenTicket(api as never, user, TOPIC_ID);

      expect(reopened).toBe(false);
      expect(updateStatus).not.toHaveBeenCalled();
      expect(api.sendMessage).not.toHaveBeenCalled();
      expect(cancelAllSlaTimers).not.toHaveBeenCalled();
      expect(startSlaTimers).not.toHaveBeenCalled();
    });

    it('should do nothing when the status change failed', async () => {
      updateStatus.mockRejectedValue(new Error('Database unavailable'));
      const user = buildUser({ status: 'CLOSED' });

      const reopened = await reopenTicket(api as never, user, TOPIC_ID);

      expect(reopened).toBe(false);
      expect(api.sendMessage).not.toHaveBeenCalled();
      expect(cancelAllSlaTimers).not.toHaveBeenCalled();
      expect(startSlaTimers).not.toHaveBeenCalled();
    });

    it('should let a failed topic notification reach the caller', async () => {
      api.sendMessage.mockRejectedValue(new Error('Topic deleted'));
      const user = buildUser({ status: 'CLOSED' });

      await expect(reopenTicket(api as never, user, TOPIC_ID)).rejects.toThrow('Topic deleted');
    });
  });
});

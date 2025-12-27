import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { findUserByTgId, createTicket, findUserByTopicId } from '../ticket.service.js';

// Mock repositories
vi.mock('../../db/repositories/user.repository.js', () => ({
  userRepository: {
    findByTgUserId: vi.fn(),
    findByTopicId: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../db/repositories/event.repository.js', () => ({
  eventRepository: {
    create: vi.fn(),
  },
}));

describe('TicketService', () => {
  let userRepository: {
    findByTgUserId: Mock;
    findByTopicId: Mock;
    create: Mock;
  };
  let eventRepository: { create: Mock };

  beforeEach(async () => {
    vi.clearAllMocks();

    const userRepo = await import('../../db/repositories/user.repository.js');
    const eventRepo = await import('../../db/repositories/event.repository.js');

    userRepository = userRepo.userRepository as typeof userRepository;
    eventRepository = eventRepo.eventRepository as typeof eventRepository;
  });

  describe('findUserByTgId', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-1',
        tgUserId: BigInt(123456),
        tgFirstName: 'John',
      };
      userRepository.findByTgUserId.mockResolvedValue(mockUser);

      const result = await findUserByTgId(BigInt(123456));

      expect(result).toEqual(mockUser);
      expect(userRepository.findByTgUserId).toHaveBeenCalledWith(BigInt(123456));
    });

    it('should return null when user not found', async () => {
      userRepository.findByTgUserId.mockResolvedValue(null);

      const result = await findUserByTgId(BigInt(999999));

      expect(result).toBeNull();
    });
  });

  describe('findUserByTopicId', () => {
    it('should return user when found by topic', async () => {
      const mockUser = {
        id: 'user-1',
        topicId: 100,
        tgFirstName: 'Jane',
      };
      userRepository.findByTopicId.mockResolvedValue(mockUser);

      const result = await findUserByTopicId(100);

      expect(result).toEqual(mockUser);
      expect(userRepository.findByTopicId).toHaveBeenCalledWith(100);
    });

    it('should return null when topic not found', async () => {
      userRepository.findByTopicId.mockResolvedValue(null);

      const result = await findUserByTopicId(999);

      expect(result).toBeNull();
    });
  });

  describe('createTicket', () => {
    const ticketData = {
      tgUserId: BigInt(123456),
      tgUsername: 'johndoe',
      tgFirstName: 'John',
      topicId: 100,
      sourceUrl: 'https://example.com/product',
      sourceCity: 'Moscow',
      question: 'How much does it cost?',
    };

    it('should create user and event', async () => {
      const mockUser = {
        id: 'user-1',
        ...ticketData,
      };
      userRepository.create.mockResolvedValue(mockUser);
      eventRepository.create.mockResolvedValue({});

      const result = await createTicket(ticketData);

      expect(result).toEqual(mockUser);
      expect(userRepository.create).toHaveBeenCalledWith({
        tgUserId: ticketData.tgUserId,
        tgUsername: ticketData.tgUsername,
        tgFirstName: ticketData.tgFirstName,
        topicId: ticketData.topicId,
        sourceUrl: ticketData.sourceUrl,
        sourceCity: ticketData.sourceCity,
      });
      expect(eventRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        eventType: 'OPENED',
        question: ticketData.question,
        sourceUrl: ticketData.sourceUrl,
      });
    });

    it('should create ticket without optional fields', async () => {
      const minimalData = {
        tgUserId: BigInt(123456),
        tgUsername: null,
        tgFirstName: 'John',
        topicId: 100,
      };
      const mockUser = { id: 'user-2', ...minimalData };
      userRepository.create.mockResolvedValue(mockUser);
      eventRepository.create.mockResolvedValue({});

      const result = await createTicket(minimalData);

      expect(result.id).toBe('user-2');
      expect(userRepository.create).toHaveBeenCalledWith({
        tgUserId: minimalData.tgUserId,
        tgUsername: null,
        tgFirstName: 'John',
        topicId: 100,
        sourceUrl: undefined,
        sourceCity: undefined,
      });
      expect(eventRepository.create).toHaveBeenCalledWith({
        userId: 'user-2',
        eventType: 'OPENED',
        question: undefined,
        sourceUrl: undefined,
      });
    });

    it('should propagate error if user creation fails', async () => {
      userRepository.create.mockRejectedValue(new Error('DB error'));

      await expect(createTicket(ticketData)).rejects.toThrow('DB error');
      expect(eventRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate error if event creation fails', async () => {
      const mockUser = { id: 'user-1', ...ticketData };
      userRepository.create.mockResolvedValue(mockUser);
      eventRepository.create.mockRejectedValue(new Error('Event DB error'));

      await expect(createTicket(ticketData)).rejects.toThrow('Event DB error');
    });
  });
});

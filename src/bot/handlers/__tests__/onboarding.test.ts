import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Context } from 'grammy';
import { handleOnboarding } from '../onboarding.js';
import { messages } from '../../../config/messages.js';

const SUPPORT_GROUP_ID = -1001234567890;

vi.mock('../../../config/env.js', () => ({
  env: {
    SUPPORT_GROUP_ID: '-1001234567890',
  },
}));

vi.mock('../../../services/onboarding.service.js', () => ({
  getOnboardingState: vi.fn(),
  setOnboardingState: vi.fn(),
  clearOnboardingState: vi.fn(),
}));

vi.mock('../../../services/ticket.service.js', () => ({
  findUserByTgId: vi.fn(),
  createTicket: vi.fn(),
}));

vi.mock('../../../services/topic.service.js', () => ({
  createTopic: vi.fn(),
  sendTicketCard: vi.fn(),
}));

vi.mock('../../../services/sla.service.js', () => ({
  startSlaTimers: vi.fn(),
}));

vi.mock('../../../services/message.service.js', () => ({
  mirrorUserMessage: vi.fn(),
}));

vi.mock('../../../db/repositories/user.repository.js', () => ({
  userRepository: {
    updateCardMessageId: vi.fn(),
    updateSourceUrl: vi.fn(),
  },
}));

vi.mock('../../../db/repositories/event.repository.js', () => ({
  eventRepository: {
    create: vi.fn(),
  },
}));

vi.mock('../../../config/sentry.js', () => ({
  captureError: vi.fn(),
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type MockContext = {
  from: { id: number; is_bot: boolean; first_name: string; username?: string };
  message: { message_id: number; text?: string };
  api: Record<string, Mock>;
  reply: Mock;
};

describe('onboarding', () => {
  let getOnboardingState: Mock;
  let setOnboardingState: Mock;
  let findUserByTgId: Mock;
  let createTicket: Mock;
  let createTopic: Mock;
  let sendTicketCard: Mock;
  let mirrorUserMessage: Mock;
  let updateSourceUrl: Mock;
  let mockCtx: MockContext;

  const newUser = {
    id: 'user-1',
    topicId: 501,
    phone: null,
    status: 'NEW',
    webSessionId: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const onboardingService = await import('../../../services/onboarding.service.js');
    getOnboardingState = onboardingService.getOnboardingState as Mock;
    setOnboardingState = onboardingService.setOnboardingState as Mock;

    const ticketService = await import('../../../services/ticket.service.js');
    findUserByTgId = ticketService.findUserByTgId as Mock;
    createTicket = ticketService.createTicket as Mock;

    const topicService = await import('../../../services/topic.service.js');
    createTopic = topicService.createTopic as Mock;
    sendTicketCard = topicService.sendTicketCard as Mock;

    const messageService = await import('../../../services/message.service.js');
    mirrorUserMessage = messageService.mirrorUserMessage as Mock;

    const userRepo = await import('../../../db/repositories/user.repository.js');
    updateSourceUrl = userRepo.userRepository.updateSourceUrl as Mock;

    getOnboardingState.mockResolvedValue({ step: 'awaiting_question' });
    findUserByTgId.mockResolvedValue(null);
    createTopic.mockResolvedValue({ message_thread_id: 501 });
    createTicket.mockResolvedValue(newUser);
    sendTicketCard.mockResolvedValue(700);
    mirrorUserMessage.mockResolvedValue(701);
    setOnboardingState.mockResolvedValue(undefined);

    mockCtx = {
      from: { id: 123456, is_bot: false, first_name: 'TestUser', username: 'testuser' },
      message: { message_id: 42, text: 'просто тестовый вопрос' },
      api: {},
      reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
    };
  });

  describe('handleOnboarding', () => {
    it('should mirror the first question to the topic for a new user', async () => {
      await handleOnboarding(mockCtx as unknown as Context);

      expect(mirrorUserMessage).toHaveBeenCalledWith(
        mockCtx.api,
        mockCtx.message,
        'user-1',
        501,
        SUPPORT_GROUP_ID,
        undefined,
      );
    });

    it('should send the ticket card before mirroring the question', async () => {
      await handleOnboarding(mockCtx as unknown as Context);

      const cardOrder = sendTicketCard.mock.invocationCallOrder[0] ?? 0;
      const mirrorOrder = mirrorUserMessage.mock.invocationCallOrder[0] ?? 0;
      expect(cardOrder).toBeLessThan(mirrorOrder);
    });

    it('should keep asking for the phone after mirroring', async () => {
      await handleOnboarding(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(messages.onboarding.ticketCreated);
      expect(setOnboardingState).toHaveBeenCalledWith(
        BigInt(123456),
        expect.objectContaining({ step: 'awaiting_phone' }),
      );
    });

    it('should mirror the question for an existing user', async () => {
      findUserByTgId.mockResolvedValue({
        id: 'user-2',
        topicId: 340,
        phone: '+79001234567',
        status: 'CLOSED',
        webSessionId: null,
      });

      await handleOnboarding(mockCtx as unknown as Context);

      expect(createTopic).not.toHaveBeenCalled();
      expect(mirrorUserMessage).toHaveBeenCalledWith(
        mockCtx.api,
        mockCtx.message,
        'user-2',
        340,
        SUPPORT_GROUP_ID,
        undefined,
      );
    });

    it('should update source url before mirroring for an existing user', async () => {
      getOnboardingState.mockResolvedValue({
        step: 'awaiting_question',
        sourceUrl: 'https://example.com/page',
      });
      findUserByTgId.mockResolvedValue({
        id: 'user-2',
        topicId: 340,
        phone: null,
        status: 'IN_PROGRESS',
        webSessionId: null,
      });

      await handleOnboarding(mockCtx as unknown as Context);

      expect(updateSourceUrl).toHaveBeenCalledWith('user-2', 'https://example.com/page');
      expect(mirrorUserMessage).toHaveBeenCalled();
    });

    it('should add the TG prefix when the user has a linked web session', async () => {
      findUserByTgId.mockResolvedValue({
        id: 'user-3',
        topicId: 341,
        phone: null,
        status: 'NEW',
        webSessionId: 'web-session-1',
      });

      await handleOnboarding(mockCtx as unknown as Context);

      expect(mirrorUserMessage).toHaveBeenCalledWith(
        mockCtx.api,
        mockCtx.message,
        'user-3',
        341,
        SUPPORT_GROUP_ID,
        { channelPrefix: 'TG' },
      );
    });

    it('should not mirror when the user has no topic', async () => {
      findUserByTgId.mockResolvedValue({
        id: 'user-4',
        topicId: null,
        phone: null,
        status: 'NEW',
        webSessionId: 'web-session-2',
      });

      await handleOnboarding(mockCtx as unknown as Context);

      expect(mirrorUserMessage).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(messages.onboarding.ticketCreated);
    });

    it('should notify the user when the message type is not supported', async () => {
      mirrorUserMessage.mockResolvedValue(null);

      await handleOnboarding(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(messages.unsupportedMessageType);
    });

    it('should log the reopened event for a closed ticket', async () => {
      const eventRepo = await import('../../../db/repositories/event.repository.js');
      findUserByTgId.mockResolvedValue({
        id: 'user-5',
        topicId: 342,
        phone: null,
        status: 'CLOSED',
        webSessionId: null,
      });

      await handleOnboarding(mockCtx as unknown as Context);

      expect(eventRepo.eventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-5',
          eventType: 'REOPENED',
          question: 'просто тестовый вопрос',
        }),
      );
      expect(mirrorUserMessage).toHaveBeenCalled();
    });

    it('should report an error and skip mirroring when the topic cannot be created', async () => {
      createTopic.mockRejectedValue(new Error('Telegram unavailable'));

      await handleOnboarding(mockCtx as unknown as Context);

      expect(mirrorUserMessage).not.toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith(messages.ticketCreateError);
    });

    it('should ignore messages when onboarding is not started', async () => {
      getOnboardingState.mockResolvedValue(null);

      const handled = await handleOnboarding(mockCtx as unknown as Context);

      expect(handled).toBe(false);
      expect(mirrorUserMessage).not.toHaveBeenCalled();
    });

    it('should keep the ticket and continue the flow when mirroring fails', async () => {
      mirrorUserMessage.mockRejectedValue(new Error('Telegram unavailable'));

      await handleOnboarding(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(messages.deliveryFailed);
      expect(mockCtx.reply).not.toHaveBeenCalledWith(messages.ticketCreateError);
      expect(setOnboardingState).toHaveBeenCalledWith(
        BigInt(123456),
        expect.objectContaining({ step: 'awaiting_phone' }),
      );
    });
  });
});

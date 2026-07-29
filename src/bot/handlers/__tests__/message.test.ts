import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Context } from 'grammy';
import { privateMessageHandler } from '../message.js';
import { messages } from '../../../config/messages.js';

const SUPPORT_GROUP_ID = -1001234567890;

vi.mock('../../../config/env.js', () => ({
  env: {
    SUPPORT_GROUP_ID: '-1001234567890',
  },
}));

vi.mock('../../../services/ticket.service.js', () => ({
  findUserByTgId: vi.fn(),
}));

vi.mock('../../../services/message.service.js', () => ({
  mirrorUserMessage: vi.fn(),
}));

vi.mock('../../../services/status.service.js', () => ({
  autoChangeStatus: vi.fn(),
  reopenTicket: vi.fn(),
}));

vi.mock('../../../services/autoclose.service.js', () => ({
  cancelAutocloseTimer: vi.fn(),
}));

vi.mock('../../../services/rate-limit.service.js', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('../../../services/onboarding.service.js', () => ({
  setOnboardingState: vi.fn(),
}));

vi.mock('../onboarding.js', () => ({
  handleOnboarding: vi.fn(),
}));

vi.mock('../phone.js', () => ({
  buildPhoneConfirmMessage: vi.fn(() => 'phone-confirm-text'),
  buildPhoneConfirmKeyboard: vi.fn(() => ({ inline_keyboard: [] })),
}));

vi.mock('../../../config/sentry.js', () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
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
  from: { id: number; is_bot: boolean; first_name: string };
  message: { message_id: number; text?: string };
  api: { sendMessage: Mock };
  reply: Mock;
};

describe('message', () => {
  let findUserByTgId: Mock;
  let mirrorUserMessage: Mock;
  let autoChangeStatus: Mock;
  let reopenTicket: Mock;
  let cancelAutocloseTimer: Mock;
  let checkRateLimit: Mock;
  let handleOnboarding: Mock;
  let mockCtx: MockContext;

  const closedUser = {
    id: 'user-1',
    topicId: 342,
    phone: '+79990000000',
    status: 'CLOSED',
    webSessionId: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const ticketService = await import('../../../services/ticket.service.js');
    findUserByTgId = ticketService.findUserByTgId as Mock;

    const messageService = await import('../../../services/message.service.js');
    mirrorUserMessage = messageService.mirrorUserMessage as Mock;

    const statusService = await import('../../../services/status.service.js');
    autoChangeStatus = statusService.autoChangeStatus as Mock;
    reopenTicket = statusService.reopenTicket as Mock;

    const autocloseService = await import('../../../services/autoclose.service.js');
    cancelAutocloseTimer = autocloseService.cancelAutocloseTimer as Mock;

    const rateLimitService = await import('../../../services/rate-limit.service.js');
    checkRateLimit = rateLimitService.checkRateLimit as Mock;

    const onboardingHandler = await import('../onboarding.js');
    handleOnboarding = onboardingHandler.handleOnboarding as Mock;

    checkRateLimit.mockResolvedValue({ allowed: true });
    handleOnboarding.mockResolvedValue(false);
    findUserByTgId.mockResolvedValue({ ...closedUser, status: 'IN_PROGRESS' });
    mirrorUserMessage.mockResolvedValue(701);
    reopenTicket.mockResolvedValue(false);
    autoChangeStatus.mockResolvedValue({
      changed: false,
      oldStatus: 'IN_PROGRESS',
      newStatus: 'IN_PROGRESS',
    });

    mockCtx = {
      from: { id: 123456, is_bot: false, first_name: 'TestUser' },
      message: { message_id: 42, text: 'второе сообщение клиента' },
      api: { sendMessage: vi.fn<() => Promise<unknown>>().mockResolvedValue({ message_id: 900 }) },
      reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
    };
  });

  describe('privateMessageHandler', () => {
    it('should reopen a closed ticket through the status service', async () => {
      findUserByTgId.mockResolvedValue(closedUser);
      reopenTicket.mockResolvedValue(true);

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(reopenTicket).toHaveBeenCalledWith(mockCtx.api, closedUser, 342);
    });

    it('should ask to confirm the phone after a reopen', async () => {
      findUserByTgId.mockResolvedValue(closedUser);
      reopenTicket.mockResolvedValue(true);

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith('phone-confirm-text', {
        reply_markup: { inline_keyboard: [] },
      });
    });

    it('should reopen the ticket before mirroring the message', async () => {
      findUserByTgId.mockResolvedValue(closedUser);
      reopenTicket.mockResolvedValue(true);

      await privateMessageHandler(mockCtx as unknown as Context);

      const reopenOrder = reopenTicket.mock.invocationCallOrder[0] ?? 0;
      const mirrorOrder = mirrorUserMessage.mock.invocationCallOrder[0] ?? 0;
      expect(reopenOrder).toBeLessThan(mirrorOrder);
    });

    it('should not ask to confirm the phone when nothing was reopened', async () => {
      findUserByTgId.mockResolvedValue({ ...closedUser, status: 'IN_PROGRESS' });
      reopenTicket.mockResolvedValue(false);

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(mockCtx.reply).not.toHaveBeenCalled();
      expect(mirrorUserMessage).toHaveBeenCalled();
    });

    it('should mirror the message into the support topic', async () => {
      await privateMessageHandler(mockCtx as unknown as Context);

      expect(mirrorUserMessage).toHaveBeenCalledWith(
        mockCtx.api,
        mockCtx.message,
        'user-1',
        342,
        SUPPORT_GROUP_ID,
        undefined,
      );
    });

    it('should mark the message as coming from Telegram for a linked web session', async () => {
      findUserByTgId.mockResolvedValue({
        ...closedUser,
        status: 'IN_PROGRESS',
        webSessionId: 'session-1',
      });

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(mirrorUserMessage).toHaveBeenCalledWith(
        mockCtx.api,
        mockCtx.message,
        'user-1',
        342,
        SUPPORT_GROUP_ID,
        { channelPrefix: 'TG' },
      );
    });

    it('should cancel the autoclose timer when the client was awaited', async () => {
      const waitingUser = { ...closedUser, status: 'WAITING_CLIENT' };
      findUserByTgId.mockResolvedValue(waitingUser);

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(cancelAutocloseTimer).toHaveBeenCalledWith('user-1', 342);
      expect(autoChangeStatus).toHaveBeenCalledWith(mockCtx.api, waitingUser, 'CLIENT_REPLY');
    });

    it('should not cancel the autoclose timer for a ticket in progress', async () => {
      await privateMessageHandler(mockCtx as unknown as Context);

      expect(cancelAutocloseTimer).not.toHaveBeenCalled();
    });

    it('should notify the user when the message type is not supported', async () => {
      mirrorUserMessage.mockResolvedValue(null);

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(messages.unsupportedMessageType);
      expect(autoChangeStatus).not.toHaveBeenCalled();
    });

    it('should report a delivery failure when mirroring throws', async () => {
      mirrorUserMessage.mockRejectedValue(new Error('Telegram unavailable'));

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(messages.deliveryFailed);
    });

    it('should start onboarding when the user has no ticket yet', async () => {
      const onboardingService = await import('../../../services/onboarding.service.js');
      findUserByTgId.mockResolvedValue(null);

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(onboardingService.setOnboardingState).toHaveBeenCalledWith(BigInt(123456), {
        step: 'awaiting_question',
      });
      expect(mockCtx.reply).toHaveBeenCalledWith(messages.welcome);
      expect(mirrorUserMessage).not.toHaveBeenCalled();
    });

    it('should leave the message to the onboarding flow when it is active', async () => {
      handleOnboarding.mockResolvedValue(true);

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTgId).not.toHaveBeenCalled();
      expect(mirrorUserMessage).not.toHaveBeenCalled();
    });

    it('should refuse the message when the rate limit is hit', async () => {
      checkRateLimit.mockResolvedValue({ allowed: false });

      await privateMessageHandler(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(messages.rateLimitError);
      expect(mirrorUserMessage).not.toHaveBeenCalled();
    });
  });
});

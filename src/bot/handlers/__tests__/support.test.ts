import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Context } from 'grammy';
import { GrammyError } from 'grammy';
import { supportMessageHandler } from '../support.js';
import { messages } from '../../../config/messages.js';

// Mock dependencies
vi.mock('../../../services/ticket.service.js', () => ({
  findUserByTopicId: vi.fn(),
}));

vi.mock('../../../services/message.service.js', () => ({
  mirrorSupportMessage: vi.fn(),
}));

vi.mock('../../../services/status.service.js', () => ({
  autoChangeStatus: vi.fn(),
}));

vi.mock('../../../services/sla.service.js', () => ({
  cancelAllSlaTimers: vi.fn(),
}));

vi.mock('../../../config/sentry.js', () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

type MockContext = {
  from?: {
    id: number;
    is_bot: boolean;
  };
  message?: {
    message_id: number;
    message_thread_id?: number;
    text?: string;
    caption?: string;
  };
  api: {
    sendMessage: Mock;
  };
  reply: Mock;
};

describe('supportMessageHandler', () => {
  let mockCtx: MockContext;
  let findUserByTopicId: Mock;
  let mirrorSupportMessage: Mock;
  let autoChangeStatus: Mock;
  let cancelAllSlaTimers: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const ticketService = await import('../../../services/ticket.service.js');
    const messageService = await import('../../../services/message.service.js');
    const statusService = await import('../../../services/status.service.js');
    const slaService = await import('../../../services/sla.service.js');

    findUserByTopicId = ticketService.findUserByTopicId as Mock;
    mirrorSupportMessage = messageService.mirrorSupportMessage as Mock;
    autoChangeStatus = statusService.autoChangeStatus as Mock;
    cancelAllSlaTimers = slaService.cancelAllSlaTimers as Mock;

    mockCtx = {
      from: {
        id: 123456,
        is_bot: false,
      },
      message: {
        message_id: 1,
        message_thread_id: 100,
        text: 'Hello user',
      },
      api: {
        sendMessage: vi.fn(),
      },
      reply: vi.fn().mockResolvedValue({}),
    };
  });

  describe('message filtering', () => {
    it('should ignore messages from bots', async () => {
      mockCtx.from = { id: 123, is_bot: true };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });

    it('should ignore messages without from field', async () => {
      mockCtx.from = undefined;

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });

    it('should ignore messages without message field', async () => {
      mockCtx.message = undefined;

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });

    it('should ignore messages in General topic (no thread_id)', async () => {
      mockCtx.message = { message_id: 1, text: 'Hello' };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });

    it('should ignore internal messages starting with //', async () => {
      mockCtx.message = {
        message_id: 1,
        message_thread_id: 100,
        text: '// This is internal note',
      };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });

    it('should ignore internal messages starting with #internal', async () => {
      mockCtx.message = {
        message_id: 1,
        message_thread_id: 100,
        text: '#internal Do not send to user',
      };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });

    it('should ignore internal captions starting with //', async () => {
      mockCtx.message = {
        message_id: 1,
        message_thread_id: 100,
        caption: '// Internal photo',
      };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });

    it('should ignore internal captions starting with #internal', async () => {
      mockCtx.message = {
        message_id: 1,
        message_thread_id: 100,
        caption: '#internal Secret photo',
      };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).not.toHaveBeenCalled();
    });
  });

  describe('user lookup', () => {
    it('should lookup user by topic id', async () => {
      findUserByTopicId.mockResolvedValue(null);

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(findUserByTopicId).toHaveBeenCalledWith(100);
    });

    it('should not mirror if user not found', async () => {
      findUserByTopicId.mockResolvedValue(null);

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(mirrorSupportMessage).not.toHaveBeenCalled();
    });
  });

  describe('message mirroring', () => {
    const mockUser = {
      id: 'user-1',
      tgUserId: BigInt(999),
      topicId: 100,
    };

    beforeEach(() => {
      findUserByTopicId.mockResolvedValue(mockUser);
      mirrorSupportMessage.mockResolvedValue(1);
    });

    it('should mirror message to user DM', async () => {
      await supportMessageHandler(mockCtx as unknown as Context);

      expect(mirrorSupportMessage).toHaveBeenCalledWith(
        mockCtx.api,
        mockCtx.message,
        'user-1',
        BigInt(999)
      );
    });

    it('should cancel SLA timers after reply', async () => {
      await supportMessageHandler(mockCtx as unknown as Context);

      expect(cancelAllSlaTimers).toHaveBeenCalledWith('user-1', 100);
    });

    it('should auto change status on support reply', async () => {
      await supportMessageHandler(mockCtx as unknown as Context);

      expect(autoChangeStatus).toHaveBeenCalledWith(
        mockCtx.api,
        mockUser,
        'SUPPORT_REPLY'
      );
    });
  });

  describe('error handling', () => {
    const mockUser = {
      id: 'user-1',
      tgUserId: BigInt(999),
      topicId: 100,
    };

    beforeEach(() => {
      findUserByTopicId.mockResolvedValue(mockUser);
    });

    it('should notify operator when bot is blocked by user', async () => {
      const blockedError = new GrammyError(
        'Forbidden: bot was blocked by the user',
        {
          ok: false,
          error_code: 403,
          description: 'Forbidden: bot was blocked by the user',
        },
        'sendMessage',
        { chat_id: 999, text: 'test' }
      );
      mirrorSupportMessage.mockRejectedValue(blockedError);

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        messages.support.botBlocked,
        { message_thread_id: 100 }
      );
    });

    it('should notify operator on delivery failure', async () => {
      mirrorSupportMessage.mockRejectedValue(new Error('Network error'));

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        messages.support.deliveryFailed,
        { message_thread_id: 100 }
      );
    });

    it('should not throw when notification reply fails', async () => {
      mirrorSupportMessage.mockRejectedValue(new Error('Network error'));
      mockCtx.reply.mockRejectedValue(new Error('Reply also failed'));

      await expect(
        supportMessageHandler(mockCtx as unknown as Context)
      ).resolves.not.toThrow();
    });
  });
});

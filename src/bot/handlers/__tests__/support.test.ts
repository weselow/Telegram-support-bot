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

vi.mock('../../../db/repositories/message.repository.js', () => ({
  messageRepository: {
    createWebMessage: vi.fn(),
  },
}));

vi.mock('../../../http/ws/connection-manager.js', () => ({
  sendToUser: vi.fn(),
}));

type MockPhotoSize = { file_id: string; file_unique_id: string; width: number; height: number };

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
    photo?: MockPhotoSize[];
    voice?: { file_id: string; file_unique_id: string; duration: number };
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
  let createWebMessage: Mock;
  let sendToUser: Mock;

  const mirroredRecord = {
    id: 'map-1',
    createdAt: new Date('2026-07-29T10:00:00.000Z'),
  };

  const webRecord = {
    id: 'web-1',
    createdAt: new Date('2026-07-29T11:00:00.000Z'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const ticketService = await import('../../../services/ticket.service.js');
    const messageService = await import('../../../services/message.service.js');
    const statusService = await import('../../../services/status.service.js');
    const slaService = await import('../../../services/sla.service.js');
    const messageRepo = await import('../../../db/repositories/message.repository.js');
    const connectionManager = await import('../../../http/ws/connection-manager.js');

    findUserByTopicId = ticketService.findUserByTopicId as Mock;
    mirrorSupportMessage = messageService.mirrorSupportMessage as Mock;
    autoChangeStatus = statusService.autoChangeStatus as Mock;
    cancelAllSlaTimers = slaService.cancelAllSlaTimers as Mock;
    createWebMessage = messageRepo.messageRepository.createWebMessage as Mock;
    sendToUser = connectionManager.sendToUser as Mock;

    createWebMessage.mockResolvedValue(webRecord);

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
      mirrorSupportMessage.mockResolvedValue(mirroredRecord);
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

    it('should not touch web chat for a Telegram-only user', async () => {
      await supportMessageHandler(mockCtx as unknown as Context);

      expect(createWebMessage).not.toHaveBeenCalled();
      expect(sendToUser).not.toHaveBeenCalled();
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

  describe('delivery to web chat', () => {
    const webOnlyUser = {
      id: 'user-1',
      tgUserId: null,
      webSessionId: 'session-1',
      topicId: 100,
    };

    const linkedUser = {
      id: 'user-1',
      tgUserId: BigInt(999),
      webSessionId: 'session-1',
      topicId: 100,
    };

    it('should save and push the message for a web-only user', async () => {
      findUserByTopicId.mockResolvedValue(webOnlyUser);

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(mirrorSupportMessage).not.toHaveBeenCalled();
      expect(createWebMessage).toHaveBeenCalledWith({
        userId: 'user-1',
        topicMessageId: 1,
        direction: 'SUPPORT_TO_USER',
        channel: 'TELEGRAM',
        text: 'Hello user',
        mediaFileId: undefined,
        mediaDuration: undefined,
      });
      expect(sendToUser).toHaveBeenCalledWith('user-1', 'message', {
        id: 'web-1',
        text: 'Hello user',
        from: 'support',
        channel: 'telegram',
        timestamp: webRecord.createdAt.toISOString(),
      });
    });

    it('should store exactly one record for a user with both channels', async () => {
      findUserByTopicId.mockResolvedValue(linkedUser);
      mirrorSupportMessage.mockResolvedValue(mirroredRecord);

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(mirrorSupportMessage).toHaveBeenCalledTimes(1);
      expect(createWebMessage).not.toHaveBeenCalled();
      expect(sendToUser).toHaveBeenCalledWith(
        'user-1',
        'message',
        expect.objectContaining({
          id: mirroredRecord.id,
          text: 'Hello user',
          timestamp: mirroredRecord.createdAt.toISOString(),
        })
      );
      expect(mockCtx.reply).not.toHaveBeenCalled();
    });

    it('should push photo without caption as media for a linked user', async () => {
      findUserByTopicId.mockResolvedValue(linkedUser);
      mirrorSupportMessage.mockResolvedValue(mirroredRecord);
      mockCtx.message = {
        message_id: 1,
        message_thread_id: 100,
        photo: [
          { file_id: 'small', file_unique_id: 's1', width: 100, height: 100 },
          { file_id: 'large', file_unique_id: 'l1', width: 800, height: 600 },
        ],
      };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(createWebMessage).not.toHaveBeenCalled();
      expect(sendToUser).toHaveBeenCalledWith(
        'user-1',
        'message',
        expect.objectContaining({
          id: mirroredRecord.id,
          imageUrl: '/api/media/large',
        })
      );
    });

    it('should save voice placeholder for a web-only user', async () => {
      findUserByTopicId.mockResolvedValue(webOnlyUser);
      mockCtx.message = {
        message_id: 1,
        message_thread_id: 100,
        voice: { file_id: 'voice-1', file_unique_id: 'v1', duration: 12 },
      };

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(createWebMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '[Голосовое сообщение]',
          mediaFileId: 'voice-1',
          mediaDuration: 12,
        })
      );
      expect(sendToUser).toHaveBeenCalledWith(
        'user-1',
        'message',
        expect.objectContaining({ voiceUrl: '/api/media/voice-1', voiceDuration: 12 })
      );
    });

    it('should fall back to a web record when mirroring returned null', async () => {
      findUserByTopicId.mockResolvedValue(linkedUser);
      mirrorSupportMessage.mockResolvedValue(null);

      await supportMessageHandler(mockCtx as unknown as Context);

      expect(createWebMessage).toHaveBeenCalledTimes(1);
      expect(sendToUser).toHaveBeenCalledWith(
        'user-1',
        'message',
        expect.objectContaining({ id: 'web-1' })
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

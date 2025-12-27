import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Message } from 'grammy/types';
import {
  mirrorUserMessage,
  mirrorSupportMessage,
  editMirroredUserMessage,
  editMirroredSupportMessage,
} from '../message.service.js';

// Mock repository
vi.mock('../../db/repositories/message.repository.js', () => ({
  messageRepository: {
    create: vi.fn(),
    findByDmMessageId: vi.fn(),
    findByTopicMessageId: vi.fn(),
  },
}));

describe('MessageService', () => {
  let messageRepository: {
    create: Mock;
    findByDmMessageId: Mock;
    findByTopicMessageId: Mock;
  };

  const mockApi = {
    sendMessage: vi.fn(),
    sendPhoto: vi.fn(),
    sendVideo: vi.fn(),
    sendDocument: vi.fn(),
    sendVoice: vi.fn(),
    sendAudio: vi.fn(),
    sendVideoNote: vi.fn(),
    sendSticker: vi.fn(),
    sendAnimation: vi.fn(),
    sendContact: vi.fn(),
    sendLocation: vi.fn(),
    editMessageText: vi.fn(),
    editMessageCaption: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const repo = await import('../../db/repositories/message.repository.js');
    messageRepository = repo.messageRepository as typeof messageRepository;
  });

  describe('mirrorUserMessage', () => {
    it('should mirror text message to topic', async () => {
      const message: Partial<Message> = {
        message_id: 1,
        text: 'Hello support',
      };
      const sentMessage = { message_id: 100 };
      mockApi.sendMessage.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorUserMessage(
        mockApi as any,
        message as Message,
        'user-1',
        50,
        -1001234567890
      );

      expect(result).toBe(100);
      expect(mockApi.sendMessage).toHaveBeenCalledWith(-1001234567890, 'Hello support', {
        message_thread_id: 50,
      });
      expect(messageRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        dmMessageId: 1,
        topicMessageId: 100,
        direction: 'USER_TO_SUPPORT',
      });
    });

    it('should mirror photo message to topic', async () => {
      const message: Partial<Message> = {
        message_id: 2,
        photo: [
          { file_id: 'small', file_unique_id: 's1', width: 100, height: 100 },
          { file_id: 'large', file_unique_id: 'l1', width: 800, height: 600 },
        ],
        caption: 'Check this',
      };
      const sentMessage = { message_id: 101 };
      mockApi.sendPhoto.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorUserMessage(
        mockApi as any,
        message as Message,
        'user-1',
        50,
        -1001234567890
      );

      expect(result).toBe(101);
      expect(mockApi.sendPhoto).toHaveBeenCalledWith(-1001234567890, 'large', {
        message_thread_id: 50,
        caption: 'Check this',
      });
    });

    it('should mirror document message to topic', async () => {
      const message: Partial<Message> = {
        message_id: 3,
        document: { file_id: 'doc-123', file_unique_id: 'd1' },
        caption: 'Document here',
      };
      const sentMessage = { message_id: 102 };
      mockApi.sendDocument.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorUserMessage(
        mockApi as any,
        message as Message,
        'user-1',
        50,
        -1001234567890
      );

      expect(result).toBe(102);
      expect(mockApi.sendDocument).toHaveBeenCalledWith(-1001234567890, 'doc-123', {
        message_thread_id: 50,
        caption: 'Document here',
      });
    });

    it('should mirror voice message to topic', async () => {
      const message: Partial<Message> = {
        message_id: 4,
        voice: { file_id: 'voice-123', file_unique_id: 'v1', duration: 10 },
      };
      const sentMessage = { message_id: 103 };
      mockApi.sendVoice.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorUserMessage(
        mockApi as any,
        message as Message,
        'user-1',
        50,
        -1001234567890
      );

      expect(result).toBe(103);
      expect(mockApi.sendVoice).toHaveBeenCalledWith(-1001234567890, 'voice-123', {
        message_thread_id: 50,
      });
    });

    it('should mirror sticker to topic', async () => {
      const message: Partial<Message> = {
        message_id: 5,
        sticker: {
          file_id: 'sticker-123',
          file_unique_id: 'st1',
          type: 'regular',
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
        },
      };
      const sentMessage = { message_id: 104 };
      mockApi.sendSticker.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorUserMessage(
        mockApi as any,
        message as Message,
        'user-1',
        50,
        -1001234567890
      );

      expect(result).toBe(104);
      expect(mockApi.sendSticker).toHaveBeenCalledWith(-1001234567890, 'sticker-123', {
        message_thread_id: 50,
      });
    });

    it('should mirror location to topic', async () => {
      const message: Partial<Message> = {
        message_id: 6,
        location: { latitude: 55.7558, longitude: 37.6173 },
      };
      const sentMessage = { message_id: 105 };
      mockApi.sendLocation.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorUserMessage(
        mockApi as any,
        message as Message,
        'user-1',
        50,
        -1001234567890
      );

      expect(result).toBe(105);
      expect(mockApi.sendLocation).toHaveBeenCalledWith(-1001234567890, 55.7558, 37.6173, {
        message_thread_id: 50,
      });
    });

    it('should return null for unsupported message type', async () => {
      const message: Partial<Message> = {
        message_id: 7,
        poll: { id: 'poll-1', question: 'Test?', options: [], total_voter_count: 0, is_closed: false, is_anonymous: true, type: 'regular', allows_multiple_answers: false },
      };

      const result = await mirrorUserMessage(
        mockApi as any,
        message as Message,
        'user-1',
        50,
        -1001234567890
      );

      expect(result).toBeNull();
      expect(messageRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('mirrorSupportMessage', () => {
    it('should mirror text message to user DM with resolve button', async () => {
      const message: Partial<Message> = {
        message_id: 100,
        text: 'Hello user',
      };
      const sentMessage = { message_id: 1 };
      mockApi.sendMessage.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorSupportMessage(
        mockApi as any,
        message as Message,
        'user-1',
        BigInt(123456)
      );

      expect(result).toBe(1);
      expect(mockApi.sendMessage).toHaveBeenCalledWith(123456, 'Hello user', {
        reply_markup: expect.objectContaining({
          inline_keyboard: [[expect.objectContaining({ text: '✅ Спасибо, вопрос решён' })]],
        }),
      });
      expect(messageRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        dmMessageId: 1,
        topicMessageId: 100,
        direction: 'SUPPORT_TO_USER',
      });
    });

    it('should mirror photo to user DM', async () => {
      const message: Partial<Message> = {
        message_id: 101,
        photo: [{ file_id: 'photo-123', file_unique_id: 'p1', width: 800, height: 600 }],
        caption: 'See this',
      };
      const sentMessage = { message_id: 2 };
      mockApi.sendPhoto.mockResolvedValue(sentMessage);
      messageRepository.create.mockResolvedValue({});

      const result = await mirrorSupportMessage(
        mockApi as any,
        message as Message,
        'user-1',
        BigInt(123456)
      );

      expect(result).toBe(2);
      expect(mockApi.sendPhoto).toHaveBeenCalledWith(123456, 'photo-123', {
        caption: 'See this',
        reply_markup: expect.any(Object),
      });
    });

    it('should return null for unsupported message type', async () => {
      const message: Partial<Message> = {
        message_id: 102,
        game: { title: 'Game', description: 'desc', photo: [] },
      };

      const result = await mirrorSupportMessage(
        mockApi as any,
        message as Message,
        'user-1',
        BigInt(123456)
      );

      expect(result).toBeNull();
    });
  });

  describe('editMirroredUserMessage', () => {
    it('should edit text message in topic', async () => {
      const editedMessage: Partial<Message> = {
        message_id: 1,
        text: 'Edited text',
      };
      messageRepository.findByDmMessageId.mockResolvedValue({
        topicMessageId: 100,
      });
      mockApi.editMessageText.mockResolvedValue({});

      const result = await editMirroredUserMessage(
        mockApi as any,
        editedMessage as Message,
        'user-1',
        -1001234567890
      );

      expect(result).toBe(true);
      expect(mockApi.editMessageText).toHaveBeenCalledWith(
        -1001234567890,
        100,
        'Edited text'
      );
    });

    it('should edit caption in topic', async () => {
      const editedMessage: Partial<Message> = {
        message_id: 2,
        caption: 'New caption',
      };
      messageRepository.findByDmMessageId.mockResolvedValue({
        topicMessageId: 101,
      });
      mockApi.editMessageCaption.mockResolvedValue({});

      const result = await editMirroredUserMessage(
        mockApi as any,
        editedMessage as Message,
        'user-1',
        -1001234567890
      );

      expect(result).toBe(true);
      expect(mockApi.editMessageCaption).toHaveBeenCalledWith(-1001234567890, 101, {
        caption: 'New caption',
      });
    });

    it('should return false when no mapping found', async () => {
      const editedMessage: Partial<Message> = {
        message_id: 999,
        text: 'Edited',
      };
      messageRepository.findByDmMessageId.mockResolvedValue(null);

      const result = await editMirroredUserMessage(
        mockApi as any,
        editedMessage as Message,
        'user-1',
        -1001234567890
      );

      expect(result).toBe(false);
      expect(mockApi.editMessageText).not.toHaveBeenCalled();
    });

    it('should return false on API error', async () => {
      const editedMessage: Partial<Message> = {
        message_id: 1,
        text: 'Edited',
      };
      messageRepository.findByDmMessageId.mockResolvedValue({
        topicMessageId: 100,
      });
      mockApi.editMessageText.mockRejectedValue(new Error('Message not found'));

      const result = await editMirroredUserMessage(
        mockApi as any,
        editedMessage as Message,
        'user-1',
        -1001234567890
      );

      expect(result).toBe(false);
    });
  });

  describe('editMirroredSupportMessage', () => {
    it('should edit text message in user DM', async () => {
      const editedMessage: Partial<Message> = {
        message_id: 100,
        text: 'Edited support text',
      };
      messageRepository.findByTopicMessageId.mockResolvedValue({
        dmMessageId: 1,
      });
      mockApi.editMessageText.mockResolvedValue({});

      const result = await editMirroredSupportMessage(
        mockApi as any,
        editedMessage as Message,
        'user-1',
        BigInt(123456)
      );

      expect(result).toBe(true);
      expect(mockApi.editMessageText).toHaveBeenCalledWith(123456, 1, 'Edited support text');
    });

    it('should return false when no mapping found', async () => {
      const editedMessage: Partial<Message> = {
        message_id: 999,
        text: 'Edited',
      };
      messageRepository.findByTopicMessageId.mockResolvedValue(null);

      const result = await editMirroredSupportMessage(
        mockApi as any,
        editedMessage as Message,
        'user-1',
        BigInt(123456)
      );

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      const editedMessage: Partial<Message> = {
        message_id: 100,
        text: 'Edited',
      };
      messageRepository.findByTopicMessageId.mockResolvedValue({
        dmMessageId: 1,
      });
      mockApi.editMessageText.mockRejectedValue(new Error('Bot blocked'));

      const result = await editMirroredSupportMessage(
        mockApi as any,
        editedMessage as Message,
        'user-1',
        BigInt(123456)
      );

      expect(result).toBe(false);
    });
  });
});

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { webChatService } from '../web-chat.service.js';
import { messages } from '../../config/messages.js';

// Mock dependencies
vi.mock('../../db/repositories/user.repository.js', () => ({
  userRepository: {
    findById: vi.fn(),
    findByWebSessionId: vi.fn(),
    createWebUser: vi.fn(),
    updateTopicId: vi.fn(),
    updateStatus: vi.fn(),
    linkTelegramAccount: vi.fn(),
  },
}));

vi.mock('../lock.service.js', () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));

vi.mock('../../db/repositories/message.repository.js', () => ({
  messageRepository: {
    getHistory: vi.fn(),
    findById: vi.fn(),
    createWebMessage: vi.fn(),
  },
}));

vi.mock('../../db/repositories/web-link-token.repository.js', () => ({
  webLinkTokenRepository: {
    create: vi.fn(),
    findValidByToken: vi.fn(),
    markUsed: vi.fn(),
  },
}));

vi.mock('../topic.service.js', () => ({
  sendTicketCard: vi.fn(),
}));

vi.mock('../sla.service.js', () => ({
  startSlaTimers: vi.fn(),
  cancelAllSlaTimers: vi.fn(),
}));

vi.mock('../status.service.js', () => ({
  autoChangeStatus: vi.fn(),
}));

vi.mock('../autoclose.service.js', () => ({
  cancelAutocloseTimer: vi.fn(),
}));

vi.mock('../../bot/bot.js', () => ({
  bot: {
    api: {
      createForumTopic: vi.fn(),
      sendMessage: vi.fn(),
      sendPhoto: vi.fn(),
      sendDocument: vi.fn(),
    },
  },
}));

vi.mock('../../config/env.js', () => ({
  env: {
    SUPPORT_GROUP_ID: '-1001234567890',
    BOT_USERNAME: 'test_bot',
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('web-chat.service', () => {
  let userRepository: {
    findById: Mock;
    findByWebSessionId: Mock;
    createWebUser: Mock;
    updateTopicId: Mock;
    updateStatus: Mock;
    linkTelegramAccount: Mock;
  };
  let messageRepository: {
    getHistory: Mock;
    findById: Mock;
    createWebMessage: Mock;
  };
  let webLinkTokenRepository: {
    create: Mock;
    findValidByToken: Mock;
    markUsed: Mock;
  };
  let bot: {
    api: { createForumTopic: Mock; sendMessage: Mock; sendPhoto: Mock; sendDocument: Mock };
  };
  let startSlaTimers: Mock;
  let cancelAllSlaTimers: Mock;
  let autoChangeStatus: Mock;
  let cancelAutocloseTimer: Mock;
  let acquireLock: Mock;
  let releaseLock: Mock;

  const mockUser = {
    id: 'user-1',
    webSessionId: 'session-123',
    tgUserId: null,
    tgUsername: null,
    topicId: null,
    status: 'OPEN',
    sourceUrl: 'https://example.com',
    sourceCity: 'Moscow',
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockMessage = {
    id: 'msg-1',
    userId: 'user-1',
    topicMessageId: 100,
    dmMessageId: null,
    direction: 'USER_TO_SUPPORT',
    channel: 'WEB',
    text: 'Hello',
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const userRepo = await import('../../db/repositories/user.repository.js');
    const msgRepo = await import('../../db/repositories/message.repository.js');
    const tokenRepo = await import('../../db/repositories/web-link-token.repository.js');
    const botModule = await import('../../bot/bot.js');
    const slaService = await import('../sla.service.js');
    const statusService = await import('../status.service.js');
    const autocloseService = await import('../autoclose.service.js');
    const lockService = await import('../lock.service.js');

    userRepository = userRepo.userRepository as typeof userRepository;
    messageRepository = msgRepo.messageRepository as typeof messageRepository;
    webLinkTokenRepository = tokenRepo.webLinkTokenRepository as typeof webLinkTokenRepository;
    bot = botModule.bot as typeof bot;
    startSlaTimers = slaService.startSlaTimers as Mock;
    cancelAllSlaTimers = slaService.cancelAllSlaTimers as Mock;
    autoChangeStatus = statusService.autoChangeStatus as Mock;
    cancelAutocloseTimer = autocloseService.cancelAutocloseTimer as Mock;
    acquireLock = lockService.acquireLock as Mock;
    releaseLock = lockService.releaseLock as Mock;

    autoChangeStatus.mockResolvedValue({
      changed: true,
      oldStatus: 'IN_PROGRESS',
      newStatus: 'IN_PROGRESS',
    });
    acquireLock.mockResolvedValue('lock-token');
    userRepository.findById.mockResolvedValue({ ...mockUser, topicId: null });
  });

  describe('initSession', () => {
    it('should return existing session when user found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(mockUser);
      messageRepository.getHistory.mockResolvedValue([mockMessage]);

      const result = await webChatService.initSession('session-123');

      expect(result).toEqual({
        sessionId: 'session-123',
        isNewSession: false,
        hasHistory: true,
        telegramLinked: false,
        status: 'OPEN',
      });
      expect(userRepository.createWebUser).not.toHaveBeenCalled();
    });

    it('should create new session when user not found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(null);
      userRepository.createWebUser.mockResolvedValue(mockUser);
      messageRepository.getHistory.mockResolvedValue([]);

      const result = await webChatService.initSession('session-123', 'https://example.com', 'Moscow');

      expect(result).toEqual({
        sessionId: 'session-123',
        isNewSession: true,
        hasHistory: false,
        telegramLinked: false,
        status: 'OPEN',
      });
      expect(userRepository.createWebUser).toHaveBeenCalledWith({
        webSessionId: 'session-123',
        sourceUrl: 'https://example.com',
        sourceCity: 'Moscow',
      });
    });

    it('should indicate telegramLinked when user has tgUserId', async () => {
      const linkedUser = { ...mockUser, tgUserId: BigInt(123456) };
      userRepository.findByWebSessionId.mockResolvedValue(linkedUser);
      messageRepository.getHistory.mockResolvedValue([]);

      const result = await webChatService.initSession('session-123');

      expect(result.telegramLinked).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return messages with pagination info', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(mockUser);
      messageRepository.getHistory.mockResolvedValue([mockMessage]);

      const result = await webChatService.getHistory('session-123', { limit: 50 });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        id: 'msg-1',
        text: 'Hello',
        from: 'user',
        channel: 'web',
        timestamp: '2025-01-01T00:00:00.000Z',
      });
      expect(result.hasMore).toBe(false);
    });

    it('should throw error when session not found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(null);

      await expect(webChatService.getHistory('invalid-session')).rejects.toThrow('Session not found');
    });

    it('should indicate hasMore when more messages exist', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(mockUser);
      const messages = Array.from({ length: 51 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${i}`,
      }));
      messageRepository.getHistory.mockResolvedValue(messages);

      const result = await webChatService.getHistory('session-123', { limit: 50 });

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });

    it('should cap limit at 100', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(mockUser);
      messageRepository.getHistory.mockResolvedValue([]);

      await webChatService.getHistory('session-123', { limit: 200 });

      expect(messageRepository.getHistory).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ limit: 101 }) // 100 + 1 for hasMore check
      );
    });
  });

  describe('getStatus', () => {
    it('should return chat status', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(mockUser);
      messageRepository.getHistory.mockResolvedValue([mockMessage]);

      const result = await webChatService.getStatus('session-123');

      expect(result).toEqual({
        ticketId: 'user-1',
        status: 'OPEN',
        telegramLinked: false,
        telegramUsername: undefined,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastMessageAt: '2025-01-01T00:00:00.000Z',
      });
    });

    it('should throw error when session not found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(null);

      await expect(webChatService.getStatus('invalid-session')).rejects.toThrow('Session not found');
    });

    it('should include telegram username when linked', async () => {
      const linkedUser = { ...mockUser, tgUserId: BigInt(123456), tgUsername: 'johndoe' };
      userRepository.findByWebSessionId.mockResolvedValue(linkedUser);
      messageRepository.getHistory.mockResolvedValue([]);

      const result = await webChatService.getStatus('session-123');

      expect(result.telegramLinked).toBe(true);
      expect(result.telegramUsername).toBe('johndoe');
    });
  });

  describe('sendMessage', () => {
    it('should create topic and send message for new user', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);
      bot.api.createForumTopic.mockResolvedValue({ message_thread_id: 200 });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      const result = await webChatService.sendMessage('session-123', 'Hello support');

      expect(bot.api.createForumTopic).toHaveBeenCalledWith('-1001234567890', 'Web: session-');
      expect(userRepository.updateTopicId).toHaveBeenCalledWith('user-1', 200);
      expect(bot.api.sendMessage).toHaveBeenCalledWith(
        '-1001234567890',
        '[WEB] Hello support',
        { message_thread_id: 200 }
      );
      expect(result.from).toBe('user');
    });

    it('should start SLA timers when topic is created', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);
      bot.api.createForumTopic.mockResolvedValue({ message_thread_id: 200 });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello support');

      expect(startSlaTimers).toHaveBeenCalledWith('user-1', 200);
    });

    it('should use existing topic when available', async () => {
      const userWithTopic = { ...mockUser, topicId: 100 };
      userRepository.findByWebSessionId.mockResolvedValue(userWithTopic);
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello');

      expect(startSlaTimers).not.toHaveBeenCalled();
      expect(bot.api.createForumTopic).not.toHaveBeenCalled();
      expect(bot.api.sendMessage).toHaveBeenCalledWith(
        '-1001234567890',
        '[WEB] Hello',
        { message_thread_id: 100 }
      );
    });

    it('should throw error when session not found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(null);

      await expect(webChatService.sendMessage('invalid-session', 'Hello')).rejects.toThrow('Session not found');
    });

    it('should include replyTo when valid message found', async () => {
      const userWithTopic = { ...mockUser, topicId: 100 };
      userRepository.findByWebSessionId.mockResolvedValue(userWithTopic);
      messageRepository.findById.mockResolvedValue({ ...mockMessage, topicMessageId: 50 });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Reply text', 'msg-1');

      expect(bot.api.sendMessage).toHaveBeenCalledWith(
        '-1001234567890',
        '[WEB] Reply text',
        { message_thread_id: 100, reply_to_message_id: 50 }
      );
    });

    it('should change status to in progress on client reply', async () => {
      const waitingUser = { ...mockUser, topicId: 100, status: 'WAITING_CLIENT' };
      userRepository.findByWebSessionId.mockResolvedValue(waitingUser);
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello');

      expect(autoChangeStatus).toHaveBeenCalledWith(bot.api, waitingUser, 'CLIENT_REPLY');
    });

    it('should cancel autoclose timer when client was awaited', async () => {
      const waitingUser = { ...mockUser, topicId: 100, status: 'WAITING_CLIENT' };
      userRepository.findByWebSessionId.mockResolvedValue(waitingUser);
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello');

      expect(cancelAutocloseTimer).toHaveBeenCalledWith('user-1', 100);
    });

    it('should not cancel autoclose timer for other statuses', async () => {
      const activeUser = { ...mockUser, topicId: 100, status: 'IN_PROGRESS' };
      userRepository.findByWebSessionId.mockResolvedValue(activeUser);
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello');

      expect(cancelAutocloseTimer).not.toHaveBeenCalled();
    });

    it('should reopen closed ticket before sending message', async () => {
      const closedUser = { ...mockUser, topicId: 100, status: 'CLOSED' };
      userRepository.findByWebSessionId.mockResolvedValue(closedUser);
      autoChangeStatus.mockResolvedValue({ changed: true, oldStatus: 'CLOSED', newStatus: 'NEW' });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello again');

      expect(autoChangeStatus).toHaveBeenCalledWith(bot.api, closedUser, 'CLIENT_REOPEN');
      expect(bot.api.sendMessage).toHaveBeenNthCalledWith(1, '-1001234567890', messages.reopened, {
        message_thread_id: 100,
      });
      expect(bot.api.sendMessage).toHaveBeenNthCalledWith(2, '-1001234567890', '[WEB] Hello again', {
        message_thread_id: 100,
      });
    });

    it('should restart SLA timers when ticket is reopened', async () => {
      const closedUser = { ...mockUser, topicId: 100, status: 'CLOSED' };
      userRepository.findByWebSessionId.mockResolvedValue(closedUser);
      autoChangeStatus.mockResolvedValue({ changed: true, oldStatus: 'CLOSED', newStatus: 'NEW' });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello again');

      expect(cancelAllSlaTimers).toHaveBeenCalledWith('user-1', 100);
      expect(startSlaTimers).toHaveBeenCalledWith('user-1', 100);
    });

    it('should not notify support when reopen did not change status', async () => {
      const closedUser = { ...mockUser, topicId: 100, status: 'CLOSED' };
      userRepository.findByWebSessionId.mockResolvedValue(closedUser);
      autoChangeStatus.mockResolvedValue({
        changed: false,
        oldStatus: 'CLOSED',
        newStatus: 'CLOSED',
      });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello again');

      expect(bot.api.sendMessage).toHaveBeenCalledTimes(1);
      expect(bot.api.sendMessage).toHaveBeenCalledWith('-1001234567890', '[WEB] Hello again', {
        message_thread_id: 100,
      });
      expect(startSlaTimers).not.toHaveBeenCalled();
    });
  });

  describe('sendFile', () => {
    it('should create topic and start SLA timers for first file', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);
      bot.api.createForumTopic.mockResolvedValue({ message_thread_id: 200 });
      bot.api.sendDocument.mockResolvedValue({
        message_id: 400,
        document: { file_id: 'file-abc' },
      });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendFile(
        'session-123',
        Buffer.from('content'),
        'report.pdf',
        'application/pdf',
        'document'
      );

      expect(userRepository.updateTopicId).toHaveBeenCalledWith('user-1', 200);
      expect(startSlaTimers).toHaveBeenCalledWith('user-1', 200);
    });

    it('should not start SLA timers when topic already exists', async () => {
      const userWithTopic = { ...mockUser, topicId: 100 };
      userRepository.findByWebSessionId.mockResolvedValue(userWithTopic);
      bot.api.sendDocument.mockResolvedValue({
        message_id: 400,
        document: { file_id: 'file-abc' },
      });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendFile(
        'session-123',
        Buffer.from('content'),
        'report.pdf',
        'application/pdf',
        'document'
      );

      expect(bot.api.createForumTopic).not.toHaveBeenCalled();
      expect(startSlaTimers).not.toHaveBeenCalled();
    });

    it('should change status to in progress on client file', async () => {
      const waitingUser = { ...mockUser, topicId: 100, status: 'WAITING_CLIENT' };
      userRepository.findByWebSessionId.mockResolvedValue(waitingUser);
      bot.api.sendDocument.mockResolvedValue({
        message_id: 400,
        document: { file_id: 'file-abc' },
      });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendFile(
        'session-123',
        Buffer.from('content'),
        'report.pdf',
        'application/pdf',
        'document'
      );

      expect(cancelAutocloseTimer).toHaveBeenCalledWith('user-1', 100);
      expect(autoChangeStatus).toHaveBeenCalledWith(bot.api, waitingUser, 'CLIENT_REPLY');
    });

    it('should reopen closed ticket before sending file', async () => {
      const closedUser = { ...mockUser, topicId: 100, status: 'CLOSED' };
      userRepository.findByWebSessionId.mockResolvedValue(closedUser);
      autoChangeStatus.mockResolvedValue({ changed: true, oldStatus: 'CLOSED', newStatus: 'NEW' });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      bot.api.sendDocument.mockResolvedValue({
        message_id: 400,
        document: { file_id: 'file-abc' },
      });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendFile(
        'session-123',
        Buffer.from('content'),
        'report.pdf',
        'application/pdf',
        'document'
      );

      expect(autoChangeStatus).toHaveBeenCalledWith(bot.api, closedUser, 'CLIENT_REOPEN');
      expect(bot.api.sendMessage).toHaveBeenCalledWith('-1001234567890', messages.reopened, {
        message_thread_id: 100,
      });
      expect(startSlaTimers).toHaveBeenCalledWith('user-1', 100);
    });

    it('should throw error when session not found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(null);

      await expect(
        webChatService.sendFile(
          'invalid-session',
          Buffer.from('content'),
          'report.pdf',
          'application/pdf',
          'document'
        )
      ).rejects.toThrow('Session not found');
    });
  });

  describe('ensureTopic', () => {
    it('should reuse topic created by a parallel request', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);
      userRepository.findById.mockResolvedValue({ ...mockUser, topicId: 200 });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello');

      expect(bot.api.createForumTopic).not.toHaveBeenCalled();
      expect(userRepository.updateTopicId).not.toHaveBeenCalled();
      expect(startSlaTimers).not.toHaveBeenCalled();
      expect(bot.api.sendMessage).toHaveBeenCalledWith('-1001234567890', '[WEB] Hello', {
        message_thread_id: 200,
      });
    });

    it('should take and release the lock around topic creation', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);
      bot.api.createForumTopic.mockResolvedValue({ message_thread_id: 200 });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello');

      expect(acquireLock).toHaveBeenCalledWith('topic:user-1');
      expect(releaseLock).toHaveBeenCalledWith('topic:user-1', 'lock-token');
    });

    it('should create topic when the lock could not be taken', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);
      acquireLock.mockResolvedValue(null);
      bot.api.createForumTopic.mockResolvedValue({ message_thread_id: 200 });
      bot.api.sendMessage.mockResolvedValue({ message_id: 300 });
      messageRepository.createWebMessage.mockResolvedValue(mockMessage);

      await webChatService.sendMessage('session-123', 'Hello');

      expect(bot.api.createForumTopic).toHaveBeenCalled();
      expect(releaseLock).not.toHaveBeenCalled();
    });

    it('should release the lock when topic creation fails', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);
      bot.api.createForumTopic.mockRejectedValue(new Error('Telegram down'));

      await expect(webChatService.sendMessage('session-123', 'Hello')).rejects.toThrow(
        'Telegram down'
      );
      expect(releaseLock).toHaveBeenCalledWith('topic:user-1', 'lock-token');
    });
  });

  describe('linkTelegram', () => {
    it('should generate telegram link', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(mockUser);
      const mockToken = {
        id: 'token-1',
        token: 'abc123',
        expiresAt: new Date('2025-01-01T01:00:00Z'),
      };
      webLinkTokenRepository.create.mockResolvedValue(mockToken);

      const result = await webChatService.linkTelegram('session-123');

      expect(result.token).toBe('abc123');
      expect(result.telegramUrl).toBe('https://t.me/test_bot?start=abc123');
      expect(result.expiresAt).toBe('2025-01-01T01:00:00.000Z');
    });

    it('should throw error when session not found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(null);

      await expect(webChatService.linkTelegram('invalid-session')).rejects.toThrow('Session not found');
    });
  });

  describe('closeTicket', () => {
    it('should close ticket with resolved status', async () => {
      const userWithTopic = { ...mockUser, topicId: 100, status: 'IN_PROGRESS' };
      userRepository.findByWebSessionId.mockResolvedValue(userWithTopic);
      autoChangeStatus.mockResolvedValue({
        changed: true,
        oldStatus: 'IN_PROGRESS',
        newStatus: 'CLOSED',
      });
      bot.api.sendMessage.mockResolvedValue({});

      const result = await webChatService.closeTicket('session-123', true, 'Great support!');

      expect(autoChangeStatus).toHaveBeenCalledWith(bot.api, userWithTopic, 'CLIENT_RESOLVED');
      expect(bot.api.sendMessage).toHaveBeenCalledWith(
        -1001234567890,
        '[WEB] ✅ Клиент закрыл тикет: "Great support!"',
        { message_thread_id: 100 }
      );
      expect(result.status).toBe('CLOSED');
    });

    it('should throw error when status change failed', async () => {
      const userWithTopic = { ...mockUser, topicId: 100, status: 'IN_PROGRESS' };
      userRepository.findByWebSessionId.mockResolvedValue(userWithTopic);
      autoChangeStatus.mockResolvedValue({
        changed: false,
        oldStatus: 'IN_PROGRESS',
        newStatus: 'IN_PROGRESS',
      });

      await expect(webChatService.closeTicket('session-123', true)).rejects.toThrow(
        'Failed to close ticket'
      );
      expect(bot.api.sendMessage).not.toHaveBeenCalled();
    });

    it('should close ticket with unresolved status', async () => {
      const userWithTopic = { ...mockUser, topicId: 100, status: 'IN_PROGRESS' };
      userRepository.findByWebSessionId.mockResolvedValue(userWithTopic);
      bot.api.sendMessage.mockResolvedValue({});

      await webChatService.closeTicket('session-123', false);

      expect(bot.api.sendMessage).toHaveBeenCalledWith(
        -1001234567890,
        '[WEB] ❌ Клиент закрыл тикет без решения',
        { message_thread_id: 100 }
      );
    });

    it('should throw error when session not found', async () => {
      userRepository.findByWebSessionId.mockResolvedValue(null);

      await expect(webChatService.closeTicket('invalid-session', true)).rejects.toThrow('Session not found');
    });

    it('should throw error when ticket already closed', async () => {
      const closedUser = { ...mockUser, status: 'CLOSED' };
      userRepository.findByWebSessionId.mockResolvedValue(closedUser);

      await expect(webChatService.closeTicket('session-123', true)).rejects.toThrow('Ticket already closed');
    });

    it('should not send message when no topic exists', async () => {
      const userWithoutTopic = { ...mockUser, topicId: null, status: 'IN_PROGRESS' };
      userRepository.findByWebSessionId.mockResolvedValue(userWithoutTopic);

      await webChatService.closeTicket('session-123', true);

      expect(bot.api.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('processLinkToken', () => {
    it('should link telegram account when token valid', async () => {
      const mockToken = { id: 'token-1', token: 'abc123', userId: 'user-1' };
      const linkedUser = { ...mockUser, tgUserId: BigInt(123456) };
      webLinkTokenRepository.findValidByToken.mockResolvedValue(mockToken);
      userRepository.linkTelegramAccount.mockResolvedValue(linkedUser);

      const result = await webChatService.processLinkToken('abc123', BigInt(123456), 'johndoe', 'John');

      expect(webLinkTokenRepository.markUsed).toHaveBeenCalledWith('token-1');
      expect(userRepository.linkTelegramAccount).toHaveBeenCalledWith(
        'user-1',
        BigInt(123456),
        'johndoe',
        'John'
      );
      expect(result).toEqual(linkedUser);
    });

    it('should return null when token not found', async () => {
      webLinkTokenRepository.findValidByToken.mockResolvedValue(null);

      const result = await webChatService.processLinkToken('invalid', BigInt(123456), null, 'John');

      expect(result).toBeNull();
      expect(webLinkTokenRepository.markUsed).not.toHaveBeenCalled();
    });
  });
});

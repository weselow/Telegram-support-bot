import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getBotInfo, clearBotInfoCache } from '../bot-info.service.js';

// Mock bot
vi.mock('../../bot/bot.js', () => ({
  bot: {
    api: {
      getMe: vi.fn(),
      getUserProfilePhotos: vi.fn(),
      getFile: vi.fn(),
    },
    token: 'test-bot-token',
  },
}));

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BotInfoService', () => {
  let bot: {
    api: {
      getMe: Mock;
      getUserProfilePhotos: Mock;
      getFile: Mock;
    };
    token: string;
  };

  const mockBotUser = {
    id: 123456789,
    is_bot: true,
    first_name: 'Support',
    last_name: 'Bot',
    username: 'support_bot',
  };

  const mockPhotos = {
    total_count: 1,
    photos: [[{ file_id: 'photo-file-id', width: 160, height: 160 }]],
  };

  const mockFile = {
    file_id: 'photo-file-id',
    file_path: 'photos/file_0.jpg',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    clearBotInfoCache();

    const botModule = await import('../../bot/bot.js');
    bot = botModule.bot as typeof bot;
  });

  describe('getBotInfo', () => {
    it('should return bot info with avatar', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue(mockPhotos);
      bot.api.getFile.mockResolvedValue(mockFile);

      const result = await getBotInfo();

      expect(result).toEqual({
        name: 'Support Bot',
        username: 'support_bot',
        avatarUrl: 'https://api.telegram.org/file/bottest-bot-token/photos/file_0.jpg',
      });
      expect(bot.api.getMe).toHaveBeenCalledTimes(1);
      expect(bot.api.getUserProfilePhotos).toHaveBeenCalledWith(123456789, { limit: 1 });
      expect(bot.api.getFile).toHaveBeenCalledWith('photo-file-id');
    });

    it('should return bot info without avatar when no photos', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue({ total_count: 0, photos: [] });

      const result = await getBotInfo();

      expect(result).toEqual({
        name: 'Support Bot',
        username: 'support_bot',
        avatarUrl: null,
      });
      expect(bot.api.getFile).not.toHaveBeenCalled();
    });

    it('should return bot info without avatar when getUserProfilePhotos fails', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockRejectedValue(new Error('API error'));

      const result = await getBotInfo();

      expect(result).toEqual({
        name: 'Support Bot',
        username: 'support_bot',
        avatarUrl: null,
      });
    });

    it('should return bot info with only first_name when no last_name', async () => {
      bot.api.getMe.mockResolvedValue({
        ...mockBotUser,
        last_name: undefined,
      });
      bot.api.getUserProfilePhotos.mockResolvedValue({ total_count: 0, photos: [] });

      const result = await getBotInfo();

      expect(result.name).toBe('Support');
    });

    it('should return cached info on second call', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue({ total_count: 0, photos: [] });

      const result1 = await getBotInfo();
      const result2 = await getBotInfo();

      expect(result1).toEqual(result2);
      expect(bot.api.getMe).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expires', async () => {
      vi.useFakeTimers();

      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue({ total_count: 0, photos: [] });

      await getBotInfo();
      expect(bot.api.getMe).toHaveBeenCalledTimes(1);

      // Advance time by 1 hour + 1ms (TTL is 1 hour)
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      await getBotInfo();
      expect(bot.api.getMe).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should return cached info when API fails', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue({ total_count: 0, photos: [] });

      // First call - cache the result
      const cachedResult = await getBotInfo();

      // Clear mock and simulate API failure
      vi.useFakeTimers();
      vi.advanceTimersByTime(60 * 60 * 1000 + 1); // Expire cache
      bot.api.getMe.mockRejectedValue(new Error('API error'));

      const result = await getBotInfo();

      expect(result).toEqual(cachedResult);

      vi.useRealTimers();
    });

    it('should return default fallback when API fails and no cache', async () => {
      bot.api.getMe.mockRejectedValue(new Error('API error'));

      const result = await getBotInfo();

      expect(result).toEqual({
        name: 'Поддержка',
        username: '',
        avatarUrl: null,
      });
    });
  });

  describe('clearBotInfoCache', () => {
    it('should clear cache and force refresh on next call', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue({ total_count: 0, photos: [] });

      await getBotInfo();
      expect(bot.api.getMe).toHaveBeenCalledTimes(1);

      clearBotInfoCache();

      await getBotInfo();
      expect(bot.api.getMe).toHaveBeenCalledTimes(2);
    });
  });
});

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getBotInfo, getBotAvatar, clearBotInfoCache } from '../bot-info.service.js';

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

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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
    it('should return bot info with proxy avatar URL', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);

      const result = await getBotInfo();

      expect(result).toEqual({
        name: 'Support Bot',
        username: 'support_bot',
        avatarUrl: '/api/chat/bot-avatar',
      });
      expect(bot.api.getMe).toHaveBeenCalledTimes(1);
    });

    it('should return bot info with only first_name when no last_name', async () => {
      bot.api.getMe.mockResolvedValue({
        ...mockBotUser,
        last_name: undefined,
      });

      const result = await getBotInfo();

      expect(result.name).toBe('Support');
      expect(result.avatarUrl).toBe('/api/chat/bot-avatar');
    });

    it('should return cached info on second call', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);

      const result1 = await getBotInfo();
      const result2 = await getBotInfo();

      expect(result1).toEqual(result2);
      expect(bot.api.getMe).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expires', async () => {
      vi.useFakeTimers();

      bot.api.getMe.mockResolvedValue(mockBotUser);

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
        avatarUrl: '/api/chat/bot-avatar',
      });
    });
  });

  describe('getBotAvatar', () => {
    it('should return avatar binary when bot has avatar', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue(mockPhotos);
      bot.api.getFile.mockResolvedValue(mockFile);

      const mockImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: () => Promise.resolve(mockImageData.buffer),
      });

      const result = await getBotAvatar();

      expect(result.contentType).toBe('image/png');
      expect(result.data).toBeInstanceOf(Buffer);
      expect(bot.api.getUserProfilePhotos).toHaveBeenCalledWith(123456789, { limit: 1 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/file/bottest-bot-token/photos/file_0.jpg'
      );
    });

    it('should return placeholder when bot has no photos', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue({ total_count: 0, photos: [] });

      const result = await getBotAvatar();

      expect(result.contentType).toBe('image/svg+xml');
      expect(result.data.toString()).toContain('<svg');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return placeholder when getUserProfilePhotos fails', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockRejectedValue(new Error('API error'));

      const result = await getBotAvatar();

      expect(result.contentType).toBe('image/svg+xml');
    });

    it('should return placeholder when file has no path', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue(mockPhotos);
      bot.api.getFile.mockResolvedValue({ file_id: 'photo-file-id' });

      const result = await getBotAvatar();

      expect(result.contentType).toBe('image/svg+xml');
    });

    it('should return placeholder when fetch fails', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue(mockPhotos);
      bot.api.getFile.mockResolvedValue(mockFile);
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      const result = await getBotAvatar();

      expect(result.contentType).toBe('image/svg+xml');
    });

    it('should cache avatar binary', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue(mockPhotos);
      bot.api.getFile.mockResolvedValue(mockFile);

      const mockImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: () => Promise.resolve(mockImageData.buffer),
      });

      await getBotAvatar();
      await getBotAvatar();

      expect(bot.api.getMe).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh avatar cache after TTL expires', async () => {
      vi.useFakeTimers();

      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue(mockPhotos);
      bot.api.getFile.mockResolvedValue(mockFile);

      const mockImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: () => Promise.resolve(mockImageData.buffer),
      });

      await getBotAvatar();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time by 1 hour + 1ms
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      await getBotAvatar();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('clearBotInfoCache', () => {
    it('should clear both info and avatar cache', async () => {
      bot.api.getMe.mockResolvedValue(mockBotUser);
      bot.api.getUserProfilePhotos.mockResolvedValue(mockPhotos);
      bot.api.getFile.mockResolvedValue(mockFile);

      const mockImageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: () => Promise.resolve(mockImageData.buffer),
      });

      await getBotInfo();
      await getBotAvatar();
      expect(bot.api.getMe).toHaveBeenCalledTimes(2); // Once for info, once for avatar

      clearBotInfoCache();

      await getBotInfo();
      await getBotAvatar();
      expect(bot.api.getMe).toHaveBeenCalledTimes(4); // Refreshed both
    });
  });
});

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Api } from 'grammy';
import {
  getGroupAdmins,
  formatAdminMentions,
  sendDmToAdmins,
  type AdminInfo,
} from '../group.service.js';

vi.mock('../../config/env.js', () => ({
  env: { SUPPORT_GROUP_ID: '-1001234567890' },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function admin(overrides: Partial<AdminInfo> = {}): AdminInfo {
  return {
    userId: 123,
    firstName: 'Иван',
    username: undefined,
    isOwner: false,
    ...overrides,
  };
}

describe('group.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGroupAdmins', () => {
    it('should drop bots and map the rest', async () => {
      const api = {
        getChatAdministrators: vi.fn().mockResolvedValue([
          { status: 'creator', user: { id: 1, first_name: 'Хозяин', username: 'boss', is_bot: false } },
          { status: 'administrator', user: { id: 2, first_name: 'Бот', username: 'helper_bot', is_bot: true } },
          { status: 'administrator', user: { id: 3, first_name: 'Пётр', is_bot: false } },
        ]),
      };

      const result = await getGroupAdmins(api as unknown as Api);

      expect(result).toEqual([
        { userId: 1, firstName: 'Хозяин', username: 'boss', isOwner: true },
        { userId: 3, firstName: 'Пётр', username: undefined, isOwner: false },
      ]);
    });
  });

  describe('formatAdminMentions', () => {
    it('should build an html link when the admin has no username', () => {
      const result = formatAdminMentions([admin({ userId: 42, firstName: 'Иван' })]);

      expect(result).toBe('<a href="tg://user?id=42">Иван</a>');
    });

    it('should keep a name with markdown characters readable', () => {
      // Раньше это ломало разбор: Telegram отвечал ошибкой и напоминание
      // о нарушении срока ответа до группы не доходило
      const result = formatAdminMentions([admin({ userId: 42, firstName: 'Иван _*[шеф]*_' })]);

      expect(result).toBe('<a href="tg://user?id=42">Иван _*[шеф]*_</a>');
    });

    it('should escape html characters in the name', () => {
      const result = formatAdminMentions([admin({ userId: 42, firstName: 'Ко<b>ля</b> & Ко' })]);

      expect(result).toBe('<a href="tg://user?id=42">Ко&lt;b&gt;ля&lt;/b&gt; &amp; Ко</a>');
    });

    it('should keep an underscore in a username unchanged', () => {
      // Подчёркивание разрешено в именах пользователей Telegram, а в старой
      // разметке Markdown означало курсив — @ivan_petrov ломал разбор всегда
      const result = formatAdminMentions([admin({ username: 'ivan_petrov' })]);

      expect(result).toBe('@ivan_petrov');
    });

    it('should join several admins with a space', () => {
      const result = formatAdminMentions([
        admin({ userId: 1, username: 'first_one' }),
        admin({ userId: 2, firstName: 'Второй' }),
      ]);

      expect(result).toBe('@first_one <a href="tg://user?id=2">Второй</a>');
    });

    it('should return an empty string for no admins', () => {
      expect(formatAdminMentions([])).toBe('');
    });
  });

  describe('sendDmToAdmins', () => {
    it('should send the message as html', async () => {
      const api = { sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }) };

      await sendDmToAdmins(api as unknown as Api, [admin({ userId: 7 })], 'привет');

      expect(api.sendMessage).toHaveBeenCalledWith(7, 'привет', { parse_mode: 'HTML' });
    });

    it('should keep sending to the rest when one admin blocked the bot', async () => {
      const api = {
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(new Error('bot was blocked by the user'))
          .mockResolvedValueOnce({ message_id: 2 }),
      };

      await sendDmToAdmins(
        api as unknown as Api,
        [admin({ userId: 7 }), admin({ userId: 8 })],
        'привет'
      );

      expect(api.sendMessage).toHaveBeenCalledTimes(2);
      const { logger } = await import('../../utils/logger.js');
      expect(logger.warn as unknown as Mock).toHaveBeenCalled();
    });

    it('should log an error when no admin could be reached', async () => {
      const api = { sendMessage: vi.fn().mockRejectedValue(new Error('blocked')) };

      await sendDmToAdmins(api as unknown as Api, [admin({ userId: 7 })], 'привет');

      const { logger } = await import('../../utils/logger.js');
      expect(logger.error as unknown as Mock).toHaveBeenCalled();
    });
  });
});

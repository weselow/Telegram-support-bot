import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Api } from 'grammy';
import { sendTicketCard, updateTicketCard, type TicketCardData } from '../topic.service.js';

vi.mock('../../config/env.js', () => ({
  env: {
    SUPPORT_GROUP_ID: '-1001234567890',
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('topic.service', () => {
  let api: { sendMessage: Mock; pinChatMessage: Mock; editMessageText: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    api = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 500 }),
      pinChatMessage: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    };
  });

  function sentCardText(): string {
    return api.sendMessage.mock.calls[0]?.[1] as string;
  }

  describe('sendTicketCard', () => {
    it('should send the card as HTML', async () => {
      await sendTicketCard(api as unknown as Api, 10, 'user-1', {
        tgUserId: 0,
        firstName: 'Web User',
      });

      expect(api.sendMessage.mock.calls[0]?.[2]).toMatchObject({ parse_mode: 'HTML' });
    });

    it('should keep a source url with underscores unchanged', async () => {
      await sendTicketCard(
        api as unknown as Api,
        10,
        'user-1',
        { tgUserId: 0, firstName: 'Web User' },
        { sourceUrl: 'https://shop.example.com/catalog/dell_poweredge_r740' }
      );

      expect(sentCardText()).toContain(
        '🔗 Источник: https://shop.example.com/catalog/dell_poweredge_r740'
      );
    });

    it('should escape html special characters in the source url', async () => {
      await sendTicketCard(
        api as unknown as Api,
        10,
        'user-1',
        { tgUserId: 0, firstName: 'Web User' },
        { sourceUrl: 'https://shop.example.com/search?q=<b>&size=10' }
      );

      expect(sentCardText()).toContain(
        '🔗 Источник: https://shop.example.com/search?q=&lt;b&gt;&amp;size=10'
      );
    });

    it('should escape html special characters in the user name', async () => {
      await sendTicketCard(api as unknown as Api, 10, 'user-1', {
        tgUserId: 123,
        firstName: '<script>alert(1)</script>',
        username: 'a<b',
      });

      expect(sentCardText()).toContain('👤 Пользователь: &lt;script&gt;alert(1)&lt;/script&gt;');
      expect(sentCardText()).toContain('👤 Username: @a&lt;b');
    });

    it('should render the ip as inline code', async () => {
      await sendTicketCard(
        api as unknown as Api,
        10,
        'user-1',
        { tgUserId: 0, firstName: 'Web User' },
        { sourceIp: '95.104.176.112', sourceCity: 'Саратов' }
      );

      expect(sentCardText()).toContain('🌐 IP: <code>95.104.176.112</code> (Саратов)');
    });
  });

  describe('updateTicketCard', () => {
    it('should edit the card as HTML', async () => {
      const cardData: TicketCardData = {
        tgUserId: 0,
        firstName: 'Web User',
        sourceUrl: 'https://shop.example.com/catalog/dell_poweredge_r740',
        status: 'IN_PROGRESS',
        createdAt: new Date('2026-07-29T12:00:00Z'),
      };

      await updateTicketCard(api as unknown as Api, 500, 'user-1', cardData);

      const [, , text, options] = api.editMessageText.mock.calls[0] as [
        string,
        number,
        string,
        { parse_mode: string },
      ];
      expect(options).toMatchObject({ parse_mode: 'HTML' });
      expect(text).toContain('🔗 Источник: https://shop.example.com/catalog/dell_poweredge_r740');
    });
  });
});

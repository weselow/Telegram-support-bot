import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Job } from 'bullmq';
import type { SlaJobData } from '../queues.js';

/**
 * Обработчик задачи не экспортируется, поэтому тест подменяет Worker из BullMQ
 * и забирает переданную в конструктор функцию. Заодно это проверяет, что импорт
 * модуля сам по себе не открывает соединение с Redis.
 */

type SlaProcessor = (job: Job<SlaJobData>) => Promise<void>;

let capturedProcessor: SlaProcessor | null = null;

vi.mock('bullmq', () => {
  class FakeWorker {
    on = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);

    constructor(_name: string, processor: SlaProcessor) {
      capturedProcessor = processor;
    }
  }

  return { Worker: FakeWorker };
});

vi.mock('../../config/redis.js', () => ({
  getRedisConnection: () => ({ host: 'localhost', port: 6379 }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/sentry.js', () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock('../../db/repositories/user.repository.js', () => ({
  userRepository: { findById: vi.fn() },
}));

const sendMessage = vi.fn();

vi.mock('../../bot/bot.js', () => ({
  bot: { api: { sendMessage: (...args: unknown[]) => sendMessage(...args) } },
}));

// formatAdminMentions намеренно остаётся настоящим: тест должен видеть ту же
// строку упоминаний, которая уходит в Telegram
vi.mock('../../services/group.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/group.service.js')>();
  return { ...actual, getGroupAdmins: vi.fn(), sendDmToAdmins: vi.fn() };
});

describe('sla.worker', () => {
  let findById: Mock;
  let getGroupAdmins: Mock;
  let sendDmToAdmins: Mock;

  async function runJob(data: SlaJobData): Promise<void> {
    const { startSlaWorker } = await import('../sla.worker.js');
    startSlaWorker();
    if (!capturedProcessor) {
      throw new Error('SLA worker did not register a processor');
    }
    await capturedProcessor({ id: 'job-1', data } as Job<SlaJobData>);
  }

  function sentTopicText(): string {
    return sendMessage.mock.calls[0]?.[1] as string;
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedProcessor = null;
    sendMessage.mockResolvedValue({ message_id: 1 });

    const repo = await import('../../db/repositories/user.repository.js');
    findById = repo.userRepository.findById as Mock;
    findById.mockResolvedValue({ id: 'user-1', status: 'NEW', tgFirstName: 'Пётр' });

    const group = await import('../../services/group.service.js');
    getGroupAdmins = group.getGroupAdmins as Mock;
    sendDmToAdmins = group.sendDmToAdmins as Mock;
    getGroupAdmins.mockResolvedValue([
      { userId: 42, firstName: 'Иван', username: undefined, isOwner: true },
    ]);
    sendDmToAdmins.mockResolvedValue(undefined);
  });

  describe('processSlaJob', () => {
    it('should send the topic reminder as html', async () => {
      await runJob({ userId: 'user-1', topicId: 100, level: 'first' });

      expect(sendMessage.mock.calls[0]?.[2]).toMatchObject({ parse_mode: 'HTML' });
    });

    it('should mention an admin without a username as an html link', async () => {
      await runJob({ userId: 'user-1', topicId: 100, level: 'first' });

      expect(sentTopicText()).toContain('<a href="tg://user?id=42">Иван</a>');
    });

    it('should not break on an admin name with markdown characters', async () => {
      getGroupAdmins.mockResolvedValue([
        { userId: 42, firstName: 'Иван _*[шеф]*_', username: undefined, isOwner: true },
      ]);

      await runJob({ userId: 'user-1', topicId: 100, level: 'second' });

      expect(sentTopicText()).toContain('<a href="tg://user?id=42">Иван _*[шеф]*_</a>');
    });

    it('should skip a closed ticket', async () => {
      findById.mockResolvedValue({ id: 'user-1', status: 'CLOSED', tgFirstName: 'Пётр' });

      await runJob({ userId: 'user-1', topicId: 100, level: 'first' });

      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('should skip an unknown user', async () => {
      findById.mockResolvedValue(null);

      await runJob({ userId: 'user-1', topicId: 100, level: 'first' });

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('escalation dm', () => {
    function dmText(): string {
      return sendDmToAdmins.mock.calls[0]?.[2] as string;
    }

    it('should not send a dm below the escalation level', async () => {
      await runJob({ userId: 'user-1', topicId: 100, level: 'second' });

      expect(sendDmToAdmins).not.toHaveBeenCalled();
    });

    it('should use html markup in the dm template', async () => {
      await runJob({ userId: 'user-1', topicId: 100, level: 'escalation' });

      expect(dmText()).toContain('<b>SLA BREACH</b>');
      expect(dmText()).toContain('<a href="https://t.me/c/1234567890/100">Открыть тикет</a>');
    });

    it('should escape the visitor name in the dm', async () => {
      // Имя администратора выбирает владелец группы, а это имя приходит от
      // кого угодно — самое опасное место из трёх
      findById.mockResolvedValue({
        id: 'user-1',
        status: 'NEW',
        tgFirstName: '<b>Ку</b> & <a href="http://зло">клик</a>',
      });

      await runJob({ userId: 'user-1', topicId: 100, level: 'escalation' });

      expect(dmText()).toContain(
        'Пользователь: &lt;b&gt;Ку&lt;/b&gt; &amp; &lt;a href="http://зло"&gt;клик&lt;/a&gt;'
      );
      expect(dmText()).not.toContain('<b>Ку</b>');
    });

    it('should fall back to a placeholder when the visitor has no name', async () => {
      findById.mockResolvedValue({ id: 'user-1', status: 'NEW', tgFirstName: null });

      await runJob({ userId: 'user-1', topicId: 100, level: 'escalation' });

      expect(dmText()).toContain('Пользователь: Пользователь');
    });
  });
});

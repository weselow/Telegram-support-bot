import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Очереди BullMQ открывают соединение с Redis прямо в конструкторе.
 * Поэтому здесь проверяется не только поведение обёрток, но и главное
 * требование: импорт модуля не должен создавать ни одной очереди.
 */

const queueConstructor = vi.fn();
const queueAdd = vi.fn();
const queueGetJob = vi.fn();
const queueClose = vi.fn();

vi.mock('bullmq', () => {
  class FakeQueue {
    add = queueAdd;
    getJob = queueGetJob;
    close = queueClose;

    constructor(name: string, options: unknown) {
      queueConstructor(name, options);
    }
  }

  return { Queue: FakeQueue };
});

vi.mock('../../config/redis.js', () => ({
  getRedisConnection: () => ({ host: 'localhost', port: 6379 }),
}));

async function importQueues() {
  return import('../queues.js');
}

describe('queues', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    queueAdd.mockResolvedValue({ id: 'job-1' });
    queueGetJob.mockResolvedValue(null);
    queueClose.mockResolvedValue(undefined);
  });

  describe('import', () => {
    it('should not create any queue on module import', async () => {
      await importQueues();

      expect(queueConstructor).not.toHaveBeenCalled();
    });
  });

  describe('getSlaQueue', () => {
    it('should create the sla queue on first call', async () => {
      const { getSlaQueue } = await importQueues();

      getSlaQueue();

      expect(queueConstructor).toHaveBeenCalledTimes(1);
      expect(queueConstructor).toHaveBeenCalledWith('sla', expect.anything());
    });

    it('should reuse the same queue on repeated calls', async () => {
      const { getSlaQueue } = await importQueues();

      const first = getSlaQueue();
      const second = getSlaQueue();

      expect(first).toBe(second);
      expect(queueConstructor).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAutocloseQueue', () => {
    it('should create the autoclose queue on first call', async () => {
      const { getAutocloseQueue } = await importQueues();

      getAutocloseQueue();

      expect(queueConstructor).toHaveBeenCalledTimes(1);
      expect(queueConstructor).toHaveBeenCalledWith('autoclose', expect.anything());
    });

    it('should reuse the same queue on repeated calls', async () => {
      const { getAutocloseQueue } = await importQueues();

      const first = getAutocloseQueue();
      const second = getAutocloseQueue();

      expect(first).toBe(second);
      expect(queueConstructor).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeQueues', () => {
    it('should not create queues that were never used', async () => {
      const { closeQueues } = await importQueues();

      await closeQueues();

      expect(queueConstructor).not.toHaveBeenCalled();
      expect(queueClose).not.toHaveBeenCalled();
    });

    it('should close only the queues that were created', async () => {
      const { getSlaQueue, closeQueues } = await importQueues();
      getSlaQueue();

      await closeQueues();

      expect(queueClose).toHaveBeenCalledTimes(1);
    });

    it('should close both queues when both were created', async () => {
      const { getSlaQueue, getAutocloseQueue, closeQueues } = await importQueues();
      getSlaQueue();
      getAutocloseQueue();

      await closeQueues();

      expect(queueClose).toHaveBeenCalledTimes(2);
    });

    it('should create a fresh queue after closing', async () => {
      const { getSlaQueue, closeQueues } = await importQueues();
      const first = getSlaQueue();
      await closeQueues();

      const second = getSlaQueue();

      expect(second).not.toBe(first);
      expect(queueConstructor).toHaveBeenCalledTimes(2);
    });
  });

  describe('scheduleSlaJob', () => {
    it('should add a job with delay and deterministic id', async () => {
      const { scheduleSlaJob } = await importQueues();

      const jobId = await scheduleSlaJob(
        { userId: 'user-1', topicId: 100, level: 'first' },
        600000
      );

      expect(jobId).toBe('job-1');
      expect(queueAdd).toHaveBeenCalledWith(
        'sla-user-1-first',
        { userId: 'user-1', topicId: 100, level: 'first' },
        { delay: 600000, jobId: 'sla-user-1-100-first' }
      );
    });

    it('should return empty string when job has no id', async () => {
      queueAdd.mockResolvedValue({});
      const { scheduleSlaJob } = await importQueues();

      const jobId = await scheduleSlaJob(
        { userId: 'user-1', topicId: 100, level: 'first' },
        600000
      );

      expect(jobId).toBe('');
    });
  });

  describe('scheduleAutocloseJob', () => {
    it('should add a job with delay and deterministic id', async () => {
      const { scheduleAutocloseJob } = await importQueues();

      const jobId = await scheduleAutocloseJob({ userId: 'user-1', topicId: 100 }, 3600000);

      expect(jobId).toBe('job-1');
      expect(queueAdd).toHaveBeenCalledWith(
        'autoclose-user-1',
        { userId: 'user-1', topicId: 100 },
        { delay: 3600000, jobId: 'autoclose-user-1-100' }
      );
    });
  });

  describe('cancelSlaJob', () => {
    it('should remove the job when it exists', async () => {
      const remove = vi.fn().mockResolvedValue(undefined);
      queueGetJob.mockResolvedValue({ remove });
      const { cancelSlaJob } = await importQueues();

      await cancelSlaJob('user-1', 100, 'second');

      expect(queueGetJob).toHaveBeenCalledWith('sla-user-1-100-second');
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when the job is missing', async () => {
      queueGetJob.mockResolvedValue(null);
      const { cancelSlaJob } = await importQueues();

      await expect(cancelSlaJob('user-1', 100, 'second')).resolves.toBeUndefined();
    });
  });

  describe('cancelAutocloseJob', () => {
    it('should remove the job when it exists', async () => {
      const remove = vi.fn().mockResolvedValue(undefined);
      queueGetJob.mockResolvedValue({ remove });
      const { cancelAutocloseJob } = await importQueues();

      await cancelAutocloseJob('user-1', 100);

      expect(queueGetJob).toHaveBeenCalledWith('autoclose-user-1-100');
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when the job is missing', async () => {
      queueGetJob.mockResolvedValue(null);
      const { cancelAutocloseJob } = await importQueues();

      await expect(cancelAutocloseJob('user-1', 100)).resolves.toBeUndefined();
    });
  });
});

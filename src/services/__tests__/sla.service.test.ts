import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { startSlaTimers, cancelAllSlaTimers } from '../sla.service.js';

// Mock queues
vi.mock('../../jobs/queues.js', () => ({
  scheduleSlaJob: vi.fn(),
  cancelSlaJob: vi.fn(),
}));

// Mock settings
vi.mock('../../config/settings.js', () => ({
  slaTimings: {
    firstMs: 600000, // 10 min
    secondMs: 1800000, // 30 min
    escalationMs: 7200000, // 2 hours
  },
}));

describe('SlaService', () => {
  let scheduleSlaJob: Mock;
  let cancelSlaJob: Mock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const queues = await import('../../jobs/queues.js');
    scheduleSlaJob = queues.scheduleSlaJob as Mock;
    cancelSlaJob = queues.cancelSlaJob as Mock;
  });

  describe('startSlaTimers', () => {
    it('should schedule all three SLA jobs', async () => {
      scheduleSlaJob.mockResolvedValue({});

      const result = await startSlaTimers('user-1', 100);

      expect(result).toBe(true);
      expect(scheduleSlaJob).toHaveBeenCalledTimes(3);
      expect(scheduleSlaJob).toHaveBeenCalledWith(
        { userId: 'user-1', topicId: 100, level: 'first' },
        600000
      );
      expect(scheduleSlaJob).toHaveBeenCalledWith(
        { userId: 'user-1', topicId: 100, level: 'second' },
        1800000
      );
      expect(scheduleSlaJob).toHaveBeenCalledWith(
        { userId: 'user-1', topicId: 100, level: 'escalation' },
        7200000
      );
    });

    it('should return false on scheduling error', async () => {
      scheduleSlaJob.mockRejectedValue(new Error('Redis error'));

      const result = await startSlaTimers('user-1', 100);

      expect(result).toBe(false);
    });

    it('should fail if any job scheduling fails', async () => {
      scheduleSlaJob
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Redis error'))
        .mockResolvedValueOnce({});

      const result = await startSlaTimers('user-1', 100);

      expect(result).toBe(false);
    });
  });

  describe('cancelAllSlaTimers', () => {
    it('should cancel all three SLA jobs', async () => {
      cancelSlaJob.mockResolvedValue(undefined);

      await cancelAllSlaTimers('user-1', 100);

      expect(cancelSlaJob).toHaveBeenCalledTimes(3);
      expect(cancelSlaJob).toHaveBeenCalledWith('user-1', 100, 'first');
      expect(cancelSlaJob).toHaveBeenCalledWith('user-1', 100, 'second');
      expect(cancelSlaJob).toHaveBeenCalledWith('user-1', 100, 'escalation');
    });

    it('should not throw if some cancellations fail', async () => {
      cancelSlaJob
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Job not found'))
        .mockResolvedValueOnce(undefined);

      await expect(cancelAllSlaTimers('user-1', 100)).resolves.not.toThrow();
    });

    it('should handle all cancellations failing', async () => {
      cancelSlaJob.mockRejectedValue(new Error('Redis error'));

      await expect(cancelAllSlaTimers('user-1', 100)).resolves.not.toThrow();
    });
  });
});

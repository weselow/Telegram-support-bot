import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOnboardingState,
  setOnboardingState,
  clearOnboardingState,
  updateOnboardingStep,
  type OnboardingState,
} from '../onboarding.service.js';

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

vi.mock('../../config/redis-client.js', () => ({
  getRedisClient: () => mockRedis,
}));

describe('OnboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOnboardingState', () => {
    it('should return null when no state exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getOnboardingState(BigInt(123456));

      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('onboarding:123456');
    });

    it('should return parsed state when exists', async () => {
      const state: OnboardingState = {
        step: 'awaiting_question',
        sourceUrl: 'https://example.com',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(state));

      const result = await getOnboardingState(BigInt(123456));

      expect(result).toEqual(state);
    });

    it('should return null on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getOnboardingState(BigInt(123456));

      expect(result).toBeNull();
    });
  });

  describe('setOnboardingState', () => {
    it('should save state with TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const state: OnboardingState = {
        step: 'awaiting_phone',
        sourceUrl: 'https://example.com',
      };

      await setOnboardingState(BigInt(123456), state);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'onboarding:123456',
        3600,
        JSON.stringify(state)
      );
    });

    it('should throw on Redis error', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const state: OnboardingState = { step: 'awaiting_question' };

      await expect(setOnboardingState(BigInt(123456), state)).rejects.toThrow('Redis error');
    });
  });

  describe('clearOnboardingState', () => {
    it('should delete state from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await clearOnboardingState(BigInt(123456));

      expect(mockRedis.del).toHaveBeenCalledWith('onboarding:123456');
    });

    it('should not throw on Redis error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(clearOnboardingState(BigInt(123456))).resolves.not.toThrow();
    });
  });

  describe('updateOnboardingStep', () => {
    it('should update step in existing state', async () => {
      const state: OnboardingState = {
        step: 'awaiting_question',
        sourceUrl: 'https://example.com',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(state));
      mockRedis.setex.mockResolvedValue('OK');

      await updateOnboardingStep(BigInt(123456), 'awaiting_phone');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'onboarding:123456',
        3600,
        JSON.stringify({
          step: 'awaiting_phone',
          sourceUrl: 'https://example.com',
        })
      );
    });

    it('should do nothing if no state exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      await updateOnboardingStep(BigInt(123456), 'awaiting_phone');

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });
});

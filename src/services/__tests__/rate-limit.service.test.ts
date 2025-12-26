import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};

vi.mock('../../config/redis-client.js', () => ({
  getRedisClient: () => mockRedis,
}));

// Import after mocking
const { checkRateLimit } = await import('../rate-limit.service.js');

describe('rate-limit.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);

      const result = await checkRateLimit(BigInt(123456));

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(mockRedis.incr).toHaveBeenCalledWith('rate:user:123456');
      expect(mockRedis.expire).toHaveBeenCalledWith('rate:user:123456', 60);
    });

    it('should allow request at limit boundary', async () => {
      mockRedis.incr.mockResolvedValue(10);
      mockRedis.ttl.mockResolvedValue(30);

      const result = await checkRateLimit(BigInt(123456));

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should deny request when over limit', async () => {
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(45);

      const result = await checkRateLimit(BigInt(123456));

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetInSeconds).toBe(45);
    });

    it('should set expire only on first request', async () => {
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.ttl.mockResolvedValue(30);

      await checkRateLimit(BigInt(123456));

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should fail open when Redis is unavailable', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Connection refused'));

      const result = await checkRateLimit(BigInt(123456));

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should handle different user IDs correctly', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);

      await checkRateLimit(BigInt(111));
      await checkRateLimit(BigInt(222));

      expect(mockRedis.incr).toHaveBeenCalledWith('rate:user:111');
      expect(mockRedis.incr).toHaveBeenCalledWith('rate:user:222');
    });
  });
});

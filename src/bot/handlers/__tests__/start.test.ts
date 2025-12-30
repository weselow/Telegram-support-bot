import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Context } from 'grammy';
import { startHandler } from '../start.js';

// Mock dependencies
vi.mock('../../../services/onboarding.service.js', () => ({
  setOnboardingState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../http/routes/ask-support.js', () => ({
  getRedirectData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

type MockContext = {
  reply: Mock;
  match?: string;
  from?: {
    id: number;
    first_name: string;
    is_bot: boolean;
  };
};

describe('startHandler', () => {
  let mockCtx: MockContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = {
      reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
      from: {
        id: 123456,
        first_name: 'TestUser',
        is_bot: false,
      },
    };
  });

  it('should send welcome message', async () => {
    await startHandler(mockCtx as unknown as Context);

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Здравствуйте')
    );
  });

  it('should mention support in welcome', async () => {
    await startHandler(mockCtx as unknown as Context);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('поддержка')
    );
  });

  it('should start onboarding', async () => {
    const { setOnboardingState } = await import('../../../services/onboarding.service.js');

    await startHandler(mockCtx as unknown as Context);

    expect(setOnboardingState).toHaveBeenCalledWith(
      BigInt(123456),
      expect.objectContaining({ step: 'awaiting_question' })
    );
  });

  it('should not reply when from is undefined', async () => {
    const ctxWithoutFrom: MockContext = {
      reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
    };

    await startHandler(ctxWithoutFrom as unknown as Context);

    expect(ctxWithoutFrom.reply).not.toHaveBeenCalled();
  });

  describe('payload handling', () => {
    it('should store redirect context when valid payload has data', async () => {
      const { getRedirectData } = await import('../../../http/routes/ask-support.js');
      const { setOnboardingState } = await import('../../../services/onboarding.service.js');
      const { logger } = await import('../../../utils/logger.js');

      vi.mocked(getRedirectData).mockResolvedValueOnce({
        ip: '8.8.8.8',
        sourceUrl: 'https://example.com',
        city: 'Москва',
        geoipResponse: null,
        createdAt: '2025-12-27T12:00:00.000Z',
      });

      const ctxWithPayload: MockContext = {
        reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
        match: 'abc12345', // Valid 8-char hex
        from: {
          id: 123456,
          first_name: 'TestUser',
          is_bot: false,
        },
      };

      await startHandler(ctxWithPayload as unknown as Context);

      expect(getRedirectData).toHaveBeenCalledWith('abc12345');
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '8.8.8.8', city: 'Москва' }),
        'User arrived from website redirect',
      );
      expect(setOnboardingState).toHaveBeenCalledWith(
        BigInt(123456),
        expect.objectContaining({
          step: 'awaiting_question',
          sourceUrl: 'https://example.com',
          sourceCity: 'Москва',
          ip: '8.8.8.8',
        }),
      );
    });

    it('should use default state when valid payload has no data', async () => {
      const { getRedirectData } = await import('../../../http/routes/ask-support.js');
      const { setOnboardingState } = await import('../../../services/onboarding.service.js');
      const { logger } = await import('../../../utils/logger.js');

      vi.mocked(getRedirectData).mockResolvedValueOnce(null);

      const ctxWithPayload: MockContext = {
        reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
        match: 'deadbeef', // Valid 8-char hex
        from: {
          id: 123456,
          first_name: 'TestUser',
          is_bot: false,
        },
      };

      await startHandler(ctxWithPayload as unknown as Context);

      expect(getRedirectData).toHaveBeenCalledWith('deadbeef');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ payload: 'deadbeef' }),
        'No redirect data found for payload',
      );
      expect(setOnboardingState).toHaveBeenCalledWith(
        BigInt(123456),
        { step: 'awaiting_question' },
      );
    });

    it('should skip lookup for invalid payload format', async () => {
      const { getRedirectData } = await import('../../../http/routes/ask-support.js');
      const { setOnboardingState } = await import('../../../services/onboarding.service.js');

      vi.mocked(getRedirectData).mockClear();

      const ctxWithInvalidPayload: MockContext = {
        reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
        match: 'not-valid-hex!', // Not 8-char hex
        from: {
          id: 123456,
          first_name: 'TestUser',
          is_bot: false,
        },
      };

      await startHandler(ctxWithInvalidPayload as unknown as Context);

      expect(getRedirectData).not.toHaveBeenCalled();
      expect(setOnboardingState).toHaveBeenCalledWith(
        BigInt(123456),
        { step: 'awaiting_question' },
      );
    });

    it('should skip lookup for too short payload', async () => {
      const { getRedirectData } = await import('../../../http/routes/ask-support.js');

      vi.mocked(getRedirectData).mockClear();

      const ctxWithShortPayload: MockContext = {
        reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
        match: 'abc', // Too short
        from: {
          id: 123456,
          first_name: 'TestUser',
          is_bot: false,
        },
      };

      await startHandler(ctxWithShortPayload as unknown as Context);

      expect(getRedirectData).not.toHaveBeenCalled();
    });

    it('should handle empty payload', async () => {
      const { getRedirectData } = await import('../../../http/routes/ask-support.js');
      const { setOnboardingState } = await import('../../../services/onboarding.service.js');

      vi.mocked(getRedirectData).mockClear();

      const ctxWithEmptyPayload: MockContext = {
        reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
        match: '',
        from: {
          id: 123456,
          first_name: 'TestUser',
          is_bot: false,
        },
      };

      await startHandler(ctxWithEmptyPayload as unknown as Context);

      expect(getRedirectData).not.toHaveBeenCalled();
      expect(setOnboardingState).toHaveBeenCalledWith(
        BigInt(123456),
        { step: 'awaiting_question' },
      );
    });

    it('should handle redirect data with partial fields', async () => {
      const { getRedirectData } = await import('../../../http/routes/ask-support.js');
      const { setOnboardingState } = await import('../../../services/onboarding.service.js');

      vi.mocked(getRedirectData).mockResolvedValueOnce({
        ip: '1.2.3.4',
        sourceUrl: null,
        city: null,
        geoipResponse: null,
        createdAt: '2025-12-27T12:00:00.000Z',
      });

      const ctxWithPayload: MockContext = {
        reply: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
        match: 'abc12345',
        from: {
          id: 123456,
          first_name: 'TestUser',
          is_bot: false,
        },
      };

      await startHandler(ctxWithPayload as unknown as Context);

      // Only ip should be set, not sourceUrl or sourceCity
      expect(setOnboardingState).toHaveBeenCalledWith(
        BigInt(123456),
        expect.objectContaining({
          step: 'awaiting_question',
          ip: '1.2.3.4',
        }),
      );

      // Verify sourceUrl and sourceCity are NOT in the call
      const call = vi.mocked(setOnboardingState).mock.calls[0];
      expect(call?.[1]).not.toHaveProperty('sourceUrl');
      expect(call?.[1]).not.toHaveProperty('sourceCity');
    });
  });
});

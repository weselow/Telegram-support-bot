import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Context } from 'grammy';
import { startHandler } from '../start.js';

// Mock onboarding service to avoid Redis connection
vi.mock('../../../services/onboarding.service.js', () => ({
  setOnboardingState: vi.fn().mockResolvedValue(undefined),
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
      expect.stringContaining('Привет')
    );
  });

  it('should ask how to help', async () => {
    await startHandler(mockCtx as unknown as Context);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('помочь')
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
});

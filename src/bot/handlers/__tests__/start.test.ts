import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Context } from 'grammy';
import { startHandler } from '../start.js';

type MockContext = {
  reply: jest.Mock;
  from?: {
    id: number;
    first_name: string;
    is_bot: boolean;
  };
};

describe('startHandler', () => {
  let mockCtx: MockContext;

  beforeEach(() => {
    mockCtx = {
      reply: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
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

  it('should ask user to describe their issue', async () => {
    await startHandler(mockCtx as unknown as Context);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('проблем')
    );
  });

  it('should greet user by first name when available', async () => {
    await startHandler(mockCtx as unknown as Context);

    expect(mockCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('TestUser')
    );
  });

  it('should use default name when from is undefined', async () => {
    const ctxWithoutFrom: MockContext = {
      reply: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    };

    await startHandler(ctxWithoutFrom as unknown as Context);

    expect(ctxWithoutFrom.reply).toHaveBeenCalledWith(
      expect.stringContaining('пользователь')
    );
  });
});

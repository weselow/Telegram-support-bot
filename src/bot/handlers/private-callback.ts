import type { Context } from 'grammy';
import { resolveCallbackHandler } from './resolve.js';
import { phoneConfirmHandler, phoneChangeHandler } from './phone.js';
import { messages } from '../../config/messages.js';

export async function privateCallbackHandler(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery?.data) {
    return;
  }

  const data = ctx.callbackQuery.data;

  if (data.startsWith('resolve:')) {
    return resolveCallbackHandler(ctx);
  }

  if (data.startsWith('phone_confirm:')) {
    return phoneConfirmHandler(ctx);
  }

  if (data.startsWith('phone_change:')) {
    return phoneChangeHandler(ctx);
  }

  await ctx.answerCallbackQuery({ text: messages.callbacks.unknownCommand });
}

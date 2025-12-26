import type { Context } from 'grammy';
import { messages, formatMessage } from '../../config/messages.js';

export async function startHandler(ctx: Context): Promise<void> {
  const firstName = ctx.from?.first_name ?? 'пользователь';

  await ctx.reply(formatMessage(messages.welcome, { firstName }));
}

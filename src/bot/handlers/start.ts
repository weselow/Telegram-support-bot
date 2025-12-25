import type { Context } from 'grammy';

export async function startHandler(ctx: Context): Promise<void> {
  const firstName = ctx.from?.first_name ?? 'пользователь';

  await ctx.reply(
    `Здравствуйте, ${firstName}!\n\n` +
      'Это бот технической поддержки. ' +
      'Опишите вашу проблему, и мы постараемся помочь.'
  );
}

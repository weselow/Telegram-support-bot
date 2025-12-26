import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { startHandler } from './handlers/start.js';
import { privateMessageHandler } from './handlers/message.js';
import { supportMessageHandler } from './handlers/support.js';
import { callbackHandler } from './handlers/callback.js';

export const bot = new Bot(env.BOT_TOKEN);

bot.command('start', startHandler);

// Handle private messages (DM)
bot.on('message').filter(
  (ctx) => ctx.chat.type === 'private',
  privateMessageHandler
);

// Handle support group messages (topic → user)
bot.on('message').filter(
  (ctx) => ctx.chat.type === 'supergroup' && String(ctx.chat.id) === env.SUPPORT_GROUP_ID,
  supportMessageHandler
);

// Handle callback queries (status buttons)
bot.on('callback_query:data').filter(
  (ctx) => ctx.chat?.type === 'supergroup' && String(ctx.chat.id) === env.SUPPORT_GROUP_ID,
  callbackHandler
);

bot.catch((err) => {
  const ctx = err.ctx;
  logger.error({ updateId: ctx.update.update_id }, 'Error while handling update');

  const e = err.error;
  if (e instanceof GrammyError) {
    logger.error({ description: e.description }, 'Error in request');
  } else if (e instanceof HttpError) {
    logger.error({ error: e.message }, 'Could not contact Telegram');
  } else {
    logger.error({ error: e }, 'Unknown error');
  }
});

export async function startBot(): Promise<void> {
  logger.info('Starting bot with long polling...');
  await bot.start({
    onStart: (botInfo) => {
      logger.info({ username: botInfo.username }, 'Bot started successfully');
    },
  });
}

export async function stopBot(): Promise<void> {
  logger.info('Stopping bot...');
  await bot.stop();
  logger.info('Bot stopped');
}

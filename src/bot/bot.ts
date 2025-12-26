import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { startHandler } from './handlers/start.js';
import { privateMessageHandler } from './handlers/message.js';
import { supportMessageHandler } from './handlers/support.js';
import { callbackHandler } from './handlers/callback.js';
import { privateEditHandler, supportEditHandler } from './handlers/edit.js';
import { privateCallbackHandler } from './handlers/private-callback.js';
import { contactHandler } from './handlers/phone.js';
import { historyHandler } from './handlers/history.js';

export const bot = new Bot(env.BOT_TOKEN);

bot.command('start', startHandler);

// Handle /history command in support group
bot.command('history').filter(
  (ctx) => ctx.chat.type === 'supergroup' && String(ctx.chat.id) === env.SUPPORT_GROUP_ID,
  historyHandler
);

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

// Handle callback queries (status buttons in support group)
bot.on('callback_query:data').filter(
  (ctx) => ctx.chat?.type === 'supergroup' && String(ctx.chat.id) === env.SUPPORT_GROUP_ID,
  callbackHandler
);

// Handle callback queries in private chat (resolve, phone confirm/change)
bot.on('callback_query:data').filter(
  (ctx) => ctx.chat?.type === 'private',
  privateCallbackHandler
);

// Handle contact sharing in private chat
bot.on('message:contact').filter(
  (ctx) => ctx.chat.type === 'private',
  contactHandler
);

// Handle edited messages in private chat (user → topic)
bot.on('edit:text').filter(
  (ctx) => ctx.chat.type === 'private',
  privateEditHandler
);

bot.on('edit:caption').filter(
  (ctx) => ctx.chat.type === 'private',
  privateEditHandler
);

// Handle edited messages in support group (support → user DM)
bot.on('edit:text').filter(
  (ctx) => ctx.chat.type === 'supergroup' && String(ctx.chat.id) === env.SUPPORT_GROUP_ID,
  supportEditHandler
);

bot.on('edit:caption').filter(
  (ctx) => ctx.chat.type === 'supergroup' && String(ctx.chat.id) === env.SUPPORT_GROUP_ID,
  supportEditHandler
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

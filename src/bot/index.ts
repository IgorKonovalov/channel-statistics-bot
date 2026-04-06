import { Telegraf } from 'telegraf';
import { config } from '../config';
import { logger } from '../logger';
import { errorHandler } from './middleware/error-handler';
import { loggerMiddleware } from './middleware/logger';
import { registerPostListener } from './collectors/post-reactions';

export function createBot(): Telegraf {
  const bot = new Telegraf(config.botToken);

  bot.catch((err) => {
    logger.error({ err }, 'Unhandled bot error');
  });

  bot.use(errorHandler());
  bot.use(loggerMiddleware());

  registerPostListener(bot);

  return bot;
}

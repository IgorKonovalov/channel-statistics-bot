import { Telegraf } from 'telegraf';
import { config } from '../config';
import { errorHandler } from './middleware/error-handler';
import { loggerMiddleware } from './middleware/logger';
import { registerPostListener } from './collectors/post-views';

export function createBot(): Telegraf {
  const bot = new Telegraf(config.botToken);

  bot.use(errorHandler());
  bot.use(loggerMiddleware());

  registerPostListener(bot);

  return bot;
}

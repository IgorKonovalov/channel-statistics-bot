import { Context } from 'telegraf';
import { logger } from '../../logger';

export function loggerMiddleware() {
  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    logger.debug({ updateType: ctx.updateType }, 'Bot update received');
    await next();
  };
}

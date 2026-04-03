import { Context } from 'telegraf';
import { logger } from '../../logger';

export function errorHandler() {
  return async (_ctx: Context, next: () => Promise<void>): Promise<void> => {
    try {
      await next();
    } catch (error) {
      logger.error({ err: error }, 'Bot middleware error');
    }
  };
}

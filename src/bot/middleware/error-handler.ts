import { Context } from 'telegraf';

export function errorHandler() {
  return async (_ctx: Context, next: () => Promise<void>): Promise<void> => {
    try {
      await next();
    } catch (error) {
      console.error('Bot error:', error);
    }
  };
}

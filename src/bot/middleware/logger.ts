import { Context } from 'telegraf';

export function loggerMiddleware() {
  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const updateType = ctx.updateType;
    console.log(`[bot] update: ${updateType}`);
    await next();
  };
}

import { Telegraf } from 'telegraf';
import { config } from '../config';
import { collectMemberCount } from '../bot/collectors/member-count';
import { refreshPostViews } from '../bot/collectors/post-views';

export function startCollector(bot: Telegraf): { stop: () => void } {
  // Collect member count immediately, then every 2 hours
  collectMemberCount(bot);
  const memberInterval = setInterval(
    () => collectMemberCount(bot),
    config.collectionIntervalMs
  );

  // Refresh post views every 30 minutes
  const viewsInterval = setInterval(
    () => refreshPostViews(bot),
    config.viewsCheckIntervalMs
  );

  console.log(
    `[collector] Started — member count every ${config.collectionIntervalMs / 60000}min, views every ${config.viewsCheckIntervalMs / 60000}min`
  );

  return {
    stop() {
      clearInterval(memberInterval);
      clearInterval(viewsInterval);
    },
  };
}

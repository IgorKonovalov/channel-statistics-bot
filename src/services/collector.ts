import { Telegraf } from 'telegraf';
import { config } from '../config';
import { collectMemberCount } from '../bot/collectors/member-count';

export function startCollector(bot: Telegraf): { stop: () => void } {
  // Collect member count immediately, then every 2 hours
  collectMemberCount(bot);
  const memberInterval = setInterval(
    () => collectMemberCount(bot),
    config.collectionIntervalMs
  );

  console.log(
    `[collector] Started — member count every ${config.collectionIntervalMs / 60000}min, views via channel events`
  );

  return {
    stop() {
      clearInterval(memberInterval);
    },
  };
}

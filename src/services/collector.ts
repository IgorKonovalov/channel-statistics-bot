import { Telegraf } from 'telegraf';
import { config } from '../config';
import { logger } from '../logger';
import { collectMemberCount } from '../bot/collectors/member-count';

export function startCollector(bot: Telegraf): { stop: () => void } {
  // Collect member count immediately, then every 2 hours
  collectMemberCount(bot);
  const memberInterval = setInterval(() => collectMemberCount(bot), config.collectionIntervalMs);

  logger.info(
    { intervalMin: config.collectionIntervalMs / 60000 },
    'Collector started — member count on interval, views via channel events',
  );

  return {
    stop() {
      clearInterval(memberInterval);
    },
  };
}

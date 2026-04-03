import './config';
import { logger } from './logger';
import { getDb, closeDb } from './db/connection';
import { runMigrations } from './db/schema';
import { createBot } from './bot';
import { startCollector } from './services/collector';
import { startDashboard } from './dashboard/server';

async function main(): Promise<void> {
  logger.info('Starting channel-statistics-bot...');

  // Initialize database
  const db = getDb();
  runMigrations(db);
  logger.info('Database ready');

  // Start bot (launch returns a promise that resolves when polling starts)
  const bot = createBot();
  bot.launch().then(() => logger.info('Bot polling started'));
  logger.info('Bot starting...');

  // Start data collection
  const collector = startCollector(bot);

  // Start dashboard
  await startDashboard();

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down...');
    collector.stop();
    bot.stop(signal);
    closeDb();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Fatal error');
  process.exit(1);
});

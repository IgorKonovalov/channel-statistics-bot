import './config';
import { getDb, closeDb } from './db/connection';
import { runMigrations } from './db/schema';
import { createBot } from './bot';
import { startCollector } from './services/collector';
import { startDashboard } from './dashboard/server';

async function main(): Promise<void> {
  console.log('[app] Starting channel-statistics-bot...');

  // Initialize database
  const db = getDb();
  runMigrations(db);
  console.log('[app] Database ready');

  // Start bot (launch returns a promise that resolves when polling starts)
  const bot = createBot();
  bot.launch().then(() => console.log('[app] Bot polling started'));
  console.log('[app] Bot starting...');

  // Start data collection
  const collector = startCollector(bot);

  // Start dashboard
  await startDashboard();

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    console.log(`[app] Received ${signal}, shutting down...`);
    collector.stop();
    bot.stop(signal);
    closeDb();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[app] Fatal error:', error);
  process.exit(1);
});

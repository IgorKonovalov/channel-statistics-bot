import { config } from './config';
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

  // Start bot
  const bot = createBot();
  await bot.launch();
  console.log('[app] Bot started');

  // Start data collection
  const collector = startCollector(bot);

  // Start dashboard
  await startDashboard();

  // Graceful shutdown
  const shutdown = (signal: string) => {
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

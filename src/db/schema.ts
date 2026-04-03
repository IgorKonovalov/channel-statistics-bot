import type Database from 'better-sqlite3';
import { logger } from '../logger';

const MIGRATIONS = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        added_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS member_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL REFERENCES channels(id),
        count INTEGER NOT NULL,
        recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_member_snapshots_channel_date
        ON member_snapshots(channel_id, recorded_at);

      CREATE TABLE IF NOT EXISTS post_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL REFERENCES channels(id),
        message_id INTEGER NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        forwards INTEGER NOT NULL DEFAULT 0,
        recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_post_snapshots_channel_date
        ON post_snapshots(channel_id, recorded_at);

      CREATE INDEX IF NOT EXISTS idx_post_snapshots_message
        ON post_snapshots(channel_id, message_id);
    `,
  },
  {
    version: 2,
    up: `
      ALTER TABLE post_snapshots ADD COLUMN reactions INTEGER NOT NULL DEFAULT 0;
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as
    | { v: number | null }
    | undefined;
  const currentVersion = row?.v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      db.transaction(() => {
        db.exec(migration.up);
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
      })();
      logger.info({ version: migration.version }, 'Migration applied');
    }
  }
}

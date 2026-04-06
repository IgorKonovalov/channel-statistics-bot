import fs from 'fs';
import path from 'path';
import { getDb } from '../db/connection';
import { config } from '../config';
import { logger } from '../logger';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_BACKUPS = 7;

function getBackupDir(): string {
  return path.join(path.dirname(config.dbPath), 'backups');
}

export function runBackup(): void {
  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `stats-${timestamp}.db`);

  try {
    getDb().backup(backupPath);
    logger.info({ backupPath }, 'Database backup completed');
    pruneOldBackups(backupDir);
  } catch (err) {
    logger.error({ err }, 'Database backup failed');
  }
}

function pruneOldBackups(backupDir: string): void {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('stats-') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const file of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(backupDir, file));
    logger.info({ file }, 'Pruned old backup');
  }
}

export function startBackupSchedule(): { stop: () => void } {
  // Run first backup after 1 minute (let the app settle)
  const initialTimeout = setTimeout(() => runBackup(), 60 * 1000);
  const interval = setInterval(() => runBackup(), BACKUP_INTERVAL_MS);

  logger.info(
    { intervalHours: BACKUP_INTERVAL_MS / 3600000, maxBackups: MAX_BACKUPS },
    'DB backup schedule started',
  );

  return {
    stop() {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    },
  };
}

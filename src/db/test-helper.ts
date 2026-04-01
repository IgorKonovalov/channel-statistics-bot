import Database from 'better-sqlite3';
import { setDb, closeDb } from './connection';
import { runMigrations } from './schema';

export function setupTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  setDb(db);
  runMigrations(db);
  return db;
}

export function teardownTestDb(): void {
  closeDb();
}

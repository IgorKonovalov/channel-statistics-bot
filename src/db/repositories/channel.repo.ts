import { getDb } from '../connection';

export interface Channel {
  id: string;
  title: string;
  added_at: string;
}

export function upsertChannel(id: string, title: string): void {
  getDb()
    .prepare(
      `INSERT INTO channels (id, title) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title`,
    )
    .run(id, title);
}

export function ensureChannel(id: string): void {
  getDb().prepare('INSERT OR IGNORE INTO channels (id, title) VALUES (?, ?)').run(id, '');
}

export function getChannel(id: string): Channel | undefined {
  return getDb().prepare('SELECT * FROM channels WHERE id = ?').get(id) as Channel | undefined;
}

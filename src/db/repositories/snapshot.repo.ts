import { getDb } from '../connection';

export interface MemberSnapshot {
  id: number;
  channel_id: string;
  count: number;
  recorded_at: string;
}

export interface PostSnapshot {
  id: number;
  channel_id: string;
  message_id: number;
  views: number;
  forwards: number;
  recorded_at: string;
}

export function insertMemberSnapshot(channelId: string, count: number): void {
  getDb()
    .prepare('INSERT INTO member_snapshots (channel_id, count) VALUES (?, ?)')
    .run(channelId, count);
}

export function getMemberSnapshots(
  channelId: string,
  fromDate: string,
  toDate: string
): MemberSnapshot[] {
  return getDb()
    .prepare(
      `SELECT * FROM member_snapshots
       WHERE channel_id = ? AND recorded_at BETWEEN ? AND ?
       ORDER BY recorded_at ASC`
    )
    .all(channelId, fromDate, toDate) as MemberSnapshot[];
}

export function insertPostSnapshot(
  channelId: string,
  messageId: number,
  views: number,
  forwards: number
): void {
  getDb()
    .prepare(
      'INSERT INTO post_snapshots (channel_id, message_id, views, forwards) VALUES (?, ?, ?, ?)'
    )
    .run(channelId, messageId, views, forwards);
}

export function getViewsAggregated(
  channelId: string,
  fromDate: string,
  toDate: string
): { date: string; total_views: number }[] {
  return getDb()
    .prepare(
      `SELECT date(recorded_at) as date, SUM(views) as total_views
       FROM post_snapshots
       WHERE channel_id = ? AND recorded_at BETWEEN ? AND ?
       GROUP BY date(recorded_at)
       ORDER BY date ASC`
    )
    .all(channelId, fromDate, toDate) as { date: string; total_views: number }[];
}

export function getLatestPostSnapshot(
  channelId: string,
  messageId: number
): PostSnapshot | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM post_snapshots
       WHERE channel_id = ? AND message_id = ?
       ORDER BY recorded_at DESC LIMIT 1`
    )
    .get(channelId, messageId) as PostSnapshot | undefined;
}

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
  reactions: number;
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
  toDate: string,
): MemberSnapshot[] {
  return getDb()
    .prepare(
      `SELECT * FROM member_snapshots
       WHERE channel_id = ? AND recorded_at BETWEEN ? AND ?
       ORDER BY recorded_at ASC`,
    )
    .all(channelId, fromDate, toDate) as MemberSnapshot[];
}

export function insertPostSnapshot(
  channelId: string,
  messageId: number,
  views: number,
  forwards: number,
  reactions: number,
): void {
  getDb()
    .prepare(
      'INSERT INTO post_snapshots (channel_id, message_id, views, forwards, reactions) VALUES (?, ?, ?, ?, ?)',
    )
    .run(channelId, messageId, views, forwards, reactions);
}

export function getViewsAggregated(
  channelId: string,
  fromDate: string,
  toDate: string,
): { date: string; total_views: number }[] {
  return getDb()
    .prepare(
      `SELECT date(recorded_at) as date, SUM(views) as total_views
       FROM post_snapshots
       WHERE channel_id = ? AND recorded_at BETWEEN ? AND ?
       GROUP BY date(recorded_at)
       ORDER BY date ASC`,
    )
    .all(channelId, fromDate, toDate) as { date: string; total_views: number }[];
}

export function getReactionsAggregated(
  channelId: string,
  fromDate: string,
  toDate: string,
): { date: string; total_reactions: number }[] {
  return getDb()
    .prepare(
      `SELECT date(recorded_at) as date, SUM(reactions) as total_reactions
       FROM post_snapshots
       WHERE channel_id = ? AND recorded_at BETWEEN ? AND ?
       GROUP BY date(recorded_at)
       ORDER BY date ASC`,
    )
    .all(channelId, fromDate, toDate) as { date: string; total_reactions: number }[];
}

export function getForwardsAggregated(
  channelId: string,
  fromDate: string,
  toDate: string,
): { date: string; total_forwards: number }[] {
  return getDb()
    .prepare(
      `SELECT date(recorded_at) as date, SUM(forwards) as total_forwards
       FROM post_snapshots
       WHERE channel_id = ? AND recorded_at BETWEEN ? AND ?
       GROUP BY date(recorded_at)
       ORDER BY date ASC`,
    )
    .all(channelId, fromDate, toDate) as { date: string; total_forwards: number }[];
}

export interface PostBreakdownRow {
  message_id: number;
  views: number;
  forwards: number;
  reactions: number;
  latest_at: string;
  text: string | null;
  post_date: string | null;
  post_url: string | null;
}

export function getPostBreakdown(
  channelId: string,
  fromDate: string,
  toDate: string,
  sortBy: string = 'views',
): PostBreakdownRow[] {
  const allowedSorts: Record<string, string> = {
    views: 'views DESC',
    forwards: 'forwards DESC',
    reactions: 'reactions DESC',
    date: 'post_date DESC',
  };
  const orderClause = allowedSorts[sortBy] ?? 'views DESC';

  return getDb()
    .prepare(
      `SELECT
        ps.message_id,
        MAX(ps.views) as views,
        MAX(ps.forwards) as forwards,
        MAX(ps.reactions) as reactions,
        MAX(ps.recorded_at) as latest_at,
        p.text,
        p.post_date,
        p.post_url
       FROM post_snapshots ps
       LEFT JOIN posts p ON ps.channel_id = p.channel_id AND ps.message_id = p.message_id
       WHERE ps.channel_id = ? AND ps.recorded_at BETWEEN ? AND ?
       GROUP BY ps.message_id
       ORDER BY ${orderClause}`,
    )
    .all(channelId, fromDate, toDate) as PostBreakdownRow[];
}

export function getLatestPostSnapshot(
  channelId: string,
  messageId: number,
): PostSnapshot | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM post_snapshots
       WHERE channel_id = ? AND message_id = ?
       ORDER BY recorded_at DESC LIMIT 1`,
    )
    .get(channelId, messageId) as PostSnapshot | undefined;
}

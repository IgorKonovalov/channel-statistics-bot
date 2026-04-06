import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../config', () => ({
  config: {
    botToken: 'test',
    channelId: '-100123',
    dashboard: { user: 'admin', password: 'secret', port: 3000 },
    dbPath: ':memory:',
    logLevel: 'silent',
    collectionIntervalMs: 7200000,
  },
}));

import { setupTestDb, teardownTestDb } from '../test-helper';
import { upsertChannel } from './channel.repo';
import { upsertPost } from './post.repo';
import {
  insertMemberSnapshot,
  getMemberSnapshots,
  insertPostSnapshot,
  getReactionsAggregated,
  getPostBreakdown,
  getLatestPostSnapshot,
} from './snapshot.repo';

const CHANNEL_ID = '-100123';

describe('snapshot.repo', () => {
  beforeEach(() => {
    setupTestDb();
    upsertChannel(CHANNEL_ID, 'Test Channel');
  });
  afterEach(() => teardownTestDb());

  describe('member snapshots', () => {
    it('inserts and retrieves member snapshots', () => {
      insertMemberSnapshot(CHANNEL_ID, 100);
      insertMemberSnapshot(CHANNEL_ID, 105);

      const snapshots = getMemberSnapshots(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]!.count).toBe(100);
      expect(snapshots[1]!.count).toBe(105);
    });

    it('returns empty array for no data', () => {
      const snapshots = getMemberSnapshots(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(snapshots).toHaveLength(0);
    });

    it('filters by date range', () => {
      insertMemberSnapshot(CHANNEL_ID, 100);
      const snapshots = getMemberSnapshots(CHANNEL_ID, '2099-01-01', '2099-12-31');
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('post snapshots', () => {
    it('inserts and retrieves latest post snapshot', () => {
      insertPostSnapshot(CHANNEL_ID, 1, 10);
      insertPostSnapshot(CHANNEL_ID, 1, 20);

      const latest = getLatestPostSnapshot(CHANNEL_ID, 1);
      expect(latest).toBeDefined();
      expect(latest!.reactions).toBe(20);
    });

    it('returns undefined for non-existent post', () => {
      const latest = getLatestPostSnapshot(CHANNEL_ID, 999);
      expect(latest).toBeUndefined();
    });
  });

  describe('reactions aggregation', () => {
    it('aggregates reactions by post date', () => {
      upsertPost(CHANNEL_ID, 1, 'post 1', '2026-01-15T12:00:00.000Z', '', undefined);
      upsertPost(CHANNEL_ID, 2, 'post 2', '2026-01-15T14:00:00.000Z', '', undefined);
      insertPostSnapshot(CHANNEL_ID, 1, 15);
      insertPostSnapshot(CHANNEL_ID, 2, 25);

      const reactions = getReactionsAggregated(CHANNEL_ID, '2026-01-01', '2026-12-31');
      expect(reactions).toHaveLength(1);
      expect(reactions[0]!.total_reactions).toBe(40);
    });
  });

  describe('post breakdown', () => {
    it('returns per-post max values sorted by reactions desc', () => {
      upsertPost(CHANNEL_ID, 1, 'post 1', '2026-01-15T12:00:00.000Z', '', undefined);
      upsertPost(CHANNEL_ID, 2, 'post 2', '2026-01-15T14:00:00.000Z', '', undefined);
      insertPostSnapshot(CHANNEL_ID, 1, 5);
      insertPostSnapshot(CHANNEL_ID, 1, 10);
      insertPostSnapshot(CHANNEL_ID, 2, 3);

      const breakdown = getPostBreakdown(CHANNEL_ID, '2026-01-01', '2026-12-31');
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0]!.message_id).toBe(1);
      expect(breakdown[0]!.reactions).toBe(10);
      expect(breakdown[1]!.message_id).toBe(2);
      expect(breakdown[1]!.reactions).toBe(3);
    });

    it('returns empty array for no data', () => {
      const breakdown = getPostBreakdown(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(breakdown).toHaveLength(0);
    });
  });
});

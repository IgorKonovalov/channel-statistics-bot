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
import {
  insertMemberSnapshot,
  getMemberSnapshots,
  insertPostSnapshot,
  getViewsAggregated,
  getReactionsAggregated,
  getForwardsAggregated,
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
      insertPostSnapshot(CHANNEL_ID, 1, 50, 3, 10);
      insertPostSnapshot(CHANNEL_ID, 1, 100, 5, 20);

      const latest = getLatestPostSnapshot(CHANNEL_ID, 1);
      expect(latest).toBeDefined();
      expect(latest!.views).toBe(100);
      expect(latest!.forwards).toBe(5);
      expect(latest!.reactions).toBe(20);
    });

    it('returns undefined for non-existent post', () => {
      const latest = getLatestPostSnapshot(CHANNEL_ID, 999);
      expect(latest).toBeUndefined();
    });
  });

  describe('views aggregation', () => {
    it('aggregates views by date', () => {
      insertPostSnapshot(CHANNEL_ID, 1, 50, 0, 0);
      insertPostSnapshot(CHANNEL_ID, 2, 30, 0, 0);

      const views = getViewsAggregated(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(views).toHaveLength(1);
      expect(views[0]!.total_views).toBe(80);
    });
  });

  describe('reactions aggregation', () => {
    it('aggregates reactions by date', () => {
      insertPostSnapshot(CHANNEL_ID, 1, 0, 0, 15);
      insertPostSnapshot(CHANNEL_ID, 2, 0, 0, 25);

      const reactions = getReactionsAggregated(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(reactions).toHaveLength(1);
      expect(reactions[0]!.total_reactions).toBe(40);
    });
  });

  describe('forwards aggregation', () => {
    it('aggregates forwards by date', () => {
      insertPostSnapshot(CHANNEL_ID, 1, 0, 3, 0);
      insertPostSnapshot(CHANNEL_ID, 2, 0, 7, 0);

      const forwards = getForwardsAggregated(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(forwards).toHaveLength(1);
      expect(forwards[0]!.total_forwards).toBe(10);
    });
  });

  describe('post breakdown', () => {
    it('returns per-post max values sorted by views desc', () => {
      insertPostSnapshot(CHANNEL_ID, 1, 50, 2, 5);
      insertPostSnapshot(CHANNEL_ID, 1, 100, 4, 10);
      insertPostSnapshot(CHANNEL_ID, 2, 200, 1, 3);

      const breakdown = getPostBreakdown(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0]!.message_id).toBe(2);
      expect(breakdown[0]!.views).toBe(200);
      expect(breakdown[1]!.message_id).toBe(1);
      expect(breakdown[1]!.views).toBe(100);
      expect(breakdown[1]!.forwards).toBe(4);
      expect(breakdown[1]!.reactions).toBe(10);
    });

    it('returns empty array for no data', () => {
      const breakdown = getPostBreakdown(CHANNEL_ID, '2000-01-01', '2099-12-31');
      expect(breakdown).toHaveLength(0);
    });
  });
});

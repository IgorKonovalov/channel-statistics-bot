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
import { upsertChannel, getChannel } from './channel.repo';

describe('channel.repo', () => {
  beforeEach(() => setupTestDb());
  afterEach(() => teardownTestDb());

  it('inserts and retrieves a channel', () => {
    upsertChannel('-100123', 'Test Channel');
    const channel = getChannel('-100123');
    expect(channel).toBeDefined();
    expect(channel!.id).toBe('-100123');
    expect(channel!.title).toBe('Test Channel');
    expect(channel!.added_at).toBeDefined();
  });

  it('updates title on upsert', () => {
    upsertChannel('-100123', 'Original');
    upsertChannel('-100123', 'Updated');
    const channel = getChannel('-100123');
    expect(channel!.title).toBe('Updated');
  });

  it('returns undefined for non-existent channel', () => {
    const channel = getChannel('-999');
    expect(channel).toBeUndefined();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { setupTestDb, teardownTestDb } from '../../db/test-helper';
import { upsertChannel } from '../../db/repositories/channel.repo';
import { insertMemberSnapshot, insertPostSnapshot } from '../../db/repositories/snapshot.repo';
import { upsertPost } from '../../db/repositories/post.repo';

// Mock config before importing routes
vi.mock('../../config', () => ({
  config: {
    channelId: '-100123',
    dashboard: { user: 'admin', password: 'secret', port: 3000 },
    dbPath: ':memory:',
    botToken: 'test',
    logLevel: 'silent',
    collectionIntervalMs: 7200000,
  },
}));

import { Telegraf } from 'telegraf';
import { createApiRouter } from './api';

const CHANNEL_ID = '-100123';

function createApp() {
  const bot = new Telegraf('fake-token');
  const app = express();
  app.use(createApiRouter(bot));
  return app;
}

// Use node's built-in fetch to test express routes in-process
async function request(
  app: express.Express,
  path: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        return reject(new Error('Failed to get address'));
      }
      fetch(`http://127.0.0.1:${addr.port}${path}`)
        .then(async (res) => {
          const body = await res.json();
          server.close();
          resolve({ status: res.status, body });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe('API routes', () => {
  beforeEach(() => {
    setupTestDb();
    upsertChannel(CHANNEL_ID, 'Test Channel');
  });
  afterEach(() => teardownTestDb());

  it('GET /api/members returns member snapshots', async () => {
    insertMemberSnapshot(CHANNEL_ID, 100);
    insertMemberSnapshot(CHANNEL_ID, 105);

    const app = createApp();
    const { status, body } = await request(app, '/api/members');

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    const arr = body as { date: string; count: number }[];
    expect(arr).toHaveLength(2);
    expect(arr[0]).toHaveProperty('date');
    expect(arr[0]).toHaveProperty('count', 100);
  });

  it('GET /api/reactions returns aggregated reactions', async () => {
    upsertPost(CHANNEL_ID, 1, 'post', new Date().toISOString(), '', undefined);
    insertPostSnapshot(CHANNEL_ID, 1, 15);

    const app = createApp();
    const { status, body } = await request(app, '/api/reactions');

    expect(status).toBe(200);
    const arr = body as { date: string; total_reactions: number }[];
    expect(arr).toHaveLength(1);
    expect(arr[0]).toHaveProperty('total_reactions', 15);
  });

  it('GET /api/posts returns per-post breakdown', async () => {
    upsertPost(CHANNEL_ID, 1, 'post 1', new Date().toISOString(), '', undefined);
    upsertPost(CHANNEL_ID, 2, 'post 2', new Date().toISOString(), '', undefined);
    insertPostSnapshot(CHANNEL_ID, 1, 10);
    insertPostSnapshot(CHANNEL_ID, 2, 20);

    const app = createApp();
    const { status, body } = await request(app, '/api/posts');

    expect(status).toBe(200);
    const arr = body as { message_id: number; reactions: number }[];
    expect(arr).toHaveLength(2);
    expect(arr[0]!.message_id).toBe(2); // sorted by reactions desc
    expect(arr[0]!.reactions).toBe(20);
  });

  it('returns empty arrays when no data', async () => {
    const app = createApp();
    const { body } = await request(app, '/api/members');
    expect(body).toEqual([]);
  });
});

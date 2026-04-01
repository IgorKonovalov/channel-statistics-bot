import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { setupTestDb, teardownTestDb } from '../../db/test-helper';
import { upsertChannel } from '../../db/repositories/channel.repo';
import { insertMemberSnapshot, insertPostSnapshot } from '../../db/repositories/snapshot.repo';

// Mock config before importing routes
vi.mock('../../config', () => ({
  config: {
    channelId: '-100123',
    dashboard: { user: 'admin', password: 'secret', port: 3000 },
    dbPath: ':memory:',
    botToken: 'test',
    collectionIntervalMs: 7200000,
  },
}));

import { apiRouter } from './api';

const CHANNEL_ID = '-100123';

function createApp() {
  const app = express();
  app.use(apiRouter);
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

  it('GET /api/views returns aggregated views', async () => {
    insertPostSnapshot(CHANNEL_ID, 1, 50, 0, 0);
    insertPostSnapshot(CHANNEL_ID, 2, 30, 0, 0);

    const app = createApp();
    const { status, body } = await request(app, '/api/views');

    expect(status).toBe(200);
    const arr = body as { date: string; total_views: number }[];
    expect(arr).toHaveLength(1);
    expect(arr[0]).toHaveProperty('total_views', 80);
  });

  it('GET /api/reactions returns aggregated reactions', async () => {
    insertPostSnapshot(CHANNEL_ID, 1, 0, 0, 15);

    const app = createApp();
    const { status, body } = await request(app, '/api/reactions');

    expect(status).toBe(200);
    const arr = body as { date: string; total_reactions: number }[];
    expect(arr).toHaveLength(1);
    expect(arr[0]).toHaveProperty('total_reactions', 15);
  });

  it('GET /api/forwards returns aggregated forwards', async () => {
    insertPostSnapshot(CHANNEL_ID, 1, 0, 7, 0);

    const app = createApp();
    const { status, body } = await request(app, '/api/forwards');

    expect(status).toBe(200);
    const arr = body as { date: string; total_forwards: number }[];
    expect(arr).toHaveLength(1);
    expect(arr[0]).toHaveProperty('total_forwards', 7);
  });

  it('GET /api/posts returns per-post breakdown', async () => {
    insertPostSnapshot(CHANNEL_ID, 1, 100, 3, 10);
    insertPostSnapshot(CHANNEL_ID, 2, 200, 5, 20);

    const app = createApp();
    const { status, body } = await request(app, '/api/posts');

    expect(status).toBe(200);
    const arr = body as { message_id: number; views: number }[];
    expect(arr).toHaveLength(2);
    expect(arr[0]!.message_id).toBe(2); // sorted by views desc
    expect(arr[0]!.views).toBe(200);
  });

  it('returns empty arrays when no data', async () => {
    const app = createApp();
    const { body } = await request(app, '/api/members');
    expect(body).toEqual([]);
  });
});

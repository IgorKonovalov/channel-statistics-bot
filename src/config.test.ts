import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    // Suppress dotenv from loading .env file
    vi.doMock('dotenv', () => ({ default: { config: vi.fn() } }));
  });

  it('throws when required env vars are missing', async () => {
    process.env = { ...process.env, BOT_TOKEN: '', CHANNEL_ID: '' };
    delete process.env['BOT_TOKEN'];

    await expect(import('./config')).rejects.toThrow('Missing required env var: BOT_TOKEN');
  });

  it('loads config with all required vars', async () => {
    process.env['BOT_TOKEN'] = 'test-token';
    process.env['CHANNEL_ID'] = '-100123';
    process.env['DASHBOARD_USER'] = 'admin';
    process.env['DASHBOARD_PASSWORD'] = 'secret';

    const { config } = await import('./config');
    expect(config.botToken).toBe('test-token');
    expect(config.channelId).toBe('-100123');
    expect(config.dashboard.user).toBe('admin');
    expect(config.dashboard.password).toBe('secret');
  });

  it('uses defaults for optional env vars', async () => {
    process.env['BOT_TOKEN'] = 'test-token';
    process.env['CHANNEL_ID'] = '-100123';
    process.env['DASHBOARD_USER'] = 'admin';
    process.env['DASHBOARD_PASSWORD'] = 'secret';
    delete process.env['DASHBOARD_PORT'];
    delete process.env['DB_PATH'];

    const { config } = await import('./config');
    expect(config.dashboard.port).toBe(3000);
    expect(config.dbPath).toBe('./data/stats.db');
  });

  it('uses custom values for optional env vars', async () => {
    process.env['BOT_TOKEN'] = 'test-token';
    process.env['CHANNEL_ID'] = '-100123';
    process.env['DASHBOARD_USER'] = 'admin';
    process.env['DASHBOARD_PASSWORD'] = 'secret';
    process.env['DASHBOARD_PORT'] = '8080';
    process.env['DB_PATH'] = '/custom/path.db';

    const { config } = await import('./config');
    expect(config.dashboard.port).toBe(8080);
    expect(config.dbPath).toBe('/custom/path.db');
  });
});

import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  channelId: requireEnv('CHANNEL_ID'),
  dashboard: {
    port: parseInt(optionalEnv('DASHBOARD_PORT', '3000'), 10),
    user: requireEnv('DASHBOARD_USER'),
    password: requireEnv('DASHBOARD_PASSWORD'),
  },
  dbPath: optionalEnv('DB_PATH', './data/stats.db'),
  collectionIntervalMs: 2 * 60 * 60 * 1000, // 2 hours
  viewsCheckIntervalMs: 30 * 60 * 1000, // 30 minutes
} as const;

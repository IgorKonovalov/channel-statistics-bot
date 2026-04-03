import * as readline from 'readline';
import dotenv from 'dotenv';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

dotenv.config();

const CHANNEL_ID = process.env['CHANNEL_ID'];
const DB_PATH = process.env['DB_PATH'] ?? './data/stats.db';
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1000;

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getReactionCount(message: Api.Message): number {
  if (!message.reactions || !('results' in message.reactions)) return 0;
  const results = message.reactions.results as { count: number }[];
  return results.reduce((sum, r) => sum + r.count, 0);
}

async function main(): Promise<void> {
  if (!CHANNEL_ID) {
    console.error('CHANNEL_ID not set in .env');
    process.exit(1);
  }

  // Interactive credentials
  const apiIdStr = await prompt('Enter api_id: ');
  const apiId = parseInt(apiIdStr, 10);
  if (isNaN(apiId)) {
    console.error('Invalid api_id');
    process.exit(1);
  }
  const apiHash = await prompt('Enter api_hash: ');

  // Connect
  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: () => prompt('Enter phone number: '),
    phoneCode: () => prompt('Enter the code you received: '),
    password: () => prompt('Enter 2FA password (if required): '),
    onError: (err) => console.error('Auth error:', err),
  });

  console.log('Authenticated successfully');

  // Resolve channel
  const channelIdNum = parseInt(CHANNEL_ID, 10);
  const entity = await client.getEntity(channelIdNum);

  if (!('title' in entity)) {
    console.error('Could not resolve channel');
    await client.disconnect();
    process.exit(1);
  }

  const channel = entity as Api.Channel;
  const username = channel.username;
  console.log(`Channel: ${channel.title} ${username ? `(@${username})` : '(private)'}`);

  // Open database
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Ensure channel exists
  db.prepare(
    'INSERT INTO channels (id, title) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title',
  ).run(CHANNEL_ID, channel.title);

  // Prepare statements
  const upsertPostStmt = db.prepare(
    `INSERT INTO posts (channel_id, message_id, text, post_date, post_url, photo_file_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(channel_id, message_id) DO UPDATE SET
       text = excluded.text,
       post_date = excluded.post_date,
       post_url = excluded.post_url,
       photo_file_id = COALESCE(excluded.photo_file_id, posts.photo_file_id)`,
  );

  const getLatestSnapshotStmt = db.prepare(
    `SELECT views, forwards, reactions FROM post_snapshots
     WHERE channel_id = ? AND message_id = ?
     ORDER BY recorded_at DESC LIMIT 1`,
  );

  const insertSnapshotStmt = db.prepare(
    'INSERT INTO post_snapshots (channel_id, message_id, views, forwards, reactions) VALUES (?, ?, ?, ?, ?)',
  );

  // Fetch messages
  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  let batch: Api.Message[] = [];

  const processBatch = (): void => {
    if (batch.length === 0) return;

    const transaction = db.transaction((messages: Api.Message[]) => {
      for (const msg of messages) {
        const views = msg.views ?? 0;
        const forwards = msg.forwards ?? 0;
        const reactions = getReactionCount(msg);
        const text = (msg.message ?? '').slice(0, 200);
        const postDate = new Date(msg.date * 1000).toISOString();
        const postUrl = username ? `https://t.me/${username}/${msg.id}` : '';

        // Get photo file ID if available (stored as string reference for future use)
        let photoFileId: string | null = null;
        if (msg.photo && 'id' in msg.photo) {
          photoFileId = (msg.photo as { id: bigint }).id.toString();
        }

        // Upsert post metadata
        upsertPostStmt.run(CHANNEL_ID, msg.id, text, postDate, postUrl, photoFileId);

        // Check for existing snapshot — skip if values match
        const latest = getLatestSnapshotStmt.get(CHANNEL_ID, msg.id) as
          | { views: number; forwards: number; reactions: number }
          | undefined;

        if (latest && latest.views === views && latest.forwards === forwards && latest.reactions === reactions) {
          skipped++;
          continue;
        }

        insertSnapshotStmt.run(CHANNEL_ID, msg.id, views, forwards, reactions);
        inserted++;
      }
    });

    transaction(batch);
    batch = [];
  };

  console.log('Fetching message history (oldest first)...');

  for await (const message of client.iterMessages(channelIdNum, {
    reverse: true,
    waitTime: BATCH_DELAY_MS / 1000,
  })) {
    // Skip service messages (MessageService)
    if (!(message instanceof Api.Message)) continue;

    batch.push(message);
    processed++;

    if (batch.length >= BATCH_SIZE) {
      processBatch();
      console.log(`Processed ${processed} messages (${inserted} inserted, ${skipped} skipped)`);
    }
  }

  // Process remaining
  processBatch();

  console.log(`\nDone!`);
  console.log(`  Total processed: ${processed}`);
  console.log(`  Snapshots inserted: ${inserted}`);
  console.log(`  Snapshots skipped (unchanged): ${skipped}`);

  db.close();
  await client.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});

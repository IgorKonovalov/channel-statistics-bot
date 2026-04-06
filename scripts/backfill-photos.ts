/**
 * Backfill Bot API photo file_ids for posts that have GramJS IDs.
 *
 * Uses forwardMessage + deleteMessage to get Bot API file_ids from the
 * forwarded message's photo array, then updates the posts table.
 *
 * Resumable: skips posts that already have a Bot API file_id (starts with "AgAC").
 *
 * Usage:
 *   npx tsx scripts/backfill-photos.ts <UTILITY_CHAT_ID>
 *   npx tsx scripts/backfill-photos.ts <UTILITY_CHAT_ID> --dry-run
 *
 * Prerequisites:
 *   - Bot must be admin in the utility chat (send + delete permissions)
 *   - Stop the main bot first (docker compose stop)
 */
import { Telegraf } from 'telegraf';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const CHANNEL_ID = process.env['CHANNEL_ID'];
const BOT_TOKEN = process.env['BOT_TOKEN'];
const DB_PATH = process.env['DB_PATH'] ?? './data/stats.db';
const DELAY_MS = 1000;
const BOT_API_FILE_ID_PREFIX = 'AgAC';

const utilityChatId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!utilityChatId) {
  console.error('Usage: npx tsx scripts/backfill-photos.ts <UTILITY_CHAT_ID> [--dry-run]');
  process.exit(1);
}

if (!CHANNEL_ID || !BOT_TOKEN) {
  console.error('CHANNEL_ID and BOT_TOKEN must be set in .env');
  process.exit(1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg: string): void {
  console.log(`[${ts()}] ${msg}`);
}

function isAlreadyBotApiId(fileId: string): boolean {
  return fileId.startsWith(BOT_API_FILE_ID_PREFIX);
}

async function main(): Promise<void> {
  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Get all posts that have photos (non-null photo_file_id)
  const allPosts = db
    .prepare('SELECT message_id, photo_file_id FROM posts WHERE channel_id = ? AND photo_file_id IS NOT NULL')
    .all(CHANNEL_ID!) as { message_id: number; photo_file_id: string }[];

  // Filter out posts already backfilled (Bot API file_ids)
  const posts = allPosts.filter((p) => !isAlreadyBotApiId(p.photo_file_id));
  const alreadyDone = allPosts.length - posts.length;

  log(`Found ${allPosts.length} posts with photos (${alreadyDone} already backfilled, ${posts.length} remaining)`);

  if (dryRun) {
    log('Dry run — no changes will be made');
    db.close();
    return;
  }

  if (posts.length === 0) {
    log('Nothing to do');
    db.close();
    return;
  }

  const bot = new Telegraf(BOT_TOKEN!);
  const channelId = Number(CHANNEL_ID);
  const updateStmt = db.prepare('UPDATE posts SET photo_file_id = ? WHERE channel_id = ? AND message_id = ?');

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]!;

    try {
      const msg = await bot.telegram.forwardMessage(utilityChatId, channelId, post.message_id);

      // Extract the smallest photo (thumbnail) file_id
      const photo = (msg as unknown as { photo?: { file_id: string; width: number }[] }).photo;

      if (photo && photo.length > 0) {
        // Sort by width ascending, pick smallest for thumbnail
        const smallest = photo.sort((a, b) => a.width - b.width)[0]!;
        updateStmt.run(smallest.file_id, CHANNEL_ID, post.message_id);
        updated++;
      } else {
        // Post exists but has no photo (text-only post with a GramJS artifact)
        updateStmt.run(null, CHANNEL_ID, post.message_id);
        skipped++;
      }

      // Clean up forwarded message
      await bot.telegram.deleteMessage(utilityChatId, msg.message_id);
    } catch (err: unknown) {
      const error = err as {
        response?: { error_code?: number; parameters?: { retry_after?: number } };
        message?: string;
      };

      if (error.response?.error_code === 429) {
        const retryAfter = error.response?.parameters?.retry_after ?? 30;
        log(`Rate limited — waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        i--; // Retry this post
        continue;
      }

      // Message not found (deleted) or other error
      failed++;
    }

    if ((i + 1) % 100 === 0 || i === posts.length - 1) {
      log(`Progress: ${i + 1}/${posts.length} (updated: ${updated}, skipped: ${skipped}, failed: ${failed})`);
    }

    await sleep(DELAY_MS);
  }

  log('Done!');
  log(`  Updated: ${updated}`);
  log(`  Skipped (no photo): ${skipped}`);
  log(`  Failed (deleted/error): ${failed}`);

  db.close();
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] Backfill failed:`, err);
  process.exit(1);
});

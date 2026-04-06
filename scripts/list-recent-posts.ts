/**
 * List recent posts from the database to pick a message ID for testing.
 *
 * Usage: npx tsx scripts/list-recent-posts.ts
 */
import { getDb } from "../src/db/connection";

const db = getDb();
const posts = db
  .prepare("SELECT message_id, post_date FROM posts ORDER BY post_date DESC LIMIT 10")
  .all();

console.table(posts);

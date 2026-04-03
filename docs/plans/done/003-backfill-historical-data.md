# Plan: Backfill Historical Channel Data

**Date:** 2026-04-01
**Status:** Completed

## Goal

One-time import of historical post data (~10k posts, several years) into the existing SQLite database — views, forwards, reactions, and post metadata (text, date, URL).

## Current State

The bot only captures data from new events going forward. No mechanism exists to retrieve historical channel messages. The channel has 10,000+ posts with years of data. The dashboard Posts page shows bare message IDs with no context.

## Decision

**Option A: GramJS** — chosen for full data access (views, forwards, reactions), batch retrieval (100 per request), and clean operation (no message forwarding/deletion noise).

## Proposed Approach

### Phase 1: Database — add `posts` table

New migration (v3) adds a `posts` metadata table:

```sql
CREATE TABLE IF NOT EXISTS posts (
  channel_id  TEXT NOT NULL REFERENCES channels(id),
  message_id  INTEGER NOT NULL,
  text        TEXT NOT NULL DEFAULT '',
  post_date   TEXT NOT NULL,
  post_url    TEXT NOT NULL DEFAULT '',
  photo_file_id TEXT,
  PRIMARY KEY (channel_id, message_id)
);
```

- `text` — first 200 chars of the post text (preview)
- `post_date` — original post timestamp from Telegram
- `post_url` — direct link: `https://t.me/{channel_username}/{message_id}`
- `photo_file_id` — stored for future use (not displayed yet)

Add a repository function:

```typescript
upsertPost(channelId, messageId, text, postDate, postUrl, photoFileId?)
```

Also update the bot's `channel_post` handler to populate `posts` for new posts going forward.

### Phase 2: Backfill script

#### Prerequisites
- Telegram API credentials: `api_id` and `api_hash` from https://my.telegram.org
- Phone number for interactive authentication
- Channel must be accessible to the authenticated user

#### Implementation

- [ ] Install `telegram` (GramJS) as a dev dependency, pinned to exact version
- [ ] Create `scripts/backfill.ts` — standalone script, not part of the main bot
- [ ] Interactive auth: prompt for phone number and 2FA code at runtime (using GramJS `StringSession`)
- [ ] Resolve the channel entity from `CHANNEL_ID` in `.env`
- [ ] Get channel username for building post URLs
- [ ] Call `messages.getHistory` in batches of 100, oldest-first (use `offsetId` pagination)
- [ ] Extract per-message:
  - `message_id`, `views`, `forwards`
  - Reaction counts: sum of `results[].count` from `reactions.results`
  - `message` text (truncate to 200 chars)
  - `date` (Unix timestamp → ISO string)
  - `photo` file reference (if present, store for future use)
- [ ] Skip service messages (joins, pins, etc.) — only process regular messages
- [ ] For each message:
  - `ensureChannel(channelId)`
  - `upsertPost(channelId, messageId, text, postDate, postUrl, photoFileId)`
  - `insertPostSnapshot(channelId, messageId, views, forwards, reactions)`
- [ ] Use the existing DB connection from `src/db/connection.ts` (reads `DB_PATH` from `.env`)
- [ ] Wrap inserts in batched transactions (100 rows per transaction) for performance
- [ ] Log progress every 100 messages: `Processed X / total Y`
- [ ] Handle edge cases: deleted messages (skip), media-only posts (still have views), zero-view posts (still insert)
- [ ] After successful run, uninstall `telegram` package

#### Script interface

```
npx tsx scripts/backfill.ts
```

Reads `CHANNEL_ID` and `DB_PATH` from `.env` via dotenv. Prompts interactively for:
1. `api_id` (number)
2. `api_hash` (string)
3. Phone number
4. Auth code (sent by Telegram)
5. 2FA password (if enabled)

No credentials stored on disk.

#### Idempotency

- `upsertPost` uses `INSERT ... ON CONFLICT DO UPDATE` — always updates metadata
- For snapshots: check `getLatestPostSnapshot` first
  - If exists and values match (views, forwards, reactions) — skip
  - If values differ — insert new snapshot (captures updated counts)

### Phase 3: Dashboard — show post metadata

- [ ] Update `GET /api/posts` to JOIN with `posts` table and return `text`, `post_date`, `post_url`
- [ ] Update Posts page to show text preview and link to Telegram post
- [ ] Sort options: by views, forwards, reactions, or date

## Future: Photo Display

Store `photo_file_id` now, implement display later:
- Add `GET /api/photo/:messageId` endpoint on the dashboard
- Calls `bot.telegram.getFileLink(file_id)` to get a temporary Telegram CDN URL
- Either redirect (simple) or proxy+cache to `/app/data/photos/` (avoids expired links)
- Display as thumbnails in the Posts breakdown table

This is a separate plan — no implementation in this round.

## Risks

- **Rate limiting:** Telegram may throttle `messages.getHistory`. Use 1-second delay between batches. If 420 FLOOD_WAIT is returned, respect the wait time.
- **Auth security:** Credentials entered interactively, never stored. Session object lives only in memory. Dependency removed after use.
- **Stale data:** Historical counts are cumulative totals at time of backfill, not time-series. Dashboard will show a single snapshot per post.
- **Large insert volume:** ~10k rows. Batched transactions mitigate DB lock contention.
- **Channel username:** Needed for post URLs. If the channel is private (no username), fall back to empty `post_url`.

## Acceptance Criteria

- [ ] `posts` table created via migration v3
- [ ] Bot populates `posts` for new posts going forward
- [ ] All accessible historical posts imported into `post_snapshots` and `posts`
- [ ] Dashboard Posts page shows text preview and link for each post
- [ ] Script can be re-run safely (idempotent)
- [ ] No credentials stored on disk after script completes
- [ ] `telegram` package removed from dependencies after use

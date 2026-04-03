# Plan: Backfill Historical Channel Data

**Date:** 2026-04-01
**Status:** Draft

## Goal

One-time import of historical post data (~10k posts, several years) into the existing SQLite database — views, forwards, and reactions per post.

## Current State

The bot only captures data from new events going forward. No mechanism exists to retrieve historical channel messages. The channel has 10,000+ posts with years of data.

## Options Considered

### Option A: GramJS (telegram package) — RECOMMENDED

Use the MTProto user API via GramJS to call `messages.getHistory` and iterate all channel posts.

- **Pros:** Full access to views, forwards, reactions; fast (batches of 100); reliable
- **Cons:** Requires a third-party dependency (GramJS) and user account authentication (phone + 2FA)
- **Security notes:**
  - Open source, 40M+ weekly downloads
  - Credentials go directly to Telegram's servers (149.154.x.x) — library is just a protocol implementation
  - No external network calls beyond Telegram
  - Pin to exact version, audit source before running
  - Credentials entered interactively, never stored in code or `.env`
  - After running once, dependency can be uninstalled

### Option B: Bot API forward trick — NO EXTRA DEPS

Forward each message (by known ID range) to a private chat with the bot, read view counts from the forwarded copy, then delete it.

- **Pros:** Zero extra dependencies, uses existing bot token
- **Cons:**
  - ~10k API calls, rate-limited at ~30/sec = ~6 min minimum
  - Creates and deletes 10k messages in a private chat (noisy)
  - Reactions are NOT available via forwarded messages
  - Must handle deleted/removed posts gracefully
  - Forward may not always carry accurate view counts

### Option C: Telegram Desktop export

Export channel history as JSON via Telegram Desktop, parse and insert.

- **Pros:** No API calls, no authentication in code
- **Cons:** Export does NOT include view counts or reaction data — makes it useless for our purpose

## Decision

Pending user choice between Option A (GramJS) and Option B (Bot API).

## Proposed Approach (Option A)

### Prerequisites
- Telegram API credentials: `api_id` and `api_hash` from https://my.telegram.org
- Phone number for interactive authentication
- Channel must be accessible to the authenticated user

### Implementation
- [ ] Create `scripts/backfill.ts` — standalone script, not part of the main bot
- [ ] Install `telegram` (GramJS) as a dev dependency, pinned to exact version
- [ ] Interactive auth: prompt for phone number and 2FA code at runtime
- [ ] Iterate `messages.getHistory` in batches of 100, oldest first
- [ ] Extract per-message: `message_id`, `views`, `forwards`, reaction counts
- [ ] Insert into existing `post_snapshots` table via `snapshot.repo`
- [ ] Ensure channel exists in `channels` table before inserting
- [ ] Log progress (processed X / total Y)
- [ ] Handle edge cases: deleted messages, media-only posts, service messages
- [ ] After successful run, uninstall `telegram` package

### Proposed Approach (Option B)

- [ ] Create `scripts/backfill.ts` — uses existing bot token, no extra deps
- [ ] Iterate message IDs from 1 to ~latest known ID
- [ ] For each ID: forward to bot's private chat, read views/forwards, delete copy
- [ ] Rate limit: max 30 requests/sec with delays
- [ ] Skip errors (deleted messages return 400)
- [ ] Insert into `post_snapshots` table
- [ ] Note: reactions will NOT be captured

## Risks

- **Rate limiting (both options):** Telegram may temporarily restrict the account if requests are too aggressive. Use conservative delays.
- **Option A auth security:** User credentials are handled by GramJS. Mitigated by: pinned version, open source audit, interactive-only auth, uninstall after use.
- **Stale data:** Historical view/reaction counts are cumulative totals at time of backfill, not time-series. The dashboard will show a single data point per post, not growth over time.
- **Large insert volume:** 10k+ rows in one run. Use transactions for batched inserts to avoid DB lock contention.

## Acceptance Criteria

- [ ] All accessible historical posts are imported into `post_snapshots`
- [ ] Dashboard shows historical data in per-post breakdown
- [ ] Script can be re-run safely (idempotent — skips already-imported posts or updates them)
- [ ] No credentials stored on disk after script completes

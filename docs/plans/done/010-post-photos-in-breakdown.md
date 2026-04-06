# Plan: Post Photos in Breakdown Page

**Date:** 2026-04-06
**Status:** Completed

## Goal

Show post thumbnails in the posts breakdown page so users can visually identify posts without clicking through to Telegram.

## Current State

- `posts` table has `photo_file_id` column, but backfill stored GramJS IDs (incompatible with Bot API)
- New posts captured via `channel_post` events store correct Bot API file_ids
- Post text (200 char preview) and link to Telegram already shown
- No photo serving endpoint exists

## Proposed Approach

### Phase 1: Photo File ID Backfill Script

- [x] Create `scripts/backfill-photos.ts`
  - Reads all posts with non-null `photo_file_id` from the DB (these have GramJS IDs)
  - For each post: `forwardMessage(utilityChatId, channelId, messageId)` → extract smallest `photo[].file_id` (thumbnail) → `deleteMessage` → update `posts.photo_file_id`
  - 1-second delay between posts for rate limits
  - Skip posts that fail (deleted, no photo) with a warning
  - Handle 429 (rate limit) by respecting `retry_after` and retrying
  - Progress logging every 100 posts
  - Accepts `UTILITY_CHAT_ID` as CLI argument
- [x] Add `--dry-run` flag to preview how many posts need updating

### Phase 2: Photo Serving Endpoint

- [x] Add `/api/photo/:messageId` route in `src/dashboard/routes/api.ts`
  - Looks up `photo_file_id` from `posts` table
  - If no file_id → 404
  - Checks local cache directory (`data/photos/<messageId>.jpg`)
  - If cached → serve the file directly
  - If not cached → call `bot.telegram.getFileLink(fileId)`, download, save to cache, serve
- [x] Add `getPostPhotoFileId(channelId, messageId)` to `post.repo.ts`
- [x] Create cache directory `data/photos/` (created on demand by the endpoint)
- [x] Update `docker-compose.yml` if needed to ensure cache persists (already persisted — `bot-data` volume covers `data/`)

### Phase 3: Dashboard UI

- [x] Update `PostBreakdownRow` to include `has_photo` (0/1) so frontend knows which posts have photos
- [x] Update `posts.ejs` table layout:
  - Add thumbnail column before post text
  - Thumbnail: `<img src="/api/photo/{messageId}" loading="lazy" width="60">` 
  - `loading="lazy"` ensures images load on demand as user scrolls (browser-native lazy loading)
  - For posts without photos: empty cell; `onerror` hides broken images
- [x] Add CSS for thumbnail sizing and alignment in the table

### Phase 4: Bot Integration for Photo Caching

- [x] Pass `bot` instance (or `bot.telegram`) to the dashboard server so the photo endpoint can call `getFileLink`
- [x] Update `src/dashboard/server.ts` to accept and store the Telegraf instance
- [x] Update `src/index.ts` to pass bot to dashboard

### Phase 5: Testing

- [x] Unit test for `getPostPhotoFileId`
- [x] Unit test for photo endpoint — 404/400 responses for missing/invalid posts
- [x] Manual test: run backfill-photos on server, verify thumbnails appear in dashboard

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Photo source for backfill | `forwardMessage` + delete | Already proven to return Bot API file_ids (Phase 0 test). No extra deps. |
| Caching strategy | Download to disk on first request | Telegram file links expire; disk cache avoids repeated API calls. ~60KB per thumbnail × 5000 photos ≈ 300MB max. |
| Lazy loading | Browser-native `loading="lazy"` | Zero JS overhead, supported in all modern browsers. Images only fetched when scrolled into view. |
| Thumbnail size | 60px wide (smallest Telegram size) | Small enough for table layout, reduces bandwidth. Bot API provides multiple sizes — use smallest. |

## File Structure

```
scripts/
  backfill-photos.ts        # NEW — one-time forwardMessage backfill for photo file_ids
src/
  dashboard/
    routes/api.ts            # updated — add /api/photo/:messageId
    server.ts                # updated — accept bot instance
    views/posts.ejs          # updated — add thumbnail column
  db/
    repositories/
      post.repo.ts           # updated — add getPostPhotoFileId()
  index.ts                   # updated — pass bot to dashboard
```

## Risks & Open Questions

| Risk | Mitigation |
|------|------------|
| **Backfill takes ~1.5 hours** | Run in background on server, progress logging, can be interrupted and resumed (skips already-updated posts) |
| **Telegram file links expire** | Disk cache means we only call `getFileLink` once per photo; if cache is lost, re-fetched on demand |
| **Disk space for cached photos** | ~300MB worst case; monitor with `du -sh data/photos/` |
| **Bot instance needed in dashboard** | Pass as dependency injection, no globals |
| **Some posts may have been deleted** | forwardMessage will fail gracefully, photo stays null |

## Acceptance Criteria

- [x] Historical posts show thumbnails in the breakdown table
- [x] New posts captured by the bot also show thumbnails
- [x] Photos load lazily (only when scrolled into view)
- [x] Photos are cached to disk after first load
- [x] Posts without photos show gracefully (no broken images)
- [x] Backfill script can be re-run safely (idempotent)

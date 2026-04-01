# Plan: Post-MVP Roadmap

**Date:** 2026-04-01
**Status:** Draft

## Goal

Bring the bot from MVP to a production-ready state: add missing metrics (reposts, reactions), improve the dashboard, add tests, harden for deployment.

## Current State

MVP is complete (plan 001). The bot collects member count (every 2h) and post views (via `channel_post` / `edited_channel_post` events), stores in SQLite, and serves two line charts behind basic auth. No tests, no linting, single-channel only.

## Roadmap

### Plan 002: Collect Reposts & Reactions
**Priority: High** — originally scoped features not yet implemented

- [x] Add `reactions` column to `post_snapshots` (migration v2)
- [x] Capture `message_reaction_count` events from Telegraf for reaction tracking
- [x] Capture forward count from `channel_post` events (`forward_count` field)
- [x] Add `/api/reactions` and `/api/forwards` dashboard endpoints
- [x] Add two new charts to the dashboard: reactions over time, forwards over time
- [x] Update `edited_channel_post` handler to also snapshot reaction/forward changes

### Plan 003: Dashboard Improvements
**Priority: High** — usability essentials

- [ ] Add date range picker (from/to inputs) that filters all charts
- [ ] Add per-post breakdown page: table of posts with views, reactions, forwards
- [ ] Add summary KPI cards at top of overview: total members, total views (30d), avg views/post
- [ ] Responsive layout for mobile
- [ ] Loading states for charts (spinner while fetching)
- [ ] Extract shared CSS into a layout template (reintroduce `layout.ejs`)

### Plan 004: Testing
**Priority: High** — no tests exist yet

- [ ] Set up vitest config (`vitest.config.ts`)
- [ ] Unit tests for repositories: channel.repo, snapshot.repo (in-memory SQLite)
- [ ] Unit tests for config validation (missing env vars, defaults)
- [ ] Unit tests for auth middleware (valid/invalid/missing credentials, colon-in-password)
- [ ] Integration test: collector service writes snapshots to DB
- [ ] Integration test: API routes return correct JSON shape
- [ ] Add `npm run test:coverage` with minimum threshold (80%)

### Plan 005: Linting & Code Quality
**Priority: Medium** — enforce consistency

- [ ] Add ESLint with `@typescript-eslint` + recommended config
- [ ] Add Prettier for formatting
- [ ] Add npm scripts: `lint`, `lint:fix`, `format`
- [ ] Add pre-commit hook via husky + lint-staged
- [ ] Fix any existing lint issues

### Plan 006: Multi-Channel Support
**Priority: Medium** — scale beyond single channel

- [ ] Change `CHANNEL_ID` config to `CHANNEL_IDS` (comma-separated list)
- [ ] Update collector to iterate over all channels
- [ ] Update dashboard to show channel selector dropdown
- [ ] Per-channel routes: `/channel/:id`, `/api/:channelId/members`, etc.
- [ ] Update DB queries to handle multiple channels cleanly

### Plan 007: Production Hardening
**Priority: Medium** — reliability for long-running deployment

- [ ] Add structured logging (replace `console.log` with pino or winston)
- [ ] Add health check endpoint (`/health`) for Docker/monitoring
- [ ] Add graceful error recovery for Telegram API failures (retry with backoff)
- [ ] Add DB backup strategy (periodic SQLite `.backup()` to a file)
- [ ] Add rate limit middleware on dashboard routes
- [ ] Review Docker setup: non-root user, memory limits, log rotation

### Plan 008: Deployment Automation
**Priority: Low** — convenience for ongoing deploys

- [ ] GitHub Actions CI: typecheck + lint + test on push
- [ ] GitHub Actions CD: build Docker image, SSH deploy to VPS on push to master
- [ ] Add deploy script (`scripts/deploy.sh`) for manual SSH deploys
- [ ] Add `.env.production.example` with production-specific guidance

## Suggested Order of Execution

```
002 Reposts & Reactions  ──┐
003 Dashboard Improvements ─┼── can be parallelized
004 Testing ────────────────┘
        │
005 Linting & Code Quality
        │
006 Multi-Channel Support
        │
007 Production Hardening
        │
008 Deployment Automation
```

Plans 002, 003, and 004 are independent and can be worked on in any order.
Plans 005–008 build on a stable, tested codebase and should come after.

## Risks

- **Telegram `message_reaction_count` availability** — requires bot API 7.0+; need to verify Telegraf v4 supports it. If not, reactions tracking may need a Telegraf update or raw API calls.
- **Multi-channel increases DB load** — with many channels and frequent posts, SQLite may become a bottleneck. Monitor and consider PostgreSQL migration if needed (unlikely for <10 channels).
- **No tests yet** — any refactoring before plan 004 carries regression risk. Recommend starting 004 early.

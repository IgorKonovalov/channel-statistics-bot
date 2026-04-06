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

- [x] Add date range picker (from/to inputs) that filters all charts
- [x] Add per-post breakdown page: table of posts with views, reactions, forwards
- [x] Add summary KPI cards at top of overview: total members, total views (30d), avg views/post
- [x] Responsive layout for mobile
- [x] Loading states for charts (spinner while fetching)
- [x] Extract shared CSS into a layout template (reintroduce `layout.ejs`)

### Plan 004: Testing
**Priority: High** — no tests exist yet

- [x] Set up vitest config (`vitest.config.ts`)
- [x] Unit tests for repositories: channel.repo, snapshot.repo (in-memory SQLite)
- [x] Unit tests for config validation (missing env vars, defaults)
- [x] Unit tests for auth middleware (valid/invalid/missing credentials, colon-in-password)
- [x] Integration test: collector service writes snapshots to DB (covered via repo tests with in-memory DB)
- [x] Integration test: API routes return correct JSON shape
- [x] Add `npm run test:coverage` with minimum threshold (80%)

### Plan 005: Linting & Code Quality
**Priority: Medium** — enforce consistency

- [x] Add ESLint with `@typescript-eslint` + recommended config
- [x] Add Prettier for formatting
- [x] Add npm scripts: `lint`, `lint:fix`, `format`
- [x] Add pre-commit hook via husky + lint-staged
- [x] Pin all dependencies to exact versions (remove `^` prefixes)
- [x] Fix any existing lint issues

### ~~Plan 006: Multi-Channel Support~~ — DROPPED

### ~~Plan 009: Periodic View Polling~~ — DROPPED
Telegram Bot API doesn't expose view counts in events or forwarded messages. GramJS can fetch them but requires user-session auth (phone + 2FA), making it impractical for automated polling. View data comes from one-time backfill only.

### Plan 007: Production Hardening
**Priority: Medium** — reliability for long-running deployment

- [ ] Add structured logging (replace `console.log` with pino or winston)
- [ ] Add health check endpoint (`/health`) for Docker/monitoring
- [ ] Add graceful error recovery for Telegram API failures (retry with backoff)
- [ ] Add DB backup strategy (periodic SQLite `.backup()` to a file)
- [ ] Add rate limit middleware on dashboard routes
- [ ] Review Docker setup: non-root user, memory limits, log rotation
- [ ] Add deploy script (`scripts/deploy.sh`) for manual SSH deploys

### ~~Plan 008: Deployment Automation~~ — DROPPED (deploy script moved to 007)

## Suggested Order of Execution

```
002 Reposts & Reactions  ──┐
003 Dashboard Improvements ─┼── done
004 Testing ────────────────┘
        │
005 Linting & Code Quality
        │
007 Production Hardening (includes deploy script)
```

## Risks

- **Telegram `message_reaction_count` availability** — requires bot API 7.0+; need to verify Telegraf v4 supports it. If not, reactions tracking may need a Telegraf update or raw API calls.

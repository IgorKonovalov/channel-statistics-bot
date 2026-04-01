# Plan: MVP — Collect Member Count & Views, Show a Chart

**Date:** 2026-04-01
**Status:** Completed

## Goal

Build the minimum viable pipeline: a Telegram bot that passively collects channel member count and post views, stores them in SQLite, and a server-rendered dashboard that displays the data as time-series charts behind basic auth.

## Current State

Empty repo with skills, CLAUDE.md, and a bare `package.json`. No source code, no dependencies, no config.

## Proposed Approach

### Phase 1: Project Bootstrap

- [x] Initialize TypeScript project (`tsconfig.json`, strict mode)
- [x] Add dependencies: `telegraf`, `better-sqlite3`, `express`, `ejs`, `chart.js`, `dotenv`
- [x] Add dev dependencies: `typescript`, `tsx`, `@types/*`, `vitest`
- [x] Set up npm scripts: `dev`, `build`, `start`, `test`, `typecheck`
- [x] Create `.env.example` with required variables
- [x] Create `src/config.ts` — typed config from env, validated at startup
- [x] Create initial file structure (see below)
- [x] Add `Dockerfile` and `docker-compose.yml`

### Phase 2: Database Layer

- [x] Create `src/db/connection.ts` — SQLite connection via `better-sqlite3`
- [x] Create `src/db/schema.ts` — table definitions + migration runner
- [x] Tables: `channels`, `member_snapshots`, `post_snapshots`
- [x] Create `src/db/repositories/channel.repo.ts`
- [x] Create `src/db/repositories/snapshot.repo.ts`

### Phase 3: Telegram Bot

- [x] Create `src/bot/index.ts` — Telegraf bot setup + launch
- [x] Create `src/bot/middleware/error-handler.ts`
- [x] Create `src/bot/middleware/logger.ts`
- [x] Create `src/bot/collectors/member-count.ts` — periodic polling of `getChatMembersCount`
- [x] Create `src/bot/collectors/post-views.ts` — listen to channel_post updates, record view counts
- [x] Create `src/services/collector.ts` — orchestrate periodic collection (setInterval / cron-like)

### Phase 4: Dashboard

- [x] Create `src/dashboard/server.ts` — Express app setup
- [x] Create `src/dashboard/middleware/auth.ts` — basic HTTP auth (username/password from env)
- [x] Create `src/dashboard/views/layout.ejs` — base HTML layout with Chart.js CDN
- [x] Create `src/dashboard/views/index.ejs` — overview page with charts
- [x] Create `src/dashboard/routes/index.ts` — serve overview page
- [x] Create `src/dashboard/routes/api.ts` — JSON endpoints for chart data (`/api/members`, `/api/views`)

### Phase 5: Entrypoint & Docker

- [x] Create `src/index.ts` — start bot + dashboard together
- [x] Finalize `Dockerfile` (multi-stage: build TS → run JS)
- [x] Finalize `docker-compose.yml` (single service, volume for SQLite file, env_file)
- [x] Test full flow: bot collects → DB stores → dashboard renders chart

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Node.js + TypeScript (strict) | Type safety, Telegraf ecosystem |
| Bot framework | Telegraf v4 | Mature, good TS support, middleware pattern |
| Database | SQLite via `better-sqlite3` | Simple, no extra service, sufficient for single-channel MVP |
| Dashboard | Express + EJS + Chart.js | Server-rendered, no frontend build step, lightweight |
| Auth | HTTP Basic Auth | Simplest admin-only protection; upgrade to sessions later if needed |
| Scheduling | `setInterval` in-process | No extra deps; member count polled every 2 hours, post views re-checked periodically |
| Deployment | Docker on VPS via SSH | Single `docker-compose up -d`, SQLite volume persisted |

## File Structure

```
src/
  config.ts                    # env parsing & validation
  index.ts                     # entrypoint — starts bot + dashboard
  bot/
    index.ts                   # Telegraf bot setup
    middleware/
      error-handler.ts
      logger.ts
    collectors/
      member-count.ts          # polls getChatMembersCount
      post-views.ts            # listens to channel_post events
  services/
    collector.ts               # orchestrates periodic data collection
  db/
    connection.ts              # better-sqlite3 instance
    schema.ts                  # table DDL + migrations
    repositories/
      channel.repo.ts
      snapshot.repo.ts
  dashboard/
    server.ts                  # Express app
    middleware/
      auth.ts                  # HTTP basic auth
    routes/
      index.ts                 # page routes
      api.ts                   # JSON data endpoints
    views/
      layout.ejs
      index.ejs
```

## Risks & Open Questions

- **Risk:** Telegram API rate limits when polling member count — Mitigation: poll once every 2 hours
- **Risk:** Post view counts are not pushed in real-time — Mitigation: periodically re-check recent posts for updated view counts (accepted trade-off)
- **Decided:** Snapshot member count every 2 hours
- **Decided:** Store raw view counts per post, aggregate at query time

## Acceptance Criteria

- [x] Bot starts, connects to Telegram, and collects member count on schedule
- [x] Post view data is captured and stored in SQLite
- [x] Dashboard is accessible at `http://host:PORT` with basic auth
- [x] Overview page shows two charts: member count over time, views over time
- [x] `docker-compose up` starts the full stack with no manual steps beyond `.env`
- [x] All code passes `npm run typecheck` with zero errors

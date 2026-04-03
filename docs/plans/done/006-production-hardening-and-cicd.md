# Plan: Production Hardening & CI/CD

**Date:** 2026-04-03
**Status:** Completed

## Goal

Make the bot production-ready (logging, health checks, error recovery, Docker hardening) and add GitHub Actions CI/CD for automatic deployment on push to `master` — for both this repo and property-bot.

## Current State

- Bot runs in Docker with basic Dockerfile and docker-compose
- All logging is `console.log` — no structure, no levels
- No health check endpoint
- Telegram API errors are caught but not retried
- Dockerfile uses `node:20-alpine`, doesn't rebuild `better-sqlite3` natively, runs as root
- No `.dockerignore`, no `deploy.sh`
- No CI/CD pipeline in either repo

## Proposed Approach

### Phase 1: Structured Logging

Replace all `console.log/warn/error` with [pino](https://github.com/pinojs/pino) — fast, JSON-structured, minimal.

- [x] Install `pino` (runtime dep)
- [x] Create `src/logger.ts` — single pino instance, log level from env (`LOG_LEVEL`, default `info`)
- [x] Replace all `console.log` calls across the codebase:
  - `src/index.ts` — startup/shutdown messages
  - `src/services/collector.ts` — collection cycle logs
  - `src/bot/middleware/logger.ts` — update type logs
  - `src/bot/middleware/error-handler.ts` — error logs
  - `src/bot/collectors/member-count.ts` — member count logs
  - `src/bot/collectors/post-views.ts` — post snapshot logs
  - `src/dashboard/server.ts` — dashboard startup
- [x] Update `.env.example` with `LOG_LEVEL=info`
- [x] Update `src/config.ts` to expose `logLevel`

### Phase 2: Health Check Endpoint

- [x] Add `GET /health` route in `src/dashboard/routes/health.ts`
  - Returns `200 { status: "ok", uptime: <seconds> }`
  - No auth required (placed before auth middleware)
- [x] Register in `src/dashboard/server.ts` before `basicAuth`
- [x] Add `HEALTHCHECK` instruction to Dockerfile

### Phase 3: Graceful Error Recovery for Telegram API

- [x] Create `src/utils/retry.ts` — generic retry with exponential backoff
  - Configurable: `maxRetries` (default 3), `baseDelayMs` (default 1000)
  - Retries on network errors and 429 (rate limit) — respects `retry_after` header
  - Does NOT retry on 4xx auth/permission errors
- [x] Wrap `collectMemberCount` API calls with retry
- [x] Add Telegraf-level error handler on the bot instance (`bot.catch(...)`) that logs and continues instead of crashing

### Phase 4: Docker Hardening

- [x] Create `.dockerignore`:
  ```
  node_modules
  dist
  data
  .env
  .git
  .github
  .husky
  .claude
  docs
  coverage
  *.md
  *.test.ts
  ```
- [x] Update `Dockerfile`:
  - Bump to `node:22-alpine` (align with property-bot)
  - Add build tools: `apk add --no-cache python3 make g++`
  - Rebuild `better-sqlite3` in production stage: `npm rebuild better-sqlite3`
  - Run as non-root user: `addgroup -S app && adduser -S app -G app`
  - Add `HEALTHCHECK` instruction
- [x] Update `docker-compose.yml`:
  - Add logging config: `json-file` driver, `max-size: 10m`, `max-file: 3`
- [x] Create `deploy.sh`:
  ```bash
  #!/bin/bash
  set -e
  cd ~/bots/channel-statistics-bot
  git pull
  docker compose up -d --build
  docker image prune -f
  echo "Deployed successfully"
  ```

### Phase 5: CI/CD — GitHub Actions (both repos)

#### Workflow: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test

  deploy:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          passphrase: ${{ secrets.SSH_PASSPHRASE }}
          script: |
            cd ~/bots/channel-statistics-bot
            git pull
            docker compose up -d --build
            docker image prune -f
```

#### GitHub Secrets to configure (per repo)

| Secret | Value |
|--------|-------|
| `SSH_HOST` | Server IP or hostname |
| `SSH_USER` | SSH username |
| `SSH_KEY` | Full private key contents (paste entire `id_rsa` / `id_ed25519`) |
| `SSH_PASSPHRASE` | Passphrase for the key |

#### Setup instructions

1. Go to repo on GitHub → Settings → Secrets and variables → Actions
2. Click "New repository secret" for each of the 4 secrets above
3. For `SSH_KEY`: copy the entire private key file including `-----BEGIN...` and `-----END...` lines
4. Repeat for property-bot repo (same secrets, but deploy script path changes to `~/bots/property-bot`)

#### Property-bot workflow

Same workflow file, but:
- Deploy path: `cd ~/bots/property-bot`
- Test command: `npm run test` (jest, passWithNoTests)
- Everything else identical

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Logger | pino | Fastest Node.js logger, JSON output, zero-config, tiny footprint |
| Retry strategy | Exponential backoff | Standard for API rate limits; avoids thundering herd |
| SSH deploy action | `appleboy/ssh-action` | Most popular (10k+ stars), supports key+passphrase, well-maintained |
| Node version | 22-alpine | LTS, aligns with property-bot |

## Deferred Items (from original Plan 007)

These are lower priority and can be added later:
- **DB backup strategy** — not critical for initial deployment; SQLite file is in a Docker volume
- **Rate limiting on dashboard** — behind basic auth already; low traffic

## Risks

- **`better-sqlite3` native build** — needs python3/make/g++ in Docker. Already proven in property-bot.
- **SSH key security** — GitHub Secrets are encrypted at rest, only exposed to workflow runs. Standard practice.
- **Pino JSON output** — Docker `json-file` driver will double-encode JSON logs. Acceptable for now; can use `pino-pretty` in dev if needed.

## Acceptance Criteria

- [x] All `console.log` replaced with pino logger
- [x] `GET /health` returns 200 without auth
- [x] Telegram API calls retry on transient failures
- [x] Docker image runs as non-root, rebuilds native deps, has health check
- [x] `deploy.sh` works manually via SSH
- [x] Push to `master` triggers: lint → typecheck → test → deploy (both repos)
- [x] Both repos have GitHub Actions workflow and required secrets documented

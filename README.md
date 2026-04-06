# Channel Statistics Bot

A passive Telegram bot that sits in a channel, collects metrics (member count, reactions), and serves a web dashboard for visualizing channel statistics.

## Features

- **Member count tracking** — collected every 2 hours
- **Reaction tracking** — captured in real-time via Telegram events
- **Post metadata** — text previews, dates, links, photo thumbnails
- **Web dashboard** — overview with charts, KPIs, and per-post breakdown
- **Photo thumbnails** — lazy-loaded post images cached to disk
- **Daily DB backups** — automatic SQLite backups with 7-day retention

## Architecture

```
src/
  bot/
    collectors/
      member-count.ts    # Periodic member count collection
      post-reactions.ts  # Real-time reaction tracking via channel events
    middleware/           # Error handling, logging
    index.ts             # Bot setup and event registration
  dashboard/
    middleware/
      auth.ts            # Basic auth for dashboard
      rate-limit.ts      # In-memory rate limiter (100 req/min per IP)
    routes/
      api.ts             # REST API: /api/members, /api/reactions, /api/posts, /api/photo/:id
      health.ts          # /health endpoint for Docker healthcheck
      index.ts           # Page routes: /, /posts
    views/               # EJS templates
    server.ts            # Express app setup
  db/
    repositories/        # Data access layer (channel, post, snapshot repos)
    connection.ts        # SQLite connection (better-sqlite3, WAL mode)
    schema.ts            # Migrations
  services/
    collector.ts         # Orchestrates data collection intervals
    db-backup.ts         # Daily SQLite backup with retention
  config.ts              # Typed env var config
  logger.ts              # Pino structured logging
  index.ts               # Entry point
scripts/
  backfill.ts            # One-time historical data import via GramJS (user auth)
  backfill-photos.ts     # Convert GramJS photo IDs to Bot API file_ids
```

## Tech Stack

- **Runtime:** Node.js 22 + TypeScript
- **Bot framework:** Telegraf v4
- **Database:** SQLite via better-sqlite3 (WAL mode)
- **Dashboard:** Express 5 + EJS + Chart.js
- **Testing:** Vitest
- **Linting:** ESLint + Prettier + Husky pre-commit hooks
- **Deployment:** Docker + GitHub Actions CI/CD

## Setup

### Prerequisites

- Node.js 22+
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- The bot must be added as an admin to the target channel

### 1. Clone and install

```bash
git clone https://github.com/IgorKonovalov/channel-statistics-bot.git
cd channel-statistics-bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `CHANNEL_ID` | Yes | Channel numeric ID (e.g. `-1001234567890`) |
| `DASHBOARD_USER` | Yes | Dashboard basic auth username |
| `DASHBOARD_PASSWORD` | Yes | Dashboard basic auth password |
| `DASHBOARD_PORT` | No | Dashboard port (default: `3000`) |
| `DB_PATH` | No | SQLite database path (default: `./data/stats.db`) |
| `LOG_LEVEL` | No | Log level: trace/debug/info/warn/error/fatal (default: `info`) |

### 3. Run in development

```bash
npm run dev
```

### 4. Run in production (Docker)

```bash
docker compose up -d --build
```

The dashboard will be available at `http://localhost:3000` (or your configured port).

## Scripts

```bash
npm run dev          # Development with hot reload
npm run build        # Compile TypeScript
npm start            # Run compiled JS
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run typecheck    # Type check without emitting
npm run lint         # Lint source files
npm run lint:fix     # Lint and auto-fix
npm run format       # Format with Prettier
```

### Data scripts

These scripts run on the host (not inside Docker). Stop the bot first.

**Backfill historical data** (requires Telegram API credentials from https://my.telegram.org):

```bash
npx tsx scripts/backfill.ts
```

**Backfill photo file_ids** (requires a utility chat where the bot is admin):

```bash
npx tsx scripts/backfill-photos.ts <UTILITY_CHAT_ID>
npx tsx scripts/backfill-photos.ts <UTILITY_CHAT_ID> --dry-run  # preview only
```

## Dashboard

The dashboard is protected by basic auth and provides:

- **Overview page** (`/`) — Member count chart, daily reactions chart, KPI cards
- **Posts page** (`/posts`) — Per-post breakdown with thumbnails, reactions, sortable by reactions or date
- **Health check** (`/health`) — Unauthenticated, used by Docker healthcheck

### API Endpoints

All API endpoints accept `from` and `to` query parameters for date filtering.

| Endpoint | Description |
|---|---|
| `GET /api/members` | Member count over time |
| `GET /api/reactions` | Daily reaction totals |
| `GET /api/posts` | Per-post breakdown (supports `sort` param: `reactions`, `date`) |
| `GET /api/photo/:messageId` | Post thumbnail (cached to disk) |
| `GET /health` | Health check |

## Docker

The app runs as a non-root user (`app`) inside the container. Data is persisted in a named Docker volume (`bot-data`).

```bash
docker compose up -d --build    # Build and start
docker compose stop             # Stop
docker compose start            # Start (without rebuild)
docker compose logs --tail 50   # View logs
```

### Accessing data inside the container

```bash
# Check photo cache
docker compose exec bot ls /app/data/photos/ | head -20
docker compose exec bot du -sh /app/data/photos/

# Check DB backups
docker compose exec bot ls /app/data/backups/

# Copy DB out for inspection
docker cp $(docker compose ps -aq bot):/app/data/stats.db ./data/stats.db
```

## CI/CD

Pushing to `master` triggers the GitHub Actions pipeline:

1. **Check** — typecheck, lint, test
2. **Deploy** — SSH into server, `git pull`, `docker compose up -d --build`

## License

ISC

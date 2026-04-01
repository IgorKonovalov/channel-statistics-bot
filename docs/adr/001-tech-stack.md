# ADR-001: Tech Stack for MVP

**Date:** 2026-04-01
**Status:** Proposed

## Context

We need to choose the tech stack for a Telegram channel statistics bot with a web dashboard. Requirements: passive bot collecting metrics (member count, views, reposts, reactions), SQLite storage, server-rendered dashboard for admins, deployed via Docker on a VPS.

## Options Considered

### Option A: Telegraf + Express + EJS + Chart.js + better-sqlite3

- Pros: All TypeScript, Telegraf has excellent TS support and middleware pattern, Express/EJS is zero-build server rendering, Chart.js is lightweight and CDN-loadable, better-sqlite3 is synchronous and simple
- Cons: EJS templates can get messy at scale, no client-side interactivity without adding JS manually

### Option B: Telegraf + Fastify + React SSR + better-sqlite3

- Pros: Fastify is faster than Express, React enables rich interactivity later
- Cons: SSR adds complexity (hydration, build step), overkill for charts-only MVP, heavier dependency tree

### Option C: grammY + Hono + HTMX + better-sqlite3

- Pros: Modern lightweight stack, HTMX gives interactivity without full SPA
- Cons: grammY has smaller ecosystem than Telegraf, Hono is newer with less middleware available, HTMX adds a learning curve

## Decision

**Option A: Telegraf + Express + EJS + Chart.js + better-sqlite3**

This is the simplest stack that meets all requirements. No frontend build step, mature libraries with strong TypeScript support, and easy to reason about. We can upgrade the dashboard later (e.g., add HTMX or swap to a different renderer) without touching the bot or data layers.

## Consequences

- **Positive:** Fast to build, minimal config, single `tsc` build step, easy Docker setup
- **Positive:** All dependencies are well-maintained with large communities
- **Negative:** EJS limits reusability — if dashboard grows complex, we may want to migrate to a component-based renderer
- **Negative:** No client-side routing — each page is a full reload (acceptable for MVP)

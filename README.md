Road To Top currently ships an idle-MMO gameplay slice built on the existing single-package setup:

- `Next.js` frontend and API routes in `src/`
- PostgreSQL schema bootstrap in `server/sql/init.sql`
- optional Redis mirror for live AFK state
- legacy websocket prototype still present in `server/`, but the main gameplay loop now uses REST APIs

## Current Scope

This branch now supports the minimum playable loop:

- guest one-click login
- character creation with 3 races and 3 classes
- a main UI skeleton with top bar, left menu, map selection, and bottom actions
- start/stop AFK on 2 maps
- offline reward settlement with server time and an 8-hour cap
- core PostgreSQL tables: `"user"`, `"role"`, `item`, `backpack`, `afk`, `task`

## Getting Started

Install dependencies:

```bash
pnpm install
```

Set up a local `.env` from `.env.example`:

```bash
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/roadtotop_dev
REDIS_URL=redis://127.0.0.1:6379
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8080
```

Initialize the game schema and item seed data:

```bash
pnpm db:init
```

Start local development:

```bash
pnpm dev
```

Useful scripts:

```bash
pnpm dev:web
pnpm dev:ws
pnpm db:init
pnpm lint
pnpm typecheck
pnpm build
```

## API Endpoints

The frontend uses these routes:

- `POST /api/auth/guest`
- `GET /api/session`
- `POST /api/role/create`
- `POST /api/afk/start`
- `POST /api/afk/stop`
- `POST /api/afk/claim`

All AFK timing and reward settlement are server-authoritative.

## Notes

- Redis is optional for local development. If `REDIS_URL` is absent or unavailable, the app falls back to an in-memory mirror while keeping PostgreSQL as the source of truth.
- The browser stores the guest token locally, so refresh and re-entry restore the same visitor account and can trigger offline reward claim popups.

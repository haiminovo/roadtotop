# AGENTS.md — Road To Top

> This file is written for AI coding agents. It assumes the reader knows nothing about this project.

---

## Project Overview

**Road To Top** is a browser-based idle/AFK MMO game prototype. It is a Chinese-language web game where players can:

- **Guest login** (one-click, no registration required)
- **Create characters** with 6 races and 6 classes
- **AFK (idle) on maps** to earn gold, aether crystals, and experience
- **Manage equipment** via a backpack and body slot system
- **Trade items** on a player market
- **Chat** with other players in real-time via WebSocket
- **Battle enemies** triggered during AFK sessions
- **Offline reward settlement** (up to 8-hour cap)
- **Admin dashboard** for managing accounts, roles, and game configuration

The game is designed as a "行动" (idle/AFK) game where the server handles all progression logic authoritatively.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | Next.js 15.3.3 (App Router) |
| **React Version** | React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 + Custom CSS variables |
| **UI Components** | Ant Design (antd) 6.3.7 |
| **Icons** | react-icons (Gi* game icons) |
| **Font** | Space Grotesk (Google Fonts) + system Chinese fonts |
| **Backend API** | Next.js API Routes (`src/app/api/`) |
| **WebSocket Server** | Node.js + `websocket` library (`server/websocket.js`) |
| **Database** | PostgreSQL (via `pg` driver) |
| **Cache** | Redis (optional, falls back to in-memory Map) |
| **Package Manager** | pnpm |
| **Process Runner** | concurrently |
| **Linting** | ESLint 9 + eslint-config-next |

---

## Project Structure

```
roadtotop/
├── .github/workflows/          # Empty (no CI/CD configured)
├── public/                     # Static assets (SVG icons)
├── scripts/
│   └── server-setup.sh         # Server setup script
├── server/                     # Standalone Node.js servers (CommonJS)
│   ├── sql/
│   │   └── init.sql            # Database schema + seed data (~900 lines)
│   ├── chat-service.js         # Chat message service
│   ├── db.js                   # PostgreSQL pool (CommonJS, for WS server)
│   ├── dynamic-game-config.js  # Runtime game config defaults (CommonJS)
│   ├── game-service.js         # Core game logic (~4200 lines, CommonJS)
│   ├── init-db.js              # DB initialization script
│   ├── player-store.js         # Legacy player store (unused)
│   ├── start-websocket.js      # WebSocket server launcher (handles stale processes)
│   └── websocket.js            # WebSocket server (~545 lines)
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/              # Admin dashboard pages
│   │   │   ├── accounts/       # Account management
│   │   │   ├── config/         # Game config editor
│   │   │   ├── roles/          # Role management
│   │   │   ├── layout.tsx      # Admin layout (Ant Design)
│   │   │   └── page.tsx        # Redirects to /admin/accounts
│   │   ├── api/                # API Routes
│   │   │   ├── admin/
│   │   │   │   ├── accounts/route.ts
│   │   │   │   ├── config/route.ts
│   │   │   │   └── roles/route.ts
│   │   │   ├── afk/
│   │   │   │   ├── claim/route.ts
│   │   │   │   ├── start/route.ts
│   │   │   │   └── stop/route.ts
│   │   │   ├── auth/
│   │   │   │   ├── account/route.ts      # Account login
│   │   │   │   └── guest/route.ts        # Guest login
│   │   │   ├── account/
│   │   │   │   ├── register/route.ts     # Register account from guest
│   │   │   │   └── role/
│   │   │   │       └── delete/route.ts   # Delete role
│   │   │   ├── backpack/
│   │   │   │   └── drop/route.ts
│   │   │   ├── role/
│   │   │   │   └── create/route.ts
│   │   │   ├── runtime/
│   │   │   │   └── ws/route.ts           # WS port discovery
│   │   │   └── session/route.ts          # Full session snapshot
│   │   ├── globals.css           # Global styles (dark theme)
│   │   ├── layout.tsx            # Root layout with providers
│   │   └── page.tsx              # Home → GameDashboard
│   ├── components/
│   │   ├── chat/
│   │   │   └── index.tsx         # Chat UI component (~555 lines)
│   │   └── sidebar/
│   │       └── index.tsx         # Sidebar component
│   ├── features/
│   │   ├── admin/
│   │   │   ├── components/       # Admin UI components
│   │   │   └── types.ts          # Admin type definitions
│   │   ├── chat/
│   │   │   ├── hooks/
│   │   │   │   └── use-chat-socket.ts
│   │   │   └── types.ts
│   │   ├── game/
│   │   │   ├── components/
│   │   │   │   └── game-dashboard.tsx  # Main game UI (~2720 lines)
│   │   │   ├── context/
│   │   │   │   └── game-session-provider.tsx  # Game state management
│   │   │   └── types.ts          # Game type definitions
│   │   └── navigation/
│   │       └── sidebar-items.tsx
│   ├── lib/
│   │   ├── game-config.ts        # Static game config (races, classes, maps, items)
│   │   ├── i18n/                 # Internationalization
│   │   │   ├── index.ts          # i18n utilities
│   │   │   ├── provider.tsx      # Locale context provider
│   │   │   └── zh-cn.ts          # Chinese copy (~666 lines)
│   │   ├── server/               # Server-side utilities
│   │   │   ├── admin-config.ts   # Admin CRUD + dynamic config (~3000 lines)
│   │   │   ├── db.ts             # PostgreSQL pool (ESM, for API routes)
│   │   │   ├── dynamic-game-config.ts  # Runtime config loader
│   │   │   ├── game-session-service.ts # Core game service (~3142 lines)
│   │   │   ├── http.ts           # API helpers (jsonOk, jsonError, etc.)
│   │   │   ├── logger.ts         # Simple console logger
│   │   │   └── redis.ts          # Redis client with fallback
│   │   └── ui/
│   │       └── game-icons.ts     # react-icons mapping
│   └── types/
│       └── navigation.ts
├── .env.example                  # Environment variables template
├── next.config.ts                # Next.js config (reactStrictMode: false)
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

---

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Development (runs both Next.js and WebSocket server)
pnpm dev                    # concurrently: dev:web + dev:ws

# Individual dev servers
pnpm dev:web               # next dev --turbopack
pnpm dev:ws                # node --watch server/start-websocket.js

# Production
pnpm build                 # next build
pnpm start                 # concurrently: start:web + start:ws
pnpm start:web             # next start
pnpm start:ws              # node server/start-websocket.js

# Database
pnpm db:init               # node server/init-db.js

# Quality
pnpm lint                  # eslint .
pnpm typecheck             # tsc --noEmit
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/roadtotop_dev
REDIS_URL=redis://127.0.0.1:6379
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8080
```

- `DATABASE_URL` — **Required.** PostgreSQL connection string.
- `REDIS_URL` — Optional. Redis connection string. If absent or unavailable, the app falls back to an in-memory Map.
- `NEXT_PUBLIC_WS_URL` — WebSocket URL for frontend. If not set, the frontend discovers the port via `/api/runtime/ws`.
- `WS_PORT` — WebSocket server port (default 8080). Used by `server/start-websocket.js`.

---

## Architecture

### Dual-Backend Approach

The project uses two backend layers:

#### 1. Next.js API Routes (REST)
- Used for **state-changing operations** (start/stop AFK, claim rewards, create role, etc.)
- All API routes are in `src/app/api/**/route.ts`
- Standard pattern: POST with JSON body containing `guestToken`, return `{ ok: true, snapshot }`
- CORS headers are set on all responses
- Each route exports `POST`/`GET`/`PUT`/`DELETE` + `OPTIONS` handlers with `runtime = "nodejs"`

Key API endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/auth/guest` | Guest login/create |
| `POST /api/auth/account` | Account login |
| `POST /api/account/register` | Register account from guest |
| `POST /api/account/role/delete` | Delete role |
| `GET /api/session` | Full game state snapshot |
| `POST /api/role/create` | Create character |
| `POST /api/afk/start` | Start AFK on a map |
| `POST /api/afk/stop` | Stop AFK |
| `POST /api/afk/claim` | Claim offline rewards |
| `POST /api/backpack/drop` | Drop item |
| `GET /api/runtime/ws` | Discover WebSocket port |

#### 2. WebSocket Server (Real-time)
- Separate Node.js server on port 8080 (default), auto-fallback if port is occupied
- Handles **real-time features**: chat, live AFK progress updates, battle state
- Writes runtime port to `.runtime/ws.json` for frontend discovery
- Frontend connects via WebSocket after initial REST bootstrap
- On shutdown (SIGINT/SIGTERM), persists all active session snapshots

WebSocket message types:
- `session:start` — Initialize session
- `game:state:update` — Full state push
- `game:chat:message` — New chat message
- `game:chat:history` — Chat history on connect
- `game:afk:start`, `game:afk:stop`, `game:afk:claim` — AFK actions
- `game:backpack:drop`, `game:backpack:equip`, `game:backpack:unequip` — Inventory
- `game:market:create`, `game:market:buy`, `game:market:cancel` — Market
- `game:skill:equip`, `game:skill:unequip`, `game:skill:learn` — Skills

#### 3. Game Session Provider (Frontend)
- `GameSessionProvider` in `src/features/game/context/game-session-provider.tsx`
- Manages WebSocket connection, reconnection logic, and global game state
- Stores guest token in `localStorage` under `roadtotop.guest-token`
- Fetches initial snapshot via REST, then maintains real-time sync via WebSocket
- Handles page visibility changes: disconnects on background, reconnects on foreground

---

## Database Schema (PostgreSQL)

Core tables defined in `server/sql/init.sql`:

| Table | Purpose |
|-------|---------|
| `"user"` | User accounts (guest or registered) |
| `"role"` | Player characters (1 per user) |
| `item` | Item definitions (equipment, skill books, materials) |
| `backpack` | Player inventory with equipped status |
| `game_config` | Dynamic game configuration (JSONB) |
| `afk` | AFK session state and pending rewards |
| `market_listing` | Player market listings |
| `chat_logs` | Chat message history |

Key schema details:
- **User**: `user_id` (PK), `guest_token` (unique), `account_type`, `username`, `password_hash`, `password_salt`
- **Role**: `role_id` (PK), `user_id` (FK, unique), `name`, `race_key`, `class_key`, `level`, `exp`, `gold`, `aether_crystal`, stats, `current_health`, `avatar_seed`, `skill_state` (JSONB)
- **Item**: `item_id` (PK), `name`, `rarity`, `item_type`, `skill_key`, `icon_key`, `slot`, `slot_usage`, `description`, `sell_price`, `stat_json` (JSONB)
- **Backpack**: `backpack_id` (PK), `role_id` (FK), `item_id` (FK), `quantity`, `equipped`, `equipped_slot_groups` (JSONB)
- **AFK**: `afk_id` (PK), `role_id` (FK, unique), `status` (idle/active), `map_key`, `started_at`, `last_settled_at`, `pending_gold`, `pending_aether_crystal`, `pending_exp`, `accrued_seconds`, `recent_encounters` (JSONB), `battle_state` (JSONB)
- **Market Listing**: `listing_id` (PK), `seller_role_id` (FK), `item_id` (FK), `category_key`, `price`, `status` (active/sold/cancelled), `buyer_role_id`, `sold_price`, `fee_amount`, `seller_receive_amount`, `seller_notice_seen`

Indexes are created on frequently queried columns.

The schema uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and migration blocks to support incremental schema evolution.

---

## Game Configuration System

There are **two layers** of game configuration:

1. **Static defaults** in `src/lib/game-config.ts` — Hardcoded races, classes, maps, items, encounter pools, level curves, body slot capacities.
2. **Dynamic overrides** in PostgreSQL `game_config` table — Stored as JSONB, editable via the admin dashboard. Loaded at runtime and cached. Includes: races, classes, maps, afk encounters, battle enemies, system balance parameters.

The WebSocket server (`server/game-service.js`) and the Next.js API routes (`src/lib/server/game-session-service.ts`) each have their own copies of the game logic. The WebSocket server uses CommonJS modules in `server/`, while the API routes use ESM modules in `src/lib/server/`.

---

## Code Style Guidelines

1. **Language**: Primarily Chinese (zh-CN) — all user-facing text, comments, and many variable names are in Chinese.
2. **File naming**: kebab-case for files (`game-session-provider.tsx`, `dynamic-game-config.ts`).
3. **Path aliases**: `@/*` maps to `src/*`.
4. **API route pattern**: Each route exports `POST`/`GET`/`PUT`/`DELETE` + `OPTIONS` handlers with `runtime = "nodejs"`.
5. **Error handling**: Custom `ApiError` class with status codes; `jsonOk`/`jsonError` wrappers for consistent response format `{ ok: true, ... }` / `{ ok: false, error: ... }`.
6. **Database access**: Two patterns:
   - ESM: `src/lib/server/db.ts` (used by Next.js API routes)
   - CommonJS: `server/db.js` (used by standalone WebSocket server)
7. **TypeScript strict mode**: Enabled (`strict: true` in `tsconfig.json`).
8. **React Strict Mode**: Disabled in production (`reactStrictMode: false` in `next.config.ts`).
9. **CSS**: Dark theme with custom CSS variables, Tailwind v4 with `@theme inline`. Admin dashboard uses a separate light theme via Ant Design.
10. **ESLint**: Flat config (`eslint.config.mjs`), extends `next/core-web-vitals` and `next/typescript`. Special rule: `@typescript-eslint/no-require-imports` is off for `server/**/*.js` files.

---

## Testing Instructions

**No testing framework is configured.** There are no test files in the project source. If you add tests, consider:

- Vitest or Jest for unit tests
- Playwright for E2E tests
- Add a `test` script to `package.json`

---

## Security Considerations

1. **Guest tokens** are stored in `localStorage` and passed in request headers (`x-guest-token`) or query params (`guestToken`). They are the primary authentication mechanism for guest users.
2. **Account passwords** are hashed with `scryptSync` and a random salt. See `src/lib/server/game-session-service.ts`.
3. **CORS** is configured to allow all origins (`*`) on API responses.
4. **No rate limiting** is currently implemented on API routes or WebSocket messages.
5. **No input sanitization** beyond basic validation is present. PostgreSQL queries use parameterized queries, which helps prevent SQL injection.
6. **Admin dashboard** (`/admin`) has no authentication gate — it is publicly accessible in the current build.
7. **WebSocket connections** auto-accept without origin checking.

---

## Deployment Notes

- **No CI/CD pipelines** — `.github/workflows/` is empty.
- **No Docker** configuration.
- **No Vercel/Netlify** specific configs.
- The project is designed to run as a monolith with:
  1. Next.js app (frontend + API routes)
  2. Separate WebSocket server process
  3. PostgreSQL database
  4. Optional Redis cache

For production deployment, ensure both `next start` and `node server/start-websocket.js` are running. The `pnpm start` script runs both via `concurrently`.

---

## Important Files for Agents

| File | Purpose |
|------|---------|
| `src/lib/game-config.ts` | Static game data: races, classes, maps, items, encounters, level formulas |
| `src/lib/server/game-session-service.ts` | Core game logic for API routes (create role, AFK, rewards, market, battles) |
| `src/lib/server/admin-config.ts` | Admin CRUD, dynamic config loader, battle system logic |
| `src/lib/server/db.ts` | PostgreSQL pool + auto-init schema for API routes |
| `src/lib/server/http.ts` | API response helpers, CORS, error handling |
| `src/features/game/context/game-session-provider.tsx` | Frontend game state, WebSocket client |
| `src/features/game/types.ts` | TypeScript types for the entire game domain |
| `server/websocket.js` | WebSocket server (CommonJS) |
| `server/game-service.js` | Core game logic for WebSocket server (CommonJS) |
| `server/sql/init.sql` | Database schema + seed data |
| `src/lib/i18n/zh-cn.ts` | All Chinese UI copy |

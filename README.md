Road To Top is a single-package project with:

- a Next.js frontend in `src/`
- a lightweight WebSocket server in `server/`

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start both the frontend and the WebSocket server:

```bash
pnpm dev
```

This starts:

- the Next.js app at `http://localhost:3000`
- the WebSocket server at `ws://127.0.0.1:8080`

Useful scripts:

```bash
pnpm dev:web
pnpm dev:ws
pnpm lint
pnpm typecheck
```

## Structure

```text
src/        frontend app and components
server/     standalone websocket server
```

This keeps everything in one project without forcing the frontend and websocket service into the same runtime process.

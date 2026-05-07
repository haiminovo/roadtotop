#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="${1:-/www/wwwroot/roadtotop}"

echo "Project path: ${PROJECT_PATH}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not installed."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 is not installed."
  exit 1
fi

cd "${PROJECT_PATH}"

corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm db:init

pm2 start "pnpm start:web" --name roadtotop-web --update-env || true
pm2 start "pnpm start:ws" --name roadtotop-ws --update-env || true
pm2 save

echo "Server setup complete."

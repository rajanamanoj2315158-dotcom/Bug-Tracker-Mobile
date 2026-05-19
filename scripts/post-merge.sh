#!/bin/bash
set -e

echo "[post-merge] Installing locked dependencies..."
pnpm install --frozen-lockfile

echo "[post-merge] Starting database migration..."
if ! timeout 60 pnpm --filter @workspace/db run push; then
  echo "[post-merge] ERROR: Database migration failed."
  echo "[post-merge] Run 'pnpm --filter @workspace/db run push' manually after checking DATABASE_URL."
  exit 1
fi

echo "[post-merge] Migration complete."

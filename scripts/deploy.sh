#!/bin/bash
set -euo pipefail

TAG="${1:?Usage: deploy.sh <tag>}"

LOCKFILE="/tmp/blogus-deploy.lock"
exec 200>"$LOCKFILE"
flock -n 200 || { echo "Deploy already in progress"; exit 0; }

export PATH=~/.local/node/bin:$PATH
DEPLOY_DIR=~/projects/blogus
LOG=~/projects/blogus/deploy.log

echo "=== Deploy $TAG started at $(date) ===" >> "$LOG"

cd "$DEPLOY_DIR"

git fetch origin --tags >> "$LOG" 2>&1
git checkout "$TAG" >> "$LOG" 2>&1

echo "Checked out $TAG ($(git rev-parse --short HEAD))" >> "$LOG"

pnpm install --frozen-lockfile >> "$LOG" 2>&1 || { echo "!!! INSTALL FAILED for $TAG at $(date)" >> "$LOG"; exit 1; }

# build 在 webhook 触发的非交互环境下偶发静默失败，重试一次
if ! pnpm build >> "$LOG" 2>&1; then
  echo "!!! BUILD attempt 1 failed for $TAG, retrying..." >> "$LOG"
  sleep 3
  pnpm build >> "$LOG" 2>&1 || { echo "!!! BUILD FAILED (after retry) for $TAG at $(date)" >> "$LOG"; exit 1; }
fi

pm2 restart blogus >> "$LOG" 2>&1 || { echo "!!! PM2 RESTART FAILED for $TAG at $(date)" >> "$LOG"; exit 1; }

echo "=== Deploy $TAG finished at $(date) ===" >> "$LOG"

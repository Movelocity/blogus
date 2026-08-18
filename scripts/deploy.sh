#!/bin/bash
set -euo pipefail

TAG="${1:?Usage: deploy.sh <tag>}"

LOCKFILE="/tmp/blogus-deploy.lock"
exec 200>"$LOCKFILE"
flock -n 200 || { echo "Deploy already in progress"; exit 0; }

export PATH=~/.local/node/bin:$PATH
# 禁用 pnpm 升级提示：webhook 非交互环境下 update-notifier 曾致"install 成功但退出码非 0"（v0.2.0/v0.2.1，见 docs/webhook-install-failure-triage.md）
export NO_UPDATE_NOTIFIER=1
# 根治：pm2 注入的 IPC channel 变量污染 deploy 子进程——NODE_CHANNEL_FD=3 指向已被 close_fds 关闭的 fd，
# Node 启动时将其当 IPC channel 使用，fd 无效直接 abort()（SIGABRT，exit 134），install 被误判失败。
# 实测复现：带 NODE_CHANNEL_FD=3 时 EXIT=134，unset 后 EXIT=0（v0.2.0~v0.2.2 三次 webhook 失败均因此）。
unset NODE_CHANNEL_FD NODE_CHANNEL_SERIALIZATION_MODE NODE_APP_INSTANCE
DEPLOY_DIR=~/projects/blogus
LOG=~/projects/blogus/deploy.log

echo "=== Deploy $TAG started at $(date) ===" >> "$LOG"

cd "$DEPLOY_DIR"

# git fetch 在 webhook 非交互环境下反复挂死（HTTP/2 framing 层 bug，TCP 建立但数据停滞），
# 强制 HTTP/1.1 根治；仍保留超时 + 浅拉单 tag 兜底，避免 flock 卡死后续所有部署
if ! timeout 120 git -c http.version=HTTP/1.1 fetch origin --tags >> "$LOG" 2>&1; then
  echo "!!! FETCH timeout/failed for $TAG, fallback to shallow tag fetch" >> "$LOG"
  timeout 120 git -c http.version=HTTP/1.1 fetch --depth=1 origin "refs/tags/$TAG:refs/tags/$TAG" >> "$LOG" 2>&1 \
    || { echo "!!! FETCH FAILED (after fallback) for $TAG at $(date)" >> "$LOG"; exit 1; }
fi
git checkout "$TAG" >> "$LOG" 2>&1

echo "Checked out $TAG ($(git rev-parse --short HEAD))" >> "$LOG"

# install 在 webhook 非交互环境下偶发"输出完整但退出码非 0"（疑 pnpm 9.15.4 update-notifier 缺陷），重试一次；
# 重试时处于更新检查缓存窗口内，等效手动补跑（历史手动补跑均成功）。注意 `if ! cmd` 会丢失原始退出码，用 || 采集。
pnpm install --frozen-lockfile >> "$LOG" 2>&1 || INSTALL_EXIT=$?
if [ -n "${INSTALL_EXIT:-}" ] && [ "$INSTALL_EXIT" -ne 0 ]; then
  echo "!!! INSTALL attempt 1 failed for $TAG (exit=$INSTALL_EXIT) at $(date), retrying..." >> "$LOG"
  sleep 3
  pnpm install --frozen-lockfile >> "$LOG" 2>&1 \
    || { echo "!!! INSTALL FAILED (after retry) for $TAG at $(date)" >> "$LOG"; exit 1; }
fi
unset INSTALL_EXIT

# build 在 webhook 触发的非交互环境下偶发静默失败，重试一次
if ! pnpm build >> "$LOG" 2>&1; then
  echo "!!! BUILD attempt 1 failed for $TAG, retrying..." >> "$LOG"
  sleep 3
  pnpm build >> "$LOG" 2>&1 || { echo "!!! BUILD FAILED (after retry) for $TAG at $(date)" >> "$LOG"; exit 1; }
fi

pm2 restart blogus >> "$LOG" 2>&1 || { echo "!!! PM2 RESTART FAILED for $TAG at $(date)" >> "$LOG"; exit 1; }

echo "=== Deploy $TAG finished at $(date) ===" >> "$LOG"

#!/usr/bin/env bash
# 一鍵部署到 Railway（需先 railway login 一次）
set -e
railway whoami >/dev/null 2>&1 || { echo "先執行：railway login"; exit 1; }
railway init --name vibeai-station 2>/dev/null || railway link
railway variables --set "SESSION_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')" >/dev/null
railway volume add --mount-path /app/data 2>/dev/null || true
railway up --detach
railway domain 2>/dev/null || true
echo "完成。若要用 R2 存圖，再執行："
echo "  railway variables --set R2_ACCOUNT_ID=... --set R2_ACCESS_KEY=... --set R2_SECRET=... --set R2_BUCKET=... --set R2_PUBLIC_URL=https://..."

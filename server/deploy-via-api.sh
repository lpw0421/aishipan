#!/bin/bash
# 通过 GitHub API 下载最新代码并部署
# 用法: bash deploy-via-api.sh <github_token>
set -e

if [ -z "$1" ]; then
  echo "用法: bash deploy-via-api.sh <github_token>"
  exit 1
fi

GH_TOKEN="$1"
REPO="lpw0421/aishipan"
BASE="https://api.github.com/repos/$REPO/contents"

download() {
  curl -s -H "Authorization: token $GH_TOKEN" "$BASE/$1?ref=master" | python3 -c "import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode())" > "/opt/aishipan/$1"
}

echo "[deploy] 下载 server/index.js..."
download "server/index.js"
echo "[deploy] 重启服务..."
pm2 restart aishipan
echo "[deploy] 完成"

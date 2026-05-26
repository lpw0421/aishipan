#!/bin/bash
# ============================================
# 服务器夜巡 — 每30分钟检查服务是否在线
# 异常时通过飞书 API 发送告警
# ============================================

HEALTH_URL="http://127.0.0.1:3001/api/health"
FEISHU_APP_ID="cli_aa9840c926385ccd"
FEISHU_APP_SECRET="72AJWhp8LQff1V8nB6MOhhNiFH3J1wUG"
ALERT_OPEN_ID="ou_3d9a155051e5bc65f20f19e0f025eefa"
MAX_RETRIES=3
RETRY_SLEEP=10

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

send_alert() {
  local msg="$1"
  local token_resp
  token_resp=$(curl -s -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
    -H 'Content-Type: application/json' \
    -d "{\"app_id\":\"${FEISHU_APP_ID}\",\"app_secret\":\"${FEISHU_APP_SECRET}\"}")
  local token
  token=$(echo "$token_resp" | grep -o '"tenant_access_token":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$token" ]; then
    log "飞书token获取失败: $token_resp"
    return 1
  fi

  local now
  now=$(date '+%Y-%m-%d %H:%M:%S')
  local content
  content=$(cat <<EOF
{"text":"🚨 服务器告警：aishipan.com 无法访问！\\n时间：${now}\\n详情：${msg}\\n请检查服务器状态。"}
EOF
)

  curl -s -X POST "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d "{\"receive_id\":\"${ALERT_OPEN_ID}\",\"msg_type\":\"text\",\"content\":\"${content}\"}" \
    > /dev/null

  log "告警已发送"
}

# 三次重试
for i in $(seq 1 $MAX_RETRIES); do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$HEALTH_URL" 2>/dev/null)
  if [ "$http_code" = "200" ]; then
    # 正常，静默退出
    exit 0
  fi
  log "第${i}次检查失败，HTTP ${http_code}，${RETRY_SLEEP}秒后重试..."
  sleep $RETRY_SLEEP
done

# 三次都失败，发送告警
send_alert "连续${MAX_RETRIES}次健康检查失败，服务器可能已宕机"
exit 1

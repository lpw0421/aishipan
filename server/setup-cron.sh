#!/bin/bash
# ============================================
# 定时任务安装脚本
# 用法: sudo bash /opt/aishipan/server/setup-cron.sh
# ============================================
set -e

echo "=== AI食安 定时任务安装 ==="

# 0. 检测 node 路径
NODE_PATH=$(which node 2>/dev/null || echo "/usr/bin/node")
echo "Node.js 路径: $NODE_PATH"

# 1. 赋予脚本执行权限
chmod +x /opt/aishipan/server/patrol.sh

# 2. 写 crontab（保留已有任务，去重追加）
CRON_FILE="/tmp/aishipan-crontab"

# 导出当前 crontab
crontab -l 2>/dev/null > "$CRON_FILE" || true

# 删除旧的同名任务（如果有）
sed -i '/aishipan/d' "$CRON_FILE"

cat >> "$CRON_FILE" << CRONEOF

# ===== AI食安 定时任务 =====
# 服务器夜巡 — 每30分钟检查一次
*/30 * * * * /opt/aishipan/server/patrol.sh >> /var/log/aishipan-patrol.log 2>&1
# 法规每日推送 — 每天早上8:00
0 8  * * * ${NODE_PATH} /opt/aishipan/server/feishu-regulations.js >> /var/log/aishipan-regulations.log 2>&1
# 舆情监控 — 每天早上8:30
30 8 * * * ${NODE_PATH} /opt/aishipan/server/feishu-sentiment.js >> /var/log/aishipan-sentiment.log 2>&1
CRONEOF

# 3. 安装
crontab "$CRON_FILE"
rm "$CRON_FILE"

# 4. 验证
echo ""
echo "已安装的定时任务:"
crontab -l | grep aishipan
echo ""
echo "安装完成！日志文件:"
echo "  /var/log/aishipan-patrol.log"
echo "  /var/log/aishipan-regulations.log"
echo "  /var/log/aishipan-sentiment.log"

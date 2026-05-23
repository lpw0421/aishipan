#!/bin/bash
# ============================================
# AI 食安 - 数据库自动备份脚本
# ============================================
# 用法：
#   chmod +x backup.sh
#   ./backup.sh                          # 手动执行
#   crontab -e                           # 添加定时任务
#   0 2 * * * /var/www/ai-shipan/backup.sh >> /var/log/ai-shipan-backup.log 2>&1
# ============================================

set -e

# ---- 配置 ----
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_FILE="${PROJECT_DIR}/server/data.db"
BACKUP_DIR="${PROJECT_DIR}/backups"
KEEP_DAYS=30           # 保留最近 30 天的备份
MAX_BACKUPS=90         # 最多保留 90 个备份文件

# ---- 检查数据库文件 ----
if [ ! -f "$DB_FILE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ 数据库文件不存在: $DB_FILE"
    exit 1
fi

# ---- 创建备份目录 ----
mkdir -p "$BACKUP_DIR"

# ---- 生成备份文件名 ----
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/ai-shipan_${TIMESTAMP}.db.gz"

# ---- 执行备份 ----
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 开始备份..."

# 使用 SQLite .backup 命令（安全，支持 WAL 模式）
sqlite3 "$DB_FILE" ".backup '${BACKUP_DIR}/ai-shipan_${TIMESTAMP}.db'"

# 压缩备份文件
gzip "${BACKUP_DIR}/ai-shipan_${TIMESTAMP}.db"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 备份完成: $BACKUP_FILE ($(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE") bytes)"

# 同时备份 uploads 目录
UPLOADS_DIR="${PROJECT_DIR}/server/uploads"
UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
if [ -d "$UPLOADS_DIR" ]; then
    tar -czf "$UPLOADS_BACKUP" -C "${PROJECT_DIR}/server" uploads/ 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📁 文件备份: $UPLOADS_BACKUP"
fi

# ---- 清理过期备份 ----
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧹 清理过期备份（保留 ${KEEP_DAYS} 天）..."

# 删除超过保留天数的备份
find "$BACKUP_DIR" -name "ai-shipan_*.db.gz" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true

# 如果备份数量超过上限，删除最旧的
DB_COUNT=$(find "$BACKUP_DIR" -name "ai-shipan_*.db.gz" | wc -l)
if [ "$DB_COUNT" -gt "$MAX_BACKUPS" ]; then
    find "$BACKUP_DIR" -name "ai-shipan_*.db.gz" -printf '%T@ %p\n' 2>/dev/null | sort -n | head -n $((DB_COUNT - MAX_BACKUPS)) | cut -d' ' -f2- | xargs rm -f 2>/dev/null || true
fi

# ---- 备份列表摘要 ----
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 备份统计: 共 ${DB_COUNT} 个数据库备份，占用 ${TOTAL_SIZE:-0}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 备份任务完成"

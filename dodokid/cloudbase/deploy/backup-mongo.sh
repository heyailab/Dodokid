#!/usr/bin/env bash
# DodoKid 数据库备份（直接部署版）
#
# 装到定时任务：
#   sudo cp deploy/backup-mongo.sh /usr/local/bin/dodokid-backup-mongo
#   sudo chmod +x /usr/local/bin/dodokid-backup-mongo
#   sudo crontab -e
#   # 每天 03:17 备份，保留 14 天（避开整点，减少与其它任务撞车）
#   17 3 * * * /usr/local/bin/dodokid-backup-mongo >> /var/log/dodokid-backup.log 2>&1
#
# 说明：备份的是 MongoDB 数据卷里的全部集合。恢复见文件末尾注释。
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/dodokid}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%F)"
mkdir -p "$BACKUP_DIR"

# 从部署用的 .env 读取连接串（避免把密码写进 crontab 或进程参数）
ENV_FILE="${ENV_FILE:-/opt/dodokid/dodokid/cloudbase/.env}"
if [ ! -r "$ENV_FILE" ]; then
  echo "ERROR: 读不到 $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
MONGODB_URI="$(grep -E '^MONGODB_URI=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
if [ -z "$MONGODB_URI" ]; then
  echo "ERROR: $ENV_FILE 里没有 MONGODB_URI" >&2
  exit 1
fi

OUT="$BACKUP_DIR/dodokid-$STAMP.archive.gz"

# --gzip 压缩、--archive 单文件；mongodump 非 0 退出码即失败（set -e 已覆盖）
echo "[$(date -Is)] 开始备份 -> $OUT"
if mongodump --uri="$MONGODB_URI" --archive --gzip --quiet > "$OUT"; then
  SIZE="$(du -h "$OUT" | cut -f1)"
  echo "[$(date -Is)] 备份成功：$OUT（$SIZE）"
else
  echo "[$(date -Is)] 备份失败，已删除不完整文件" >&2
  rm -f "$OUT"
  exit 1
fi

# 清理过期备份
find "$BACKUP_DIR" -maxdepth 1 -name 'dodokid-*.archive.gz' -mtime "+$RETENTION_DAYS" -print -delete

# ---------- 恢复 ----------
# mongorestore --uri="mongodb://..." --archive --gzip --drop < dodokid-YYYY-MM-DD.archive.gz
# --drop 会先删除同名集合，务必确认目标库无误后再执行。

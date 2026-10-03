#!/usr/bin/env bash
# DodoKid 备份：数据库 + 本地媒体（直接部署版）
#
# 自托管把绘本封面/音频放在服务器磁盘（MEDIA_ROOT）之后，**只备数据库是不够的** ——
# 媒体丢了要重新上传全部素材。本脚本一次备齐两份。
#
# 装到定时任务：
#   sudo cp deploy/backup-mongo.sh /usr/local/bin/dodokid-backup
#   sudo chmod +x /usr/local/bin/dodokid-backup
#   sudo crontab -e
#   # 每天 03:17 备份，保留 14 天（避开整点，减少与其它任务撞车）
#   17 3 * * * /usr/local/bin/dodokid-backup >> /var/log/dodokid-backup.log 2>&1
#
# 恢复：
#   mongorestore --uri="mongodb://..." --archive --gzip --drop < dodokid-YYYY-MM-DD-db.archive.gz
#   tar -xzf dodokid-YYYY-MM-DD-media.tar.gz -C /var/lib/dodokid
#   （--drop 会先删库，务必先确认目标环境）
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/dodokid}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%F)"
mkdir -p "$BACKUP_DIR"

# 从部署用的 .env 读配置（避免把密码写进 crontab 或进程参数）
ENV_FILE="${ENV_FILE:-/opt/dodokid/dodokid/cloudbase/.env}"
if [ ! -r "$ENV_FILE" ]; then
  echo "ERROR: 读不到 $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
MONGODB_URI="$(grep -E '^MONGODB_URI=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
MEDIA_ROOT="$(grep -E '^MEDIA_ROOT=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
MEDIA_ROOT="${MEDIA_ROOT:-/var/lib/dodokid/media}"
if [ -z "$MONGODB_URI" ]; then
  echo "ERROR: $ENV_FILE 里没有 MONGODB_URI" >&2
  exit 1
fi

# ---------- 1. 数据库 ----------
DB_OUT="$BACKUP_DIR/dodokid-$STAMP-db.archive.gz"
echo "[$(date -Is)] 备份数据库 -> $DB_OUT"
if mongodump --uri="$MONGODB_URI" --archive --gzip --quiet > "$DB_OUT"; then
  echo "[$(date -Is)] 数据库备份成功：$(du -h "$DB_OUT" | cut -f1)"
else
  echo "[$(date -Is)] 数据库备份失败，已删除不完整文件" >&2
  rm -f "$DB_OUT"
  exit 1
fi

# ---------- 2. 本地媒体 ----------
if [ -d "$MEDIA_ROOT" ]; then
  MEDIA_OUT="$BACKUP_DIR/dodokid-$STAMP-media.tar.gz"
  echo "[$(date -Is)] 备份媒体 -> $MEDIA_OUT"
  if tar -czf "$MEDIA_OUT" -C "$(dirname "$MEDIA_ROOT")" "$(basename "$MEDIA_ROOT")"; then
    echo "[$(date -Is)] 媒体备份成功：$(du -h "$MEDIA_OUT" | cut -f1)"
  else
    echo "[$(date -Is)] 媒体备份失败，已删除不完整文件" >&2
    rm -f "$MEDIA_OUT"
    exit 1
  fi
else
  # 非本地媒体形态（用对象存储）时跳过，属正常
  echo "[$(date -Is)] 未发现本地媒体目录（$MEDIA_ROOT），跳过媒体备份"
fi

# ---------- 3. 清理过期 ----------
find "$BACKUP_DIR" -maxdepth 1 -name 'dodokid-*.archive.gz' -mtime "+$RETENTION_DAYS" -print -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'dodokid-*-media.tar.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "[$(date -Is)] 备份完成，目录：$BACKUP_DIR"

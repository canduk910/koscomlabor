#!/bin/bash
# 방명록 DB 일일 백업 (서버 배치: /root/koscomlabor-api/backup.sh, cron 03:00 KST)
# pg_dump -Fc → /root/backups, 14일 롤링. 2차 보관(Object Storage)은 07 문서 참조.
set -euo pipefail

BACKUP_DIR=/root/backups
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP=$(date +%Y%m%d)

docker exec koscomlabor-db pg_dump -U guestbook_app -Fc guestbook \
  > "$BACKUP_DIR/guestbook_${STAMP}.dump"

# 14일 롤링
find "$BACKUP_DIR" -name 'guestbook_*.dump' -mtime +14 -delete

echo "$(date '+%F %T') backup ok: guestbook_${STAMP}.dump ($(stat -c%s "$BACKUP_DIR/guestbook_${STAMP}.dump") bytes)"

# 2차 보관: NCP Object Storage 버킷 확보 후 주석 해제 (S3 호환)
# aws --endpoint-url=https://kr.object.ncloudstorage.com s3 cp \
#   "$BACKUP_DIR/guestbook_${STAMP}.dump" "s3://<버킷명>/guestbook/"

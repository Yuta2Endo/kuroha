#!/usr/bin/env bash
# Kuroha backup: pack db.json and uploads/ from the Docker volume.
# Usage: [KUROHA_VOLUME=...] [BACKUP_DIR=...] [RETENTION_DAYS=...] ./backup.sh
set -euo pipefail

KUROHA_VOLUME="${KUROHA_VOLUME:-kuroha_kuroha_data}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kuroha}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

case "$RETENTION_DAYS" in
  ''|*[!0-9]*)
    echo "RETENTION_DAYS должен быть целым числом дней, получено: $RETENTION_DAYS" >&2
    exit 1
    ;;
esac

mkdir -p "$BACKUP_DIR"

echo "Volume: $KUROHA_VOLUME"
echo "Каталог бэкапов: $BACKUP_DIR"

if ! docker volume inspect "$KUROHA_VOLUME" >/dev/null 2>&1; then
  echo "Volume $KUROHA_VOLUME не найден. Проверь имя: docker volume ls | grep kuroha" >&2
  exit 1
fi

docker run --rm \
  -v "$KUROHA_VOLUME:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  alpine:3.20 sh -c 'tar czf /backup/kuroha-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .'

LATEST="$(ls -1t "$BACKUP_DIR"/kuroha-*.tar.gz 2>/dev/null | head -n 1 || true)"
if [ -z "$LATEST" ] || [ ! -f "$LATEST" ]; then
  echo "Архив не найден в $BACKUP_DIR. Проверь mount, права и имя volume." >&2
  exit 1
fi

SIZE="$(du -h "$LATEST" | cut -f1)"

if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'kuroha-*.tar.gz' \
    -mtime +"$RETENTION_DAYS" -delete
fi

echo "Бэкап: $LATEST"
echo "Размер: $SIZE"

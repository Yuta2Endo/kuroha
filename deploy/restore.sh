#!/usr/bin/env bash
# Kuroha restore: replace the Docker volume contents from a backup archive.
# The API container must be stopped. Containers are not started automatically.
# Usage: [KUROHA_VOLUME=...] [KUROHA_CONTAINER=...] [BACKUP_DIR=...] ./restore.sh <archive>
set -euo pipefail

KUROHA_VOLUME="${KUROHA_VOLUME:-kuroha_kuroha_data}"
KUROHA_CONTAINER="${KUROHA_CONTAINER:-kuroha-api}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kuroha}"
SAFETY_DIR="${SAFETY_DIR:-$BACKUP_DIR/pre-restore}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="${1:-}"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Использование: $0 /путь/к/kuroha-YYYYmmdd-HHMMSS.tar.gz" >&2
  exit 1
fi

case "$ARCHIVE" in
  /*|[A-Za-z]:/*|[A-Za-z]:\\*)
    ARCHIVE_DIR="$(dirname "$ARCHIVE")"
    ;;
  *)
    ARCHIVE_DIR="$(cd "$(dirname "$ARCHIVE")" && pwd)"
    ;;
esac
ARCHIVE_NAME="$(basename "$ARCHIVE")"
ARCHIVE="$ARCHIVE_DIR/$ARCHIVE_NAME"

if docker ps --format '{{.Names}}' | grep -qx "$KUROHA_CONTAINER"; then
  echo "Контейнер $KUROHA_CONTAINER запущен." >&2
  echo "Останови его перед восстановлением: docker stop $KUROHA_CONTAINER" >&2
  exit 1
fi

if ! docker volume inspect "$KUROHA_VOLUME" >/dev/null 2>&1; then
  echo "Volume $KUROHA_VOLUME не найден. Проверь имя: docker volume ls | grep kuroha" >&2
  exit 1
fi

echo "Архив: $ARCHIVE"
echo "Volume: $KUROHA_VOLUME"
echo "Контейнер $KUROHA_CONTAINER остановлен (или отсутствует) — продолжаем."

mkdir -p "$SAFETY_DIR"
SAFETY_OUTPUT="$(KUROHA_VOLUME="$KUROHA_VOLUME" BACKUP_DIR="$SAFETY_DIR" bash "$SCRIPT_DIR/backup.sh")"
echo "Страховочный бэкап:"
echo "$SAFETY_OUTPUT"

if [ ! -f "$ARCHIVE" ]; then
  echo "Исходный архив исчез после страховочного бэкапа: $ARCHIVE" >&2
  exit 1
fi

echo "Проверяем целостность архива…"
docker run --rm \
  -v "$ARCHIVE_DIR:/backup:ro" \
  alpine:3.20 sh -c 'tar tzf "/backup/$0" >/dev/null' "$ARCHIVE_NAME"

echo "Распаковываем архив в volume…"
docker run --rm \
  -v "$KUROHA_VOLUME:/data" \
  -v "$ARCHIVE_DIR:/backup:ro" \
  alpine:3.20 sh -c 'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null; tar xzf "/backup/$0" -C /data' "$ARCHIVE_NAME"

echo "Готово. Запусти контейнер вручную: docker start $KUROHA_CONTAINER"

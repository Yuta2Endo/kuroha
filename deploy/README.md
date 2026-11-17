# Бэкап и восстановление Kuroha

Скрипты работают с Docker volume стека (`/data`): внутри лежат `db.json` и
`uploads/`. Сторонние сервисы и контейнеры не нужны, только `docker` и образ
`alpine:3.20`.

| Файл | Назначение |
|---|---|
| `backup.sh` | архивирует volume в `kuroha-YYYYmmdd-HHMMSS.tar.gz`, чистит старые архивы |
| `restore.sh` | делает страховочный бэкап и распаковывает архив в volume |

Перед первым запуском проверь имя volume: при стеке `kuroha` это обычно
`kuroha_kuroha_data`.

```bash
docker volume ls | grep kuroha
docker volume inspect kuroha_kuroha_data
chmod +x /opt/kuroha/deploy/backup.sh /opt/kuroha/deploy/restore.sh
```

## Бэкап

Переменные окружения:

| Переменная | По умолчанию | Что задаёт |
|---|---|---|
| `KUROHA_VOLUME` | `kuroha_kuroha_data` | volume с `/data` |
| `BACKUP_DIR` | `/var/backups/kuroha` | каталог для архивов на хосте |
| `RETENTION_DAYS` | `14` | сколько дней хранить архивы |

```bash
sudo install -d -m 700 /var/backups/kuroha
sudo KUROHA_VOLUME=kuroha_kuroha_data \
  BACKUP_DIR=/var/backups/kuroha \
  RETENTION_DAYS=14 \
  /opt/kuroha/deploy/backup.sh
```

Скрипт печатает путь к новому архиву и его размер. Старые архивы
`kuroha-*.tar.gz` удаляются через `find -mtime +RETENTION_DAYS`.

### Cron

Cron запускает задачу от `root` (у него есть доступ к Docker) или от
пользователя в группе `docker`:

```cron
17 3 * * * /opt/kuroha/deploy/backup.sh >> /var/log/kuroha-backup.log 2>&1
```

Лог не ротируется автоматически. Добавь запись в `/etc/logrotate.d/kuroha`,
если бэкапы идут долго:

```text
/var/log/kuroha-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
```

API во время бэкапа не останавливается. `db.json` сервер пишет через временный
файл и `rename`, поэтому архив получит целую версию базы, но страницы в
`uploads/` могут меняться прямо во время `tar`. Для строго согласованного
снимка останови `kuroha-api` на время бэкапа или делай его в окне, когда
загрузок нет.

## Восстановление

1. Останови API:

   ```bash
   docker stop kuroha-api
   ```

2. Запусти восстановление:

   ```bash
   sudo KUROHA_VOLUME=kuroha_kuroha_data \
     BACKUP_DIR=/var/backups/kuroha \
     /opt/kuroha/deploy/restore.sh \
     /var/backups/kuroha/kuroha-20261117-031700.tar.gz
   ```

3. Запусти API вручную — скрипт контейнеры не стартует:

   ```bash
   docker start kuroha-api
   curl -fsS https://api.kuroha.org/api/health
   ```

Что делает `restore.sh`:

- отказывается работать, если контейнер `kuroha-api` запущен;
- проверяет, что архив и volume существуют;
- складывает текущее содержимое volume в `BACKUP_DIR/pre-restore` перед
  распаковкой;
- очищает `/data` и распаковывает архив через `alpine:3.20`;
- не запускает контейнеры и не меняет compose-стек.

Имя контейнера и volume можно переопределить для проверки:

```bash
KUROHA_CONTAINER=kuroha-restore-check KUROHA_VOLUME=kuroha_restore_test ...
```

## Проверка восстановления на отдельном volume

Не трогай production-volume: создай временный, восстанови в него архив и
сравни файлы.

```bash
docker volume create kuroha_restore_test

sudo KUROHA_VOLUME=kuroha_restore_test \
  KUROHA_CONTAINER=kuroha-restore-check \
  BACKUP_DIR=/tmp/kuroha-restore-backup \
  /opt/kuroha/deploy/restore.sh /var/backups/kuroha/kuroha-20261117-031700.tar.gz

docker run --rm -v kuroha_restore_test:/data alpine:3.20 \
  sh -c 'ls -l /data && test -s /data/db.json && echo "db.json на месте"'

docker volume rm kuroha_restore_test
```

Если в архиве были страницы, проверь, что `uploads/` не пуст и число файлов
совпадает с исходным volume:

```bash
docker run --rm -v kuroha_kuroha_data:/data:ro alpine:3.20 \
  sh -c 'find /data/uploads -type f | wc -l'
```

## Ограничения

`db.json` + `uploads/` — demo-хранилище, а не production-база. В нём нет
транзакций, блокировок и конкурентной записи; бэкап — это снимок файлов, а не
согласованный дамп СУБД. Для production нужны PostgreSQL (схема в
`docs/schema.sql`) и S3/R2 для страниц, с их собственными backup/PITR. Эти
скрипты остаются аварийным инструментом для текущего demo-среза.

Сертификаты Caddy лежат в volume `caddy_data` и в этот бэкап не входят: при
потере Caddy выпустит новые, но упрётся в лимиты Let's Encrypt при частых
пересозданиях.

# Деплой API Kuroha на VPS

Как поднять backend `server/` на VPS `82.147.89.193` через Portainer: контейнер
API, Caddy с TLS и публичный адрес `https://api.kuroha.org`. Фронтенд остаётся
на GitHub Pages и в этом шаге не меняется.

```text
GitHub Actions ──push в main──> ghcr.io/yuta2endo/kuroha-api:latest
                                          │ docker pull
VPS 82.147.89.193                         ▼
┌──────────────────────────────────────────────────────┐
│ Portainer stack «kuroha»                             │
│                                                      │
│  kuroha-caddy    :80, :443  ──reverse_proxy──┐       │
│                                              ▼       │
│  kuroha-api      4180 (только внутри сети)  /data    │
│                                              │       │
│                                    volume kuroha_data│
└──────────────────────────────────────────────────────┘
```

Файлы деплоя:

| Файл | Назначение |
|---|---|
| `server/Dockerfile` | образ API на `node:24-alpine`, non-root, healthcheck |
| `server/.dockerignore` | не тащить в образ `db.json`, `uploads/`, `node_modules/` |
| `deploy/docker-compose.yml` | стек Portainer: `api` + `caddy` + volumes |
| `deploy/Caddyfile` | сайт `api.kuroha.org`, gzip/zstd, прокси на `api:4180` |
| `.github/workflows/api-image.yml` | сборка и push образа в GHCR |

## 0. Что понадобится

- доступ к DNS `kuroha.org` (A-запись);
- вход в Portainer на VPS (обычно `https://82.147.89.193:9443`);
- SSH на VPS — для логов, бэкапа и проверки занятых портов;
- права в GitHub-репозитории `Yuta2Endo/kuroha` — включить workflow и, при
  необходимости, открыть пакет GHCR.

Порты `80` и `443` на VPS должны быть свободны. Если там уже работает nginx,
Traefik или другой Caddy, стек не запустится: сначала освободи порты или
переиспользуй существующий reverse proxy вместо сервиса `caddy`.

## 1. DNS

Добавь A-запись:

```text
api.kuroha.org.   300   IN   A   82.147.89.193
```

Проверка с локальной машины:

```powershell
Resolve-DnsName api.kuroha.org
# или
nslookup api.kuroha.org
```

Ждёшь, пока ответит именно `82.147.89.193`. Caddy получает сертификат при
первом запросе, поэтому DNS лучше сделать **до** первого запуска стека. Если
запись ещё не разошлась, Caddy будет повторять попытки сам, но в логах будет
ошибка ACME.

Если `kuroha.org` обслуживается Cloudflare, на время первого выпуска
сертификата оставь запись `api` в режиме **DNS only** (серая тучка).
Оранжевая тучка ломает HTTP-01 challenge, если прокси не пропускает
`/.well-known/acme-challenge/`. После выпуска можно включить прокси, но TLS
тогда будет завершаться на Cloudflare, а не на Caddy.

## 2. Образ и пакет GHCR

Workflow `.github/workflows/api-image.yml` собирает `./server` и пушит
`ghcr.io/yuta2endo/kuroha-api:latest` при push в `main`, если менялись
`server/**`, `deploy/**` или сам workflow. Первую сборку можно запустить
вручную: **Actions → Build API image → Run workflow**.

Права workflow:

- `contents: read` — checkout;
- `packages: write` — push в GitHub Container Registry;
- логин — встроенный `GITHUB_TOKEN`, отдельный PAT для CI не нужен.

После первой сборки открой настройки пакета:

```text
https://github.com/users/Yuta2Endo/packages/container/kuroha-api/settings
```

Два варианта доступа для Portainer:

1. **Пакет public** (проще). Package settings → Change visibility → Public.
   Portainer тянет образ без логина.
2. **Пакет private.** Создай classic PAT с правом `read:packages` и добавь
   registry в Portainer: **Registries → Add registry → Custom registry**:
   - Name: `ghcr`
   - Registry URL: `ghcr.io`
   - Username: `Yuta2Endo`
   - Password: PAT с `read:packages`

   Затем при создании стека выбери этот registry (или включи его для stack
   pull). Токен хранится в Portainer, в репозиторий его класть нельзя.

Проверка, что образ существует и доступен:

```powershell
docker pull ghcr.io/yuta2endo/kuroha-api:latest
```

## 3. Стек в Portainer

**Stacks → Add stack → Repository**:

| Поле | Значение |
|---|---|
| Name | `kuroha` |
| Repository URL | `https://github.com/Yuta2Endo/kuroha` |
| Reference | `refs/heads/main` |
| Compose path | `deploy/docker-compose.yml` |

Если репозиторий приватный, включи **Authentication** и укажи GitHub-логин и
PAT с доступом на чтение репозитория.

Переменные окружения стека задавать не нужно: compose уже выставляет
`KUROHA_ALLOWED_ORIGINS=https://yuta2endo.github.io,https://kuroha.org,https://www.kuroha.org`.
Если появится новый origin фронтенда, добавь его в эту строку в
`deploy/docker-compose.yml` и обнови стек.

Что делает стек:

- `api` — образ `ghcr.io/yuta2endo/kuroha-api:latest`, `restart: unless-stopped`,
  volume `kuroha_data:/data`, порт `4180` **не публикуется** на хост;
- `caddy` — `caddy:2-alpine`, порты `80`/`443` (TCP и UDP для HTTP/3), читает
  `deploy/Caddyfile`, хранит сертификаты в `caddy_data`, конфиг в
  `caddy_config`, стартует после `api`;
- `api` пишет базу в `/data/db.json` и страницы в `/data/uploads`.

Нажми **Deploy the stack**. Первый запуск занимает несколько секунд: Caddy
получает сертификат, API создаёт пустую базу. Проверить, что контейнеры живы,
можно в Portainer → Containers или по SSH:

```bash
docker ps --filter name=kuroha
docker logs --tail 50 kuroha-api
docker logs --tail 50 kuroha-caddy
```

Если Portainer не может занять порты, проверь на VPS:

```bash
ss -ltnp | grep -E ':(80|443)\b'
docker ps --format '{{.Names}}\t{{.Ports}}'
```

## 4. Проверка

Health-check:

```bash
curl -fsS https://api.kuroha.org/api/health
```

Ожидается JSON вида:

```json
{
  "ok": true,
  "service": "kuroha-backend",
  "version": "0.1",
  "users": 0,
  "time": "2026-11-17T…"
}
```

Регистрация. **Первый зарегистрированный пользователь получает роль `admin`** —
это правило демо-бэкенда. Сразу после деплоя зарегистрируй свой аккаунт, пока
адрес никому не известен:

```bash
curl -fsS -X POST https://api.kuroha.org/api/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Админ Kuroha","email":"admin@kuroha.org","password":"замени-на-длинный-пароль"}'
```

CORS preflight с разрешённого origin:

```bash
curl -s -D - -o /dev/null -X OPTIONS https://api.kuroha.org/api/health \
  -H 'Origin: https://yuta2endo.github.io' \
  -H 'Access-Control-Request-Method: POST'
```

Ожидается `204` и заголовок:

```text
Access-Control-Allow-Origin: https://yuta2endo.github.io
Vary: Origin
```

Запрос с чужого origin не должен получать ни `*`, ни сам origin:

```bash
curl -s -D - -o /dev/null -X OPTIONS https://api.kuroha.org/api/health \
  -H 'Origin: https://evil.example' \
  -H 'Access-Control-Request-Method: POST'
```

`Access-Control-Allow-Origin` в ответе быть не должно — браузер заблокирует
запрос сам.

Список разрешённых origin задаётся переменной `KUROHA_ALLOWED_ORIGINS`
(через запятую, без пробелов вокруг). Без переменной сервер разрешает
`127.0.0.1`/`localhost` на `4173` и `4177` плюс `https://yuta2endo.github.io`.
Origin сравнивается целиком, вместе со схемой и портом.

## 5. Обслуживание

### Логи

Portainer → Containers → `kuroha-api` / `kuroha-caddy` → Logs, либо по SSH:

```bash
docker logs -f kuroha-api
docker logs -f kuroha-caddy
```

Caddy по умолчанию не пишет access-лог: в `Caddyfile` нет директивы `log`.
Для отладки TLS и прокси достаточно stderr-логов контейнера. Если нужен
access-лог, добавь `log` внутрь блока сайта в `deploy/Caddyfile` и обнови стек.

### Обновление образа

1. Изменения в `server/**` попадают в `main`.
2. Actions собирает новый `ghcr.io/yuta2endo/kuroha-api:latest`.
3. Portainer → Stacks → `kuroha` → **Update the stack**, включив **Re-pull
   image** (в compose у `api` также стоит `pull_policy: always`).

Через SSH, если Portainer недоступен:

```bash
docker pull ghcr.io/yuta2endo/kuroha-api:latest
docker restart kuroha-api
```

Данные в volume `kuroha_data` при пересоздании контейнера сохраняются.
`db.json` и `uploads/` в образ не попадают — это исключено
`server/.dockerignore`.

### Volume и бэкап

Имя volume зависит от имени проекта: при стеке `kuroha` это обычно
`kuroha_kuroha_data`. Уточни:

```bash
docker volume ls | grep kuroha
docker volume inspect kuroha_kuroha_data
```

Бэкап (API лучше остановить, чтобы `db.json` не менялся во время копирования):

```bash
docker stop kuroha-api
docker run --rm \
  -v kuroha_kuroha_data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/kuroha-data-$(date +%F).tar.gz -C /data .
docker start kuroha-api
```

Восстановление:

```bash
docker stop kuroha-api
docker run --rm \
  -v kuroha_kuroha_data:/data \
  -v "$PWD":/backup \
  alpine sh -c 'rm -rf /data/* && tar xzf /backup/kuroha-data-2026-11-17.tar.gz -C /data'
docker start kuroha-api
```

Команда `rm -rf /data/*` удаляет только содержимое volume, но проверь имя
volume перед запуском. Сертификаты Caddy лежат в `caddy_data`; их бэкап
необязателен — при потере Caddy выпустит новые, но упрётся в лимиты
Let's Encrypt при частых пересозданиях.

## 6. Ограничения

Этот деплой — demo/staging, а не production-хранилище:

- `db.json` — один JSON-файл: нет транзакций, индексов, блокировок и
  конкурентной записи. Каждый запрос переписывает файл целиком;
- страницы глав лежат в `uploads/` на volume и раздаются статически, без
  приватных bucket и подписанных URL;
- нет rate limit, подтверждения email, восстановления пароля и ротации
  сессий;
- первый зарегистрированный пользователь становится `admin` — держи адрес
  закрытым до регистрации своего аккаунта;
- нет горизонтального масштабирования: один контейнер и один volume, нельзя
  запускать несколько реплик на общую файловую базу;
- TLS завершает Caddy, внутри compose-сети API общается по HTTP.

Для продакшена нужны PostgreSQL (схема уже описана в `docs/schema.sql`),
S3/R2 для страниц, rate limit, аудит, мониторинг и регулярные бэкапы. Тогда
`db.json` и `uploads/` заменяются, а `deploy/docker-compose.yml` дополняется
сервисом БД и переменными подключения.

## 7. Следующий шаг

Фронтенд пока не знает про новый API. После проверки деплоя нужно добавить
базовый адрес `https://api.kuroha.org` в прототип (страницы `cloud.html` и
модуль, который ходит в API) и убедиться, что origin фронтенда есть в
`KUROHA_ALLOWED_ORIGINS`. Для GitHub Pages это `https://yuta2endo.github.io`,
для будущего домена — `https://kuroha.org` и `https://www.kuroha.org`.

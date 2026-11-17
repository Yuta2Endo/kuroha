# Kuroha backend v0.1

Локальный API для аккаунтов, серверного состояния и жалоб. Без внешних зависимостей: только Node.js и файл `db.json`.

## Запуск

```powershell
cd G:\Developing\kuroha\server
node server.js
```

API: `http://127.0.0.1:4180/api/health`

Для теста на временной копии БД можно переопределить пути и порт:

```powershell
$env:PORT = "4191"
$env:KUROHA_DB = "C:\Temp\kuroha\db.json"
$env:KUROHA_UPLOADS = "C:\Temp\kuroha\uploads"
node server.js
```

Без этих переменных используются `server/db.json` и `server/uploads/`.

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `4180` | порт API |
| `KUROHA_DB` | `server/db.json` | файл состояния |
| `KUROHA_UPLOADS` | `server/uploads/` | страницы глав |
| `KUROHA_ALLOW_REGISTRATION` | `true` | `false` закрывает публичную регистрацию; вход остаётся, новый аккаунт — только по invite-ссылке |
| `KUROHA_PUBLIC_URL` | `https://yuta2endo.github.io/kuroha` | база для `link` в ответе `POST /api/invites` |
| `KUROHA_ALLOWED_ORIGINS` | локальные адреса и GitHub Pages | CORS, список через запятую |

Production запускается с `KUROHA_ALLOW_REGISTRATION=false`. Публичная
регистрация закрыта; аккаунты создаются одноразовыми приглашениями.

Сайт-прототип запускается отдельно:

```powershell
cd G:\Developing\kuroha\prototype
python -m http.server 4177 --bind 127.0.0.1
```

Страница управления: `http://127.0.0.1:4177/cloud.html`.

## Что уже есть

- регистрация и вход по email/паролю;
- закрытая регистрация и одноразовые invite-ссылки с ролью и командой;
- пароли через `scrypt` + индивидуальная соль;
- Bearer-токены, сессия 30 дней;
- полный снимок локального состояния: `GET /api/state`, `PUT /api/state`;
- жалобы: `POST /api/reports`, `GET /api/reports`, `PATCH /api/reports/:id`;
- загрузки глав: `POST /api/uploads` (JSON с base64), `GET /api/uploads`, `DELETE /api/uploads/:id`, раздача `/uploads/...`;
- команды, тайтлы, главы, очередь модерации, страницы версии и прогресс чтения — вертикальный срез UGC;
- health-check;
- CORS для сайта на `127.0.0.1:4177` и `localhost:4177`.

## API

| Метод | Маршрут | Назначение |
|---|---|---|
| GET | `/api/health` | статус и счётчики |
| POST | `/api/register` | `{ name, email, password, inviteToken? }`; без токена работает только при открытой регистрации |
| POST | `/api/login` | `{ email, password }` |
| POST | `/api/logout` | завершить сессию |
| GET | `/api/me` | текущий пользователь |
| GET | `/api/state` | получить снимок |
| PUT | `/api/state` | сохранить `{ state: {...} }` |
| POST | `/api/reports` | публичная жалоба |
| GET | `/api/reports` | список жалоб (только admin) |
| PATCH | `/api/reports/:id` | `{ status: "open" \| "resolved" \| "dismissed" }` (admin) |
| POST | `/api/uploads` | `{ slug, chapter, chapterName, files: [{name,type,data}] }` (admin) |
| GET | `/api/uploads?slug=` | список серверных загрузок |
| DELETE | `/api/uploads/:id` | удалить загрузку и файлы (admin/автор) |

Защищённые запросы:

```http
Authorization: Bearer <token>
```

## UGC-срез

Новый блок не меняет старые маршруты. Его ошибки — объект
`{ "error": { "code", "message", "fields?" } }`; старые `auth`, `state`,
`uploads`, `reports` по-прежнему отвечают `{ "ok": false, "error": "строка" }`.
Полный контракт: [`docs/api.md`](../docs/api.md).

| Метод | Маршрут | Кто | Назначение |
|---|---|---|---|
| GET | `/api/teams` | вход | свои команды; admin видит все |
| POST | `/api/teams` | translator/admin | создать команду |
| POST | `/api/teams/:id/members` | owner/admin | добавить участника по email: `translator` или `moderator` |
| POST | `/api/invites` | admin/owner | одноразовая invite-ссылка: роль, команда, срок |
| GET | `/api/invites` | admin/owner | выданные приглашения и статусы, без raw-токена |
| DELETE | `/api/invites/:id` | admin/owner | отозвать приглашение (`revokedAt`) |
| GET | `/api/invites/:token` | все | публичный просмотр приглашения без email |
| GET | `/api/titles` | все | каталог; публично только `published`, staff с `?status=all` — все |
| POST | `/api/titles` | translator/admin | создать тайтл в `draft` |
| GET | `/api/titles/:slug` | все | тайтл и доступные главы |
| POST | `/api/titles/:slug/chapters` | участник команды/admin | глава + версия `draft` |
| POST | `/api/chapters/:id/submit` | участник команды/admin | `draft \| changes_requested → review` |
| GET | `/api/moderation/queue` | moderator/admin | версии в `review` |
| PATCH | `/api/chapters/:id/status` | moderator/admin | `published`, `changes_requested`, `rejected` |
| POST | `/api/chapters/:id/pages` | участник команды/moderator/admin | заменить страницы версии, base64 |
| GET | `/api/chapters/:id/pages` | все по правам | опубликованные — публично, иначе команда/staff |
| PUT | `/api/progress/:chapterId` | вход | `{ page, percent }` |
| GET | `/api/progress` | вход | прогресс пользователя |
| PATCH | `/api/users/:id/role` | admin | служебная смена глобальной роли |

Правила среза:

- статусы версии: `draft → review → published`, ветки `changes_requested` и
  `rejected`; повторная публикация — `409`;
- `published` ставит `publishedAt` главе и `reviewedBy`/`reviewedAt` версии;
- тайтл с `rightsStatus = unverified` нельзя опубликовать — `409 RIGHTS_UNVERIFIED`;
  при публикации первой главы `draft`-тайтл с подтверждёнными правами
  становится `published` автоматически;
- страницы: JPEG/PNG/WebP по сигнатуре, до 10 МБ на страницу, до 100 страниц;
  тело запроса локально ограничено 120 МБ; файлы — `uploads/<chapterId>/`;
- прогресс хранится по паре пользователь + тайтл и перезаписывается;
- `passwordHash` и соль не отдаются ни одним маршрутом;
- роль из тела запроса не принимается, кроме admin-маршрута смены роли.

## Приглашения

Публичная регистрация в production закрыта:
`KUROHA_ALLOW_REGISTRATION=false`, `POST /api/register` без токена отвечает
`403 REGISTRATION_CLOSED`. Новый человек попадает в студию только по ссылке.

1. Admin или owner команды открывает студию → «Приглашения».
2. Указывает email (необязательно), роль, команду и срок 7/14/30 дней.
3. `POST /api/invites` возвращает ссылку
   `…/studio.html?invite=<token>` один раз. В `db.json` лежит только
   `sha256`-хеш токена.
4. Человек открывает ссылку, вводит имя, email и пароль. Студия проверяет
   приглашение и сразу авторизует его.
5. Если указана команда, пользователь становится её участником с ролью
   `translator` или `moderator` (не owner). Приглашение помечается
   использованным и больше не работает.

Особенности:

- invite-ссылка одноразовая: повторная регистрация — `409 INVITE_USED`;
- истёкшая — `410 INVITE_EXPIRED`, отозванная — `409 INVITE_REVOKED`;
- если приглашение выдано на email, регистрация с другим email —
  `403 INVITE_EMAIL_MISMATCH`, а сам email нигде публично не показывается;
- owner приглашает только в свою команду и не может выдать `admin`;
- admin приглашает любую роль, команда необязательна;
- первый пользователь пустой базы всё равно становится `admin`: legacy-правило
  важнее роли приглашения;
- ссылки не отправляются почтой. Это учебный backend: письма, подтверждение
  email и rate limit появятся позже.

Полный контракт и коды ошибок: [`docs/api.md`](../docs/api.md), раздел 2.

## Демо-аккаунт

Локально с открытой регистрацией (`KUROHA_ALLOW_REGISTRATION=true`, значение
по умолчанию) аккаунт можно создать через форму на `/cloud.html` или
зарегистрировать первым:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4180/api/register `
  -ContentType "application/json" `
  -Body '{"name":"Ночной читатель","email":"demo@kuroha.org","password":"kuroha123"}'
```

Первый зарегистрированный пользователь получает роль `admin`, остальные —
`reader`. В production с `KUROHA_ALLOW_REGISTRATION=false` этот запрос вернёт
`403 REGISTRATION_CLOSED`; первый аккаунт создаётся миграцией или временным
открытием регистрации, дальше — только приглашения.

## Ограничения

Это учебный backend, не production:

- HTTP без TLS;
- нет email-подтверждения и восстановления пароля;
- invite-ссылки передаются вручную: рассылки писем и уведомлений нет;
- нет rate limit и нормальной ротации токенов;
- состояние хранится целиком, без merge и версий;
- страницы глав лежат в `uploads/` и раздаются статически; приватного bucket и
  подписанных URL пока нет;
- `db.json` — простой файл, не база данных: нет транзакций, индексов и
  конкурентной записи.

Перед публичным запуском нужен отдельный security-проход и нормальная БД (PostgreSQL), S3/R2 для страниц, очередь обработки изображений и модерация.

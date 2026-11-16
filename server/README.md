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

Сайт-прототип запускается отдельно:

```powershell
cd G:\Developing\kuroha\prototype
python -m http.server 4177 --bind 127.0.0.1
```

Страница управления: `http://127.0.0.1:4177/cloud.html`.

## Что уже есть

- регистрация и вход по email/паролю;
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
| POST | `/api/register` | `{ name, email, password }` |
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

## Демо-аккаунт

Можно создать через форму на `/cloud.html` или зарегистрировать первым:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4180/api/register `
  -ContentType "application/json" `
  -Body '{"name":"Ночной читатель","email":"demo@kuroha.org","password":"kuroha123"}'
```

Первый зарегистрированный пользователь получает роль `admin`, остальные — `reader`.

## Ограничения

Это учебный backend, не production:

- HTTP без TLS;
- нет email-подтверждения и восстановления пароля;
- нет rate limit и нормальной ротации токенов;
- состояние хранится целиком, без merge и версий;
- страницы глав лежат в `uploads/` и раздаются статически; приватного bucket и
  подписанных URL пока нет;
- `db.json` — простой файл, не база данных: нет транзакций, индексов и
  конкурентной записи.

Перед публичным запуском нужен отдельный security-проход и нормальная БД (PostgreSQL), S3/R2 для страниц, очередь обработки изображений и модерация.

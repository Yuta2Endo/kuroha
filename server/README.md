# Kuroha backend v0.1

Локальный API для аккаунтов, серверного состояния и жалоб. Без внешних зависимостей: только Node.js и файл `db.json`.

## Запуск

```powershell
cd G:\Developing\kuroha\server
node server.js
```

API: `http://127.0.0.1:4180/api/health`

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
| GET | `/api/reports` | список жалоб (нужен токен) |
| PATCH | `/api/reports/:id` | `{ status: "open" \| "resolved" \| "dismissed" }` |

Защищённые запросы:

```http
Authorization: Bearer <token>
```

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
- реальные файлы глав пока не загружаются на сервер;
- `db.json` — простой файл, не база данных.

Перед публичным запуском нужен отдельный security-проход и нормальная БД (PostgreSQL), S3/R2 для страниц, очередь обработки изображений и модерация.

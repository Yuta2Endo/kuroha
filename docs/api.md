# Kuroha API — вертикальный срез UGC

Локальный API для команд переводчиков, тайтлов, глав, модерации, страниц и
прогресса чтения. Черновик под будущий PostgreSQL: структура полей повторяет
[`schema.sql`](schema.sql), но хранение пока файловое (`server/db.json` и
`server/uploads/`).

Базовый адрес: `http://127.0.0.1:4180`. Все ответы — JSON в UTF-8.

## 1. Формат ответов и ошибок

Успешный ответ всегда содержит `ok: true`:

```json
{ "ok": true, "title": { "id": "title_…", "slug": "nochnaya-smena" } }
```

Ошибка нового UGC-блока:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверь поля тайтла.",
    "fields": { "slug": "Slug: 3–120 символов, только a-z, 0-9 и дефис." }
  }
}
```

- `code` — машинный код, стабильная строка в `UPPER_SNAKE_CASE`;
- `message` — короткое объяснение для человека, по-русски;
- `fields` — необязательная карта ошибок по полям.

Старые маршруты `auth`, `state`, `uploads`, `reports` сохраняют прежний формат
`{ "ok": false, "error": "строка" }`. Это сделано для совместимости с текущим
`cloud.js`; новый фронтенд должен читать объектный `error`. Не смешивайте два
формата в одном обработчике.

Исключение — `403 REGISTRATION_CLOSED` у `POST /api/register`: он отвечает
объектным `error`, чтобы студия показала человеческий текст, а не JSON-строку.

### Коды HTTP

| Код | Когда | Типичные `code` |
|---:|---|---|
| 400 | битый JSON, неверные поля, пустая глава, больше 100 страниц | `BAD_JSON`, `VALIDATION_ERROR`, `EMPTY_CHAPTER`, `TOO_MANY_PAGES` |
| 401 | нет или истёк Bearer-токен | `UNAUTHORIZED` |
| 403 | доступ запрещён; регистрация закрыта | `FORBIDDEN`, `REGISTRATION_CLOSED` |
| 404 | объекта нет или он скрыт от пользователя | `NOT_FOUND` |
| 409 | конфликт состояния или уникальности | `SLUG_TAKEN`, `CHAPTER_EXISTS`, `ALREADY_MEMBER`, `TEAM_SUSPENDED`, `NO_VERSION`, `INVALID_TRANSITION`, `ALREADY_PUBLISHED`, `RIGHTS_UNVERIFIED`, `SELF_ROLE`, `LAST_ADMIN` |
| 413 | тело запроса или страница больше лимита | `PAYLOAD_TOO_LARGE`, `PAGE_TOO_LARGE` |
| 415 | формат страницы не JPEG/PNG/WebP или не совпал с содержимым | `UNSUPPORTED_MEDIA_TYPE`, `MIME_MISMATCH` |
| 500 | внутренняя ошибка | `INTERNAL` |

Черновики и скрытые объекты отвечают `404`, а не `403`, если пользователь не
должен знать об их существовании. `403` остаётся для случая, когда объект уже
известен, но действие запрещено.

## 2. Авторизация и роли

Защищённые запросы передают токен из `POST /api/register` или
`POST /api/login`:

```http
Authorization: Bearer <token>
```

Сессия живёт 30 дней. Cookie, CSRF и refresh-токены в локальном срезе ещё не
сделаны — это следующий этап вместе с PostgreSQL.

Глобальные роли пользователя:

| Роль | Что может в этом срезе |
|---|---|
| `reader` | читать опубликованное, сохранять прогресс |
| `translator` | создавать команды, тайтлы и главы, загружать страницы своей команды, отправлять на проверку |
| `moderator` | очередь модерации, публикация, правки, отказ; видит все тайтлы и главы |
| `admin` | всё то же плюс все команды, смена глобальных ролей |

Правила:

- роль берётся только из БД, поле `role` в теле запроса игнорируется везде,
  кроме служебного `PATCH /api/users/:id/role` (только admin);
- первый зарегистрированный пользователь получает `admin` по legacy-правилу
  `POST /api/register`, если база пуста. Правило действует только при открытой
  регистрации; в production админ создаётся временным открытием регистрации или
  миграцией;
- при открытой регистрации `POST /api/register` создаёт `reader` (или `admin`
  для первого пользователя пустой базы);
- регистрация управляется `KUROHA_ALLOW_REGISTRATION`: `false` закрывает
  создание аккаунтов, значение по умолчанию — `true` (локальный запуск без
  переменной работает как раньше);
- закрытие регистрации не мешает `POST /api/login`, `/api/me`, сессиям и
  смене ролей;
- переводчик видит только свои тайтлы и тайтлы, где у его команды есть версия;
- модератор и админ видят всё;
- чужой черновик не отдаётся ни в списке, ни по прямому slug.

### POST /api/register

При закрытой регистрации маршрут отвечает `403` в объектном формате:

```json
{
  "error": {
    "code": "REGISTRATION_CLOSED",
    "message": "Регистрация закрыта. Войти можно только с существующим аккаунтом."
  }
}
```

При открытой регистрации тело — `{ "name", "email", "password" }`, пароль от
6 символов. Ответ `201`: `{ ok, token, user }`. Первый пользователь пустой
базы получает `admin`, остальные — `reader`. Повторный email — `409` в старом
формате `{ ok: false, error }`.

### Роли внутри команды

Версия главы принадлежит команде. Роли в команде: `owner`, `translator`,
`moderator`. `owner` назначается создателю автоматически. Членство в команде —
это и есть право загружать главы этой команды; глобальная роль `reader` не
мешает, если пользователь добавлен в команду.

## 3. Команды

### GET /api/teams

Требует входа. `admin` видит все команды, остальные — только свои.

```json
{
  "ok": true,
  "teams": [
    {
      "id": "team_…",
      "slug": "tihie-stranicy",
      "name": "Тихие страницы",
      "description": null,
      "avatarKey": null,
      "ownerId": "usr_…",
      "status": "active",
      "myRole": "owner",
      "canManage": true,
      "members": [
        { "userId": "usr_…", "name": "Ая", "role": "owner", "joinedAt": "2026-11-17T…" }
      ],
      "createdAt": "2026-11-17T…",
      "updatedAt": "2026-11-17T…"
    }
  ]
}
```

Email и `passwordHash` участников не отдаются.

### POST /api/teams

Только `translator` или `admin`.

```json
{ "name": "Тихие страницы", "slug": "tihie-stranicy", "description": "…" }
```

- `slug`: `^[a-z0-9-]{3,64}$`, приводится к нижнему регистру;
- `name`: 2–120 символов;
- `description`: до 2000 символов, необязательно.

Ответ `201` с объектом команды. Повторный slug — `409 SLUG_TAKEN`.

### POST /api/teams/:id/members

Только владелец команды или `admin`. Добавляет существующего пользователя по
email.

```json
{ "email": "translator@example.com", "role": "translator" }
```

- `role`: `translator` или `moderator` (роль внутри команды, не глобальная);
- пользователь не найден — `404`;
- уже в команде — `409 ALREADY_MEMBER`;
- команда заблокирована — `409 TEAM_SUSPENDED`.

Ответ `201`: `{ ok, team, member }`.

Приглашений по токену и смены роли участника в этом блоке нет.

## 4. Тайтлы

### GET /api/titles

Публичный каталог. Без параметров отдаёт только `status = published`.

Параметры:

- `status=all` — полный список для `moderator`/`admin`; `translator` получает
  опубликованные и свои доступные тайтлы; `reader` — `403 FORBIDDEN`;
- `type=manga|manhwa|manhua|novel` — фильтр по типу.

Ответ:

```json
{
  "ok": true,
  "titles": [
    {
      "id": "title_…",
      "slug": "nochnaya-smena",
      "type": "manga",
      "titleRu": "Ночная смена",
      "titleOriginal": "Night Shift",
      "description": "…",
      "ageRating": 16,
      "status": "published",
      "rightsStatus": "permission",
      "rightsHolder": "…",
      "licenseCode": "author-permission",
      "licenseUrl": "https://…",
      "sourceUrl": "https://…",
      "chapterCount": 1,
      "publishedChapterCount": 1,
      "createdBy": "usr_…",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

`chapterCount` учитывает опубликованные главы и неопубликованные главы команд, к
которым у зрителя есть доступ; `publishedChapterCount` — только опубликованные.
Ответ ограничен 100 тайтлами.

### POST /api/titles

Только `translator` или `admin`. Создаёт тайтл в `draft`.

```json
{
  "slug": "nochnaya-smena",
  "title": "Ночная смена",
  "originalTitle": "Night Shift",
  "type": "manga",
  "description": "…",
  "rightsStatus": "permission",
  "rightsHolder": "Тестовый автор",
  "sourceUrl": "https://example.com/work",
  "license": "author-permission",
  "licenseUrl": "https://example.com/permission",
  "ageRating": 16
}
```

| Поле | Обязательное | Правила |
|---|---|---|
| `slug` | да | `^[a-z0-9-]{3,120}$`, уникальный |
| `title` | да | 1–200 символов |
| `originalTitle` | нет | до 200 |
| `type` | да | `manga`, `manhwa`, `manhua`, `novel` |
| `description` | нет | до 4000 |
| `rightsStatus` | нет | `licensed`, `permission`, `public_domain`, `cc`, `unverified`; по умолчанию `unverified` |
| `rightsHolder` | нет | до 200 |
| `sourceUrl` | нет | только `http://` или `https://` |
| `license` | нет | до 120 |
| `licenseUrl` | нет | только `http://` или `https://` |
| `ageRating` | нет | `0`, `6`, `12`, `16`, `18`; по умолчанию `0` |

Ответ `201` с объектом тайтла. В ответе имена полей — как в `schema.sql`:
`titleRu`, `titleOriginal`, `licenseCode`. В запросе принимаются короткие
алиасы `title`, `originalTitle`, `license`, а также полные имена.

Публикация тайтла:

- тайтл создаётся `draft` и публично не виден;
- при публикации первой главы тайтл автоматически становится `published`, если
  `rightsStatus !== "unverified"` и тайтл не был скрыт (`hidden`);
- `rightsStatus = unverified` блокирует публикацию главы;
- отдельного маршрута редактирования прав и статуса тайтла в этом блоке нет.

### GET /api/titles/:slug

Публично отдаёт только `published` тайтл и только опубликованные главы.
Автор тайтла, участник команды с версией на этом тайтле и staff видят
черновики и свои неопубликованные версии.

```json
{
  "ok": true,
  "title": { "id": "title_…", "slug": "…", "titleRu": "…", "status": "published", "rightsStatus": "permission" },
  "chapters": [
    {
      "id": "ch_…",
      "titleId": "title_…",
      "number": 1,
      "volume": null,
      "name": "Первый снег",
      "language": "ru",
      "status": "published",
      "publishedAt": "2026-11-17T…",
      "latestVersionId": "ver_…",
      "versions": [
        {
          "id": "ver_…",
          "version": 1,
          "status": "published",
          "teamId": "team_…",
          "team": { "id": "team_…", "slug": "…", "name": "…" },
          "pageCount": 18,
          "submittedAt": "…",
          "reviewedAt": "…"
        }
      ]
    }
  ]
}
```

Версии со статусом не `published` не попадают в публичный ответ. Комментарии
модератора, `submittedBy`, `reviewedBy`, `reviewNote` и `rejectionReason`
отдаются только staff, автору тайтла и команде этой версии.

Черновик или `hidden` для постороннего — `404 NOT_FOUND`.

## 5. Главы и версии

Модель JSON повторяет пару `chapters` + `chapter_versions`:

```json
{
  "id": "ch_…",
  "titleId": "title_…",
  "number": 1,
  "volume": null,
  "name": "Первый снег",
  "language": "ru",
  "status": "draft",
  "publishedAt": null,
  "versions": [
    {
      "id": "ver_…",
      "teamId": "team_…",
      "version": 1,
      "status": "draft",
      "submittedBy": "usr_…",
      "submittedAt": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "reviewNote": null,
      "rejectionReason": null
    }
  ]
}
```

В этом блоке у главы одна версия. Поле `versions` оставлено массивом, чтобы
следующий блок добавил несколько переводов на одну главу.

### POST /api/titles/:slug/chapters

Создаёт главу и версию `draft`. Нужно быть участником команды `teamId` или
`admin`. В черновик тайтла главу также может добавить автор тайтла или staff.

```json
{ "number": 1, "title": "Первый снег", "teamId": "team_…" }
```

Необязательно: `volume`, `language` (по умолчанию `ru`), `rightsNote`,
`sourceUrl`, `proofUrl`.

Проверки:

- `number` — число больше 0, до двух знаков после запятой;
- уникальность `(titleId, number, language)` — иначе `409 CHAPTER_EXISTS`;
- команда должна быть `active`;
- `language` — `^[a-z]{2}(-[a-z]{2})?$`;
- ссылки — только `http/https`.

Ответ `201`: `{ ok, chapter, versionId }`.

### POST /api/chapters/:id/submit

`:id` — идентификатор главы. Отправляет последнюю версию на проверку.

- только участник команды версии или `admin`;
- допустимые исходные статусы: `draft`, `changes_requested`;
- нужна хотя бы одна страница, иначе `400 EMPTY_CHAPTER`;
- версия получает `review`, глава — `review`, заполняется `submittedAt`.

Ответ `200`: `{ ok, chapter, versionId }`.

### GET /api/moderation/queue

Только `moderator`/`admin`. Возвращает версии в `review`, сначала старые.

```json
{
  "ok": true,
  "count": 1,
  "queue": [
    {
      "versionId": "ver_…",
      "chapterId": "ch_…",
      "chapter": { "id": "ch_…", "number": 1, "volume": null, "name": "Первый снег", "language": "ru" },
      "title": {
        "id": "title_…",
        "slug": "nochnaya-smena",
        "titleRu": "Ночная смена",
        "type": "manga",
        "status": "draft",
        "ageRating": 16,
        "rightsStatus": "permission",
        "rightsHolder": "…",
        "licenseCode": "…",
        "licenseUrl": "…",
        "sourceUrl": "…"
      },
      "team": { "id": "team_…", "slug": "…", "name": "…" },
      "version": 1,
      "status": "review",
      "submittedAt": "…",
      "submittedBy": { "id": "usr_…", "name": "Ая" },
      "pageCount": 2,
      "previewPages": [
        { "pageNumber": 1, "name": "page-1.png", "mime": "image/png", "byteSize": 68, "checksum": "…", "imageKey": "/uploads/ch_…/001-page-1.png?v=ab12cd34ef56" }
      ]
    }
  ]
}
```

`previewPages` — первые три страницы для карточки проверки; полный список
берётся из `GET /api/chapters/:id/pages`.

### PATCH /api/chapters/:id/status

Только `moderator`/`admin`. Решение по версии в `review`.

```json
{ "status": "published", "note": "Проверено." }
```

- `status`: `published`, `changes_requested`, `rejected`;
- `note` обязателен для `changes_requested` и `rejected` (до 1000 символов);
- для `published` note необязателен;
- версия не в `review` — `409 INVALID_TRANSITION`;
- повторная публикация — `409 ALREADY_PUBLISHED`;
- `rightsStatus = unverified` — `409 RIGHTS_UNVERIFIED`, глава не публикуется;
- при `published`: глава получает `published`, `publishedAt`, версия —
  `reviewedBy`, `reviewedAt`, `status = published`; тайтл `draft` становится
  `published` (если права подтверждены);
- при `changes_requested`: версия остаётся с этим статусом, глава становится
  `draft`, note сохраняется в `reviewNote`;
- при `rejected`: версия `rejected`, note пишется в `reviewNote` и
  `rejectionReason`, глава становится `draft`.

Ответ `200`: `{ ok, chapter, version }`.

### Статусы версии

```text
draft ──submit──> review ──publish────────> published
  ^                 │
  └──changes_requested──┘
                    │
                    └──reject──> rejected
```

- `draft` — видит команда;
- `review` — видит модератор, публично не видно;
- `changes_requested` — нужны правки; страницы можно заменить, затем снова
  отправить;
- `published` — видно читателям;
- `rejected` — окончательный отказ, причина обязательна; повторная отправка в
  этом блоке не предусмотрена;
- `removed` есть в схеме, но маршрута снятия с публикации в этом блоке нет.

## 6. Страницы главы

### POST /api/chapters/:id/pages

Заменяет страницы последней версии. Разрешено участнику команды, модератору и
админу. Только для версии в `draft` или `changes_requested`; иначе
`409 INVALID_TRANSITION`.

```json
{
  "pages": [
    { "name": "001.png", "type": "image/png", "data": "base64…" },
    { "name": "002.png", "type": "image/webp", "data": "data:image/webp;base64,…" }
  ]
}
```

Ограничения:

- до 100 страниц в одной версии — иначе `400 TOO_MANY_PAGES`;
- до 10 МБ на страницу после декодирования — иначе `413 PAGE_TOO_LARGE`;
- только JPEG, PNG, WebP; формат проверяется по сигнатуре файла, а не только
  по `type` — иначе `415 UNSUPPORTED_MEDIA_TYPE`;
- если `type` или MIME из data URL не совпадает с содержимым —
  `415 MIME_MISMATCH`;
- `data` — base64 или data URL;
- имя файла очищается, в путь не попадает;
- локальный лимит тела запроса — 120 МБ (base64 увеличивает размер примерно на
  треть); в production загрузка идёт через presigned URL в S3/R2.

Файлы сохраняются в `server/uploads/<chapterId>/`. Старые файлы версии
удаляются после успешной записи. Повторная загрузка заменяет набор страниц, а
не добавляет его.

Ответ `200`:

```json
{
  "ok": true,
  "chapterId": "ch_…",
  "versionId": "ver_…",
  "pages": [
    {
      "pageNumber": 1,
      "name": "001.png",
      "mime": "image/png",
      "byteSize": 68,
      "checksum": "sha256…",
      "imageKey": "/uploads/ch_…/001-001.png?v=ab12cd34ef56"
    }
  ]
}
```

`imageKey` — относительный URL; `?v=<checksum>` сбрасывает кэш при замене
страницы. Файл раздаётся статическим маршрутом
`GET /uploads/...`. В этом локальном срезе статика публична: настоящая защита
черновиков появится вместе с приватным bucket и подписанными URL.

### GET /api/chapters/:id/pages

Опубликованная глава отдаётся публично. Иначе нужен вход и одна из ролей:
staff, автор тайтла или участник команды версии.

- без токена — `401 UNAUTHORIZED`;
- чужой черновик — `403 FORBIDDEN`;
- опубликованная глава — `200` даже без токена.

```json
{
  "ok": true,
  "chapter": {
    "id": "ch_…",
    "titleId": "title_…",
    "number": 1,
    "volume": null,
    "name": "Первый снег",
    "language": "ru",
    "status": "published",
    "publishedAt": "…"
  },
  "version": {
    "id": "ver_…",
    "version": 1,
    "status": "published",
    "team": { "id": "team_…", "slug": "…", "name": "…" }
  },
  "pages": [
    { "pageNumber": 1, "name": "001.png", "mime": "image/png", "byteSize": 68, "checksum": "…", "imageKey": "/uploads/ch_…/001-001.png?v=ab12cd34ef56" }
  ]
}
```

Порядок страниц — по `pageNumber`, от 1.

## 7. Прогресс чтения

Прогресс хранится на пользователя и тайтл: новая глава того же тайтла
перезаписывает запись, как в `reading_progress` из `schema.sql`.

### PUT /api/progress/:chapterId

Требует входа. Глава должна быть опубликована или доступна пользователю как
черновик команды/staff.

```json
{ "page": 2, "percent": 50 }
```

- `page` — целое больше 0;
- `percent` — от 0 до 100, округляется до двух знаков;
- невидимая чужая глава — `404 NOT_FOUND`.

Ответ `200`: `{ ok, progress }`, где `progress` содержит `titleId`,
`chapterId`, `page`, `percent`, `updatedAt`.

### GET /api/progress

Требует входа. Возвращает записи пользователя, сначала свежие:

```json
{
  "ok": true,
  "progress": [
    {
      "titleId": "title_…",
      "chapterId": "ch_…",
      "page": 2,
      "percent": 50,
      "updatedAt": "…",
      "chapter": { "number": 1, "name": "Первый снег" },
      "title": { "slug": "nochnaya-smena", "titleRu": "Ночная смена" }
    }
  ]
}
```

## 8. Служебная смена роли

### PATCH /api/users/:id/role

Только `admin`. Нужен, чтобы в локальном срезе назначить переводчика или
модератора: регистрация создаёт `reader` (кроме первого пользователя пустой
базы, который получает `admin`).

```json
{ "role": "moderator" }
```

- `role`: `reader`, `translator`, `moderator`, `admin`;
- нельзя менять собственную роль — `409 SELF_ROLE`;
- нельзя убрать последнего админа — `409 LAST_ADMIN`.

Ответ `200`: `{ ok, user }` без `passwordHash` и соли.

В production этот маршрут заменяется админкой и аудитом; первый пользователь
админом не становится.

## 9. Права: сводная таблица

| Действие | Гость | reader | translator | moderator | admin |
|---|---:|---:|---:|---:|---:|
| Читать опубликованное | да | да | да | да | да |
| Прогресс | — | да | да | да | да |
| Создать команду | — | — | да | — | да |
| Пригласить в команду | — | — | owner команды | — | да |
| Создать тайтл | — | — | да | — | да |
| Создать главу | — | — | участник команды | — | да |
| Загрузить страницы | — | — | участник команды | да | да |
| Отправить на проверку | — | — | участник команды | — | да |
| Очередь модерации | — | — | — | да | да |
| Опубликовать / вернуть / отклонить | — | — | — | да | да |
| Сменить глобальную роль | — | — | — | — | да |

«Участник команды» означает членство в команде версии, независимо от
глобальной роли. Проверка всегда на сервере; `role` из тела запроса не
используется.

## 10. Хранение и миграция на PostgreSQL

| JSON-коллекция | Таблицы `schema.sql` |
|---|---|
| `teams[]` + вложенные `members[]` | `teams`, `team_members` |
| `titles[]` | `titles` |
| `chapters[]` + вложенные `versions[]` | `chapters`, `chapter_versions` |
| `chapterPages[versionId]` | `pages` |
| `progress[userId:titleId]` | `reading_progress` |
| `users[]`, `sessions{}` | `users`, `sessions` |
| `uploads/<chapterId>/…` | `pages.image_key` (в будущем S3/R2) |

Ограничения локального среза:

- `db.json` — не база данных: нет транзакций, уникальных индексов и миграций;
- несколько версий одной главы модель допускает, но API пока создаёт одну;
- нет audit_log, уведомлений, жалоб на уровне версии, DMCA и снятия с
  публикации;
- нет rate limit, TLS, cookie-сессий и CSRF;
- статика `uploads/` публична;
- один сервер, без блокировок и конкурентной записи.

Эти ограничения закрываются в следующих блоках: PostgreSQL + S3/R2, студия и
админка, DMCA и аудит.

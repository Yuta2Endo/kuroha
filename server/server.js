/*
 * Kuroha backend v0.1
 * Zero-dependency local API: accounts, sessions, reader state, reports.
 * Start: node server.js
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4180);
const HOST = process.env.HOST || "127.0.0.1";
const DB_PATH = process.env.KUROHA_DB
  ? path.resolve(process.env.KUROHA_DB)
  : path.join(__dirname, "db.json");
const UPLOAD_DIR = process.env.KUROHA_UPLOADS
  ? path.resolve(process.env.KUROHA_UPLOADS)
  : path.join(__dirname, "uploads");
const SESSION_DAYS = 30;
const MAX_BODY = 25 * 1024 * 1024;
const MAX_PAGE_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 100;
const PAGE_BODY_LIMIT = 120 * 1024 * 1024;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const DEFAULT_ORIGINS = [
  "http://127.0.0.1:4177",
  "http://localhost:4177",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://yuta2endo.github.io"
];
const CONFIGURED_ORIGINS = String(process.env.KUROHA_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set(CONFIGURED_ORIGINS.length ? CONFIGURED_ORIGINS : DEFAULT_ORIGINS);

let db = loadDb();

function emptyDb() {
  return {
    users: [],
    sessions: {},
    states: {},
    reports: [],
    uploads: [],
    teams: [],
    titles: [],
    chapters: [],
    chapterPages: {},
    progress: {}
  };
}

function loadDb() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    return Object.assign(emptyDb(), parsed);
  } catch (error) {
    return emptyDb();
  }
}

function saveDb() {
  const temp = DB_PATH + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(temp, DB_PATH);
}

function now() { return Date.now(); }
function id(prefix) { return prefix + "_" + crypto.randomBytes(12).toString("hex"); }
function clean(value, max) { return String(value == null ? "" : value).trim().slice(0, max); }
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function makeToken() { return crypto.randomBytes(32).toString("hex"); }

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
}

function createSession(userId) {
  const token = makeToken();
  db.sessions[token] = {
    userId: userId,
    expiresAt: now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  };
  saveDb();
  return token;
}

function getSession(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  const session = db.sessions[token];
  if (!session) return null;
  if (session.expiresAt < now()) {
    delete db.sessions[token];
    saveDb();
    return null;
  }
  const user = db.users.find((entry) => entry.id === session.userId);
  return user ? { token: token, user: user } : null;
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Vary", "Origin");
    if (ALLOWED_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function error(res, status, message) {
  send(res, status, { ok: false, error: message });
}

function fail(res, status, code, message, fields) {
  const payload = { error: { code: code, message: message } };
  if (fields && Object.keys(fields).length) payload.error.fields = fields;
  return send(res, status, payload);
}

function api(handler) {
  return (req, res, ...args) => Promise.resolve(handler(req, res, ...args)).catch((handlerError) => {
    console.error(handlerError);
    if (!res.headersSent) fail(res, 500, "INTERNAL", "Внутренняя ошибка сервера.");
  });
}

function readBody(req, limit) {
  const max = limit || MAX_BODY;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        const tooLarge = new Error("Слишком большой запрос.");
        tooLarge.status = 413;
        tooLarge.code = "PAYLOAD_TOO_LARGE";
        reject(tooLarge);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (parseError) {
        const badJson = new Error("Некорректный JSON.");
        badJson.status = 400;
        badJson.code = "BAD_JSON";
        reject(badJson);
      }
    });
    req.on("error", reject);
  });
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeSlug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}

function safeFileName(value, fallback) {
  const clean = String(value || "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
  return clean.slice(0, 120) || fallback;
}

function mimeFor(file) {
  const extension = path.extname(file).toLowerCase();
  const types = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".json": "application/json",
    ".txt": "text/plain"
  };
  return types[extension] || "application/octet-stream";
}

function isAdmin(session) {
  return session && session.user.role === "admin";
}

function userByEmail(email) {
  const normalized = email.toLowerCase();
  return db.users.find((user) => user.email.toLowerCase() === normalized);
}

function authOrFail(req, res) {
  const session = getSession(req);
  if (!session) {
    error(res, 401, "Нужен вход.");
    return null;
  }
  return session;
}

/* ---------------------------------------------------------------------------
 * UGC vertical slice
 * Teams, titles, chapters, moderation, page uploads and reading progress.
 * Storage stays local: db.json + uploads/. Field names follow docs/schema.sql.
 * ------------------------------------------------------------------------- */

const TITLE_TYPES = new Set(["manga", "manhwa", "manhua", "novel"]);
const RIGHTS_STATUSES = new Set(["licensed", "permission", "public_domain", "cc", "unverified"]);
const AGE_RATINGS = new Set([0, 6, 12, 16, 18]);
const GLOBAL_ROLES = new Set(["reader", "translator", "moderator", "admin"]);
const TEAM_MEMBER_ROLES = new Set(["translator", "moderator"]);
const MODERATION_STATUSES = new Set(["published", "changes_requested", "rejected"]);
const MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp"
};

function isoNow() { return new Date().toISOString(); }

function isStaff(user) {
  return Boolean(user && (user.role === "moderator" || user.role === "admin"));
}

function requireUser(req, res) {
  const session = getSession(req);
  if (!session) {
    fail(res, 401, "UNAUTHORIZED", "Нужен вход.");
    return null;
  }
  return session.user;
}

async function parseBody(req, res, limit) {
  try {
    const body = await readBody(req, limit);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      fail(res, 400, "BAD_JSON", "Тело запроса должно быть JSON-объектом.");
      return null;
    }
    return body;
  } catch (bodyError) {
    if (!res.headersSent) {
      fail(
        res,
        bodyError.status || 400,
        bodyError.code || "BAD_REQUEST",
        bodyError.message || "Некорректный запрос."
      );
    }
    return null;
  }
}

function fieldError(res, fields, message) {
  return fail(res, 400, "VALIDATION_ERROR", message || "Проверь поля запроса.", fields);
}

function slugValue(value, max) {
  return clean(value, max).toLowerCase();
}

function validSlug(value, min, max) {
  return new RegExp("^[a-z0-9-]{" + min + "," + max + "}$").test(value);
}

function textOrNull(value, max) {
  const result = clean(value, max);
  return result || null;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (urlError) {
    return false;
  }
}

function normalizeMime(value) {
  const mime = clean(value, 80).toLowerCase().split(";")[0].trim();
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

function decodeBase64Image(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  let dataMime = "";
  let payload = raw;
  const dataMatch = raw.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
  if (dataMatch) {
    dataMime = normalizeMime(dataMatch[1]);
    payload = dataMatch[2];
  } else if (/^data:/i.test(raw)) {
    return null;
  }
  payload = payload.replace(/\s+/g, "");
  if (!payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length) return null;
  return { mime: dataMime, buffer: buffer };
}

function sniffImage(buffer) {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";
  return null;
}

function userById(userId) {
  return db.users.find((user) => user.id === userId) || null;
}

function teamById(teamId) {
  return db.teams.find((team) => team.id === teamId) || null;
}

function titleById(titleId) {
  return db.titles.find((title) => title.id === titleId) || null;
}

function titleBySlug(slug) {
  return db.titles.find((title) => title.slug === slug) || null;
}

function chapterById(chapterId) {
  return db.chapters.find((chapter) => chapter.id === chapterId) || null;
}

function teamMember(team, userId) {
  return team.members.find((member) => member.userId === userId) || null;
}

function isTeamMember(teamId, userId) {
  const team = teamById(teamId);
  return Boolean(team && userId && teamMember(team, userId));
}

function latestVersion(chapter) {
  return chapter && chapter.versions.length ? chapter.versions[chapter.versions.length - 1] : null;
}

function pagesOf(versionId) {
  return db.chapterPages[versionId] || [];
}

function memberView(member) {
  const user = userById(member.userId);
  return {
    userId: member.userId,
    name: user ? user.name : "",
    role: member.role,
    joinedAt: member.joinedAt
  };
}

function teamView(team, viewer) {
  const own = viewer ? teamMember(team, viewer.id) : null;
  return {
    id: team.id,
    slug: team.slug,
    name: team.name,
    description: team.description || null,
    avatarKey: team.avatarKey || null,
    ownerId: team.ownerId,
    status: team.status,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    myRole: own ? own.role : null,
    canManage: Boolean(viewer && (viewer.role === "admin" || team.ownerId === viewer.id)),
    members: team.members.map(memberView)
  };
}

function titleView(title) {
  return {
    id: title.id,
    slug: title.slug,
    type: title.type,
    titleRu: title.titleRu,
    titleOriginal: title.titleOriginal || null,
    description: title.description || null,
    authorName: title.authorName || null,
    artistName: title.artistName || null,
    coverKey: title.coverKey || null,
    ageRating: title.ageRating,
    status: title.status,
    rightsStatus: title.rightsStatus,
    rightsHolder: title.rightsHolder || null,
    licenseCode: title.licenseCode || null,
    licenseUrl: title.licenseUrl || null,
    sourceUrl: title.sourceUrl || null,
    createdBy: title.createdBy || null,
    createdAt: title.createdAt,
    updatedAt: title.updatedAt
  };
}

function versionView(version, withReview) {
  const team = teamById(version.teamId);
  const view = {
    id: version.id,
    version: version.version,
    status: version.status,
    teamId: version.teamId,
    team: team ? { id: team.id, slug: team.slug, name: team.name } : null,
    pageCount: pagesOf(version.id).length,
    submittedAt: version.submittedAt || null,
    reviewedAt: version.reviewedAt || null
  };
  if (withReview) {
    view.submittedBy = version.submittedBy || null;
    view.reviewedBy = version.reviewedBy || null;
    view.reviewNote = version.reviewNote || null;
    view.rejectionReason = version.rejectionReason || null;
    view.createdAt = version.createdAt;
    view.updatedAt = version.updatedAt;
  }
  return view;
}

function canPreviewTitle(title, user) {
  if (!user) return false;
  if (isStaff(user) || title.createdBy === user.id) return true;
  return db.chapters.some((chapter) =>
    chapter.titleId === title.id &&
    chapter.versions.some((version) => isTeamMember(version.teamId, user.id))
  );
}

function chapterView(chapter, viewer) {
  const title = titleById(chapter.titleId);
  const full = Boolean(viewer && (isStaff(viewer) || (title && title.createdBy === viewer.id)));
  const teamAccess = Boolean(viewer && chapter.versions.some((version) => isTeamMember(version.teamId, viewer.id)));
  if (!full && !teamAccess && chapter.status !== "published") return null;
  const versions = chapter.versions.filter((version) => {
    if (full) return true;
    if (version.status === "published") return true;
    return Boolean(viewer && isTeamMember(version.teamId, viewer.id));
  });
  if (!versions.length) return null;
  return {
    id: chapter.id,
    titleId: chapter.titleId,
    number: chapter.number,
    volume: chapter.volume == null ? null : chapter.volume,
    name: chapter.name || null,
    language: chapter.language,
    status: chapter.status,
    publishedAt: chapter.publishedAt || null,
    latestVersionId: versions[versions.length - 1].id,
    versions: versions.map((version) => versionView(
      version,
      full || Boolean(viewer && isTeamMember(version.teamId, viewer.id))
    ))
  };
}

function titleSummary(title, viewer) {
  const full = Boolean(viewer && (isStaff(viewer) || title.createdBy === viewer.id));
  const chapters = db.chapters.filter((chapter) => chapter.titleId === title.id);
  const published = chapters.filter((chapter) =>
    chapter.status === "published" && chapter.versions.some((version) => version.status === "published")
  );
  const visible = full ? chapters : chapters.filter((chapter) =>
    (chapter.status === "published" && chapter.versions.some((version) => version.status === "published")) ||
    Boolean(viewer && chapter.versions.some((version) => isTeamMember(version.teamId, viewer.id)))
  );
  return Object.assign(titleView(title), {
    chapterCount: visible.length,
    publishedChapterCount: published.length
  });
}

function titleDetail(title, viewer) {
  const chapters = db.chapters
    .filter((chapter) => chapter.titleId === title.id)
    .sort((left, right) => left.number - right.number)
    .map((chapter) => chapterView(chapter, viewer))
    .filter(Boolean);
  return { title: titleView(title), chapters: chapters };
}

function pageView(page) {
  return {
    pageNumber: page.pageNumber,
    name: page.name,
    mime: page.mime,
    byteSize: page.byteSize,
    checksum: page.checksum,
    imageKey: page.imageKey
  };
}

const handleTeamsList = api(async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const teams = (user.role === "admin" ? db.teams.slice() : db.teams.filter((team) => isTeamMember(team.id, user.id)))
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  return send(res, 200, { ok: true, teams: teams.map((team) => teamView(team, user)) });
});

const handleTeamCreate = api(async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role !== "translator" && user.role !== "admin") {
    return fail(res, 403, "FORBIDDEN", "Создавать команды может переводчик или админ.");
  }
  const body = await parseBody(req, res);
  if (!body) return;
  const slug = slugValue(body.slug, 64);
  const name = clean(body.name, 120);
  const description = textOrNull(body.description, 2000);
  const fields = {};
  if (!validSlug(slug, 3, 64)) fields.slug = "Slug: 3–64 символа, только a-z, 0-9 и дефис.";
  if (name.length < 2) fields.name = "Название: от 2 до 120 символов.";
  if (Object.keys(fields).length) return fieldError(res, fields, "Проверь поля команды.");
  if (db.teams.some((team) => team.slug === slug)) {
    return fail(res, 409, "SLUG_TAKEN", "Команда с таким slug уже существует.");
  }
  const createdAt = isoNow();
  const team = {
    id: id("team"),
    slug: slug,
    name: name,
    description: description,
    avatarKey: null,
    ownerId: user.id,
    status: "active",
    createdAt: createdAt,
    updatedAt: createdAt,
    members: [{ userId: user.id, role: "owner", joinedAt: createdAt }]
  };
  db.teams.push(team);
  saveDb();
  return send(res, 201, { ok: true, team: teamView(team, user) });
});

const handleTeamMemberAdd = api(async (req, res, url, teamId) => {
  const user = requireUser(req, res);
  if (!user) return;
  const team = teamById(teamId);
  if (!team) return fail(res, 404, "NOT_FOUND", "Команда не найдена.");
  if (user.role !== "admin" && team.ownerId !== user.id) {
    return fail(res, 403, "FORBIDDEN", "Приглашать участников может владелец команды или админ.");
  }
  if (team.status !== "active") {
    return fail(res, 409, "TEAM_SUSPENDED", "Команда заблокирована: менять состав нельзя.");
  }
  const body = await parseBody(req, res);
  if (!body) return;
  const email = clean(body.email, 120).toLowerCase();
  const role = clean(body.role, 20).toLowerCase();
  const fields = {};
  if (!validEmail(email)) fields.email = "Укажи корректный email.";
  if (!TEAM_MEMBER_ROLES.has(role)) fields.role = "Роль в команде: translator или moderator.";
  if (Object.keys(fields).length) return fieldError(res, fields, "Проверь поля приглашения.");
  const target = userByEmail(email);
  if (!target) return fail(res, 404, "NOT_FOUND", "Пользователь с таким email не найден.");
  if (teamMember(team, target.id)) {
    return fail(res, 409, "ALREADY_MEMBER", "Этот пользователь уже в команде.");
  }
  const member = { userId: target.id, role: role, joinedAt: isoNow() };
  team.members.push(member);
  team.updatedAt = member.joinedAt;
  saveDb();
  return send(res, 201, { ok: true, team: teamView(team, user), member: memberView(member) });
});

const handleTitlesList = api(async (req, res, url) => {
  const session = getSession(req);
  const viewer = session ? session.user : null;
  const wantAll = clean(url.searchParams.get("status"), 20).toLowerCase() === "all";
  let titles;
  if (wantAll) {
    if (!viewer) return fail(res, 401, "UNAUTHORIZED", "Нужен вход.");
    if (isStaff(viewer)) {
      titles = db.titles.slice();
    } else if (viewer.role === "translator") {
      titles = db.titles.filter((title) => title.status === "published" || canPreviewTitle(title, viewer));
    } else {
      return fail(res, 403, "FORBIDDEN", "Полный список доступен переводчикам, модераторам и админам.");
    }
  } else {
    titles = db.titles.filter((title) => title.status === "published");
  }
  const type = clean(url.searchParams.get("type"), 20).toLowerCase();
  if (TITLE_TYPES.has(type)) titles = titles.filter((title) => title.type === type);
  titles.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  return send(res, 200, {
    ok: true,
    titles: titles.slice(0, 100).map((title) => titleSummary(title, viewer))
  });
});

const handleTitleCreate = api(async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role !== "translator" && user.role !== "admin") {
    return fail(res, 403, "FORBIDDEN", "Создавать тайтлы может переводчик или админ.");
  }
  const body = await parseBody(req, res);
  if (!body) return;
  const slug = slugValue(body.slug, 120);
  const titleRu = clean(body.title != null ? body.title : body.titleRu, 200);
  const titleOriginal = textOrNull(body.originalTitle != null ? body.originalTitle : body.titleOriginal, 200);
  const type = clean(body.type, 20).toLowerCase();
  const description = textOrNull(body.description, 4000);
  const rightsStatus = clean(body.rightsStatus, 20).toLowerCase() || "unverified";
  const rightsHolder = textOrNull(body.rightsHolder, 200);
  const sourceUrl = textOrNull(body.sourceUrl, 500);
  const licenseCode = textOrNull(body.license != null ? body.license : body.licenseCode, 120);
  const licenseUrl = textOrNull(body.licenseUrl, 500);
  const ageRating = body.ageRating == null ? 0 : Number(body.ageRating);
  const fields = {};
  if (!validSlug(slug, 3, 120)) fields.slug = "Slug: 3–120 символов, только a-z, 0-9 и дефис.";
  if (!titleRu) fields.title = "Название обязательно.";
  if (!TITLE_TYPES.has(type)) fields.type = "Тип: manga, manhwa, manhua или novel.";
  if (!RIGHTS_STATUSES.has(rightsStatus)) fields.rightsStatus = "Неизвестный статус прав.";
  if (!AGE_RATINGS.has(ageRating)) fields.ageRating = "Возраст: 0, 6, 12, 16 или 18.";
  if (sourceUrl && !isHttpUrl(sourceUrl)) fields.sourceUrl = "Ссылка должна начинаться с http:// или https://.";
  if (licenseUrl && !isHttpUrl(licenseUrl)) fields.licenseUrl = "Ссылка должна начинаться с http:// или https://.";
  if (Object.keys(fields).length) return fieldError(res, fields, "Проверь поля тайтла.");
  if (titleBySlug(slug)) {
    return fail(res, 409, "SLUG_TAKEN", "Тайтл с таким slug уже существует.");
  }
  const createdAt = isoNow();
  const title = {
    id: id("title"),
    slug: slug,
    type: type,
    titleRu: titleRu,
    titleOriginal: titleOriginal,
    description: description,
    authorName: textOrNull(body.authorName, 200),
    artistName: textOrNull(body.artistName, 200),
    coverKey: null,
    ageRating: ageRating,
    status: "draft",
    rightsStatus: rightsStatus,
    rightsHolder: rightsHolder,
    licenseCode: licenseCode,
    licenseUrl: licenseUrl,
    sourceUrl: sourceUrl,
    createdBy: user.id,
    createdAt: createdAt,
    updatedAt: createdAt
  };
  db.titles.push(title);
  saveDb();
  return send(res, 201, { ok: true, title: titleView(title) });
});

const handleTitleGet = api(async (req, res, url, slug) => {
  const session = getSession(req);
  const viewer = session ? session.user : null;
  const title = titleBySlug(slugValue(slug, 120));
  if (!title) return fail(res, 404, "NOT_FOUND", "Тайтл не найден.");
  if (title.status !== "published" && !canPreviewTitle(title, viewer)) {
    return fail(res, 404, "NOT_FOUND", "Тайтл не найден.");
  }
  return send(res, 200, Object.assign({ ok: true }, titleDetail(title, viewer)));
});

const handleChapterCreate = api(async (req, res, url, slug) => {
  const user = requireUser(req, res);
  if (!user) return;
  const title = titleBySlug(slugValue(slug, 120));
  if (!title) return fail(res, 404, "NOT_FOUND", "Тайтл не найден.");
  if (title.status !== "published" && !isStaff(user) && title.createdBy !== user.id) {
    return fail(res, 403, "FORBIDDEN", "Добавлять главы в черновик тайтла может его автор или staff.");
  }
  const body = await parseBody(req, res);
  if (!body) return;
  const teamId = clean(body.teamId, 64);
  const number = Number(body.number);
  const language = clean(body.language, 10).toLowerCase() || "ru";
  const chapterName = textOrNull(body.title != null ? body.title : body.name, 200);
  const sourceUrl = textOrNull(body.sourceUrl, 500);
  const proofUrl = textOrNull(body.proofUrl, 500);
  const rightsNote = textOrNull(body.rightsNote, 1000);
  const volume = body.volume == null ? null : Number(body.volume);
  const fields = {};
  if (!teamId) fields.teamId = "Укажи команду.";
  if (!Number.isFinite(number) || number <= 0 || number > 99999) {
    fields.number = "Номер главы: число больше нуля.";
  }
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) fields.language = "Язык: ru или ru-ru.";
  if (volume != null && (!Number.isInteger(volume) || volume <= 0)) fields.volume = "Том: целое число больше нуля.";
  if (sourceUrl && !isHttpUrl(sourceUrl)) fields.sourceUrl = "Ссылка должна начинаться с http:// или https://.";
  if (proofUrl && !isHttpUrl(proofUrl)) fields.proofUrl = "Ссылка должна начинаться с http:// или https://.";
  if (Object.keys(fields).length) return fieldError(res, fields, "Проверь поля главы.");
  const team = teamById(teamId);
  if (!team) return fail(res, 404, "NOT_FOUND", "Команда не найдена.");
  if (team.status !== "active") {
    return fail(res, 409, "TEAM_SUSPENDED", "Команда заблокирована: загрузка недоступна.");
  }
  if (user.role !== "admin" && !teamMember(team, user.id)) {
    return fail(res, 403, "FORBIDDEN", "Нужно быть участником команды.");
  }
  const rounded = Math.round(number * 100) / 100;
  const duplicate = db.chapters.some((chapter) =>
    chapter.titleId === title.id && chapter.number === rounded && chapter.language === language
  );
  if (duplicate) {
    return fail(res, 409, "CHAPTER_EXISTS", "Глава с таким номером и языком уже существует.");
  }
  const createdAt = isoNow();
  const versionId = id("ver");
  const chapter = {
    id: id("ch"),
    titleId: title.id,
    number: rounded,
    volume: volume,
    name: chapterName,
    language: language,
    status: "draft",
    publishedAt: null,
    createdAt: createdAt,
    updatedAt: createdAt,
    versions: [{
      id: versionId,
      teamId: team.id,
      version: 1,
      status: "draft",
      rightsNote: rightsNote,
      sourceUrl: sourceUrl,
      proofUrl: proofUrl,
      submittedBy: user.id,
      submittedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      reviewNote: null,
      createdAt: createdAt,
      updatedAt: createdAt
    }]
  };
  db.chapters.push(chapter);
  saveDb();
  return send(res, 201, {
    ok: true,
    chapter: chapterView(chapter, user),
    versionId: versionId
  });
});

const handleChapterSubmit = api(async (req, res, url, chapterId) => {
  const user = requireUser(req, res);
  if (!user) return;
  const chapter = chapterById(chapterId);
  if (!chapter) return fail(res, 404, "NOT_FOUND", "Глава не найдена.");
  const version = latestVersion(chapter);
  if (!version) return fail(res, 409, "NO_VERSION", "У главы нет версии перевода.");
  if (user.role !== "admin" && !isTeamMember(version.teamId, user.id)) {
    return fail(res, 403, "FORBIDDEN", "Отправить главу может только участник её команды.");
  }
  if (version.status !== "draft" && version.status !== "changes_requested") {
    return fail(res, 409, "INVALID_TRANSITION", "Отправить можно только черновик или главу с запрошенными правками.");
  }
  if (!pagesOf(version.id).length) {
    return fail(res, 400, "EMPTY_CHAPTER", "Сначала загрузи хотя бы одну страницу.");
  }
  const updatedAt = isoNow();
  version.status = "review";
  version.submittedAt = updatedAt;
  version.submittedBy = user.id;
  version.updatedAt = updatedAt;
  chapter.status = "review";
  chapter.updatedAt = updatedAt;
  saveDb();
  return send(res, 200, {
    ok: true,
    chapter: chapterView(chapter, user),
    versionId: version.id
  });
});

const handleModerationQueue = api(async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (!isStaff(user)) return fail(res, 403, "FORBIDDEN", "Очередь доступна модератору и админу.");
  const queue = [];
  db.chapters.forEach((chapter) => {
    chapter.versions.forEach((version) => {
      if (version.status !== "review") return;
      const title = titleById(chapter.titleId);
      const team = teamById(version.teamId);
      const submitter = version.submittedBy ? userById(version.submittedBy) : null;
      const pages = pagesOf(version.id);
      queue.push({
        versionId: version.id,
        chapterId: chapter.id,
        chapter: {
          id: chapter.id,
          number: chapter.number,
          volume: chapter.volume == null ? null : chapter.volume,
          name: chapter.name || null,
          language: chapter.language
        },
        title: title ? {
          id: title.id,
          slug: title.slug,
          titleRu: title.titleRu,
          type: title.type,
          status: title.status,
          ageRating: title.ageRating,
          rightsStatus: title.rightsStatus,
          rightsHolder: title.rightsHolder || null,
          licenseCode: title.licenseCode || null,
          licenseUrl: title.licenseUrl || null,
          sourceUrl: title.sourceUrl || null
        } : null,
        team: team ? { id: team.id, slug: team.slug, name: team.name } : null,
        version: version.version,
        status: version.status,
        submittedAt: version.submittedAt || null,
        submittedBy: version.submittedBy ? {
          id: version.submittedBy,
          name: submitter ? submitter.name : ""
        } : null,
        pageCount: pages.length,
        previewPages: pages.slice(0, 3).map(pageView)
      });
    });
  });
  queue.sort((left, right) => String(left.submittedAt).localeCompare(String(right.submittedAt)));
  return send(res, 200, { ok: true, queue: queue, count: queue.length });
});

const handleChapterStatus = api(async (req, res, url, chapterId) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (!isStaff(user)) return fail(res, 403, "FORBIDDEN", "Менять статус главы может модератор или админ.");
  const chapter = chapterById(chapterId);
  if (!chapter) return fail(res, 404, "NOT_FOUND", "Глава не найдена.");
  const version = latestVersion(chapter);
  if (!version) return fail(res, 409, "NO_VERSION", "У главы нет версии перевода.");
  const body = await parseBody(req, res);
  if (!body) return;
  const status = clean(body.status, 30).toLowerCase();
  const note = clean(body.note, 1000);
  if (!MODERATION_STATUSES.has(status)) {
    return fieldError(res, { status: "Допустимо: published, changes_requested, rejected." }, "Неизвестный статус.");
  }
  if (version.status !== "review") {
    if (version.status === "published") {
      return fail(res, 409, "ALREADY_PUBLISHED", "Версия уже опубликована.");
    }
    return fail(res, 409, "INVALID_TRANSITION", "Решение принимается только для версии на проверке.");
  }
  if ((status === "changes_requested" || status === "rejected") && note.length < 2) {
    return fieldError(res, { note: "Для правок и отказа нужен комментарий." }, "Нужен комментарий модератора.");
  }
  const title = titleById(chapter.titleId);
  if (!title) return fail(res, 404, "NOT_FOUND", "Тайтл не найден.");
  if (status === "published" && title.rightsStatus === "unverified") {
    return fail(res, 409, "RIGHTS_UNVERIFIED", "Нельзя опубликовать главу тайтла с неподтверждёнными правами.");
  }
  const updatedAt = isoNow();
  version.status = status;
  version.reviewedBy = user.id;
  version.reviewedAt = updatedAt;
  version.reviewNote = note || null;
  version.rejectionReason = status === "rejected" ? (note || null) : null;
  version.updatedAt = updatedAt;
  if (status === "published") {
    chapter.status = "published";
    chapter.publishedAt = updatedAt;
    if (title.status === "draft") title.status = "published";
    title.updatedAt = updatedAt;
  } else {
    chapter.status = "draft";
  }
  chapter.updatedAt = updatedAt;
  saveDb();
  return send(res, 200, {
    ok: true,
    chapter: chapterView(chapter, user),
    version: versionView(version, true)
  });
});

const handleChapterPagesPut = api(async (req, res, url, chapterId) => {
  const user = requireUser(req, res);
  if (!user) return;
  const chapter = chapterById(chapterId);
  if (!chapter) return fail(res, 404, "NOT_FOUND", "Глава не найдена.");
  const version = latestVersion(chapter);
  if (!version) return fail(res, 409, "NO_VERSION", "У главы нет версии перевода.");
  if (user.role !== "admin" && !isStaff(user) && !isTeamMember(version.teamId, user.id)) {
    return fail(res, 403, "FORBIDDEN", "Загружать страницы может участник команды, модератор или админ.");
  }
  if (version.status !== "draft" && version.status !== "changes_requested") {
    return fail(res, 409, "INVALID_TRANSITION", "Страницы можно менять только в черновике или после запроса правок.");
  }
  const body = await parseBody(req, res, PAGE_BODY_LIMIT);
  if (!body) return;
  const sourcePages = body.pages;
  if (!Array.isArray(sourcePages) || !sourcePages.length) {
    return fieldError(res, { pages: "Нужен непустой массив страниц." }, "Нет страниц для загрузки.");
  }
  if (sourcePages.length > MAX_PAGES) {
    return fail(res, 400, "TOO_MANY_PAGES", "В одной версии может быть не больше " + MAX_PAGES + " страниц.");
  }
  const prepared = [];
  for (let index = 0; index < sourcePages.length; index += 1) {
    const entry = sourcePages[index];
    const label = "Страница " + (index + 1) + ": ";
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return fieldError(res, { pages: label + "нужен объект { name, type, data }." });
    }
    const decoded = decodeBase64Image(entry.data);
    if (!decoded) {
      return fieldError(res, { pages: label + "ожидается base64-изображение." });
    }
    if (decoded.buffer.length > MAX_PAGE_BYTES) {
      return fail(res, 413, "PAGE_TOO_LARGE", label + "файл больше 10 МБ.");
    }
    const sniffed = sniffImage(decoded.buffer);
    if (!sniffed) {
      return fail(res, 415, "UNSUPPORTED_MEDIA_TYPE", label + "поддерживаются только JPEG, PNG и WebP.");
    }
    const declaredType = normalizeMime(entry.type);
    if (declaredType && !MIME_EXTENSIONS[declaredType]) {
      return fail(res, 415, "UNSUPPORTED_MEDIA_TYPE", label + "тип " + declaredType + " не поддерживается.");
    }
    if (declaredType && declaredType !== sniffed) {
      return fail(res, 415, "MIME_MISMATCH", label + "тип не совпадает с содержимым файла.");
    }
    if (decoded.mime && !MIME_EXTENSIONS[decoded.mime]) {
      return fail(res, 415, "UNSUPPORTED_MEDIA_TYPE", label + "data URL должен содержать JPEG, PNG или WebP.");
    }
    if (declaredType && decoded.mime && declaredType !== decoded.mime) {
      return fail(res, 415, "MIME_MISMATCH", label + "type и data URL указывают разные форматы.");
    }
    prepared.push({
      name: clean(entry.name, 120) || "page-" + (index + 1) + "." + MIME_EXTENSIONS[sniffed],
      mime: sniffed,
      buffer: decoded.buffer
    });
  }

  const directory = path.join(UPLOAD_DIR, chapter.id);
  fs.mkdirSync(directory, { recursive: true });
  const previous = pagesOf(version.id);
  const keep = new Set();
  const nextPages = prepared.map((page, index) => {
    const extension = MIME_EXTENSIONS[page.mime];
    const base = safeFileName(page.name, "page")
      .replace(/\.[a-zA-Z0-9]+$/, "")
      .slice(0, 60) || "page";
    const stored = String(index + 1).padStart(3, "0") + "-" + base + "." + extension;
    fs.writeFileSync(path.join(directory, stored), page.buffer);
    const absolute = path.resolve(directory, stored);
    keep.add(absolute);
    const checksum = crypto.createHash("sha256").update(page.buffer).digest("hex");
    return {
      id: id("pg"),
      pageNumber: index + 1,
      name: page.name,
      imageKey: "/uploads/" + chapter.id + "/" + stored + "?v=" + checksum.slice(0, 12),
      mime: page.mime,
      byteSize: page.buffer.length,
      checksum: checksum,
      createdAt: isoNow()
    };
  });
  previous.forEach((page) => {
    const imagePath = String(page.imageKey).split("?")[0];
    const oldPath = path.resolve(UPLOAD_DIR, chapter.id, path.basename(imagePath));
    if (keep.has(oldPath)) return;
    try { fs.rmSync(oldPath, { force: true }); } catch (removeError) {}
  });
  const updatedAt = isoNow();
  db.chapterPages[version.id] = nextPages;
  version.updatedAt = updatedAt;
  chapter.updatedAt = updatedAt;
  saveDb();
  return send(res, 200, {
    ok: true,
    chapterId: chapter.id,
    versionId: version.id,
    pages: nextPages.map(pageView)
  });
});

const handleChapterPagesGet = api(async (req, res, url, chapterId) => {
  const session = getSession(req);
  const viewer = session ? session.user : null;
  const chapter = chapterById(chapterId);
  if (!chapter) return fail(res, 404, "NOT_FOUND", "Глава не найдена.");
  const version = latestVersion(chapter);
  if (!version) return fail(res, 404, "NOT_FOUND", "У главы нет страниц.");
  const title = titleById(chapter.titleId);
  const publiclyVisible = Boolean(
    version.status === "published" &&
    chapter.status === "published" &&
    title && title.status === "published"
  );
  let allowed = publiclyVisible;
  if (!allowed && viewer) {
    allowed = isStaff(viewer) ||
      Boolean(title && title.createdBy === viewer.id) ||
      isTeamMember(version.teamId, viewer.id);
  }
  if (!allowed) {
    if (!viewer) return fail(res, 401, "UNAUTHORIZED", "Нужен вход.");
    return fail(res, 403, "FORBIDDEN", "Глава ещё не опубликована.");
  }
  const team = teamById(version.teamId);
  return send(res, 200, {
    ok: true,
    chapter: {
      id: chapter.id,
      titleId: chapter.titleId,
      number: chapter.number,
      volume: chapter.volume == null ? null : chapter.volume,
      name: chapter.name || null,
      language: chapter.language,
      status: chapter.status,
      publishedAt: chapter.publishedAt || null
    },
    version: {
      id: version.id,
      version: version.version,
      status: version.status,
      team: team ? { id: team.id, slug: team.slug, name: team.name } : null
    },
    pages: pagesOf(version.id).map(pageView)
  });
});

const handleProgressPut = api(async (req, res, url, chapterId) => {
  const user = requireUser(req, res);
  if (!user) return;
  const chapter = chapterById(chapterId);
  if (!chapter) return fail(res, 404, "NOT_FOUND", "Глава не найдена.");
  const title = titleById(chapter.titleId);
  const publiclyVisible = Boolean(
    title && title.status === "published" && chapter.status === "published" &&
    chapter.versions.some((version) => version.status === "published")
  );
  const member = chapter.versions.some((version) => isTeamMember(version.teamId, user.id));
  if (!publiclyVisible && !isStaff(user) && !member && !(title && title.createdBy === user.id)) {
    return fail(res, 404, "NOT_FOUND", "Глава не найдена.");
  }
  const body = await parseBody(req, res);
  if (!body) return;
  const page = Number(body.page);
  const percent = Number(body.percent);
  const fields = {};
  if (!Number.isInteger(page) || page < 1 || page > 10000) fields.page = "Страница: целое число больше нуля.";
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) fields.percent = "Процент: от 0 до 100.";
  if (Object.keys(fields).length) return fieldError(res, fields, "Проверь прогресс чтения.");
  const key = user.id + ":" + chapter.titleId;
  db.progress[key] = {
    userId: user.id,
    titleId: chapter.titleId,
    chapterId: chapter.id,
    page: page,
    percent: Math.round(percent * 100) / 100,
    updatedAt: isoNow()
  };
  saveDb();
  return send(res, 200, { ok: true, progress: db.progress[key] });
});

const handleProgressGet = api(async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const progress = Object.values(db.progress)
    .filter((record) => record.userId === user.id)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .map((record) => {
      const chapter = chapterById(record.chapterId);
      const title = titleById(record.titleId);
      return {
        titleId: record.titleId,
        chapterId: record.chapterId,
        page: record.page,
        percent: record.percent,
        updatedAt: record.updatedAt,
        chapter: chapter ? { number: chapter.number, name: chapter.name || null } : null,
        title: title ? { slug: title.slug, titleRu: title.titleRu } : null
      };
    });
  return send(res, 200, { ok: true, progress: progress });
});

const handleUserRole = api(async (req, res, url, userId) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.role !== "admin") return fail(res, 403, "FORBIDDEN", "Менять роли может только админ.");
  const target = userById(userId);
  if (!target) return fail(res, 404, "NOT_FOUND", "Пользователь не найден.");
  const body = await parseBody(req, res);
  if (!body) return;
  const role = clean(body.role, 20).toLowerCase();
  if (!GLOBAL_ROLES.has(role)) {
    return fieldError(res, { role: "Допустимо: reader, translator, moderator, admin." }, "Неизвестная роль.");
  }
  if (target.id === user.id) {
    return fail(res, 409, "SELF_ROLE", "Нельзя менять собственную роль.");
  }
  if (target.role === "admin" && role !== "admin") {
    const otherAdmins = db.users.filter((entry) => entry.role === "admin" && entry.id !== target.id);
    if (!otherAdmins.length) return fail(res, 409, "LAST_ADMIN", "Нельзя убрать последнего админа.");
  }
  target.role = role;
  target.updatedAt = isoNow();
  saveDb();
  return send(res, 200, { ok: true, user: publicUser(target) });
});

function route(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://" + HOST + ":" + PORT);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname.indexOf("/uploads/") === 0) {
    let relative;
    try { relative = decodeURIComponent(pathname.slice("/uploads/".length)); } catch (decodeError) {
      return error(res, 400, "Некорректный путь.");
    }
    const target = path.resolve(UPLOAD_DIR, relative);
    const root = path.resolve(UPLOAD_DIR) + path.sep;
    if (target.indexOf(root) !== 0) return error(res, 404, "Файл не найден.");
    return fs.readFile(target, (readError, data) => {
      if (readError) return error(res, 404, "Файл не найден.");
      res.writeHead(200, {
        "Content-Type": mimeFor(target),
        "Content-Length": data.length,
        "Cache-Control": "public, max-age=3600"
      });
      res.end(data);
    });
  }

  if (req.method === "GET" && pathname === "/api/health") {
    return send(res, 200, {
      ok: true,
      service: "kuroha-backend",
      version: "0.1",
      users: db.users.length,
      reports: db.reports.length,
      uploads: db.uploads.length,
      teams: db.teams.length,
      titles: db.titles.length,
      chapters: db.chapters.length,
      time: new Date().toISOString()
    });
  }

  if (req.method === "POST" && pathname === "/api/register") {
    return readBody(req).then((body) => {
      const name = clean(body.name, 40) || "Читатель";
      const email = clean(body.email, 120).toLowerCase();
      const password = String(body.password || "");
      if (!validEmail(email)) return error(res, 400, "Укажи корректный email.");
      if (password.length < 6) return error(res, 400, "Пароль должен быть не короче 6 символов.");
      if (userByEmail(email)) return error(res, 409, "Такой email уже зарегистрирован.");
      const salt = crypto.randomBytes(16).toString("hex");
      const user = {
        id: id("usr"),
        email: email,
        name: name,
        role: db.users.length === 0 ? "admin" : "reader",
        salt: salt,
        passwordHash: hashPassword(password, salt),
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      const token = createSession(user.id);
      saveDb();
      send(res, 201, { ok: true, token: token, user: publicUser(user) });
    }).catch((bodyError) => error(res, 400, bodyError.message));
  }

  if (req.method === "POST" && pathname === "/api/login") {
    return readBody(req).then((body) => {
      const email = clean(body.email, 120).toLowerCase();
      const password = String(body.password || "");
      const user = userByEmail(email);
      if (!user) return error(res, 401, "Неверный email или пароль.");
      if (!safeEqual(hashPassword(password, user.salt), user.passwordHash)) {
        return error(res, 401, "Неверный email или пароль.");
      }
      const token = createSession(user.id);
      send(res, 200, { ok: true, token: token, user: publicUser(user) });
    }).catch((bodyError) => error(res, 400, bodyError.message));
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    const session = getSession(req);
    if (session) {
      delete db.sessions[session.token];
      saveDb();
    }
    return send(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/me") {
    const session = authOrFail(req, res);
    if (!session) return;
    return send(res, 200, { ok: true, user: publicUser(session.user) });
  }

  if (req.method === "GET" && pathname === "/api/state") {
    const session = authOrFail(req, res);
    if (!session) return;
    const record = db.states[session.user.id] || null;
    return send(res, 200, { ok: true, state: record ? record.state : {}, updatedAt: record ? record.updatedAt : null });
  }

  if (req.method === "PUT" && pathname === "/api/state") {
    const session = authOrFail(req, res);
    if (!session) return;
    return readBody(req).then((body) => {
      if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
        return error(res, 400, "Поле state должно быть объектом.");
      }
      db.states[session.user.id] = {
        state: body.state,
        updatedAt: new Date().toISOString()
      };
      saveDb();
      send(res, 200, { ok: true, updatedAt: db.states[session.user.id].updatedAt });
    }).catch((bodyError) => error(res, 400, bodyError.message));
  }

  if (req.method === "GET" && pathname === "/api/uploads") {
    const slug = safeSlug(url.searchParams.get("slug") || "");
    const uploads = db.uploads
      .filter((entry) => !slug || entry.slug === slug)
      .slice(0, 50)
      .map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        chapter: entry.chapter,
        chapterName: entry.chapterName,
        files: entry.files,
        createdAt: entry.createdAt,
        userName: entry.userName
      }));
    return send(res, 200, { ok: true, uploads: uploads });
  }

  if (req.method === "POST" && pathname === "/api/uploads") {
    const session = authOrFail(req, res);
    if (!session) return;
    if (!isAdmin(session)) return error(res, 403, "Загружать главы может только admin.");
    return readBody(req).then((body) => {
      const slug = safeSlug(body.slug);
      const chapter = Number(body.chapter);
      const chapterName = clean(body.chapterName, 80);
      const sourceFiles = Array.isArray(body.files) ? body.files : [];
      if (!slug) return error(res, 400, "Не указан slug тайтла.");
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > 9999) return error(res, 400, "Некорректный номер главы.");
      if (!sourceFiles.length || sourceFiles.length > 30) return error(res, 400, "Нужно от 1 до 30 файлов.");
      const uploadId = id("up");
      const directory = path.join(UPLOAD_DIR, uploadId);
      fs.mkdirSync(directory, { recursive: true });
      const files = [];
      let total = 0;
      try {
        sourceFiles.forEach((file, index) => {
          const raw = String(file.data || "");
          const base64 = raw.indexOf(",") !== -1 && raw.indexOf("base64,") !== -1 ? raw.split("base64,")[1] : raw;
          const buffer = Buffer.from(base64, "base64");
          total += buffer.length;
          if (!buffer.length || buffer.length > 4 * 1024 * 1024) throw new Error("Файл пустой или больше 4 МБ.");
          if (total > 20 * 1024 * 1024) throw new Error("Слишком большой общий размер файлов.");
          const name = safeFileName(file.name, "page-" + (index + 1) + ".png");
          const stored = String(index + 1).padStart(2, "0") + "-" + name;
          fs.writeFileSync(path.join(directory, stored), buffer);
          files.push({
            name: name,
            path: "/uploads/" + uploadId + "/" + stored,
            size: buffer.length,
            mime: String(file.type || mimeFor(name)).slice(0, 80)
          });
        });
      } catch (fileError) {
        try { fs.rmSync(directory, { recursive: true, force: true }); } catch (removeError) {}
        return error(res, 400, fileError.message);
      }
      const upload = {
        id: uploadId,
        userId: session.user.id,
        userName: session.user.name,
        slug: slug,
        chapter: chapter,
        chapterName: chapterName,
        files: files,
        createdAt: new Date().toISOString()
      };
      db.uploads.unshift(upload);
      saveDb();
      send(res, 201, { ok: true, upload: upload });
    }).catch((bodyError) => error(res, 400, bodyError.message));
  }

  if (req.method === "POST" && pathname === "/api/reports") {
    return readBody(req).then((body) => {
      const targetType = body.targetType === "chapter" ? "chapter" : "title";
      const targetLabel = clean(body.targetLabel, 120);
      if (!targetLabel) return error(res, 400, "Не указан объект жалобы.");
      const report = {
        id: id("rep"),
        targetType: targetType,
        targetSlug: clean(body.targetSlug, 120),
        targetChapter: body.targetChapter ? Number(body.targetChapter) : null,
        targetLabel: targetLabel,
        reason: clean(body.reason, 40) || "other",
        text: clean(body.text, 500),
        status: "open",
        createdAt: new Date().toISOString()
      };
      db.reports.unshift(report);
      saveDb();
      send(res, 201, { ok: true, report: report });
    }).catch((bodyError) => error(res, 400, bodyError.message));
  }

  if (req.method === "GET" && pathname === "/api/reports") {
    const session = authOrFail(req, res);
    if (!session) return;
    if (!isAdmin(session)) return error(res, 403, "Очередь жалоб доступна только admin.");
    return send(res, 200, { ok: true, reports: db.reports.slice(0, 100) });
  }

  const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
  if (req.method === "PATCH" && reportMatch) {
    const session = authOrFail(req, res);
    if (!session) return;
    if (!isAdmin(session)) return error(res, 403, "Менять статус жалобы может только admin.");
    return readBody(req).then((body) => {
      const report = db.reports.find((entry) => entry.id === reportMatch[1]);
      if (!report) return error(res, 404, "Жалоба не найдена.");
      const status = ["open", "resolved", "dismissed"].includes(body.status) ? body.status : null;
      if (!status) return error(res, 400, "Неизвестный статус.");
      report.status = status;
      report.updatedAt = new Date().toISOString();
      saveDb();
      send(res, 200, { ok: true, report: report });
    }).catch((bodyError) => error(res, 400, bodyError.message));
  }

  const uploadMatch = pathname.match(/^\/api\/uploads\/([^/]+)$/);
  if (req.method === "DELETE" && uploadMatch) {
    const session = authOrFail(req, res);
    if (!session) return;
    const upload = db.uploads.find((entry) => entry.id === uploadMatch[1]);
    if (!upload) return error(res, 404, "Загрузка не найдена.");
    if (!isAdmin(session) && upload.userId !== session.user.id) {
      return error(res, 403, "Удалить загрузку может автор или admin.");
    }
    try { fs.rmSync(path.join(UPLOAD_DIR, upload.id), { recursive: true, force: true }); } catch (removeError) {}
    db.uploads = db.uploads.filter((entry) => entry.id !== upload.id);
    saveDb();
    return send(res, 200, { ok: true });
  }

  // --- UGC vertical slice -------------------------------------------------

  if (req.method === "GET" && pathname === "/api/teams") {
    return handleTeamsList(req, res);
  }
  if (req.method === "POST" && pathname === "/api/teams") {
    return handleTeamCreate(req, res);
  }
  const teamMemberMatch = pathname.match(/^\/api\/teams\/([^/]+)\/members$/);
  if (req.method === "POST" && teamMemberMatch) {
    return handleTeamMemberAdd(req, res, url, teamMemberMatch[1]);
  }

  if (req.method === "GET" && pathname === "/api/titles") {
    return handleTitlesList(req, res, url);
  }
  if (req.method === "POST" && pathname === "/api/titles") {
    return handleTitleCreate(req, res);
  }
  const titleChapterMatch = pathname.match(/^\/api\/titles\/([^/]+)\/chapters$/);
  if (req.method === "POST" && titleChapterMatch) {
    return handleChapterCreate(req, res, url, titleChapterMatch[1]);
  }
  const titleMatch = pathname.match(/^\/api\/titles\/([^/]+)$/);
  if (req.method === "GET" && titleMatch) {
    return handleTitleGet(req, res, url, titleMatch[1]);
  }

  const chapterSubmitMatch = pathname.match(/^\/api\/chapters\/([^/]+)\/submit$/);
  if (req.method === "POST" && chapterSubmitMatch) {
    return handleChapterSubmit(req, res, url, chapterSubmitMatch[1]);
  }
  const chapterStatusMatch = pathname.match(/^\/api\/chapters\/([^/]+)\/status$/);
  if (req.method === "PATCH" && chapterStatusMatch) {
    return handleChapterStatus(req, res, url, chapterStatusMatch[1]);
  }
  const chapterPagesMatch = pathname.match(/^\/api\/chapters\/([^/]+)\/pages$/);
  if (chapterPagesMatch && req.method === "GET") {
    return handleChapterPagesGet(req, res, url, chapterPagesMatch[1]);
  }
  if (chapterPagesMatch && req.method === "POST") {
    return handleChapterPagesPut(req, res, url, chapterPagesMatch[1]);
  }

  if (req.method === "GET" && pathname === "/api/moderation/queue") {
    return handleModerationQueue(req, res);
  }

  if (req.method === "GET" && pathname === "/api/progress") {
    return handleProgressGet(req, res);
  }
  const progressMatch = pathname.match(/^\/api\/progress\/([^/]+)$/);
  if (req.method === "PUT" && progressMatch) {
    return handleProgressPut(req, res, url, progressMatch[1]);
  }

  const roleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
  if (req.method === "PATCH" && roleMatch) {
    return handleUserRole(req, res, url, roleMatch[1]);
  }

  error(res, 404, "Маршрут не найден.");
}

const server = http.createServer((req, res) => {
  Promise.resolve(route(req, res)).catch((serverError) => {
    console.error(serverError);
    if (!res.headersSent) error(res, 500, "Внутренняя ошибка сервера.");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Kuroha backend v0.1 → http://${HOST}:${PORT}`);
  console.log(`База: ${DB_PATH}`);
});

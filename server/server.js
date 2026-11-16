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
const DB_PATH = path.join(__dirname, "db.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const SESSION_DAYS = 30;
const MAX_BODY = 25 * 1024 * 1024;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:4177",
  "http://localhost:4177",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
]);

let db = loadDb();

function emptyDb() {
  return { users: [], sessions: {}, states: {}, reports: [], uploads: [] };
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
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Слишком большой запрос."));
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
        reject(new Error("Некорректный JSON."));
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

/* Kuroha 3.0 — local API client for the optional backend */
(function () {
  "use strict";

  const API = "http://127.0.0.1:4180/api";
  const TOKEN_KEY = "kuroha-api-token";
  const USER_KEY = "kuroha-api-user";
  const LAST_KEY = "kuroha-api-last";
  const $ = (selector) => document.querySelector(selector);
  let adminLoaded = false;

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch (error) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (error) { return ""; }
  }

  function getUser() {
    return readJSON(USER_KEY, null);
  }

  function initials(name) {
    return String(name || "K").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " Б";
    return (bytes / 1024).toFixed(1).replace(".", ",") + " КБ";
  }

  async function request(path, options) {
    const config = options || {};
    config.headers = Object.assign({ "Content-Type": "application/json" }, config.headers || {});
    const token = getToken();
    if (token) config.headers.Authorization = "Bearer " + token;
    let response;
    try {
      response = await fetch(API + path, config);
    } catch (error) {
      throw new Error("Сервер не отвечает. Запусти `node server/server.js`.");
    }
    let payload = {};
    try { payload = await response.json(); } catch (error) {}
    if (!response.ok) throw new Error(payload.error || "Ошибка сервера " + response.status + ".");
    return payload;
  }

  function setSession(data) {
    try {
      localStorage.setItem(TOKEN_KEY, data.token);
      writeJSON(USER_KEY, data.user);
    } catch (error) {}
    if (window.KurohaAuth && typeof window.KurohaAuth.login === "function") {
      window.KurohaAuth.login(data.user.name, data.user.email, "email");
    } else {
      writeJSON("kuroha-session", {
        name: data.user.name,
        email: data.user.email,
        provider: "email",
        createdAt: new Date().toISOString()
      });
    }
    render();
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (error) {}
    render();
  }

  function snapshot() {
    const state = {};
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.indexOf("kuroha-") === 0 && key !== TOKEN_KEY && key !== USER_KEY) {
          state[key] = localStorage.getItem(key);
        }
      }
    } catch (error) {}
    return state;
  }

  function restore(state) {
    try {
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.indexOf("kuroha-") === 0 && key !== TOKEN_KEY && key !== USER_KEY) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      Object.keys(state || {}).forEach((key) => {
        if (key.indexOf("kuroha-") === 0 && typeof state[key] === "string") {
          localStorage.setItem(key, state[key]);
        }
      });
    } catch (error) {}
  }

  function render() {
    const user = getUser();
    const form = $("#cloud-form");
    const account = $("#cloud-account");
    const sync = $("#cloud-sync");
    if (!form || !account || !sync) return;

    if (user && getToken()) {
      form.hidden = true;
      account.hidden = false;
      sync.hidden = false;
      $("#cloud-account-name").textContent = user.name;
      $("#cloud-account-email").textContent = user.email;
      $("#cloud-avatar").textContent = initials(user.name);
    } else {
      form.hidden = false;
      account.hidden = true;
      sync.hidden = true;
    }

    const adminPanel = $("#cloud-admin");
    const moderationPanel = $("#cloud-moderation");
    const isAdmin = Boolean(user && user.role === "admin" && getToken());
    if (adminPanel) adminPanel.hidden = !isAdmin;
    if (moderationPanel) moderationPanel.hidden = !isAdmin;
    if (isAdmin) {
      if (!adminLoaded) {
        adminLoaded = true;
        initAdmin();
      } else {
        loadUploads();
        loadReports();
      }
    }

    const state = snapshot();
    const keys = Object.keys(state);
    const bytes = new Blob([JSON.stringify(state)]).size;
    $("#cloud-local-keys").textContent = String(keys.length);
    $("#cloud-local-size").textContent = formatBytes(bytes);
    const last = localStorage.getItem(LAST_KEY);
    $("#cloud-last").textContent = last ? new Date(last).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  }

  async function checkHealth() {
    const dot = $("#cloud-status-dot");
    const text = $("#cloud-status-text");
    const note = $("#cloud-status-note");
    try {
      const health = await request("/health");
      if (dot) dot.className = "cloud-dot is-online";
      if (text) text.textContent = "Сервер доступен";
      if (note) note.textContent = "Kuroha backend v" + health.version + ". Пользователей: " + health.users + ", жалоб: " + health.reports + ".";
    } catch (error) {
      if (dot) dot.className = "cloud-dot is-offline";
      if (text) text.textContent = "Сервер не запущен";
      if (note) note.textContent = "Запусти в папке server: node server.js. Пока работает локальная версия.";
    }
  }

  function toast(message) {
    if (window.KurohaToast) window.KurohaToast(message);
  }

  async function submit(mode) {
    const name = $("#cloud-name").value.trim();
    const email = $("#cloud-email").value.trim();
    const password = $("#cloud-password").value;
    if (!email || !password) {
      toast("Заполни email и пароль.");
      return;
    }
    try {
      const data = await request(mode === "register" ? "/register" : "/login", {
        method: "POST",
        body: JSON.stringify({ name: name, email: email, password: password })
      });
      setSession(data);
      toast(mode === "register" ? "Аккаунт создан. Добро пожаловать." : "Ты вошёл в серверный аккаунт.");
    } catch (error) {
      toast(error.message);
    }
  }

  async function pushState() {
    try {
      const state = snapshot();
      await request("/state", { method: "PUT", body: JSON.stringify({ state: state }) });
      localStorage.setItem(LAST_KEY, new Date().toISOString());
      render();
      toast("Состояние загружено на сервер.");
    } catch (error) {
      toast(error.message);
    }
  }

  async function pullState() {
    try {
      const data = await request("/state");
      const state = data.state || {};
      if (!Object.keys(state).length) {
        toast("На сервере пока нет сохранённого состояния.");
        return;
      }
      if (!window.confirm("Заменить локальные данные состоянием с сервера? Текущая тема, прогресс и заметки будут заменены.")) return;
      restore(state);
      localStorage.setItem(LAST_KEY, new Date().toISOString());
      toast("Состояние загружено с сервера. Обновляем страницу.");
      window.setTimeout(() => window.location.reload(), 650);
    } catch (error) {
      toast(error.message);
    }
  }

  function initAdmin() {
    const select = $("#cloud-upload-title");
    if (select && !select.options.length) {
      select.innerHTML = (window.KUROHA_TITLES || []).map((item) =>
        `<option value="${escapeHTML(item.slug)}">${escapeHTML(item.title)}</option>`
      ).join("");
    }
    $("#cloud-upload-form")?.addEventListener("submit", uploadChapter);
    $("#cloud-uploads")?.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-cloud-delete]");
      if (remove) deleteUpload(remove.dataset.cloudDelete);
    });
    $("#cloud-reports")?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-cloud-report-status]");
      if (action) patchReport(action.dataset.cloudReportId, action.dataset.cloudReportStatus);
    });
    loadUploads();
    loadReports();
  }

  function fileToData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result || "") });
      reader.onerror = () => reject(new Error("Не удалось прочитать " + file.name + "."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadChapter(event) {
    event.preventDefault();
    const select = $("#cloud-upload-title");
    const chapter = Number($("#cloud-upload-chapter").value);
    const name = $("#cloud-upload-name").value.trim();
    const input = $("#cloud-upload-files");
    const status = $("#cloud-upload-status");
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) {
      toast("Выбери хотя бы одну страницу.");
      return;
    }
    if (!select || !select.value || !Number.isInteger(chapter) || chapter < 1) {
      toast("Выбери тайтл и номер главы.");
      return;
    }
    try {
      if (status) status.textContent = "Читаем файлы…";
      const data = await Promise.all(files.map(fileToData));
      if (status) status.textContent = "Загружаем " + data.length + " файлов…";
      const result = await request("/uploads", {
        method: "POST",
        body: JSON.stringify({ slug: select.value, chapter: chapter, chapterName: name, files: data })
      });
      input.value = "";
      if (status) status.textContent = "Глава загружена на сервер. " + result.upload.files.length + " файлов.";
      toast("Глава загружена на сервер.");
      loadUploads();
    } catch (error) {
      if (status) status.textContent = error.message;
      toast(error.message);
    }
  }

  async function loadUploads() {
    const list = $("#cloud-uploads");
    if (!list) return;
    try {
      const data = await request("/uploads");
      const uploads = data.uploads || [];
      if (!uploads.length) {
        list.innerHTML = '<p class="cloud-reports-empty">Серверных загрузок пока нет.</p>';
        return;
      }
      list.innerHTML = uploads.map((upload) => {
        const files = (upload.files || []).map((file) =>
          `<a href="http://127.0.0.1:4180${escapeHTML(file.path)}" target="_blank" rel="noopener">${escapeHTML(file.name)}</a>`
        ).join(" ");
        return [
          '<article class="cloud-upload">',
          '<div class="cloud-upload__body"><b>', escapeHTML(upload.slug), " · глава ", escapeHTML(upload.chapter), "</b>",
          '<span>', escapeHTML(upload.chapterName || "без названия"), " · ", (upload.files || []).length, " файлов · ", escapeHTML(upload.userName || ""), "</span>",
          '<div class="cloud-upload__files">', files, "</div></div>",
          '<button class="cloud-upload__delete" type="button" data-cloud-delete="', escapeHTML(upload.id), '">Удалить</button>',
          "</article>"
        ].join("");
      }).join("");
    } catch (error) {
      list.innerHTML = '<p class="cloud-reports-empty">' + escapeHTML(error.message) + "</p>";
    }
  }

  async function deleteUpload(id) {
    if (!window.confirm("Удалить серверную загрузку и её файлы?")) return;
    try {
      await request("/uploads/" + encodeURIComponent(id), { method: "DELETE" });
      toast("Загрузка удалена.");
      loadUploads();
    } catch (error) {
      toast(error.message);
    }
  }

  async function loadReports() {
    const list = $("#cloud-reports");
    if (!list) return;
    try {
      const data = await request("/reports");
      const reports = data.reports || [];
      const empty = $("#cloud-reports-empty");
      if (empty) empty.hidden = reports.length > 0;
      if (!reports.length) {
        list.innerHTML = "";
        return;
      }
      list.innerHTML = reports.map((report) => {
        const actions = report.status === "open"
          ? '<button type="button" data-cloud-report-id="' + escapeHTML(report.id) + '" data-cloud-report-status="resolved">Решить</button><button type="button" data-cloud-report-id="' + escapeHTML(report.id) + '" data-cloud-report-status="dismissed">Отклонить</button>'
          : '<button type="button" data-cloud-report-id="' + escapeHTML(report.id) + '" data-cloud-report-status="open">Вернуть в работу</button>';
        return [
          '<article class="cloud-report is-', escapeHTML(report.status), '">',
          '<div class="cloud-report__head"><b>', escapeHTML(report.targetLabel), "</b><span>", escapeHTML(report.reason), "</span></div>",
          report.text ? "<p>" + escapeHTML(report.text) + "</p>" : "",
          '<div class="cloud-report__actions">', actions, '<span class="cloud-report__head"><span>', escapeHTML(report.status), "</span></span></div>",
          "</article>"
        ].join("");
      }).join("");
    } catch (error) {
      list.innerHTML = '<p class="cloud-reports-empty">' + escapeHTML(error.message) + "</p>";
    }
  }

  async function patchReport(id, status) {
    try {
      await request("/reports/" + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify({ status: status })
      });
      toast("Статус жалобы обновлён.");
      loadReports();
    } catch (error) {
      toast(error.message);
    }
  }

  async function logout() {
    try { await request("/logout", { method: "POST" }); } catch (error) {}
    clearSession();
    toast("Серверная сессия завершена.");
  }

  function bind() {
    if (!$("#cloud-form")) return;
    $("#cloud-login").addEventListener("click", () => submit("login"));
    $("#cloud-register").addEventListener("click", () => submit("register"));
    $("#cloud-form").addEventListener("submit", (event) => {
      event.preventDefault();
      submit("login");
    });
    $("#cloud-push").addEventListener("click", pushState);
    $("#cloud-pull").addEventListener("click", pullState);
    $("#cloud-logout").addEventListener("click", logout);
    render();
    checkHealth();
  }

  window.KurohaCloud = {
    health: checkHealth,
    snapshot: snapshot,
    push: pushState,
    pull: pullState,
    user: getUser,
    logout: logout
  };

  bind();
})();

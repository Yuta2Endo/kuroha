/* Kuroha 3.0 — translator studio and moderation queue.
   Plain script: no modules, no dependencies. */
(function () {
  "use strict";

  var DEFAULT_API = "http://127.0.0.1:4180/api";
  var TOKEN_KEY = "kuroha-api-token";
  var USER_KEY = "kuroha-api-user";
  var MAX_FILES = 100;
  var MAX_FILE_BYTES = 10 * 1024 * 1024;
  var ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  var TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };
  var ROLE_LABELS = {
    reader: "читатель",
    translator: "переводчик",
    moderator: "модератор",
    admin: "администратор"
  };
  var STATUS_LABELS = {
    draft: "черновик",
    review: "на проверке",
    published: "опубликован",
    changes_requested: "нужны правки",
    rejected: "отклонён",
    hidden: "скрыт",
    removed: "снят"
  };
  var RIGHTS_LABELS = {
    licensed: "лицензия",
    permission: "разрешение автора",
    public_domain: "общественное достояние",
    cc: "Creative Commons",
    unverified: "права не подтверждены"
  };

  var TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "",
    "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya"
  };

  function readApiBase() {
    var raw = "";
    try {
      raw = new URLSearchParams(window.location.search).get("api") || "";
    } catch (error) {
      raw = "";
    }
    return (raw.trim() || DEFAULT_API).replace(/\/+$/, "");
  }

  var state = {
    api: readApiBase(),
    token: readToken(),
    user: readUser(),
    teams: [],
    titles: [],
    queue: [],
    notes: new Map(),
    queueLoaded: false,
    activeChapterId: null,
    activePages: [],
    picks: [],
    pickSeq: 0,
    authMode: "login",
    activeTab: "studio",
    workBusy: false,
    titlesRequest: 0
  };

  var els = {};
  var $ = function (selector) { return document.querySelector(selector); };

  function el(id) { return document.getElementById(id); }

  function readToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (error) { return ""; }
  }

  function readUser() {
    try {
      var parsed = JSON.parse(localStorage.getItem(USER_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      if (value == null || value === "") localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (error) {}
  }

  function writeUser(user) {
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch (error) {}
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    return String(name || "K").trim().split(/\s+/).slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join("") || "K";
  }

  function plural(number, forms) {
    var absolute = Math.abs(number) % 100;
    var last = absolute % 10;
    if (absolute > 10 && absolute < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .split("")
      .map(function (character) { return TRANSLIT[character] != null ? TRANSLIT[character] : character; })
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  function typeLabel(type) {
    return TYPE_LABELS[type] || type || "тайтл";
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role || "гость";
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || status || "—";
  }

  function rightsLabel(status) {
    return RIGHTS_LABELS[status] || status || "не указаны";
  }

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date).replace(" г.", "");
  }

  function assetUrl(path) {
    var value = String(path || "");
    if (/^https?:\/\//i.test(value)) return value;
    var origin = window.location.origin;
    try { origin = new URL(state.api).origin; } catch (error) {}
    return origin + (value.charAt(0) === "/" ? value : "/" + value);
  }

  function titlePageHref(slug) {
    return "title.html?titleSlug=" + encodeURIComponent(slug) +
      "&api=" + encodeURIComponent(state.api);
  }

  function isHttpUrl(value) {
    if (!value) return true;
    try {
      var url = new URL(String(value));
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function toast(message) {
    if (typeof window.KurohaToast === "function") window.KurohaToast(message);
  }

  function setStatus(element, text, kind) {
    if (!element) return;
    element.classList.remove("is-success", "is-error", "is-muted");
    if (kind) element.classList.add("is-" + kind);
    element.textContent = text || "";
  }

  function field(form, name) {
    return form.elements.namedItem(name);
  }

  function value(form, name) {
    var control = field(form, name);
    return control ? String(control.value || "").trim() : "";
  }

  function clearFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll(".studio-field.has-error").forEach(function (item) {
      item.classList.remove("has-error");
    });
    form.querySelectorAll("[data-error]").forEach(function (item) {
      item.textContent = "";
    });
  }

  function showFieldErrors(form, fields) {
    if (!form || !fields) return;
    Object.keys(fields).forEach(function (name) {
      var message = fields[name];
      var target = null;
      form.querySelectorAll("[data-error]").forEach(function (item) {
        if (item.getAttribute("data-error") === name) target = item;
      });
      if (!target) return;
      target.textContent = String(message || "");
      var wrapper = target.closest(".studio-field");
      if (wrapper) wrapper.classList.add("has-error");
    });
  }

  function runForm(form, busyLabel, task) {
    if (!form || form.getAttribute("data-busy") === "1") return Promise.resolve();
    form.setAttribute("data-busy", "1");
    form.setAttribute("aria-busy", "true");
    var controls = Array.prototype.slice.call(form.querySelectorAll("input, select, textarea, button"));
    var previous = controls.map(function (control) { return control.disabled; });
    controls.forEach(function (control) { control.disabled = true; });
    var submit = form.querySelector('button[type="submit"]');
    var label = submit ? submit.textContent : "";
    if (submit && busyLabel) submit.textContent = busyLabel;

    return Promise.resolve()
      .then(task)
      .finally(function () {
        controls.forEach(function (control, index) {
          if (control.isConnected) control.disabled = previous[index];
        });
        if (submit && submit.isConnected) submit.textContent = label;
        form.removeAttribute("data-busy");
        form.removeAttribute("aria-busy");
      });
  }

  /* -------------------------------------------------------------------------
     API
     ------------------------------------------------------------------------- */
  function ApiError(status, code, message, fields) {
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.message = message || "Ошибка сервера.";
    this.fields = fields || null;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  async function request(path, options) {
    var config = options || {};
    var headers = { "Accept": "application/json" };
    if (config.body) headers["Content-Type"] = "application/json";
    if (state.token) headers.Authorization = "Bearer " + state.token;

    var response;
    try {
      response = await fetch(state.api + path, {
        method: config.method || "GET",
        headers: headers,
        body: config.body,
        cache: "no-store"
      });
    } catch (error) {
      throw new ApiError(0, "NETWORK", "Сервер не отвечает. Проверь, что backend запущен.");
    }

    var text = "";
    try { text = await response.text(); } catch (error) {}
    var payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch (error) {}
    }

    if (!response.ok) {
      var details = payload && payload.error;
      if (details && typeof details === "object") {
        throw new ApiError(response.status, details.code, details.message, details.fields);
      }
      if (typeof details === "string") {
        throw new ApiError(response.status, "", details);
      }
      throw new ApiError(response.status, "", "Ошибка сервера " + response.status + ".");
    }

    return payload || {};
  }

  function setSession(token, user) {
    state.token = token || "";
    state.user = user || null;
    writeStorage(TOKEN_KEY, state.token);
    writeUser(state.user);
  }

  function clearSession() {
    state.token = "";
    state.user = null;
    writeStorage(TOKEN_KEY, "");
    writeUser(null);
  }

  async function refreshMe() {
    if (!state.token) return null;
    var data = await request("/me");
    if (data.user) setSession(state.token, data.user);
    return data.user || null;
  }

  function handleAuthError(error) {
    if (error && error.status === 401 && state.token) {
      clearSession();
      resetWorkspaceData();
      renderAccess();
      setAuthMode("login");
      setStatus(els.authStatus, "Сессия истекла. Войди заново.", "error");
      toast("Сессия истекла. Войди заново.");
      return true;
    }
    return false;
  }

  /* -------------------------------------------------------------------------
     Access and session
     ------------------------------------------------------------------------- */
  function isLoggedIn() {
    return Boolean(state.token && state.user);
  }

  function canStudio() {
    return isLoggedIn() && (state.user.role === "translator" || state.user.role === "admin");
  }

  function canModerate() {
    return isLoggedIn() && (state.user.role === "moderator" || state.user.role === "admin");
  }

  function hasAccess() {
    return canStudio() || canModerate();
  }

  function renderSession() {
    var logged = isLoggedIn();
    els.sessionName.textContent = logged ? state.user.name : "Гость";
    els.sessionEmail.textContent = logged ? state.user.email : "Вход нужен для работы";
    els.sessionAvatar.textContent = initials(logged ? state.user.name : "K");
    els.sessionRole.hidden = !logged;
    els.sessionRole.textContent = logged ? roleLabel(state.user.role) : "";
    els.sessionActions.hidden = !logged;

    if (!logged) {
      els.sessionNote.textContent = "Войди, чтобы открыть команды и очередь проверки.";
      return;
    }

    if (state.user.role === "reader") {
      els.sessionNote.textContent = "Читательский аккаунт. Доступ к студии выдаёт администратор.";
    } else if (state.user.role === "moderator") {
      els.sessionNote.textContent = "Очередь проверки открыта. Студия переводчика недоступна.";
    } else if (state.user.role === "admin") {
      els.sessionNote.textContent = "Администратор: студия и очередь открыты полностью.";
    } else {
      els.sessionNote.textContent = "Команды, черновики и отправка глав открыты.";
    }
  }

  function renderTabs() {
    var studio = canStudio();
    var moderation = canModerate();
    els.tabStudio.hidden = !studio;
    els.tabModeration.hidden = !moderation;
    els.tabs.hidden = !(studio && moderation);
  }

  function defaultTab() {
    var hash = String(window.location.hash || "").replace("#", "");
    if (hash === "moderation" && canModerate()) return "moderation";
    if (hash === "studio" && canStudio()) return "studio";
    if (canModerate() && !canStudio()) return "moderation";
    return "studio";
  }

  function setTab(name, silent) {
    var next = name;
    if (next === "studio" && !canStudio()) next = canModerate() ? "moderation" : "studio";
    if (next === "moderation" && !canModerate()) next = canStudio() ? "studio" : "moderation";
    state.activeTab = next;

    els.panelStudio.hidden = next !== "studio" || !canStudio();
    els.panelModeration.hidden = next !== "moderation" || !canModerate();

    els.tabStudio.classList.toggle("is-active", next === "studio");
    els.tabModeration.classList.toggle("is-active", next === "moderation");
    els.tabStudio.setAttribute("aria-selected", String(next === "studio"));
    els.tabModeration.setAttribute("aria-selected", String(next === "moderation"));
    els.tabStudio.tabIndex = next === "studio" ? 0 : -1;
    els.tabModeration.tabIndex = next === "moderation" ? 0 : -1;

    if (!silent) {
      try {
        var url = new URL(window.location.href);
        url.hash = canStudio() && canModerate() ? next : "";
        window.history.replaceState(null, "", url);
      } catch (error) {}
    }

    if (next === "moderation" && canModerate() && !state.queueLoaded) loadQueue();
  }

  function renderAccess() {
    var logged = isLoggedIn();
    var reader = logged && !hasAccess();

    els.auth.hidden = logged;
    els.denied.hidden = !reader;
    els.workspace.hidden = !(logged && hasAccess());

    if (reader) {
      els.deniedText.textContent = "Твой аккаунт — " + roleLabel(state.user.role) +
        ". Студия открывается переводчикам и модераторам; роль выдаёт администратор. Каталог и читалка работают как обычно.";
    }

    renderSession();

    if (!logged || !hasAccess()) {
      els.tabs.hidden = true;
      return;
    }

    renderTabs();
    setTab(defaultTab(), true);
  }

  function setAuthMode(mode) {
    state.authMode = mode === "register" ? "register" : "login";
    var register = state.authMode === "register";

    els.nameField.hidden = !register;
    els.authName.required = register;
    els.authPassword.autocomplete = register ? "new-password" : "current-password";
    els.authSubmit.textContent = register ? "Создать аккаунт" : "Войти";

    els.authModes.forEach(function (button) {
      var active = button.getAttribute("data-auth-mode") === state.authMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    setStatus(els.authStatus, "");
  }

  /* -------------------------------------------------------------------------
     Bootstrap
     ------------------------------------------------------------------------- */
  function bindAutoSlug(nameInput, slugInput) {
    if (!nameInput || !slugInput) return;
    nameInput.addEventListener("input", function () {
      if (slugInput.getAttribute("data-manual") === "1") return;
      slugInput.value = slugify(nameInput.value).slice(0, Number(slugInput.maxLength) || 120);
    });
    slugInput.addEventListener("input", function () {
      if (slugInput.value.trim()) slugInput.setAttribute("data-manual", "1");
      else slugInput.removeAttribute("data-manual");
    });
  }

  function bind() {
    els.authModes.forEach(function (button) {
      button.addEventListener("click", function () {
        setAuthMode(button.getAttribute("data-auth-mode"));
        if (state.authMode === "register") els.authName.focus();
        else els.authEmail.focus();
      });
    });

    els.authForm.addEventListener("submit", onAuthSubmit);
    els.teamForm.addEventListener("submit", onTeamSubmit);
    els.titleForm.addEventListener("submit", onTitleSubmit);
    els.chapterForm.addEventListener("submit", onChapterSubmit);

    [els.teamForm, els.titleForm, els.chapterForm].forEach(function (form) {
      form.addEventListener("input", clearOneFieldError);
      form.addEventListener("change", clearOneFieldError);
    });

    els.refreshSession.addEventListener("click", onRefreshSession);
    els.logout.addEventListener("click", onLogout);
    els.deniedLogout.addEventListener("click", onLogout);

    els.tabs.addEventListener("click", function (event) {
      var button = event.target.closest("[data-studio-tab]");
      if (button) setTab(button.getAttribute("data-studio-tab"), false);
    });
    els.tabs.addEventListener("keydown", function (event) {
      if (["ArrowRight", "ArrowLeft", "Home", "End"].indexOf(event.key) === -1) return;
      var available = [];
      if (canStudio()) available.push("studio");
      if (canModerate()) available.push("moderation");
      if (available.length < 2) return;
      event.preventDefault();
      var index = available.indexOf(state.activeTab);
      var next = index;
      if (event.key === "ArrowRight") next = (index + 1) % available.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + available.length) % available.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = available.length - 1;
      setTab(available[next], false);
      (available[next] === "studio" ? els.tabStudio : els.tabModeration).focus();
    });

    els.refreshLibrary.addEventListener("click", function () { loadTitles(); });
    els.refreshQueue.addEventListener("click", function () { loadQueue(); });

    els.libraryList.addEventListener("click", function (event) {
      var open = event.target.closest("[data-open-chapter]");
      if (open) {
        openChapter(open.getAttribute("data-open-chapter"));
        return;
      }
      var add = event.target.closest("[data-add-chapter]");
      if (add) {
        focusChapterForm(add.getAttribute("data-add-chapter"));
      }
    });

    els.workbenchClose.addEventListener("click", closeWorkbench);
    els.files.addEventListener("change", function () {
      addFiles(els.files.files);
      els.files.value = "";
    });
    ["dragenter", "dragover"].forEach(function (name) {
      els.dropzone.addEventListener(name, function (event) {
        event.preventDefault();
        els.dropzone.classList.add("is-dragging");
      });
    });
    ["dragleave", "dragend"].forEach(function (name) {
      els.dropzone.addEventListener(name, function () {
        els.dropzone.classList.remove("is-dragging");
      });
    });
    els.dropzone.addEventListener("drop", function (event) {
      event.preventDefault();
      els.dropzone.classList.remove("is-dragging");
      if (event.dataTransfer && event.dataTransfer.files) addFiles(event.dataTransfer.files);
    });

    els.picksGrid.addEventListener("click", function (event) {
      var remove = event.target.closest("[data-pick-id]");
      if (remove) removePick(remove.getAttribute("data-pick-id"));
    });
    els.clearPicks.addEventListener("click", clearPicks);
    els.upload.addEventListener("click", uploadPages);
    els.submit.addEventListener("click", submitChapter);

    els.queueList.addEventListener("click", function (event) {
      var action = event.target.closest("[data-queue-action]");
      if (!action) return;
      var card = action.closest("[data-chapter-id]");
      if (card) decide(card, action.getAttribute("data-queue-action"));
    });
    els.queueList.addEventListener("input", function (event) {
      var note = event.target.closest("[data-queue-note]");
      if (!note) return;
      var card = note.closest("[data-chapter-id]");
      if (!card) return;
      state.notes.set(card.getAttribute("data-chapter-id"), note.value);
      var error = card.querySelector("[data-queue-error]");
      if (error) error.textContent = "";
      note.closest(".studio-field").classList.remove("has-error");
    });

    els.chapterForm.addEventListener("change", function (event) {
      if (event.target.name === "titleSlug") updateNextChapterNumber();
    });

    bindAutoSlug(els.teamForm.elements.namedItem("name"), els.teamForm.elements.namedItem("slug"));
    bindAutoSlug(els.titleForm.elements.namedItem("title"), els.titleForm.elements.namedItem("slug"));

    window.addEventListener("hashchange", function () {
      if (!hasAccess()) return;
      var hash = String(window.location.hash || "").replace("#", "");
      if (hash === "studio" || hash === "moderation") setTab(hash, true);
    });
  }

  function clearOneFieldError(event) {
    var wrapper = event.target.closest(".studio-field");
    if (!wrapper) return;
    wrapper.classList.remove("has-error");
    var error = wrapper.querySelector("[data-error]");
    if (error) error.textContent = "";
  }

  async function init() {
    cacheElements();
    els.apiBase.textContent = state.api;
    bind();
    setAuthMode("login");
    renderAccess();
    checkHealth();

    if (!state.token && state.user) {
      state.user = null;
      writeUser(null);
    }

    if (!state.token) return;

    try {
      await refreshMe();
    } catch (error) {
      if (error.status === 401) {
        clearSession();
      } else {
        toast("Не удалось проверить сессию: " + error.message);
      }
    }

    renderAccess();
    if (hasAccess()) await loadWorkspace();
  }

  function cacheElements() {
    [
      "studio-api-dot", "studio-api-text", "studio-api-base",
      "studio-session-body", "studio-session-name", "studio-session-email",
      "studio-session-role", "studio-session-note", "studio-session-actions",
      "studio-refresh-session", "studio-logout",
      "studio-auth", "studio-auth-form", "studio-auth-name", "studio-auth-email",
      "studio-auth-password", "studio-auth-submit", "studio-auth-status",
      "studio-name-field", "studio-denied", "studio-denied-text", "studio-denied-logout",
      "studio-workspace", "studio-tabs", "studio-tab-studio", "studio-tab-moderation",
      "studio-queue-count", "studio-panel-studio", "studio-panel-moderation",
      "studio-workbench", "studio-workbench-title", "studio-workbench-meta",
      "studio-workbench-close", "studio-workbench-note", "studio-pages",
      "studio-pages-count", "studio-pages-empty", "studio-pages-note", "studio-dropzone", "studio-files",
      "studio-picks", "studio-picks-grid", "studio-clear-picks", "studio-upload",
      "studio-submit", "studio-workbench-status", "studio-progress",
      "studio-library-state", "studio-library-list", "studio-library-empty",
      "studio-refresh-library", "studio-stat-titles", "studio-stat-chapters",
      "studio-stat-review", "studio-team-form", "studio-team-status",
      "studio-title-form", "studio-title-status",
      "studio-chapter-form", "studio-chapter-status", "studio-chapter-hint",
      "studio-queue-state", "studio-queue-list", "studio-queue-empty",
      "studio-queue-total", "studio-refresh-queue"
    ].forEach(function (id) {
      var key = id.replace(/^studio-/, "").replace(/-([a-z])/g, function (_, letter) {
        return letter.toUpperCase();
      });
      els[key] = el(id);
    });

    els.sessionBody = el("studio-session-body");
    els.sessionAvatar = els.sessionBody.querySelector(".studio-session__avatar");
    els.teamForm = el("studio-team-form");
    els.titleForm = el("studio-title-form");
    els.chapterForm = el("studio-chapter-form");
    els.authModes = Array.prototype.slice.call(document.querySelectorAll("[data-auth-mode]"));
  }

  /* -------------------------------------------------------------------------
     Health
     ------------------------------------------------------------------------- */
  async function checkHealth() {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 4000);
    try {
      var response = await fetch(state.api + "/health", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("health");
      els.apiDot.setAttribute("data-state", "online");
      els.apiText.textContent = "API отвечает";
    } catch (error) {
      els.apiDot.setAttribute("data-state", "offline");
      els.apiText.textContent = "API не отвечает";
    } finally {
      window.clearTimeout(timer);
    }
  }

  /* -------------------------------------------------------------------------
     Auth
     ------------------------------------------------------------------------- */
  async function onAuthSubmit(event) {
    event.preventDefault();
    var register = state.authMode === "register";
    var name = els.authName.value.trim();
    var email = els.authEmail.value.trim();
    var password = els.authPassword.value;

    setStatus(els.authStatus, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus(els.authStatus, "Укажи корректный email.", "error");
      els.authEmail.focus();
      return;
    }
    if (password.length < 6) {
      setStatus(els.authStatus, "Пароль должен быть не короче 6 символов.", "error");
      els.authPassword.focus();
      return;
    }
    if (register && name.length < 2) {
      setStatus(els.authStatus, "Имя: от 2 символов.", "error");
      els.authName.focus();
      return;
    }

    await runForm(els.authForm, register ? "Создаём…" : "Входим…", async function () {
      try {
        var data = await request(register ? "/register" : "/login", {
          method: "POST",
          body: JSON.stringify({ name: name, email: email, password: password })
        });
        setSession(data.token, data.user);
        els.authPassword.value = "";
        renderAccess();

        if (hasAccess()) {
          toast(register ? "Аккаунт создан. Студия открыта." : "Ты вошёл в студию.");
          await loadWorkspace();
        } else {
          toast(register
            ? "Аккаунт создан. Роль выдаёт администратор."
            : "Ты вошёл. Доступ к студии пока закрыт.");
        }
      } catch (error) {
        if (handleAuthError(error)) return;
        setStatus(els.authStatus, error.message, "error");
      }
    });
  }

  async function onLogout() {
    try {
      if (state.token) await request("/logout", { method: "POST" });
    } catch (error) {}
    clearSession();
    resetWorkspaceData();
    renderAccess();
    els.authForm.reset();
    els.authName.value = "";
    els.authEmail.value = "";
    els.authPassword.value = "";
    setAuthMode("login");
    toast("Ты вышел из студии.");
  }

  async function onRefreshSession() {
    var button = els.refreshSession;
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "Обновляем…";
    try {
      await refreshMe();
      renderAccess();
      if (hasAccess()) {
        await loadWorkspace();
        toast("Роль: " + roleLabel(state.user.role) + ".");
      } else {
        toast("Роль: " + roleLabel(state.user ? state.user.role : "reader") + ". Доступ к студии закрыт.");
      }
    } catch (error) {
      if (!handleAuthError(error)) toast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Обновить роль";
    }
  }

  /* -------------------------------------------------------------------------
     Workspace loading
     ------------------------------------------------------------------------- */
  async function loadWorkspace() {
    if (!hasAccess()) return;
    var tasks = [];
    if (canStudio()) {
      tasks.push((async function () {
        await loadTeams();
        await loadTitles();
      })());
    }
    if (canModerate()) tasks.push(loadQueue());
    await Promise.allSettled(tasks);
  }

  async function loadTeams() {
    try {
      var data = await request("/teams");
      state.teams = Array.isArray(data.teams) ? data.teams : [];
      populateTeamSelect();
      updateChapterHint();
    } catch (error) {
      if (handleAuthError(error)) return;
      toast("Команды не загрузились: " + error.message);
      updateChapterHint();
    }
  }

  function populateTeamSelect() {
    var select = field(els.chapterForm, "teamId");
    if (!select) return;
    var current = select.value;
    if (!state.teams.length) {
      select.innerHTML = '<option value="">Сначала создай команду</option>';
      select.value = "";
      return;
    }
    select.innerHTML = state.teams.map(function (team) {
      var suffix = team.status === "active" ? "" : " (заблокирована)";
      return '<option value="' + escapeHTML(team.id) + '"' +
        (team.status === "active" ? "" : " disabled") + ">" +
        escapeHTML(team.name) + escapeHTML(suffix) + "</option>";
    }).join("");
    if (current && state.teams.some(function (team) { return team.id === current && team.status === "active"; })) {
      select.value = current;
    } else {
      var active = state.teams.find(function (team) { return team.status === "active"; });
      select.value = active ? active.id : "";
    }
  }

  function isMyTitle(title) {
    if (!state.user) return false;
    if (state.user.role === "admin") return true;
    if (title.createdBy === state.user.id) return true;
    var teamIds = new Set(state.teams.map(function (team) { return team.id; }));
    return (title.chapters || []).some(function (chapter) {
      return (chapter.versions || []).some(function (version) { return teamIds.has(version.teamId); });
    });
  }

  function canAddChapter(title) {
    if (!state.user) return false;
    if (state.user.role === "admin") return true;
    if (title.createdBy === state.user.id) return true;
    return title.status === "published" && state.teams.length > 0;
  }

  async function loadTitles() {
    var requestId = state.titlesRequest + 1;
    state.titlesRequest = requestId;
    els.refreshLibrary.classList.add("is-busy");
    els.refreshLibrary.disabled = true;
    setStatus(els.libraryState, "Загружаем тайтлы…", "muted");

    try {
      var data = await request("/titles?status=all");
      var summaries = Array.isArray(data.titles) ? data.titles : [];
      var details = await Promise.all(summaries.map(async function (summary) {
        try {
          var detail = await request("/titles/" + encodeURIComponent(summary.slug));
          return Object.assign({}, summary, detail.title || {}, {
            chapters: Array.isArray(detail.chapters) ? detail.chapters : []
          });
        } catch (error) {
          return Object.assign({}, summary, { chapters: [] });
        }
      }));

      if (requestId !== state.titlesRequest) return;
      state.titles = details;
      renderLibrary();
      populateTitleSelect();
      updateChapterHint();
      if (state.activeChapterId) renderWorkbench();
      setStatus(els.libraryState, "");
    } catch (error) {
      if (handleAuthError(error)) return;
      if (requestId !== state.titlesRequest) return;
      setStatus(els.libraryState, "Не удалось загрузить тайтлы. " + error.message, "error");
      els.libraryEmpty.hidden = true;
    } finally {
      if (requestId === state.titlesRequest) {
        els.refreshLibrary.classList.remove("is-busy");
        els.refreshLibrary.disabled = false;
      }
    }
  }

  function visibleTitles() {
    return state.titles.filter(isMyTitle);
  }

  function renderLibrary() {
    var titles = visibleTitles();
    var chapterCount = 0;
    var reviewCount = 0;

    titles.forEach(function (title) {
      (title.chapters || []).forEach(function (chapter) {
        chapterCount += 1;
        var version = latestVersion(chapter);
        if (version && version.status === "review") reviewCount += 1;
        else if (!version && chapter.status === "review") reviewCount += 1;
      });
    });

    els.statTitles.textContent = String(titles.length);
    els.statChapters.textContent = String(chapterCount);
    els.statReview.textContent = String(reviewCount);

    els.libraryEmpty.hidden = titles.length > 0;
    if (!titles.length) {
      els.libraryList.innerHTML = "";
      return;
    }

    els.libraryList.innerHTML = titles.map(renderTitle).join("");
  }

  function latestVersion(chapter) {
    if (!chapter || !Array.isArray(chapter.versions) || !chapter.versions.length) return null;
    return chapter.versions[chapter.versions.length - 1];
  }

  function statusClass(status) {
    return "studio-status-chip--" + String(status || "draft").replace(/[^a-z_]/g, "");
  }

  function renderTitle(title) {
    var chapters = (title.chapters || []).slice().sort(function (left, right) {
      return Number(right.number) - Number(left.number);
    });
    var publishedCount = chapters.filter(function (chapter) { return chapter.status === "published"; }).length;
    var mark = String(title.titleRu || title.slug || "K").trim().charAt(0).toUpperCase();

    var rows = chapters.map(function (chapter) {
      var version = latestVersion(chapter);
      var status = version ? version.status : chapter.status;
      var teamName = version && version.team ? version.team.name : "—";
      var pages = version ? Number(version.pageCount || 0) : 0;
      var note = "";
      if (version && version.reviewNote && (status === "changes_requested" || status === "rejected")) {
        note = '<p class="studio-chapter__note">' + escapeHTML(version.reviewNote) + "</p>";
      }
      var readLink = status === "published"
        ? '<a class="studio-link" href="reader.html?chapterId=' + encodeURIComponent(chapter.id) +
          "&api=" + encodeURIComponent(state.api) +
          "&titleSlug=" + encodeURIComponent(title.slug) + '">Читать</a>'
        : "";
      return [
        '<div class="studio-chapter">',
        '<span class="studio-chapter__number">', escapeHTML(chapter.number), "</span>",
        '<div class="studio-chapter__body">',
        "<b>", escapeHTML(chapter.name || "Без названия"), "</b>",
        "<span>", escapeHTML(teamName), " · ", pages, " ", plural(pages, ["страница", "страницы", "страниц"]), "</span>",
        note,
        "</div>",
        '<div class="studio-chapter__side">',
        '<span class="studio-status-chip ', statusClass(status), '">', escapeHTML(statusLabel(status)), "</span>",
        readLink,
        '<button class="studio-link" type="button" data-open-chapter="', escapeHTML(chapter.id), '">Открыть</button>',
        "</div>",
        "</div>"
      ].join("");
    }).join("");

    return [
      '<article class="studio-title">',
      '<div class="studio-title__head">',
      '<span class="studio-title__mark" aria-hidden="true">', escapeHTML(mark), "</span>",
      '<div class="studio-title__body">',
      "<h3>", escapeHTML(title.titleRu || title.slug), "</h3>",
      "<p>", escapeHTML(title.slug), " · ", escapeHTML(typeLabel(title.type)), " · ", escapeHTML(title.ageRating || 0), "+</p>",
      "</div>",
      '<span class="studio-status-chip studio-title__status ', statusClass(title.status), '">', escapeHTML(statusLabel(title.status)), "</span>",
      "</div>",
      '<div class="studio-title__meta">',
      "<span>Права: <b>", escapeHTML(rightsLabel(title.rightsStatus)), "</b></span>",
      "<span>Глав: <b>", chapters.length, "</b></span>",
      "<span>Опубликовано: <b>", publishedCount, "</b></span>",
      title.status === "published"
        ? '<a class="studio-link" href="' + escapeHTML(titlePageHref(title.slug)) + '">Открыть страницу тайтла</a>'
        : "",
      canAddChapter(title)
        ? '<button class="studio-link" type="button" data-add-chapter="' + escapeHTML(title.slug) + '">Добавить главу</button>'
        : "",
      "</div>",
      chapters.length ? '<div class="studio-chapters">' + rows + "</div>" : '<p class="studio-note studio-note--tight">Глав пока нет.</p>',
      "</article>"
    ].join("");
  }

  function populateTitleSelect() {
    var select = field(els.chapterForm, "titleSlug");
    if (!select) return;
    var titles = visibleTitles().filter(canAddChapter);
    var current = select.value;

    if (!titles.length) {
      select.innerHTML = '<option value="">Сначала создай тайтл</option>';
      select.value = "";
      updateNextChapterNumber();
      return;
    }

    select.innerHTML = titles.map(function (title) {
      return '<option value="' + escapeHTML(title.slug) + '">' +
        escapeHTML(title.titleRu || title.slug) + "</option>";
    }).join("");

    if (current && titles.some(function (title) { return title.slug === current; })) {
      select.value = current;
    } else {
      select.value = titles[0].slug;
    }
    updateNextChapterNumber();
  }

  function findTitleBySlug(slug) {
    return state.titles.find(function (title) { return title.slug === slug; }) || null;
  }

  function updateNextChapterNumber() {
    var select = field(els.chapterForm, "titleSlug");
    var numberInput = field(els.chapterForm, "number");
    if (!select || !numberInput) return;
    var title = findTitleBySlug(select.value);
    var next = 1;
    if (title && Array.isArray(title.chapters) && title.chapters.length) {
      var highest = 0;
      title.chapters.forEach(function (chapter) {
        highest = Math.max(highest, Number(chapter.number) || 0);
      });
      next = Math.round((highest + 1) * 100) / 100;
    }
    numberInput.value = String(next);
  }

  function updateChapterHint() {
    if (!els.chapterHint) return;
    if (!state.teams.length) {
      els.chapterHint.textContent = "Сначала создай команду: без неё главу некуда привязать.";
    } else if (!visibleTitles().filter(canAddChapter).length) {
      els.chapterHint.textContent = "Сначала создай тайтл — он станет основой главы.";
    } else {
      els.chapterHint.textContent = "Номер можно оставить предложенным: он следующий после последней главы.";
    }
  }

  function focusChapterForm(slug) {
    var select = field(els.chapterForm, "titleSlug");
    if (select) select.value = slug;
    updateNextChapterNumber();
    els.chapterForm.scrollIntoView({ behavior: "smooth", block: "center" });
    var number = field(els.chapterForm, "number");
    if (number) window.setTimeout(function () { number.focus(); }, 320);
  }

  /* -------------------------------------------------------------------------
     Team, title and chapter forms
     ------------------------------------------------------------------------- */
  async function onTeamSubmit(event) {
    event.preventDefault();
    var form = els.teamForm;
    var name = value(form, "name");
    var slug = value(form, "slug").toLowerCase();
    clearFieldErrors(form);
    setStatus(els.teamStatus, "");

    var fields = {};
    if (name.length < 2) fields.name = "Название: от 2 символов.";
    if (!/^[a-z0-9-]{3,64}$/.test(slug)) fields.slug = "Slug: 3–64 символа, только a-z, 0-9 и дефис.";
    if (Object.keys(fields).length) {
      showFieldErrors(form, fields);
      setStatus(els.teamStatus, "Проверь поля команды.", "error");
      return;
    }

    await runForm(form, "Создаём…", async function () {
      try {
        var data = await request("/teams", {
          method: "POST",
          body: JSON.stringify({ name: name, slug: slug })
        });
        form.reset();
        form.elements.namedItem("slug").removeAttribute("data-manual");
        setStatus(els.teamStatus, "Команда создана.", "success");
        toast("Команда создана.");
        await loadTeams();
        if (data.team) {
          var teamSelect = field(els.chapterForm, "teamId");
          if (teamSelect) teamSelect.value = data.team.id;
        }
        updateChapterHint();
      } catch (error) {
        if (handleAuthError(error)) return;
        showFieldErrors(form, error.fields);
        setStatus(els.teamStatus, error.message, "error");
      }
    });
  }

  function titlePayload(form) {
    return {
      slug: value(form, "slug").toLowerCase(),
      title: value(form, "title"),
      originalTitle: value(form, "originalTitle"),
      type: value(form, "type"),
      description: value(form, "description"),
      rightsStatus: value(form, "rightsStatus"),
      rightsHolder: value(form, "rightsHolder"),
      license: value(form, "license"),
      licenseUrl: value(form, "licenseUrl"),
      sourceUrl: value(form, "sourceUrl"),
      ageRating: Number(value(form, "ageRating") || 0)
    };
  }

  async function onTitleSubmit(event) {
    event.preventDefault();
    var form = els.titleForm;
    var payload = titlePayload(form);
    clearFieldErrors(form);
    setStatus(els.titleStatus, "");

    var fields = {};
    if (!/^[a-z0-9-]{3,120}$/.test(payload.slug)) fields.slug = "Slug: 3–120 символов, только a-z, 0-9 и дефис.";
    if (!payload.title) fields.title = "Название обязательно.";
    if (!isHttpUrl(payload.sourceUrl)) fields.sourceUrl = "Ссылка должна начинаться с http:// или https://.";
    if (!isHttpUrl(payload.licenseUrl)) fields.licenseUrl = "Ссылка должна начинаться с http:// или https://.";
    if (Object.keys(fields).length) {
      showFieldErrors(form, fields);
      setStatus(els.titleStatus, "Проверь поля тайтла.", "error");
      return;
    }

    ["originalTitle", "description", "rightsHolder", "license", "licenseUrl", "sourceUrl"].forEach(function (key) {
      if (!payload[key]) delete payload[key];
    });

    await runForm(form, "Создаём…", async function () {
      try {
        var data = await request("/titles", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        var createdSlug = data.title ? data.title.slug : payload.slug;
        form.reset();
        form.elements.namedItem("slug").removeAttribute("data-manual");
        setStatus(els.titleStatus, "Тайтл создан. Теперь можно добавить главу.", "success");
        toast("Тайтл создан.");
        await loadTitles();
        var titleSelect = field(els.chapterForm, "titleSlug");
        if (titleSelect && findTitleBySlug(createdSlug)) titleSelect.value = createdSlug;
        updateNextChapterNumber();
        updateChapterHint();
      } catch (error) {
        if (handleAuthError(error)) return;
        showFieldErrors(form, error.fields);
        setStatus(els.titleStatus, error.message, "error");
      }
    });
  }

  async function onChapterSubmit(event) {
    event.preventDefault();
    var form = els.chapterForm;
    var slug = value(form, "titleSlug");
    var teamId = value(form, "teamId");
    var number = Number(value(form, "number"));
    var name = value(form, "title");
    clearFieldErrors(form);
    setStatus(els.chapterStatus, "");

    var fields = {};
    if (!slug) fields.titleSlug = "Выбери тайтл.";
    if (!teamId) fields.teamId = "Выбери команду.";
    if (!Number.isFinite(number) || number <= 0) fields.number = "Номер: число больше нуля.";
    if (Object.keys(fields).length) {
      showFieldErrors(form, fields);
      setStatus(els.chapterStatus, "Проверь поля главы.", "error");
      return;
    }

    await runForm(form, "Создаём…", async function () {
      try {
        var data = await request("/titles/" + encodeURIComponent(slug) + "/chapters", {
          method: "POST",
          body: JSON.stringify({ number: number, title: name, teamId: teamId })
        });
        var chapter = data.chapter;
        form.elements.namedItem("title").value = "";
        setStatus(els.chapterStatus, "Глава создана. Загрузи страницы.", "success");
        toast("Глава создана.");
        if (chapter) {
          upsertChapter(slug, chapter);
          renderLibrary();
          populateTitleSelect();
          updateNextChapterNumber();
          openChapter(chapter.id);
        }
        loadTitles();
      } catch (error) {
        if (handleAuthError(error)) return;
        showFieldErrors(form, error.fields);
        setStatus(els.chapterStatus, error.message, "error");
      }
    });
  }

  function upsertChapter(slug, chapter) {
    var title = findTitleBySlug(slug);
    if (!title) return;
    if (!Array.isArray(title.chapters)) title.chapters = [];
    var index = title.chapters.findIndex(function (item) { return item.id === chapter.id; });
    if (index >= 0) title.chapters[index] = chapter;
    else title.chapters.push(chapter);
  }

  function findChapter(chapterId) {
    if (!chapterId) return null;
    for (var index = 0; index < state.titles.length; index += 1) {
      var title = state.titles[index];
      var chapter = (title.chapters || []).find(function (item) { return item.id === chapterId; });
      if (chapter) {
        return { title: title, chapter: chapter, version: latestVersion(chapter) };
      }
    }
    return null;
  }

  /* -------------------------------------------------------------------------
     Workbench
     ------------------------------------------------------------------------- */
  function editableStatus(status) {
    return status === "draft" || status === "changes_requested";
  }

  function renderWorkbench() {
    var found = findChapter(state.activeChapterId);
    if (!found) {
      els.workbench.hidden = true;
      return;
    }

    var title = found.title;
    var chapter = found.chapter;
    var version = found.version;
    var status = version ? version.status : chapter.status;
    var editable = editableStatus(status);
    var pages = state.activePages.length;

    els.workbench.hidden = false;
    els.workbenchTitle.textContent = chapter.name || ("Глава " + chapter.number);
    els.workbenchMeta.innerHTML = [
      '<span class="studio-status-chip">', escapeHTML(title.titleRu || title.slug), "</span>",
      '<span class="studio-badge">глава ', escapeHTML(chapter.number), "</span>",
      version && version.team ? '<span class="studio-badge">' + escapeHTML(version.team.name) + "</span>" : "",
      '<span class="studio-status-chip ', statusClass(status), '">', escapeHTML(statusLabel(status)), "</span>",
      '<span class="studio-badge">', pages, " ", plural(pages, ["страница", "страницы", "страниц"]), "</span>",
      status === "published"
        ? '<a class="studio-link" href="' + escapeHTML(titlePageHref(title.slug)) + '">Открыть страницу тайтла</a>'
        : ""
    ].join("");

    var noteHTML = "";
    var noteClass = "studio-callout";
    if (status === "review") {
      noteHTML = "<b>На проверке.</b> Отправлено " + escapeHTML(formatDate(version && version.submittedAt)) +
        ". Страницы и повторная отправка заблокированы до решения.";
    } else if (status === "published") {
      noteClass += " studio-callout--success";
      noteHTML = "<b>Опубликовано.</b> Глава видна читателям" +
        (chapter.publishedAt ? " с " + escapeHTML(formatDate(chapter.publishedAt)) : "") +
        ". Менять страницы в этом срезе уже нельзя.";
    } else if (status === "changes_requested") {
      noteHTML = "<b>Нужны правки.</b> " +
        escapeHTML((version && version.reviewNote) || "Модератор не оставил пояснение.") +
        " Замени страницы и отправь главу снова.";
    } else if (status === "rejected") {
      noteClass += " studio-callout--danger";
      noteHTML = "<b>Отклонено.</b> " +
        escapeHTML((version && version.reviewNote) || (version && version.rejectionReason) || "Причина не указана.") +
        " Повторная отправка в этом срезе недоступна.";
    }

    els.workbenchNote.className = noteClass;
    els.workbenchNote.innerHTML = noteHTML;
    els.workbenchNote.hidden = !noteHTML;

    els.pagesCount.textContent = pages + " " + plural(pages, ["страница", "страницы", "страниц"]);
    els.dropzone.hidden = !editable;
    els.pagesNote.hidden = !editable;
    els.upload.hidden = !editable;
    els.submit.hidden = !editable;
    els.dropzone.classList.toggle("is-disabled", state.workBusy || !editable);
    els.files.disabled = state.workBusy || !editable;
    els.upload.disabled = state.workBusy || !editable || state.picks.length === 0;
    els.submit.disabled = state.workBusy || !editable || pages === 0;
    els.upload.textContent = state.workBusy ? "Загружаем…" : "Загрузить страницы";
    els.submit.textContent = state.workBusy ? "Подожди…" : "Отправить на проверку";

    els.upload.title = !editable
      ? "Страницы меняются только в черновике или после запроса правок."
      : (state.picks.length ? "" : "Сначала выбери страницы.");
    els.submit.title = !editable
      ? "Отправить можно черновик или главу с запрошенными правками."
      : (pages === 0 ? "Сначала загрузи хотя бы одну страницу." : "");

    renderPages();
    renderPicks();
  }

  function renderPages() {
    els.pagesEmpty.hidden = state.activePages.length > 0;
    els.pages.innerHTML = state.activePages.map(function (page) {
      var src = assetUrl(page.imageKey);
      return [
        '<figure class="studio-thumb">',
        '<a href="', escapeHTML(src), '" target="_blank" rel="noopener noreferrer">',
        '<img src="', escapeHTML(src), '" alt="Страница ', escapeHTML(page.pageNumber), '" loading="lazy">',
        "</a>",
        '<figcaption title="', escapeHTML(page.name), '">', escapeHTML(page.pageNumber), " · ", escapeHTML(page.name), "</figcaption>",
        "</figure>"
      ].join("");
    }).join("");
  }

  function renderPicks() {
    els.picks.hidden = state.picks.length === 0 || els.dropzone.hidden;
    els.clearPicks.disabled = state.picks.length === 0;
    els.picksGrid.innerHTML = state.picks.map(function (pick) {
      return [
        '<figure class="studio-thumb studio-thumb--pick">',
        '<img src="', escapeHTML(pick.url), '" alt="">',
        '<button class="studio-thumb__remove" type="button" data-pick-id="', escapeHTML(pick.id),
        '" aria-label="Убрать ', escapeHTML(pick.file.name), '">×</button>',
        '<figcaption title="', escapeHTML(pick.file.name), '">', escapeHTML(pick.file.name), "</figcaption>",
        "</figure>"
      ].join("");
    }).join("");
  }

  function openChapter(chapterId) {
    var found = findChapter(chapterId);
    if (!found) return;
    state.activeChapterId = chapterId;
    state.activePages = [];
    clearPicks();
    setStatus(els.workbenchStatus, "");
    renderWorkbench();
    els.workbench.scrollIntoView({ behavior: "smooth", block: "start" });
    loadPages(chapterId);
  }

  function closeWorkbench() {
    state.activeChapterId = null;
    state.activePages = [];
    state.workBusy = false;
    clearPicks();
    setStatus(els.workbenchStatus, "");
    els.workbench.hidden = true;
  }

  async function loadPages(chapterId) {
    try {
      var data = await request("/chapters/" + encodeURIComponent(chapterId) + "/pages");
      if (state.activeChapterId !== chapterId) return;
      state.activePages = Array.isArray(data.pages) ? data.pages : [];
      var found = findChapter(chapterId);
      if (found && found.version) found.version.pageCount = state.activePages.length;
      renderWorkbench();
    } catch (error) {
      if (handleAuthError(error)) return;
      if (state.activeChapterId !== chapterId) return;
      setStatus(els.workbenchStatus, "Страницы не загрузились: " + error.message, "error");
    }
  }

  function detectMime(file) {
    var type = String(file.type || "").toLowerCase();
    if (type === "image/jpg") type = "image/jpeg";
    if (ALLOWED_TYPES.indexOf(type) !== -1) return type;
    var name = String(file.name || "").toLowerCase();
    if (/\.jpe?g$/.test(name)) return "image/jpeg";
    if (/\.png$/.test(name)) return "image/png";
    if (/\.webp$/.test(name)) return "image/webp";
    return "";
  }

  function addFiles(fileList) {
    var incoming = Array.prototype.slice.call(fileList || []);
    if (!incoming.length) return;
    var current = findChapter(state.activeChapterId);
    var currentStatus = current && current.version ? current.version.status : "draft";
    if (!editableStatus(currentStatus)) {
      setStatus(els.workbenchStatus, "Страницы меняются только в черновике или после запроса правок.", "error");
      return;
    }

    var added = 0;
    var problems = [];
    incoming.forEach(function (file) {
      if (state.picks.length >= MAX_FILES) {
        problems.push("В наборе не больше 100 страниц.");
        return;
      }
      var mime = detectMime(file);
      if (!mime) {
        problems.push(file.name + " — не JPEG, PNG или WebP.");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push(file.name + " — больше 10 МБ.");
        return;
      }
      var duplicate = state.picks.some(function (pick) {
        return pick.file.name === file.name &&
          pick.file.size === file.size &&
          pick.file.lastModified === file.lastModified;
      });
      if (duplicate) return;
      state.pickSeq += 1;
      state.picks.push({
        id: "pick-" + state.pickSeq,
        file: file,
        url: URL.createObjectURL(file)
      });
      added += 1;
    });

    renderWorkbench();
    if (problems.length) {
      setStatus(els.workbenchStatus, problems[0], "error");
    } else if (added) {
      setStatus(els.workbenchStatus, "К загрузке добавлено: " + added + " " +
        plural(added, ["страница", "страницы", "страниц"]) + ".", "success");
    }
  }

  function removePick(id) {
    var pick = state.picks.find(function (item) { return item.id === id; });
    if (!pick) return;
    try { URL.revokeObjectURL(pick.url); } catch (error) {}
    state.picks = state.picks.filter(function (item) { return item.id !== id; });
    renderWorkbench();
    setStatus(els.workbenchStatus, "Страница убрана из набора.", "muted");
  }

  function clearPicks() {
    state.picks.forEach(function (pick) {
      try { URL.revokeObjectURL(pick.url); } catch (error) {}
    });
    state.picks = [];
    if (els.picksGrid) renderPicks();
    if (els.workbench && !els.workbench.hidden) renderWorkbench();
  }

  function setProgress(value) {
    var percent = Math.max(0, Math.min(100, Math.round(value)));
    els.progress.hidden = false;
    els.progress.setAttribute("aria-valuenow", String(percent));
    els.progress.querySelector("span").style.width = percent + "%";
  }

  function hideProgressSoon() {
    window.setTimeout(function () {
      if (!state.workBusy) {
        els.progress.hidden = true;
        els.progress.setAttribute("aria-valuenow", "0");
        els.progress.querySelector("span").style.width = "0";
      }
    }, 800);
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Не удалось прочитать " + file.name + ".")); };
      reader.onload = function () {
        var bytes = new Uint8Array(reader.result);
        var binary = "";
        var chunk = 0x8000;
        for (var index = 0; index < bytes.length; index += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
        }
        resolve(window.btoa(binary));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async function uploadPages() {
    if (state.workBusy || !state.activeChapterId) return;
    var found = findChapter(state.activeChapterId);
    if (!found) return;
    var status = found.version ? found.version.status : found.chapter.status;
    if (!editableStatus(status)) {
      setStatus(els.workbenchStatus, "Эта версия уже не принимает новые страницы.", "error");
      return;
    }
    if (!state.picks.length) {
      setStatus(els.workbenchStatus, "Сначала выбери хотя бы одну страницу.", "error");
      return;
    }

    var chapterId = state.activeChapterId;
    var picks = state.picks.slice();
    state.workBusy = true;
    renderWorkbench();
    setStatus(els.workbenchStatus, "Читаем " + picks.length + " " + plural(picks.length, ["файл", "файла", "файлов"]) + "…");
    setProgress(2);

    try {
      var pages = [];
      for (var index = 0; index < picks.length; index += 1) {
        var pick = picks[index];
        var data = await fileToBase64(pick.file);
        pages.push({ name: pick.file.name, type: detectMime(pick.file), data: data });
        setProgress(Math.round(((index + 1) / picks.length) * 70));
      }

      setStatus(els.workbenchStatus, "Отправляем " + pages.length + " " + plural(pages.length, ["страницу", "страницы", "страниц"]) + "…");
      setProgress(75);
      var result = await request("/chapters/" + encodeURIComponent(chapterId) + "/pages", {
        method: "POST",
        body: JSON.stringify({ pages: pages })
      });

      if (state.activeChapterId !== chapterId) return;
      state.activePages = Array.isArray(result.pages) ? result.pages : [];
      var current = findChapter(chapterId);
      if (current && current.version) current.version.pageCount = state.activePages.length;
      clearPicks();
      setProgress(100);
      renderWorkbench();
      setStatus(els.workbenchStatus, "Загружено: " + state.activePages.length + " " +
        plural(state.activePages.length, ["страница", "страницы", "страниц"]) + ".", "success");
      toast("Страницы загружены.");
      hideProgressSoon();
      loadTitles();
    } catch (error) {
      if (handleAuthError(error)) return;
      setStatus(els.workbenchStatus, error.message, "error");
      toast(error.message);
      hideProgressSoon();
    } finally {
      state.workBusy = false;
      renderWorkbench();
    }
  }

  async function submitChapter() {
    if (state.workBusy || !state.activeChapterId) return;
    var found = findChapter(state.activeChapterId);
    if (!found) return;
    var status = found.version ? found.version.status : found.chapter.status;
    if (!editableStatus(status)) {
      setStatus(els.workbenchStatus, "Эту версию уже нельзя отправить.", "error");
      return;
    }
    if (!state.activePages.length) {
      setStatus(els.workbenchStatus, "Сначала загрузи хотя бы одну страницу.", "error");
      return;
    }

    var chapterId = state.activeChapterId;
    state.workBusy = true;
    renderWorkbench();
    setStatus(els.workbenchStatus, "Отправляем на проверку…", "muted");

    try {
      var data = await request("/chapters/" + encodeURIComponent(chapterId) + "/submit", { method: "POST" });
      if (data.chapter) {
        state.titles.forEach(function (entry) {
          var index = (entry.chapters || []).findIndex(function (chapter) { return chapter.id === data.chapter.id; });
          if (index >= 0) entry.chapters[index] = data.chapter;
        });
      }
      renderLibrary();
      renderWorkbench();
      setStatus(els.workbenchStatus, "Глава отправлена на проверку.", "success");
      toast("Глава отправлена на проверку.");
      loadTitles();
      if (canModerate()) loadQueue();
    } catch (error) {
      if (handleAuthError(error)) return;
      setStatus(els.workbenchStatus, error.message, "error");
      toast(error.message);
    } finally {
      state.workBusy = false;
      renderWorkbench();
    }
  }

  /* -------------------------------------------------------------------------
     Moderation queue
     ------------------------------------------------------------------------- */
  async function loadQueue() {
    if (!canModerate()) return;
    els.refreshQueue.classList.add("is-busy");
    els.refreshQueue.disabled = true;
    setStatus(els.queueState, "Загружаем очередь…", "muted");

    try {
      var data = await request("/moderation/queue");
      state.queue = Array.isArray(data.queue) ? data.queue : [];
      state.queueLoaded = true;
      renderQueue();
    } catch (error) {
      if (handleAuthError(error)) return;
      state.queue = [];
      state.queueLoaded = false;
      els.queueList.innerHTML = "";
      els.queueEmpty.hidden = true;
      setStatus(els.queueState, "Очередь не загрузилась. " + error.message, "error");
      updateQueueBadges();
    } finally {
      els.refreshQueue.classList.remove("is-busy");
      els.refreshQueue.disabled = false;
    }
  }

  function updateQueueBadges() {
    var count = state.queue.length;
    els.queueCount.hidden = count === 0;
    els.queueCount.textContent = String(count);
    els.queueTotal.textContent = count + " " + plural(count, ["глава", "главы", "глав"]) + " в очереди";
  }

  function renderQueue() {
    var queue = state.queue;
    updateQueueBadges();
    setStatus(els.queueState, "");
    els.queueEmpty.hidden = queue.length > 0;

    if (!queue.length) {
      els.queueList.innerHTML = "";
      return;
    }

    els.queueList.innerHTML = queue.map(renderQueueCard).join("");
  }

  function renderQueueCard(item) {
    var title = item.title || {};
    var chapter = item.chapter || {};
    var team = item.team || {};
    var author = item.submittedBy && item.submittedBy.name ? item.submittedBy.name : "—";
    var rights = title.rightsStatus || "unverified";
    var rightsWarning = rights === "unverified"
      ? '<p class="queue__warning">Публикация заблокирована: права не подтверждены. Верни на правки или отклони.</p>'
      : "";
    var note = state.notes.get(item.chapterId) || "";
    var previewPages = Array.isArray(item.previewPages) ? item.previewPages : [];

    var previews = previewPages.slice(0, 3).map(function (page) {
      var src = assetUrl(page.imageKey);
      return '<a class="queue__shot" href="' + escapeHTML(src) + '" target="_blank" rel="noopener noreferrer" title="' +
        escapeHTML(page.name) + '"><img src="' + escapeHTML(src) + '" alt="Страница ' +
        escapeHTML(page.pageNumber) + '" loading="lazy"></a>';
    }).join("");
    if (!previews) {
      previews = '<span class="queue__shot queue__shot--empty">Превью<br>нет</span>';
    }

    var rightsDetails = [];
    if (title.rightsHolder) rightsDetails.push("<span><b>Правообладатель:</b> " + escapeHTML(title.rightsHolder) + "</span>");
    if (title.licenseCode) rightsDetails.push("<span><b>Лицензия:</b> " + escapeHTML(title.licenseCode) + "</span>");
    if (title.licenseUrl && isHttpUrl(title.licenseUrl)) {
      rightsDetails.push('<span><b>Лицензия:</b> <a href="' + escapeHTML(title.licenseUrl) + '" target="_blank" rel="noopener noreferrer">открыть</a></span>');
    }
    if (title.sourceUrl && isHttpUrl(title.sourceUrl)) {
      rightsDetails.push('<span><b>Источник:</b> <a href="' + escapeHTML(title.sourceUrl) + '" target="_blank" rel="noopener noreferrer">открыть</a></span>');
    }
    if (!rightsDetails.length) rightsDetails.push("<span>Дополнительных сведений о правах нет.</span>");

    return [
      '<article class="queue__card" data-chapter-id="', escapeHTML(item.chapterId),
      '" data-version-id="', escapeHTML(item.versionId), '">',
      '<header class="queue__head">',
      '<div class="queue__title-block">',
      '<p class="queue__label">Глава ', escapeHTML(chapter.number), " · ", escapeHTML(typeLabel(title.type)), "</p>",
      "<h3>", escapeHTML(title.titleRu || "Без названия"), "</h3>",
      '<p class="queue__sub">',
      escapeHTML(chapter.name || "Без названия"), " · ", escapeHTML(team.name || "Без команды"), " · ", escapeHTML(author),
      "</p>",
      "</div>",
      '<span class="studio-status-chip studio-status-chip--review">на проверке</span>',
      "</header>",
      '<div class="queue__body">',
      '<div class="queue__preview">', previews, "</div>",
      '<div class="queue__side">',
      '<dl class="queue__facts">',
      "<div><dt>Тип</dt><dd>", escapeHTML(typeLabel(title.type)), "</dd></div>",
      "<div><dt>Возраст</dt><dd>", escapeHTML(title.ageRating || 0), "+</dd></div>",
      "<div><dt>Страниц</dt><dd>", escapeHTML(item.pageCount || 0), "</dd></div>",
      "<div><dt>Версия</dt><dd>", escapeHTML(item.version || 1), "</dd></div>",
      "<div><dt>Отправлено</dt><dd>", escapeHTML(formatDate(item.submittedAt)), "</dd></div>",
      "<div><dt>Автор</dt><dd>", escapeHTML(author), "</dd></div>",
      "</dl>",
      '<details class="queue__rights">',
      "<summary>Права и источник · ", escapeHTML(rightsLabel(rights)), "</summary>",
      '<div class="queue__rights-body">', rightsDetails.join(""), "</div>",
      "</details>",
      "</div>",
      "</div>",
      rightsWarning,
      '<label class="studio-field queue__note">',
      "<span>Комментарий для команды</span>",
      '<textarea data-queue-note maxlength="1000" placeholder="Что исправить или почему отказ">', escapeHTML(note), "</textarea>",
      '<small class="studio-field__error" data-queue-error></small>',
      "</label>",
      '<div class="queue__actions">',
      '<button class="btn btn--primary" type="button" data-queue-action="published"' +
        (rights === "unverified" ? ' disabled title="Права не подтверждены."' : "") + ">Опубликовать</button>",
      '<button class="btn btn--secondary" type="button" data-queue-action="changes_requested">Вернуть на правки</button>',
      '<button class="btn btn--danger" type="button" data-queue-action="rejected">Отклонить</button>',
      '<span class="studio-status" data-queue-status></span>',
      "</div>",
      "</article>"
    ].join("");
  }

  async function decide(card, action) {
    if (card.classList.contains("is-busy")) return;
    var chapterId = card.getAttribute("data-chapter-id");
    var item = state.queue.find(function (entry) { return entry.chapterId === chapterId; });
    if (!item) return;

    var noteField = card.querySelector("[data-queue-note]");
    var errorField = card.querySelector("[data-queue-error]");
    var statusField = card.querySelector("[data-queue-status]");
    var note = noteField ? noteField.value.trim() : "";

    if ((action === "changes_requested" || action === "rejected") && note.length < 2) {
      if (errorField) errorField.textContent = "Комментарий обязателен: команда должна понять, что исправить.";
      if (noteField) {
        noteField.closest(".studio-field").classList.add("has-error");
        noteField.focus();
      }
      return;
    }

    card.classList.add("is-busy");
    var controls = Array.prototype.slice.call(card.querySelectorAll("button, textarea"));
    var previous = controls.map(function (control) { return control.disabled; });
    controls.forEach(function (control) { control.disabled = true; });
    setStatus(statusField, action === "published" ? "Публикуем…" : "Отправляем решение…", "muted");

    try {
      await request("/chapters/" + encodeURIComponent(chapterId) + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status: action, note: note })
      });

      state.notes.delete(chapterId);
      if (action === "published") {
        setStatus(statusField, "Опубликовано.", "success");
        toast("Глава опубликована.");
      } else if (action === "changes_requested") {
        setStatus(statusField, "Возвращено на правки.", "success");
        toast("Глава возвращена на правки.");
      } else {
        setStatus(statusField, "Отклонено.", "success");
        toast("Глава отклонена.");
      }

      window.setTimeout(function () {
        state.queue = state.queue.filter(function (entry) { return entry.chapterId !== chapterId; });
        renderQueue();
        if (canStudio()) loadTitles();
      }, 700);
    } catch (error) {
      if (handleAuthError(error)) return;
      card.classList.remove("is-busy");
      controls.forEach(function (control, index) {
        if (control.isConnected) control.disabled = previous[index];
      });
      if (errorField) errorField.textContent = error.message;
      setStatus(statusField, "Решение не сохранено.", "error");
      toast(error.message);
    }
  }

  /* -------------------------------------------------------------------------
     Reset
     ------------------------------------------------------------------------- */
  function resetWorkspaceData() {
    state.teams = [];
    state.titles = [];
    state.queue = [];
    state.queueLoaded = false;
    state.notes.clear();
    state.activeChapterId = null;
    state.activePages = [];
    state.workBusy = false;
    state.titlesRequest += 1;
    clearPicks();
    closeWorkbench();

    if (els.libraryList) els.libraryList.innerHTML = "";
    if (els.libraryEmpty) els.libraryEmpty.hidden = true;
    if (els.libraryState) setStatus(els.libraryState, "Загружаем тайтлы…", "muted");
    if (els.statTitles) els.statTitles.textContent = "0";
    if (els.statChapters) els.statChapters.textContent = "0";
    if (els.statReview) els.statReview.textContent = "0";
    if (els.queueList) els.queueList.innerHTML = "";
    if (els.queueEmpty) els.queueEmpty.hidden = true;
    if (els.queueState) setStatus(els.queueState, "Загружаем очередь…", "muted");
    if (els.queueCount) els.queueCount.hidden = true;
    if (els.queueTotal) els.queueTotal.textContent = "0 глав в очереди";
    if (els.chapterForm) {
      var titleSelect = field(els.chapterForm, "titleSlug");
      if (titleSelect) titleSelect.innerHTML = '<option value="">Сначала создай тайтл</option>';
      var teamSelect = field(els.chapterForm, "teamId");
      if (teamSelect) teamSelect.innerHTML = '<option value="">Сначала создай команду</option>';
    }
    updateChapterHint();
  }

  /* -------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------- */
  init().catch(function (error) {
    if (window.console && typeof window.console.error === "function") {
      window.console.error(error);
    }
  });
})();

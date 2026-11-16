/* Kuroha prototype — local reading shelf shared by title, reader, profile and feed. */
(function () {
  "use strict";

  const STORAGE_KEY = "kuroha-library";
  const BOOKMARKS_KEY = "kuroha-bookmarks";
  const PROGRESS_KEY = "kuroha-progress";

  const STATUSES = [
    { id: "reading", label: "Читаю", short: "Читаю" },
    { id: "planned", label: "В планах", short: "В планах" },
    { id: "completed", label: "Прочитано", short: "Прочитано" },
    { id: "paused", label: "Отложено", short: "Отложено" },
    { id: "dropped", label: "Брошено", short: "Брошено" }
  ];

  const ORDER = STATUSES.map(function (status) { return status.id; });

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function readJSON(key, fallback) {
    const raw = storageGet(key);
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeRaw(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (error) {}
  }

  function validStatus(status) {
    return ORDER.indexOf(status) !== -1;
  }

  function label(status) {
    const found = STATUSES.find(function (entry) { return entry.id === status; });
    return found ? found.label : "";
  }

  function totalFor(item) {
    const base = Number(item && item.chapters) || 0;
    const api = window.KurohaUploads;
    return api && typeof api.totalFor === "function"
      ? api.totalFor(item.slug, base)
      : base;
  }

  function readRaw() {
    const raw = readJSON(STORAGE_KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const clean = {};
    Object.keys(raw).forEach(function (slug) {
      if (validStatus(raw[slug])) clean[slug] = raw[slug];
    });
    return clean;
  }

  function migrate() {
    if (storageGet(STORAGE_KEY) !== null) return readRaw();

    const shelf = {};
    const titles = window.KUROHA_TITLES || [];
    const bySlug = new Map(titles.map(function (item) { return [item.slug, item]; }));
    const bookmarks = readJSON(BOOKMARKS_KEY, []);
    const progress = readJSON(PROGRESS_KEY, {});

    if (Array.isArray(bookmarks)) {
      bookmarks.forEach(function (slug) {
        if (bySlug.has(slug) && !shelf[slug]) shelf[slug] = "planned";
      });
    }

    if (progress && typeof progress === "object" && !Array.isArray(progress)) {
      Object.keys(progress).forEach(function (slug) {
        const item = bySlug.get(slug);
        if (!item) return;
        const chapter = Math.max(0, Math.floor(Number(progress[slug]) || 0));
        if (chapter > 0) {
          shelf[slug] = chapter >= totalFor(item) ? "completed" : "reading";
        }
      });
    }

    if (Object.keys(shelf).length) writeRaw(shelf);
    return shelf;
  }

  function read() {
    return migrate();
  }

  function getStatus(slug) {
    const shelf = read();
    return validStatus(shelf[slug]) ? shelf[slug] : null;
  }

  function setStatus(slug, status) {
    if (!slug || !validStatus(status)) return null;
    const shelf = read();
    shelf[slug] = status;
    writeRaw(shelf);
    dispatch(slug, status);
    return status;
  }

  function remove(slug) {
    const shelf = read();
    if (Object.prototype.hasOwnProperty.call(shelf, slug)) {
      delete shelf[slug];
      writeRaw(shelf);
      dispatch(slug, null);
    }
  }

  function clear() {
    writeRaw({});
    dispatch(null, null);
  }

  function counts() {
    const shelf = read();
    const result = { all: 0, reading: 0, planned: 0, completed: 0, paused: 0, dropped: 0 };
    Object.keys(shelf).forEach(function (slug) {
      const status = shelf[slug];
      if (!validStatus(status)) return;
      result.all += 1;
      result[status] += 1;
    });
    return result;
  }

  function dispatch(slug, status) {
    try {
      window.dispatchEvent(new CustomEvent("kuroha:library-change", {
        detail: { slug: slug, status: status }
      }));
    } catch (error) {}
  }

  window.KurohaLibrary = {
    STORAGE_KEY: STORAGE_KEY,
    STATUSES: STATUSES,
    ORDER: ORDER,
    read: read,
    migrate: migrate,
    getStatus: getStatus,
    setStatus: setStatus,
    remove: remove,
    clear: clear,
    counts: counts,
    label: label
  };
})();

/* Kuroha 3.0 — local data archive */
(function () {
  "use strict";

  if (document.body.dataset.page !== "backup") return;

  const PREFIX = "kuroha-";
  const LABELS = {
    "kuroha-theme": "Тема",
    "kuroha-progress": "Прогресс чтения",
    "kuroha-reader-position": "Позиция в главах",
    "kuroha-reader-font": "Размер шрифта",
    "kuroha-reader-settings": "Настройки чтения",
    "kuroha-reader-sound": "Звук читальни",
    "kuroha-reader-volume": "Громкость читальни",
    "kuroha-bookmarks": "Закладки",
    "kuroha-library": "Моя полка",
    "kuroha-lists": "Мои списки",
    "kuroha-lists-seeded": "Служебный ключ списков",
    "kuroha-profile": "Профиль",
    "kuroha-profile-seeded": "Служебный ключ профиля",
    "kuroha-reading-goal": "Цель года",
    "kuroha-taste": "Твой вкус",
    "kuroha-ratings": "Оценки и отзывы",
    "kuroha-rating-seeded": "Служебный ключ оценок",
    "kuroha-notes": "Заметки",
    "kuroha-notes-seeded": "Служебный ключ заметок",
    "kuroha-discussions": "Обсуждения",
    "kuroha-discussions-seeded": "Служебный ключ обсуждений",
    "kuroha-chapter-discussions": "Обсуждения глав",
    "kuroha-chapter-discussions-seeded": "Служебный ключ обсуждений глав",
    "kuroha-notifications": "Уведомления",
    "kuroha-notifications-seeded": "Служебный ключ уведомлений",
    "kuroha-letters": "Письма",
    "kuroha-letters-seeded": "Служебный ключ писем",
    "kuroha-reader-follows": "Подписки на читателей",
    "kuroha-team-follows": "Подписки на команды",
    "kuroha-clubs": "Клубы",
    "kuroha-club-votes": "Голоса клубов",
    "kuroha-club-rsvp": "Встречи клубов",
    "kuroha-quote-likes": "Лайки цитат",
    "kuroha-recommendation-hidden": "Скрытые рекомендации",
    "kuroha-admin-uploads": "Загруженные главы",
    "kuroha-reports": "Жалобы и модерация",
    "kuroha-reports-seeded": "Служебный ключ жалоб",
    "kuroha-install-dismissed": "Установка приложения",
    "kuroha-installed": "Приложение установлено"
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function readKeys() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.indexOf(PREFIX) === 0) keys.push(key);
      }
    } catch (error) {}
    return keys.sort();
  }

  function rawObject() {
    const result = {};
    readKeys().forEach((key) => {
      try {
        result[key] = localStorage.getItem(key);
      } catch (error) {}
    });
    return result;
  }

  function parsed(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " Б";
    return (bytes / 1024).toFixed(1).replace(".", ",") + " КБ";
  }

  function plural(number, forms) {
    const value = Math.abs(Number(number) || 0);
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function setStatLabel(element, value, forms) {
    if (!element || !element.parentElement) return;
    const label = element.parentElement.querySelector("span");
    if (label) label.textContent = plural(value, forms);
  }

  function stats() {
    const raw = rawObject();
    const keys = Object.keys(raw);
    const progress = parsed("kuroha-progress", {});
    const library = parsed("kuroha-library", {});
    const chapters = Object.values(progress).reduce((sum, value) => sum + (Number(value) || 0), 0);
    let bytes = 0;
    try {
      bytes = new Blob([JSON.stringify(raw)]).size;
    } catch (error) {
      bytes = JSON.stringify(raw).length;
    }
    return {
      keys: keys.length,
      bytes: bytes,
      chapters: chapters,
      shelf: Object.keys(library).length
    };
  }

  function renderStats() {
    const current = stats();
    const size = $("#backup-size");
    const keys = $("#backup-keys");
    const chapters = $("#backup-progress");
    const shelf = $("#backup-shelf");
    if (size) size.textContent = formatBytes(current.bytes);
    if (keys) keys.textContent = String(current.keys);
    if (chapters) chapters.textContent = String(current.chapters);
    if (shelf) shelf.textContent = String(current.shelf);
    setStatLabel(keys, current.keys, ["ключ", "ключа", "ключей"]);
    setStatLabel(chapters, current.chapters, ["глава", "главы", "глав"]);
  }

  function renderList() {
    const list = $("#backup-keys-list");
    if (!list) return;
    const raw = rawObject();
    const keys = Object.keys(raw);
    if (!keys.length) {
      list.innerHTML = '<li class="backup-key backup-key--empty">Пока пусто. Kuroha ещё ничего не сохранила в этом браузере.</li>';
      return;
    }
    list.innerHTML = keys.map((key) => {
      const label = LABELS[key] || key.replace(/^kuroha-/, "").replace(/-/g, " ");
      let size = "";
      try {
        size = formatBytes(new Blob([raw[key]]).size);
      } catch (error) {
        size = "";
      }
      return '<li class="backup-key"><span class="backup-key__name">' + label + '</span><span class="backup-key__meta">' + size + "</span></li>";
    }).join("");
  }

  function render() {
    renderStats();
    renderList();
  }

  function toast(message) {
    if (window.KurohaToast) window.KurohaToast(message);
  }

  function exportData() {
    const payload = {
      app: "kuroha",
      version: 1,
      exportedAt: new Date().toISOString(),
      keys: rawObject()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kuroha-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const note = $("#backup-export-note");
    if (note) note.textContent = "Файл сохранён в загрузки.";
    toast("Резервная копия сохранена.");
  }

  function validate(payload) {
    if (!payload || payload.app !== "kuroha" || !payload.keys || typeof payload.keys !== "object") {
      throw new Error("Это не резервная копия Kuroha.");
    }
    const keys = {};
    Object.keys(payload.keys).forEach((key) => {
      if (key.indexOf(PREFIX) === 0 && typeof payload.keys[key] === "string") {
        keys[key] = payload.keys[key];
      }
    });
    if (!Object.keys(keys).length) throw new Error("В архиве нет данных Kuroha.");
    return keys;
  }

  function applyText(text, options) {
    const opts = options || {};
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      toast("Не удалось прочитать файл. Нужен JSON из Kuroha.");
      return false;
    }

    let keys;
    try {
      keys = validate(payload);
    } catch (error) {
      toast(error.message);
      return false;
    }

    if (!opts.force) {
      const ok = window.confirm("Заменить локальные данные этим архивом? Текущие настройки, прогресс, списки и заметки будут заменены.");
      if (!ok) return false;
    }

    try {
      readKeys().forEach((key) => localStorage.removeItem(key));
      Object.keys(keys).forEach((key) => localStorage.setItem(key, keys[key]));
    } catch (error) {
      toast("Не удалось записать архив в браузер.");
      return false;
    }

    render();
    const note = $("#backup-import-note");
    if (note) note.textContent = "Архив загружен. Обновляем страницу…";
    toast("Архив восстановлен.");
    if (opts.reload !== false) {
      setTimeout(() => window.location.reload(), 650);
    }
    return true;
  }

  function readFile(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
      toast("Выбери JSON-файл резервной копии.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => applyText(String(reader.result || "")));
    reader.addEventListener("error", () => toast("Не удалось прочитать файл."));
    reader.readAsText(file);
  }

  function clearAll() {
    if (!window.confirm("Стереть все локальные данные Kuroha? Это тема, прогресс, полка, заметки, оценки, письма и списки. Отменить будет нельзя.")) return;
    try {
      readKeys().forEach((key) => localStorage.removeItem(key));
    } catch (error) {}
    render();
    toast("Локальные данные очищены.");
  }

  function bind() {
    $$("[data-backup-export]").forEach((button) => {
      button.addEventListener("click", exportData);
    });

    const input = $("#backup-file");
    const drop = $("#backup-drop");
    if (input) {
      input.addEventListener("change", () => {
        readFile(input.files && input.files[0]);
        input.value = "";
      });
    }
    if (drop && input) {
      ["dragenter", "dragover"].forEach((name) => {
        drop.addEventListener(name, (event) => {
          event.preventDefault();
          drop.classList.add("is-dragover");
        });
      });
      ["dragleave", "drop"].forEach((name) => {
        drop.addEventListener(name, (event) => {
          event.preventDefault();
          drop.classList.remove("is-dragover");
        });
      });
      drop.addEventListener("drop", (event) => {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        readFile(file);
      });
    }

    const clear = $("[data-backup-clear]");
    if (clear) clear.addEventListener("click", clearAll);
    window.addEventListener("storage", render);
  }

  function init() {
    render();
    bind();
  }

  window.KurohaBackup = {
    stats: stats,
    raw: rawObject,
    export: exportData,
    applyText: applyText,
    clearAll: clearAll,
    render: render
  };

  init();
})();

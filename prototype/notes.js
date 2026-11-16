/* Kuroha prototype — notes in the margins. */
(function () {
  "use strict";

  const STORAGE_KEY = "kuroha-notes";
  const SEED_KEY = "kuroha-notes-seeded";
  const MAX_QUOTE = 500;

  const titles = window.KUROHA_TITLES || [];
  const bySlug = new Map(titles.map((title) => [title.slug, title]));

  const DEMO_NOTES = [
    {
      id: "n-demo-1",
      slug: "pepel-i-luna",
      chapter: 12,
      quote: "Не ищи меня среди имён. Я уже там, где заканчиваются строки.",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "n-demo-2",
      slug: "tihiy-okean",
      chapter: 12,
      quote: "Иногда достаточно одной страницы, чтобы вернуться домой.",
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "n-demo-3",
      slug: "kniga-zabytyh-imyon",
      chapter: 9,
      quote: "Книги помнят тех, кого забыли все. Иногда — и тех, кого мы ещё не встретили.",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  function readRaw() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((note) => note && note.quote) : [];
    } catch (error) {
      return [];
    }
  }

  function sortNotes(list) {
    return list.slice().sort((a, b) => {
      const left = new Date(b.createdAt || 0).getTime();
      const right = new Date(a.createdAt || 0).getTime();
      return left - right;
    });
  }

  function emit() {
    window.dispatchEvent(
      new CustomEvent("kuroha:notes-change", {
        detail: { count: readRaw().length }
      })
    );
  }

  function write(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {}
    emit();
  }

  function read() {
    return sortNotes(readRaw());
  }

  function markSeeded(value) {
    try {
      localStorage.setItem(SEED_KEY, value);
    } catch (error) {}
  }

  function ensureSeed() {
    let seeded = null;
    try {
      seeded = localStorage.getItem(SEED_KEY);
    } catch (error) {}

    if (seeded !== null) return read();

    const existing = readRaw();
    if (existing.length) {
      markSeeded("existing");
      return sortNotes(existing);
    }

    write(DEMO_NOTES.map((note) => ({ ...note })));
    markSeeded("demo");
    return read();
  }

  function normalizeQuote(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function add(payload) {
    const slug = payload && payload.slug ? String(payload.slug) : "";
    const chapter = Number(payload && payload.chapter) || 1;
    const quote = normalizeQuote(payload && payload.quote);
    if (!slug || !quote || quote.length > MAX_QUOTE) return null;

    const list = readRaw();
    const duplicate = list.some(
      (note) =>
        note.slug === slug &&
        Number(note.chapter) === chapter &&
        normalizeQuote(note.quote) === quote
    );
    if (duplicate) return null;

    const entry = {
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      slug,
      chapter,
      quote,
      createdAt: new Date().toISOString()
    };
    write([entry, ...list]);
    return entry;
  }

  function remove(id) {
    const list = readRaw();
    const next = list.filter((note) => note.id !== id);
    if (next.length === list.length) return false;
    write(next);
    return true;
  }

  function clear() {
    try {
      localStorage.setItem(STORAGE_KEY, "[]");
    } catch (error) {}
    markSeeded("cleared");
    emit();
  }

  function count() {
    return readRaw().length;
  }

  function forSlug(slug) {
    return read().filter((note) => note.slug === slug);
  }

  function titleCount() {
    return new Set(readRaw().map((note) => note.slug)).size;
  }

  function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "давно";
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "только что";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.round(hours / 24);
    if (days === 1) return "вчера";
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  function plural(number, forms) {
    const absolute = Math.abs(number) % 100;
    const last = absolute % 10;
    if (absolute > 10 && absolute < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function escapeHTML(value) {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return String(value).replace(/[&<>"']/g, (character) => characters[character]);
  }

  window.KurohaNotes = {
    STORAGE_KEY,
    SEED_KEY,
    MAX_QUOTE,
    read,
    ensureSeed,
    add,
    remove,
    clear,
    count,
    forSlug,
    titleCount,
    markSeeded,
    relativeTime
  };

  if (document.body.dataset.page !== "notes") return;

  const listElement = document.querySelector("#notes-list");
  const emptyElement = document.querySelector("#notes-empty");
  const emptyTitle = document.querySelector("#notes-empty-title");
  const emptyCopy = document.querySelector("#notes-empty-copy");
  const countElement = document.querySelector("#notes-count");
  const summaryElement = document.querySelector("#notes-summary");
  const titlesElement = document.querySelector("#notes-titles");
  const searchInput = document.querySelector("#notes-search");
  const searchClear = document.querySelector("#notes-search-clear");
  const clearButton = document.querySelector("#notes-clear");

  let query = "";

  function noteCard(note) {
    const book = bySlug.get(note.slug);
    if (!book) return "";
    const titleUrl = `title.html?slug=${encodeURIComponent(note.slug)}`;
    const readerUrl = `reader.html?slug=${encodeURIComponent(note.slug)}&chapter=${note.chapter}`;
    return `<article class="note-card" data-note-id="${escapeHTML(note.id)}">
        <div class="note-card__top">
          <span class="note-card__mark" aria-hidden="true">“</span>
          <div class="note-card__actions">
            <button class="note-card__postcard" type="button" data-postcard="${escapeHTML(note.id)}" aria-label="Сделать открытку из цитаты">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                <circle cx="8.5" cy="10" r="1.5"></circle>
                <path d="m21 15-5-5L5 21"></path>
              </svg>
              <span>Открытка</span>
            </button>
            <button class="note-card__remove" type="button" data-note-remove aria-label="Удалить заметку" title="Удалить заметку">×</button>
          </div>
        </div>
        <blockquote>«${escapeHTML(note.quote)}»</blockquote>
        <footer class="note-card__meta">
          <a class="note-card__title" href="${titleUrl}">${escapeHTML(book.title)}</a>
          <a class="note-card__chapter" href="${readerUrl}">Глава ${note.chapter} · вернуться к строке</a>
          <time datetime="${escapeHTML(note.createdAt)}">${relativeTime(note.createdAt)}</time>
        </footer>
      </article>`;
  }

  function renderSummary(notes) {
    if (!summaryElement) return;
    const total = notes.length;
    const titleTotal = new Set(notes.map((note) => note.slug)).size;
    const latest = notes.length ? relativeTime(notes[0].createdAt) : "—";
    summaryElement.innerHTML = `<div class="notes-summary__top">
        <span class="paper-label">Твои заметки</span>
        <span>${total ? "локально" : "пока пусто"}</span>
      </div>
      <div class="notes-summary__big">
        <b>${total}</b>
        <span>${plural(total, ["заметка", "заметки", "заметок"])}</span>
      </div>
      <div class="notes-summary__rows">
        <div><span>тайтлов</span><b>${titleTotal}</b></div>
        <div><span>последняя</span><b>${latest}</b></div>
      </div>`;
  }

  function renderTitles(notes) {
    if (!titlesElement) return;
    const counts = new Map();
    notes.forEach((note) => counts.set(note.slug, (counts.get(note.slug) || 0) + 1));
    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .slice(0, 6);
    titlesElement.innerHTML = rows
      .map(([slug, total]) => {
        const book = bySlug.get(slug);
        if (!book) return "";
        return `<a class="notes-title-link" href="title.html?slug=${encodeURIComponent(slug)}">${escapeHTML(book.title)}<span>${total}</span></a>`;
      })
      .join("");
    if (!rows.length) titlesElement.innerHTML = `<p class="notes-title-empty">Пока нет заметок.</p>`;
  }

  function render() {
    const notes = read();
    const visible = notes.filter((note) => {
      if (!query) return true;
      const book = bySlug.get(note.slug);
      const haystack = `${note.quote} ${book ? book.title : ""}`.toLowerCase();
      return haystack.includes(query);
    });

    renderSummary(notes);
    renderTitles(notes);

    if (countElement) {
      countElement.textContent = `${notes.length} ${plural(notes.length, ["заметка", "заметки", "заметок"])}`;
    }
    if (clearButton) clearButton.hidden = notes.length === 0;
    if (searchClear) searchClear.hidden = !searchInput.value;

    if (listElement) {
      listElement.innerHTML = visible.map(noteCard).join("");
    }

    const empty = visible.length === 0;
    if (emptyElement) emptyElement.hidden = !empty;
    if (listElement) listElement.hidden = empty;
    if (empty) {
      if (emptyTitle) {
        emptyTitle.textContent = notes.length && query ? "Ничего не нашлось" : "Пока пусто";
      }
      if (emptyCopy) {
        emptyCopy.textContent = notes.length && query
          ? "Попробуй другое слово или очисти поиск."
          : "Выдели строку в читалке — и она останется здесь.";
      }
    }
  }

  function bind() {
    searchInput?.addEventListener("input", () => {
      query = searchInput.value.trim().toLowerCase();
      if (searchClear) searchClear.hidden = !searchInput.value;
      render();
    });

    searchClear?.addEventListener("click", () => {
      if (!searchInput) return;
      searchInput.value = "";
      query = "";
      searchClear.hidden = true;
      searchInput.focus();
      render();
    });

    clearButton?.addEventListener("click", () => {
      if (!read().length) return;
      if (!window.confirm("Удалить все заметки? Это действие нельзя отменить.")) return;
      clear();
      window.KurohaToast?.("Все заметки удалены.");
    });

    listElement?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-note-remove]");
      if (!button) return;
      const card = button.closest(".note-card");
      const id = card ? card.dataset.noteId : "";
      if (!id) return;
      remove(id);
      window.KurohaToast?.("Заметка удалена.");
    });

    window.addEventListener("kuroha:notes-change", render);
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) render();
    });
  }

  function initPage() {
    ensureSeed();
    bind();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage);
  } else {
    initPage();
  }
})();

(function () {
  "use strict";

  const quotes = window.KUROHA_QUOTES || [];
  const readers = window.KUROHA_READERS || [];
  const titles = window.KUROHA_TITLES || [];
  const notesApi = window.KurohaNotes;
  const postcardsApi = window.KurohaPostcards;
  const LIKE_KEY = "kuroha-quote-likes";
  const FOLLOW_KEY = "kuroha-reader-follows";
  const readerMap = new Map(readers.map((reader) => [reader.slug, reader]));
  const titleMap = new Map(titles.map((title) => [title.slug, title]));
  const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]));

  let filter = "all";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

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

  function plural(number, forms) {
    const absolute = Math.abs(number) % 100;
    const last = absolute % 10;
    if (absolute > 10 && absolute < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed === null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function readLikes() {
    const values = readJSON(LIKE_KEY, []);
    return Array.isArray(values) ? values.filter((id) => quoteMap.has(id)) : [];
  }

  function isLiked(id) {
    return readLikes().includes(id);
  }

  function toggleLike(id) {
    const likes = readLikes();
    const index = likes.indexOf(id);
    if (index >= 0) likes.splice(index, 1);
    else likes.push(id);
    writeJSON(LIKE_KEY, likes);
  }

  function readFollows() {
    const values = readJSON(FOLLOW_KEY, []);
    return Array.isArray(values) ? values.filter((slug) => readerMap.has(slug)) : [];
  }

  function normalize(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function noteForQuote(quote, notes) {
    if (!notesApi) return null;
    const list = notes || notesApi.read();
    return (
      list.find(
        (note) =>
          note.slug === quote.slug &&
          Number(note.chapter) === Number(quote.chapter) &&
          normalize(note.quote) === normalize(quote.quote)
      ) || null
    );
  }

  function relativeTime(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    if (value < 60) return `${value} мин назад`;
    if (value < 24 * 60) return `${Math.round(value / 60)} ч назад`;
    const days = Math.round(value / 1440);
    if (days === 1) return "вчера";
    return `${days} дн назад`;
  }

  function quoteHTML(quote, notes) {
    const reader = readerMap.get(quote.reader);
    const book = titleMap.get(quote.slug);
    if (!reader || !book) return "";

    const saved = Boolean(noteForQuote(quote, notes));
    const liked = isLiked(quote.id);
    const likeCount = Math.max(0, Number(quote.likes) || 0) + (liked ? 1 : 0);
    const readerUrl = `readers.html?reader=${encodeURIComponent(reader.slug)}`;
    const titleUrl = `title.html?slug=${encodeURIComponent(quote.slug)}`;
    const chapterUrl = `reader.html?slug=${encodeURIComponent(quote.slug)}&chapter=${quote.chapter}`;
    const accent = escapeHTML(reader.accent || "#e63946");

    return `<article class="quote-card${saved ? " is-saved" : ""}" data-quote-id="${escapeHTML(quote.id)}" style="--quote-accent:${accent}">
      <header class="quote-card__top">
        <a class="quote-card__avatar" href="${readerUrl}" aria-label="Профиль: ${escapeHTML(reader.name)}">${escapeHTML(reader.initials || reader.name.slice(0, 1))}</a>
        <div class="quote-card__who">
          <a href="${readerUrl}">${escapeHTML(reader.name)}</a>
          <span>${escapeHTML(reader.handle || "")} · ${relativeTime(quote.ageMinutes)}</span>
        </div>
        ${saved ? '<span class="quote-card__saved">в заметках</span>' : ""}
      </header>
      <blockquote class="quote-card__text">«${escapeHTML(quote.quote)}»</blockquote>
      <p class="quote-card__source">
        <a href="${titleUrl}">${escapeHTML(book.title)}</a>
        <span>·</span>
        <a href="${chapterUrl}">глава ${quote.chapter}</a>
      </p>
      <footer class="quote-card__actions">
        <button class="quote-action quote-like${liked ? " is-liked" : ""}" type="button" data-quote-like aria-pressed="${liked}" aria-label="Нравится цитата">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path>
          </svg>
          <span>${likeCount}</span>
        </button>
        <button class="quote-action quote-save${saved ? " is-saved" : ""}" type="button" data-quote-save aria-pressed="${saved}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z"></path>
          </svg>
          <span>${saved ? "В заметках" : "В заметки"}</span>
        </button>
        <button class="quote-action" type="button" data-quote-postcard>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2"></rect>
            <circle cx="8.5" cy="10" r="1.5"></circle>
            <path d="m21 15-5-5L5 21"></path>
          </svg>
          <span>Открытка</span>
        </button>
        <a class="quote-card__read" href="${chapterUrl}">К главе <span aria-hidden="true">→</span></a>
      </footer>
    </article>`;
  }

  function visibleQuotes(notes) {
    const follows = new Set(readFollows());
    return quotes.filter((quote) => {
      if (filter === "following") return follows.has(quote.reader);
      if (filter === "saved") return Boolean(noteForQuote(quote, notes));
      return true;
    });
  }

  function renderSummary(notes) {
    const readersCount = new Set(quotes.map((quote) => quote.reader)).size;
    const savedCount = quotes.filter((quote) => noteForQuote(quote, notes)).length;
    const total = $("#quotes-total");
    const readersTotal = $("#quotes-readers");
    const savedTotal = $("#quotes-saved");
    if (total) total.textContent = String(quotes.length);
    if (readersTotal) readersTotal.textContent = String(readersCount);
    if (savedTotal) savedTotal.textContent = String(savedCount);
  }

  function renderFilters(notes) {
    const following = new Set(readFollows());
    const counts = {
      all: quotes.length,
      following: quotes.filter((quote) => following.has(quote.reader)).length,
      saved: quotes.filter((quote) => noteForQuote(quote, notes)).length
    };
    $$("[data-quote-filter]").forEach((button) => {
      const value = button.dataset.quoteFilter || "all";
      const active = value === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      const count = button.querySelector("[data-quote-count]");
      if (count) count.textContent = String(counts[value] || 0);
    });
  }

  function renderEmpty() {
    const empty = $("#quotes-empty");
    const title = $("#quotes-empty-title");
    const copy = $("#quotes-empty-copy");
    const link = $("#quotes-empty-link");
    if (!empty || !title || !copy || !link) return;

    if (filter === "following") {
      title.textContent = "Пока никого рядом";
      copy.textContent = "Подпишись на читателя — и его строки появятся здесь.";
      link.href = "readers.html";
      link.textContent = "Найти читателя";
    } else if (filter === "saved") {
      title.textContent = "В заметках пока пусто";
      copy.textContent = "Сохрани цитату из общей тетради — она останется у тебя.";
      link.href = "reader.html?slug=pepel-i-luna&chapter=12";
      link.textContent = "Открыть читалку";
    } else {
      title.textContent = "Пока тихо";
      copy.textContent = "Цитаты появятся, когда читатели оставят первые строки.";
      link.href = "readers.html";
      link.textContent = "Найти читателя";
    }
  }

  function render() {
    const wall = $("#quotes-wall");
    const empty = $("#quotes-empty");
    const count = $("#quotes-count");
    if (!wall || !empty || !count) return;

    const notes = notesApi ? notesApi.read() : [];
    const items = visibleQuotes(notes);
    wall.innerHTML = items.map((quote) => quoteHTML(quote, notes)).join("");
    empty.hidden = items.length > 0;
    count.textContent = `${items.length} ${plural(items.length, ["цитата", "цитаты", "цитат"])}`;
    renderSummary(notes);
    renderFilters(notes);
    renderEmpty();
  }

  function showToast(message) {
    if (window.KurohaToast) {
      window.KurohaToast(message);
    } else if (window.console && window.console.info) {
      window.console.info(message);
    }
  }

  function saveQuote(quote) {
    if (!notesApi) {
      showToast("Заметки сейчас недоступны.");
      return null;
    }
    const existing = noteForQuote(quote);
    if (existing) {
      showToast("Эта цитата уже в заметках.");
      return existing;
    }
    const entry = notesApi.add({
      slug: quote.slug,
      chapter: quote.chapter,
      quote: quote.quote
    });
    if (!entry) {
      showToast("Не удалось сохранить цитату.");
      return null;
    }
    showToast("Цитата сохранена в заметки.");
    return entry;
  }

  function bind() {
    const wall = $("#quotes-wall");
    if (!wall) return;

    $$("[data-quote-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        filter = button.dataset.quoteFilter || "all";
        render();
      });
    });

    wall.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quote-like], [data-quote-save], [data-quote-postcard]");
      if (!button) return;
      const card = button.closest("[data-quote-id]");
      const quote = card ? quoteMap.get(card.dataset.quoteId) : null;
      if (!quote) return;

      if (button.hasAttribute("data-quote-like")) {
        toggleLike(quote.id);
        render();
        return;
      }

      if (button.hasAttribute("data-quote-save")) {
        saveQuote(quote);
        render();
        return;
      }

      if (button.hasAttribute("data-quote-postcard")) {
        let note = noteForQuote(quote);
        if (!note) note = saveQuote(quote);
        if (!note) return;
        if (postcardsApi) {
          postcardsApi.open(note.id);
        } else {
          showToast("Открытки сейчас недоступны.");
        }
      }
    });

    if (notesApi) {
      window.addEventListener("kuroha:notes-change", render);
    }
    window.addEventListener("kuroha:reader-follow-change", render);
    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === LIKE_KEY || event.key === FOLLOW_KEY) {
        render();
        return;
      }
      if (notesApi && event.key === notesApi.STORAGE_KEY) render();
    });
  }

  function init() {
    if (!document.body || document.body.dataset.page !== "quotes") return;
    if (notesApi) notesApi.ensureSeed();
    render();
    bind();
  }

  window.KurohaQuotes = {
    LIKE_KEY,
    FOLLOW_KEY,
    all: quotes.slice(),
    readLikes,
    isLiked,
    toggleLike,
    render
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

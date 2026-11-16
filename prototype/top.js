(function () {
  const TITLES = window.KUROHA_TITLES || [];
  const cards = window.KurohaCards;

  const PERIODS = {
    day: { label: "За день", short: "за день", freshness: 6, reads: 0.18, newBoost: 6 },
    week: { label: "За неделю", short: "за неделю", freshness: 2, reads: 0.8, newBoost: 3 },
    month: { label: "За месяц", short: "за месяц", freshness: 0.5, reads: 3.2, newBoost: 0 }
  };

  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };

  const GENRE_LABELS = {
    fantasy: "Фэнтези",
    romance: "Романтика",
    drama: "Драма",
    action: "Экшен",
    mystery: "Мистика",
    slice: "Повседневность",
    history: "История",
    scifi: "Фантастика",
    horror: "Ужасы",
    comedy: "Комедия",
    adventure: "Приключения",
    thriller: "Триллер"
  };

  const NOW = new Date("2026-11-15T12:00:00");
  const DAY = 24 * 60 * 60 * 1000;
  const PERIOD_ORDER = ["day", "week", "month"];
  let period = "day";

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plural(number, forms) {
    const mod10 = number % 10;
    const mod100 = number % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function formatRating(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString("ru-RU");
  }

  function daysAgo(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    return Math.max(0, Math.round((NOW - date) / DAY));
  }

  function periodIndex() {
    return PERIOD_ORDER.indexOf(period);
  }

  function scoreFor(book) {
    const fresh = Math.max(0, 30 - daysAgo(book.updated));
    const config = PERIODS[period];
    return (
      book.popularity +
      book.rating * 2.5 +
      book.chapters * 0.06 +
      fresh * config.freshness +
      (book.isNew ? config.newBoost : 0) +
      (book.popularity % 5) * 0.35
    );
  }

  function readsFor(book) {
    const fresh = Math.max(0, 30 - daysAgo(book.updated));
    const base = book.popularity * 1200 + book.chapters * 180 + book.rating * 900 + fresh * 500;
    return Math.round(base * PERIODS[period].reads);
  }

  function trendFor(book, index) {
    if (book.isNew && period !== "month") return { type: "new", label: "новое" };
    const seed = (book.popularity * 7 + book.chapters * 3 + periodIndex() * 13 + index) % 9;
    const movement = (seed % 5) - 2;
    if (movement > 0) return { type: "up", label: `↑ ${movement}` };
    if (movement < 0) return { type: "down", label: `↓ ${Math.abs(movement)}` };
    return { type: "same", label: "—" };
  }

  function ranked() {
    return TITLES.map((book, index) => ({ book, score: scoreFor(book), reads: readsFor(book), index }))
      .sort((a, b) => b.score - a.score || b.book.popularity - a.book.popularity)
      .slice(0, 12);
  }

  function coverFor(book) {
    return cards && cards.miniCoverHTML ? cards.miniCoverHTML(book) : "";
  }

  function renderSummary(rows) {
    const summary = document.querySelector("#top-summary");
    if (!summary || !rows.length) return;
    const leader = rows[0];
    const book = leader.book;
    summary.innerHTML = `<div class="top-summary__top">
        <span class="paper-label">Топ ${PERIODS[period].short}</span>
        <span>${rows.length} ${plural(rows.length, ["история", "истории", "историй"])}</span>
      </div>
      <div class="top-summary__content">
        <div class="top-summary__cover">${coverFor(book)}</div>
        <div class="top-summary__body">
          <span class="top-summary__rank">01</span>
          <h2><a href="title.html?slug=${encodeURIComponent(book.slug)}">${escapeHTML(book.title)}</a></h2>
          <p>${TYPE_LABELS[book.type]} · ${book.year} · ${book.chapters} ${plural(book.chapters, ["глава", "главы", "глав"])}</p>
          <div class="top-summary__stats">
            <b>★ ${formatRating(book.rating)}</b>
            <span>${formatNumber(leader.reads)} ${plural(leader.reads, ["чтение", "чтения", "чтений"])}</span>
          </div>
        </div>
      </div>`;
  }

  function renderList(rows) {
    const list = document.querySelector("#top-list");
    if (!list) return;
    list.innerHTML = rows
      .map(({ book, reads }, index) => {
        const trend = trendFor(book, index);
        const lead = index < 3 ? " top-row--lead" : "";
        return `<a class="top-row${lead}" href="title.html?slug=${encodeURIComponent(book.slug)}">
          <span class="top-row__rank">${String(index + 1).padStart(2, "0")}</span>
          <div class="top-row__cover">${coverFor(book)}</div>
          <div class="top-row__body">
            <div class="top-row__head">
              <h2>${escapeHTML(book.title)}</h2>
              <span class="top-trend top-trend--${trend.type}">${trend.label}</span>
            </div>
            <p class="top-row__meta">${TYPE_LABELS[book.type]} · ${book.year} · ${book.chapters} ${plural(book.chapters, ["глава", "главы", "глав"])}</p>
            <p class="top-row__genres">${book.genres
              .slice(0, 3)
              .map((genre) => GENRE_LABELS[genre] || genre)
              .join(" · ")}</p>
          </div>
          <div class="top-row__stats">
            <b>★ ${formatRating(book.rating)}</b>
            <span>${formatNumber(reads)} ${plural(reads, ["чтение", "чтения", "чтений"])}</span>
          </div>
        </a>`;
      })
      .join("");
  }

  function renderGenres() {
    const container = document.querySelector("#top-genres");
    if (!container) return;
    const counts = new Map();
    TITLES.forEach((book) => {
      book.genres.forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1));
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    container.innerHTML = top
      .map(
        ([genre, count]) =>
          `<a class="top-genre-link" href="genre.html?genre=${encodeURIComponent(genre)}">${GENRE_LABELS[genre] || genre}<span>${count}</span></a>`
      )
      .join("");
  }

  function updateTabs() {
    document.querySelectorAll("[data-top-period]").forEach((button) => {
      const active = button.dataset.topPeriod === period;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function updateUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("period", period);
      window.history.replaceState({}, "", url);
    } catch (error) {}
  }

  function render() {
    const rows = ranked();
    const count = document.querySelector("#top-count");
    if (count) {
      count.textContent = `${rows.length} ${plural(rows.length, ["история", "истории", "историй"])} · ${PERIODS[period].label.toLowerCase()}`;
    }
    updateTabs();
    renderSummary(rows);
    renderList(rows);
  }

  function setPeriod(value, updateAddress = true) {
    if (!PERIODS[value]) return;
    period = value;
    if (updateAddress) updateUrl();
    render();
  }

  function init() {
    renderGenres();
    const fromUrl = new URLSearchParams(window.location.search).get("period");
    setPeriod(PERIODS[fromUrl] ? fromUrl : "day", false);
    document.querySelectorAll("[data-top-period]").forEach((button) => {
      button.addEventListener("click", () => setPeriod(button.dataset.topPeriod));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

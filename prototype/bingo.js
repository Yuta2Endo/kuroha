/* Kuroha prototype - nine quiet evenings reading map. */
(() => {
  "use strict";

  if (document.body.dataset.page !== "bingo") return;

  const titles = window.KUROHA_TITLES || [];
  const bySlug = new Map(titles.map((item) => [item.slug, item]));
  const libraryApi = window.KurohaLibrary;
  const notesApi = window.KurohaNotes;
  const ratingsApi = window.KurohaRatings;
  const uploadsApi = window.KurohaUploads;

  const $ = (selector) => document.querySelector(selector);

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
      return fallback;
    }
  }

  function totalChapters(item) {
    if (!item) return 0;
    if (uploadsApi && typeof uploadsApi.totalFor === "function") {
      return uploadsApi.totalFor(item.slug, item.chapters || 0);
    }
    return item.chapters || 0;
  }

  function getProgress() {
    const raw = readJSON("kuroha-progress", {});
    const result = [];
    Object.keys(raw).forEach((slug) => {
      const item = bySlug.get(slug);
      if (!item) return;
      const chapter = Math.max(1, Math.min(Number(raw[slug]) || 1, totalChapters(item)));
      result.push({ item, chapter, total: totalChapters(item) });
    });
    return result;
  }

  function getShelf() {
    if (libraryApi && typeof libraryApi.read === "function") {
      try {
        return libraryApi.read() || {};
      } catch (error) {
        return {};
      }
    }
    return readJSON("kuroha-library", {});
  }

  function plural(value, forms) {
    const number = Math.abs(Number(value) || 0) % 100;
    const last = number % 10;
    if (number > 10 && number < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function collect() {
    const progress = getProgress();
    const shelf = getShelf();
    const chapters = progress.reduce((sum, entry) => sum + entry.chapter, 0);
    const types = new Set(progress.map((entry) => entry.item.type));
    const genres = new Set(progress.flatMap((entry) => entry.item.genres || []));
    const completed = Object.keys(shelf).filter((slug) => {
      return shelf[slug] === "completed" && bySlug.has(slug);
    }).length;
    let notes = 0;
    let ratings = 0;

    if (notesApi && typeof notesApi.count === "function") notes = notesApi.count();
    if (ratingsApi && typeof ratingsApi.allMine === "function") ratings = ratingsApi.allMine().length;

    return {
      progressCount: progress.length,
      chapters,
      completed,
      types,
      genres,
      notes,
      ratings,
      shelfCount: Object.keys(shelf).filter((slug) => bySlug.has(slug)).length
    };
  }

  const CHALLENGES = [
    {
      id: "first-evening",
      label: "Первый вечер",
      title: "Открой историю",
      hint: "Прочитай хотя бы одну главу.",
      href: "catalog.html",
      cta: "Выбрать историю",
      done: (state) => state.progressCount > 0
    },
    {
      id: "ten-chapters",
      label: "Десять глав",
      title: "Не спеши закрывать",
      hint: "Прочитай десять глав — неважно, в какой истории.",
      href: "profile.html",
      cta: "Моя история",
      done: (state) => state.chapters >= 10
    },
    {
      id: "last-page",
      label: "До последней страницы",
      title: "Закрой историю",
      hint: "Доведи хотя бы одну историю до конца.",
      href: "profile.html",
      cta: "Моя полка",
      done: (state) => state.completed > 0
    },
    {
      id: "only-text",
      label: "Только текст",
      title: "Прочитай новеллу",
      hint: "Одна глава без картинок — тоже история.",
      href: "novels.html",
      cta: "Найти новеллу",
      done: (state) => state.types.has("novel")
    },
    {
      id: "dark-night",
      label: "Тёмная ночь",
      title: "Загляни в темноту",
      hint: "Ужас или триллер. Включи свет, если нужно.",
      href: "catalog.html?genre=horror",
      cta: "Найти историю",
      done: (state) => state.genres.has("horror") || state.genres.has("thriller")
    },
    {
      id: "far-away",
      label: "Далёкий мир",
      title: "Уйди за горизонт",
      hint: "Фэнтези, фантастика или приключения.",
      href: "catalog.html?genre=fantasy",
      cta: "Найти мир",
      done: (state) => state.genres.has("fantasy") || state.genres.has("scifi") || state.genres.has("adventure")
    },
    {
      id: "quiet-evening",
      label: "Тихий вечер",
      title: "Останься рядом",
      hint: "Повседневность или романтика без спешки.",
      href: "catalog.html?genre=slice",
      cta: "Найти тишину",
      done: (state) => state.genres.has("slice") || state.genres.has("romance")
    },
    {
      id: "remember-line",
      label: "Строка на память",
      title: "Сохрани цитату",
      hint: "Оставь в заметках строку, к которой вернёшься.",
      href: "notes.html",
      cta: "Мои заметки",
      done: (state) => state.notes > 0
    },
    {
      id: "own-word",
      label: "Своё слово",
      title: "Оцени историю",
      hint: "Поставь оценку или оставь короткий отзыв.",
      href: "title.html?slug=pepel-i-luna#reviews",
      cta: "Оценить",
      done: (state) => state.ratings > 0
    }
  ];

  function cellHTML(challenge, index, state) {
    const complete = challenge.done(state);
    return `
      <article class="bingo-cell${complete ? " is-done" : ""}" data-bingo="${challenge.id}">
        <span class="bingo-cell__stamp" aria-hidden="true">${complete ? "✓" : "·"}</span>
        <p class="bingo-cell__label">${challenge.label}</p>
        <h3>${challenge.title}</h3>
        <p class="bingo-cell__hint">${challenge.hint}</p>
        <div class="bingo-cell__foot">
          <span class="bingo-cell__state">${complete ? "собрано" : "ещё нет"}</span>
          <a class="bingo-cell__link" href="${challenge.href}">${complete ? "Посмотреть" : challenge.cta}</a>
        </div>
      </article>
    `;
  }

  function render() {
    const state = collect();
    const done = CHALLENGES.filter((challenge) => challenge.done(state)).length;
    const percent = Math.round((done / CHALLENGES.length) * 100);
    const board = $("#bingo-board");
    const next = CHALLENGES.find((challenge) => !challenge.done(state));

    if (board) board.innerHTML = CHALLENGES.map((challenge, index) => cellHTML(challenge, index, state)).join("");

    const total = $("#bingo-total");
    if (total) total.innerHTML = `${done} <span>/ ${CHALLENGES.length}</span>`;

    const count = $("#bingo-count");
    if (count) count.textContent = `${done} из ${CHALLENGES.length} собрано`;

    const bar = $("#bingo-bar");
    if (bar) bar.style.width = `${percent}%`;

    const nextLabel = $("#bingo-next");
    if (nextLabel) {
      nextLabel.textContent = next
        ? `Следующий вечер: «${next.title}».`
        : "Все девять вечеров собраны. Можно начинать новую историю.";
    }

    const hint = $("#bingo-hint");
    if (hint) {
      hint.textContent = done === CHALLENGES.length
        ? "Карта собрана. Никакой гонки — просто девять вечеров, которые остались."
        : `Собрано ${done} ${plural(done, ["вечер", "вечера", "вечеров"])}. Остальное — не задача, а повод.`;
    }
  }

  function init() {
    if (libraryApi && typeof libraryApi.migrate === "function") libraryApi.migrate();
    render();
    window.addEventListener("storage", (event) => {
      if (!event.key || /^kuroha-(progress|library|notes|ratings|admin-uploads)/.test(event.key)) render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.KurohaBingo = { render, challenges: CHALLENGES };
})();

(function () {
  const TITLES = window.KUROHA_TITLES || [];
  const bySlug = new Map(TITLES.map(function (item) { return [item.slug, item]; }));
  const libraryApi = window.KurohaLibrary;
  const notesApi = window.KurohaNotes;
  const uploadsApi = window.KurohaUploads;

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

  const STATUS_LABELS = {
    reading: "Читаю",
    planned: "В планах",
    completed: "Прочитано",
    paused: "Отложено",
    dropped: "Брошено"
  };

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

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed === null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function totalChapters(item) {
    const uploaded = uploadsApi && typeof uploadsApi.totalFor === "function"
      ? uploadsApi.totalFor(item.slug, item.chapters)
      : item.chapters;
    return Math.max(1, Number(uploaded) || item.chapters || 1);
  }

  function getProgress() {
    const raw = readJSON("kuroha-progress", {});
    const result = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
    Object.keys(raw).forEach(function (slug) {
      const item = bySlug.get(slug);
      if (!item) return;
      const chapter = Math.min(Math.max(0, Number(raw[slug]) || 0), totalChapters(item));
      if (chapter > 0) result[slug] = chapter;
    });
    return result;
  }

  function getShelf() {
    if (!libraryApi || typeof libraryApi.read !== "function") return {};
    const raw = libraryApi.read();
    const result = {};
    if (!raw || typeof raw !== "object") return result;
    Object.keys(raw).forEach(function (slug) {
      if (bySlug.has(slug) && STATUS_LABELS[raw[slug]]) result[slug] = raw[slug];
    });
    return result;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function formatMinutes(minutes) {
    if (!minutes) return "0 мин";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return `${hours} ч ${rest} мин`;
    if (hours) return `${hours} ч`;
    return `${rest} мин`;
  }

  function typeLabel(item) {
    return TYPE_LABELS[item.type] || item.type;
  }

  function renderGenres(progress, shelf) {
    const container = document.getElementById("year-genres");
    if (!container) return;

    const slugs = new Set(Object.keys(progress).concat(Object.keys(shelf)));
    const counts = new Map();

    slugs.forEach(function (slug) {
      const item = bySlug.get(slug);
      if (!item) return;
      item.genres.forEach(function (genre) {
        counts.set(genre, (counts.get(genre) || 0) + 1);
      });
    });

    const rows = [...counts.entries()]
      .sort(function (a, b) {
        return b[1] - a[1] || (GENRE_LABELS[a[0]] || a[0]).localeCompare(GENRE_LABELS[b[0]] || b[0], "ru");
      })
      .slice(0, 6);

    if (!rows.length) {
      container.innerHTML = '<p class="year-empty-line">Пока нет жанров — добавь истории на полку.</p>';
      return;
    }

    const max = rows[0][1];
    container.innerHTML = rows.map(function (entry) {
      const label = GENRE_LABELS[entry[0]] || entry[0];
      const count = entry[1];
      const width = Math.max(8, Math.round((count / max) * 100));
      return `<div class="year-genre">
        <div class="year-genre__head"><span>${escapeHTML(label)}</span><b>${count}</b></div>
        <div class="year-genre__track"><span style="width:${width}%"></span></div>
      </div>`;
    }).join("");
  }

  function storyStatus(slug, shelf, progress) {
    if (shelf[slug]) return shelf[slug];
    return progress[slug] ? "reading" : "planned";
  }

  function renderStories(progress, shelf) {
    const list = document.getElementById("year-stories");
    const empty = document.getElementById("year-stories-empty");
    if (!list || !empty) return;

    const entries = Object.keys(progress)
      .map(function (slug) {
        const item = bySlug.get(slug);
        return item ? { item: item, chapter: progress[slug], total: totalChapters(item) } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.chapter - a.chapter || b.item.rating - a.item.rating;
      })
      .slice(0, 3);

    if (!entries.length) {
      list.innerHTML = "";
      list.hidden = true;
      empty.hidden = false;
      return;
    }

    list.hidden = false;
    empty.hidden = true;

    list.innerHTML = entries.map(function (entry) {
      const item = entry.item;
      const status = storyStatus(item.slug, shelf, progress);
      const percent = Math.min(100, Math.round((entry.chapter / entry.total) * 100));
      const finished = entry.chapter >= entry.total;
      const cover = window.KurohaCards && window.KurohaCards.miniCoverHTML
        ? window.KurohaCards.miniCoverHTML(item)
        : "";
      const action = finished
        ? `<a class="btn btn--small btn--secondary year-story__action" href="reader.html?slug=${encodeURIComponent(item.slug)}&chapter=1">Перечитать</a>`
        : `<a class="btn btn--small btn--secondary year-story__action" href="reader.html?slug=${encodeURIComponent(item.slug)}&chapter=${entry.chapter}">Продолжить</a>`;

      return `<article class="year-story">
        <div class="year-story__cover">${cover}</div>
        <div class="year-story__body">
          <div class="year-story__head">
            <h3><a href="title.html?slug=${encodeURIComponent(item.slug)}">${escapeHTML(item.title)}</a></h3>
            <span class="year-story__status year-story__status--${status}">${STATUS_LABELS[status] || "Читаю"}</span>
          </div>
          <p class="year-story__meta">${typeLabel(item)} · ${entry.chapter} из ${entry.total} глав</p>
          <div class="progress year-story__progress"><span style="width:${percent}%"></span></div>
        </div>
        ${action}
      </article>`;
    }).join("");
  }

  function renderQuote(notes) {
    const container = document.getElementById("year-quote");
    if (!container) return;

    if (!notes.length) {
      container.innerHTML = `<div class="year-quote year-quote--empty">
        <p>Пока ни одной цитаты. Выдели строку в читалке — и она останется здесь.</p>
        <a class="btn btn--secondary" href="notes.html">Открыть заметки</a>
      </div>`;
      return;
    }

    const note = notes[0];
    const item = bySlug.get(note.slug);
    if (!item) {
      container.innerHTML = "";
      return;
    }

    const chapter = note.chapter || 1;
    container.innerHTML = `<figure class="year-quote">
      <blockquote><p>«${escapeHTML(note.quote)}»</p></blockquote>
      <figcaption>
        <a href="title.html?slug=${encodeURIComponent(item.slug)}">${escapeHTML(item.title)}</a>
        <span>глава ${chapter}</span>
        <a class="year-quote__read" href="reader.html?slug=${encodeURIComponent(item.slug)}&chapter=${chapter}">Перечитать</a>
      </figcaption>
    </figure>`;
  }

  function render() {
    const content = document.getElementById("year-content");
    if (!content) return;

    const progress = getProgress();
    const shelf = getShelf();
    const notes = notesApi
      ? typeof notesApi.ensureSeed === "function"
        ? notesApi.ensureSeed()
        : notesApi.read()
      : [];

    const chapters = Object.keys(progress).reduce(function (sum, slug) {
      return sum + progress[slug];
    }, 0);
    const historyCount = Object.keys(progress).length;
    const shelfCount = Object.keys(shelf).length;
    const completedCount = Object.keys(shelf).filter(function (slug) {
      return shelf[slug] === "completed";
    }).length;
    const notesCount = notes.length;
    const minutes = chapters * 7;
    const isEmpty = chapters === 0 && shelfCount === 0 && notesCount === 0;

    setText("year-card-chapters", chapters);
    setText("year-card-titles", historyCount);
    setText("year-card-shelf", shelfCount);
    setText("year-card-notes", notesCount);
    setText("year-chapters", chapters);
    setText("year-minutes", formatMinutes(minutes));
    setText("year-finished", completedCount);
    setText("year-notes", notesCount);

    content.hidden = isEmpty;
    const empty = document.getElementById("year-empty");
    if (empty) empty.hidden = !isEmpty;

    if (isEmpty) return;

    renderGenres(progress, shelf);
    renderStories(progress, shelf);
    renderQuote(notes);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();

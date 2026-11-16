/* Kuroha profile — bookmarks, reading history, local-only demo data. */
(function () {
  "use strict";

  const TITLES = window.KUROHA_TITLES || [];
  const bySlug = new Map(TITLES.map(function (item) { return [item.slug, item]; }));
  const libraryApi = window.KurohaLibrary;
  const discussionApi = window.KurohaDiscussions;
  const notesApi = window.KurohaNotes;
  const ratingsApi = window.KurohaRatings;
  const SHELF_ORDER = ["reading", "planned", "completed", "paused", "dropped"];
  const SHELF_LABELS = {
    reading: "Читаю",
    planned: "В планах",
    completed: "Прочитано",
    paused: "Отложено",
    dropped: "Брошено"
  };
  let shelfFilter = "all";

  function totalChapters(item) {
    const base = Number(item.chapters) || 0;
    const api = window.KurohaUploads;
    return api && typeof api.totalFor === "function"
      ? api.totalFor(item.slug, base)
      : base;
  }

  const BOOKMARKS_KEY = "kuroha-bookmarks";
  const PROGRESS_KEY = "kuroha-progress";
  const SEED_KEY = "kuroha-profile-seeded";

  const TYPE_LABELS = { manga: "манга", manhwa: "манхва", manhua: "маньхуа", novel: "новелла" };

  const DEMO_BOOKMARKS = [
    "pepel-i-luna",
    "tihiy-okean",
    "chaynaya-na-uglu",
    "kniga-zabytyh-imyon",
    "teni-na-stene"
  ];

  const DEMO_PROGRESS = {
    "pepel-i-luna": 12,
    "tihiy-okean": 12,
    "chaynaya-na-uglu": 7,
    "dom-u-morya": 3,
    "pod-zemley": 5
  };

  const MILESTONES = [
    { id: "first-chapter", title: "Первая страница", copy: "Открой первую главу — начало положено.", target: 1, kind: "chapters" },
    { id: "ten-chapters", title: "Десять глав", copy: "Десять глав позади. Темп найден.", target: 10, kind: "chapters" },
    { id: "fifty-chapters", title: "Пятьдесят глав", copy: "Полсотни глав. Ты уже не просто гость.", target: 50, kind: "chapters" },
    { id: "hundred-chapters", title: "Сто глав", copy: "Сто глав. Ночная библиотека тебя знает.", target: 100, kind: "chapters" },
    { id: "first-shelf", title: "Первая полка", copy: "Добавь первую историю на полку.", target: 1, kind: "shelf" },
    { id: "five-shelf", title: "Пять историй", copy: "Пять историй ждут своей очереди.", target: 5, kind: "shelf" },
    { id: "first-comment", title: "Первый отклик", copy: "Оставь первый комментарий под историей.", target: 1, kind: "comments" },
    { id: "five-comments", title: "Пять откликов", copy: "Пять комментариев. Голос в тишине.", target: 5, kind: "comments" },
    { id: "first-rating", title: "Первая оценка", copy: "Поставь первый балл — история услышана.", target: 1, kind: "ratings" },
    { id: "ten-ratings", title: "Десять оценок", copy: "Десять историй получили твой балл.", target: 10, kind: "ratings" }
  ];

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (error) {}
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (error) {}
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

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function plural(number, forms) {
    const abs = Math.abs(number) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function getBookmarks() {
    const raw = readJSON(BOOKMARKS_KEY, []);
    if (!Array.isArray(raw)) return [];
    const unique = [];
    raw.forEach(function (slug) {
      if (bySlug.has(slug) && unique.indexOf(slug) === -1) unique.push(slug);
    });
    return unique;
  }

  function getProgress() {
    const raw = readJSON(PROGRESS_KEY, {});
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const clean = {};
    Object.keys(raw).forEach(function (slug) {
      const item = bySlug.get(slug);
      const chapter = Math.floor(Number(raw[slug]));
      if (item && Number.isFinite(chapter) && chapter > 0) {
        clean[slug] = Math.min(chapter, totalChapters(item));
      }
    });
    return clean;
  }

  function seedDemo() {
    const seeded = storageGet(SEED_KEY);
    const bookmarks = getBookmarks();
    const progress = getProgress();
    const empty = bookmarks.length === 0 && Object.keys(progress).length === 0;
    let created = false;

    if (!seeded && empty) {
      writeJSON(BOOKMARKS_KEY, DEMO_BOOKMARKS);
      writeJSON(PROGRESS_KEY, DEMO_PROGRESS);
      storageSet(SEED_KEY, "demo");
      created = true;
    }

    if (
      (created || seeded === "demo") &&
      ratingsApi &&
      typeof ratingsApi.countMine === "function" &&
      ratingsApi.countMine() === 0 &&
      !storageGet("kuroha-rating-seeded")
    ) {
      ratingsApi.set(
        "pepel-i-luna",
        9,
        "Тихая история, которая остаётся после последней страницы. Особенно двенадцатая глава."
      );
      storageSet("kuroha-rating-seeded", "demo");
    }

    return created;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function historyRow(item, chapter) {
    const total = totalChapters(item);
    const percent = Math.max(1, Math.min(100, Math.round((chapter / total) * 100)));
    const finished = chapter >= total;
    const href = "reader.html?slug=" + encodeURIComponent(item.slug) +
      "&chapter=" + (finished ? 1 : chapter);
    const label = finished ? "Перечитать" : "Продолжить";
    const cover = window.KurohaCards && window.KurohaCards.miniCoverHTML
      ? window.KurohaCards.miniCoverHTML(item)
      : "";

    return (
      '<article class="history-row">' +
        '<div class="history-row__cover" aria-hidden="true">' + cover + "</div>" +
        '<div class="history-row__body">' +
          '<div class="history-row__top">' +
            '<h3><a href="title.html?slug=' + encodeURIComponent(item.slug) + '">' + escapeHTML(item.title) + "</a></h3>" +
            '<span class="history-row__percent">' + percent + "%</span>" +
          "</div>" +
          '<p class="history-row__meta">' + TYPE_LABELS[item.type] + " · " + chapter + " / " + total + " " + plural(total, ["глава", "главы", "глав"]) + "</p>" +
          '<div class="progress" role="progressbar" aria-label="Прогресс чтения" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '"><span style="width:' + percent + '%"></span></div>' +
          '<p class="history-row__chapter">' + (finished ? "История прочитана" : "Ты остановился на главе " + chapter) + "</p>" +
        "</div>" +
        '<div class="history-row__action"><a class="btn btn--secondary btn--small" href="' + href + '">' + label + "</a></div>" +
      "</article>"
    );
  }

  function shelfLabel(status) {
    if (libraryApi && typeof libraryApi.label === "function") {
      return libraryApi.label(status);
    }
    return SHELF_LABELS[status] || "Без статуса";
  }

  function getShelfStatuses() {
    if (!libraryApi || typeof libraryApi.read !== "function") return {};
    const statuses = libraryApi.read();
    return statuses && typeof statuses === "object" && !Array.isArray(statuses) ? statuses : {};
  }

  function shelfCard(item, status, progress) {
    const total = totalChapters(item);
    const chapter = Math.max(0, Math.min(Number(progress[item.slug]) || 0, total));
    const label = shelfLabel(status);
    const progressText = chapter > 0
      ? chapter + " / " + total + " " + plural(total, ["глава", "главы", "глав"])
      : total + " " + plural(total, ["глава", "главы", "глав"]);
    const card = window.KurohaCards && window.KurohaCards.cardHTML
      ? window.KurohaCards.cardHTML(item)
      : '<p class="profile-note">Карточка временно недоступна.</p>';

    return (
      '<div class="shelf-item" data-status="' + escapeHTML(status) + '">' +
        card +
        '<div class="shelf-caption">' +
          '<span class="shelf-badge shelf-badge--' + escapeHTML(status) + '">' + escapeHTML(label) + "</span>" +
          '<span class="shelf-caption__progress">' + progressText + "</span>" +
        "</div>" +
      "</div>"
    );
  }

  function renderShelf(progress) {
    const grid = document.getElementById("profile-shelf");
    const empty = document.getElementById("shelf-empty");
    if (!grid || !empty) return;

    const statuses = getShelfStatuses();
    const entries = Object.keys(statuses).map(function (slug) {
      const item = bySlug.get(slug);
      if (!item) return null;
      const status = SHELF_LABELS[statuses[slug]] ? statuses[slug] : "planned";
      return { item: item, status: status };
    }).filter(Boolean);

    entries.sort(function (a, b) {
      const orderA = SHELF_ORDER.indexOf(a.status);
      const orderB = SHELF_ORDER.indexOf(b.status);
      if (orderA !== orderB) return orderA - orderB;
      return a.item.title.localeCompare(b.item.title, "ru");
    });

    const counts = { all: entries.length, reading: 0, planned: 0, completed: 0, paused: 0, dropped: 0 };
    entries.forEach(function (entry) {
      if (Object.prototype.hasOwnProperty.call(counts, entry.status)) counts[entry.status] += 1;
    });
    Object.keys(counts).forEach(function (key) {
      setText("shelf-count-" + key, counts[key]);
    });

    const filtered = shelfFilter === "all"
      ? entries
      : entries.filter(function (entry) { return entry.status === shelfFilter; });

    if (filtered.length === 0) {
      grid.innerHTML = "";
      grid.hidden = true;
      empty.hidden = false;
      const title = document.getElementById("shelf-empty-title");
      const copy = document.getElementById("shelf-empty-copy");
      if (entries.length === 0) {
        if (title) title.textContent = "Полка пока пуста";
        if (copy) copy.textContent = "Добавь историю со страницы тайтла — она появится здесь.";
      } else {
        if (title) title.textContent = "В этом статусе пока пусто";
        if (copy) copy.textContent = "Выбери другой статус или добавь историю.";
      }
      return;
    }

    grid.hidden = false;
    empty.hidden = true;
    grid.innerHTML = filtered.map(function (entry) {
      return shelfCard(entry.item, entry.status, progress);
    }).join("");
  }

  function updateShelfTabs() {
    document.querySelectorAll("[data-shelf-filter]").forEach(function (button) {
      const active = button.getAttribute("data-shelf-filter") === shelfFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function bindShelfTabs() {
    document.querySelectorAll("[data-shelf-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        const next = button.getAttribute("data-shelf-filter");
        if (!next) return;
        shelfFilter = next;
        updateShelfTabs();
        renderShelf(getProgress());
      });
    });
  }

  function renderStats(bookmarks, progress) {
    const historyCount = Object.keys(progress).length;
    const chapters = Object.keys(progress).reduce(function (sum, slug) {
      return sum + progress[slug];
    }, 0);
    const shelfCount = Object.keys(getShelfStatuses()).filter(function (slug) {
      return bySlug.has(slug);
    }).length;
    const ratingsCount = ratingsApi && typeof ratingsApi.countMine === "function"
      ? ratingsApi.countMine()
      : 0;

    setText("stat-shelf", shelfCount);
    setText("stat-bookmarks", bookmarks.length);
    setText("stat-history", historyCount);
    setText("stat-chapters", chapters);
    setText("stat-ratings", ratingsCount);
  }

  function renderYearTeaser(progress) {
    const chapters = Object.keys(progress).reduce(function (sum, slug) {
      return sum + progress[slug];
    }, 0);
    const shelfCount = Object.keys(getShelfStatuses()).filter(function (slug) {
      return bySlug.has(slug);
    }).length;
    const notesCount = notesApi && typeof notesApi.count === "function"
      ? notesApi.count()
      : 0;

    setText("year-teaser-chapters", chapters);
    setText("year-teaser-titles", shelfCount);
    setText("year-teaser-notes", notesCount);
  }

  function renderBookmarks(bookmarks) {
    const grid = document.getElementById("profile-bookmarks");
    const empty = document.getElementById("bookmarks-empty");
    if (!grid || !empty) return;

    if (bookmarks.length === 0) {
      grid.innerHTML = "";
      grid.hidden = true;
      empty.hidden = false;
      return;
    }

    grid.hidden = false;
    empty.hidden = true;

    if (!window.KurohaCards || !window.KurohaCards.cardHTML) {
      grid.innerHTML = '<p class="profile-note">Карточки временно недоступны.</p>';
      return;
    }

    grid.innerHTML = bookmarks.map(function (slug) {
      return window.KurohaCards.cardHTML(bySlug.get(slug));
    }).join("");
  }

  function renderHistory(progress) {
    const list = document.getElementById("profile-history");
    const empty = document.getElementById("history-empty");
    if (!list || !empty) return;

    const entries = Object.keys(progress).map(function (slug) {
      return { item: bySlug.get(slug), chapter: progress[slug] };
    }).filter(function (entry) {
      return Boolean(entry.item);
    });

    entries.sort(function (a, b) {
      const ratioA = a.chapter / totalChapters(a.item);
      const ratioB = b.chapter / totalChapters(b.item);
      if (ratioB !== ratioA) return ratioB - ratioA;
      return a.item.title.localeCompare(b.item.title, "ru");
    });

    if (entries.length === 0) {
      list.innerHTML = "";
      list.hidden = true;
      empty.hidden = false;
      return;
    }

    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = entries.map(function (entry) {
      return historyRow(entry.item, entry.chapter);
    }).join("");
  }

  function renderRatings() {
    const list = document.getElementById("profile-ratings");
    const empty = document.getElementById("ratings-empty");
    const count = document.getElementById("profile-ratings-count");
    if (!list || !empty) return;

    const entries = ratingsApi && typeof ratingsApi.allMine === "function"
      ? ratingsApi.allMine().filter(function (entry) { return bySlug.has(entry.slug); })
      : [];

    entries.sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

    if (count) {
      count.textContent = entries.length + " " + plural(entries.length, ["оценка", "оценки", "оценок"]);
    }

    if (entries.length === 0) {
      list.innerHTML = "";
      list.hidden = true;
      empty.hidden = false;
      return;
    }

    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = entries.map(function (entry) {
      const item = bySlug.get(entry.slug);
      const cover = window.KurohaCards && window.KurohaCards.miniCoverHTML
        ? window.KurohaCards.miniCoverHTML(item)
        : "";
      const when = ratingsApi && typeof ratingsApi.relativeTime === "function"
        ? ratingsApi.relativeTime(entry.updatedAt || entry.createdAt)
        : "";
      return (
        '<article class="rating-row" data-rating-slug="' + escapeHTML(entry.slug) + '">' +
          '<div class="rating-row__cover" aria-hidden="true">' + cover + "</div>" +
          '<div class="rating-row__body">' +
            '<h3><a href="title.html?slug=' + encodeURIComponent(entry.slug) + '">' + escapeHTML(item.title) + "</a></h3>" +
            '<p class="rating-row__meta">' + TYPE_LABELS[item.type] + " · оценено " + escapeHTML(when) + "</p>" +
            (entry.text ? '<p class="rating-row__text">' + escapeHTML(entry.text) + "</p>" : "") +
          "</div>" +
          '<div class="rating-row__score"><b>' + entry.score + "</b><span>из 10</span></div>" +
        "</article>"
      );
    }).join("");
  }

  function renderComments() {
    const list = document.getElementById("profile-comments");
    const empty = document.getElementById("comments-empty");
    const count = document.getElementById("profile-comments-count");
    if (!list || !empty) return;

    const entries = discussionApi && typeof discussionApi.allMine === "function"
      ? discussionApi.allMine().filter(function (entry) { return bySlug.has(entry.slug); })
      : [];

    if (count) {
      count.textContent = entries.length + " " + plural(entries.length, ["реплика", "реплики", "реплик"]);
    }

    if (entries.length === 0) {
      list.innerHTML = "";
      list.hidden = true;
      empty.hidden = false;
      return;
    }

    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = entries.map(function (entry) {
      const item = bySlug.get(entry.slug);
      const isChapter = entry.type === "chapter" && Number(entry.chapter) > 0;
      const href = isChapter
        ? "reader.html?slug=" + encodeURIComponent(entry.slug) + "&chapter=" + entry.chapter + "#chapter-discussion"
        : "title.html?slug=" + encodeURIComponent(entry.slug) + "#discussions";
      const where = isChapter ? "глава " + entry.chapter : "обсуждение тайтла";
      const when = discussionApi && typeof discussionApi.relativeTime === "function"
        ? discussionApi.relativeTime(entry.createdAt)
        : "";
      return (
        '<article class="comment-row" data-comment-type="' + escapeHTML(entry.type) + '"' +
          ' data-comment-slug="' + escapeHTML(entry.slug) + '"' +
          (isChapter ? ' data-comment-chapter="' + entry.chapter + '"' : "") + '>' +
          '<div class="comment-row__body">' +
            '<div class="comment-row__head">' +
              '<a class="comment-row__title" href="' + href + '">' + escapeHTML(item.title) + "</a>" +
              '<span class="comment-row__meta">' + TYPE_LABELS[item.type] + " · " + escapeHTML(where) + " · " + escapeHTML(when) + "</span>" +
            "</div>" +
            '<p class="comment-row__text">' + escapeHTML(entry.text) + "</p>" +
            '<a class="comment-row__link" href="' + href + '">Открыть обсуждение</a>' +
          "</div>" +
          '<button class="comment-row__remove" type="button" data-comment-remove="' + escapeHTML(entry.id) + '"' +
            ' aria-label="Удалить реплику">Удалить</button>' +
        "</article>"
      );
    }).join("");
  }

  function bindCommentActions() {
    const list = document.getElementById("profile-comments");
    if (!list || !discussionApi) return;

    list.addEventListener("click", function (event) {
      const button = event.target.closest("[data-comment-remove]");
      if (!button) return;
      const row = button.closest(".comment-row");
      if (!row) return;
      const type = row.getAttribute("data-comment-type");
      const slug = row.getAttribute("data-comment-slug");
      const chapter = Number(row.getAttribute("data-comment-chapter"));
      const id = button.getAttribute("data-comment-remove");
      const removed = type === "chapter"
        ? discussionApi.removeChapter(slug, chapter, id)
        : discussionApi.remove(slug, id);
      if (removed) {
        render();
        if (window.KurohaToast) window.KurohaToast("Реплика удалена.");
      }
    });
  }

  function renderMilestones(progress) {
    const grid = document.getElementById("profile-milestones");
    if (!grid) return;

    const chapters = Object.keys(progress).reduce(function (sum, slug) {
      return sum + progress[slug];
    }, 0);
    const shelfCount = Object.keys(getShelfStatuses()).filter(function (slug) {
      return bySlug.has(slug);
    }).length;
    const comments = discussionApi && typeof discussionApi.totalMine === "function"
      ? discussionApi.totalMine()
      : 0;
    const ratings = ratingsApi && typeof ratingsApi.countMine === "function"
      ? ratingsApi.countMine()
      : 0;
    const values = { chapters: chapters, shelf: shelfCount, comments: comments, ratings: ratings };
    let done = 0;

    grid.innerHTML = MILESTONES.map(function (milestone) {
      const current = Math.max(0, Math.min(milestone.target, values[milestone.kind] || 0));
      const complete = current >= milestone.target;
      if (complete) done += 1;
      return (
        '<article class="milestone' + (complete ? " is-done" : "") + '" data-milestone="' + milestone.id + '">' +
          '<span class="milestone__mark" aria-hidden="true">' + (complete ? "✓" : "") + "</span>" +
          '<div class="milestone__body">' +
            "<h3>" + escapeHTML(milestone.title) + "</h3>" +
            "<p>" + escapeHTML(milestone.copy) + "</p>" +
          "</div>" +
          '<span class="milestone__state">' +
            (complete ? "получено" : current + " / " + milestone.target) +
          "</span>" +
        "</article>"
      );
    }).join("");

    setText("milestones-count", done + " / " + MILESTONES.length);
  }

  function renderMode() {
    const mode = document.getElementById("profile-mode");
    if (!mode) return;
    const seeded = storageGet(SEED_KEY);
    if (seeded === "demo") {
      mode.textContent = "демо-профиль";
    } else if (seeded === "cleared") {
      mode.textContent = "локальные данные";
    } else {
      mode.textContent = "твой профиль";
    }
  }

  function render() {
    const bookmarks = getBookmarks();
    const progress = getProgress();
    renderStats(bookmarks, progress);
    renderYearTeaser(progress);
    renderShelf(progress);
    renderBookmarks(bookmarks);
    renderHistory(progress);
    renderRatings();
    renderComments();
    renderMilestones(progress);
    renderMode();
  }

  function bindReset() {
    document.querySelectorAll("[data-profile-reset]").forEach(function (button) {
      button.addEventListener("click", function () {
        storageRemove(BOOKMARKS_KEY);
        storageRemove(PROGRESS_KEY);
        storageRemove("kuroha-reader-position");
        storageRemove("kuroha-profile");
        storageRemove("kuroha-reading-goal");
        if (libraryApi && typeof libraryApi.clear === "function") {
          libraryApi.clear();
        } else {
          storageRemove("kuroha-library");
        }
        if (discussionApi) {
          if (typeof discussionApi.clearAll === "function") discussionApi.clearAll();
          if (typeof discussionApi.markSeeded === "function") discussionApi.markSeeded("cleared");
        } else {
          storageRemove("kuroha-discussions");
          storageRemove("kuroha-discussions-seeded");
        }
        if (notesApi && typeof notesApi.clear === "function") {
          notesApi.clear();
        } else {
          storageRemove("kuroha-notes");
          storageRemove("kuroha-notes-seeded");
        }
        storageRemove("kuroha-quote-likes");
        if (ratingsApi && typeof ratingsApi.clear === "function") {
          ratingsApi.clear();
        } else {
          storageRemove("kuroha-ratings");
        }
        storageSet("kuroha-rating-seeded", "cleared");
        storageRemove("kuroha-recommendation-hidden");
        storageRemove("kuroha-lists");
        storageSet("kuroha-lists-seeded", "cleared");
        storageRemove("kuroha-clubs");
        storageRemove("kuroha-club-votes");
        storageRemove("kuroha-club-rsvp");
        storageRemove("kuroha-reader-follows");
        storageRemove("kuroha-letters");
        storageSet("kuroha-letters-seeded", "cleared");
        storageRemove("kuroha-notifications");
        storageSet("kuroha-notifications-seeded", "cleared");
        if (window.KurohaNotifications && typeof window.KurohaNotifications.syncBadges === "function") {
          window.KurohaNotifications.syncBadges();
        }
        storageSet(SEED_KEY, "cleared");
        shelfFilter = "all";
        updateShelfTabs();
        render();
        if (window.KurohaToast) {
          window.KurohaToast("Демо-данные очищены. Полка, закладки, история, обсуждения, заметки, оценки, списки, клубы, голоса и уведомления очищены.");
        }
      });
    });
  }

  function scrollToHash() {
    if (location.hash !== "#milestones") return;
    const section = document.getElementById("milestones");
    if (!section) return;
    requestAnimationFrame(function () {
      section.scrollIntoView({ block: "start" });
    });
  }

  function init() {
    if (!document.getElementById("profile-shelf") && !document.getElementById("profile-bookmarks") && !document.getElementById("profile-history")) return;
    seedDemo();
    if (libraryApi && typeof libraryApi.migrate === "function") libraryApi.migrate();
    if (notesApi && typeof notesApi.ensureSeed === "function") notesApi.ensureSeed();
    render();
    bindReset();
    bindShelfTabs();
    bindCommentActions();
    updateShelfTabs();
    scrollToHash();

    window.addEventListener("storage", function (event) {
      if (event.key === BOOKMARKS_KEY || event.key === PROGRESS_KEY ||
          (libraryApi && event.key === libraryApi.STORAGE_KEY) ||
          (discussionApi && event.key === discussionApi.STORAGE_KEY) ||
          (discussionApi && event.key === discussionApi.CHAPTER_STORAGE_KEY) ||
          (notesApi && event.key === notesApi.STORAGE_KEY) ||
          (ratingsApi && event.key === ratingsApi.STORAGE_KEY)) {
        render();
      }
    });

    window.addEventListener("kuroha:library-change", function () {
      render();
    });

    window.addEventListener("kuroha:discussions-change", function () {
      render();
    });

    window.addEventListener("kuroha:chapter-discussions-change", function () {
      render();
    });

    window.addEventListener("kuroha:notes-change", function () {
      render();
    });

    window.addEventListener("kuroha:ratings-change", function () {
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

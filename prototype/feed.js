/* Kuroha feed — latest chapters from the library and local uploads. */
(function () {
  "use strict";

  const TITLES = window.KUROHA_TITLES || [];
  const bySlug = new Map(TITLES.map(function (item) { return [item.slug, item]; }));
  const uploadsApi = window.KurohaUploads;
  const libraryApi = window.KurohaLibrary;

  const TYPE_LABELS = { manga: "манга", manhwa: "манхва", manhua: "маньхуа", novel: "новелла" };
  const GENRE_LABELS = {
    fantasy: "фэнтези",
    romance: "романтика",
    drama: "драма",
    action: "экшен",
    mystery: "мистика",
    slice: "повседневность",
    history: "история",
    scifi: "фантастика",
    horror: "хоррор",
    comedy: "комедия",
    adventure: "приключения",
    thriller: "триллер"
  };
  const MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const DAY_MS = 24 * 60 * 60 * 1000;
  const SHELF_LABELS = {
    reading: "Читаю",
    planned: "В планах",
    completed: "Прочитано",
    paused: "Отложено",
    dropped: "Брошено"
  };

  let filter = "all";
  let allEvents = [];

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
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

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function dayDiff(timestamp) {
    return Math.round((startOfDay(new Date()) - startOfDay(new Date(timestamp))) / DAY_MS);
  }

  function dayLabel(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "Ранее";
    const diff = dayDiff(timestamp);
    if (diff <= 0) return "Сегодня";
    if (diff === 1) return "Вчера";
    return date.getDate() + " " + MONTHS[date.getMonth()];
  }

  function timeLabel(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const diff = dayDiff(timestamp);
    if (diff <= 0) return "сегодня, " + hours + ":" + minutes;
    if (diff === 1) return "вчера, " + hours + ":" + minutes;
    return date.getDate() + " " + MONTHS[date.getMonth()] + ", " + hours + ":" + minutes;
  }

  function totalChapters(item) {
    const base = Number(item.chapters) || 0;
    return uploadsApi && typeof uploadsApi.totalFor === "function"
      ? uploadsApi.totalFor(item.slug, base)
      : base;
  }

  function getStatus(slug) {
    if (!libraryApi) return "";
    if (typeof libraryApi.getStatus === "function") {
      return libraryApi.getStatus(slug) || "";
    }
    const statuses = typeof libraryApi.read === "function" ? libraryApi.read() : {};
    return statuses && statuses[slug] ? statuses[slug] : "";
  }

  function shelfLabel(status) {
    if (libraryApi && typeof libraryApi.label === "function") {
      return libraryApi.label(status);
    }
    return SHELF_LABELS[status] || "";
  }

  function baseEvent(item, index) {
    const timestamp = new Date(item.updated + "T00:05:00").getTime();
    return {
      slug: item.slug,
      item: item,
      chapter: Number(item.chapters) || 1,
      chapterName: "",
      pages: 0,
      source: "base",
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      tie: index,
      when: ""
    };
  }

  function uploadEvent(record) {
    const item = bySlug.get(record.slug);
    if (!item) return null;
    const timestamp = new Date(record.createdAt).getTime();
    return {
      slug: item.slug,
      item: item,
      chapter: Number(record.chapter) || 1,
      chapterName: String(record.chapterName || "").trim(),
      pages: Number(record.pages) || 0,
      source: "upload",
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
      tie: 0,
      when: timeLabel(timestamp)
    };
  }

  function collectEvents() {
    const candidates = TITLES.map(baseEvent);

    if (uploadsApi && typeof uploadsApi.read === "function") {
      uploadsApi.read().forEach(function (record) {
        const event = uploadEvent(record);
        if (event) candidates.push(event);
      });
    }

    const latest = new Map();
    candidates.forEach(function (event) {
      const previous = latest.get(event.slug);
      if (!previous ||
          event.timestamp > previous.timestamp ||
          (event.timestamp === previous.timestamp && event.chapter > previous.chapter)) {
        latest.set(event.slug, event);
      }
    });

    return Array.from(latest.values()).sort(function (a, b) {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      if (b.chapter !== a.chapter) return b.chapter - a.chapter;
      return a.item.title.localeCompare(b.item.title, "ru");
    });
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function metaText(event) {
    const item = event.item;
    const type = TYPE_LABELS[item.type] || item.type;
    const genres = (item.genres || []).slice(0, 2).map(function (slug) {
      return GENRE_LABELS[slug] || slug;
    });
    const total = totalChapters(item);
    const parts = [type].concat(genres);
    parts.push(total + " " + plural(total, ["глава", "главы", "глав"]));
    if (event.source === "upload" && event.pages > 0) {
      parts.push(event.pages + " " + plural(event.pages, ["страница", "страницы", "страниц"]));
    }
    return parts.join(" · ");
  }

  function feedRow(event) {
    const item = event.item;
    const total = totalChapters(item);
    const chapter = Math.max(1, Math.min(event.chapter, Math.max(1, total)));
    const readerHref = "reader.html?slug=" + encodeURIComponent(item.slug) +
      "&chapter=" + chapter;
    const titleHref = "title.html?slug=" + encodeURIComponent(item.slug);
    const status = getStatus(item.slug);
    const statusHTML = status
      ? '<span class="feed-status feed-status--' + escapeHTML(status) + '">' +
          escapeHTML(shelfLabel(status)) + "</span>"
      : "";
    const chapterName = event.chapterName
      ? '<span class="feed-row__chapter-name">' + escapeHTML(event.chapterName) + "</span>"
      : "";
    const newBadge = event.source === "upload"
      ? '<span class="feed-row__new">новая</span>'
      : "";
    const cover = window.KurohaCards && window.KurohaCards.miniCoverHTML
      ? window.KurohaCards.miniCoverHTML(item)
      : "";

    return (
      '<article class="feed-row">' +
        '<a class="feed-row__cover" href="' + readerHref + '" aria-label="Читать «' + escapeHTML(item.title) + '»">' +
          cover +
        "</a>" +
        '<div class="feed-row__body">' +
          '<div class="feed-row__top">' +
            '<h3 class="feed-row__title"><a href="' + titleHref + '">' + escapeHTML(item.title) + "</a></h3>" +
            (event.when ? '<span class="feed-row__time">' + escapeHTML(event.when) + "</span>" : "") +
          "</div>" +
          '<p class="feed-row__chapter">' +
            '<a href="' + readerHref + '">Глава ' + chapter + "</a>" +
            chapterName + newBadge +
          "</p>" +
          '<p class="feed-row__meta">' + escapeHTML(metaText(event)) + "</p>" +
        "</div>" +
        '<div class="feed-row__action">' +
          statusHTML +
          '<a class="btn btn--small btn--secondary" href="' + readerHref + '">Читать</a>' +
        "</div>" +
      "</article>"
    );
  }

  function renderGroups(events) {
    const groups = [];
    events.forEach(function (event) {
      const label = dayLabel(event.timestamp);
      let group = groups.find(function (entry) { return entry.label === label; });
      if (!group) {
        group = { label: label, events: [] };
        groups.push(group);
      }
      group.events.push(event);
    });

    return groups.map(function (group) {
      return (
        '<section class="feed-group" aria-label="' + escapeHTML(group.label) + '">' +
          '<div class="feed-day">' +
            "<h2>" + escapeHTML(group.label) + "</h2>" +
            "<span>" + group.events.length + " " +
              plural(group.events.length, ["обновление", "обновления", "обновлений"]) +
            "</span>" +
          "</div>" +
          '<div class="feed-rows">' +
            group.events.map(feedRow).join("") +
          "</div>" +
        "</section>"
      );
    }).join("");
  }

  function updateFilter() {
    document.querySelectorAll("[data-feed-filter]").forEach(function (button) {
      const active = button.getAttribute("data-feed-filter") === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function render() {
    const list = document.getElementById("feed-list");
    const empty = document.getElementById("feed-empty");
    if (!list || !empty) return;

    const shelfEvents = allEvents.filter(function (event) {
      return Boolean(getStatus(event.slug));
    });
    const todayEvents = allEvents.filter(function (event) {
      return dayDiff(event.timestamp) <= 0;
    });
    const filtered = filter === "following" ? shelfEvents : allEvents;

    setText("feed-total", allEvents.length);
    setText("feed-shelf", shelfEvents.length);
    setText("feed-today", todayEvents.length);
    setText("feed-count-all", allEvents.length);
    setText("feed-count-shelf", shelfEvents.length);

    updateFilter();

    if (filtered.length === 0) {
      list.innerHTML = "";
      list.hidden = true;
      empty.hidden = false;
      const title = document.getElementById("feed-empty-title");
      const copy = document.getElementById("feed-empty-copy");
      if (filter === "following") {
        if (title) title.textContent = "На полке пока тихо";
        if (copy) copy.textContent = "Добавь истории со страницы тайтла — их обновления появятся здесь.";
      } else {
        if (title) title.textContent = "Пока тихо";
        if (copy) copy.textContent = "Новые главы появятся здесь, как только выйдут.";
      }
      return;
    }

    list.hidden = false;
    empty.hidden = true;
    list.innerHTML = renderGroups(filtered);
  }

  function bind() {
    document.querySelectorAll("[data-feed-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        const next = button.getAttribute("data-feed-filter");
        if (!next || next === filter) return;
        filter = next;
        render();
      });
    });

    window.addEventListener("storage", function (event) {
      if (event.key === "kuroha-admin-uploads" ||
          (libraryApi && event.key === libraryApi.STORAGE_KEY)) {
        allEvents = collectEvents();
        render();
      }
    });

    window.addEventListener("kuroha:library-change", function () {
      render();
    });
  }

  function init() {
    if (!document.getElementById("feed-list")) return;
    if (libraryApi && typeof libraryApi.migrate === "function") {
      libraryApi.migrate();
    }
    allEvents = collectEvents();
    bind();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

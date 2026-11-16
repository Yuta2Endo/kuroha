(function () {
  const TITLES = window.KUROHA_TITLES || [];
  const clubs = window.KUROHA_CLUBS || [];
  const cards = window.KurohaCards;
  const libraryApi = window.KurohaLibrary;
  const uploadsApi = window.KurohaUploads;
  const RSVP_KEY = "kuroha-club-rsvp";

  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };

  const WEEKDAYS = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"
  ];

  const TIMES = ["18:00", "18:40", "19:20", "20:00", "20:40", "21:20"];
  const DAY = 24 * 60 * 60 * 1000;
  const MONTHS = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря"
  ];

  let filter = "all";
  let releases = [];

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

  function totalChapters(book) {
    return uploadsApi && uploadsApi.totalFor
      ? uploadsApi.totalFor(book.slug, book.chapters)
      : book.chapters;
  }

  function shelfStatuses() {
    if (!libraryApi) return {};
    try {
      return libraryApi.read() || {};
    } catch (error) {
      return {};
    }
  }

  function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function dateAt(offset) {
    return new Date(startOfDay(new Date()).getTime() + offset * DAY);
  }

  function dateLabel(date) {
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }

  function dayLabel(offset, date) {
    if (offset === 0) return "Сегодня";
    if (offset === 1) return "Завтра";
    return WEEKDAYS[date.getDay()];
  }

  function readRsvp() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RSVP_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter((slug) => clubs.some((club) => club.slug === slug))
        : [];
    } catch (error) {
      return [];
    }
  }

  function isGoing(slug) {
    return readRsvp().includes(slug);
  }

  function toggleRsvp(slug) {
    const joined = readRsvp();
    const next = joined.includes(slug)
      ? joined.filter((entry) => entry !== slug)
      : joined.concat(slug);
    try {
      localStorage.setItem(RSVP_KEY, JSON.stringify(next));
    } catch (error) {}
    const going = next.includes(slug);
    window.dispatchEvent(
      new CustomEvent("kuroha:club-rsvp-change", {
        detail: { slug: slug, going: going }
      })
    );
    return going;
  }

  function meetingDate(club) {
    const date = dateAt(Number(club.nextDay) || 0);
    const parts = String(club.nextTime || "21:00").split(":");
    date.setHours(Number(parts[0]) || 21, Number(parts[1]) || 0, 0, 0);
    return date;
  }

  function meetingDayLabel(club) {
    const offset = Number(club.nextDay) || 0;
    if (offset === 0) return "Сегодня";
    if (offset === 1) return "Завтра";
    return WEEKDAYS[dateAt(offset).getDay()];
  }

  function shortMonth(date) {
    return MONTHS[date.getMonth()].slice(0, 3);
  }

  function coverFor(book) {
    return cards && cards.miniCoverHTML ? cards.miniCoverHTML(book) : "";
  }

  function buildReleases() {
    const ongoing = TITLES.filter((book) => book.status === "ongoing")
      .slice()
      .sort((a, b) => b.popularity - a.popularity);

    const byDay = Array.from({ length: 7 }, () => ({}));
    const result = ongoing.map((book, index) => {
      const offset = index % 7;
      const slot = byDay[offset].slot || 0;
      byDay[offset].slot = slot + 1;
      return {
        book,
        offset,
        date: dateAt(offset),
        time: TIMES[slot % TIMES.length],
        chapter: totalChapters(book) + 1,
        total: totalChapters(book)
      };
    });

    return result.sort((a, b) => a.offset - b.offset || a.time.localeCompare(b.time));
  }

  function visibleReleases() {
    if (filter !== "shelf") return releases;
    const shelf = shelfStatuses();
    return releases.filter((entry) => Boolean(shelf[entry.book.slug]));
  }

  function renderSummary(rows) {
    const summary = document.querySelector("#schedule-summary");
    if (!summary) return;

    if (!rows.length) {
      summary.innerHTML = `<div class="schedule-summary__empty">
          <p class="paper-label">Пока тихо</p>
          <h2>На этой полке нет новых глав.</h2>
          <p>Добавь историю на полку или посмотри весь каталог — расписание подождёт.</p>
          <a class="btn btn--secondary" href="catalog.html">Открыть каталог</a>
        </div>`;
      return;
    }

    const next = rows[0];
    const book = next.book;
    summary.innerHTML = `<div class="schedule-summary__top">
        <span class="paper-label">Ближайшая глава</span>
        <span>${dayLabel(next.offset, next.date)}, ${next.time}</span>
      </div>
      <a class="schedule-summary__content" href="title.html?slug=${encodeURIComponent(book.slug)}">
        <div class="schedule-summary__cover">${coverFor(book)}</div>
        <div class="schedule-summary__body">
          <span class="schedule-summary__time">${dateLabel(next.date)} · ${next.time}</span>
          <h2>${escapeHTML(book.title)}</h2>
          <p>${TYPE_LABELS[book.type] || book.type} · глава ${next.chapter}</p>
          <span class="schedule-summary__rating">★ ${formatRating(book.rating)}</span>
        </div>
      </a>`;
  }

  function slotHTML(entry) {
    const book = entry.book;
    return `<a class="schedule-slot" href="title.html?slug=${encodeURIComponent(book.slug)}">
        <span class="schedule-slot__time">${entry.time}</span>
        <div class="schedule-slot__cover">${coverFor(book)}</div>
        <div class="schedule-slot__body">
          <h4>${escapeHTML(book.title)}</h4>
          <p>Глава ${entry.chapter}</p>
          <span>${TYPE_LABELS[book.type] || book.type}</span>
        </div>
      </a>`;
  }

  function renderWeek(rows) {
    const week = document.querySelector("#schedule-week");
    if (!week) return;

    if (!rows.length) {
      week.innerHTML = "";
      week.hidden = true;
      return;
    }

    week.hidden = false;
    const grouped = new Map();
    rows.forEach((entry) => {
      if (!grouped.has(entry.offset)) grouped.set(entry.offset, []);
      grouped.get(entry.offset).push(entry);
    });

    week.innerHTML = Array.from({ length: 7 }, (_, offset) => {
      const items = grouped.get(offset) || [];
      const date = dateAt(offset);
      return `<section class="schedule-day${items.length ? "" : " schedule-day--quiet"}">
          <header class="schedule-day__head">
            <div>
              <h3>${dayLabel(offset, date)}</h3>
              <p>${dateLabel(date)}</p>
            </div>
            <span>${items.length}</span>
          </header>
          <div class="schedule-day__list">${
            items.length ? items.map(slotHTML).join("") : '<p class="schedule-day__quiet">тихо</p>'
          }</div>
        </section>`;
    }).join("");
  }

  function meetingCardHTML(club) {
    const meeting = club.meeting || {};
    if (!meeting.topic) return "";

    const date = meetingDate(club);
    const going = isGoing(club.slug);
    const attending = (Number(meeting.attending) || 0) + (going ? 1 : 0);
    const seats = Number(meeting.seats) || 0;
    const time = club.nextTime || "21:00";
    const place = meeting.place ? " · " + escapeHTML(meeting.place) : "";

    return `<article class="schedule-meeting" style="--club-accent:${escapeHTML(club.accent || "#E63946")}">
        <div class="schedule-meeting__date">
          <b>${date.getDate()}</b>
          <span>${escapeHTML(shortMonth(date))}</span>
        </div>
        <div class="schedule-meeting__body">
          <div class="schedule-meeting__top">
            <span class="schedule-meeting__club">${escapeHTML(club.name)}</span>
            <span class="schedule-meeting__when">${meetingDayLabel(club)}, ${escapeHTML(time)}</span>
          </div>
          <h3>${escapeHTML(meeting.topic)}</h3>
          <p class="schedule-meeting__meta">${escapeHTML(meeting.duration || "")}${place}</p>
          <p class="schedule-meeting__note">${escapeHTML(meeting.note || "")}</p>
          <div class="schedule-meeting__foot">
            <span class="schedule-meeting__people"><b>${attending}</b> ${plural(attending, [
              "идёт",
              "идут",
              "идут"
            ])}${seats ? ` · ${seats} мест` : ""}${going ? " · ты в списке" : ""}</span>
            <div class="schedule-meeting__actions">
              <button class="schedule-meeting__rsvp${going ? " is-active" : ""}" type="button" data-schedule-rsvp="${escapeHTML(club.slug)}" aria-pressed="${going}">
                <span class="schedule-meeting__dot" aria-hidden="true"></span>
                ${going ? "Ты идёшь" : "Буду"}
              </button>
              <a class="schedule-meeting__link" href="clubs.html?club=${encodeURIComponent(club.slug)}">К клубу</a>
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderMeetings() {
    const list = document.querySelector("#schedule-meeting-list");
    if (!list) return;

    const sorted = clubs
      .slice()
      .sort(
        (a, b) =>
          (Number(a.nextDay) || 0) - (Number(b.nextDay) || 0) ||
          String(a.nextTime || "").localeCompare(String(b.nextTime || ""))
      );
    const items = sorted.map(meetingCardHTML).filter(Boolean);

    list.innerHTML = items.join("");
    const count = document.querySelector("#schedule-meeting-count");
    if (count) {
      count.textContent = `${items.length} ${plural(items.length, ["встреча", "встречи", "встреч"])}`;
    }
    const section = list.closest(".schedule-meetings");
    if (section) section.hidden = !items.length;
  }

  function bindMeetings() {
    const list = document.querySelector("#schedule-meeting-list");
    if (list) {
      list.addEventListener("click", (event) => {
        const button = event.target.closest("[data-schedule-rsvp]");
        if (!button) return;

        const slug = button.dataset.scheduleRsvp;
        const club = clubs.find((item) => item.slug === slug);
        const going = toggleRsvp(slug);

        if (window.KurohaToast) {
          window.KurohaToast(
            going
              ? `Ты идёшь на встречу клуба «${club ? club.name : "Kuroha"}».`
              : "Отметка о встрече убрана."
          );
        }
      });
    }

    window.addEventListener("kuroha:club-rsvp-change", renderMeetings);
  }

  function updateCounts(rows) {
    const allCount = releases.length;
    const shelf = shelfStatuses();
    const shelfCount = releases.filter((entry) => Boolean(shelf[entry.book.slug])).length;
    const today = releases.filter((entry) => entry.offset === 0).length;

    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = String(value);
    };

    set("#schedule-today", today);
    set("#schedule-week-count", allCount);
    set("#schedule-shelf-count", shelfCount);
    set("#schedule-count-all", allCount);
    set("#schedule-count-shelf", shelfCount);
    set("#schedule-count", `${rows.length} ${plural(rows.length, ["глава", "главы", "глав"])}`);

    const empty = document.querySelector("#schedule-empty");
    const week = document.querySelector("#schedule-week");
    if (empty) empty.hidden = rows.length > 0;
    if (week && !rows.length) week.hidden = true;
  }

  function updateFilters() {
    document.querySelectorAll("[data-schedule-filter]").forEach((button) => {
      const active = button.dataset.scheduleFilter === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function render() {
    const rows = visibleReleases();
    updateFilters();
    updateCounts(rows);
    renderSummary(rows);
    renderWeek(rows);
  }

  function init() {
    releases = buildReleases();
    document.querySelectorAll("[data-schedule-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        filter = button.dataset.scheduleFilter === "shelf" ? "shelf" : "all";
        render();
      });
    });
    window.addEventListener("kuroha:library-change", render);
    window.addEventListener("storage", (event) => {
      if (event.key === RSVP_KEY) {
        renderMeetings();
        return;
      }
      if (!event.key || event.key === "kuroha-library" || event.key === "kuroha-admin-uploads") render();
    });
    render();
    renderMeetings();
    bindMeetings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

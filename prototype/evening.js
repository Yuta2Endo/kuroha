/* Kuroha — «Мой вечер»: личная страница возвращения. */
(function () {
  "use strict";

  if (document.body.dataset.page !== "evening") return;

  const titles = Array.isArray(window.KUROHA_TITLES) ? window.KUROHA_TITLES : [];
  const readers = Array.isArray(window.KUROHA_READERS) ? window.KUROHA_READERS : [];
  const clubs = Array.isArray(window.KUROHA_CLUBS) ? window.KUROHA_CLUBS : [];
  const quotes = Array.isArray(window.KUROHA_QUOTES) ? window.KUROHA_QUOTES : [];
  const cards = window.KurohaCards;
  const uploads = window.KurohaUploads;
  const lettersApi = window.KurohaLetters;
  const notificationsApi = window.KurohaNotifications;

  const PROGRESS_KEY = "kuroha-progress";
  const POSITION_KEY = "kuroha-reader-position";
  const GOAL_KEY = "kuroha-reading-goal";
  const RSVP_KEY = "kuroha-club-rsvp";
  const FOLLOW_KEY = "kuroha-reader-follows";
  const TASTE_KEY = "kuroha-taste";
  const FALLBACK_SLUG = "pepel-i-luna";
  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };
  const UPDATE_TIMES = ["сегодня, 21:14", "вчера, 23:40", "2 дня назад", "на этой неделе"];

  const bySlug = new Map(titles.map((item) => [item.slug, item]));
  const byReader = new Map(readers.map((reader) => [reader.slug, reader]));
  const $ = (selector) => document.querySelector(selector);
  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function plural(value, forms) {
    const abs = Math.abs(Number(value) || 0) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function formatRating(value) {
    return String(value == null ? "" : value).replace(".", ",");
  }

  function totalChapters(item) {
    const base = Number(item.chapters) || 0;
    if (uploads && typeof uploads.totalFor === "function") {
      return Math.max(base, Number(uploads.totalFor(item.slug, base)) || base);
    }
    return base;
  }

  function clampChapter(value, total) {
    return Math.min(total || 1, Math.max(1, Number(value) || 1));
  }

  function latestPosition(positions) {
    return Object.entries(positions)
      .filter(([key, value]) => {
        if (typeof key !== "string" || !key.includes(":")) return false;
        if (!value || typeof value !== "object") return false;
        return Number.isFinite(Number(value.percent));
      })
      .sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")))[0] || null;
  }

  function latestProgress(progress) {
    return Object.entries(progress)
      .filter(([slug, chapter]) => bySlug.has(slug) && Number(chapter) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0] || null;
  }

  function resolveContinue() {
    const progress = readJSON(PROGRESS_KEY, {});
    const positions = readJSON(POSITION_KEY, {});
    let slug = null;
    let chapter = 1;
    let hasProgress = false;

    const lastPosition = latestPosition(positions);
    if (lastPosition) {
      const [positionSlug, positionChapter] = lastPosition[0].split(":");
      if (bySlug.has(positionSlug)) {
        slug = positionSlug;
        chapter = Number(positionChapter) || 1;
        hasProgress = true;
      }
    }

    if (!slug) {
      const lastProgress = latestProgress(progress);
      if (lastProgress) {
        slug = lastProgress[0];
        chapter = Number(lastProgress[1]) || 1;
        hasProgress = true;
      }
    }

    if (!slug) {
      slug = FALLBACK_SLUG;
      chapter = 1;
      hasProgress = false;
    }

    const item = bySlug.get(slug) || bySlug.get(FALLBACK_SLUG);
    if (!item) return null;
    const total = totalChapters(item);
    chapter = clampChapter(chapter, total);
    const completed = hasProgress && chapter >= total;
    const percent = completed ? 100 : hasProgress ? Math.round((chapter / total) * 100) : 0;

    return { item, chapter, total, hasProgress, completed, percent };
  }

  function renderContinue() {
    const state = resolveContinue();
    if (!state) return;
    const { item, chapter, total, hasProgress, completed, percent } = state;
    const href = "reader.html?slug=" + encodeURIComponent(item.slug) + "&chapter=" + chapter;
    const label = completed
      ? "История прочитана"
      : hasProgress
        ? "Продолжить чтение"
        : "Начни с первой главы";
    const chapterText = completed
      ? "До последней страницы."
      : hasProgress
        ? "Ты остановился на " + chapter + " главе"
        : "Первая страница уже здесь.";
    const cta = completed ? "Перечитать" : hasProgress ? "Продолжить" : "Начать";
    const heroCta = completed ? "Перечитать" : hasProgress ? "Продолжить чтение" : "Начать читать";

    setText("evening-label", label);
    setText("evening-book", item.title);
    setText(
      "evening-meta",
      (TYPE_LABELS[item.type] || item.type) + " · " + total + " " +
      plural(total, ["глава", "главы", "глав"]) + " · ★ " + formatRating(item.rating)
    );
    setText("evening-chapter", chapterText);
    setText("evening-count", (hasProgress ? chapter : 0) + " / " + total + " глав");
    setText("evening-percent", percent + "%");

    const progress = document.getElementById("evening-progress");
    if (progress) {
      progress.setAttribute("aria-valuenow", String(percent));
      const fill = progress.querySelector("span");
      if (fill) fill.style.width = percent + "%";
    }

    const readLink = document.getElementById("evening-read-link");
    if (readLink) {
      readLink.href = href;
      readLink.textContent = cta;
    }

    const heroLink = document.getElementById("evening-continue-link");
    if (heroLink) {
      heroLink.href = href;
      heroLink.textContent = heroCta;
    }

    const coverHost = document.getElementById("evening-cover");
    if (coverHost && cards && typeof cards.coverHTML === "function") {
      coverHost.innerHTML = cards.coverHTML(item, "cover--lg");
    }
  }

  function renderGoal() {
    const goal = readJSON(GOAL_KEY, {});
    const target = Math.min(5000, Math.max(50, Number(goal.target) || 500));
    const progress = readJSON(PROGRESS_KEY, {});
    const chapters = Object.entries(progress).reduce((sum, [slug, chapter]) => {
      if (!bySlug.has(slug)) return sum;
      return sum + Math.max(1, Number(chapter) || 0);
    }, 0);
    const percent = Math.min(100, Math.round((chapters / target) * 100));
    const left = Math.max(0, target - chapters);
    const ring = document.querySelector(".evening-goal__ring");
    if (ring) ring.style.setProperty("--goal", String(percent));

    setText("evening-goal-current", String(chapters));
    setText("evening-goal-target", String(target));
    setText("evening-goal-percent", percent + "%");
    setText(
      "evening-goal-note",
      percent >= 100
        ? "Цель собрана. Можно поставить новую."
        : "Осталось " + left + " " + plural(left, ["глава", "главы", "глав"]) + ". Без спешки."
    );
  }

  function renderLetters() {
    let data = {};
    if (lettersApi && typeof lettersApi.read === "function") {
      data = lettersApi.read() || {};
    }
    const conversations = Object.keys(data).length;
    const unread = lettersApi && typeof lettersApi.unreadCount === "function"
      ? lettersApi.unreadCount()
      : 0;
    setText("evening-letters", String(unread));
    setText(
      "evening-letters-title",
      conversations
        ? conversations + " " + plural(conversations, ["переписка", "переписки", "переписок"])
        : "Писем пока нет"
    );
    setText(
      "evening-letters-copy",
      unread
        ? unread + " " + plural(unread, ["непрочитанное письмо", "непрочитанных письма", "непрочитанных писем"])
        : conversations
          ? "Все письма прочитаны."
          : "Начни разговор с читателем."
    );
  }

  function renderNotifications() {
    if (notificationsApi && typeof notificationsApi.ensureSeed === "function") {
      notificationsApi.ensureSeed();
    }
    const items = notificationsApi && typeof notificationsApi.read === "function"
      ? notificationsApi.read()
      : [];
    const unread = notificationsApi && typeof notificationsApi.unreadCount === "function"
      ? notificationsApi.unreadCount(items)
      : 0;
    setText("evening-notifications", String(unread));
    setText(
      "evening-notif-title",
      unread ? unread + " " + plural(unread, ["новое", "новых", "новых"]) : "Всё тихо"
    );
    setText(
      "evening-notif-copy",
      unread ? "Главы, ответы и вехи ждут." : "Новых событий нет."
    );
  }

  function readRsvp() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RSVP_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((slug) => clubs.some((club) => club.slug === slug)) : [];
    } catch (error) {
      return [];
    }
  }

  function toggleRsvp(slug) {
    const current = readRsvp();
    const next = current.includes(slug)
      ? current.filter((entry) => entry !== slug)
      : current.concat(slug);
    try {
      localStorage.setItem(RSVP_KEY, JSON.stringify(next));
    } catch (error) {}
    window.dispatchEvent(
      new CustomEvent("kuroha:club-rsvp-change", { detail: { slug: slug, going: next.includes(slug) } })
    );
    return next.includes(slug);
  }

  function meetingDate(club) {
    const date = new Date();
    date.setDate(date.getDate() + (Number(club.nextDay) || 0));
    const parts = String(club.nextTime || "21:00").split(":");
    date.setHours(Number(parts[0]) || 21, Number(parts[1]) || 0, 0, 0);
    return date;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  function meetingDayLabel(club) {
    const offset = Number(club.nextDay) || 0;
    if (offset === 0) return "Сегодня";
    if (offset === 1) return "Завтра";
    return capitalize(new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(meetingDate(club)));
  }

  function nearestClub() {
    return clubs
      .filter((club) => club.meeting)
      .slice()
      .sort((a, b) => (Number(a.nextDay) || 0) - (Number(b.nextDay) || 0) ||
        String(a.nextTime || "").localeCompare(String(b.nextTime || "")))[0] || null;
  }

  function renderClub() {
    const club = nearestClub();
    const section = document.getElementById("evening-club-section");
    const host = document.getElementById("evening-club");
    const meetingCount = clubs.filter((entry) => entry.meeting).length;
    setText("evening-meetings", String(meetingCount));
    if (!club || !club.meeting || !host) {
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;

    const going = readRsvp().includes(club.slug);
    const meeting = club.meeting;
    const attending = (Number(meeting.attending) || 0) + (going ? 1 : 0);
    const people = attending + " идут · " + (Number(meeting.seats) || 0) + " мест" +
      (going ? " · ты в списке" : "");

    host.style.setProperty("--club-accent", club.accent || "#E63946");
    host.innerHTML =
      '<div class="evening-club__date"><span>' + escapeHTML(meetingDayLabel(club)) + '</span>' +
        '<strong>' + escapeHTML(club.nextTime || "21:00") + '</strong></div>' +
      '<div class="evening-club__body">' +
        '<p class="paper-label">' + escapeHTML(club.name) + '</p>' +
        '<h3>' + escapeHTML(meeting.topic || "Встреча клуба") + '</h3>' +
        '<p>' + escapeHTML(meeting.duration || "60 минут") + ' · ' + escapeHTML(meeting.place || "Онлайн") + '</p>' +
        '<small>' + escapeHTML(meeting.note || "") + '</small>' +
      '</div>' +
      '<div class="evening-club__side">' +
        '<span class="evening-club__people">' + escapeHTML(people) + '</span>' +
        '<button class="evening-club__rsvp" type="button" data-evening-rsvp="' + escapeHTML(club.slug) + '" aria-pressed="' + (going ? "true" : "false") + '">' +
          '<span aria-hidden="true"></span>' + (going ? "Ты идёшь" : "Буду") +
        '</button>' +
        '<a class="evening-club__link" href="clubs.html?club=' + encodeURIComponent(club.slug) + '">К клубу</a>' +
      '</div>';
  }

  function readFollows() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((slug) => byReader.has(slug)) : [];
    } catch (error) {
      return [];
    }
  }

  function updateHTML(update, index) {
    const reader = update.reader;
    const avatar =
      '<a class="evening-update__avatar" href="readers.html?reader=' + encodeURIComponent(reader.slug) + '" ' +
      'style="--reader-accent:' + escapeHTML(reader.accent || "#E63946") + '" aria-label="' + escapeHTML(reader.name) + '">' +
      escapeHTML(reader.initials || "•") + '</a>';
    let body = "";

    if (update.type === "reading") {
      const book = update.book;
      const href = "reader.html?slug=" + encodeURIComponent(book.slug) + "&chapter=" + update.chapter;
      const cover = cards && typeof cards.miniCoverHTML === "function" ? cards.miniCoverHTML(book) : "";
      body =
        '<div class="evening-update__book">' +
          '<a class="evening-update__cover" href="' + href + '" aria-label="Читать «' + escapeHTML(book.title) + '»">' + cover + '</a>' +
          '<div class="evening-update__book-body">' +
            '<a class="evening-update__book-title" href="' + href + '">' + escapeHTML(book.title) + '</a>' +
            '<p>' + escapeHTML(TYPE_LABELS[book.type] || book.type) + ' · глава ' + update.chapter + ' из ' + update.total + '</p>' +
            '<div class="evening-update__bar" role="progressbar" aria-valuenow="' + update.percent + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + update.percent + '%"></span></div>' +
          '</div>' +
          '<a class="evening-update__go" href="' + href + '">Читать</a>' +
        '</div>';
    } else {
      body =
        '<div class="evening-update__quote">' +
          '<p>«' + escapeHTML(update.quote.text) + '»</p>' +
          '<a href="reader.html?slug=' + encodeURIComponent(update.quote.slug) + '&chapter=' + update.quote.chapter + '">' +
            escapeHTML(update.bookTitle) + ' · глава ' + update.quote.chapter +
          '</a>' +
        '</div>';
    }

    return '<article class="evening-update" data-update-type="' + update.type + '" style="--reader-accent:' + escapeHTML(reader.accent || "#E63946") + '">' +
      avatar +
      '<div class="evening-update__body">' +
        '<div class="evening-update__head">' +
          '<a class="evening-update__name" href="readers.html?reader=' + encodeURIComponent(reader.slug) + '">' + escapeHTML(reader.name) + '</a>' +
          '<span>· ' + (update.type === "reading" ? "читает" : "цитата") + '</span>' +
          '<time>' + UPDATE_TIMES[index % UPDATE_TIMES.length] + '</time>' +
        '</div>' +
        body +
      '</div>' +
    '</article>';
  }

  function renderUpdates() {
    const list = document.getElementById("evening-updates");
    const empty = document.getElementById("evening-updates-empty");
    if (!list) return;
    const updates = [];
    readFollows().slice(0, 2).forEach((slug) => {
      const reader = byReader.get(slug);
      if (!reader) return;
      const book = reader.current ? bySlug.get(reader.current.slug) : null;
      if (book) {
        const total = totalChapters(book);
        const chapter = clampChapter(reader.current.chapter, total);
        updates.push({
          type: "reading",
          reader: reader,
          book: book,
          chapter: chapter,
          total: total,
          percent: Math.round((chapter / total) * 100)
        });
      }
      if (reader.quote) {
        const quoteBook = bySlug.get(reader.quote.slug);
        if (quoteBook) {
          updates.push({
            type: "quote",
            reader: reader,
            quote: reader.quote,
            bookTitle: quoteBook.title
          });
        }
      }
    });
    const visible = updates.slice(0, 4);
    list.innerHTML = visible.map(updateHTML).join("");
    if (empty) empty.hidden = visible.length > 0;
  }

  function renderQuote() {
    const section = document.getElementById("evening-quote-section");
    if (!quotes.length) {
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;
    const taste = readJSON(TASTE_KEY, null);
    const tasteGenres = taste && Array.isArray(taste.genres) ? taste.genres : [];
    const preferred = tasteGenres.length
      ? quotes.filter(function (entry) {
          const book = bySlug.get(entry.slug);
          return book && (book.genres || []).some(function (genre) {
            return tasteGenres.indexOf(genre) !== -1;
          });
        })
      : [];
    const pool = preferred.length ? preferred : quotes;
    const quote = pool[new Date().getDate() % pool.length];
    const reader = byReader.get(quote.reader);
    const book = bySlug.get(quote.slug);
    if (!book) return;

    setText("evening-quote-text", "«" + quote.quote + "»");

    const readerLink = document.getElementById("evening-quote-reader");
    if (readerLink && reader) {
      readerLink.href = "readers.html?reader=" + encodeURIComponent(reader.slug);
      readerLink.textContent = reader.name;
    }

    const sourceLink = document.getElementById("evening-quote-source");
    if (sourceLink) {
      sourceLink.href = "reader.html?slug=" + encodeURIComponent(book.slug) + "&chapter=" + quote.chapter;
      sourceLink.textContent = book.title + " · глава " + quote.chapter;
    }
  }

  function renderDate() {
    const now = new Date();
    const date = capitalize(
      new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(now)
    );
    setText("evening-date", date);
    const hour = now.getHours();
    const greeting = hour < 5
      ? "Ночь ещё не закончилась."
      : hour < 12
        ? "Утро. История уже открыта."
        : hour < 18
          ? "День клонится к вечеру."
          : "Вечер. Самое время читать.";
    setText("evening-greeting", greeting);
  }

  function renderAll() {
    renderDate();
    renderContinue();
    renderGoal();
    renderLetters();
    renderNotifications();
    renderClub();
    renderUpdates();
    renderQuote();
  }

  function bind() {
    const clubHost = document.getElementById("evening-club");
    if (clubHost) {
      clubHost.addEventListener("click", (event) => {
        const button = event.target.closest("[data-evening-rsvp]");
        if (!button) return;
        const slug = button.dataset.eveningRsvp;
        const going = toggleRsvp(slug);
        const club = clubs.find((entry) => entry.slug === slug);
        renderClub();
        if (window.KurohaToast && club) {
          window.KurohaToast(going ? "Ты идёшь на встречу клуба «" + club.name + "»." : "Отметка о встрече убрана.");
        }
      });
    }

    window.addEventListener("storage", (event) => {
      if (!event.key) return;
      if (event.key === PROGRESS_KEY || event.key === POSITION_KEY) {
        renderContinue();
        renderGoal();
      } else if (event.key === GOAL_KEY) {
        renderGoal();
      } else if (event.key === "kuroha-letters") {
        renderLetters();
      } else if (event.key === "kuroha-notifications") {
        renderNotifications();
      } else if (event.key === RSVP_KEY) {
        renderClub();
      } else if (event.key === FOLLOW_KEY) {
        renderUpdates();
      } else if (event.key === TASTE_KEY) {
        renderQuote();
      }
    });

    window.addEventListener("kuroha:notifications-change", renderNotifications);
    window.addEventListener("kuroha:letters-change", renderLetters);
    window.addEventListener("kuroha:reader-follow-change", renderUpdates);
    window.addEventListener("kuroha:club-rsvp-change", renderClub);
    window.addEventListener("kuroha:taste-change", renderQuote);
    window.addEventListener("pageshow", renderAll);
  }

  function init() {
    renderAll();
    bind();
  }

  window.KurohaEvening = { render: renderAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

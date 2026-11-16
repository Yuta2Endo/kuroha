/* Kuroha prototype — reading clubs page. */
(function () {
  "use strict";

  if (document.body.dataset.page !== "clubs") return;

  const clubs = window.KUROHA_CLUBS || [];
  const titles = window.KUROHA_TITLES || [];
  const cards = window.KurohaCards;
  const uploads = window.KurohaUploads;
  const STORAGE_KEY = "kuroha-clubs";
  const VOTE_KEY = "kuroha-club-votes";
  const RSVP_KEY = "kuroha-club-rsvp";
  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };
  const bySlug = new Map(titles.map((item) => [item.slug, item]));
  let current = "";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function plural(value, forms) {
    const abs = Math.abs(value) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function readJoined() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((slug) => clubs.some((club) => club.slug === slug)) : [];
    } catch (error) {
      return [];
    }
  }

  function isJoined(slug) {
    return readJoined().includes(slug);
  }

  function toggleJoin(slug) {
    const joined = readJoined();
    const next = joined.includes(slug)
      ? joined.filter((entry) => entry !== slug)
      : joined.concat(slug);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {}
    window.dispatchEvent(
      new CustomEvent("kuroha:clubs-change", { detail: { slug: slug, joined: next.includes(slug) } })
    );
    return next.includes(slug);
  }

  function readVotes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(VOTE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const result = {};
      clubs.forEach(function (club) {
        const candidate = parsed[club.slug];
        if ((club.candidates || []).some((entry) => entry.slug === candidate)) {
          result[club.slug] = candidate;
        }
      });
      return result;
    } catch (error) {
      return {};
    }
  }

  function setVote(club, slug) {
    if (!club || !(club.candidates || []).some((entry) => entry.slug === slug)) return null;
    const votes = readVotes();
    if (votes[club.slug] === slug) {
      delete votes[club.slug];
    } else {
      votes[club.slug] = slug;
    }
    try {
      localStorage.setItem(VOTE_KEY, JSON.stringify(votes));
    } catch (error) {}
    const next = votes[club.slug] || null;
    window.dispatchEvent(
      new CustomEvent("kuroha:club-vote-change", { detail: { club: club.slug, slug: next } })
    );
    return next;
  }

  function readRsvp() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RSVP_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((slug) => clubs.some((club) => club.slug === slug)) : [];
    } catch (error) {
      return [];
    }
  }

  function isGoing(slug) {
    return readRsvp().includes(slug);
  }

  function toggleRsvp(slug) {
    const going = readRsvp();
    const next = going.includes(slug)
      ? going.filter((entry) => entry !== slug)
      : going.concat(slug);
    try {
      localStorage.setItem(RSVP_KEY, JSON.stringify(next));
    } catch (error) {}
    window.dispatchEvent(
      new CustomEvent("kuroha:club-rsvp-change", { detail: { slug: slug, going: next.includes(slug) } })
    );
    return next.includes(slug);
  }

  function voteStats(club) {
    const myVote = readVotes()[club.slug];
    const candidates = club.candidates || [];
    const total = candidates.reduce((sum, entry) => sum + entry.votes, 0) + (myVote ? 1 : 0);
    const stats = candidates.map(function (entry) {
      const count = entry.votes + (entry.slug === myVote ? 1 : 0);
      const exact = total ? (count / total) * 100 : 0;
      return {
        slug: entry.slug,
        count: count,
        exact: exact,
        percent: Math.floor(exact),
        mine: entry.slug === myVote
      };
    });
    let remainder = total ? 100 - stats.reduce((sum, entry) => sum + entry.percent, 0) : 0;
    const order = stats
      .map((entry, index) => index)
      .sort((a, b) => (stats[b].exact - stats[b].percent) - (stats[a].exact - stats[a].percent));
    order.forEach(function (index, place) {
      if (place < remainder) stats[index].percent += 1;
    });
    return stats.map(function (entry) {
      return {
        slug: entry.slug,
        count: entry.count,
        percent: entry.percent,
        mine: entry.mine
      };
    });
  }

  function totalChapters(item) {
    if (uploads && typeof uploads.totalFor === "function") {
      return uploads.totalFor(item.slug, item.chapters);
    }
    return item.chapters;
  }

  function readProgress(slug) {
    try {
      const data = JSON.parse(localStorage.getItem("kuroha-progress") || "{}");
      return Number(data[slug]) || 0;
    } catch (error) {
      return 0;
    }
  }

  function formatRating(value) {
    return String(Number(value).toFixed(1)).replace(".", ",");
  }

  function initials(name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function nextLabel(dayOffset, time) {
    if (dayOffset === 0) return "Сегодня, " + time;
    if (dayOffset === 1) return "Завтра, " + time;
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(date);
    return capitalize(weekday) + ", " + time;
  }

  function meetingDate(club) {
    const date = new Date();
    date.setDate(date.getDate() + (Number(club.nextDay) || 0));
    const parts = String(club.nextTime || "21:00").split(":");
    date.setHours(Number(parts[0]) || 21, Number(parts[1]) || 0, 0, 0);
    return date;
  }

  function meetingLabel(club) {
    const date = meetingDate(club);
    const day = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(date);
    return capitalize(day) + ", " + (club.nextTime || "21:00");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function icsDate(date) {
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      "00"
    );
  }

  function icsStamp(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function icsEscape(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function buildICS(club) {
    const meeting = club.meeting || {};
    const start = meetingDate(club);
    const minutes = parseInt(meeting.duration, 10) || 60;
    const end = new Date(start.getTime() + minutes * 60000);
    const description =
      "Встреча клуба «" + club.name + "». " +
      (meeting.topic || "") + ". " + (meeting.note || "");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kuroha//Reading Clubs//RU",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Kuroha — клубы",
      "BEGIN:VEVENT",
      "UID:kuroha-" + club.slug + "-" + icsDate(start) + "@kuroha.org",
      "DTSTAMP:" + icsStamp(new Date()),
      "DTSTART:" + icsDate(start),
      "DTEND:" + icsDate(end),
      "SUMMARY:" + icsEscape("«" + club.name + "» — встреча клуба"),
      "DESCRIPTION:" + icsEscape(description),
      "LOCATION:" + icsEscape(meeting.place || "Kuroha"),
      "URL:https://kuroha.org/clubs.html?club=" + club.slug,
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.join("\r\n") + "\r\n";
  }

  function downloadICS(club) {
    try {
      const blob = new Blob([buildICS(club)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "kuroha-club-" + club.slug + ".ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
      return true;
    } catch (error) {
      return false;
    }
  }

  const MARKS = {
    moon:
      '<path d="M29 7a17 17 0 1 0 12 29A21 21 0 0 1 29 7Z"/><path d="M37 11l1.3 3.7L42 16l-3.7 1.3L37 21l-1.3-3.7L32 16l3.7-1.3Z"/>',
    pages:
      '<path d="M7 14c5-2 10-2 16 1v23c-6-3-11-3-16-1Z"/><path d="M41 14c-5-2-10-2-16 1v23c6-3 11-3 16-1Z"/><path d="M12 20c2-.6 4-.7 6 0M12 25c2-.6 4-.7 6 0M36 20c-2-.6-4-.7-6 0M36 25c-2-.6-4-.7-6 0"/>',
    spark:
      '<path d="M24 6l3.2 14.8L42 24l-14.8 3.2L24 42l-3.2-14.8L6 24l14.8-3.2Z"/><circle cx="37" cy="10" r="2"/>'
  };

  function markHTML(club, extraClass) {
    const icon = MARKS[club.mark] || MARKS.moon;
    return (
      '<span class="club-mark ' + (extraClass || "") + '" style="--club-accent:' + club.accent + '" aria-hidden="true">' +
      '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      icon +
      "</svg></span>"
    );
  }

  function readersCount(club) {
    return club.members.length + (isJoined(club.slug) ? 1 : 0);
  }

  function totalReaders() {
    return clubs.reduce((sum, club) => sum + readersCount(club), 0);
  }

  function renderSummary() {
    const bookTotal = new Set(clubs.map((club) => club.currentSlug)).size;
    const total = $("#club-total");
    const books = $("#club-books");
    const readers = $("#club-readers");
    if (total) total.textContent = clubs.length;
    if (books) books.textContent = bookTotal;
    if (readers) readers.textContent = totalReaders();

    const next = clubs.slice().sort((a, b) => a.nextDay - b.nextDay)[0];
    const nextValue = $("#club-next");
    const nextName = $("#club-next-name");
    if (next && nextValue) nextValue.textContent = nextLabel(next.nextDay, next.nextTime);
    if (next && nextName) nextName.textContent = next.name;

    const going = clubs.filter(function (club) {
      return isGoing(club.slug);
    });
    const goingNote = $("#club-going");
    if (goingNote) {
      goingNote.textContent = going.length
        ? "Ты идёшь: " + going.map(function (club) { return club.name; }).join(", ")
        : "Отметь «Буду» на встрече клуба.";
      goingNote.classList.toggle("is-active", going.length > 0);
    }
  }

  function renderTabs() {
    const nav = $("#club-tabs");
    if (!nav) return;
    nav.innerHTML = clubs
      .map((club) => {
        const active = club.slug === current;
        const count = readersCount(club);
        return (
          '<button class="club-tab' + (active ? " is-active" : "") + '" type="button" data-club="' +
          club.slug + '" aria-pressed="' + String(active) + '">' +
          markHTML(club, "club-mark--xs") +
          '<span class="club-tab__body"><b>' + club.name + "</b><small>" + count + " " +
          plural(count, ["читатель", "читателя", "читателей"]) + "</small></span>" +
          '<span class="club-tab__arrow" aria-hidden="true">→</span>' +
          "</button>"
        );
      })
      .join("");

    const active = nav.querySelector('[aria-pressed="true"]');
    if (active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
    }
  }

  function planHTML(club, chapter) {
    let hasCurrent = false;
    return club.plan
      .map((step, index) => {
        const done = chapter >= step.to;
        const active = !done && !hasCurrent;
        if (active) hasCurrent = true;
        const state = done ? "Пройдено" : active ? "Сейчас" : "Дальше";
        return (
          '<li class="club-plan__step' + (done ? " is-done" : active ? " is-current" : "") + '">' +
          '<span class="club-plan__num">' + String(index + 1).padStart(2, "0") + "</span>" +
          '<span class="club-plan__body"><b>' + step.label + "</b><small>Главы " + step.from + "–" + step.to + "</small></span>" +
          '<span class="club-plan__state">' + state + "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  function membersHTML(club) {
    const joined = isJoined(club.slug);
    const visible = club.members.slice(0, 5);
    const rest = club.members.length - visible.length;
    const items = visible.map(function (name) {
      return '<li class="club-member"><span class="club-member__avatar">' + initials(name) +
        '</span><span class="club-member__name">' + name + "</span></li>";
    });
    if (rest > 0) {
      items.push('<li class="club-member club-member--more"><span class="club-member__avatar">+' + rest + "</span></li>");
    }
    if (joined) {
      items.push('<li class="club-member club-member--you"><span class="club-member__avatar">Ты</span></li>');
    }
    return items.join("");
  }

  function voteHTML(club) {
    const stats = voteStats(club);
    const voted = stats.some((entry) => entry.mine);
    const items = stats
      .map(function (stat) {
        const book = bySlug.get(stat.slug);
        if (!book) return "";
        return (
          '<article class="club-vote-card' + (stat.mine ? " is-voted" : "") + '">' +
            '<a class="club-vote-card__cover" href="title.html?slug=' + book.slug + '" aria-label="' + book.title + '">' +
              cards.miniCoverHTML(book) +
            "</a>" +
            '<div class="club-vote-card__body">' +
              '<h4><a href="title.html?slug=' + book.slug + '">' + book.title + "</a></h4>" +
              "<p>" + (TYPE_LABELS[book.type] || book.type) + " · " + totalChapters(book) + " глав</p>" +
            "</div>" +
            '<div class="club-vote-card__bar" role="progressbar" aria-label="Голоса за «' + book.title +
              '»" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + stat.percent + '"><span style="width:' + stat.percent + '%"></span></div>' +
            '<div class="club-vote-card__foot">' +
              '<span class="club-vote-card__result"><b>' + stat.percent + "%</b> · " + stat.count + " " +
                plural(stat.count, ["голос", "голоса", "голосов"]) + "</span>" +
              '<button class="club-vote-card__vote' + (stat.mine ? " is-active" : "") +
                '" type="button" data-club-vote="' + stat.slug + '" aria-pressed="' + String(stat.mine) + '">' +
                (stat.mine ? "Твой голос" : "Голосовать") +
              "</button>" +
            "</div>" +
          "</article>"
        );
      })
      .join("");
    if (!items) return "";
    return (
      '<section class="club-vote" aria-labelledby="club-vote-title">' +
        '<div class="club-vote__head">' +
          '<div><p class="eyebrow">Следующая книга</p><h3 id="club-vote-title">Что читаем следующим?</h3></div>' +
          '<span class="club-vote__note">Демо-голосование</span>' +
        "</div>" +
        '<div class="club-vote__grid">' + items + "</div>" +
        '<p class="club-vote__foot">' +
          (voted
            ? "Твой голос уже учтён. Можно выбрать другую книгу или отозвать голос."
            : "Один голос на клуб. Выбор хранится только в этом браузере.") +
        "</p>" +
      "</section>"
    );
  }

  function meetingHTML(club) {
    const meeting = club.meeting;
    if (!meeting) return "";
    const going = isGoing(club.slug);
    const attending = (Number(meeting.attending) || 0) + (going ? 1 : 0);
    const seats = Number(meeting.seats) || 0;
    const faces = (club.members || []).slice(0, 3).map(function (name) {
      return '<span class="club-meeting__avatar">' + initials(name) + "</span>";
    }).join("");
    const youFace = going
      ? '<span class="club-meeting__avatar club-meeting__avatar--you">Ты</span>'
      : "";

    return (
      '<section class="club-meeting" style="--club-accent:' + club.accent + '" aria-labelledby="club-meeting-title">' +
        '<div class="club-meeting__head">' +
          '<div><p class="eyebrow">Встреча клуба</p><h3 id="club-meeting-title">Собираемся вместе.</h3></div>' +
          '<span class="club-meeting__badge">' + meeting.topic + "</span>" +
        "</div>" +
        '<div class="club-meeting__body">' +
          '<div class="club-meeting__when">' +
            '<span class="club-meeting__date">' + meetingLabel(club) + "</span>" +
            '<span class="club-meeting__meta">' + meeting.duration + " · " + meeting.place + "</span>" +
          "</div>" +
          '<div class="club-meeting__where">' +
            '<span class="paper-label">Где</span>' +
            "<b>" + meeting.place + "</b>" +
            "<small>" + meeting.note + "</small>" +
          "</div>" +
          '<div class="club-meeting__actions">' +
            '<button class="club-rsvp' + (going ? " is-active" : "") + '" type="button" data-club-rsvp="' +
            club.slug + '" aria-pressed="' + String(going) + '">' +
              '<span class="club-rsvp__dot" aria-hidden="true"></span>' +
              '<span data-club-rsvp-label>' + (going ? "Ты идёшь" : "Буду") + "</span>" +
            "</button>" +
            '<button class="btn btn--ghost btn--small" type="button" data-club-calendar="' + club.slug + '">В календарь</button>' +
          "</div>" +
        "</div>" +
        '<div class="club-meeting__people">' +
          '<span class="club-meeting__avatars">' + faces + youFace + "</span>" +
          "<span><b>" + attending + "</b> " + plural(attending, ["идёт", "идут", "идут"]) +
          (seats ? " · " + seats + " мест" : "") + "</span>" +
          (going ? '<span class="club-meeting__you">ты в списке</span>' : "") +
        "</div>" +
      "</section>"
    );
  }

  function renderDetail(club) {
    const detail = $("#club-detail");
    const book = bySlug.get(club.currentSlug);
    const count = $("#club-count");
    if (count) {
      count.textContent = clubs.length + " " + plural(clubs.length, ["клуб", "клуба", "клубов"]);
    }
    if (!detail) return;

    if (!book) {
      detail.innerHTML = '<p class="club-empty">История клуба скоро появится.</p>';
      return;
    }

    const total = totalChapters(book);
    const chapter = Math.max(0, Math.min(readProgress(book.slug), total));
    const percent = total ? Math.round((chapter / total) * 100) : 0;
    const joined = isJoined(club.slug);
    const readers = readersCount(club);
    const nextChapter = chapter >= total ? 1 : Math.max(1, chapter);
    const readLabel = chapter >= total ? "Перечитать" : chapter > 0 ? "Продолжить" : "Начать";
    const readNote = chapter > 0
      ? "Ты на " + chapter + " главе из " + total
      : "Ты ещё не начал эту историю";

    detail.innerHTML =
      '<div class="club-hero">' +
        '<div class="club-hero__mark">' + markHTML(club, "club-mark--lg") + "</div>" +
        '<div class="club-hero__copy">' +
          '<p class="eyebrow">Клуб · с ' + club.since + "</p>" +
          '<h2 id="club-name">' + club.name + "</h2>" +
          '<p class="club-motto">«' + club.motto + '»</p>' +
          '<p class="club-description">' + club.description + "</p>" +
          '<button class="club-join' + (joined ? " is-active" : "") + '" type="button" data-club-join="' +
          club.slug + '" style="--club-accent:' + club.accent + '" aria-pressed="' + String(joined) + '">' +
            '<span class="club-join__dot" aria-hidden="true"></span>' +
            '<span data-club-join-label>' + (joined ? "Ты в клубе" : "Вступить в клуб") + "</span>" +
          "</button>" +
          '<dl class="club-stats">' +
            "<div><dt>В кругу</dt><dd>" + readers + "</dd></div>" +
            "<div><dt>Недель</dt><dd>" + club.plan.length + "</dd></div>" +
            "<div><dt>Глав</dt><dd>" + total + "</dd></div>" +
          "</dl>" +
        "</div>" +
      "</div>" +
      '<div class="club-book">' +
        '<a class="club-book__cover" href="title.html?slug=' + book.slug + '" aria-label="' + book.title + '">' +
          cards.coverHTML(book) +
        "</a>" +
        '<div class="club-book__info">' +
          '<p class="paper-label">Сейчас читаем</p>' +
          '<h3><a href="title.html?slug=' + book.slug + '">' + book.title + "</a></h3>" +
          '<p class="club-book__byline">' + book.author + " · " + book.year + " · " + (TYPE_LABELS[book.type] || book.type) + "</p>" +
          '<p class="club-book__meta">' + total + " глав · ★ " + formatRating(book.rating) + "</p>" +
          '<p class="club-book__note">' + readNote + "</p>" +
          '<div class="club-book__bar" role="progressbar" aria-label="Прогресс клуба" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
          percent + '"><span style="width:' + percent + '%"></span></div>' +
          '<div class="club-book__actions">' +
            '<a class="btn btn--primary btn--small" href="reader.html?slug=' + book.slug + "&chapter=" + nextChapter + '">' + readLabel + "</a>" +
            '<a class="btn btn--secondary btn--small" href="title.html?slug=' + book.slug + '#discussions">Обсуждение</a>' +
          "</div>" +
        "</div>" +
      "</div>" +
      meetingHTML(club) +
      voteHTML(club) +
      '<div class="club-lower">' +
        '<section class="club-plan" aria-labelledby="club-plan-title">' +
          '<div class="club-plan__head"><div><p class="eyebrow">План</p><h3 id="club-plan-title">Читаем по неделям.</h3></div><span>' + club.plan.length + " недели</span></div>" +
          '<ol class="club-plan__list">' + planHTML(club, chapter) + "</ol>" +
        "</section>" +
        '<aside class="club-side">' +
          '<figure class="club-question">' +
            '<p class="paper-label">Вопрос недели</p>' +
            "<blockquote>«" + club.question + "»</blockquote>" +
            "<figcaption>" + club.quoteAuthor + "</figcaption>" +
          "</figure>" +
          '<div class="club-members">' +
            '<div class="club-members__head"><p class="paper-label">В кругу</p><span>' + readers + " " + plural(readers, ["читатель", "читателя", "читателей"]) + "</span></div>" +
            '<ul class="club-member-list">' + membersHTML(club) + "</ul>" +
            "<p>" + club.quote + "</p>" +
          "</div>" +
        "</aside>" +
      "</div>";
  }

  function render() {
    const club = clubs.find((entry) => entry.slug === current) || clubs[0];
    if (!club) return;
    current = club.slug;
    renderSummary();
    renderTabs();
    renderDetail(club);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("club", current);
      window.history.replaceState({}, "", url);
    } catch (error) {}
  }

  function selectClub(slug) {
    if (!clubs.some((club) => club.slug === slug)) return;
    current = slug;
    render();
    const detail = $("#club-detail");
    if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const nav = $("#club-tabs");
  if (nav) {
    nav.addEventListener("click", function (event) {
      const button = event.target.closest("[data-club]");
      if (!button) return;
      selectClub(button.dataset.club);
    });
  }

  const detail = $("#club-detail");
  if (detail) {
    detail.addEventListener("click", function (event) {
      const voteButton = event.target.closest("[data-club-vote]");
      if (voteButton) {
        const club = clubs.find((entry) => entry.slug === current);
        if (!club) return;
        const previous = readVotes()[club.slug] || null;
        const next = setVote(club, voteButton.dataset.clubVote);
        const candidate = bySlug.get(voteButton.dataset.clubVote);
        render();
        if (window.KurohaToast && candidate) {
          window.KurohaToast(
            next
              ? (previous && previous !== next
                ? "Голос перенесён на «" + candidate.title + "»."
                : "Голос учтён: «" + candidate.title + "».")
              : "Голос отозван."
          );
        }
        return;
      }

      const rsvpButton = event.target.closest("[data-club-rsvp]");
      if (rsvpButton) {
        const club = clubs.find((entry) => entry.slug === rsvpButton.dataset.clubRsvp);
        if (!club) return;
        const going = toggleRsvp(club.slug);
        render();
        if (window.KurohaToast) {
          window.KurohaToast(
            going
              ? "Ты идёшь на встречу клуба «" + club.name + "»."
              : "Отметка о встрече убрана."
          );
        }
        return;
      }

      const calendarButton = event.target.closest("[data-club-calendar]");
      if (calendarButton) {
        const club = clubs.find((entry) => entry.slug === calendarButton.dataset.clubCalendar);
        if (!club) return;
        const ok = downloadICS(club);
        if (window.KurohaToast) {
          window.KurohaToast(ok ? "Файл календаря готов." : "Не удалось собрать календарь.");
        }
        return;
      }

      const button = event.target.closest("[data-club-join]");
      if (!button) return;
      const slug = button.dataset.clubJoin;
      const joined = toggleJoin(slug);
      const club = clubs.find((entry) => entry.slug === slug);
      render();
      if (window.KurohaToast) {
        window.KurohaToast(
          joined
            ? "Ты в клубе «" + (club ? club.name : "") + "»."
            : "Ты вышел из клуба."
        );
      }
    });
  }

  window.addEventListener("kuroha:clubs-change", function () {
    render();
  });
  window.addEventListener("kuroha:club-vote-change", function () {
    render();
  });
  window.addEventListener("kuroha:club-rsvp-change", function () {
    render();
  });
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY || event.key === VOTE_KEY || event.key === RSVP_KEY || event.key === "kuroha-progress") render();
  });

  const requested = new URLSearchParams(window.location.search).get("club");
  current = clubs.some((club) => club.slug === requested) ? requested : clubs[0].slug;
  render();

  window.KurohaClubs = {
    KEY: STORAGE_KEY,
    VOTE_KEY: VOTE_KEY,
    RSVP_KEY: RSVP_KEY,
    read: readJoined,
    isJoined: isJoined,
    toggle: toggleJoin,
    readVotes: readVotes,
    vote: setVote,
    readRsvp: readRsvp,
    isGoing: isGoing,
    toggleRsvp: toggleRsvp,
    buildICS: buildICS
  };
})();

(function () {
  "use strict";

  const body = document.body;
  if (!body || body.dataset.page !== "readers") return;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  const READERS = window.KUROHA_READERS || [];
  const TITLES = window.KUROHA_TITLES || [];
  const cards = window.KurohaCards;
  const uploads = window.KurohaUploads;
  const toast = window.KurohaToast || function () {};
  const FOLLOW_KEY = "kuroha-reader-follows";

  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };

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

  const bySlug = new Map(TITLES.map((item) => [item.slug, item]));
  const clubNames = {
    "night-reading": "Ночная читальня",
    "text-only": "Только текст",
    "after-midnight": "После полуночи"
  };

  let currentSlug = READERS.length ? READERS[0].slug : null;

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plural(number, forms) {
    const abs = Math.abs(number);
    if (abs % 10 === 1 && abs % 100 !== 11) return forms[0];
    if (abs % 10 >= 2 && abs % 10 <= 4 && (abs % 100 < 10 || abs % 100 >= 20)) return forms[1];
    return forms[2];
  }

  function formatNumber(number) {
    return new Intl.NumberFormat("ru-RU").format(number);
  }

  function totalChapters(item) {
    if (!item) return 1;
    return uploads && typeof uploads.totalFor === "function"
      ? uploads.totalFor(item.slug, item.chapters)
      : item.chapters;
  }

  function readFollows() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((slug) => typeof slug === "string") : [];
    } catch (error) {
      return [];
    }
  }

  function writeFollows(follows) {
    try {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(follows));
    } catch (error) {}
  }

  function isFollowed(slug) {
    return readFollows().indexOf(slug) !== -1;
  }

  function toggleFollow(slug) {
    const follows = readFollows();
    const index = follows.indexOf(slug);
    let following;

    if (index === -1) {
      follows.push(slug);
      following = true;
    } else {
      follows.splice(index, 1);
      following = false;
    }

    writeFollows(follows);
    window.dispatchEvent(new CustomEvent("kuroha:reader-follow-change", {
      detail: { slug: slug, following: following }
    }));
    return following;
  }

  function getReader(slug) {
    return READERS.find((reader) => reader.slug === slug) || READERS[0];
  }

  function renderSummary() {
    const total = $("#readers-total");
    const online = $("#readers-online");
    const follows = $("#readers-followed");
    const onlineCount = READERS.filter((reader) => reader.online).length;
    const followsCount = readFollows().filter((slug) => READERS.some((reader) => reader.slug === slug)).length;

    if (total) total.textContent = READERS.length;
    if (online) online.textContent = onlineCount;
    if (follows) follows.textContent = followsCount;
  }

  const UPDATE_TIMES = [
    "сегодня, 21:14",
    "вчера, 23:40",
    "2 дня назад",
    "на этой неделе",
    "на прошлой неделе",
    "давно"
  ];

  function readerHref(slug) {
    return "readers.html?reader=" + encodeURIComponent(slug);
  }

  function buildUpdates() {
    const follows = readFollows().filter(function (slug) {
      return READERS.some(function (reader) { return reader.slug === slug; });
    });
    const updates = [];

    follows.forEach(function (slug, readerIndex) {
      const reader = getReader(slug);
      if (!reader) return;

      const current = bySlug.get(reader.current.slug);
      if (current) {
        updates.push({ type: "reading", reader: reader, item: current });
      }

      const secondType = readerIndex % 2 === 0 ? "quote" : "club";
      if (secondType === "quote" && reader.quote) {
        updates.push({ type: "quote", reader: reader, quote: reader.quote });
      } else if (secondType === "club" && reader.club) {
        updates.push({ type: "club", reader: reader });
      } else if (reader.quote) {
        updates.push({ type: "quote", reader: reader, quote: reader.quote });
      } else if (reader.club) {
        updates.push({ type: "club", reader: reader });
      }
    });

    return updates.slice(0, 6);
  }

  function updateHTML(update, index) {
    const reader = update.reader;
    const time = UPDATE_TIMES[index] || "недавно";
    const avatar =
      '<a class="reader-update__avatar" href="' + readerHref(reader.slug) + '" ' +
        'style="--reader-accent:' + escapeHTML(reader.accent) + '" aria-label="' + escapeHTML(reader.name) + '">' +
        escapeHTML(reader.initials) +
      '</a>';

    let action = "· читает";
    let content = "";

    if (update.type === "reading") {
      const item = update.item;
      const total = totalChapters(item);
      const chapter = Math.min(reader.current.chapter, total);
      const percent = total ? Math.round((chapter / total) * 100) : 0;
      const href = "reader.html?slug=" + encodeURIComponent(item.slug) + "&chapter=" + chapter;
      const cover = cards && cards.miniCoverHTML ? cards.miniCoverHTML(item) : "";
      content =
        '<div class="reader-update__book">' +
          '<a class="reader-update__cover" href="' + href + '" aria-label="Открыть «' + escapeHTML(item.title) + '»">' + cover + '</a>' +
          '<div class="reader-update__book-body">' +
            '<a class="reader-update__book-title" href="' + href + '">' + escapeHTML(item.title) + '</a>' +
            '<p>' + escapeHTML(TYPE_LABELS[item.type] || item.type) + ' · глава ' + chapter + ' из ' + total + '</p>' +
            '<div class="reader-update__bar" role="progressbar" aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + percent + '%"></span></div>' +
          '</div>' +
          '<a class="reader-update__go" href="' + href + '">Читать</a>' +
        '</div>';
    } else if (update.type === "quote") {
      action = "· цитата";
      const quote = update.quote;
      const quoteTitle = bySlug.get(quote.slug);
      const href = "reader.html?slug=" + encodeURIComponent(quote.slug) + "&chapter=" + quote.chapter;
      content =
        '<div class="reader-update__quote">' +
          '<p>«' + escapeHTML(quote.text) + '»</p>' +
          '<a href="' + href + '">' + escapeHTML(quoteTitle ? quoteTitle.title : "История") + ' · глава ' + quote.chapter + '</a>' +
        '</div>';
    } else {
      action = "· в клубе";
      const clubName = clubNames[reader.club] || reader.club;
      content =
        '<div class="reader-update__club">' +
          '<span class="reader-update__club-mark" aria-hidden="true">◎</span>' +
          '<div><a href="clubs.html?club=' + encodeURIComponent(reader.club) + '">' + escapeHTML(clubName) + '</a>' +
          '<span> · читает вместе со всеми</span></div>' +
          '<a class="reader-update__go" href="clubs.html?club=' + encodeURIComponent(reader.club) + '">К клубу</a>' +
        '</div>';
    }

    return (
      '<article class="reader-update" data-update-type="' + update.type + '" style="--reader-accent:' + escapeHTML(reader.accent) + '">' +
        avatar +
        '<div class="reader-update__body">' +
          '<div class="reader-update__head">' +
            '<a class="reader-update__name" href="' + readerHref(reader.slug) + '">' + escapeHTML(reader.name) + '</a>' +
            '<span>' + action + '</span>' +
            '<time>' + time + '</time>' +
          '</div>' +
          content +
        '</div>' +
      '</article>'
    );
  }

  function renderUpdates() {
    const list = $("#reader-updates");
    const empty = $("#reader-updates-empty");
    const count = $("#reader-updates-count");
    if (!list) return;

    const updates = buildUpdates();
    list.innerHTML = updates.map(updateHTML).join("");
    if (empty) empty.hidden = updates.length > 0;
    if (count) {
      count.textContent = updates.length + " " + plural(updates.length, ["событие", "события", "событий"]);
    }
  }

  function renderTabs() {
    const tabs = $("#reader-tabs");
    if (!tabs) return;

    tabs.innerHTML = READERS.map(function (reader) {
      const active = reader.slug === currentSlug;
      const followed = isFollowed(reader.slug);
      return (
        '<button class="reader-tab' + (active ? " is-active" : "") + '" type="button" ' +
          'data-reader="' + escapeHTML(reader.slug) + '" aria-pressed="' + (active ? "true" : "false") + '">' +
          '<span class="reader-tab__avatar" style="--reader-accent:' + escapeHTML(reader.accent) + '">' + escapeHTML(reader.initials) + '</span>' +
          '<span class="reader-tab__body">' +
            '<span class="reader-tab__name">' + escapeHTML(reader.name) + (followed ? ' <span class="reader-tab__follow" aria-label="Вы следите">★</span>' : '') + '</span>' +
            '<span class="reader-tab__meta">' + escapeHTML(reader.role) + (reader.online ? ' · <span class="reader-tab__online">онлайн</span>' : '') + '</span>' +
          '</span>' +
          '<span class="reader-tab__arrow" aria-hidden="true">→</span>' +
        '</button>'
      );
    }).join("");
  }

  function followButton(reader) {
    const followed = isFollowed(reader.slug);
    const followers = reader.stats.followers + (followed ? 1 : 0);
    return (
      '<div class="reader-profile__actions">' +
        '<button class="btn btn--secondary reader-follow' + (followed ? " is-followed" : "") + '" type="button" ' +
          'data-reader-follow="' + escapeHTML(reader.slug) + '" aria-pressed="' + (followed ? "true" : "false") + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>' +
          '</svg>' +
          '<span>' + (followed ? "Вы следите" : "Следить") + '</span>' +
        '</button>' +
        '<button class="btn btn--ghost" type="button" data-reader-message="' + escapeHTML(reader.slug) + '">Написать</button>' +
        '<span class="reader-followers"><b>' + formatNumber(followers) + '</b> ' + plural(followers, ["читатель", "читателя", "читателей"]) + '</span>' +
      '</div>'
    );
  }

  function renderDetail() {
    const detail = $("#reader-detail");
    if (!detail) return;

    const reader = getReader(currentSlug);
    if (!reader) {
      detail.innerHTML = '<div class="reader-empty">Пока никого нет рядом.</div>';
      return;
    }

    currentSlug = reader.slug;

    const current = bySlug.get(reader.current.slug);
    const currentTotal = totalChapters(current);
    const currentChapter = Math.min(reader.current.chapter, currentTotal);
    const currentPercent = current ? Math.round((currentChapter / currentTotal) * 100) : 0;
    const currentCover = current && cards && cards.miniCoverHTML ? cards.miniCoverHTML(current) : "";
    const favoriteItems = reader.favorites.map((slug) => bySlug.get(slug)).filter(Boolean);
    const favoriteCards = favoriteItems.map(function (item) {
      return cards && cards.cardHTML ? cards.cardHTML(item) : "";
    }).join("");
    const quoteTitle = bySlug.get(reader.quote.slug);
    const quoteHref = "reader.html?slug=" + encodeURIComponent(reader.quote.slug) + "&chapter=" + encodeURIComponent(reader.quote.chapter);
    const currentHref = current ? "reader.html?slug=" + encodeURIComponent(current.slug) + "&chapter=" + currentChapter : "#";
    const club = reader.club ? clubNames[reader.club] || reader.club : "";
    const clubMarkup = reader.club
      ? '<a class="reader-club" href="clubs.html?club=' + encodeURIComponent(reader.club) + '">' + escapeHTML(club) + ' <span aria-hidden="true">→</span></a>'
      : '<span class="reader-club reader-club--quiet">Пока без клуба</span>';

    detail.innerHTML =
      '<article class="reader-profile">' +
        '<header class="reader-profile__hero">' +
          '<span class="reader-avatar" style="--reader-accent:' + escapeHTML(reader.accent) + '">' +
            escapeHTML(reader.initials) +
            (reader.online ? '<i class="reader-avatar__online" aria-label="Онлайн"></i>' : '') +
          '</span>' +
          '<div class="reader-profile__intro">' +
            '<p class="eyebrow">' + escapeHTML(reader.role) + ' · с ' + escapeHTML(reader.since) + '</p>' +
            '<h2 id="reader-name">' + escapeHTML(reader.name) + '</h2>' +
            '<p class="reader-handle">' + escapeHTML(reader.handle) + '</p>' +
            '<p class="reader-bio">' + escapeHTML(reader.bio) + '</p>' +
            followButton(reader) +
          '</div>' +
        '</header>' +

        '<div class="reader-stats" aria-label="Статистика читателя">' +
          '<div><b>' + reader.stats.shelf + '</b><span>на полке</span></div>' +
          '<div><b>' + formatNumber(reader.stats.chapters) + '</b><span>глав</span></div>' +
          '<div><b>' + formatNumber(reader.stats.ratings) + '</b><span>оценок</span></div>' +
          '<div><b>' + formatNumber(reader.stats.notes) + '</b><span>заметок</span></div>' +
        '</div>' +

        (current ? (
          '<section class="reader-current" aria-labelledby="reader-current-title">' +
            '<p class="paper-label">Сейчас читает</p>' +
            '<div class="reader-current__body">' +
              '<a class="reader-current__cover" href="' + currentHref + '" aria-label="Открыть «' + escapeHTML(current.title) + '»">' + currentCover + '</a>' +
              '<div class="reader-current__info">' +
                '<h3 id="reader-current-title"><a href="' + currentHref + '">' + escapeHTML(current.title) + '</a></h3>' +
                '<p>' + escapeHTML(TYPE_LABELS[current.type] || current.type) + ' · ' + escapeHTML(current.author) + ' · ' + currentTotal + ' ' + plural(currentTotal, ["глава", "главы", "глав"]) + '</p>' +
                '<div class="reader-current__progress"><span style="width:' + currentPercent + '%"></span></div>' +
                '<p class="reader-current__meta">Глава ' + currentChapter + ' · ' + currentPercent + '%</p>' +
              '</div>' +
              '<a class="btn btn--small btn--primary" href="' + currentHref + '">Продолжить</a>' +
            '</div>' +
          '</section>'
        ) : "") +

        '<div class="reader-columns">' +
          '<section class="reader-genres" aria-labelledby="reader-genres-title">' +
            '<h3 id="reader-genres-title">Любимые жанры</h3>' +
            '<div class="reader-chips">' +
              reader.genres.map((genre) => '<span class="chip">' + escapeHTML(GENRE_LABELS[genre] || genre) + '</span>').join("") +
            '</div>' +
            '<div class="reader-club-line">' + clubMarkup + '</div>' +
          '</section>' +
          '<section class="reader-quote" aria-label="Цитата читателя">' +
            '<p class="reader-quote__mark" aria-hidden="true">“</p>' +
            '<blockquote>' + escapeHTML(reader.quote.text) + '</blockquote>' +
            '<a href="' + quoteHref + '">' + escapeHTML(quoteTitle ? quoteTitle.title : "История") + ' · глава ' + reader.quote.chapter + '</a>' +
          '</section>' +
        '</div>' +

        '<section class="reader-favorites" aria-labelledby="reader-favorites-title">' +
          '<div class="reader-favorites__head">' +
            '<h3 id="reader-favorites-title">Любимые истории</h3>' +
            '<span>' + favoriteItems.length + ' ' + plural(favoriteItems.length, ["история", "истории", "историй"]) + '</span>' +
          '</div>' +
          '<div class="reader-favorites__grid">' + favoriteCards + '</div>' +
        '</section>' +
      '</article>';
  }

  function render() {
    renderSummary();
    renderUpdates();
    renderTabs();
    renderDetail();
  }

  function selectReader(slug, scroll) {
    if (!READERS.some((reader) => reader.slug === slug)) return;
    currentSlug = slug;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("reader", slug);
      history.replaceState(null, "", url);
    } catch (error) {}
    render();
    if (scroll) {
      const detail = $("#reader-detail");
      if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function bind() {
    const tabs = $("#reader-tabs");
    if (tabs) {
      tabs.addEventListener("click", function (event) {
        const button = event.target.closest("[data-reader]");
        if (!button) return;
        selectReader(button.dataset.reader, true);
      });
    }

    const detail = $("#reader-detail");
    if (detail) {
      detail.addEventListener("click", function (event) {
        const follow = event.target.closest("[data-reader-follow]");
        if (follow) {
          const reader = getReader(follow.dataset.readerFollow);
          const following = toggleFollow(follow.dataset.readerFollow);
          render();
          if (reader) {
            toast(following ? "Ты следишь за " + reader.name + "." : "Подписка на " + reader.name + " отменена.");
          }
          return;
        }

        const message = event.target.closest("[data-reader-message]");
        if (message) {
          window.location.href = "letters.html?reader=" + encodeURIComponent(message.dataset.readerMessage);
        }
      });
    }

    window.addEventListener("kuroha:reader-follow-change", renderSummary);
    window.addEventListener("kuroha:reader-follow-change", renderUpdates);
    window.addEventListener("kuroha:reader-follow-change", renderTabs);
    window.addEventListener("storage", function (event) {
      if (event.key === FOLLOW_KEY) {
        renderSummary();
        renderUpdates();
        renderTabs();
        renderDetail();
      }
    });
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("reader");
    currentSlug = READERS.some((reader) => reader.slug === requested) ? requested : (READERS[0] && READERS[0].slug);
    render();
    bind();
  }

  window.KurohaReaders = {
    KEY: FOLLOW_KEY,
    read: readFollows,
    isFollowed: isFollowed,
    toggle: toggleFollow,
    select: selectReader,
    updates: renderUpdates
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

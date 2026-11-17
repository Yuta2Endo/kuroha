/* Kuroha prototype — title page and reader. */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const API_TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };
  const API_TITLE_STATUS_LABELS = {
    published: "опубликовано",
    draft: "черновик",
    hidden: "скрыто",
    removed: "снято"
  };
  const API_RIGHTS_LABELS = {
    licensed: "лицензия",
    permission: "разрешение автора",
    public_domain: "общественное достояние",
    cc: "Creative Commons",
    unverified: "права не подтверждены"
  };

  const params = new URLSearchParams(window.location.search);
  const currentPage =
    document.body.dataset.page ||
    ($("#reader-text") ? "reader" : "title");
  const apiTitleSlug = (params.get("titleSlug") || "").trim();

  if (apiTitleSlug && currentPage === "title") {
    initApiTitlePage(apiTitleSlug, params.get("api"));
    return;
  }

  if (apiTitleSlug && params.get("chapterId") && currentPage === "reader") {
    alignApiReaderTitleLinks(apiTitleSlug, params.get("api"));
  }

  const titles = window.KUROHA_TITLES || [];
  if (!titles.length) return;

  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };
  const STATUS_LABELS = {
    ongoing: "онгоинг",
    completed: "завершён",
    frozen: "заморожен"
  };
  const GENRE_LABELS = {
    fantasy: "Фэнтези",
    romance: "Романтика",
    drama: "Драма",
    action: "Боевик",
    mystery: "Мистика",
    slice: "Повседневность",
    history: "История",
    scifi: "Фантастика",
    horror: "Ужасы",
    comedy: "Комедия",
    adventure: "Приключения",
    thriller: "Триллер"
  };

  const DESCRIPTIONS = {
    "pepel-i-luna": "Город забыл, как выглядит небо. Девушка, которая собирает чужие письма, находит одно — без адреса, но с её именем.",
    "tihiy-okean": "История о двух сёстрах, летнем доме у моря и разговоре, который они откладывали двенадцать лет.",
    "klinok-vetra": "Юный мечник идёт против академии, которая выковала его оружие. Ветер помнит каждое имя.",
    "dom-u-morya": "Повар возвращается в родной город, чтобы продать дом. Вместо этого остаётся на один сезон — и находит целую жизнь.",
    "tihiy-sad": "Садовница, которая не переносит прикосновений, и сосед, который приходит к ней только за тишиной.",
    "poslednee-pismo": "Каждое письмо находит адресата. Даже то, которое отправили сорок лет назад.",
    "severnaya-zvezda": "Караванщица ведёт экспедицию через мёртвые земли. Звезда, по которой они идут, давно погасла.",
    "bumazhnye-ptitsy": "Мальчик складывает птиц из страниц старой книги. Каждая улетает туда, куда он боится вернуться.",
    "krasnaya-nit": "Она видит нити, которые связывают людей. У него нити нет — и это не случайно.",
    "steklyannyy-gorod": "Город построен из стекла, чтобы никто не мог ничего скрыть. Но на верхних этажах всё равно что-то шёпчет.",
    "zimniy-svet": "Три дня до Нового года, сломанный лифт и сосед, которого она никогда не видела.",
    "pod-zemley": "На станции метро, которой нет на карте, каждую ночь останавливается поезд. Внутрь лучше не заходить.",
    "chaynaya-na-uglu": "Чайная открыта только в дождь. За стойкой — девушка, которая помнит все заказы, кроме своего.",
    "pesnya-dlya-luny": "Принцесса, которая не должна петь, и луна, которая слушает слишком внимательно.",
    "zheleznyy-les": "Лес из железа растёт быстрее, чем его успевают вырубать. Внутри живёт то, что когда-то было городом.",
    "teplyy-sneg": "Снег в этом городе не тает. И каждый, кто его трогает, вспоминает чужое лето.",
    "nochnoy-tramvay": "Последний трамвай ходит по маршруту, которого нет в расписании. Пассажиры выходят не туда, куда шли.",
    "doch-vetra": "Дочь кочевника ищет ветер, который однажды унёс её мать. Он не отвечает, но оставляет следы.",
    "teni-na-stene": "В новой квартире тени не повторяют движений. Сначала это кажется забавным.",
    "medlennyy-rassvet": "Двое встречают рассвет на крыше, потому что не могут заснуть. Каждое утро — новая попытка сказать главное.",
    "kniga-zabytyh-imyon": "Библиотека, где книги помнят тех, кого забыли все. Новая хранительница находит своё имя на пустой странице.",
    "letniy-dozhd": "Он возвращается в город, где прошло лето, которое они обещали не вспоминать.",
    "gorod-bez-solntsa": "Солнце здесь заменяют фонари. Когда один из них гаснет, начинается настоящая ночь.",
    "malenkaya-biblioteka": "Библиотека размером с одну комнату. Каждая книга в ней — чья-то нерассказанная история.",
    "pisma-k-severu": "Она пишет письма на север, где уже десять лет не бывает адресата. Однажды на одно из них приходит ответ.",
    "sol-i-zvezdy": "Солеварка на краю мира находит упавшую звезду. Теперь ей предстоит решить, что важнее — свет или дорога домой.",
    "komnata-dozhdya": "В этой комнате всегда идёт дождь. Хозяйка сдаёт её тем, кто хочет переждать не только погоду.",
    "bumazhnyy-gorod": "Город сложен из страниц, и каждую ночь кто-то вырывает из него целую улицу. Картограф пытается удержать хотя бы центр.",
    "tishina-na-vtorom-etazhe": "Соседи сверху не шумят уже полгода. Но каждое утро кто-то оставляет на её пороге чашку остывшего чая.",
    "posledniy-hranitel": "Когда библиотеки закрылись, он остался сторожить последнюю. Книги начали возвращаться сами — и приносить то, что было забыто."
  };

  const CHAPTER_TITLES = {
    1: "Первая страница",
    2: "Письмо без адреса",
    3: "Тихая комната",
    4: "Свет на лестнице",
    5: "Дождь идёт с севера",
    6: "Чужой голос",
    7: "Ключ от библиотеки",
    8: "Между строк",
    9: "Список забытых имён",
    10: "Тот, кто ждал",
    11: "Дверь на крышу",
    12: "Дом на краю ночи",
    13: "Пепел на пальцах",
    14: "Луна в стакане",
    15: "Разговор без слов",
    16: "Сад из бумаги",
    17: "Ночь длиннее",
    18: "Красная нить",
    19: "Стеклянный город",
    20: "Последний трамвай",
    21: "Зимний свет",
    22: "Письмо, которое вернулось",
    23: "Рассвет",
    24: "Пустая страница"
  };

  const STORAGE = {
    progress: "kuroha-progress",
    bookmarks: "kuroha-bookmarks",
    font: "kuroha-reader-font",
    settings: "kuroha-reader-settings",
    position: "kuroha-reader-position"
  };

  const slug = params.get("slug");
  const item =
    titles.find((title) => title.slug === slug) ||
    titles.find((title) => title.slug === "pepel-i-luna") ||
    titles[0];

  if (!item) return;

  const uploadsApi = window.KurohaUploads;
  const libraryApi = window.KurohaLibrary;
  const discussionsApi = window.KurohaDiscussions;
  const teamsApi = window.KurohaTeams;
  const notesApi = window.KurohaNotes;
  const ratingsApi = window.KurohaRatings;
  const listsApi = window.KurohaLists;
  let reviewScore = 0;
  const SHELF_LABELS = {
    reading: "Читаю",
    planned: "В планах",
    completed: "Прочитано",
    paused: "Отложено",
    dropped: "Брошено"
  };
  const uploadedChapters =
    uploadsApi && typeof uploadsApi.forTitle === "function"
      ? uploadsApi.forTitle(item.slug)
      : [];
  const uploadedMax = uploadedChapters.reduce(
    (max, entry) => Math.max(max, Number(entry.chapter) || 0),
    0
  );
  const totalChapters = Math.max(Number(item.chapters) || 0, uploadedMax);

  function uploadedChapter(number) {
    return (
      uploadedChapters.find((entry) => Number(entry.chapter) === Number(number)) ||
      null
    );
  }

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

  function formatRating(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString("ru-RU");
  }

  function chapterTitle(number) {
    const uploaded = uploadedChapter(number);
    if (uploaded && uploaded.chapterName) return uploaded.chapterName;
    return CHAPTER_TITLES[number] || `Глава ${number}`;
  }

  function chapterMinutes(number) {
    return 6 + (number % 4);
  }

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function getProgress(bookSlug) {
    const progress = readJSON(STORAGE.progress, {});
    const number = Number(progress[bookSlug]);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function setProgress(bookSlug, chapter) {
    const progress = readJSON(STORAGE.progress, {});
    progress[bookSlug] = Math.max(Number(progress[bookSlug]) || 0, chapter);
    writeJSON(STORAGE.progress, progress);
  }

  function getBookmarks() {
    const bookmarks = readJSON(STORAGE.bookmarks, []);
    return Array.isArray(bookmarks) ? bookmarks : [];
  }

  function isBookmarked(bookSlug) {
    return getBookmarks().includes(bookSlug);
  }

  function toggleBookmark(bookSlug) {
    const bookmarks = getBookmarks();
    const index = bookmarks.indexOf(bookSlug);
    if (index >= 0) {
      bookmarks.splice(index, 1);
      writeJSON(STORAGE.bookmarks, bookmarks);
      return false;
    }
    bookmarks.push(bookSlug);
    writeJSON(STORAGE.bookmarks, bookmarks);
    return true;
  }

  function updateBookmarkButtons() {
    const saved = isBookmarked(item.slug);
    $$("[data-bookmark]").forEach((button) => {
      button.setAttribute("aria-pressed", String(saved));
      button.classList.toggle("is-active", saved);
      button.setAttribute("aria-label", saved ? "Убрать из закладок" : "Добавить в закладки");
      const label = button.querySelector("[data-bookmark-label]");
      if (label) label.textContent = saved ? "В закладках" : "В закладки";
    });
  }

  function bindBookmarks() {
    $$("[data-bookmark]").forEach((button) => {
      button.addEventListener("click", () => {
        const saved = toggleBookmark(item.slug);
        updateBookmarkButtons();
        window.KurohaToast?.(
          saved
            ? `«${item.title}» в закладках.`
            : `«${item.title}» убрана из закладок.`
        );
      });
    });
  }

  function shelfLabel(status) {
    return (libraryApi && libraryApi.label ? libraryApi.label(status) : SHELF_LABELS[status]) || "";
  }

  function getShelfStatus() {
    return libraryApi && typeof libraryApi.getStatus === "function"
      ? libraryApi.getStatus(item.slug)
      : "";
  }

  function renderShelf() {
    const status = getShelfStatus();
    const label = status ? shelfLabel(status) : "На полку";
    const picker = $("#shelf-picker");

    $$("[data-shelf-label]").forEach((element) => {
      element.textContent = label;
    });

    if (picker) {
      picker.classList.toggle("has-status", Boolean(status));
      if (status) picker.dataset.status = status;
      else delete picker.dataset.status;
      const summary = picker.querySelector("summary");
      if (summary) {
        summary.setAttribute(
          "aria-label",
          status ? `Моя полка: ${shelfLabel(status)}. Изменить статус` : "Добавить на полку"
        );
      }
    }

    $$("[data-shelf-status]").forEach((button) => {
      const active = button.dataset.shelfStatus === status;
      button.setAttribute("aria-checked", String(active));
      button.classList.toggle("is-active", active);
    });

    const remove = $("[data-shelf-remove]");
    if (remove) remove.hidden = !status;

    const sideStatus = $("#side-shelf-status");
    if (sideStatus) sideStatus.textContent = status ? shelfLabel(status) : "Ещё не на полке";

    const sideOpen = $("[data-shelf-open]");
    if (sideOpen) sideOpen.textContent = status ? "Изменить статус" : "Выбрать статус";
  }

  function applyShelfStatus(status) {
    if (!libraryApi) return;

    if (status) {
      libraryApi.setStatus(item.slug, status);
      window.KurohaToast?.(`«${item.title}» — ${shelfLabel(status)}.`);
    } else {
      libraryApi.remove(item.slug);
      window.KurohaToast?.(`«${item.title}» убрана с полки.`);
    }

    const picker = $("#shelf-picker");
    if (picker) picker.open = false;
    renderShelf();
    renderStatistics();
  }

  function bindShelf() {
    if (!$("#shelf-picker")) return;

    $$("[data-shelf-status]").forEach((button) => {
      button.addEventListener("click", () => {
        applyShelfStatus(button.dataset.shelfStatus);
      });
    });

    $("[data-shelf-remove]")?.addEventListener("click", () => {
      applyShelfStatus("");
    });

    $("[data-shelf-open]")?.addEventListener("click", () => {
      const picker = $("#shelf-picker");
      if (!picker) return;
      picker.open = true;
      const current =
        picker.querySelector("[data-shelf-status].is-active") ||
        picker.querySelector("[data-shelf-status]");
      current?.focus();
      picker.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    document.addEventListener("click", (event) => {
      const picker = $("#shelf-picker");
      if (picker && picker.open && !picker.contains(event.target)) {
        picker.open = false;
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === "kuroha-library") {
        renderShelf();
        renderStatistics();
      }
    });
  }

  function listsLabel(count) {
    if (!count) return "В список";
    if (count === 1) return "В списке";
    return `В ${count} списках`;
  }

  function renderLists() {
    const picker = $("#lists-picker");
    if (!picker || !listsApi) return;

    if (typeof listsApi.ensureSeed === "function") listsApi.ensureSeed();

    const memberships = typeof listsApi.forSlug === "function"
      ? listsApi.forSlug(item.slug)
      : [];

    $$("[data-lists-label]").forEach((element) => {
      element.textContent = listsLabel(memberships.length);
    });

    const summary = picker.querySelector("summary");
    if (summary) {
      summary.setAttribute(
        "aria-label",
        memberships.length
          ? `Мои списки: ${memberships.map((list) => list.title).join(", ")}. Изменить`
          : "Добавить в список"
      );
    }

    const options = $("#title-lists-options");
    if (!options) return;
    const all = typeof listsApi.read === "function" ? listsApi.read() : [];

    if (!all.length) {
      options.innerHTML = '<p class="lists-menu__empty">Списков пока нет. Создай первый.</p>';
      return;
    }

    options.innerHTML = all.map((list) => {
      const added = list.slugs.includes(item.slug);
      return (
        `<button type="button" role="menuitemcheckbox" aria-checked="${added}" class="lists-menu__option${added ? " is-added" : ""}" data-list-toggle="${escapeHTML(list.id)}">` +
        '<span class="lists-menu__check" aria-hidden="true">✓</span>' +
        `<span class="lists-menu__name">${escapeHTML(list.title)}</span>` +
        `<span class="lists-menu__count">${list.slugs.length}</span>` +
        "</button>"
      );
    }).join("");
  }

  function bindLists() {
    const picker = $("#lists-picker");
    if (!picker || !listsApi) return;

    $("#title-lists-options")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-list-toggle]");
      if (!button) return;
      const result = listsApi.toggleTitle(button.dataset.listToggle, item.slug);
      if (!result) return;
      renderLists();
      window.KurohaToast?.(
        result.added
          ? `«${item.title}» в списке «${result.list.title}».`
          : `«${item.title}» убрана из списка «${result.list.title}».`
      );
    });

    document.addEventListener("click", (event) => {
      if (picker.open && !picker.contains(event.target)) {
        picker.open = false;
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === listsApi.STORAGE_KEY) renderLists();
    });

    window.addEventListener("kuroha:lists-change", renderLists);
  }

  function discussionInitials(name) {
    return String(name || "Ч")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }

  function renderDiscussions() {
    const list = $("#discussion-list");
    if (!list) return;

    const comments = discussionsApi ? discussionsApi.forTitle(item.slug) : [];
    const total = comments.length;
    const count = $("#discussion-count");
    const totalNode = $("#discussion-total");
    if (count) count.textContent = String(total);
    if (totalNode) totalNode.textContent = `${total} ${plural(total, ["реплика", "реплики", "реплик"])}`;

    const empty = $("#discussions-empty");
    if (empty) empty.hidden = total > 0;

    list.innerHTML = comments
      .map(
        (comment) => `<article class="discussion-item">
          <div class="discussion-avatar" aria-hidden="true">${escapeHTML(discussionInitials(comment.name))}</div>
          <div class="discussion-body">
            <div class="discussion-head">
              <b>${escapeHTML(comment.name)}</b>
              <time datetime="${escapeHTML(comment.createdAt)}">${escapeHTML(discussionsApi.relativeTime(comment.createdAt))}</time>
              ${comment.mine ? `<button class="discussion-remove" type="button" data-discussion-remove="${escapeHTML(comment.id)}">Удалить</button>` : ""}
            </div>
            <p>${escapeHTML(comment.text)}</p>
          </div>
        </article>`
      )
      .join("");
  }

  function renderChapterDiscussion(chapter) {
    const list = $("#chapter-discussion-list");
    if (!list) return;

    const comments = discussionsApi ? discussionsApi.forChapter(item.slug, chapter) : [];
    const total = comments.length;
    const count = $("#chapter-discussion-count");
    if (count) {
      count.textContent = `${total} ${plural(total, ["реплика", "реплики", "реплик"])}`;
    }

    const empty = $("#chapter-discussion-empty");
    if (empty) empty.hidden = total > 0;

    list.innerHTML = comments
      .map(
        (comment) => `<article class="discussion-item">
          <div class="discussion-avatar" aria-hidden="true">${escapeHTML(discussionInitials(comment.name))}</div>
          <div class="discussion-body">
            <div class="discussion-head">
              <b>${escapeHTML(comment.name)}</b>
              <time datetime="${escapeHTML(comment.createdAt)}">${escapeHTML(discussionsApi.relativeTime(comment.createdAt))}</time>
              ${comment.mine ? `<button class="discussion-remove" type="button" data-chapter-discussion-remove="${escapeHTML(comment.id)}">Удалить</button>` : ""}
            </div>
            <p>${escapeHTML(comment.text)}</p>
          </div>
        </article>`
      )
      .join("");

    const all = $("#chapter-discussion-all");
    if (all) {
      all.href = `title.html?slug=${encodeURIComponent(item.slug)}#discussions`;
    }
  }

  function bindChapterDiscussion(chapter) {
    const form = $("#chapter-discussion-form");
    if (!form || !discussionsApi) return;

    const textarea = $("#chapter-discussion-text");
    const hint = $("#chapter-discussion-hint");

    if (textarea && hint) {
      textarea.addEventListener("input", () => {
        hint.textContent = `${textarea.value.length} / ${discussionsApi.CHAPTER_MAX_LENGTH || 500}`;
      });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = textarea ? textarea.value.trim() : "";
      if (!text) {
        if (window.KurohaToast) window.KurohaToast("Напиши пару слов — и реплика появится здесь.");
        textarea?.focus();
        return;
      }
      const comment = discussionsApi.addChapter(item.slug, chapter, text);
      if (!comment) return;
      if (textarea) textarea.value = "";
      if (hint) hint.textContent = `До ${discussionsApi.CHAPTER_MAX_LENGTH || 500} символов`;
      renderChapterDiscussion(chapter);
      if (window.KurohaToast) window.KurohaToast("Реплика добавлена. Спасибо, что не прошёл мимо.");
    });

    $("#chapter-discussion-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-chapter-discussion-remove]");
      if (!button) return;
      if (discussionsApi.removeChapter(item.slug, chapter, button.dataset.chapterDiscussionRemove)) {
        renderChapterDiscussion(chapter);
        if (window.KurohaToast) window.KurohaToast("Реплика удалена.");
      }
    });

    window.addEventListener("kuroha:chapter-discussions-change", (event) => {
      const detail = event.detail;
      if (!detail || detail.slug === null || (detail.slug === item.slug && Number(detail.chapter) === Number(chapter))) {
        renderChapterDiscussion(chapter);
      }
    });
  }

  function reviewCard(review) {
    const initials = discussionInitials(review.name);
    const when =
      ratingsApi && typeof ratingsApi.relativeTime === "function"
        ? ratingsApi.relativeTime(review.createdAt)
        : "";
    return `<article class="review-card${review.mine ? " is-mine" : ""}">
      <div class="review-avatar" aria-hidden="true">${escapeHTML(initials)}</div>
      <div class="review-body">
        <div class="review-head">
          <b>${escapeHTML(review.name)}</b>
          <span class="review-score-badge">${review.score}</span>
          <time datetime="${escapeHTML(review.createdAt)}">${escapeHTML(when)}</time>
          ${review.mine ? `<button class="review-card__remove" type="button" data-review-remove>Удалить</button>` : ""}
        </div>
        <p>${escapeHTML(review.text)}</p>
      </div>
    </article>`;
  }

  function renderReviews() {
    if (!$("#title-reviews")) return;

    const summary = ratingSummary();
    const mine = summary.mine;
    const reviews =
      ratingsApi && typeof ratingsApi.reviewsFor === "function"
        ? ratingsApi.reviewsFor(item.slug)
        : [];

    const count = $("#review-count");
    if (count) count.textContent = String(reviews.length);
    const average = $("#reviews-average");
    if (average) average.textContent = formatRating(summary.value);
    const votes = $("#reviews-votes");
    if (votes) {
      votes.textContent = `${formatNumber(summary.votes)} ${plural(summary.votes, ["оценка", "оценки", "оценок"])}`;
    }

    reviewScore = mine ? Number(mine.score) : 0;
    $$("[data-review-score]").forEach((button) => {
      const active = Number(button.dataset.reviewScore) === reviewScore;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });

    const scoreNode = $("#review-form-score");
    if (scoreNode) scoreNode.textContent = reviewScore ? `${reviewScore} / 10` : "—";

    const state = $("#review-form-state");
    if (state) {
      state.textContent = mine
        ? mine.text
          ? "Твой отзыв сохранён"
          : "Оценка сохранена"
        : "Пока не оценено";
    }

    const textarea = $("#review-text");
    if (textarea && document.activeElement !== textarea) {
      textarea.value = mine ? mine.text || "" : "";
    }
    const hint = $("#review-hint");
    if (hint && textarea) {
      hint.textContent = textarea.value.trim()
        ? `${textarea.value.trim().length} / ${ratingsApi ? ratingsApi.MAX_REVIEW : 700}`
        : "Оценка обязательна, текст — по желанию";
    }

    const submit = $("#review-form button[type=submit]");
    if (submit) submit.textContent = mine ? "Обновить" : "Сохранить";
    const remove = $("#review-remove");
    if (remove) remove.hidden = !mine;

    const list = $("#review-list");
    if (list) list.innerHTML = reviews.map(reviewCard).join("");
    const empty = $("#reviews-empty");
    if (empty) empty.hidden = reviews.length > 0;
  }

  function bindReviews() {
    if (!$("#title-reviews")) return;

    $$("[data-review-score]").forEach((button) => {
      button.addEventListener("click", () => {
        reviewScore = Number(button.dataset.reviewScore) || 0;
        $$("[data-review-score]").forEach((itemButton) => {
          const active = itemButton === button;
          itemButton.classList.toggle("is-active", active);
          itemButton.setAttribute("aria-checked", String(active));
        });
        const scoreNode = $("#review-form-score");
        if (scoreNode) scoreNode.textContent = `${reviewScore} / 10`;
        const state = $("#review-form-state");
        if (state) state.textContent = "Не забудь сохранить";
      });
    });

    const textarea = $("#review-text");
    const hint = $("#review-hint");
    if (textarea && hint) {
      textarea.addEventListener("input", () => {
        hint.textContent = textarea.value.trim()
          ? `${textarea.value.trim().length} / ${ratingsApi ? ratingsApi.MAX_REVIEW : 700}`
          : "Оценка обязательна, текст — по желанию";
      });
    }

    $("#review-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!ratingsApi) return;
      if (!reviewScore) {
        window.KurohaToast?.("Поставь оценку от 1 до 10.");
        $("[data-review-score]")?.focus();
        return;
      }
      const text = textarea ? textarea.value.trim() : "";
      const entry = ratingsApi.set(item.slug, reviewScore, text);
      if (!entry) return;
      renderReviews();
      renderStatistics();
      window.KurohaToast?.(
        text ? "Отзыв сохранён. Спасибо за тихий голос." : "Оценка сохранена."
      );
    });

    $("#review-remove")?.addEventListener("click", () => {
      if (!ratingsApi) return;
      if (ratingsApi.remove(item.slug)) {
        reviewScore = 0;
        renderReviews();
        renderStatistics();
        window.KurohaToast?.("Твоя оценка удалена.");
      }
    });

    $("#review-list")?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-review-remove]")) return;
      if (ratingsApi && ratingsApi.remove(item.slug)) {
        reviewScore = 0;
        renderReviews();
        renderStatistics();
        window.KurohaToast?.("Твоя оценка удалена.");
      }
    });

    window.addEventListener("kuroha:ratings-change", (event) => {
      if (!event.detail || !event.detail.slug || event.detail.slug === item.slug) {
        renderReviews();
        renderStatistics();
      }
    });

    if (window.location.hash === "#reviews") setTitleTab("reviews");
  }

  function ratingSummary() {
    const baseVotes = 420 + item.popularity * 31 + totalChapters * 14;
    const mine =
      ratingsApi && typeof ratingsApi.get === "function"
        ? ratingsApi.get(item.slug)
        : null;
    const hasMine = mine && Number.isFinite(Number(mine.score));
    const votes = baseVotes + (hasMine ? 1 : 0);
    const value = hasMine
      ? (Number(item.rating) * baseVotes + Number(mine.score)) / votes
      : Number(item.rating);

    return {
      baseVotes: baseVotes,
      votes: votes,
      value: value,
      mine: hasMine ? mine : null
    };
  }

  function renderStatistics() {
    if (!$("#title-stats")) return;

    const summary = ratingSummary();
    const baseVotes = summary.baseVotes;
    const votes = summary.votes;
    const views = votes * (22 + (item.popularity % 9));
    const bookmarks = Math.round(votes * 0.36);

    const setText = (selector, value) => {
      const element = $(selector);
      if (element) element.textContent = value;
    };

    setText("#stats-rating", formatRating(summary.value));
    setText("#stats-votes", `${formatNumber(votes)} ${plural(votes, ["оценка", "оценки", "оценок"])}`);
    setText("#stats-votes-card", formatNumber(votes));
    setText("#stats-views", formatNumber(views));
    setText("#stats-bookmarks", formatNumber(bookmarks));
    setText("#stats-chapters", formatNumber(totalChapters));
    setText("#stats-shelf-total", formatNumber(bookmarks));

    const scores = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const sigma = 1.05;
    const weights = scores.map((score) => Math.exp(-0.5 * Math.pow((score - item.rating) / sigma, 2)));
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const counts = weights.map((weight) => Math.round((baseVotes * weight) / weightTotal));
    const remainder = baseVotes - counts.reduce((sum, count) => sum + count, 0);
    const peak = counts.indexOf(Math.max(...counts));
    counts[peak] += remainder;
    if (summary.mine) {
      const bucket = scores.indexOf(Number(summary.mine.score));
      if (bucket >= 0) counts[bucket] += 1;
    }
    const maxCount = Math.max(...counts, 1);

    const distribution = $("#stats-distribution");
    if (distribution) {
      distribution.innerHTML = scores
        .map((score, index) => {
          const count = counts[index];
          const percent = Math.round((count / votes) * 100);
          return `<div class="stats-bar-row">
            <span class="stats-bar-label">${score}</span>
            <span class="stats-bar-track"><span class="stats-bar-fill" style="width:${((count / maxCount) * 100).toFixed(1)}%"></span></span>
            <span class="stats-bar-count">${formatNumber(count)}</span>
            <span class="stats-bar-percent">${percent}%</span>
          </div>`;
        })
        .join("");
    }

    const statusOrder = ["reading", "planned", "completed", "paused", "dropped"];
    const shares = [0.44, 0.27, 0.18, 0.07, 0.04];
    const statusCounts = shares.map((share) => Math.round(bookmarks * share));
    statusCounts[statusCounts.length - 1] =
      bookmarks - statusCounts.slice(0, -1).reduce((sum, count) => sum + count, 0);

    const statuses = $("#stats-statuses");
    if (statuses) {
      statuses.innerHTML = statusOrder
        .map((status, index) => {
          const count = Math.max(0, statusCounts[index]);
          return `<div class="stats-status-row">
            <span class="stats-dot stats-dot--${status}" aria-hidden="true"></span>
            <span class="stats-status-name">${SHELF_LABELS[status]}</span>
            <b>${formatNumber(count)}</b>
            <span class="stats-status-percent">${Math.round((count / bookmarks) * 100)}%</span>
          </div>`;
        })
        .join("");
    }

    const status = getShelfStatus();
    const progress = Math.min(getProgress(item.slug), totalChapters);
    const mine = $("#stats-mine");
    if (mine) {
      mine.textContent = status
        ? `Ты: ${SHELF_LABELS[status]} · ${progress} из ${totalChapters} глав`
        : "Ты пока не на полке.";
    }

    const note = $("#stats-note");
    if (note) {
      note.textContent = summary.mine
        ? "Демо-статистика прототипа. Твоя оценка уже учтена."
        : "Демо-статистика прототипа. Не реальные данные.";
    }
  }

  function renderSimilar() {
    const grid = $("#similar-grid");
    if (!grid) return;

    const ranked = titles
      .filter((book) => book.slug !== item.slug)
      .map((book) => {
        const shared = book.genres.filter((genre) => item.genres.includes(genre));
        const score =
          shared.length * 6 +
          (book.type === item.type ? 3 : 0) +
          (book.status === item.status ? 1 : 0) +
          Math.max(0, 3 - Math.abs(book.rating - item.rating)) +
          Math.max(0, 2 - Math.abs(book.year - item.year) / 4);
        return { book, shared, score };
      })
      .sort((a, b) => b.score - a.score || b.book.popularity - a.book.popularity)
      .slice(0, 4);

    grid.innerHTML = ranked
      .map(({ book, shared }) => {
        const reason = shared.length
          ? `${shared.length > 1 ? "Общие жанры" : "Общий жанр"}: ${shared
              .slice(0, 3)
              .map((genre) => GENRE_LABELS[genre] || genre)
              .join(", ")}`
          : book.type === item.type
            ? `Тоже ${TYPE_LABELS[book.type].toLowerCase()}`
            : book.status === item.status
              ? `Тоже ${STATUS_LABELS[book.status].toLowerCase()}`
              : "Похожее настроение";
        return `<a class="similar-card" href="title.html?slug=${encodeURIComponent(book.slug)}">
          <div class="similar-card__cover">${coverHTML(book)}</div>
          <span class="similar-card__reason">${escapeHTML(reason)}</span>
          <h3 class="similar-card__title">${escapeHTML(book.title)}</h3>
          <p class="similar-card__meta">${TYPE_LABELS[book.type]} · ${book.year} · ★ ${formatRating(book.rating)}</p>
        </a>`;
      })
      .join("");
  }

  function scrollToStatsHash() {
    if (window.location.hash !== "#stats") return;
    const panel = $("#title-stats");
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top, behavior: "instant" });
  }

  function scrollToReviewsHash() {
    if (window.location.hash !== "#reviews") return;
    const panel = $("#title-reviews");
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top, behavior: "instant" });
  }

  function setTitleTab(name) {
    $$("[data-title-tab]").forEach((tab) => {
      const active = tab.dataset.titleTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $$("[data-title-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.titlePanel !== name;
    });
  }

  function bindDiscussions() {
    if (!$("#title-discussions")) return;

    const tabs = $$("[data-title-tab]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => setTitleTab(tab.dataset.titleTab));
    });
    tabs.forEach((tab, index) => {
      tab.addEventListener("keydown", (event) => {
        let target = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          target = tabs[(index + 1) % tabs.length];
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          target = tabs[(index - 1 + tabs.length) % tabs.length];
        } else if (event.key === "Home") {
          target = tabs[0];
        } else if (event.key === "End") {
          target = tabs[tabs.length - 1];
        }
        if (!target) return;
        event.preventDefault();
        target.focus();
        setTitleTab(target.dataset.titleTab);
      });
    });

    const form = $("#discussion-form");
    const textarea = $("#discussion-text");
    const hint = $("#discussion-hint");

    if (textarea && hint) {
      textarea.addEventListener("input", () => {
        hint.textContent = `${textarea.value.length} / ${discussionsApi ? discussionsApi.MAX_LENGTH : 500}`;
      });
    }

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!discussionsApi) return;
      const text = textarea ? textarea.value.trim() : "";
      if (!text) {
        if (window.KurohaToast) window.KurohaToast("Напиши пару слов — и реплика появится здесь.");
        textarea?.focus();
        return;
      }
      const comment = discussionsApi.add(item.slug, text);
      if (!comment) return;
      if (textarea) textarea.value = "";
      if (hint) hint.textContent = `До ${discussionsApi.MAX_LENGTH} символов`;
      renderDiscussions();
      if (window.KurohaToast) window.KurohaToast("Реплика добавлена. Спасибо, что не прошёл мимо.");
    });

    $("#discussion-list")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-discussion-remove]");
      if (!button || !discussionsApi) return;
      if (discussionsApi.remove(item.slug, button.dataset.discussionRemove)) {
        renderDiscussions();
        if (window.KurohaToast) window.KurohaToast("Реплика удалена.");
      }
    });

    window.addEventListener("kuroha:discussions-change", (event) => {
      if (!event.detail || !event.detail.slug || event.detail.slug === item.slug) {
        renderDiscussions();
      }
    });

    if (window.location.hash === "#discussions") setTitleTab("discussions");
    if (window.location.hash === "#stats") setTitleTab("stats");
  }

  function coverHTML(book, modifier = "") {
    const firstLine = escapeHTML(book.lines[0]);
    const secondLine = book.lines[1] ? `<br>${escapeHTML(book.lines[1])}` : "";
    return `<div class="cover ${modifier} cover--${book.align || "low"}" data-art="${book.art}" style="--c1:${book.c1};--c2:${book.c2};--c-accent:${book.accent}" aria-hidden="true">
      <span class="cover__type">${TYPE_LABELS[book.type]}</span>
      <span class="cover__title">${firstLine}${secondLine}</span>
      <span class="cover__author">${escapeHTML(book.author)}</span>
    </div>`;
  }

  function miniCoverHTML(book) {
    const firstLine = escapeHTML(book.lines[0]);
    const secondLine = book.lines[1] ? `<br>${escapeHTML(book.lines[1])}` : "";
    return `<div class="cover cover--mini cover--${book.align || "low"}" data-art="${book.art}" style="--c1:${book.c1};--c2:${book.c2};--c-accent:${book.accent}" aria-hidden="true">
      <span class="cover__title">${firstLine}${secondLine}</span>
    </div>`;
  }

  function chapterRow(number, current, progress) {
    const isCurrent = current === number;
    const isRead = progress > 0 && !isCurrent && number <= progress;
    const uploaded = uploadedChapter(number);
    const meta = isCurrent
      ? "ты здесь"
      : uploaded
        ? "загружено"
        : isRead
          ? "прочитано"
          : `${chapterMinutes(number)} мин`;
    return `<a class="chapter-row${isCurrent ? " is-current" : ""}${isRead ? " is-read" : ""}" href="reader.html?slug=${encodeURIComponent(item.slug)}&chapter=${number}">
      <span class="chapter-row__num">${String(number).padStart(2, "0")}</span>
      <span class="chapter-row__title">${escapeHTML(chapterTitle(number))}</span>
      <span class="chapter-row__meta">${meta}</span>
    </a>`;
  }

  function renderTitleContinue(progress) {
    const container = $("#title-continue");
    if (!container) return;

    const total = totalChapters;
    const finished = progress >= total;
    const percent = Math.min(100, Math.round((progress / total) * 100));
    const startChapter = finished || progress === 0 ? 1 : progress;
    const label = finished
      ? "Ты дочитал до конца"
      : progress > 0
        ? "Продолжить чтение"
        : "Начать чтение";
    const heading = finished
      ? "Ты дочитал до конца"
      : progress > 0
        ? `Ты остановился на ${progress}-й главе`
        : "Первая глава уже ждёт";
    const text = finished
      ? `${item.title} · ${total} ${plural(total, ["глава", "главы", "глав"])}`
      : `${item.title} · ${chapterTitle(startChapter)}`;
    const button = finished
      ? "Перечитать"
      : progress > 0
        ? "Продолжить"
        : "Читать первую";

    container.innerHTML = `<div class="title-continue-card">
      ${miniCoverHTML(item)}
      <div>
        <p class="paper-label">${label}</p>
        <h2>${heading}</h2>
        <p class="title-continue-text">${text}</p>
        <div class="progress" role="progressbar" aria-label="Прогресс чтения" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
        <div class="title-continue-meta"><span>${progress} / ${total} глав</span><span>${percent}%</span></div>
      </div>
      <a class="btn btn--ink" href="reader.html?slug=${encodeURIComponent(item.slug)}&chapter=${startChapter}">${button}</a>
    </div>`;
  }

  function renderSideProgress(progress) {
    const container = $("#side-progress");
    if (!container) return;

    const total = totalChapters;
    if (progress <= 0) {
      container.innerHTML = `<p class="side-progress__empty">Ты ещё не начал читать. Первая глава ждёт.</p>`;
      return;
    }

    const finished = progress >= total;
    const percent = Math.min(100, Math.round((progress / total) * 100));
    const href = `reader.html?slug=${encodeURIComponent(item.slug)}&chapter=${finished ? 1 : progress}`;
    container.innerHTML = `<div class="side-progress__text"><span>${progress} из ${total}</span><span>${percent}%</span></div>
      <div class="progress" role="progressbar" aria-label="Прогресс чтения" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
      <a class="side-progress__link" href="${href}">${finished ? "Перечитать" : "Продолжить"}</a>`;
  }

  function renderChapters(progress) {
    const list = $("#chapter-list");
    if (!list) return;

    const more = $("#chapter-more");
    const total = totalChapters;
    const finished = progress >= total;
    const current = progress > 0 && !finished ? progress : 0;

    const renderRows = (count) => {
      list.innerHTML = Array.from({ length: count }, (_, index) =>
        chapterRow(index + 1, current, progress)
      ).join("");
    };

    renderRows(Math.min(12, total));

    if (more) {
      if (total > 12) {
        more.hidden = false;
        more.textContent = `Показать все ${total} глав`;
        more.onclick = () => {
          renderRows(total);
          more.hidden = true;
        };
      } else {
        more.hidden = true;
      }
    }

    const count = $("#chapter-count");
    if (count) {
      count.textContent = `${total} ${plural(total, ["глава", "главы", "глав"])}`;
    }
    const tabCount = $("#chapter-tab-count");
    if (tabCount) tabCount.textContent = String(total);
  }

  function renderTeam() {
    const container = $("#side-team");
    if (!container || !teamsApi) return;
    const team = teamsApi.forTitle(item.slug);
    if (!team) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = `<h3>Команда</h3>
      <a class="side-team__link" href="teams.html?team=${encodeURIComponent(team.slug)}">
        ${teamsApi.markHTML(team, "team-mark--xs")}
        <span><b>${escapeHTML(team.name)}</b><small>${team.members.length} ${plural(team.members.length, ["человек", "человека", "человек"])} · с ${escapeHTML(team.since)}</small></span>
      </a>`;
  }

  function renderTitle() {
    const hero = $("#title-hero");
    if (!hero) return;

    document.title = `${item.title} — Kuroha`;
    hero.style.setProperty("--title-c1", item.c1);
    hero.style.setProperty("--title-c2", item.c2);

    const progress = Math.min(getProgress(item.slug), totalChapters);
    const total = totalChapters;
    const finished = progress >= total;
    const readChapter = finished || progress === 0 ? 1 : progress;

    const cover = $("#title-cover");
    if (cover) cover.innerHTML = coverHTML(item, "cover--lg");

    const setText = (selector, value) => {
      const element = $(selector);
      if (element) element.textContent = value;
    };

    setText("#title-breadcrumb-type", TYPE_LABELS[item.type]);
    setText("#title-type", `${TYPE_LABELS[item.type]} · ${STATUS_LABELS[item.status]}`);
    setText("#title-name", item.title);
    setText("#title-author", item.author);
    setText("#title-description", DESCRIPTIONS[item.slug] || "Описание этой истории скоро появится.");
    setText("#title-rating", formatRating(item.rating));
    setText("#title-cover-code", String(titles.indexOf(item) + 1).padStart(3, "0"));

    const meta = $("#title-meta");
    if (meta) {
      meta.textContent = `${TYPE_LABELS[item.type]} · ${item.year} · ${total} ${plural(total, ["глава", "главы", "глав"])} · ${STATUS_LABELS[item.status]}${item.adult ? " · 18+" : ""}`;
    }

    const genres = item.genres
      .map(
        (genre) =>
          `<a class="chip" href="genre.html?genre=${genre}">${GENRE_LABELS[genre] || genre}</a>`
      )
      .join("");
    const titleGenres = $("#title-genres");
    if (titleGenres) titleGenres.innerHTML = genres;
    const sideGenres = $("#side-genres");
    if (sideGenres) sideGenres.innerHTML = genres;

    const read = $("#title-read");
    if (read) {
      read.href = `reader.html?slug=${encodeURIComponent(item.slug)}&chapter=${readChapter}`;
      read.textContent = finished
        ? "Перечитать"
        : progress > 0
          ? `Продолжить с ${progress} главы`
          : "Начать читать";
    }

    setText("#side-type", TYPE_LABELS[item.type]);
    setText("#side-status", STATUS_LABELS[item.status]);
    setText("#side-year", String(item.year));
    setText("#side-chapters", `${total}`);
    setText("#side-author", item.author);
    setText("#side-rating", `★ ${formatRating(item.rating)}`);

    renderTitleContinue(progress);
    renderSideProgress(progress);
    renderChapters(progress);
    renderDiscussions();
    renderStatistics();
    renderReviews();
    renderSimilar();
    renderShelf();
    renderLists();
    renderTeam();
    updateBookmarkButtons();
  }

  function specialChapter() {
    return [
      "Дождь начался ближе к полуночи. Куро спала на стопке томов, и её хвост свисал с верхней книги, как закладка.",
      "Письмо лежало между страницами двенадцатой главы. Бумага была тёплой, будто его только что держали в руках. На конверте не было адреса — только имя, написанное знакомым почерком.",
      "«Не ищи меня среди имён. Я уже там, где заканчиваются строки.»",
      "За окном луна вышла из-за туч и легла на пол длинной серебряной полосой. В библиотеке стало тише, чем обычно. Даже дождь притих, словно прислушивался.",
      "Ты перевернул страницу. Куро открыла один глаз, посмотрела на письмо и отвернулась. Она знала больше, чем говорила, но сегодня не время было задавать вопросы.",
      "На последней строке главы осталась только одна фраза: «Дом на краю ночи ждёт тебя». Ты закрыл книгу, но свет луны всё ещё лежал на полу — как приглашение."
    ];
  }

  function genericChapter(book, chapter) {
    const title = escapeHTML(book.title);
    const name = escapeHTML(chapterTitle(chapter));
    return [
      `Дождь начался ближе к вечеру, и город стал похож на акварель, которую забыли высушить. В «${title}» глава ${chapter} начинается с тишины.`,
      `Герои не спешат говорить. Они стоят у окна, слушают, как по стеклу стучат капли, и каждый думает о том, что не успел сказать вчера.`,
      "«Иногда достаточно одной страницы, чтобы вернуться домой.»",
      `В комнате пахнет бумагой и тёплым чаем. На столе лежит раскрытая книга, и строчки на её страницах кажутся длиннее, чем обычно.`,
      `Куро проходит между рядами и оставляет на полке маленькое золотое перо. Никто не знает, откуда оно берётся, но каждый, кто его находит, читает чуть внимательнее.`,
      `«${name}» заканчивается там, где начинается новая. Ты закрываешь книгу, но история остаётся — тихо, как свет под дверью.`
    ];
  }

  function bindQuoteSelection(chapter) {
    if (!notesApi || typeof notesApi.add !== "function") return;
    const article = $("#reader-text");
    if (!article) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "quote-save";
    button.hidden = true;
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z"/><path d="M9 9h6M9 12h4"/></svg><span>В заметки</span>`;
    document.body.appendChild(button);

    let quote = "";

    const hide = () => {
      button.hidden = true;
      quote = "";
    };

    const selectedText = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return "";
      const range = selection.getRangeAt(0);
      if (!article.contains(range.commonAncestorContainer)) return "";
      return selection.toString().replace(/\s+/g, " ").trim();
    };

    const show = () => {
      const text = selectedText();
      if (text.length < 3) {
        hide();
        return;
      }
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) {
        hide();
        return;
      }
      quote = text;
      button.hidden = false;
      const width = button.offsetWidth || 118;
      const center = rect.left + rect.width / 2;
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, center - width / 2));
      let top = rect.top - 46;
      if (top < 72) top = rect.bottom + 10;
      top = Math.max(72, Math.min(window.innerHeight - 48, top));
      button.style.left = `${left}px`;
      button.style.top = `${top}px`;
    };

    const onPointerUp = () => window.setTimeout(show, 0);

    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchend", () => window.setTimeout(show, 80), { passive: true });
    document.addEventListener("keyup", (event) => {
      if (event.key === "Shift" || event.key.startsWith("Arrow")) onPointerUp();
    });
    document.addEventListener("selectionchange", () => {
      if (!button.hidden && !selectedText()) hide();
    });
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("resize", hide);

    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      if (!quote) return;
      if (quote.length > notesApi.MAX_QUOTE) {
        window.KurohaToast?.("Слишком длинная цитата — выдели фрагмент до 500 знаков.");
        hide();
        return;
      }
      const saved = notesApi.add({ slug: item.slug, chapter, quote });
      window.KurohaToast?.(
        saved ? "Цитата сохранена в заметки." : "Эта цитата уже в заметках."
      );
      hide();
      window.getSelection()?.removeAllRanges();
    });
  }

  function renderReader() {
    const article = $("#reader-text");
    if (!article) return;

    const rawChapter = Number.parseInt(params.get("chapter"), 10);
    const saved = getProgress(item.slug);
    let chapter =
      Number.isFinite(rawChapter) && rawChapter > 0 ? rawChapter : saved || 1;
    chapter = Math.max(1, Math.min(totalChapters, chapter));

    if (libraryApi) {
      const shelfStatus = getShelfStatus();
      if (!shelfStatus || shelfStatus === "planned") {
        libraryApi.setStatus(item.slug, "reading");
      }
    }

    const titleUrl = `title.html?slug=${encodeURIComponent(item.slug)}`;
    const baseUrl = `reader.html?slug=${encodeURIComponent(item.slug)}`;
    document.title = `Глава ${chapter} — ${item.title} — Kuroha`;
    document.documentElement.style.setProperty("--reader-c1", item.c1);

    const setText = (selector, value) => {
      const element = $(selector);
      if (element) element.textContent = value;
    };

    const readerUpload = uploadedChapter(chapter);
    setText("#reader-bar-title", item.title);
    setText("#reader-bar-chapter", `Глава ${chapter}`);
    setText("#reader-chapter-label", `Глава ${chapter}`);
    setText("#reader-title", chapterTitle(chapter));
    setText(
      "#reader-meta",
      readerUpload
        ? `${item.title} · загруженная глава · ${Math.max(1, Number(readerUpload.pages) || 1)} ${plural(Math.max(1, Number(readerUpload.pages) || 1), ["страница", "страницы", "страниц"])}`
        : `${item.title} · ${TYPE_LABELS[item.type]} · ${chapterMinutes(chapter)} минут`
    );

    const uploaded = readerUpload;
    if (uploaded) {
      const pages = Math.max(1, Number(uploaded.pages) || 1);
      const fileLabel = uploaded.files && uploaded.files.length
        ? `${uploaded.files.length} ${plural(uploaded.files.length, ["файл", "файла", "файлов"])}`
        : "демо-страницы";
      article.innerHTML =
        `<div class="reader-upload-note">
          <p class="reader-upload-note__label">Глава загружена через админку</p>
          <p>${pages} ${plural(pages, ["страница", "страницы", "страниц"])} · ${escapeHTML(fileLabel)}. В прототипе изображения заменены на демонстрационные листы.</p>
        </div>
        <div class="reader-upload-pages">` +
        Array.from({ length: pages }, (_, index) =>
          `<div class="reader-upload-page">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <p>Демо-страница загруженной главы</p>
          </div>`
        ).join("") +
        `</div>`;
    } else {
      const paragraphs =
        item.slug === "pepel-i-luna" && chapter === 12
          ? specialChapter()
          : genericChapter(item, chapter);

      article.innerHTML = paragraphs
        .map((paragraph, index) =>
          index === 2
            ? `<blockquote class="reader-quote">${paragraph}</blockquote>`
            : `<p>${paragraph}</p>`
        )
        .join("");
    }

    const select = $("#chapter-select");
    if (select) {
      select.innerHTML = Array.from({ length: totalChapters }, (_, index) => {
        const number = index + 1;
        return `<option value="${number}"${number === chapter ? " selected" : ""}>${number}. ${escapeHTML(chapterTitle(number))}</option>`;
      }).join("");
      select.addEventListener("change", () => {
        window.location.href = `${baseUrl}&chapter=${select.value}`;
      });
    }

    const previous = $("#reader-prev");
    const next = $("#reader-next");
    if (previous) {
      if (chapter > 1) {
        previous.href = `${baseUrl}&chapter=${chapter - 1}`;
        previous.hidden = false;
      } else {
        previous.hidden = true;
      }
    }
    if (next) {
      if (chapter < totalChapters) {
        next.href = `${baseUrl}&chapter=${chapter + 1}`;
        next.textContent = "Следующая →";
      } else {
        next.href = titleUrl;
        next.textContent = "К тайтлу";
      }
    }

    ["#reader-back", "#reader-close", "#reader-to-title"].forEach((selector) => {
      const link = $(selector);
      if (link) link.href = titleUrl;
    });

    const DEFAULT_READER_SETTINGS = { size: 19, line: 1.8, width: 64 };

    const clampSetting = (value, min, max, fallback) => {
      const number = Number(value);
      return Number.isFinite(number)
        ? Math.min(max, Math.max(min, number))
        : fallback;
    };

    const readReaderSettings = () => {
      let saved = {};
      try {
        saved = JSON.parse(localStorage.getItem(STORAGE.settings) || "{}") || {};
      } catch (error) {}
      const legacySize = Number(localStorage.getItem(STORAGE.font));
      return {
        size: clampSetting(saved.size ?? legacySize, 17, 24, 19),
        line: clampSetting(saved.line, 1.55, 2.05, 1.8),
        width: clampSetting(saved.width, 52, 76, 64)
      };
    };

    const readerSettings = readReaderSettings();

    const applyReaderSettings = (persist = true) => {
      const root = document.documentElement;
      root.style.setProperty("--reader-font-size", `${readerSettings.size}px`);
      root.style.setProperty("--reader-line-height", readerSettings.line.toFixed(2));
      root.style.setProperty("--reader-width", `${readerSettings.width}ch`);

      const sizeRange = $("#reader-size-range");
      const lineRange = $("#reader-line-range");
      const widthRange = $("#reader-width-range");
      if (sizeRange) sizeRange.value = String(readerSettings.size);
      if (lineRange) lineRange.value = String(readerSettings.line);
      if (widthRange) widthRange.value = String(readerSettings.width);

      const sizeValue = $("#reader-size-value");
      const lineValue = $("#reader-line-value");
      const widthValue = $("#reader-width-value");
      if (sizeValue) sizeValue.textContent = `${readerSettings.size} px`;
      if (lineValue) lineValue.textContent = readerSettings.line.toFixed(2);
      if (widthValue) widthValue.textContent = `${readerSettings.width}ch`;

      const minus = $("#font-minus");
      const plus = $("#font-plus");
      if (minus) minus.disabled = readerSettings.size <= 17;
      if (plus) plus.disabled = readerSettings.size >= 24;

      if (!persist) return;
      try {
        localStorage.setItem(STORAGE.settings, JSON.stringify(readerSettings));
        localStorage.setItem(STORAGE.font, String(readerSettings.size));
      } catch (error) {}
    };

    const bindReaderSettings = () => {
      const dialog = $("#reader-settings-dialog");
      const openButton = $("#reader-settings");
      if (!dialog || !openButton) return;

      const open = () => {
        applyReaderSettings(false);
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
        openButton.setAttribute("aria-expanded", "true");
      };
      const close = () => {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
        openButton.setAttribute("aria-expanded", "false");
      };

      openButton.addEventListener("click", open);
      dialog.querySelectorAll("[data-reader-settings-close]").forEach((button) => {
        button.addEventListener("click", close);
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) close();
      });
      dialog.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      });
      document.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape" && dialog.open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        },
        true
      );
      dialog.addEventListener("close", () => {
        openButton.setAttribute("aria-expanded", "false");
        openButton.focus({ preventScroll: true });
      });

      $("#reader-size-range")?.addEventListener("input", (event) => {
        readerSettings.size = clampSetting(event.target.value, 17, 24, 19);
        applyReaderSettings();
      });
      $("#reader-line-range")?.addEventListener("input", (event) => {
        readerSettings.line = clampSetting(event.target.value, 1.55, 2.05, 1.8);
        applyReaderSettings();
      });
      $("#reader-width-range")?.addEventListener("input", (event) => {
        readerSettings.width = clampSetting(event.target.value, 52, 76, 64);
        applyReaderSettings();
      });
      $("#reader-settings-reset")?.addEventListener("click", () => {
        Object.assign(readerSettings, DEFAULT_READER_SETTINGS);
        applyReaderSettings();
        window.KurohaToast?.("Настройки чтения сброшены.");
      });
    };

    $("#font-minus")?.addEventListener("click", () => {
      readerSettings.size = Math.max(17, readerSettings.size - 1);
      applyReaderSettings();
    });
    $("#font-plus")?.addEventListener("click", () => {
      readerSettings.size = Math.min(24, readerSettings.size + 1);
      applyReaderSettings();
    });

    applyReaderSettings(false);
    bindReaderSettings();

    updateBookmarkButtons();
    setProgress(item.slug, chapter);

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    const progressBar = $("#reader-progress");
    const topButton = $("#reader-top");
    const positionKey = `${item.slug}:${chapter}`;
    let ticking = false;
    let positionTimer = null;

    const readPositions = () => {
      const data = readJSON(STORAGE.position, {});
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    };

    const saveReadingPosition = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const percent = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
      const positions = readPositions();
      if (percent >= 3 && percent <= 92) {
        positions[positionKey] = {
          percent: Number(percent.toFixed(2)),
          updatedAt: new Date().toISOString()
        };
      } else {
        delete positions[positionKey];
      }
      writeJSON(STORAGE.position, positions);
    };

    const schedulePositionSave = () => {
      if (positionTimer) window.clearTimeout(positionTimer);
      positionTimer = window.setTimeout(saveReadingPosition, 420);
    };

    const updateScrollProgress = () => {
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
      const percent =
        max > 0
          ? Math.min(100, Math.max(0, (window.scrollY / max) * 100))
          : 0;
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (topButton) topButton.hidden = window.scrollY < 360;
    };

    let positionRestored = false;
    const restoreReadingPosition = () => {
      if (positionRestored) return;
      const savedPosition = readPositions()[positionKey];
      if (!savedPosition) return;
      const percent = Number(savedPosition.percent);
      if (!Number.isFinite(percent) || percent < 3 || percent > 92) return;
      window.requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0) {
          const root = document.documentElement;
          const previousBehavior = root.style.scrollBehavior;
          root.style.scrollBehavior = "auto";
          window.scrollTo(0, Math.round((max * percent) / 100));
          root.style.scrollBehavior = previousBehavior;
          positionRestored = true;
          updateScrollProgress();
          window.KurohaToast?.("Вернулись на то же место.");
        }
      });
    };

    const onScroll = () => {
      schedulePositionSave();
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        updateScrollProgress();
        ticking = false;
      });
    };

    topButton?.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScrollProgress);
    window.addEventListener("pagehide", saveReadingPosition);
    window.addEventListener("pageshow", restoreReadingPosition);
    updateScrollProgress();
    restoreReadingPosition();
    window.setTimeout(restoreReadingPosition, 240);

    window.addEventListener("keydown", (event) => {
      if ($("#reader-settings-dialog")?.open) {
        return;
      }
      const tag = (event.target.tagName || "").toLowerCase();
      if (
        tag === "input" ||
        tag === "select" ||
        tag === "textarea" ||
        event.target.isContentEditable
      ) {
        return;
      }
      if (event.key === "ArrowLeft" && chapter > 1) {
        event.preventDefault();
        window.location.href = `${baseUrl}&chapter=${chapter - 1}`;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        window.location.href =
          chapter < totalChapters
            ? `${baseUrl}&chapter=${chapter + 1}`
            : titleUrl;
      }
    });

    updateBookmarkButtons();
    bindQuoteSelection(chapter);
    renderChapterDiscussion(chapter);
    bindChapterDiscussion(chapter);
  }

  /* --------------------------------------------------------------------------
     API title page — title.html?titleSlug=…&api=…
     Demo mode (title.html?slug=…) is rendered exactly as before.
     -------------------------------------------------------------------------- */
  function apiBaseFromParam(raw) {
    const value = String(raw || "").trim();
    return (value || "https://api.kuroha.org/api").replace(/\/+$/, "");
  }

  function apiTypeLabel(type) {
    return API_TYPE_LABELS[type] || type || "тайтл";
  }

  function apiTitleStatusLabel(status) {
    return API_TITLE_STATUS_LABELS[status] || status || "—";
  }

  function apiRightsLabel(status) {
    return API_RIGHTS_LABELS[status] || status || "не указаны";
  }

  function apiSafeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.protocol === "http:" || url.protocol === "https:") return raw;
    } catch (error) {}
    return "";
  }

  function apiReaderHref(api, slug, chapterId) {
    return (
      "reader.html?chapterId=" + encodeURIComponent(chapterId) +
      "&api=" + encodeURIComponent(api) +
      "&titleSlug=" + encodeURIComponent(slug)
    );
  }

  function apiTitleHref(api, slug) {
    return (
      "title.html?titleSlug=" + encodeURIComponent(slug) +
      "&api=" + encodeURIComponent(api)
    );
  }

  function alignApiReaderTitleLinks(rawSlug, rawApi) {
    const slug = String(rawSlug || "").trim();
    if (!slug) return;
    const href = apiTitleHref(apiBaseFromParam(rawApi), slug);

    window.addEventListener("load", () => {
      ["#reader-back", "#reader-close", "#reader-to-title"].forEach((selector) => {
        const link = $(selector);
        if (link) link.href = href;
      });
      $$(".reader-images__action").forEach((link) => {
        if (link.tagName === "A") link.href = href;
      });
    });
  }

  function initApiTitlePage(rawSlug, rawApi) {
    const main = $("#main");
    if (!main) return;

    const api = apiBaseFromParam(rawApi);
    const slug = String(rawSlug || "").trim();
    const hero = $("#title-hero");
    const continueBlock = $("#title-continue");
    const layout = $(".title-layout");
    const similar = $(".similar-section");
    const state = document.createElement("section");
    let attempt = 0;

    document.body.dataset.titleApi = "true";
    state.className = "title-api-state container";
    state.id = "title-api-state";
    state.setAttribute("role", "status");
    state.setAttribute("aria-live", "polite");
    main.insertBefore(state, main.firstChild);

    [hero, continueBlock, layout, similar].forEach((block) => {
      if (block) block.hidden = true;
    });

    /* Demo scripts may have opened a gate or queued a report for the demo slug. */
    $$(".age-gate").forEach((dialog) => dialog.remove());

    load();

    function skeletonRow() {
      return (
        '<div class="title-api-skeleton__row">' +
        "<span></span><span></span><span></span>" +
        "</div>"
      );
    }

    function showSkeleton() {
      document.title = "Загрузка тайтла — Kuroha";
      state.innerHTML =
        '<div class="title-api-skeleton" aria-hidden="true">' +
        '<div class="title-api-skeleton__cover"></div>' +
        '<div class="title-api-skeleton__body">' +
        '<span class="title-api-skeleton__line title-api-skeleton__line--eyebrow"></span>' +
        '<span class="title-api-skeleton__line title-api-skeleton__line--heading"></span>' +
        '<span class="title-api-skeleton__line"></span>' +
        '<span class="title-api-skeleton__line"></span>' +
        '<span class="title-api-skeleton__line title-api-skeleton__line--short"></span>' +
        "</div>" +
        "</div>" +
        '<div class="title-api-skeleton__chapters" aria-hidden="true">' +
        skeletonRow() + skeletonRow() + skeletonRow() + skeletonRow() +
        "</div>" +
        '<p class="sr-only">Загружаем тайтл…</p>';
      main.setAttribute("aria-busy", "true");
      document.documentElement.classList.add("is-title-api");
    }

    async function load() {
      const ticket = ++attempt;
      showSkeleton();

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 10000);
      let response;
      let payload = null;

      try {
        response = await fetch(api + "/titles/" + encodeURIComponent(slug), {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal
        });
        try {
          payload = await response.json();
        } catch (error) {}
      } catch (error) {
        window.clearTimeout(timer);
        if (ticket !== attempt) return;
        showError(error);
        return;
      }
      window.clearTimeout(timer);
      if (ticket !== attempt) return;

      if (!response.ok) {
        const details =
          payload && payload.error && typeof payload.error === "object"
            ? payload.error
            : null;
        showError({
          status: response.status,
          code: details ? details.code : "",
          message:
            details && details.message
              ? details.message
              : typeof payload?.error === "string"
                ? payload.error
                : ""
        });
        return;
      }

      if (!payload || payload.ok !== true || !payload.title) {
        showError({ status: 200, code: "BAD_RESPONSE" });
        return;
      }

      render(payload);
      main.removeAttribute("aria-busy");
    }

    function showError(error) {
      const status = Number(error && error.status) || 0;
      let heading = "Тайтл не загрузился";
      let text = "Попробуй ещё раз — страница не потерялась.";

      if (status === 404) {
        heading = "Тайтл не найден";
        text = "Возможно, ссылка устарела или тайтл снят с публикации.";
      } else if (status === 401) {
        heading = "Нужен вход";
        text = "Эта страница доступна после входа в аккаунт команды.";
      } else if (status === 403) {
        heading = "Страница закрыта";
        text = "Тайтл доступен только команде перевода и модерации.";
      } else if (status === 200) {
        text = "API ответил неполными данными. Проверь адрес API и попробуй снова.";
      } else if (status >= 500) {
        text = "Сервер временно не справился с запросом. Попробуй ещё раз через минуту.";
      } else if (!status) {
        heading = "Сервер не отвечает";
        text =
          "Проверь, что API запущен на " + api + ", и попробуй снова.";
      }

      document.title = heading + " — Kuroha";
      main.removeAttribute("aria-busy");
      document.documentElement.classList.add("is-title-api");
      state.innerHTML =
        '<div class="title-api-state__panel">' +
        '<p class="eyebrow">API</p>' +
        '<h1 class="title-api-state__title">' + escapeHTML(heading) + "</h1>" +
        '<p class="title-api-state__text">' + escapeHTML(text) + "</p>" +
        '<div class="title-api-state__actions">' +
        '<button class="btn btn--secondary" type="button" data-api-retry>Повторить</button>' +
        '<a class="btn btn--ghost" href="catalog.html">В каталог</a>' +
        "</div>" +
        "</div>";

      const retry = state.querySelector("[data-api-retry]");
      if (retry) retry.addEventListener("click", () => load());
    }

    function publishedVersion(chapter) {
      const versions = Array.isArray(chapter.versions) ? chapter.versions : [];
      return versions.find((version) => version && version.status === "published") || null;
    }

    function coverLines(value) {
      const title = String(value || "").trim();
      const words = title.split(/\s+/).filter(Boolean);
      if (words.length < 2) return [title, ""];

      let bestIndex = 1;
      let bestScore = Infinity;
      for (let index = 1; index < words.length; index += 1) {
        const left = words.slice(0, index).join(" ");
        const right = words.slice(index).join(" ");
        const score = Math.abs(left.length - right.length);
        if (score < bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      return [
        words.slice(0, bestIndex).join(" "),
        words.slice(bestIndex).join(" ")
      ];
    }

    function coverHTML(title) {
      const lines = coverLines(title.titleRu || "Без названия");
      const first = escapeHTML(lines[0] || "");
      const second = lines[1] ? "<br>" + escapeHTML(lines[1]) : "";
      return (
        '<div class="cover cover--lg cover--low" data-art="line" ' +
        'style="--c1:var(--kh-ink-700);--c2:var(--kh-ink-950);--c-accent:var(--kh-red)" aria-hidden="true">' +
        '<span class="cover__type">' + escapeHTML(apiTypeLabel(title.type)) + "</span>" +
        '<span class="cover__title">' + first + second + "</span>" +
        "</div>"
      );
    }

    function hideDemoControls() {
      [
        "#shelf-picker",
        "#lists-picker",
        "[data-bookmark]",
        ".title-rating",
        ".title-tabs",
        "#title-continue",
        ".similar-section",
        "#side-shelf",
        ".side-bookmark",
        "#title-genres"
      ].forEach((selector) => {
        $$(selector).forEach((element) => {
          element.hidden = true;
        });
      });

      const sideProgress = $("#side-progress");
      if (sideProgress) {
        const block = sideProgress.closest(".side-block");
        if (block) block.hidden = true;
      }

      const sideGenres = $("#side-genres");
      if (sideGenres) {
        const block = sideGenres.closest(".side-block");
        if (block) block.hidden = true;
      }

      $$(".side-report").forEach((block) => block.remove());

      $$("[data-title-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.titlePanel !== "chapters";
      });
      const chaptersPanel = $("#title-chapters");
      if (chaptersPanel) chaptersPanel.hidden = false;
    }

    function hideSideRow(selector) {
      const node = $(selector);
      if (!node) return;
      const row = node.closest("div");
      if (row) row.hidden = true;
    }

    function renderRights(title) {
      const titleMain = $(".title-main");
      if (!titleMain) return;

      const status = title.rightsStatus || "unverified";
      const statusKey = Object.prototype.hasOwnProperty.call(API_RIGHTS_LABELS, status)
        ? status
        : "unverified";
      const rows = [];

      if (title.rightsHolder) {
        rows.push(
          '<div class="title-rights__row"><dt>Правообладатель</dt><dd>' +
          escapeHTML(title.rightsHolder) + "</dd></div>"
        );
      }
      if (title.licenseCode) {
        rows.push(
          '<div class="title-rights__row"><dt>Лицензия</dt><dd>' +
          escapeHTML(title.licenseCode) + "</dd></div>"
        );
      }

      const licenseUrl = apiSafeUrl(title.licenseUrl);
      if (licenseUrl) {
        rows.push(
          '<div class="title-rights__row"><dt>Условия лицензии</dt><dd>' +
          '<a href="' + escapeHTML(licenseUrl) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHTML(licenseUrl) + "</a></dd></div>"
        );
      }

      const sourceUrl = apiSafeUrl(title.sourceUrl);
      if (sourceUrl) {
        rows.push(
          '<div class="title-rights__row"><dt>Источник</dt><dd>' +
          '<a href="' + escapeHTML(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHTML(sourceUrl) + "</a></dd></div>"
        );
      }

      if (!rows.length) {
        rows.push(
          '<div class="title-rights__row"><dt>Сведения</dt><dd>' +
          "Правообладатель и лицензия не указаны.</dd></div>"
        );
      }

      const warning =
        statusKey === "unverified"
          ? '<p class="title-rights__warning" role="note">' +
            "<b>Права не подтверждены.</b> Мы показываем страницу без уверенности, " +
            'что публикация согласована. Если ты правообладатель, напиши нам через ' +
            '<a href="dmca.html">страницу DMCA</a>.' +
            "</p>"
          : "";

      const block = document.createElement("section");
      block.className = "title-rights";
      block.id = "api-rights";
      block.setAttribute("aria-labelledby", "api-rights-title");
      block.innerHTML =
        '<div class="title-rights__head">' +
        "<div>" +
        '<p class="eyebrow">Права</p>' +
        '<h2 class="title-rights__title" id="api-rights-title">Права и источник</h2>' +
        "</div>" +
        '<span class="title-rights__status title-rights__status--' + statusKey + '">' +
        escapeHTML(apiRightsLabel(status)) + "</span>" +
        "</div>" +
        '<dl class="title-rights__list">' + rows.join("") + "</dl>" +
        warning;

      titleMain.insertBefore(block, titleMain.firstChild);
    }

    function renderChapters(chapters) {
      const list = $("#chapter-list");
      const more = $("#chapter-more");
      if (more) more.hidden = true;

      const setText = (selector, value) => {
        const element = $(selector);
        if (element) element.textContent = value;
      };

      setText("#chapter-count", chapters.length + " " + plural(chapters.length, ["глава", "главы", "глав"]));
      setText("#chapter-tab-count", String(chapters.length));

      const heading = $("#chapters-title");
      if (heading) {
        heading.textContent = chapters.length ? "Опубликованные главы" : "Глав пока нет";
      }
      const lead = $("#title-chapters .section-head > div > p:last-of-type");
      if (lead) {
        lead.textContent = chapters.length
          ? "Только опубликованные главы — в порядке номеров."
          : "Как только команда опубликует первую главу, она появится здесь.";
      }

      if (!list) return;

      if (!chapters.length) {
        list.innerHTML =
          '<div class="title-api-empty">' +
          "<b>Опубликованных глав пока нет.</b>" +
          "<p>Страница уже существует, но читать пока нечего.</p>" +
          "</div>";
        return;
      }

      list.innerHTML = chapters
        .map((chapter) => {
          const version = publishedVersion(chapter);
          const rawNumber = chapter.number == null ? "" : String(chapter.number).replace(".", ",");
          const number = rawNumber
            ? /^\d+$/.test(rawNumber)
              ? rawNumber.padStart(2, "0")
              : rawNumber
            : "—";
          const meta = [];
          if (version && version.team && version.team.name) meta.push(version.team.name);
          if (version && Number(version.pageCount) > 0) {
            meta.push(
              Number(version.pageCount) + " " +
              plural(Number(version.pageCount), ["страница", "страницы", "страниц"])
            );
          }
          const name = chapter.name || (rawNumber ? "Глава " + rawNumber : "Без названия");
          return (
            '<div class="chapter-row chapter-row--api">' +
            '<span class="chapter-row__num">' + escapeHTML(number) + "</span>" +
            '<span class="chapter-row__title">' + escapeHTML(name) + "</span>" +
            '<span class="chapter-row__meta">' + escapeHTML(meta.join(" · ")) + "</span>" +
            '<a class="chapter-row__read" href="' +
            escapeHTML(apiReaderHref(api, slug, chapter.id)) + '" aria-label="Читать главу ' +
            escapeHTML(rawNumber || number) + ": " + escapeHTML(name) + '">Читать</a>' +
            "</div>"
          );
        })
        .join("");
    }

    function render(payload) {
      const title = payload.title || {};
      const chapters = (Array.isArray(payload.chapters) ? payload.chapters : [])
        .filter((chapter) => chapter && chapter.status === "published" && chapter.id)
        .sort((left, right) => Number(left.number) - Number(right.number));

      const setText = (selector, value) => {
        const element = $(selector);
        if (element) element.textContent = value;
      };

      document.title = (title.titleRu || "Тайтл") + " — Kuroha";
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute(
          "content",
          (title.titleRu || "Тайтл") + " — читать в Kuroha."
        );
      }

      setText("#title-breadcrumb-type", apiTypeLabel(title.type));
      setText(
        "#title-type",
        apiTypeLabel(title.type) + " · " + apiTitleStatusLabel(title.status)
      );
      setText("#title-name", title.titleRu || "Без названия");

      const author = $("#title-author");
      if (author) {
        if (title.titleOriginal) {
          author.textContent = "Оригинал: " + title.titleOriginal;
          author.hidden = false;
        } else if (title.authorName) {
          author.textContent = title.authorName;
          author.hidden = false;
        } else {
          author.hidden = true;
        }
      }

      setText(
        "#title-description",
        title.description || "Описание пока не добавлено."
      );

      const age = Number(title.ageRating);
      const ageLabel = Number.isFinite(age) ? age + "+" : "";
      const meta = [
        apiTypeLabel(title.type),
        ageLabel,
        chapters.length + " " + plural(chapters.length, ["глава", "главы", "глав"]),
        apiTitleStatusLabel(title.status)
      ].filter(Boolean);
      setText("#title-meta", meta.join(" · "));

      const cover = $("#title-cover");
      if (cover) cover.innerHTML = coverHTML(title);
      setText("#title-cover-code", "API");

      if (hero) {
        hero.hidden = false;
        hero.style.setProperty("--title-c1", "var(--kh-surface-raised)");
      }
      if (continueBlock) continueBlock.hidden = true;
      if (similar) similar.hidden = true;
      if (layout) layout.hidden = false;

      hideDemoControls();
      renderRights(title);
      renderChapters(chapters);

      setText("#side-type", apiTypeLabel(title.type));
      setText("#side-status", apiTitleStatusLabel(title.status));
      setText("#side-chapters", String(chapters.length));
      hideSideRow("#side-year");
      hideSideRow("#side-rating");

      const authorNames = [];
      if (title.authorName) authorNames.push(title.authorName);
      if (title.artistName) authorNames.push("художник: " + title.artistName);
      if (authorNames.length) {
        setText("#side-author", authorNames.join(" · "));
      } else {
        hideSideRow("#side-author");
      }

      const teamNames = [];
      const seenTeams = new Set();
      chapters.forEach((chapter) => {
        const version = publishedVersion(chapter);
        if (!version || !version.team || !version.team.name) return;
        const key = version.team.id || version.team.name;
        if (seenTeams.has(key)) return;
        seenTeams.add(key);
        teamNames.push(version.team.name);
      });

      const teamBlock = $("#side-team");
      if (teamBlock) {
        if (!teamNames.length) {
          teamBlock.hidden = true;
        } else {
          teamBlock.hidden = false;
          teamBlock.innerHTML =
            "<h3>Команда</h3>" +
            '<dl class="side-list">' +
            teamNames
              .map((name) => "<div><dt>Перевод</dt><dd>" + escapeHTML(name) + "</dd></div>")
              .join("") +
            "</dl>" +
            '<p class="side-team__note">По опубликованным главам.</p>';
        }
      }

      const read = $("#title-read");
      if (read) {
        if (chapters.length) {
          read.href = apiReaderHref(api, slug, chapters[0].id);
          read.textContent = "Начать читать";
          read.removeAttribute("aria-disabled");
          read.classList.remove("is-disabled");
          read.removeAttribute("title");
        } else {
          read.removeAttribute("href");
          read.setAttribute("aria-disabled", "true");
          read.classList.add("is-disabled");
          read.textContent = "Начать читать";
          read.title = "Опубликованных глав пока нет";
        }
      }

      state.remove();
      document.documentElement.classList.remove("is-title-api");
      main.removeAttribute("aria-busy");
    }
  }

  bindBookmarks();
  bindShelf();
  bindLists();
  bindDiscussions();
  bindReviews();
  updateBookmarkButtons();

  if (currentPage === "title") {
    renderTitle();
    scrollToStatsHash();
    scrollToReviewsHash();
  }
  if (currentPage === "reader" && !params.get("chapterId")) renderReader();
})();

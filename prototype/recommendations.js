/* Kuroha - quiet recommendations.
   Reads the local shelf, ratings, notes and progress.
   No network, no accounts: everything is computed in the browser. */
(function () {
  "use strict";

  const TITLES = window.KUROHA_TITLES || [];
  const bySlug = new Map(TITLES.map(function (item) { return [item.slug, item]; }));
  const libraryApi = window.KurohaLibrary;
  const ratingsApi = window.KurohaRatings;
  const notesApi = window.KurohaNotes;
  const HIDDEN_KEY = "kuroha-recommendation-hidden";
  const PROGRESS_KEY = "kuroha-progress";
  const TASTE_KEY = "kuroha-taste";
  const LIMIT = 8;

  const TYPE_LABELS = { manga: "манга", manhwa: "манхва", manhua: "маньхуа", novel: "новелла" };
  const STATUS_LABELS = { ongoing: "онгоинг", completed: "завершён", frozen: "заморожен" };
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

  function readJSON(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function readTaste() {
    const raw = readJSON(TASTE_KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { genres: [], types: [] };
    }
    const genres = Array.isArray(raw.genres)
      ? raw.genres.filter(function (genre) { return typeof genre === "string"; }).slice(0, 5)
      : [];
    const types = Array.isArray(raw.types)
      ? raw.types.filter(function (type) { return typeof type === "string"; }).slice(0, 2)
      : [];
    return { genres: genres, types: types };
  }

  function getHidden() {
    const raw = readJSON(HIDDEN_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (slug, index, list) {
      return bySlug.has(slug) && list.indexOf(slug) === index;
    });
  }

  function setHidden(value) {
    try {
      window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(value));
    } catch (error) {
      // A full local storage should not break the page.
    }
  }

  function getProgress() {
    const raw = readJSON(PROGRESS_KEY, {});
    const clean = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return clean;
    Object.keys(raw).forEach(function (slug) {
      const item = bySlug.get(slug);
      const chapter = Math.floor(Number(raw[slug]));
      if (item && chapter > 0) clean[slug] = chapter;
    });
    return clean;
  }

  function totalChapters(item) {
    const base = Number(item.chapters) || 0;
    const api = window.KurohaUploads;
    if (api && typeof api.totalFor === "function") {
      const total = Number(api.totalFor(item.slug, base));
      return total > 0 ? total : base;
    }
    return base;
  }

  function plural(number, forms) {
    const abs = Math.abs(number) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function formatRating(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number.toFixed(1)).replace(".", ",") : "—";
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function addSource(map, slug, weight) {
    const item = bySlug.get(slug);
    if (!item) return;
    const previous = map.get(slug) || 0;
    map.set(slug, Math.max(previous, weight));
  }

  function buildTaste() {
    const tasteProfile = readTaste();
    const sourceWeights = new Map();
    const genreCounts = {};
    const genreWeights = {};
    const typeWeights = {};
    const ratings = ratingsApi && typeof ratingsApi.allMine === "function"
      ? ratingsApi.allMine().filter(function (entry) { return bySlug.has(entry.slug); })
      : [];

    if (libraryApi && typeof libraryApi.read === "function") {
      let shelf = {};
      try { shelf = libraryApi.read() || {}; } catch (error) { shelf = {}; }
      Object.keys(shelf).forEach(function (slug) {
        const status = shelf[slug];
        if (status === "dropped") return;
        const weight = status === "reading" || status === "completed" ? 3 : status === "planned" ? 2 : 1;
        addSource(sourceWeights, slug, weight);
      });
    }

    const progress = getProgress();
    Object.keys(progress).forEach(function (slug) {
      addSource(sourceWeights, slug, 2.5);
    });

    ratings.forEach(function (entry) {
      if (Number(entry.score) >= 7) addSource(sourceWeights, entry.slug, 3);
    });

    const notes = notesApi && typeof notesApi.read === "function" ? notesApi.read() : [];
    notes.forEach(function (note) {
      if (note && note.slug) addSource(sourceWeights, note.slug, 1.5);
    });

    const sources = [];
    sourceWeights.forEach(function (weight, slug) {
      const item = bySlug.get(slug);
      if (!item) return;
      sources.push({ item: item, weight: weight });
      (item.genres || []).forEach(function (genre) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        genreWeights[genre] = (genreWeights[genre] || 0) + weight;
      });
      typeWeights[item.type] = (typeWeights[item.type] || 0) + weight;
    });

    const topGenres = Object.keys(genreCounts).sort(function (a, b) {
      return genreCounts[b] - genreCounts[a] || genreWeights[b] - genreWeights[a];
    });

    const topType = Object.keys(typeWeights).sort(function (a, b) {
      return typeWeights[b] - typeWeights[a];
    })[0] || null;

    return {
      sources: sources,
      ratings: ratings,
      genreCounts: genreCounts,
      genreWeights: genreWeights,
      typeWeights: typeWeights,
      topGenres: topGenres,
      topType: topType,
      profile: tasteProfile
    };
  }

  function bestMatch(candidate, sources) {
    let best = null;
    sources.forEach(function (source) {
      if (source.item.slug === candidate.slug) return;
      const shared = (candidate.genres || []).filter(function (genre) {
        return (source.item.genres || []).indexOf(genre) !== -1;
      });
      if (!best || shared.length > best.shared.length ||
          (shared.length === best.shared.length && source.weight > best.weight)) {
        best = { item: source.item, shared: shared, weight: source.weight };
      }
    });
    return best;
  }

  function reasonFor(candidate, taste, match) {
    if (match && match.shared.length >= 2) {
      return {
        text: "Похоже на «" + match.item.title + "»",
        note: "Совпадает: " + match.shared.slice(0, 3).map(function (genre) {
          return GENRE_LABELS[genre] || genre;
        }).join(" · ")
      };
    }

    const chosenGenre = (candidate.genres || []).find(function (item) {
      return taste.profile && taste.profile.genres && taste.profile.genres.indexOf(item) !== -1;
    });
    if (chosenGenre) {
      return {
        text: "Твой вкус — " + (GENRE_LABELS[chosenGenre] || chosenGenre),
        note: "Этот жанр выбран в настройках вкуса."
      };
    }

    const genre = (candidate.genres || []).find(function (item) {
      return taste.genreWeights[item];
    });
    if (genre) {
      return {
        text: "Твой жанр — " + (GENRE_LABELS[genre] || genre),
        note: "Вкус собран из полки, оценок и заметок."
      };
    }

    if (Number(candidate.rating) >= 9) {
      return { text: "Высокая оценка читателей", note: "Одна из самых тихих и сильных историй." };
    }
    if (candidate.isNew) {
      return { text: "Новая история в библиотеке", note: "Свежая глава уже ждёт." };
    }
    return { text: "Выбор редакции", note: "История, которая держит марку Kuroha." };
  }

  function buildRecommendations(taste, hidden) {
    const used = new Set(taste.sources.map(function (source) { return source.item.slug; }));
    const hiddenSet = new Set(hidden);

    const candidates = TITLES.filter(function (item) {
      return !used.has(item.slug) && !hiddenSet.has(item.slug);
    });

    const scored = candidates.map(function (item) {
      const affinity = (item.genres || []).reduce(function (sum, genre) {
        return sum + (taste.genreWeights[genre] || 0);
      }, 0);
      const typeScore = taste.typeWeights[item.type] || 0;
      const tasteGenres = taste.profile && Array.isArray(taste.profile.genres) ? taste.profile.genres : [];
      const tasteTypes = taste.profile && Array.isArray(taste.profile.types) ? taste.profile.types : [];
      const tasteBoost = (item.genres || []).reduce(function (sum, genre) {
        return sum + (tasteGenres.indexOf(genre) !== -1 ? 1.4 : 0);
      }, 0) + (tasteTypes.indexOf(item.type) !== -1 ? 1.2 : 0);
      const score = affinity * 1.6 + typeScore * 0.35 + tasteBoost +
        (Number(item.rating) || 0) * 0.9 +
        (Number(item.popularity) || 0) * 0.012 +
        (item.isNew ? 0.5 : 0);
      const match = bestMatch(item, taste.sources);
      return {
        item: item,
        score: score,
        match: match,
        reason: reasonFor(item, taste, match)
      };
    });

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.item.rating !== a.item.rating) return b.item.rating - a.item.rating;
      return b.item.popularity - a.item.popularity;
    });

    return scored.slice(0, LIMIT);
  }

  function miniCover(item) {
    if (window.KurohaCards && typeof window.KurohaCards.miniCoverHTML === "function") {
      return window.KurohaCards.miniCoverHTML(item);
    }
    return '<span class="rec-row__cover-fallback" aria-hidden="true"></span>';
  }

  function rowHTML(entry) {
    const item = entry.item;
    const total = totalChapters(item);
    const genres = (item.genres || []).slice(0, 3).map(function (genre) {
      return '<span class="rec-row__genre">' + escapeHTML(GENRE_LABELS[genre] || genre) + "</span>";
    }).join("");
    const href = "title.html?slug=" + encodeURIComponent(item.slug);

    return '<article class="rec-row" data-rec-row="' + escapeHTML(item.slug) + '">' +
      '<a class="rec-row__cover" href="' + href + '" aria-label="' + escapeHTML(item.title) + ' — открыть страницу тайтла">' +
        miniCover(item) +
      "</a>" +
      '<div class="rec-row__body">' +
        '<div class="rec-row__head">' +
          '<h3><a href="' + href + '">' + escapeHTML(item.title) + "</a></h3>" +
          '<span class="rating">★ ' + formatRating(item.rating) + "</span>" +
        "</div>" +
        '<p class="rec-row__meta">' + escapeHTML(TYPE_LABELS[item.type] || item.type) + " · " +
          escapeHTML(STATUS_LABELS[item.status] || item.status) + " · " + total + " " +
          plural(total, ["глава", "главы", "глав"]) + " · " + escapeHTML(item.year) + "</p>" +
        '<p class="rec-row__reason"><b>' + escapeHTML(entry.reason.text) + "</b><span>" + escapeHTML(entry.reason.note) + "</span></p>" +
        '<div class="rec-row__genres">' + genres + "</div>" +
      "</div>" +
      '<div class="rec-row__actions">' +
        '<a class="btn btn--small btn--primary" href="reader.html?slug=' + encodeURIComponent(item.slug) + '&chapter=1">Читать</a>' +
        '<button class="rec-hide" type="button" data-rec-hide="' + escapeHTML(item.slug) + '">Не интересно</button>' +
      "</div>" +
    "</article>";
  }

  function renderTaste(taste) {
    const count = taste.sources.length;
    const ratingCount = taste.ratings.length;
    const lead = document.getElementById("taste-lead");
    const genres = document.getElementById("taste-genres");
    const type = document.getElementById("taste-type");
    const profile = document.getElementById("taste-profile");

    if (lead) {
      lead.innerHTML = "Собрано из <b id=\"taste-titles\">" + count + "</b> " +
        plural(count, ["история", "истории", "историй"]) + " и <b id=\"taste-ratings\">" +
        ratingCount + "</b> " + plural(ratingCount, ["оценка", "оценки", "оценок"]) +
        ". Чем больше читаешь, тем точнее подборка.";
    }

    if (genres) {
      if (taste.topGenres.length === 0) {
        genres.innerHTML = '<span class="rec-taste__empty">Пока мало данных. Начни с каталога — вкус соберётся сам.</span>';
      } else {
        genres.innerHTML = taste.topGenres.slice(0, 4).map(function (genre) {
          return '<span class="taste-genre">' + escapeHTML(GENRE_LABELS[genre] || genre) +
            '<b>' + taste.genreCounts[genre] + "</b></span>";
        }).join("");
      }
    }

    if (type) {
      type.textContent = taste.topType
        ? "Чаще всего — " + (TYPE_LABELS[taste.topType] || taste.topType) + "."
        : "Пока мало данных — начни с каталога.";
    }

    if (profile) {
      const chosenGenres = taste.profile && Array.isArray(taste.profile.genres) ? taste.profile.genres : [];
      const chosenTypes = taste.profile && Array.isArray(taste.profile.types) ? taste.profile.types : [];
      if (chosenGenres.length === 0 && chosenTypes.length === 0) {
        profile.textContent = "Вкус пока не настроен — выбери жанры, и подборка станет точнее.";
      } else {
        const genreText = chosenGenres.slice(0, 3).map(function (genre) {
          return GENRE_LABELS[genre] || genre;
        }).join(", ");
        const typeText = chosenTypes.map(function (item) {
          return TYPE_LABELS[item] || item;
        }).join(", ");
        profile.textContent = "Твой выбор: " + (genreText || "любой жанр") +
          (typeText ? " · " + typeText : "") + ".";
      }
    }
  }

  function render() {
    const taste = buildTaste();
    const hidden = getHidden();
    const recommendations = buildRecommendations(taste, hidden);
    const list = document.getElementById("rec-list");
    const empty = document.getElementById("rec-empty");
    const count = document.getElementById("rec-count");
    const undo = document.getElementById("rec-undo");
    const hiddenCount = document.getElementById("rec-hidden-count");
    const emptyTitle = document.getElementById("rec-empty-title");
    const emptyCopy = document.getElementById("rec-empty-copy");

    renderTaste(taste);

    if (count) count.textContent = recommendations.length + " " +
      plural(recommendations.length, ["история", "истории", "историй"]);

    if (list) list.innerHTML = recommendations.map(rowHTML).join("");

    if (empty) empty.hidden = recommendations.length !== 0;
    if (emptyTitle) {
      emptyTitle.textContent = hidden.length > 0 ? "Всё скрыто" : "Пока нечего предложить";
    }
    if (emptyCopy) {
      emptyCopy.textContent = hidden.length > 0
        ? "Ты убрал все рекомендации. Верни их, чтобы посмотреть снова."
        : "Похоже, ты уже прочитал всё, что есть в библиотеке. Загляни в каталог — там появляются новые истории.";
    }

    if (undo) undo.hidden = hidden.length === 0;
    if (hiddenCount) hiddenCount.textContent = String(hidden.length);

    document.querySelectorAll("[data-rec-undo]").forEach(function (button) {
      button.hidden = hidden.length === 0;
    });
  }

  function toast(message) {
    if (typeof window.KurohaToast === "function") window.KurohaToast(message);
  }

  function hide(slug) {
    if (!bySlug.has(slug)) return;
    const hidden = getHidden();
    if (hidden.indexOf(slug) === -1) hidden.push(slug);
    setHidden(hidden);
    render();
    toast("Скрыто. Больше не предложим эту историю.");
  }

  function restore() {
    setHidden([]);
    render();
    toast("Скрытые рекомендации вернулись.");
  }

  function bind() {
    const list = document.getElementById("rec-list");
    if (list) {
      list.addEventListener("click", function (event) {
        const button = event.target.closest("[data-rec-hide]");
        if (!button) return;
        hide(button.getAttribute("data-rec-hide"));
      });
    }

    document.querySelectorAll("[data-rec-undo], #rec-undo").forEach(function (button) {
      button.addEventListener("click", restore);
    });

    window.addEventListener("storage", function (event) {
      if (event.key === HIDDEN_KEY || event.key === PROGRESS_KEY || event.key === TASTE_KEY ||
          (libraryApi && event.key === libraryApi.STORAGE_KEY) ||
          (ratingsApi && event.key === ratingsApi.STORAGE_KEY) ||
          (notesApi && event.key === notesApi.STORAGE_KEY)) {
        render();
      }
    });

    window.addEventListener("kuroha:library-change", render);
    window.addEventListener("kuroha:ratings-change", render);
    window.addEventListener("kuroha:notes-change", render);
    window.addEventListener("kuroha:taste-change", render);
  }

  function init() {
    if (!document.getElementById("rec-list")) return;
    if (notesApi && typeof notesApi.ensureSeed === "function") notesApi.ensureSeed();
    if (libraryApi && typeof libraryApi.migrate === "function") libraryApi.migrate();
    bind();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

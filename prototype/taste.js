/* Kuroha prototype - quiet taste setup.
   Stores the reader's favourite genres, formats and yearly goal locally. */
(function () {
  "use strict";

  const STORAGE_KEY = "kuroha-taste";
  const GOAL_KEY = "kuroha-reading-goal";
  const MAX_GENRES = 5;
  const MAX_TYPES = 2;
  const GENRE_ORDER = [
    "fantasy", "mystery", "drama", "romance", "action", "slice",
    "adventure", "thriller", "history", "scifi", "horror", "comedy"
  ];
  const TYPE_ORDER = ["manga", "manhwa", "manhua", "novel"];
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
  const TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новеллы"
  };
  const GOALS = [100, 250, 500, 1000];
  const DEFAULT_TASTE = { genres: [], types: [], goal: 500, pace: "evening" };

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

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // A full local storage should not break the page.
    }
  }

  function cleanList(value, allowed) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (item, index) {
      return allowed.indexOf(item) !== -1 && value.indexOf(item) === index;
    });
  }

  function goalFromStorage() {
    const raw = readJSON(GOAL_KEY, null);
    const target = raw && Number(raw.target);
    return Number.isFinite(target) && target >= 50 ? Math.round(target) : DEFAULT_TASTE.goal;
  }

  function read() {
    const raw = readJSON(STORAGE_KEY, null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {
        genres: DEFAULT_TASTE.genres.slice(),
        types: DEFAULT_TASTE.types.slice(),
        goal: goalFromStorage(),
        pace: DEFAULT_TASTE.pace
      };
    }
    const goal = Number(raw.goal);
    return {
      genres: cleanList(raw.genres, GENRE_ORDER).slice(0, MAX_GENRES),
      types: cleanList(raw.types, TYPE_ORDER).slice(0, MAX_TYPES),
      goal: Number.isFinite(goal) && goal >= 50 && goal <= 5000 ? Math.round(goal) : goalFromStorage(),
      pace: typeof raw.pace === "string" ? raw.pace : DEFAULT_TASTE.pace
    };
  }

  function save(value) {
    const next = {
      genres: cleanList(value && value.genres, GENRE_ORDER).slice(0, MAX_GENRES),
      types: cleanList(value && value.types, TYPE_ORDER).slice(0, MAX_TYPES),
      goal: Math.max(50, Math.min(5000, Math.round(Number(value && value.goal) || 500))),
      pace: "evening"
    };
    writeJSON(STORAGE_KEY, next);
    writeJSON(GOAL_KEY, { target: next.goal, year: new Date().getFullYear() });
    emit(next);
    return next;
  }

  function clear() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    emit(null);
  }

  function emit(value) {
    window.dispatchEvent(new CustomEvent("kuroha:taste-change", { detail: value }));
  }

  function hasTaste() {
    const taste = read();
    return taste.genres.length > 0 || taste.types.length > 0;
  }

  const api = {
    KEY: STORAGE_KEY,
    GOAL_KEY: GOAL_KEY,
    MAX_GENRES: MAX_GENRES,
    MAX_TYPES: MAX_TYPES,
    GENRE_ORDER: GENRE_ORDER,
    TYPE_ORDER: TYPE_ORDER,
    GENRE_LABELS: GENRE_LABELS,
    TYPE_LABELS: TYPE_LABELS,
    GOALS: GOALS,
    read: read,
    save: save,
    clear: clear,
    hasTaste: hasTaste
  };
  window.KurohaTaste = api;

  if (document.body && document.body.dataset.page !== "taste") return;

  let selectedGenres = [];
  let selectedTypes = [];
  let selectedGoal = 500;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function plural(number, forms) {
    const abs = Math.abs(number) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function toast(message) {
    if (typeof window.KurohaToast === "function") window.KurohaToast(message);
  }

  function genreName(value) {
    return GENRE_LABELS[value] || value;
  }

  function typeName(value) {
    return TYPE_LABELS[value] || value;
  }

  function renderGenreChips() {
    const root = $("#taste-genres");
    if (!root) return;
    root.innerHTML = GENRE_ORDER.map(function (genre) {
      return '<button class="taste-chip" type="button" data-taste-genre="' + genre +
        '" aria-pressed="' + (selectedGenres.indexOf(genre) !== -1 ? "true" : "false") +
        '">' + genreName(genre) + "</button>";
    }).join("");
  }

  function renderTypeChips() {
    const root = $("#taste-types");
    if (!root) return;
    root.innerHTML = TYPE_ORDER.map(function (type) {
      return '<button class="taste-chip taste-chip--type" type="button" data-taste-type="' + type +
        '" aria-pressed="' + (selectedTypes.indexOf(type) !== -1 ? "true" : "false") +
        '">' + typeName(type) + "</button>";
    }).join("");
  }

  function renderGoals() {
    const root = $("#taste-goals");
    if (!root) return;
    root.innerHTML = GOALS.map(function (goal) {
      const active = goal === selectedGoal;
      return '<button class="taste-goal' + (active ? " is-selected" : "") +
        '" type="button" data-taste-goal="' + goal + '" aria-pressed="' + active + '">' +
        "<b>" + goal + "</b><span>глав в год</span></button>";
    }).join("");
  }

  function renderPreview() {
    const count = $("#taste-count");
    const hint = $("#taste-hint");
    const lead = $("#taste-preview-lead");
    const chips = $("#taste-preview-chips");
    const note = $("#taste-preview-note");
    const stamp = $("#taste-stamp");

    if (count) count.textContent = selectedGenres.length + " из " + MAX_GENRES + " жанров";
    if (stamp) stamp.textContent = String(selectedGenres.length);

    if (hint) {
      if (selectedGenres.length < 3) {
        const left = 3 - selectedGenres.length;
        hint.textContent = "Выбери ещё " + left + " " + plural(left, ["жанр", "жанра", "жанров"]) + " — Kuroha поймёт, с чего начать.";
      } else {
        hint.textContent = "Хорошо. Теперь можно выбрать формат и цель.";
      }
    }

    if (lead) {
      if (selectedGenres.length === 0 && selectedTypes.length === 0) {
        lead.innerHTML = "Пока пусто. Отметь жанры, которые хочется читать этой ночью.";
      } else {
        const genrePart = selectedGenres.slice(0, 3).map(genreName).join(", ");
        lead.innerHTML = "Твой вечер: " + (genrePart || "любой жанр") +
          (selectedTypes.length ? " · " + selectedTypes.map(typeName).join(", ") : "") +
          ".<br><b>" + selectedGoal + "</b> глав в год.";
      }
    }

    if (chips) {
      chips.innerHTML = selectedGenres.map(function (genre) {
        return '<span class="taste-preview__chip">' + genreName(genre) + "</span>";
      }).join("");
    }

    if (note) {
      note.textContent = "Можно изменить в любой момент. Вкус влияет на рекомендации и «Мой вечер».";
    }
  }

  function render() {
    const taste = read();
    selectedGenres = taste.genres.slice();
    selectedTypes = taste.types.slice();
    selectedGoal = taste.goal;
    renderGenreChips();
    renderTypeChips();
    renderGoals();
    renderPreview();
    const saveButton = $("#taste-save");
    if (saveButton) saveButton.textContent = hasTaste() ? "Обновить мой вечер" : "Собрать мой вечер";
  }

  function toggleGenre(value) {
    const index = selectedGenres.indexOf(value);
    if (index !== -1) {
      selectedGenres.splice(index, 1);
    } else {
      if (selectedGenres.length >= MAX_GENRES) {
        toast("Можно выбрать до пяти жанров.");
        return;
      }
      selectedGenres.push(value);
    }
    renderGenreChips();
    renderPreview();
  }

  function toggleType(value) {
    const index = selectedTypes.indexOf(value);
    if (index !== -1) {
      selectedTypes.splice(index, 1);
    } else {
      if (selectedTypes.length >= MAX_TYPES) {
        toast("Можно выбрать до двух форматов.");
        return;
      }
      selectedTypes.push(value);
    }
    renderTypeChips();
    renderPreview();
  }

  function setGoal(value) {
    selectedGoal = Number(value) || 500;
    renderGoals();
    renderPreview();
  }

  function submit(event) {
    event.preventDefault();
    if (selectedGenres.length < 3) {
      toast("Выбери хотя бы три жанра — так вкус будет точнее.");
      const first = $(".taste-chip");
      if (first) first.focus();
      return;
    }
    save({ genres: selectedGenres, types: selectedTypes, goal: selectedGoal, pace: "evening" });
    toast("Твой вкус сохранён. Собираем вечер.");
    window.setTimeout(function () {
      window.location.href = "evening.html?taste=1";
    }, 320);
  }

  function reset() {
    clear();
    selectedGenres = [];
    selectedTypes = [];
    selectedGoal = 500;
    render();
    toast("Настройки вкуса сброшены.");
  }

  function bind() {
    const form = $("#taste-form-el");
    if (!form) return;

    $("#taste-genres").addEventListener("click", function (event) {
      const chip = event.target.closest("[data-taste-genre]");
      if (!chip) return;
      toggleGenre(chip.getAttribute("data-taste-genre"));
    });

    $("#taste-types").addEventListener("click", function (event) {
      const chip = event.target.closest("[data-taste-type]");
      if (!chip) return;
      toggleType(chip.getAttribute("data-taste-type"));
    });

    $("#taste-goals").addEventListener("click", function (event) {
      const goal = event.target.closest("[data-taste-goal]");
      if (!goal) return;
      setGoal(goal.getAttribute("data-taste-goal"));
    });

    form.addEventListener("submit", submit);

    document.querySelectorAll("[data-taste-reset]").forEach(function (button) {
      button.addEventListener("click", reset);
    });

    window.addEventListener("storage", function (event) {
      if (event.key === STORAGE_KEY || event.key === GOAL_KEY) render();
    });
  }

  function init() {
    if (!document.getElementById("taste-genres")) return;
    bind();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

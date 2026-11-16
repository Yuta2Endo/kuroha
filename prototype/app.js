/* Kuroha prototype — interactions.
   Plain script: no modules, so the pages also work from file://. */
(function () {
  "use strict";

  var TITLES = Array.isArray(window.KUROHA_TITLES) ? window.KUROHA_TITLES : [];

  var TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };

  var STATUS_LABELS = {
    ongoing: "онгоинг",
    completed: "завершён",
    frozen: "заморожен"
  };

  var GENRE_LABELS = {
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

  var THEMES = ["night", "paper", "graphite"];
  var THEME_NAMES = {
    night: "ночь",
    paper: "бумага",
    graphite: "графит"
  };
  var THEME_COLORS = {
    night: "#17171b",
    paper: "#f5f3f0",
    graphite: "#202024"
  };

  var PAGE_SIZE = 12;

  var root = document.documentElement;

  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  function $$(selector, context) {
    return Array.prototype.slice.call((context || document).querySelectorAll(selector));
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function plural(number, forms) {
    var absolute = Math.abs(number) % 100;
    var last = absolute % 10;

    if (absolute > 10 && absolute < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function formatRating(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  /* -----------------------------------------------------------------------
     Theme
     ----------------------------------------------------------------------- */
  var storedTheme = null;

  try {
    storedTheme = window.localStorage.getItem("kuroha-theme");
  } catch (error) {
    storedTheme = null;
  }

  var requestedTheme = null;
  try {
    requestedTheme = new URLSearchParams(window.location.search).get("theme");
  } catch (error) {
    requestedTheme = null;
  }

  var currentTheme = requestedTheme && THEMES.indexOf(requestedTheme) !== -1
    ? requestedTheme
    : (THEMES.indexOf(storedTheme) !== -1 ? storedTheme : "night");

  function applyTheme(nextTheme) {
    currentTheme = nextTheme;
    root.dataset.theme = nextTheme;

    try {
      window.localStorage.setItem("kuroha-theme", nextTheme);
    } catch (error) {
      /* localStorage can be unavailable in private mode. */
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[nextTheme]);

    $$("[data-theme-toggle]").forEach(function (button) {
      button.setAttribute("aria-label", "Тема: " + THEME_NAMES[nextTheme] + ". Сменить тему");
      button.setAttribute("title", "Тема: " + THEME_NAMES[nextTheme]);
    });

    $$("[data-theme-label]").forEach(function (label) {
      label.textContent = THEME_NAMES[nextTheme];
    });
  }

  applyTheme(currentTheme);

  $$("[data-theme-toggle]").forEach(function (button) {
    button.addEventListener("click", function () {
      var next = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
      applyTheme(next);
    });
  });

  /* -----------------------------------------------------------------------
     Mobile menu
     ----------------------------------------------------------------------- */
  var menuButton = $("[data-menu-toggle]");
  var mobileMenu = $("#mobile-menu");

  function closeMobileMenu() {
    if (!menuButton || !mobileMenu) return;
    mobileMenu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  }

  if (menuButton && mobileMenu) {
    menuButton.addEventListener("click", function () {
      var willOpen = mobileMenu.hidden;
      mobileMenu.hidden = !willOpen;
      menuButton.setAttribute("aria-expanded", String(willOpen));
    });

    mobileMenu.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMobileMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) closeMobileMenu();
    });
  }

  /* -----------------------------------------------------------------------
     Search dialog
     ----------------------------------------------------------------------- */
  var searchDialog = $("#search-dialog");
  var searchForm = $("#search-form");
  var searchField = null;
  var searchResults = null;
  var searchResultLinks = [];
  var searchActiveIndex = -1;
  var SEARCH_DATA = window.KUROHA_SEARCH_DATA || {
    readers: [],
    lists: [],
    quotes: [],
    clubs: [],
    teams: []
  };

  function searchNormalize(value) {
    return String(value || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  }

  function searchRank(item, query) {
    var title = searchNormalize(item.title);
    var author = searchNormalize(item.author);
    var lines = searchNormalize((item.lines || []).join(" "));
    var genres = searchNormalize((item.genres || []).map(function (genre) {
      return GENRE_LABELS[genre] || genre;
    }).join(" "));

    if (title.indexOf(query) === 0) return 0;
    if (title.indexOf(query) !== -1) return 1;
    if (author.indexOf(query) !== -1) return 2;
    if (genres.indexOf(query) !== -1) return 3;
    if (lines.indexOf(query) !== -1) return 4;
    return -1;
  }

  function searchItems(query, limit) {
    var normalized = searchNormalize(query);
    var max = limit || 6;

    if (!normalized) {
      return TITLES.slice().sort(function (a, b) {
        return b.popularity - a.popularity || b.rating - a.rating;
      }).slice(0, max);
    }

    return TITLES.map(function (item) {
      return { item: item, rank: searchRank(item, normalized) };
    }).filter(function (entry) {
      return entry.rank !== -1;
    }).sort(function (a, b) {
      return a.rank - b.rank || b.item.popularity - a.item.popularity;
    }).slice(0, max).map(function (entry) {
      return entry.item;
    });
  }

  function entityScore(text, query) {
    var normalized = searchNormalize(text);
    if (!normalized) return -1;
    if (normalized.indexOf(query) === 0) return 0;
    if (normalized.indexOf(query) !== -1) return 1;
    return -1;
  }

  function entityResultHTML(kind, item, index) {
    var title = "";
    var meta = "";
    var icon = "";
    var href = "";

    if (kind === "reader") {
      title = item.name;
      meta = "Читатель · @" + item.handle + " · " + item.role;
      icon = "Ч";
      href = "readers.html?reader=" + encodeURIComponent(item.slug);
    } else if (kind === "list") {
      title = item.title;
      meta = "Список · " + item.count + " историй · " + item.readerName;
      icon = "С";
      href = "public-lists.html?list=" + encodeURIComponent(item.slug);
    } else if (kind === "quote") {
      title = "«" + String(item.text || "").slice(0, 58) + "…»";
      meta = "Цитата · " + item.title + " · глава " + item.chapter + " · " + item.readerName;
      icon = "Ц";
      href = "quotes.html";
    } else if (kind === "club") {
      title = item.name;
      meta = "Клуб · " + item.book;
      icon = "К";
      href = "clubs.html?club=" + encodeURIComponent(item.slug);
    } else {
      title = item.name;
      meta = "Команда · " + item.count + " историй";
      icon = "Т";
      href = "teams.html?team=" + encodeURIComponent(item.slug);
    }

    return [
      '<a class="search-result search-result--entity" id="search-result-' + index + '" role="option" aria-selected="false"',
      ' href="' + href + '">',
      '<span class="search-result__icon" aria-hidden="true">' + icon + "</span>",
      '<span class="search-result__body">',
      '<span class="search-result__title">' + escapeHTML(title) + "</span>",
      '<span class="search-result__meta">' + escapeHTML(meta) + "</span>",
      "</span>",
      "</a>"
    ].join("");
  }

  function searchEntityGroups(query) {
    var normalized = searchNormalize(query);
    if (!normalized) return [];

    function group(kind, label, entries, textFor) {
      var found = entries.map(function (item) {
        return { item: item, rank: entityScore(textFor(item), normalized) };
      }).filter(function (entry) {
        return entry.rank !== -1;
      }).sort(function (a, b) {
        return a.rank - b.rank;
      }).slice(0, 2);
      return found.length ? { kind: kind, label: label, items: found.map(function (entry) { return entry.item; }) } : null;
    }

    return [
      group("reader", "Читатели", SEARCH_DATA.readers, function (item) {
        return [item.name, item.handle, item.role, item.note].join(" ");
      }),
      group("list", "Списки", SEARCH_DATA.lists, function (item) {
        return [item.title, item.note, item.readerName].join(" ");
      }),
      group("quote", "Цитаты", SEARCH_DATA.quotes, function (item) {
        return [item.text, item.title, item.readerName].join(" ");
      }),
      group("club", "Клубы", SEARCH_DATA.clubs, function (item) {
        return [item.name, item.book, item.note].join(" ");
      }),
      group("team", "Команды", SEARCH_DATA.teams, function (item) {
        return [item.name, item.motto].join(" ");
      })
    ].filter(Boolean);
  }

  function searchResultHTML(item, index) {
    var chapters = item.chapters + " " + plural(item.chapters, ["глава", "главы", "глав"]);

    return [
      '<a class="search-result" id="search-result-' + index + '" role="option" aria-selected="false"',
      ' href="title.html?slug=' + encodeURIComponent(item.slug) + '">',
      '<span class="search-result__cover" aria-hidden="true">' + coverHTML(item) + "</span>",
      '<span class="search-result__body">',
      '<span class="search-result__title">' + escapeHTML(item.title) + "</span>",
      '<span class="search-result__meta">' + TYPE_LABELS[item.type] + " · " + item.year + " · " + chapters + " · ★ " + formatRating(item.rating) + "</span>",
      "</span>",
      "</a>"
    ].join("");
  }

  function setSearchActive(index) {
    searchActiveIndex = index;

    searchResultLinks.forEach(function (link, linkIndex) {
      var active = linkIndex === index;
      link.classList.toggle("is-active", active);
      link.setAttribute("aria-selected", active ? "true" : "false");
    });

    if (!searchField) return;

    if (index >= 0 && searchResultLinks[index]) {
      searchField.setAttribute("aria-activedescendant", searchResultLinks[index].id);
      searchResultLinks[index].scrollIntoView({ block: "nearest" });
    } else {
      searchField.removeAttribute("aria-activedescendant");
    }
  }

  function renderSearchResults(value) {
    if (!searchResults) return;

    var query = String(value || "").trim();
    var normalized = searchNormalize(query);
    var titles = searchItems(query, query ? 4 : 6);
    var groups = normalized ? searchEntityGroups(query) : [];
    var total = titles.length + groups.reduce(function (sum, group) { return sum + group.items.length; }, 0);
    var label = query ? "Совпадения" : "Сейчас читают";
    var body = "";
    var resultIndex = 0;

    if (total) {
      body = '<div class="search-results__list" id="search-results-list" role="listbox" aria-label="Результаты поиска">';

      if (titles.length) {
        body += '<div class="search-group"><p class="search-group__label"><span>Тайтлы</span><span>' + titles.length + "</span></p>" +
          titles.map(function (item) { return searchResultHTML(item, resultIndex++); }).join("") + "</div>";
      }

      groups.forEach(function (group) {
        body += '<div class="search-group"><p class="search-group__label"><span>' + group.label + "</span><span>" + group.items.length + "</span></p>" +
          group.items.map(function (item) { return entityResultHTML(group.kind, item, resultIndex++); }).join("") + "</div>";
      });

      body += "</div>";
    } else {
      body = '<div class="search-results__empty"><p>Ничего не нашлось.</p><span>Попробуй название, автора, читателя или цитату.</span></div>';
    }

    searchResults.innerHTML = '<div class="search-results__head"><span class="search-results__label">' +
      label + '</span><span class="search-results__count">' + total + "</span></div>" + body;

    searchResultLinks = $$(".search-result", searchResults);
    setSearchActive(total ? 0 : -1);
  }

  function searchGoCatalog(query) {
    window.location.href = query
      ? "catalog.html?q=" + encodeURIComponent(query)
      : "catalog.html";
  }

  if (searchDialog) {
    searchForm = searchForm || $("form", searchDialog);
    searchField = $("input", searchDialog);
    searchResults = document.createElement("div");
    searchResults.className = "search-results";
    searchResults.id = "search-results";
    searchResults.setAttribute("aria-live", "polite");

    if (searchForm) {
      var searchFoot = $(".search-dialog__foot", searchForm);
      if (searchFoot) searchForm.insertBefore(searchResults, searchFoot);
      else searchForm.appendChild(searchResults);
    }

    if (searchField) {
      searchField.setAttribute("placeholder", "Название, автор, жанр");
      searchField.setAttribute("aria-autocomplete", "list");
      searchField.setAttribute("aria-controls", "search-results-list");
    }

    var searchHint = $(".search-dialog__hint", searchDialog);
    if (searchHint) searchHint.textContent = "стрелки — выбрать · Enter — открыть · Esc — закрыть";

    var searchAllButton = $(".search-dialog__foot .btn", searchDialog);
    if (searchAllButton) {
      searchAllButton.type = "button";
      searchAllButton.textContent = "В каталог";
      searchAllButton.setAttribute("data-search-all", "");
      searchAllButton.addEventListener("click", function () {
        searchGoCatalog(searchField ? searchField.value.trim() : "");
      });
    }

    function openSearch() {
      closeMobileMenu();

      var wasOpen = searchDialog.open;

      if (typeof searchDialog.showModal === "function") {
        if (!searchDialog.open) searchDialog.showModal();
      } else {
        searchDialog.setAttribute("open", "");
      }

      if (searchField) {
        if (!wasOpen) {
          searchField.value = "";
          renderSearchResults("");
        }

        window.requestAnimationFrame(function () {
          searchField.focus();
          if (wasOpen) searchField.select();
        });
      }
    }

    $$("[data-search-open]").forEach(function (button) {
      button.setAttribute("title", "Поиск (Ctrl+K)");
      button.setAttribute("aria-keyshortcuts", "Control+K");
      button.addEventListener("click", openSearch);
    });

    $$("[data-search-close]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (typeof searchDialog.close === "function") searchDialog.close();
        else searchDialog.removeAttribute("open");
      });
    });

    searchDialog.addEventListener("click", function (event) {
      if (event.target === searchDialog) {
        if (typeof searchDialog.close === "function") searchDialog.close();
        else searchDialog.removeAttribute("open");
      }
    });

    if (searchField) {
      searchField.addEventListener("input", function () {
        renderSearchResults(searchField.value);
      });

      searchField.addEventListener("keydown", function (event) {
        if (!searchResultLinks.length) return;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSearchActive(searchActiveIndex < searchResultLinks.length - 1 ? searchActiveIndex + 1 : 0);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setSearchActive(searchActiveIndex > 0 ? searchActiveIndex - 1 : searchResultLinks.length - 1);
        }
      });
    }

    if (searchResults) {
      searchResults.addEventListener("mouseover", function (event) {
        var link = event.target.closest(".search-result");
        if (!link) return;
        var index = searchResultLinks.indexOf(link);
        if (index !== -1) setSearchActive(index);
      });

      searchResults.addEventListener("focusin", function (event) {
        var link = event.target.closest(".search-result");
        if (!link) return;
        var index = searchResultLinks.indexOf(link);
        if (index !== -1) setSearchActive(index);
      });
    }

    if (searchForm) {
      searchForm.addEventListener("submit", function (event) {
        event.preventDefault();

        var query = searchField ? searchField.value.trim() : "";
        var active = searchActiveIndex >= 0 ? searchResultLinks[searchActiveIndex] : null;

        if (active) {
          window.location.href = active.href;
          return;
        }

        if (query) {
          searchGoCatalog(query);
        } else if (searchField) {
          searchField.focus();
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key || "").toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    });
  }

  /* -----------------------------------------------------------------------
     Toast
     ----------------------------------------------------------------------- */
  var toast = $("#toast");
  var toastTimer = null;
  var toastHideTimer = null;

  function showToast(message) {
    if (!toast) return;

    window.clearTimeout(toastTimer);
    window.clearTimeout(toastHideTimer);

    toast.textContent = message;
    toast.hidden = false;

    window.requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });

    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
      toastHideTimer = window.setTimeout(function () {
        toast.hidden = true;
      }, 180);
    }, 3400);
  }

  window.KurohaToast = showToast;

  document.addEventListener("click", function (event) {
    var link = event.target.closest("[data-demo-link]");
    if (!link) return;

    event.preventDefault();

    var title = link.getAttribute("data-title");
    var message = link.getAttribute("data-demo-message");

    if (!message) {
      message = title
        ? "«" + title + "» — страница тайтла появится в следующем прототипе."
        : "Этот раздел появится в следующем прототипе.";
    }

    showToast(message);
  });

  $$("[data-random-title]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();

      if (!TITLES.length) return;

      var item = TITLES[Math.floor(Math.random() * TITLES.length)];
      window.location.href = "title.html?slug=" + encodeURIComponent(item.slug);
    });
  });

  /* -----------------------------------------------------------------------
     Cover and card templates
     ----------------------------------------------------------------------- */
  function coverHTML(item, extraClass) {
    var lines = item.lines || [item.title, ""];
    var classes = ["cover"];

    if (extraClass) classes.push(extraClass);
    if (item.align) classes.push("cover--" + item.align);

    return [
      '<div class="' + classes.join(" ") + '" data-art="' + escapeHTML(item.art) + '"',
      ' style="--c1:' + escapeHTML(item.c1) + ";--c2:" + escapeHTML(item.c2) + ";--c-accent:" + escapeHTML(item.accent) + '">',
      '<span class="cover__type">' + TYPE_LABELS[item.type] + "</span>",
      '<span class="cover__title">' + escapeHTML(lines[0]) + (lines[1] ? "<br>" + escapeHTML(lines[1]) : "") + "</span>",
      '<span class="cover__author">' + escapeHTML(item.author) + "</span>",
      "</div>"
    ].join("");
  }

  function miniCoverHTML(item) {
    var lines = item.lines || [item.title, ""];
    var classes = ["cover", "cover--mini"];

    if (item.align) classes.push("cover--" + item.align);

    return [
      '<div class="' + classes.join(" ") + '" data-art="' + escapeHTML(item.art) + '"',
      ' style="--c1:' + escapeHTML(item.c1) + ";--c2:" + escapeHTML(item.c2) + ";--c-accent:" + escapeHTML(item.accent) + '">',
      '<span class="cover__title">' + escapeHTML(lines[0]) + (lines[1] ? "<br>" + escapeHTML(lines[1]) : "") + "</span>",
      "</div>"
    ].join("");
  }

  function cardHTML(item) {
    var chaptersLabel = item.chapters + " " + plural(item.chapters, ["глава", "главы", "глав"]);

    return [
      '<article class="book-card">',
      '<a class="book-card__link" href="title.html?slug=' + encodeURIComponent(item.slug) + '"',
      ' aria-label="' + escapeHTML(item.title) + ' — открыть страницу тайтла">',
      coverHTML(item),
      '<div class="book-card__body">',
      '<div class="book-card__top">',
      '<h3 class="book-card__title">' + escapeHTML(item.title) + "</h3>",
      '<span class="rating" aria-label="Рейтинг ' + formatRating(item.rating) + '">★ ' + formatRating(item.rating) + "</span>",
      "</div>",
      '<p class="book-card__meta">' + TYPE_LABELS[item.type] + " · " + chaptersLabel + (item.adult ? " · 18+" : "") + "</p>",
      '<div class="book-card__foot">',
      '<span class="status status--' + item.status + '">' + STATUS_LABELS[item.status] + "</span>",
      '<span class="book-card__year">' + item.year + "</span>",
      "</div>",
      item.isNew ? '<span class="book-card__new">новая глава</span>' : "",
      "</div>",
      "</a>",
      "</article>"
    ].join("");
  }

  window.KurohaCards = {
    cardHTML: cardHTML,
    coverHTML: coverHTML,
    miniCoverHTML: miniCoverHTML
  };

  /* -----------------------------------------------------------------------
     Homepage
     ----------------------------------------------------------------------- */
  function renderHome() {
    var grid = $("#new-grid");
    if (!grid) return;

    var items = TITLES.slice()
      .sort(function (a, b) {
        return b.updated.localeCompare(a.updated);
      })
      .slice(0, 6);

    grid.innerHTML = items.map(cardHTML).join("");
  }

  renderHome();

  /* -----------------------------------------------------------------------
     Catalogue
     ----------------------------------------------------------------------- */
  var catalogGrid = $("#catalog-grid");

  if (catalogGrid) {
    var searchInput = $("#catalog-search");
    var clearSearchButton = $("[data-search-clear]");
    var yearSelect = $("#year");
    var sortSelect = $("#sort");
    var resultCount = $("#result-count");
    var emptyState = $("#empty");
    var pagination = $("#pagination");
    var filters = $("#filters");
    var filtersToggle = $("[data-filters-toggle]");
    var resultsHint = $(".results-hint");

    var state = {
      q: "",
      types: new Set(),
      statuses: new Set(),
      genres: new Set(),
      year: "",
      sort: "popular",
      page: 1
    };

    var validSorts = ["popular", "new", "title", "rating"];
    var sortLabels = {
      popular: "по популярности",
      new: "сначала новые",
      title: "по алфавиту",
      rating: "по рейтингу"
    };
    var params = new URLSearchParams(window.location.search);

    function addValues(set, rawValue) {
      if (!rawValue) return;

      rawValue.split(",").forEach(function (value) {
        var trimmed = value.trim();
        if (trimmed) set.add(trimmed);
      });
    }

    state.q = (params.get("q") || "").trim();
    addValues(state.types, params.get("type"));
    addValues(state.statuses, params.get("status"));
    addValues(state.genres, params.get("genre"));

    if (params.get("year")) state.year = params.get("year");
    if (validSorts.indexOf(params.get("sort")) !== -1) state.sort = params.get("sort");

    Array.from(state.types).forEach(function (value) {
      if (!TYPE_LABELS[value]) state.types.delete(value);
    });
    Array.from(state.statuses).forEach(function (value) {
      if (!STATUS_LABELS[value]) state.statuses.delete(value);
    });
    Array.from(state.genres).forEach(function (value) {
      if (!GENRE_LABELS[value]) state.genres.delete(value);
    });

    function updateSearchClear() {
      if (clearSearchButton && searchInput) {
        clearSearchButton.hidden = searchInput.value.length === 0;
      }
    }

    function syncControls() {
      if (searchInput) searchInput.value = state.q;
      if (yearSelect) yearSelect.value = state.year;
      if (sortSelect) sortSelect.value = state.sort;

      $$('[data-filter="type"]').forEach(function (input) {
        input.checked = state.types.has(input.value);
      });
      $$('[data-filter="status"]').forEach(function (input) {
        input.checked = state.statuses.has(input.value);
      });
      $$('[data-filter="genre"]').forEach(function (input) {
        input.checked = state.genres.has(input.value);
      });

      updateSearchClear();
    }

    function filteredItems() {
      var query = searchNormalize(state.q);

      return TITLES.filter(function (item) {
        if (query) {
          var genreWords = (item.genres || []).map(function (genre) {
            return GENRE_LABELS[genre] || genre;
          }).join(" ");
          var haystack = searchNormalize(item.title + " " + item.author + " " + genreWords);
          if (haystack.indexOf(query) === -1) return false;
        }

        if (state.types.size && !state.types.has(item.type)) return false;
        if (state.statuses.size && !state.statuses.has(item.status)) return false;

        if (state.genres.size) {
          var hasGenre = item.genres.some(function (genre) {
            return state.genres.has(genre);
          });
          if (!hasGenre) return false;
        }

        if (state.year && String(item.year) !== state.year) return false;

        return true;
      });
    }

    function sortedItems(items) {
      var copy = items.slice();

      if (state.sort === "new") {
        copy.sort(function (a, b) {
          return b.updated.localeCompare(a.updated);
        });
      } else if (state.sort === "title") {
        copy.sort(function (a, b) {
          return a.title.localeCompare(b.title, "ru");
        });
      } else if (state.sort === "rating") {
        copy.sort(function (a, b) {
          return b.rating - a.rating;
        });
      } else {
        copy.sort(function (a, b) {
          return b.popularity - a.popularity;
        });
      }

      return copy;
    }

    function updateURL() {
      var urlParams = new URLSearchParams();

      if (state.q) urlParams.set("q", state.q);
      if (state.types.size) urlParams.set("type", Array.from(state.types).join(","));
      if (state.statuses.size) urlParams.set("status", Array.from(state.statuses).join(","));
      if (state.genres.size) urlParams.set("genre", Array.from(state.genres).join(","));
      if (state.year) urlParams.set("year", state.year);
      if (state.sort !== "popular") urlParams.set("sort", state.sort);

      var query = urlParams.toString();
      var nextURL = window.location.pathname + (query ? "?" + query : "") + window.location.hash;

      try {
        window.history.replaceState(null, "", nextURL);
      } catch (error) {
        /* file:// and some embedded contexts can refuse history changes. */
      }
    }

    function renderPagination(totalPages) {
      if (!pagination) return;

      if (totalPages <= 1) {
        pagination.innerHTML = "";
        pagination.hidden = true;
        return;
      }

      pagination.hidden = false;

      var buttons = [];

      buttons.push(
        '<button class="page-btn" type="button" data-page="' + (state.page - 1) + '"' +
        (state.page === 1 ? " disabled" : "") +
        ' aria-label="Предыдущая страница">←</button>'
      );

      for (var page = 1; page <= totalPages; page += 1) {
        buttons.push(
          '<button class="page-btn' + (page === state.page ? " is-active" : "") + '" type="button" data-page="' + page + '"' +
          (page === state.page ? ' aria-current="page"' : "") +
          ">" + page + "</button>"
        );
      }

      buttons.push(
        '<button class="page-btn" type="button" data-page="' + (state.page + 1) + '"' +
        (state.page === totalPages ? " disabled" : "") +
        ' aria-label="Следующая страница">→</button>'
      );

      pagination.innerHTML = buttons.join("");

      $$("[data-page]", pagination).forEach(function (button) {
        button.addEventListener("click", function () {
          var nextPage = Number(button.getAttribute("data-page"));

          if (!nextPage || nextPage === state.page || nextPage < 1 || nextPage > totalPages) return;

          state.page = nextPage;
          render();

          var results = $(".catalog-results");
          if (results) {
            var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            results.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
          }
        });
      });
    }

    function render() {
      var allItems = sortedItems(filteredItems());
      var totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));

      state.page = Math.min(Math.max(1, state.page), totalPages);

      var start = (state.page - 1) * PAGE_SIZE;
      var pageItems = allItems.slice(start, start + PAGE_SIZE);

      catalogGrid.innerHTML = pageItems.map(cardHTML).join("");
      catalogGrid.hidden = allItems.length === 0;

      if (emptyState) emptyState.hidden = allItems.length !== 0;

      if (resultCount) {
        resultCount.innerHTML = "<b>" + allItems.length + "</b> " + plural(allItems.length, ["тайтл", "тайтла", "тайтлов"]);
      }

      if (resultsHint) resultsHint.textContent = sortLabels[state.sort];

      renderPagination(totalPages);
    }

    function resetFilters() {
      state.q = "";
      state.types.clear();
      state.statuses.clear();
      state.genres.clear();
      state.year = "";
      state.sort = "popular";
      state.page = 1;

      syncControls();
      render();
      updateURL();
    }

    if (searchInput) {
      var searchTimer = null;

      searchInput.addEventListener("input", function () {
        window.clearTimeout(searchTimer);
        updateSearchClear();

        searchTimer = window.setTimeout(function () {
          state.q = searchInput.value.trim();
          state.page = 1;
          render();
          updateURL();
        }, 160);
      });
    }

    if (clearSearchButton) {
      clearSearchButton.addEventListener("click", function () {
        if (!searchInput) return;

        searchInput.value = "";
        state.q = "";
        state.page = 1;
        updateSearchClear();
        render();
        updateURL();
        searchInput.focus();
      });
    }

    $$("[data-filter]").forEach(function (input) {
      input.addEventListener("change", function () {
        var filter = input.getAttribute("data-filter");
        var set = filter === "type" ? state.types : filter === "status" ? state.statuses : state.genres;

        if (input.checked) set.add(input.value);
        else set.delete(input.value);

        state.page = 1;
        render();
        updateURL();
      });
    });

    if (yearSelect) {
      yearSelect.addEventListener("change", function () {
        state.year = yearSelect.value;
        state.page = 1;
        render();
        updateURL();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        state.sort = sortSelect.value;
        state.page = 1;
        render();
        updateURL();
      });
    }

    $$("[data-reset]").forEach(function (button) {
      button.addEventListener("click", resetFilters);
    });

    if (filtersToggle && filters) {
      filtersToggle.addEventListener("click", function () {
        var isOpen = filters.classList.toggle("is-open");
        filtersToggle.setAttribute("aria-expanded", String(isOpen));
      });
    }

    function openFilters() {
      if (!filters || window.innerWidth > 980) return;
      filters.classList.add("is-open");
      if (filtersToggle) filtersToggle.setAttribute("aria-expanded", "true");
    }

    if (window.location.hash === "#filters") openFilters();
    $$('a[href="#filters"]').forEach(function (link) {
      link.addEventListener("click", openFilters);
    });

    syncControls();
    render();
  }
})();

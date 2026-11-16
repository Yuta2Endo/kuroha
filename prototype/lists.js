/* Kuroha lists — personal collections, local-only. */
(function () {
  "use strict";

  const STORAGE_KEY = "kuroha-lists";
  const SEED_KEY = "kuroha-lists-seeded";
  const MAX_TITLE = 48;
  const MAX_NOTE = 160;

  const DEMO_LISTS = [
    {
      id: "list-rain",
      title: "Дождливые вечера",
      note: "Истории, под которые хорошо идёт дождь за окном.",
      slugs: ["komnata-dozhdya", "dom-u-morya", "tihiy-okean", "chaynaya-na-uglu"]
    },
    {
      id: "list-dark",
      title: "Для тёмной ночи",
      note: "Там, где город спит, а история только начинается.",
      slugs: ["pepel-i-luna", "pod-zemley", "teni-na-stene", "nochnoy-tramvay", "gorod-bez-solntsa"]
    },
    {
      id: "list-short",
      title: "Короткое, на один вечер",
      note: "Когда хочется закрыть книгу до рассвета.",
      slugs: ["bumazhnye-ptitsy", "teplyy-sneg", "malenkaya-biblioteka"]
    }
  ];

  const TITLES = window.KUROHA_TITLES || [];
  const bySlug = new Map(TITLES.map(function (item) { return [item.slug, item]; }));

  function cloneSeed(list, index) {
    return {
      id: list.id,
      title: list.title,
      note: list.note,
      slugs: list.slugs.slice(),
      createdAt: Date.now() - (index + 1) * 86400000,
      updatedAt: Date.now() - (index + 1) * 86400000
    };
  }

  function clean(value, max) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, max);
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (list) {
          return list && typeof list.id === "string" && typeof list.title === "string";
        })
        .map(function (list) {
          return {
            id: list.id,
            title: String(list.title).slice(0, MAX_TITLE),
            note: String(list.note || "").slice(0, MAX_NOTE),
            slugs: Array.isArray(list.slugs)
              ? Array.from(new Set(list.slugs.filter(function (slug) { return typeof slug === "string"; })))
              : [],
            createdAt: Number(list.createdAt) || Date.now(),
            updatedAt: Number(list.updatedAt) || Number(list.createdAt) || Date.now()
          };
        });
    } catch (error) {
      return [];
    }
  }

  function emit() {
    window.dispatchEvent(new CustomEvent("kuroha:lists-change", { detail: { lists: read() } }));
  }

  function write(lists) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch (error) {}
    emit();
  }

  function markSeeded(value) {
    try { localStorage.setItem(SEED_KEY, value); } catch (error) {}
  }

  function ensureSeed() {
    const lists = read();
    const seed = localStorage.getItem(SEED_KEY);
    if (lists.length) {
      if (!seed) markSeeded("existing");
      return lists;
    }
    if (seed) return lists;

    const seeded = DEMO_LISTS.map(cloneSeed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      markSeeded("demo");
    } catch (error) {}
    return seeded;
  }

  function get(id) {
    return read().find(function (list) { return list.id === id; }) || null;
  }

  function create(title, note) {
    const name = clean(title, MAX_TITLE);
    if (!name) return null;
    const lists = read();
    const now = Date.now();
    const list = {
      id: "list-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      title: name,
      note: clean(note, MAX_NOTE),
      slugs: [],
      createdAt: now,
      updatedAt: now
    };
    write([list].concat(lists));
    markSeeded("user");
    return list;
  }

  function update(id, title, note) {
    const name = clean(title, MAX_TITLE);
    if (!name) return null;
    let updated = null;
    const lists = read().map(function (list) {
      if (list.id !== id) return list;
      updated = Object.assign({}, list, {
        title: name,
        note: clean(note, MAX_NOTE),
        updatedAt: Date.now()
      });
      return updated;
    });
    if (!updated) return null;
    write(lists);
    markSeeded("user");
    return updated;
  }

  function remove(id) {
    const lists = read();
    const next = lists.filter(function (list) { return list.id !== id; });
    if (next.length === lists.length) return false;
    write(next);
    return true;
  }

  function addTitle(id, slug) {
    if (!bySlug.has(slug)) return null;
    let found = null;
    const lists = read().map(function (list) {
      if (list.id !== id) return list;
      if (!list.slugs.includes(slug)) {
        found = Object.assign({}, list, {
          slugs: list.slugs.concat(slug),
          updatedAt: Date.now()
        });
        return found;
      }
      found = list;
      return list;
    });
    if (!found) return null;
    write(lists);
    markSeeded("user");
    return found;
  }

  function removeTitle(id, slug) {
    let found = null;
    const lists = read().map(function (list) {
      if (list.id !== id) return list;
      found = Object.assign({}, list, {
        slugs: list.slugs.filter(function (entry) { return entry !== slug; }),
        updatedAt: Date.now()
      });
      return found;
    });
    if (!found) return null;
    write(lists);
    return found;
  }

  function toggleTitle(id, slug) {
    const list = get(id);
    if (!list) return null;
    if (list.slugs.includes(slug)) {
      const updated = removeTitle(id, slug);
      return updated ? { added: false, list: updated } : null;
    }
    const updated = addTitle(id, slug);
    return updated ? { added: true, list: updated } : null;
  }

  function forSlug(slug) {
    return read().filter(function (list) { return list.slugs.includes(slug); });
  }

  function count() {
    return read().length;
  }

  function totalTitles() {
    const seen = new Set();
    read().forEach(function (list) {
      list.slugs.forEach(function (slug) { if (bySlug.has(slug)) seen.add(slug); });
    });
    return seen.size;
  }

  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    markSeeded("cleared");
    emit();
  }

  window.KurohaLists = {
    STORAGE_KEY: STORAGE_KEY,
    SEED_KEY: SEED_KEY,
    read: read,
    get: get,
    ensureSeed: ensureSeed,
    create: create,
    update: update,
    remove: remove,
    addTitle: addTitle,
    removeTitle: removeTitle,
    toggleTitle: toggleTitle,
    forSlug: forSlug,
    count: count,
    totalTitles: totalTitles,
    clear: clear,
    markSeeded: markSeeded
  };

  /* Lists page ------------------------------------------------------------ */

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function plural(number, forms) {
    const value = Math.abs(Number(number) || 0);
    const lastTwo = value % 100;
    const last = value % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    try {
      return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
    } catch (error) {
      return "";
    }
  }

  function formatCount(number, forms) {
    return number + " " + plural(number, forms);
  }

  function initPage() {
    const nav = document.getElementById("lists-nav");
    const detail = document.getElementById("list-detail");
    if (!nav || !detail) return;

    const countLabel = document.getElementById("lists-count");
    const tasteTotal = document.getElementById("lists-total");
    const tasteTitles = document.getElementById("lists-titles");
    const tasteTotalLabel = document.getElementById("lists-total-label");
    const tasteTitlesLabel = document.getElementById("lists-titles-label");
    const tasteNames = document.getElementById("lists-taste-names");
    const form = document.getElementById("list-create");
    const formTitle = document.getElementById("list-form-title");
    const titleInput = document.getElementById("list-title-input");
    const noteInput = document.getElementById("list-note-input");
    const formSubmit = document.getElementById("list-form-submit");
    const formCancel = document.getElementById("list-form-cancel");
    const newToggle = document.getElementById("list-new-toggle");
    const cards = window.KurohaCards;

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("list");
    let activeId = "";
    let formMode = "create";
    let editId = "";

    ensureSeed();
    let lists = read();
    activeId = lists.some(function (list) { return list.id === requested; })
      ? requested
      : lists[0] ? lists[0].id : "";

    function setActive(id) {
      activeId = id;
      const url = new URL(window.location.href);
      if (activeId) url.searchParams.set("list", activeId);
      else url.searchParams.delete("list");
      try {
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      } catch (error) {}
    }

    function showForm(mode, list) {
      formMode = mode;
      editId = list ? list.id : "";
      form.hidden = false;
      form.dataset.mode = mode;
      if (formTitle) formTitle.textContent = mode === "edit" ? "Изменить список" : "Новый список";
      if (formSubmit) formSubmit.textContent = mode === "edit" ? "Сохранить" : "Создать";
      if (titleInput) {
        titleInput.value = list ? list.title : "";
        titleInput.removeAttribute("aria-invalid");
      }
      if (noteInput) noteInput.value = list ? list.note : "";
      window.requestAnimationFrame(function () { titleInput?.focus(); });
    }

    function hideForm() {
      form.hidden = true;
      formMode = "create";
      editId = "";
      if (titleInput) titleInput.value = "";
      if (noteInput) noteInput.value = "";
      if (formTitle) formTitle.textContent = "Новый список";
      if (formSubmit) formSubmit.textContent = "Создать";
    }

    function renderTaste(currentLists) {
      const titleCount = totalTitles();
      if (tasteTotal) tasteTotal.textContent = String(currentLists.length);
      if (tasteTitles) tasteTitles.textContent = String(titleCount);
      if (tasteTotalLabel) {
        tasteTotalLabel.textContent = plural(currentLists.length, ["список", "списка", "списков"]);
      }
      if (tasteTitlesLabel) {
        tasteTitlesLabel.textContent = plural(titleCount, ["история", "истории", "историй"]);
      }
      if (tasteNames) {
        tasteNames.textContent = currentLists.length
          ? currentLists.slice(0, 3).map(function (list) { return list.title; }).join(" · ")
          : "Пока ни одного списка";
      }
    }

    function renderNav(currentLists) {
      if (!currentLists.length) {
        nav.innerHTML = '<p class="lists-nav__empty">Списков пока нет.</p>';
        return;
      }
      nav.innerHTML = currentLists.map(function (list) {
        const active = list.id === activeId;
        return (
          '<button class="list-nav-item' + (active ? " is-active" : "") + '" type="button" data-list-select="' +
          escapeHTML(list.id) + '" aria-pressed="' + String(active) + '">' +
          '<span class="list-nav-item__title">' + escapeHTML(list.title) + "</span>" +
          '<span class="list-nav-item__count">' + list.slugs.length + "</span>" +
          "</button>"
        );
      }).join("");
    }

    function renderListCard(item, list) {
      const cover = cards && typeof cards.cardHTML === "function"
        ? cards.cardHTML(item)
        : "";
      return (
        '<article class="list-card" data-list-card="' + escapeHTML(item.slug) + '">' +
        cover +
        '<button class="list-card__remove" type="button" data-list-remove="' + escapeHTML(item.slug) +
        '" aria-label="Убрать «' + escapeHTML(item.title) + '» из списка">Убрать из списка</button>' +
        "</article>"
      );
    }

    function renderDetail(currentLists) {
      const list = currentLists.find(function (entry) { return entry.id === activeId; }) || null;
      if (!list) {
        detail.innerHTML =
          '<div class="list-detail__empty lists-empty">' +
          '<img src="assets/logo-symbol.svg" alt="" width="44" height="44">' +
          "<h2>Пока ни одного списка.</h2>" +
          "<p>Создай первый — и складывай туда истории по настроению, сезону или компании.</p>" +
          '<button class="btn btn--secondary" type="button" data-list-create-open>Создать первый список</button>' +
          '<a class="btn btn--ghost" href="catalog.html">Открыть каталог</a>' +
          "</div>";
        return;
      }

      const items = list.slugs
        .map(function (slug) { return bySlug.get(slug); })
        .filter(Boolean);
      const created = formatDate(list.createdAt);
      const meta = formatCount(items.length, ["история", "истории", "историй"]) +
        (created ? " · создан " + created : "");

      const grid = items.length
        ? '<div class="lists-grid">' + items.map(function (item) {
            return renderListCard(item, list);
          }).join("") + "</div>"
        : '<div class="list-detail__empty">' +
          '<img src="assets/logo-symbol.svg" alt="" width="38" height="38">' +
          "<h3>В этом списке пока пусто.</h3>" +
          "<p>Открой страницу истории и добавь её в список — или начни с каталога.</p>" +
          '<div class="list-detail__empty-actions">' +
          '<a class="btn btn--secondary" href="catalog.html">Открыть каталог</a>' +
          '<button class="btn btn--ghost" type="button" data-list-create-open>Новый список</button>' +
          "</div></div>";

      detail.innerHTML =
        '<div class="list-detail__head">' +
        "<div>" +
        '<p class="eyebrow">Список</p>' +
        "<h2>" + escapeHTML(list.title) + "</h2>" +
        '<p class="list-detail__note">' +
        (list.note ? escapeHTML(list.note) : "Без описания — просто твоя полка.") +
        "</p>" +
        "</div>" +
        '<div class="list-detail__actions">' +
        '<button class="list-textbtn" type="button" data-list-edit="' + escapeHTML(list.id) + '">Изменить</button>' +
        '<button class="list-textbtn list-textbtn--danger" type="button" data-list-delete="' + escapeHTML(list.id) + '">Удалить</button>' +
        "</div>" +
        "</div>" +
        '<p class="list-detail__meta">' + meta + "</p>" +
        grid;
    }

    function render() {
      lists = read();
      if (activeId && !lists.some(function (list) { return list.id === activeId; })) {
        activeId = lists[0] ? lists[0].id : "";
      }
      if (!activeId && lists.length) activeId = lists[0].id;
      renderTaste(lists);
      renderNav(lists);
      renderDetail(lists);
      if (countLabel) {
        countLabel.textContent = formatCount(lists.length, ["список", "списка", "списков"]);
      }
    }

    nav.addEventListener("click", function (event) {
      const button = event.target.closest("[data-list-select]");
      if (!button) return;
      setActive(button.dataset.listSelect);
      render();
    });

    detail.addEventListener("click", function (event) {
      const removeButton = event.target.closest("[data-list-remove]");
      if (removeButton) {
        const slug = removeButton.dataset.listRemove;
        const item = bySlug.get(slug);
        const list = read().find(function (entry) { return entry.id === activeId; });
        removeTitle(activeId, slug);
        render();
        if (item && list) {
          window.KurohaToast?.("«" + item.title + "» убрана из списка «" + list.title + "».");
        } else if (item) {
          window.KurohaToast?.("«" + item.title + "» убрана из списка.");
        }
        return;
      }

      const editButton = event.target.closest("[data-list-edit]");
      if (editButton) {
        const list = get(editButton.dataset.listEdit);
        if (list) showForm("edit", list);
        return;
      }

      const deleteButton = event.target.closest("[data-list-delete]");
      if (deleteButton) {
        const list = get(deleteButton.dataset.listDelete);
        if (!list) return;
        if (!window.confirm("Удалить список «" + list.title + "»? Истории останутся в библиотеке.")) return;
        remove(list.id);
        if (activeId === list.id) activeId = read()[0] ? read()[0].id : "";
        hideForm();
        render();
        window.KurohaToast?.("Список «" + list.title + "» удалён.");
        return;
      }

      if (event.target.closest("[data-list-create-open]")) {
        showForm("create");
      }
    });

    newToggle?.addEventListener("click", function () {
      if (!form.hidden && formMode === "create") {
        hideForm();
        return;
      }
      showForm("create");
    });

    form?.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!titleInput) return;
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.setAttribute("aria-invalid", "true");
        titleInput.focus();
        return;
      }
      const note = noteInput ? noteInput.value.trim() : "";
      if (formMode === "edit" && editId) {
        const updated = update(editId, title, note);
        if (!updated) return;
        activeId = updated.id;
        hideForm();
        render();
        window.KurohaToast?.("Список обновлён.");
        return;
      }
      const created = create(title, note);
      if (!created) return;
      activeId = created.id;
      hideForm();
      setActive(created.id);
      render();
      window.KurohaToast?.("Список «" + created.title + "» создан.");
    });

    formCancel?.addEventListener("click", hideForm);

    titleInput?.addEventListener("input", function () {
      titleInput.removeAttribute("aria-invalid");
    });

    window.addEventListener("kuroha:lists-change", function () {
      render();
    });

    window.addEventListener("storage", function (event) {
      if (event.key === STORAGE_KEY || event.key === SEED_KEY) render();
    });

    render();
  }

  if (document.body && document.body.dataset.page === "lists") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initPage);
    } else {
      initPage();
    }
  }
})();

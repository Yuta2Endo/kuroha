/* Kuroha 3.0 — public reader lists */
(function () {
  "use strict";

  if (document.body.dataset.page !== "public-lists") return;

  const PUBLIC_LISTS = window.KUROHA_PUBLIC_LISTS || [];
  const TITLES = window.KUROHA_TITLES || [];
  const READERS = window.KUROHA_READERS || [];
  const cards = window.KurohaCards;
  const listsApi = window.KurohaLists;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const bySlug = new Map(TITLES.map((item) => [item.slug, item]));
  const readersBySlug = new Map(READERS.map((reader) => [reader.slug, reader]));

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
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function readerFor(list) {
    return readersBySlug.get(list.reader) || null;
  }

  function readerName(list) {
    const reader = readerFor(list);
    return reader ? reader.name : "Читатель";
  }

  function readerHandle(list) {
    const reader = readerFor(list);
    return reader ? "@" + reader.handle : "";
  }

  function itemsFor(list) {
    return (list.slugs || []).map((slug) => bySlug.get(slug)).filter(Boolean);
  }

  function totalUniqueTitles() {
    const seen = new Set();
    PUBLIC_LISTS.forEach((list) => {
      (list.slugs || []).forEach((slug) => {
        if (bySlug.has(slug)) seen.add(slug);
      });
    });
    return seen.size;
  }

  function renderSummary() {
    const total = $("#public-list-total");
    const titles = $("#public-title-total");
    const readers = $("#public-reader-total");
    if (total) total.textContent = String(PUBLIC_LISTS.length);
    if (titles) titles.textContent = String(totalUniqueTitles());
    if (readers) readers.textContent = String(new Set(PUBLIC_LISTS.map((list) => list.reader)).size);
  }

  function coverStack(list) {
    return itemsFor(list)
      .slice(0, 3)
      .map((item) => cards.coverHTML(item, "cover--mini"))
      .join("");
  }

  function cardHTML(list) {
    const count = itemsFor(list).length;
    const reader = readerFor(list);
    return [
      '<a class="public-card" href="public-lists.html?list=' + encodeURIComponent(list.slug) + '"',
      ' data-public-list="' + escapeHTML(list.slug) + '"',
      ' style="--list-accent:' + escapeHTML(list.accent || "#e63946") + '"',
      ' aria-label="Открыть список «' + escapeHTML(list.title) + '»">',
      '<span class="public-card__curator">',
      '<span class="public-avatar" aria-hidden="true">' + escapeHTML(reader ? reader.initials : "К") + "</span>",
      "<span><b>" + escapeHTML(readerName(list)) + "</b> · " + escapeHTML(readerHandle(list)) + "</span>",
      "</span>",
      '<span class="public-card__title">' + escapeHTML(list.title) + "</span>",
      '<span class="public-card__note">' + escapeHTML(list.note) + "</span>",
      '<span class="public-card__covers">' + coverStack(list) + "</span>",
      '<span class="public-card__foot"><span>' + count + " " + plural(count, ["история", "истории", "историй"]) + "</span>",
      '<span class="public-card__open">Открыть →</span></span>',
      "</a>"
    ].join("");
  }

  function renderGrid() {
    const grid = $("#public-lists-grid");
    const count = $("#public-lists-count");
    if (!grid) return;
    if (!PUBLIC_LISTS.length) {
      grid.innerHTML = '<div class="public-empty">Публичных списков пока нет. Самое время собрать первый.</div>';
    } else {
      grid.innerHTML = PUBLIC_LISTS.map(cardHTML).join("");
    }
    if (count) count.textContent = PUBLIC_LISTS.length + " " + plural(PUBLIC_LISTS.length, ["список", "списка", "списков"]);
  }

  function isSaved(list) {
    if (!listsApi || !list) return false;
    return listsApi.read().some((entry) => entry.title === list.title);
  }

  function updateSaveButton(list) {
    const button = $("#public-list-save");
    if (!button) return;
    const saved = isSaved(list);
    button.disabled = saved;
    button.textContent = saved ? "Уже в моих списках" : "Сохранить себе";
  }

  function renderDetail(slug) {
    const detail = $("#public-list-detail");
    if (!detail) return;
    const list = PUBLIC_LISTS.find((entry) => entry.slug === slug);
    if (!list) {
      detail.hidden = true;
      return;
    }

    const items = itemsFor(list);
    const reader = readerFor(list);
    const label = $("#public-list-label");
    const name = $("#public-list-name");
    const note = $("#public-list-note");
    const meta = $("#public-list-meta");
    const grid = $("#public-list-titles");

    if (label) label.textContent = "Список · " + readerName(list);
    if (name) name.textContent = list.title;
    if (note) note.textContent = list.note;
    if (meta) {
      meta.textContent = items.length + " " + plural(items.length, ["история", "истории", "историй"]) +
        (reader ? " · " + reader.role + " · с " + reader.since : "");
    }
    if (grid) grid.innerHTML = items.map((item) => cards.cardHTML(item)).join("");
    detail.hidden = false;
    updateSaveButton(list);
  }

  function selectList(slug, scroll) {
    const list = PUBLIC_LISTS.find((entry) => entry.slug === slug);
    if (!list) return;
    renderDetail(slug);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("list", slug);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (error) {}
    if (scroll) {
      const detail = $("#public-list-detail");
      if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function closeDetail() {
    const detail = $("#public-list-detail");
    if (detail) detail.hidden = true;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("list");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (error) {}
  }

  function saveCurrentList() {
    const detail = $("#public-list-detail");
    if (detail.hidden) return;
    const slug = new URLSearchParams(window.location.search).get("list");
    const list = PUBLIC_LISTS.find((entry) => entry.slug === slug);
    if (!list || !listsApi) return;
    if (isSaved(list)) {
      window.KurohaToast && window.KurohaToast("Этот список уже есть в «Моих списках».");
      return;
    }

    const created = listsApi.create(list.title, list.note);
    if (!created) {
      window.KurohaToast && window.KurohaToast("Не удалось сохранить список.");
      return;
    }
    list.slugs.forEach((titleSlug) => {
      if (bySlug.has(titleSlug)) listsApi.addTitle(created.id, titleSlug);
    });
    updateSaveButton(list);
    window.KurohaToast && window.KurohaToast("Список «" + list.title + "» сохранён в «Мои списки».");
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const card = event.target.closest("[data-public-list]");
      if (card) {
        event.preventDefault();
        selectList(card.dataset.publicList, true);
        return;
      }
      if (event.target.closest("#public-list-close")) {
        closeDetail();
      }
      if (event.target.closest("#public-list-save")) {
        saveCurrentList();
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === "kuroha-lists") {
        const slug = new URLSearchParams(window.location.search).get("list");
        const list = PUBLIC_LISTS.find((entry) => entry.slug === slug);
        if (list) updateSaveButton(list);
      }
    });
    window.addEventListener("kuroha:lists-change", () => {
      const slug = new URLSearchParams(window.location.search).get("list");
      const list = PUBLIC_LISTS.find((entry) => entry.slug === slug);
      if (list) updateSaveButton(list);
    });
  }

  function init() {
    renderSummary();
    renderGrid();
    bind();
    const initial = new URLSearchParams(window.location.search).get("list");
    if (initial) renderDetail(initial);
  }

  init();
  window.KurohaPublicLists = {
    all: PUBLIC_LISTS,
    render: function () {
      renderSummary();
      renderGrid();
      const slug = new URLSearchParams(window.location.search).get("list");
      if (slug) renderDetail(slug);
    }
  };
})();

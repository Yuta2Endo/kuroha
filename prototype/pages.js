/* Kuroha 3.0 — paged reader mode */
(function () {
  "use strict";

  if (document.body.dataset.page !== "reader") return;

  const article = document.querySelector("#reader-text");
  const head = document.querySelector(".reader-head");
  if (!article || !head) return;
  if (article.querySelector(".reader-upload-pages")) return;

  const blocks = Array.from(article.children).filter((block) => {
    return block.matches("p, blockquote");
  });
  if (blocks.length < 2) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || "pepel-i-luna";
  const chapter = Number.parseInt(params.get("chapter"), 10) || 1;
  const key = slug + ":" + chapter;
  const STORAGE_KEY = "kuroha-reader-pages";
  const PAGE_CHARS = 420;

  const pages = [];
  let current = [];
  let currentLength = 0;
  blocks.forEach((block) => {
    const length = (block.textContent || "").length;
    if (current.length && currentLength + length > PAGE_CHARS) {
      pages.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(block);
    currentLength += length;
  });
  if (current.length) pages.push(current);

  const view = document.createElement("div");
  view.className = "reader-view";
  view.setAttribute("aria-label", "Режим чтения");
  view.innerHTML = '<button class="reader-view__btn" type="button" data-reader-view="text" aria-pressed="true">Текст</button><button class="reader-view__btn" type="button" data-reader-view="pages" aria-pressed="false">Страницы</button>';
  head.appendChild(view);

  const nav = document.createElement("div");
  nav.className = "reader-page-nav";
  nav.hidden = true;
  nav.innerHTML = '<button class="reader-page-nav__btn" type="button" data-page-prev aria-label="Предыдущая страница">←</button><span class="reader-page-nav__count" id="reader-page-count" aria-live="polite">1 / 1</span><button class="reader-page-nav__btn" type="button" data-page-next aria-label="Следующая страница">→</button><span class="reader-page-nav__hint">← → листать страницы</span>';
  article.insertAdjacentElement("afterend", nav);

  const textButton = view.querySelector('[data-reader-view="text"]');
  const pagesButton = view.querySelector('[data-reader-view="pages"]');
  const count = nav.querySelector("#reader-page-count");
  const prev = nav.querySelector("[data-page-prev]");
  const next = nav.querySelector("[data-page-next]");

  let mode = "text";
  let page = 0;

  function readPages() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      return {};
    }
  }

  function savePage() {
    try {
      const data = readPages();
      data[key] = mode === "pages" ? page : 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {}
  }

  function showPage(nextPage) {
    page = Math.max(0, Math.min(pages.length - 1, nextPage));
    blocks.forEach((block) => {
      block.classList.remove("is-page-visible");
    });
    (pages[page] || []).forEach((block) => {
      block.classList.add("is-page-visible");
    });
    count.textContent = (page + 1) + " / " + pages.length;
    prev.disabled = page <= 0;
    next.disabled = page >= pages.length - 1;
    savePage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setMode(nextMode) {
    if (nextMode !== "pages" && nextMode !== "text") return;
    if (nextMode === "pages" && window.KurohaListen) window.KurohaListen.stop();
    mode = nextMode;
    textButton.setAttribute("aria-pressed", nextMode === "text" ? "true" : "false");
    pagesButton.setAttribute("aria-pressed", nextMode === "pages" ? "true" : "false");
    article.classList.toggle("is-pages", nextMode === "pages");
    nav.hidden = nextMode !== "pages";
    if (nextMode === "pages") {
      const saved = Number(readPages()[key]);
      page = Number.isFinite(saved) ? saved : 0;
      showPage(page);
    } else {
      blocks.forEach((block) => block.classList.remove("is-page-visible"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  view.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reader-view]");
    if (button) setMode(button.dataset.readerView);
  });
  prev.addEventListener("click", () => showPage(page - 1));
  next.addEventListener("click", () => showPage(page + 1));

  document.addEventListener("keydown", (event) => {
    if (mode !== "pages" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest("input, textarea, select, button, a, [contenteditable]")) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    showPage(page + (event.key === "ArrowRight" ? 1 : -1));
  }, true);

  window.KurohaPages = {
    text: () => setMode("text"),
    pages: () => setMode("pages"),
    state: () => ({ mode: mode, page: page + 1, total: pages.length })
  };
})();

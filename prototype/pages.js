/* Kuroha 3.0 — paged reader mode and API image chapters */
(function () {
  "use strict";

  if (document.body.dataset.page !== "reader") return;

  const params = new URLSearchParams(window.location.search);
  const chapterId = (params.get("chapterId") || "").trim();

  if (chapterId) {
    initImageReader(chapterId, params);
    return;
  }

  const article = document.querySelector("#reader-text");
  const head = document.querySelector(".reader-head");
  if (!article || !head) return;
  if (article.querySelector(".reader-upload-pages")) return;

  const blocks = Array.from(article.children).filter((block) => {
    return block.matches("p, blockquote");
  });
  if (blocks.length < 2) return;

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

  /* ---------------------------------------------------------------------------
     API image chapter — reader.html?chapterId=…&api=…&titleSlug=…
     --------------------------------------------------------------------------- */
  function initImageReader(id, query) {
    const article = document.querySelector(".reader-article");
    if (!article) return;

    const DEFAULT_API = "http://127.0.0.1:4180/api";
    const TOKEN_KEY = "kuroha-api-token";
    const POSITION_KEY = "kuroha-reader-position";
    // No ":" in the key: home.js/evening.js read only slug:chapter positions.
    const LOCAL_KEY = "api-" + id;

    const api = ((query.get("api") || "").trim() || DEFAULT_API).replace(/\/+$/, "");
    const titleSlug = (query.get("titleSlug") || "").trim();
    const titleHref = titleSlug ? "title.html?slug=" + encodeURIComponent(titleSlug) : "";

    let token = readToken();
    let serverProgress = Boolean(token);
    let ready = false;
    let total = 0;
    let currentPage = 1;
    let images = [];
    let progressTimer = null;
    let localTimer = null;
    let lastSentAt = 0;
    let lastSentPage = 0;
    let lastSentPercent = -1;
    let interacted = false;

    document.body.dataset.readerImages = "true";

    const section = document.createElement("section");
    section.className = "reader-images";
    section.id = "reader-images";
    section.setAttribute("aria-label", "Страницы главы");
    section.setAttribute("aria-busy", "true");
    section.innerHTML =
      '<p class="reader-images__status" id="reader-images-status"></p>' +
      '<div class="reader-images__feed" id="reader-images-feed"></div>';

    const head = document.querySelector(".reader-head");
    if (head && head.parentNode) head.insertAdjacentElement("afterend", section);
    else article.insertBefore(section, article.firstChild);

    const status = section.querySelector("#reader-images-status");
    const feed = section.querySelector("#reader-images-feed");

    const backControl = titleSlug
      ? '<a class="reader-images__action" href="' + escapeHTML(titleHref) + '">К тайтлу</a>'
      : '<button class="reader-images__action" type="button" data-reader-back>Назад</button>';

    const nav = document.createElement("div");
    nav.className = "reader-images__nav";
    nav.hidden = true;
    nav.setAttribute("role", "navigation");
    nav.setAttribute("aria-label", "Страницы главы");
    nav.innerHTML =
      '<button class="reader-images__btn" type="button" data-image-prev aria-label="Предыдущая страница">←</button>' +
      '<span class="reader-images__counter" id="reader-images-counter" aria-live="polite" aria-label="Страница 1 из 1">1 / 1</span>' +
      '<button class="reader-images__btn" type="button" data-image-next aria-label="Следующая страница">→</button>' +
      backControl;
    document.body.appendChild(nav);

    const counter = nav.querySelector("#reader-images-counter");
    const prevButton = nav.querySelector("[data-image-prev]");
    const nextButton = nav.querySelector("[data-image-next]");

    hide("#reader-text", ".reader-end", "#chapter-discussion", "#font-minus", "#font-plus", "#reader-settings", ".reader-bar__chapter", "[data-bookmark]");
    bindHeaderLinks();
    bindTopButton();
    updateChrome();

    load();

    /* ----------------------------------------------------------------------- */

    function readToken() {
      try {
        return localStorage.getItem(TOKEN_KEY) || "";
      } catch (error) {
        return "";
      }
    }

    function escapeHTML(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function plural(number, forms) {
      const absolute = Math.abs(number) % 100;
      const last = absolute % 10;
      if (absolute > 10 && absolute < 20) return forms[2];
      if (last === 1) return forms[0];
      if (last >= 2 && last <= 4) return forms[1];
      return forms[2];
    }

    function hide() {
      Array.prototype.forEach.call(arguments, (selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          element.hidden = true;
        });
      });
    }

    function setText(selector, value) {
      const element = document.querySelector(selector);
      if (element) element.textContent = value;
    }

    function goBack() {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "catalog.html";
    }

    function bindHeaderLinks() {
      ["#reader-back", "#reader-close"].forEach((selector) => {
        const link = document.querySelector(selector);
        if (!link) return;
        if (titleSlug) {
          link.href = titleHref;
          link.setAttribute("aria-label", "К странице тайтла");
          return;
        }
        link.href = "catalog.html";
        link.setAttribute("aria-label", "Назад");
        link.addEventListener("click", (event) => {
          event.preventDefault();
          goBack();
        });
      });
    }

    function bindTopButton() {
      const topButton = document.querySelector("#reader-top");
      if (!topButton) return;
      topButton.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    function imageUrl(value) {
      const source = String(value || "");
      if (!source) return "";
      if (/^https?:\/\//i.test(source)) return source;
      let origin = window.location.origin;
      try {
        origin = new URL(api, window.location.href).origin;
      } catch (error) {}
      return origin + (source.charAt(0) === "/" ? source : "/" + source);
    }

    function currentPercent() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    }

    function readPositions() {
      try {
        const data = JSON.parse(localStorage.getItem(POSITION_KEY) || "{}");
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
      } catch (error) {
        return {};
      }
    }

    async function request(path, options) {
      const config = options || {};
      const headers = Object.assign({ Accept: "application/json" }, config.headers || {});
      if (token) headers.Authorization = "Bearer " + token;
      const response = await fetch(api + path, {
        method: config.method || "GET",
        headers: headers,
        body: config.body,
        cache: "no-store",
        keepalive: Boolean(config.keepalive)
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {}
      return { response: response, payload: payload };
    }

    async function load() {
      token = readToken();
      serverProgress = Boolean(token);
      ready = false;
      total = 0;
      images = [];
      currentPage = 1;
      nav.hidden = true;
      section.hidden = false;
      section.setAttribute("aria-busy", "true");
      status.textContent = "Загружаем страницы…";
      feed.innerHTML = Array.from({ length: 3 }, () =>
        '<div class="reader-image reader-image--skeleton" aria-hidden="true"></div>'
      ).join("");

      try {
        const result = await request("/chapters/" + encodeURIComponent(id) + "/pages");
        if (!result.response.ok) {
          if (result.response.status === 401) serverProgress = false;
          showError(result.response.status);
          return;
        }
        const payload = result.payload || {};
        const pages = Array.isArray(payload.pages) ? payload.pages : [];
        if (!pages.length) {
          showError(200, "EMPTY");
          return;
        }
        renderChapter(payload.chapter || {}, pages);
      } catch (error) {
        showError(-1);
      }
    }

    function renderChapter(chapter, pages) {
      ready = true;
      total = pages.length;
      currentPage = 1;
      section.removeAttribute("aria-busy");
      status.textContent = "";

      const number = chapter.number == null ? "" : String(chapter.number);
      const name = chapter.name || (number ? "Глава " + number : "Глава");
      const pagesLabel = total + " " + plural(total, ["страница", "страницы", "страниц"]);
      const chapterState = chapter.status === "published" ? "опубликовано" : "черновик";

      setText("#reader-bar-title", name);
      setText("#reader-bar-chapter", pagesLabel);
      setText("#reader-chapter-label", number ? "Глава " + number : "Глава");
      setText("#reader-title", name);
      setText("#reader-meta", pagesLabel + " · " + chapterState);
      document.title = name + " — Kuroha";

      feed.innerHTML = pages.map((page, index) => {
        const pageNumber = Number(page.pageNumber) || index + 1;
        const source = imageUrl(page.imageKey);
        return '<figure class="reader-image" id="reader-image-' + pageNumber +
          '" data-page="' + pageNumber + '">' +
          '<img src="' + escapeHTML(source) + '" alt="Страница ' + pageNumber +
          '" decoding="async">' +
          "</figure>";
      }).join("");

      images = Array.prototype.slice.call(feed.querySelectorAll(".reader-image"));
      nav.hidden = false;
      bindImages();
      updateCounter();
      updateChrome();
      restorePosition();
    }

    function bindImages() {
      images.forEach((figure) => {
        const image = figure.querySelector("img");
        if (!image) return;
        image.addEventListener("load", () => {
          updateChrome();
          updateCurrentPage();
        }, { once: true });
        image.addEventListener("error", () => {
          figure.classList.add("is-missing");
          const label = document.createElement("p");
          label.className = "reader-image__missing";
          label.textContent = "Страница не загрузилась";
          figure.appendChild(label);
          updateChrome();
          updateCurrentPage();
        }, { once: true });
      });
    }

    function updateCounter() {
      const page = Math.max(1, Math.min(total || 1, currentPage));
      counter.textContent = page + " / " + (total || 1);
      counter.setAttribute("aria-label", "Страница " + page + " из " + (total || 1));
      prevButton.disabled = page <= 1;
      nextButton.disabled = page >= (total || 1);
    }

    function updateCurrentPage() {
      if (!ready || !images.length) return;
      const bar = document.querySelector(".reader-bar");
      const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
      const line = barBottom + Math.min(180, Math.max(96, window.innerHeight * 0.22));

      let found = 0;
      for (let index = 0; index < images.length; index += 1) {
        const rect = images[index].getBoundingClientRect();
        if (rect.top <= line && rect.bottom > line) {
          found = index + 1;
          break;
        }
      }

      if (!found) {
        let distance = Infinity;
        images.forEach((figure, index) => {
          const rect = figure.getBoundingClientRect();
          const candidate = Math.min(Math.abs(rect.top - line), Math.abs(rect.bottom - line));
          if (candidate < distance) {
            distance = candidate;
            found = index + 1;
          }
        });
      }

      const next = Math.max(1, Math.min(total, found || 1));
      if (next !== currentPage) {
        currentPage = next;
        updateCounter();
        scheduleLocalSave();
      }
    }

    function updateChrome() {
      const percent = currentPercent();
      const progressBar = document.querySelector("#reader-progress");
      const topButton = document.querySelector("#reader-top");
      if (progressBar) progressBar.style.width = percent + "%";
      if (topButton) topButton.hidden = window.scrollY < 360;
    }

    function goToPage(page, align) {
      if (!total) return;
      const index = Math.max(0, Math.min(total - 1, page - 1));
      const target = images[index];
      if (!target) return;

      const html = document.documentElement;
      const previousBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      target.scrollIntoView({ behavior: "auto", block: align === "end" ? "end" : "start" });
      html.style.scrollBehavior = previousBehavior;

      currentPage = index + 1;
      interacted = true;
      updateCounter();
      updateChrome();
      scheduleLocalSave();
      scheduleServerProgress();
    }

    function scheduleLocalSave() {
      if (localTimer) window.clearTimeout(localTimer);
      localTimer = window.setTimeout(saveLocal, 420);
    }

    function saveLocal() {
      localTimer = null;
      if (!ready) return;
      const positions = readPositions();
      positions[LOCAL_KEY] = {
        page: currentPage,
        total: total,
        percent: Math.round(currentPercent() * 100) / 100,
        updatedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
      } catch (error) {}
    }

    function scheduleServerProgress() {
      if (!serverProgress || !token || !ready || progressTimer) return;
      const delay = Math.max(0, 2000 - (Date.now() - lastSentAt));
      progressTimer = window.setTimeout(() => {
        progressTimer = null;
        sendServerProgress();
      }, delay);
    }

    async function sendServerProgress(force) {
      if (!serverProgress || !token || !ready) return;
      const page = Math.max(1, currentPage);
      const percent = Math.round(currentPercent() * 100) / 100;
      if (!force && page === lastSentPage && Math.abs(percent - lastSentPercent) < 0.35) return;

      lastSentAt = Date.now();
      lastSentPage = page;
      lastSentPercent = percent;

      try {
        const result = await request("/progress/" + encodeURIComponent(id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: page, percent: percent }),
          keepalive: true
        });
        if (result.response.status === 401 || result.response.status === 403 || result.response.status === 404) {
          serverProgress = false;
        }
      } catch (error) {}
    }

    async function restorePosition() {
      let page = 0;

      if (serverProgress && token) {
        try {
          const result = await request("/progress");
          if (result.response.status === 401) serverProgress = false;
          if (result.response.ok) {
            const entries = result.payload && Array.isArray(result.payload.progress) ? result.payload.progress : [];
            const record = entries.find((entry) => entry.chapterId === id);
            if (record && Number(record.page) > 0) page = Number(record.page);
          }
        } catch (error) {}
      }

      if (!page) {
        const local = readPositions()[LOCAL_KEY];
        if (local && Number(local.page) > 0) page = Number(local.page);
      }

      page = Math.max(1, Math.min(total, Math.round(page)));
      if (page <= 1) return;

      await waitForImages();
      goToPage(page);
      if (window.KurohaToast) window.KurohaToast("Вернулись на страницу " + page + ".");
    }

    function waitForImages() {
      const pending = images
        .map((figure) => figure.querySelector("img"))
        .filter((image) => image && !image.complete);
      if (!pending.length) return Promise.resolve();
      return Promise.race([
        Promise.all(pending.map((image) => new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        }))),
        new Promise((resolve) => window.setTimeout(resolve, 6000))
      ]);
    }

    function showError(httpStatus, code) {
      ready = false;
      total = 0;
      images = [];
      nav.hidden = true;
      section.removeAttribute("aria-busy");
      status.textContent = "";

      const copy = errorCopy(httpStatus, code);
      feed.innerHTML =
        '<div class="reader-images__error" role="status">' +
        '<p class="reader-images__error-label">' + escapeHTML(copy.title) + "</p>" +
        '<p class="reader-images__error-text">' + escapeHTML(copy.text) + "</p>" +
        '<div class="reader-images__error-actions">' +
        '<button class="reader-images__action reader-images__action--primary" type="button" data-image-retry>Попробовать снова</button>' +
        backControl +
        "</div></div>";

      setText("#reader-bar-title", "Глава недоступна");
      setText("#reader-bar-chapter", httpStatus === 404 ? "не найдена" : "закрыта");
      setText("#reader-chapter-label", "Глава");
      setText("#reader-title", "Глава недоступна");
      setText("#reader-meta", "Kuroha · чтение");
      document.title = copy.title + " — Kuroha";
      window.scrollTo({ top: 0, behavior: "auto" });
      updateChrome();
    }

    function errorCopy(httpStatus, code) {
      if (code === "EMPTY") {
        return {
          title: "Пока без страниц",
          text: "В этой главе ещё нет страниц. Загляни позже."
        };
      }
      if (httpStatus === 401) {
        return {
          title: "Глава закрыта",
          text: "Эта глава ещё не опубликована. Она открыта команде перевода после входа."
        };
      }
      if (httpStatus === 403) {
        return {
          title: "Глава закрыта",
          text: "Глава ещё не опубликована. Доступ есть у команды перевода."
        };
      }
      if (httpStatus === 404) {
        return {
          title: "Глава не найдена",
          text: "Возможно, ссылка устарела или главу убрали с публикации."
        };
      }
      if (httpStatus === -1) {
        return {
          title: "Сервер не отвечает",
          text: "Проверь, что backend запущен, и попробуй снова."
        };
      }
      return {
        title: "Страницы не загрузились",
        text: "Попробуй ещё раз через минуту."
      };
    }

    section.addEventListener("click", (event) => {
      if (event.target.closest("[data-image-retry]")) load();
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("[data-image-prev]")) goToPage(currentPage - 1);
      if (event.target.closest("[data-image-next]")) goToPage(currentPage + 1);
    });

    document.addEventListener("click", (event) => {
      const back = event.target.closest("[data-reader-back]");
      if (!back) return;
      event.preventDefault();
      goBack();
    });

    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        interacted = true;
        updateChrome();
        updateCurrentPage();
        scheduleLocalSave();
        scheduleServerProgress();
      });
    }, { passive: true });

    window.addEventListener("resize", () => {
      updateChrome();
      updateCurrentPage();
    });

    window.addEventListener("pagehide", () => {
      if (interacted) saveLocal();
      if (serverProgress && token && ready && interacted) sendServerProgress(true);
    });

    document.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target && typeof target.closest === "function" &&
        target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) {
        return;
      }
      const settings = document.querySelector("#reader-settings-dialog");
      if (settings && settings.open) return;
      if (!ready) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        goToPage(currentPage + (event.key === "ArrowRight" ? 1 : -1));
      } else if (event.key === "Home") {
        event.preventDefault();
        event.stopPropagation();
        goToPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        goToPage(total, "end");
      }
    }, true);
  }
})();

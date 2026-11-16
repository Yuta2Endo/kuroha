/* Kuroha — dynamic "Continue reading" card.
   Reads local progress and the last saved position inside a chapter. */
(function () {
  "use strict";

  const PROGRESS_KEY = "kuroha-progress";
  const POSITION_KEY = "kuroha-reader-position";
  const FALLBACK_SLUG = "pepel-i-luna";
  const titles = Array.isArray(window.KUROHA_TITLES) ? window.KUROHA_TITLES : [];
  const bySlug = new Map(titles.map((item) => [item.slug, item]));

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function totalChapters(item) {
    const base = Number(item.chapters) || 0;
    if (window.KurohaUploads && typeof window.KurohaUploads.totalFor === "function") {
      return Math.max(base, Number(window.KurohaUploads.totalFor(item.slug, base)) || base);
    }
    return base;
  }

  function clampChapter(value, total) {
    return Math.min(total || 1, Math.max(1, Number(value) || 1));
  }

  function latestPosition(positions) {
    return Object.entries(positions)
      .filter(([key, value]) => {
        if (typeof key !== "string" || !key.includes(":")) return false;
        if (!value || typeof value !== "object") return false;
        return Number.isFinite(Number(value.percent));
      })
      .sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")))[0] || null;
  }

  function latestProgress(progress) {
    return Object.entries(progress)
      .filter(([slug, chapter]) => bySlug.has(slug) && Number(chapter) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0] || null;
  }

  function resolveState() {
    const progress = readJSON(PROGRESS_KEY, {});
    const positions = readJSON(POSITION_KEY, {});
    let slug = null;
    let chapter = 1;
    let hasProgress = false;

    const lastPosition = latestPosition(positions);
    if (lastPosition) {
      const [positionSlug, positionChapter] = lastPosition[0].split(":");
      if (bySlug.has(positionSlug)) {
        slug = positionSlug;
        chapter = Number(positionChapter) || 1;
        hasProgress = true;
      }
    }

    if (!slug) {
      const lastProgress = latestProgress(progress);
      if (lastProgress) {
        slug = lastProgress[0];
        chapter = Number(lastProgress[1]) || 1;
        hasProgress = true;
      }
    }

    if (!slug) {
      slug = FALLBACK_SLUG;
      chapter = 1;
      hasProgress = false;
    }

    const item = bySlug.get(slug) || bySlug.get(FALLBACK_SLUG);
    if (!item) return null;

    const total = totalChapters(item);
    chapter = clampChapter(chapter, total);
    const completed = hasProgress && chapter >= total;
    const percent = completed ? 100 : hasProgress ? Math.round((chapter / total) * 100) : 0;

    return { item, chapter, total, hasProgress, completed, percent };
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function paintCover(item) {
    const cover = document.getElementById("continue-cover");
    if (!cover) return;
    cover.className = "cover cover--mini cover--" + (item.align || "center");
    cover.dataset.art = item.art || "moon";
    cover.style.setProperty("--c1", item.c1 || "#2c1b3d");
    cover.style.setProperty("--c2", item.c2 || "#080b14");
    cover.style.setProperty("--c-accent", item.accent || "#c9a25e");
    const title = cover.querySelector(".cover__title");
    if (title) {
      const lines = Array.isArray(item.lines) && item.lines.length ? item.lines : [item.title];
      title.innerHTML = lines.map((line) => String(line)).join("<br>");
    }
  }

  function render() {
    const state = resolveState();
    if (!state) return;
    const { item, chapter, total, hasProgress, completed, percent } = state;
    const readerHref = "reader.html?slug=" + encodeURIComponent(item.slug) + "&chapter=" + chapter;

    paintCover(item);
    setText("continue-title", item.title);
    setText("continue-count", (hasProgress ? chapter : 0) + " / " + total + " глав");
    setText("continue-percent", percent + "%");

    const label = completed ? "История прочитана" : hasProgress ? "Продолжить чтение" : "Начни с первой главы";
    const chapterText = completed
      ? "Ты дошёл до конца. Можно вернуться и перечитать."
      : hasProgress
        ? "Ты остановился на " + chapter + " главе"
        : "Первая глава уже ждёт";
    setText("continue-label", label);
    setText("continue-chapter", chapterText);

    const progress = document.getElementById("continue-progress");
    if (progress) {
      progress.setAttribute("aria-valuenow", String(percent));
      const fill = progress.querySelector("span");
      if (fill) fill.style.width = percent + "%";
    }

    const cta = document.getElementById("continue-link");
    if (cta) {
      cta.href = readerHref;
      cta.textContent = completed ? "Перечитать" : hasProgress ? "Продолжить" : "Начать";
    }

    const hero = document.getElementById("hero-continue");
    if (hero) {
      hero.href = readerHref;
      hero.textContent = completed ? "Перечитать" : hasProgress ? "Продолжить чтение" : "Начать читать";
    }
  }

  function init() {
    if (!document.getElementById("continue-card")) return;
    render();
    window.addEventListener("storage", (event) => {
      if (event.key === PROGRESS_KEY || event.key === POSITION_KEY) render();
    });
    window.addEventListener("pageshow", render);
  }

  window.KurohaHome = { render: render };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

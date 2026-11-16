/* Kuroha prototype — admin chapter upload form. */
(function () {
  "use strict";

  const titles = Array.isArray(window.KUROHA_TITLES) ? window.KUROHA_TITLES : [];
  const uploads = window.KurohaUploads;
  const form = document.getElementById("upload-form");
  if (!titles.length || !uploads || !form) return;

  const $ = (selector) => document.querySelector(selector);
  const bySlug = new Map(titles.map((item) => [item.slug, item]));

  const select = $("#upload-title");
  const chapterInput = $("#upload-chapter");
  const chapterName = $("#upload-chapter-name");
  const fileInput = $("#upload-files");
  const dropzone = $("#upload-dropzone");
  const preview = $("#upload-preview");
  const fileInfo = $("#upload-file-info");
  const demoButton = $("#upload-demo-pages");
  const publishButton = $("#upload-publish");
  const status = $("#upload-status");
  const progress = $("#upload-progress");
  const progressBar = progress ? progress.querySelector("span") : null;
  const queue = $("#upload-queue");
  const empty = $("#upload-empty");

  let files = [];
  let demoPages = 0;
  let previewUrls = [];
  let publishing = false;
  let publishTimer = null;

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function suggestedChapter(slug) {
    const item = bySlug.get(slug);
    const base = item ? Number(item.chapters) || 0 : 0;
    return Math.max(base, uploads.maxChapter(slug)) + 1;
  }

  function clearPreviewUrls() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
  }

  function currentPages() {
    return files.length + demoPages;
  }

  function renderPreview() {
    if (!preview) return;
    clearPreviewUrls();
    preview.innerHTML = "";

    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const item = document.createElement("div");
      item.className = "admin-preview__item";
      const image = document.createElement("img");
      image.src = url;
      image.alt = file.name;
      item.appendChild(image);
      preview.appendChild(item);
    });

    for (let index = 0; index < demoPages; index += 1) {
      const item = document.createElement("div");
      item.className = "admin-preview__item admin-preview__item--demo";
      item.textContent = `Демо ${index + 1}`;
      preview.appendChild(item);
    }

    preview.hidden = currentPages() === 0;

    if (fileInfo) {
      const pages = currentPages();
      if (pages === 0) {
        fileInfo.innerHTML = "<span>Страницы ещё не выбраны.</span>";
      } else {
        const parts = [];
        if (files.length) parts.push(`${files.length} ${files.length === 1 ? "файл" : "файла"}`);
        if (demoPages) parts.push(`${demoPages} демо`);
        fileInfo.innerHTML = `<span><b>${pages}</b> ${pages === 1 ? "страница" : pages >= 2 && pages <= 4 ? "страницы" : "страниц"} · ${parts.join(" + ")}</span>`;
      }
    }
  }

  function addFiles(list) {
    const images = Array.from(list).filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      setStatus("Нужны изображения страниц.");
      return;
    }
    files = files.concat(images).slice(0, 24);
    demoPages = 0;
    renderPreview();
    setStatus(`Добавлено страниц: ${files.length}.`);
  }

  function renderQueue() {
    if (!queue || !empty) return;
    const latest = uploads.latest(12);
    empty.hidden = latest.length > 0;
    queue.hidden = latest.length === 0;

    if (!latest.length) {
      queue.innerHTML = "";
      return;
    }

    queue.innerHTML = latest.map((entry) => {
      const item = bySlug.get(entry.slug);
      const cover = window.KurohaCards && window.KurohaCards.miniCoverHTML && item
        ? window.KurohaCards.miniCoverHTML(item)
        : "";
      const date = new Date(entry.createdAt);
      const dateLabel = Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
      return `<article class="admin-upload">
        <span class="admin-upload__cover" aria-hidden="true">${cover}</span>
        <div class="admin-upload__body">
          <h3>${escapeHTML(entry.title || item?.title || entry.slug)}</h3>
          <p>Глава ${Number(entry.chapter)} · ${Number(entry.pages) || 1} стр.${dateLabel ? " · " + dateLabel : ""}</p>
        </div>
        <button class="admin-upload__remove" type="button" data-upload-remove="${escapeHTML(entry.id)}" aria-label="Удалить загрузку">×</button>
      </article>`;
    }).join("");
  }

  function renderStats() {
    const stats = uploads.stats();
    setText("admin-total", stats.uploads);
    setText("admin-titles", stats.titles);
    setText("admin-pages", stats.pages);
  }

  function refreshSuggestedChapter() {
    if (!select || !chapterInput) return;
    chapterInput.value = String(suggestedChapter(select.value));
    if (chapterName) chapterName.value = "";
  }

  function finishPublish() {
    const item = bySlug.get(select.value);
    const chapter = Math.max(1, Number(chapterInput.value) || 1);
    const pages = currentPages();

    uploads.add({
      slug: select.value,
      title: item ? item.title : select.value,
      chapter,
      chapterName: chapterName.value.trim(),
      pages,
      files: files.map((file) => file.name)
    });

    files = [];
    demoPages = 0;
    renderPreview();
    renderQueue();
    renderStats();
    refreshSuggestedChapter();
    setStatus(`Глава ${chapter} опубликована локально.`);
    publishButton.disabled = false;
    publishing = false;
    if (progressBar) progressBar.style.width = "100%";
    if (window.KurohaToast) {
      window.KurohaToast(`Глава ${chapter} добавлена в «${item ? item.title : select.value}».`);
    }
  }

  function startPublish() {
    if (publishing) return;
    if (!select.value) {
      setStatus("Выбери тайтл.");
      return;
    }
    if (!currentPages()) {
      setStatus("Добавь хотя бы одну страницу.");
      return;
    }
    const chapter = Number(chapterInput.value);
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > 999) {
      setStatus("Укажи номер главы от 1 до 999.");
      return;
    }

    publishing = true;
    publishButton.disabled = true;
    setStatus("Публикуем главу…");
    let percent = 0;
    if (progress) progress.setAttribute("aria-valuenow", "0");
    if (progressBar) progressBar.style.width = "0%";

    clearInterval(publishTimer);
    publishTimer = setInterval(() => {
      percent = Math.min(100, percent + 8 + Math.round(Math.random() * 10));
      if (progress) progress.setAttribute("aria-valuenow", String(percent));
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (percent >= 100) {
        clearInterval(publishTimer);
        finishPublish();
      }
    }, 110);
  }

  if (select) {
    select.innerHTML = titles
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, "ru"))
      .map((item) => `<option value="${escapeHTML(item.slug)}">${escapeHTML(item.title)} · ${item.chapters} глав</option>`)
      .join("");
  }

  if (chapterInput) {
    chapterInput.max = "999";
  }

  select?.addEventListener("change", refreshSuggestedChapter);
  fileInput?.addEventListener("change", () => {
    addFiles(fileInput.files || []);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((name) => {
    dropzone?.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    dropzone?.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });
  dropzone?.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer?.files || []);
  });

  demoButton?.addEventListener("click", () => {
    demoPages = Math.min(24, demoPages + 6);
    files = [];
    renderPreview();
    setStatus("Добавлены демо-страницы. Их можно опубликовать без файлов.");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    startPublish();
  });

  queue?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-upload-remove]");
    if (!button) return;
    uploads.remove(button.getAttribute("data-upload-remove"));
    renderQueue();
    renderStats();
    setStatus("Загрузка удалена.");
    if (window.KurohaToast) window.KurohaToast("Загрузка удалена из очереди.");
  });

  refreshSuggestedChapter();
  renderPreview();
  renderQueue();
  renderStats();
})();

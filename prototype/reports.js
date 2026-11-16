/* Kuroha 3.0 — local reports and moderation */
(function () {
  "use strict";

  const page = document.body.dataset.page;
  if (page !== "title" && page !== "reader" && page !== "admin") return;

  const KEY = "kuroha-reports";
  const SEED_KEY = "kuroha-reports-seeded";
  const MAX_TEXT = 500;
  const REASONS = {
    copyright: "Авторские права",
    spoiler: "Спойлеры без предупреждения",
    adult: "18+ без маркировки",
    abuse: "Оскорбления или травля",
    spam: "Спам или реклама",
    other: "Другое"
  };
  const TYPE_LABELS = { title: "Тайтл", chapter: "Глава" };
  const STATUS_LABELS = { open: "Открыта", resolved: "Решена", dismissed: "Отклонена" };
  const TITLES = window.KUROHA_TITLES || [];
  const params = new URLSearchParams(window.location.search);

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((report) => report && typeof report.id === "string" && typeof report.targetLabel === "string");
    } catch (error) {
      return [];
    }
  }

  function write(reports) {
    try { localStorage.setItem(KEY, JSON.stringify(reports)); } catch (error) {}
    window.dispatchEvent(new CustomEvent("kuroha:reports-change"));
  }

  function emit() {
    window.dispatchEvent(new CustomEvent("kuroha:reports-change"));
  }

  function plural(number, forms) {
    const value = Math.abs(Number(number) || 0);
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  function relativeTime(value) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "недавно";
    const diff = Math.max(0, Date.now() - time);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "только что";
    if (minutes < 60) return minutes + " " + plural(minutes, ["минуту", "минуты", "минут"]) + " назад";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " " + plural(hours, ["час", "часа", "часов"]) + " назад";
    const days = Math.floor(hours / 24);
    if (days === 1) return "вчера";
    if (days < 7) return days + " " + plural(days, ["день", "дня", "дней"]) + " назад";
    return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  function seedReports() {
    if (page !== "admin" || localStorage.getItem(SEED_KEY)) return;
    const existing = read();
    if (existing.length) {
      localStorage.setItem(SEED_KEY, "existing");
      return;
    }
    const now = Date.now();
    const demo = [
      {
        id: "r-demo-1",
        targetType: "title",
        targetSlug: "pod-zemley",
        targetChapter: null,
        targetLabel: "Под землёй",
        reason: "adult",
        text: "Проверить, что главы 18+ закрыты возрастной отметкой.",
        status: "open",
        createdAt: new Date(now - 2 * 3600000).toISOString()
      },
      {
        id: "r-demo-2",
        targetType: "chapter",
        targetSlug: "pepel-i-luna",
        targetChapter: 12,
        targetLabel: "Пепел и луна · глава 12",
        reason: "spoiler",
        text: "В обсуждении главы раскрыли финал без предупреждения.",
        status: "open",
        createdAt: new Date(now - 26 * 3600000).toISOString()
      },
      {
        id: "r-demo-3",
        targetType: "title",
        targetSlug: "tihiy-okean",
        targetChapter: null,
        targetLabel: "Тихий океан",
        reason: "other",
        text: "Ссылка на главу открывалась не с первой страницы.",
        status: "resolved",
        createdAt: new Date(now - 3 * 86400000).toISOString()
      }
    ];
    try {
      localStorage.setItem(KEY, JSON.stringify(demo));
      localStorage.setItem(SEED_KEY, "demo");
    } catch (error) {}
  }

  function add(data) {
    const reports = read();
    const report = {
      id: "r-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 5),
      targetType: data.targetType === "chapter" ? "chapter" : "title",
      targetSlug: String(data.targetSlug || ""),
      targetChapter: data.targetChapter ? Number(data.targetChapter) : null,
      targetLabel: String(data.targetLabel || "").slice(0, 100),
      reason: REASONS[data.reason] ? data.reason : "other",
      text: String(data.text || "").trim().slice(0, MAX_TEXT),
      status: "open",
      createdAt: new Date().toISOString()
    };
    write([report].concat(reports));
    return report;
  }

  function setStatus(id, status) {
    let changed = null;
    const reports = read().map((report) => {
      if (report.id !== id) return report;
      changed = Object.assign({}, report, { status: status, resolvedAt: new Date().toISOString() });
      return changed;
    });
    if (changed) write(reports);
    return changed;
  }

  function openCount() {
    return read().filter((report) => report.status === "open").length;
  }

  function targetForPage() {
    if (page === "reader") {
      const slug = params.get("slug") || "pepel-i-luna";
      const chapter = Number.parseInt(params.get("chapter"), 10) || 1;
      const item = TITLES.find((entry) => entry.slug === slug);
      return {
        targetType: "chapter",
        targetSlug: slug,
        targetChapter: chapter,
        targetLabel: (item ? item.title : slug) + " · глава " + chapter
      };
    }
    const slug = params.get("slug") || "pepel-i-luna";
    const item = TITLES.find((entry) => entry.slug === slug);
    return {
      targetType: "title",
      targetSlug: slug,
      targetChapter: null,
      targetLabel: item ? item.title : slug
    };
  }

  function injectTrigger() {
    if (page === "reader") {
      const link = document.querySelector("#reader-to-title");
      if (!link || document.querySelector(".reader-report")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reader-report";
      button.setAttribute("data-report-open", "");
      button.textContent = "Пожаловаться на главу";
      link.insertAdjacentElement("afterend", button);
      return;
    }
    if (page === "title") {
      const side = document.querySelector(".title-side");
      if (!side || document.querySelector(".side-report")) return;
      const block = document.createElement("div");
      block.className = "side-block side-report";
      block.innerHTML = '<h3>Если что-то не так</h3><p>Помоги нам сохранить библиотеку спокойной.</p><button class="side-report__open" type="button" data-report-open>Пожаловаться на тайтл</button>';
      side.appendChild(block);
    }
  }

  let dialog = null;
  let form = null;
  let reasonSelect = null;
  let textArea = null;
  let targetLabel = null;
  let activeTarget = null;

  function buildDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "report-dialog";
    dialog.id = "report-dialog";
    dialog.setAttribute("aria-labelledby", "report-dialog-title");
    dialog.innerHTML = [
      '<div class="report-dialog__panel">',
      '<div class="report-dialog__head">',
      '<div><p class="eyebrow">Жалоба</p><h2 id="report-dialog-title">Что не так?</h2></div>',
      '<button class="report-close" type="button" data-report-close aria-label="Закрыть">×</button>',
      '</div>',
      '<p class="report-target" id="report-target"></p>',
      '<form id="report-form">',
      '<label class="report-field"><span>Причина</span><select id="report-reason"></select></label>',
      '<label class="report-field"><span>Комментарий <small>— необязательно</small></span><textarea id="report-text" maxlength="500" placeholder="Что стоит проверить?"></textarea></label>',
      '<p class="report-note">Жалоба сохранится в этом браузере и появится в локальной админке. В реальном продукте её получит модератор.</p>',
      '<div class="report-actions"><button class="btn btn--ghost" type="button" data-report-cancel>Отмена</button><button class="btn btn--primary" type="submit">Отправить жалобу</button></div>',
      '</form>',
      '</div>'
    ].join("");
    document.body.appendChild(dialog);

    form = dialog.querySelector("#report-form");
    reasonSelect = dialog.querySelector("#report-reason");
    textArea = dialog.querySelector("#report-text");
    targetLabel = dialog.querySelector("#report-target");
    reasonSelect.innerHTML = Object.keys(REASONS).map((key) => `<option value="${key}">${REASONS[key]}</option>`).join("");

    dialog.querySelector("[data-report-close]").addEventListener("click", close);
    dialog.querySelector("[data-report-cancel]").addEventListener("click", close);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!activeTarget) return;
      add({
        targetType: activeTarget.targetType,
        targetSlug: activeTarget.targetSlug,
        targetChapter: activeTarget.targetChapter,
        targetLabel: activeTarget.targetLabel,
        reason: reasonSelect.value,
        text: textArea.value
      });
      close();
      if (window.KurohaToast) window.KurohaToast("Жалоба отправлена. Спасибо — мы посмотрим.");
    });
  }

  function open() {
    buildDialog();
    activeTarget = targetForPage();
    if (targetLabel) {
      targetLabel.innerHTML = "<b>" + escapeHTML(activeTarget.targetLabel) + "</b><br>Куда: " + (activeTarget.targetType === "chapter" ? "обсуждение главы" : "страница тайтла");
    }
    form.reset();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.setTimeout(() => reasonSelect?.focus(), 40);
  }

  function close() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function targetHref(report) {
    if (report.targetType === "chapter") {
      return "reader.html?slug=" + encodeURIComponent(report.targetSlug) + "&chapter=" + encodeURIComponent(report.targetChapter || 1);
    }
    return "title.html?slug=" + encodeURIComponent(report.targetSlug);
  }

  function renderAdmin() {
    const list = document.querySelector("#report-queue");
    if (!list) return;
    seedReports();
    const reports = read().slice().sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (a.status !== "open" && b.status === "open") return 1;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    const count = document.querySelector("#reports-count");
    const empty = document.querySelector("#reports-empty");
    if (count) {
      const open = openCount();
      count.textContent = open + " " + plural(open, ["открытая жалоба", "открытые жалобы", "открытых жалоб"]);
    }
    if (empty) empty.hidden = reports.length > 0;
    list.innerHTML = reports.map((report) => {
      const statusClass = "is-" + report.status;
      const actions = report.status === "open"
        ? '<button class="report-item__action" type="button" data-report-resolve="' + escapeHTML(report.id) + '">Решить</button><button class="report-item__action" type="button" data-report-dismiss="' + escapeHTML(report.id) + '">Отклонить</button>'
        : '<button class="report-item__action" type="button" data-report-reopen="' + escapeHTML(report.id) + '">Вернуть в работу</button>';
      return [
        '<article class="report-item ' + statusClass + '" data-report-id="' + escapeHTML(report.id) + '">',
        '<div class="report-item__top"><span class="report-item__type">' + (TYPE_LABELS[report.targetType] || "Материал") + '</span><time class="report-item__time" datetime="' + escapeHTML(report.createdAt) + '">' + relativeTime(report.createdAt) + "</time></div>",
        '<h3><a href="' + targetHref(report) + '">' + escapeHTML(report.targetLabel) + "</a></h3>",
        '<p class="report-item__reason">' + escapeHTML(REASONS[report.reason] || "Другое") + "</p>",
        report.text ? '<p class="report-item__text">' + escapeHTML(report.text) + "</p>" : "",
        '<div class="report-item__actions">' + actions + '<span class="report-item__status">' + (STATUS_LABELS[report.status] || "Открыта") + "</span></div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function bindAdmin() {
    const list = document.querySelector("#report-queue");
    if (!list) return;
    list.addEventListener("click", (event) => {
      const resolve = event.target.closest("[data-report-resolve]");
      const dismiss = event.target.closest("[data-report-dismiss]");
      const reopen = event.target.closest("[data-report-reopen]");
      if (resolve) setStatus(resolve.dataset.reportResolve, "resolved");
      if (dismiss) setStatus(dismiss.dataset.reportDismiss, "dismissed");
      if (reopen) setStatus(reopen.dataset.reportReopen, "open");
      if (resolve || dismiss || reopen) {
        renderAdmin();
        if (window.KurohaToast) window.KurohaToast("Статус жалобы обновлён.");
      }
    });
    window.addEventListener("kuroha:reports-change", renderAdmin);
    window.addEventListener("storage", (event) => {
      if (event.key === KEY) renderAdmin();
    });
  }

  if (page === "admin") {
    renderAdmin();
    bindAdmin();
  } else {
    injectTrigger();
    buildDialog();
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-report-open]")) open();
    });
  }

  window.KurohaReports = {
    KEY: KEY,
    read: read,
    add: add,
    openCount: openCount,
    ensureSeed: seedReports,
    renderAdmin: renderAdmin
  };
})();

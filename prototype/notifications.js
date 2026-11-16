(function () {
  "use strict";

  var STORAGE_KEY = "kuroha-notifications";
  var SEED_KEY = "kuroha-notifications-seeded";
  var TYPES = {
    chapter: "Глава",
    discussion: "Обсуждение",
    milestone: "Веха"
  };
  var FILTERS = ["all", "unread", "chapter", "discussion", "milestone"];
  var currentFilter = "all";

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function read() {
    var items = readJSON(STORAGE_KEY, []);
    return Array.isArray(items) ? items : [];
  }

  function sorted(items) {
    return items.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function emit() {
    try {
      window.dispatchEvent(new CustomEvent("kuroha:notifications-change", {
        detail: { items: read() }
      }));
    } catch (error) {}
  }

  function write(items) {
    writeJSON(STORAGE_KEY, items);
    emit();
    return items;
  }

  function nowMinus(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }

  function titleFor(slug, fallback) {
    var titles = window.KUROHA_TITLES || [];
    for (var i = 0; i < titles.length; i += 1) {
      if (titles[i].slug === slug) return titles[i].title;
    }
    return fallback;
  }

  function seed() {
    var pepel = titleFor("pepel-i-luna", "Пепел и луна");
    var klinok = titleFor("klinok-vetra", "Клинок ветра");
    var chaynaya = titleFor("chaynaya-na-uglu", "Чайная на углу");

    return [
      {
        id: "n-klinok-chapter",
        type: "chapter",
        title: "«" + klinok + "» — новая глава",
        text: "Глава 86 уже в читалке.",
        href: "reader.html?slug=klinok-vetra&chapter=86",
        createdAt: nowMinus(2),
        read: false
      },
      {
        id: "n-pepel-chapter",
        type: "chapter",
        title: "«" + pepel + "» — новая глава",
        text: "Глава 48. Дом на краю ночи.",
        href: "reader.html?slug=pepel-i-luna&chapter=48",
        createdAt: nowMinus(5),
        read: false
      },
      {
        id: "n-pepel-discussion",
        type: "discussion",
        title: "Ая ответила в обсуждении",
        text: "«" + pepel + "» · «Не ищи меня среди имён…»",
        href: "title.html?slug=pepel-i-luna#discussions",
        createdAt: nowMinus(9),
        read: false
      },
      {
        id: "n-milestone-10",
        type: "milestone",
        title: "Веха: первые 10 глав",
        text: "Тихая отметка в профиле — без уровней и гонок.",
        href: "profile.html#milestones",
        createdAt: nowMinus(26),
        read: true
      },
      {
        id: "n-chaynaya-chapter",
        type: "chapter",
        title: "«" + chaynaya + "» — новая глава",
        text: "Глава 21 уже доступна.",
        href: "reader.html?slug=chaynaya-na-uglu&chapter=21",
        createdAt: nowMinus(48),
        read: true
      }
    ];
  }

  function ensureSeed() {
    var state = null;
    try {
      state = localStorage.getItem(SEED_KEY);
    } catch (error) {}

    if (state) return read();

    var existing = read();
    if (existing.length) {
      try {
        localStorage.setItem(SEED_KEY, "existing");
      } catch (error) {}
      return existing;
    }

    var items = seed();
    write(items);
    try {
      localStorage.setItem(SEED_KEY, "demo");
    } catch (error) {}
    return items;
  }

  function unreadCount(items) {
    var list = Array.isArray(items) ? items : read();
    var count = 0;
    for (var i = 0; i < list.length; i += 1) {
      if (!list[i].read) count += 1;
    }
    return count;
  }

  function markRead(id) {
    var items = read();
    var changed = false;
    items = items.map(function (item) {
      if (item.id === id && !item.read) {
        changed = true;
        return Object.assign({}, item, { read: true });
      }
      return item;
    });
    if (changed) write(items);
    return changed;
  }

  function markAllRead() {
    var items = read();
    var changed = 0;
    items = items.map(function (item) {
      if (!item.read) {
        changed += 1;
        return Object.assign({}, item, { read: true });
      }
      return item;
    });
    if (changed) write(items);
    return changed;
  }

  function typeLabel(type) {
    return TYPES[type] || "Событие";
  }

  function relativeTime(value) {
    var time = new Date(value).getTime();
    if (!time) return "";
    var diff = Math.max(0, Date.now() - time);
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "только что";
    if (minutes < 60) return minutes + " мин назад";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " ч назад";
    var days = Math.floor(hours / 24);
    if (days === 1) return "вчера";
    if (days < 7) return days + " дн назад";
    return new Date(time).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short"
    });
  }

  function plural(count, forms) {
    var abs = Math.abs(count) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function iconFor(type) {
    if (type === "discussion") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2 1.2-4.4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01"/></svg>';
    }
    if (type === "milestone") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5h5.5A2.5 2.5 0 0 1 13 7v12.5H7.5A2.5 2.5 0 0 0 5 22V4.5Z"/><path d="M19 4.5h-5.5A2.5 2.5 0 0 0 11 7v12.5h5.5A2.5 2.5 0 0 1 19 22V4.5Z"/></svg>';
  }

  function checkIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 6.8"/></svg>';
  }

  function itemHTML(item) {
    var unread = !item.read;
    return '<article class="notif-item' + (unread ? " is-unread" : "") + '" data-notif-item="' + escapeHTML(item.id) + '">' +
      '<span class="notif-item__icon" aria-hidden="true">' + iconFor(item.type) + '</span>' +
      '<div class="notif-item__body">' +
        '<div class="notif-item__top">' +
          '<span class="notif-item__type">' + escapeHTML(typeLabel(item.type)) + '</span>' +
          (unread ? '<span class="notif-item__dot" aria-label="Непрочитанное"></span>' : "") +
          '<time datetime="' + escapeHTML(item.createdAt) + '">' + escapeHTML(relativeTime(item.createdAt)) + '</time>' +
        '</div>' +
        '<h3><a href="' + escapeHTML(item.href) + '" data-notif-link="' + escapeHTML(item.id) + '">' + escapeHTML(item.title) + '</a></h3>' +
        '<p>' + escapeHTML(item.text) + '</p>' +
      '</div>' +
      '<button class="notif-item__action" type="button" data-notif-read="' + escapeHTML(item.id) + '" aria-label="' + (unread ? "Отметить прочитанным" : "Прочитано") + '"' + (unread ? "" : " disabled") + '>' +
        checkIcon() +
      '</button>' +
    '</article>';
  }

  function counts(items) {
    var result = { all: items.length, unread: 0, chapter: 0, discussion: 0, milestone: 0 };
    items.forEach(function (item) {
      if (!item.read) result.unread += 1;
      if (result[item.type] != null) result[item.type] += 1;
    });
    return result;
  }

  function filteredItems(items) {
    if (currentFilter === "all") return items;
    if (currentFilter === "unread") {
      return items.filter(function (item) { return !item.read; });
    }
    return items.filter(function (item) { return item.type === currentFilter; });
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function syncBadges() {
    var count = unreadCount();
    document.querySelectorAll("[data-notifications-count]").forEach(function (node) {
      node.textContent = count > 9 ? "9+" : String(count);
      node.hidden = count === 0;
    });
    document.querySelectorAll("[data-notifications-link]").forEach(function (node) {
      var label = count ? "Уведомления, " + count + " непрочитанных" : "Уведомления";
      node.setAttribute("aria-label", label);
      node.setAttribute("title", count ? "Уведомления: " + count : "Уведомления");
    });
  }

  function renderPage() {
    if (!document.body || document.body.dataset.page !== "notifications") return;

    var all = sorted(read());
    var stats = counts(all);
    var visible = filteredItems(all);
    var list = document.getElementById("notif-list");
    var empty = document.getElementById("notif-empty");
    var readAll = document.getElementById("notif-read-all");
    var countNode = document.getElementById("notif-count");

    if (list) list.innerHTML = visible.map(itemHTML).join("");
    if (list) list.hidden = visible.length === 0;
    if (empty) empty.hidden = visible.length !== 0;

    if (empty) {
      var emptyTitle = document.getElementById("notif-empty-title");
      var emptyCopy = document.getElementById("notif-empty-copy");
      if (emptyTitle) {
        emptyTitle.textContent = currentFilter === "unread" && stats.all
          ? "Всё прочитано."
          : "Пока тихо.";
      }
      if (emptyCopy) {
        emptyCopy.textContent = currentFilter === "unread" && stats.all
          ? "Непрочитанных уведомлений нет. Возвращайся, когда появится новая глава."
          : "Новые главы с полки и ответы в обсуждениях появятся здесь.";
      }
    }

    setText("notif-unread", stats.unread);
    setText("notif-total", stats.all);
    setText("notif-chapters", stats.chapter);
    setText("notif-discussions", stats.discussion);
    setText("notif-milestones", stats.milestone);
    setText("notif-count-all", stats.all);
    setText("notif-count-unread", stats.unread);
    setText("notif-count-chapter", stats.chapter);
    setText("notif-count-discussion", stats.discussion);
    setText("notif-count-milestone", stats.milestone);
    setText("notif-count", visible.length + " " + plural(visible.length, ["событие", "события", "событий"]));

    if (readAll) {
      readAll.disabled = stats.unread === 0;
      readAll.textContent = stats.unread ? "Отметить всё прочитанным" : "Всё прочитано";
    }

    document.querySelectorAll("[data-notif-filter]").forEach(function (button) {
      var active = button.getAttribute("data-notif-filter") === currentFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function bindPage() {
    if (!document.body || document.body.dataset.page !== "notifications") return;

    var list = document.getElementById("notif-list");
    var readAll = document.getElementById("notif-read-all");

    document.querySelectorAll("[data-notif-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        var filter = button.getAttribute("data-notif-filter");
        if (FILTERS.indexOf(filter) === -1) return;
        currentFilter = filter;
        renderPage();
      });
    });

    if (readAll) {
      readAll.addEventListener("click", function () {
        var count = markAllRead();
        if (count && window.KurohaToast) {
          window.KurohaToast("Все уведомления прочитаны.");
        }
        renderPage();
      });
    }

    if (list) {
      list.addEventListener("click", function (event) {
        var readButton = event.target.closest("[data-notif-read]");
        if (readButton && !readButton.disabled) {
          markRead(readButton.getAttribute("data-notif-read"));
          renderPage();
          return;
        }

        var link = event.target.closest("[data-notif-link]");
        if (link) {
          markRead(link.getAttribute("data-notif-link"));
        }
      });
    }

  }

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY || event.key === SEED_KEY) {
      syncBadges();
      renderPage();
    }
  });

  window.addEventListener("kuroha:notifications-change", function () {
    syncBadges();
    renderPage();
  });

  ensureSeed();
  syncBadges();
  if (document.body && document.body.dataset.page === "notifications") {
    renderPage();
    bindPage();
  }

  window.KurohaNotifications = {
    STORAGE_KEY: STORAGE_KEY,
    SEED_KEY: SEED_KEY,
    read: read,
    ensureSeed: ensureSeed,
    unreadCount: unreadCount,
    markRead: markRead,
    markAllRead: markAllRead,
    syncBadges: syncBadges
  };
})();

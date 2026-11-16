(function () {
  "use strict";

  var STORAGE_KEY = "kuroha-letters";
  var SEED_KEY = "kuroha-letters-seeded";
  var MAX_LENGTH = 400;
  var READERS = window.KUROHA_READERS || [];
  var toast = window.KurohaToast || function () {};

  var DEMO = {
    aya: [
      {
        from: "them",
        text: "Дошла до двенадцатой главы. Кажется, дом на краю ночи — это не место, а состояние.",
        ageMinutes: 180,
        read: true
      },
      {
        from: "me",
        text: "Я тоже остановился там же. Особенно про письмо без адреса.",
        ageMinutes: 95,
        read: true
      },
      {
        from: "them",
        text: "Тогда встречаемся в клубе в 21:00? Обсудим без спойлеров.",
        ageMinutes: 25,
        read: false
      }
    ],
    quiet: [
      {
        from: "them",
        text: "«Под землёй» становится страшнее без темноты. Ты заметил?",
        ageMinutes: 1360,
        read: true
      },
      {
        from: "me",
        text: "Заметил. Как будто тишина громче.",
        ageMinutes: 1290,
        read: true
      },
      {
        from: "them",
        text: "Если захочешь, начнём читать следующую главу вместе. Без спешки.",
        ageMinutes: 70,
        read: false
      }
    ],
    mina: [
      {
        from: "them",
        text: "Спасибо, что читаешь «Пепел и луну». Новые главы — по воскресеньям.",
        ageMinutes: 4320,
        read: true
      }
    ]
  };

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function plural(number, forms) {
    var n = Math.abs(Number(number) || 0) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  }

  function readerFor(slug) {
    return READERS.filter(function (reader) {
      return reader.slug === slug;
    })[0] || {
      slug: slug,
      name: slug,
      handle: "@" + slug,
      initials: String(slug).slice(0, 2).toUpperCase(),
      role: "читатель",
      accent: "#e63946",
      online: false
    };
  }

  function readRaw() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      var clean = {};
      Object.keys(parsed).forEach(function (slug) {
        if (!Array.isArray(parsed[slug])) return;
        clean[slug] = parsed[slug]
          .filter(function (message) {
            return message && typeof message.text === "string" && typeof message.createdAt === "string";
          })
          .map(function (message) {
            return {
              id: String(message.id || "l-" + Math.random().toString(36).slice(2)),
              from: message.from === "me" ? "me" : "them",
              text: String(message.text).slice(0, MAX_LENGTH),
              createdAt: message.createdAt,
              read: message.from === "me" ? true : Boolean(message.read)
            };
          });
      });
      return clean;
    } catch (error) {
      return {};
    }
  }

  function write(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {}
  }

  function emit(slug) {
    window.dispatchEvent(new CustomEvent("kuroha:letters-change", { detail: { reader: slug || null } }));
  }

  function buildSeed() {
    var now = Date.now();
    var data = {};
    Object.keys(DEMO).forEach(function (slug) {
      data[slug] = DEMO[slug].map(function (message, index) {
        return {
          id: "l-" + slug + "-" + (index + 1),
          from: message.from,
          text: message.text,
          createdAt: new Date(now - message.ageMinutes * 60000).toISOString(),
          read: message.read !== false
        };
      });
    });
    return data;
  }

  function ensureSeed() {
    if (localStorage.getItem(SEED_KEY)) return readRaw();
    var current = readRaw();
    if (Object.keys(current).length === 0) {
      current = buildSeed();
      write(current);
      try { localStorage.setItem(SEED_KEY, "demo"); } catch (error) {}
    }
    return current;
  }

  function read() {
    return ensureSeed();
  }

  function forReader(slug) {
    var messages = read()[slug] || [];
    return messages.slice().sort(function (a, b) {
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  function lastMessage(slug) {
    var messages = forReader(slug);
    return messages.length ? messages[messages.length - 1] : null;
  }

  function unreadCount() {
    return Object.keys(read()).reduce(function (sum, slug) {
      return sum + forReader(slug).filter(function (message) {
        return message.from === "them" && !message.read;
      }).length;
    }, 0);
  }

  function total() {
    return Object.keys(read()).reduce(function (sum, slug) {
      return sum + forReader(slug).length;
    }, 0);
  }

  function markSeeded(value) {
    try { localStorage.setItem(SEED_KEY, value); } catch (error) {}
  }

  function markRead(slug) {
    var data = read();
    if (!Array.isArray(data[slug])) return;
    var changed = false;
    data[slug] = data[slug].map(function (message) {
      if (message.from === "them" && !message.read) {
        changed = true;
        return Object.assign({}, message, { read: true });
      }
      return message;
    });
    if (changed) {
      write(data);
      emit(slug);
    }
  }

  function markAllRead() {
    var data = read();
    var changed = false;
    Object.keys(data).forEach(function (slug) {
      data[slug] = data[slug].map(function (message) {
        if (message.from === "them" && !message.read) {
          changed = true;
          return Object.assign({}, message, { read: true });
        }
        return message;
      });
    });
    if (changed) {
      write(data);
      emit(null);
    }
    return changed;
  }

  function send(slug, text) {
    var value = String(text || "").trim().slice(0, MAX_LENGTH);
    if (!value) return false;
    var data = read();
    if (!Array.isArray(data[slug])) data[slug] = [];
    data[slug].push({
      id: "l-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      from: "me",
      text: value,
      createdAt: new Date().toISOString(),
      read: true
    });
    write(data);
    markSeeded("user");
    emit(slug);
    return true;
  }

  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    markSeeded("cleared");
    emit(null);
  }

  function relativeTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var diff = Math.max(0, Date.now() - date.getTime());
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "только что";
    if (minutes < 60) return minutes + " мин";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " ч";
    var days = Math.floor(hours / 24);
    if (days === 1) return "вчера";
    if (days < 7) return days + " дн";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  function dayLabel(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var today = new Date();
    var day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var diff = Math.round((now - day) / 86400000);
    if (diff <= 0) return "Сегодня";
    if (diff === 1) return "Вчера";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }

  function conversations() {
    var data = read();
    var list = Object.keys(data)
      .filter(function (slug) { return data[slug].length > 0; })
      .map(function (slug) {
        var reader = readerFor(slug);
        var messages = forReader(slug);
        return {
          slug: slug,
          reader: reader,
          messages: messages,
          last: messages[messages.length - 1],
          unread: messages.filter(function (message) {
            return message.from === "them" && !message.read;
          }).length
        };
      });
    return list.sort(function (a, b) {
      return new Date(b.last.createdAt) - new Date(a.last.createdAt);
    });
  }

  function initPage() {
    if (document.body.dataset.page !== "letters") return;

    var currentSlug = null;
    var list = $("#letters-list");
    var thread = $("#letter-thread");
    var layout = $("#letters-layout");
    var empty = $("#letters-empty");
    var readAll = $("#letters-read-all");
    var summaryConversations = $("#letters-conversations");
    var summaryUnread = $("#letters-unread");
    var summaryTotal = $("#letters-total");
    var count = $("#letters-count");
    if (!list || !thread) return;

    function currentConversation() {
      return conversations().filter(function (item) {
        return item.slug === currentSlug;
      })[0];
    }

    function renderSummary() {
      var items = conversations();
      var unread = unreadCount();
      var all = total();
      if (summaryConversations) summaryConversations.textContent = items.length;
      if (summaryUnread) summaryUnread.textContent = unread;
      if (summaryTotal) summaryTotal.textContent = all;
      if (count) count.textContent = items.length + " " + plural(items.length, ["переписка", "переписки", "переписок"]);
      if (readAll) readAll.disabled = unread === 0;
    }

    function renderList() {
      var items = conversations();
      list.innerHTML = items.map(function (item) {
        var active = item.slug === currentSlug;
        var preview = item.last ? item.last.text : "";
        if (item.last && item.last.from === "me") preview = "Ты: " + preview;
        return (
          '<button class="letter-conv' + (active ? " is-active" : "") + '" type="button" ' +
            'data-letter="' + escapeHTML(item.slug) + '" aria-pressed="' + (active ? "true" : "false") + '">' +
            '<span class="letter-conv__avatar" style="--reader-accent:' + escapeHTML(item.reader.accent) + '">' + escapeHTML(item.reader.initials) + '</span>' +
            '<span class="letter-conv__body">' +
              '<span class="letter-conv__top"><b>' + escapeHTML(item.reader.name) + '</b><time>' + escapeHTML(relativeTime(item.last && item.last.createdAt)) + '</time></span>' +
              '<span class="letter-conv__preview">' + escapeHTML(preview) + '</span>' +
            '</span>' +
            (item.unread ? '<span class="letter-conv__unread">' + item.unread + '</span>' : '<span class="letter-conv__arrow" aria-hidden="true">›</span>') +
          '</button>'
        );
      }).join("");
      if (layout) layout.hidden = items.length === 0;
      if (empty) empty.hidden = items.length > 0;
    }

    function messageHTML(message, reader) {
      var mine = message.from === "me";
      var sender = mine ? "Ты" : reader.name;
      return (
        '<div class="letter-msg' + (mine ? " is-mine" : "") + '">' +
          '<div class="letter-msg__bubble"><p>' + escapeHTML(message.text) + '</p></div>' +
          '<span class="letter-msg__meta">' + escapeHTML(sender) + ' · ' + escapeHTML(relativeTime(message.createdAt)) + '</span>' +
        '</div>'
      );
    }

    function messagesHTML(messages, reader) {
      if (!messages.length) {
        return '<div class="letter-thread__empty">Пока ни одного письма. Начни первым.</div>';
      }
      var html = "";
      var lastDay = "";
      messages.forEach(function (message) {
        var label = dayLabel(message.createdAt);
        if (label !== lastDay) {
          lastDay = label;
          html += '<div class="letter-day">' + escapeHTML(label) + '</div>';
        }
        html += messageHTML(message, reader);
      });
      return html;
    }

    function renderThread() {
      var item = currentConversation();
      if (!item) {
        thread.innerHTML = '<div class="letter-thread__empty">Выбери переписку слева.</div>';
        return;
      }
      var reader = item.reader;
      thread.innerHTML =
        '<header class="letter-thread__head">' +
          '<span class="letter-thread__avatar" style="--reader-accent:' + escapeHTML(reader.accent) + '">' + escapeHTML(reader.initials) + '</span>' +
          '<div class="letter-thread__who">' +
            '<h3>' + escapeHTML(reader.name) + '</h3>' +
            '<p>' + escapeHTML(reader.handle) + ' · ' + escapeHTML(reader.role) +
              (reader.online ? ' · <span class="letter-thread__online">онлайн</span>' : '') +
            '</p>' +
          '</div>' +
          '<a class="letter-thread__profile" href="readers.html?reader=' + encodeURIComponent(reader.slug) + '">Профиль</a>' +
        '</header>' +
        '<div class="letter-thread__messages" id="letter-messages">' + messagesHTML(item.messages, reader) + '</div>' +
        '<form class="letter-form" id="letter-form">' +
          '<label class="sr-only" for="letter-text">Письмо для ' + escapeHTML(reader.name) + '</label>' +
          '<textarea id="letter-text" maxlength="' + MAX_LENGTH + '" rows="2" placeholder="Напиши тихо и по делу…"></textarea>' +
          '<div class="letter-form__foot">' +
            '<span id="letter-hint">До ' + MAX_LENGTH + ' символов</span>' +
            '<button class="btn btn--primary btn--small" type="submit">Отправить</button>' +
          '</div>' +
        '</form>';
      var messages = $("#letter-messages");
      if (messages) messages.scrollTop = messages.scrollHeight;
    }

    function render() {
      var items = conversations();
      if (!items.some(function (item) { return item.slug === currentSlug; })) {
        currentSlug = items[0] ? items[0].slug : null;
      }
      renderSummary();
      renderList();
      renderThread();
    }

    function select(slug, scroll) {
      if (!conversations().some(function (item) { return item.slug === slug; })) return;
      currentSlug = slug;
      markRead(slug);
      try {
        var url = new URL(window.location.href);
        url.searchParams.set("reader", slug);
        history.replaceState(null, "", url);
      } catch (error) {}
      render();
      if (scroll) {
        var target = $("#letter-thread");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function bind() {
      list.addEventListener("click", function (event) {
        var button = event.target.closest("[data-letter]");
        if (!button) return;
        select(button.dataset.letter, true);
      });

      thread.addEventListener("submit", function (event) {
        if (event.target.id !== "letter-form") return;
        event.preventDefault();
        var input = $("#letter-text");
        if (!input || !currentSlug) return;
        if (!send(currentSlug, input.value)) {
          input.focus();
          return;
        }
        toast("Письмо отправлено.");
        render();
        var next = $("#letter-text");
        if (next) next.focus();
      });

      thread.addEventListener("input", function (event) {
        if (event.target.id !== "letter-text") return;
        var hint = $("#letter-hint");
        if (hint) hint.textContent = event.target.value.length + " / " + MAX_LENGTH;
      });

      thread.addEventListener("keydown", function (event) {
        if (event.target.id !== "letter-text") return;
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          var form = $("#letter-form");
          if (form) form.requestSubmit();
        }
      });

      if (readAll) {
        readAll.addEventListener("click", function () {
          if (markAllRead()) {
            toast("Все письма прочитаны.");
            render();
          }
        });
      }

      window.addEventListener("kuroha:letters-change", function () {
        render();
      });

      window.addEventListener("storage", function (event) {
        if (event.key === STORAGE_KEY || event.key === SEED_KEY) {
          render();
        }
      });
    }

    var params = new URLSearchParams(window.location.search);
    var requested = params.get("reader");
    var initial = conversations();
    currentSlug = initial.some(function (item) { return item.slug === requested; })
      ? requested
      : (initial[0] ? initial[0].slug : null);
    if (currentSlug) markRead(currentSlug);
    render();
    bind();
    if (currentSlug) {
      try {
        var url = new URL(window.location.href);
        url.searchParams.set("reader", currentSlug);
        history.replaceState(null, "", url);
      } catch (error) {}
    }
  }

  window.KurohaLetters = {
    KEY: STORAGE_KEY,
    SEED_KEY: SEED_KEY,
    read: read,
    forReader: forReader,
    send: send,
    markRead: markRead,
    markAllRead: markAllRead,
    unreadCount: unreadCount,
    total: total,
    clear: clear,
    markSeeded: markSeeded,
    relativeTime: relativeTime
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage);
  } else {
    initPage();
  }
})();

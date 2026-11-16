/* Kuroha — reader ratings and short reviews. */
(function () {
  "use strict";

  var STORAGE_KEY = "kuroha-ratings";
  var SEED_KEY = "kuroha-rating-seeded";
  var MAX_REVIEW = 700;

  var DEMO_REVIEWS = {
    "pepel-i-luna": [
      {
        id: "review-pepel-1",
        name: "Тихий читатель",
        score: 9,
        text: "Двенадцатая глава — тихая, но после неё долго не хочется закрывать вкладку. Куро здесь особенно хороша.",
        createdAt: "2026-11-15T23:40:00+03:00"
      },
      {
        id: "review-pepel-2",
        name: "Ая",
        score: 10,
        text: "История про письма и тех, кто остаётся между строк. Рисунок воздуха, а не событий — и это работает.",
        createdAt: "2026-11-14T18:20:00+03:00"
      },
      {
        id: "review-pepel-3",
        name: "Куро",
        score: 8,
        text: "Первые главы кажутся медленными, но к середине понимаешь, что темп — часть замысла.",
        createdAt: "2026-11-12T02:10:00+03:00"
      }
    ],
    "tihiy-okean": [
      {
        id: "review-okean-1",
        name: "Морской ветер",
        score: 9,
        text: "Про сестёр и дом у моря. Прочитал за вечер, а после неделю вспоминал отдельные фразы.",
        createdAt: "2026-11-13T21:05:00+03:00"
      },
      {
        id: "review-okean-2",
        name: "Нина",
        score: 8,
        text: "Очень тихая манга. Если ищешь экшен — не сюда, если ищешь воздух — точно сюда.",
        createdAt: "2026-11-10T16:45:00+03:00"
      }
    ],
    "pisma-k-severu": [
      {
        id: "review-pisma-1",
        name: "Ида",
        score: 9,
        text: "Новелла, в которой письма важнее событий. Красивый, ровный слог и очень бережная тишина.",
        createdAt: "2026-11-14T09:30:00+03:00"
      },
      {
        id: "review-pisma-2",
        name: "Северный гость",
        score: 8,
        text: "Финал не объясняет всё — и именно поэтому остаётся.",
        createdAt: "2026-11-08T23:15:00+03:00"
      }
    ],
    "kniga-zabytyh-imyon": [
      {
        id: "review-kniga-1",
        name: "Хранитель полки",
        score: 10,
        text: "Библиотека, которая помнит забытые имена. После этой истории хочется перечитать свою полку.",
        createdAt: "2026-11-11T19:00:00+03:00"
      }
    ],
    "komnata-dozhdya": [
      {
        id: "review-komnata-1",
        name: "Дождь",
        score: 9,
        text: "Дождь в комнате как метафора — звучит просто, но работает на каждой странице.",
        createdAt: "2026-11-09T14:10:00+03:00"
      }
    ]
  };

  function read() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return {};
    }
    if (!raw) return {};

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return {};
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    var clean = {};
    Object.keys(parsed).forEach(function (slug) {
      var entry = parsed[slug];
      var score = Math.round(Number(entry && entry.score));
      if (!slug || !Number.isFinite(score) || score < 1 || score > 10) return;
      clean[slug] = {
        score: score,
        text: String((entry && entry.text) || "").slice(0, MAX_REVIEW),
        createdAt: entry.createdAt || entry.updatedAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString()
      };
    });
    return clean;
  }

  function write(data, slug) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {}
    emit(slug || null);
  }

  function emit(slug) {
    try {
      window.dispatchEvent(
        new CustomEvent("kuroha:ratings-change", {
          detail: { slug: slug }
        })
      );
    } catch (error) {}
  }

  function get(slug) {
    var all = read();
    return all[slug] || null;
  }

  function set(slug, score, text) {
    var value = Math.round(Number(score));
    if (!slug || !Number.isFinite(value) || value < 1 || value > 10) return null;

    var all = read();
    var existing = all[slug];
    var now = new Date().toISOString();
    all[slug] = {
      score: value,
      text: String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_REVIEW),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    write(all, slug);
    markSeeded("user");
    return all[slug];
  }

  function remove(slug) {
    var all = read();
    if (!all[slug]) return false;
    delete all[slug];
    write(all, slug);
    markSeeded("user");
    return true;
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {}
    markSeeded("cleared");
    emit(null);
  }

  function markSeeded(value) {
    try {
      localStorage.setItem(SEED_KEY, value);
    } catch (error) {}
  }

  function allMine() {
    var all = read();
    return Object.keys(all).map(function (slug) {
      return {
        slug: slug,
        score: all[slug].score,
        text: all[slug].text,
        createdAt: all[slug].createdAt,
        updatedAt: all[slug].updatedAt
      };
    });
  }

  function countMine() {
    return allMine().length;
  }

  function reviewsFor(slug) {
    var reviews = (DEMO_REVIEWS[slug] || []).slice();
    var mine = get(slug);

    if (mine && mine.text) {
      reviews.unshift({
        id: "mine-" + slug,
        name: "Ты",
        score: mine.score,
        text: mine.text,
        createdAt: mine.updatedAt,
        mine: true
      });
    }

    return reviews.sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function reviewCount(slug) {
    return reviewsFor(slug).length;
  }

  function relativeTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "недавно";
    var diff = Date.now() - date.getTime();
    var minute = 60 * 1000;
    var hour = 60 * minute;
    var day = 24 * hour;

    if (diff < minute) return "только что";
    if (diff < hour) {
      var minutes = Math.floor(diff / minute);
      return minutes + " " + plural(minutes, ["минуту", "минуты", "минут"]) + " назад";
    }
    if (diff < day) {
      var hours = Math.floor(diff / hour);
      return hours + " " + plural(hours, ["час", "часа", "часов"]) + " назад";
    }
    if (diff < day * 2) return "вчера";
    if (diff < day * 7) {
      var days = Math.floor(diff / day);
      return days + " " + plural(days, ["день", "дня", "дней"]) + " назад";
    }

    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long"
    }).format(date);
  }

  function plural(number, forms) {
    var abs = Math.abs(number) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  window.KurohaRatings = {
    STORAGE_KEY: STORAGE_KEY,
    SEED_KEY: SEED_KEY,
    MAX_REVIEW: MAX_REVIEW,
    DEMO_REVIEWS: DEMO_REVIEWS,
    read: read,
    get: get,
    set: set,
    remove: remove,
    clear: clear,
    allMine: allMine,
    countMine: countMine,
    reviewsFor: reviewsFor,
    reviewCount: reviewCount,
    relativeTime: relativeTime
  };
})();

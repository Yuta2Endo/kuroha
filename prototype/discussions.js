/* Kuroha — локальные обсуждения под тайтлом и главами */
(function () {
  "use strict";

  var STORAGE_KEY = "kuroha-discussions";
  var SEED_KEY = "kuroha-discussions-seeded";
  var CHAPTER_STORAGE_KEY = "kuroha-chapter-discussions";
  var CHAPTER_SEED_KEY = "kuroha-chapter-discussions-seeded";
  var MAX_LENGTH = 500;
  var CHAPTER_MAX_LENGTH = 500;

  var DEMO = {
    "pepel-i-luna": [
      {
        id: "demo-1",
        name: "Тихий читатель",
        text: "Начал читать ночью и не заметил, как стало светло. Глава 12 особенно хороша.",
        mine: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString()
      },
      {
        id: "demo-2",
        name: "Ая",
        text: "Момент с письмом без адреса — то, за что я люблю эту историю. Тише, чем кажется.",
        mine: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
      },
      {
        id: "demo-3",
        name: "Куро",
        text: "Не ищи меня среди имён. Я всегда между строк.",
        mine: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString()
      }
    ]
  };

  var DEMO_CHAPTERS = {
    "pepel-i-luna:12": [
      {
        id: "chapter-demo-1",
        name: "Тихий читатель",
        text: "На этой главе я впервые закрыл вкладку и просто сидел в тишине. Письмо без адреса всё объясняет.",
        mine: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 22).toISOString()
      },
      {
        id: "chapter-demo-2",
        name: "Ая",
        text: "Куро на стопке томов — лучший момент главы. И дождь за окном будто настоящий.",
        mine: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: "chapter-demo-3",
        name: "Куро",
        text: "«Не ищи меня среди имён» — теперь эта фраза звучит иначе.",
        mine: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString()
      }
    ]
  };

  function readFrom(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeTo(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      /* localStorage может быть недоступен */
    }
  }

  function read() {
    return readFrom(STORAGE_KEY);
  }

  function write(data) {
    writeTo(STORAGE_KEY, data);
  }

  function readChapters() {
    return readFrom(CHAPTER_STORAGE_KEY);
  }

  function writeChapters(data) {
    writeTo(CHAPTER_STORAGE_KEY, data);
  }

  function emit(slug) {
    try {
      window.dispatchEvent(new CustomEvent("kuroha:discussions-change", { detail: { slug: slug } }));
    } catch (error) {
      /* no-op */
    }
  }

  function emitChapter(slug, chapter) {
    try {
      window.dispatchEvent(
        new CustomEvent("kuroha:chapter-discussions-change", {
          detail: { slug: slug, chapter: chapter }
        })
      );
    } catch (error) {
      /* no-op */
    }
  }

  function ensureSeed(slug) {
    try {
      if (localStorage.getItem(SEED_KEY)) return;
    } catch (error) {
      return;
    }

    var data = read();
    if (!data[slug] || !data[slug].length) {
      var demo = DEMO[slug];
      if (demo && demo.length) {
        data[slug] = demo.map(function (comment) {
          return Object.assign({}, comment);
        });
        write(data);
      }
    }

    try {
      localStorage.setItem(SEED_KEY, "demo");
    } catch (error) {
      /* no-op */
    }
  }

  function forTitle(slug) {
    ensureSeed(slug);
    var list = read()[slug];
    if (!Array.isArray(list)) return [];
    return list.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function count(slug) {
    return forTitle(slug).length;
  }

  function chapterKey(slug, chapter) {
    return String(slug) + ":" + String(chapter);
  }

  function ensureChapterSeed(slug, chapter) {
    try {
      if (localStorage.getItem(CHAPTER_SEED_KEY)) return;
    } catch (error) {
      return;
    }

    var data = readChapters();
    var changed = false;
    Object.keys(DEMO_CHAPTERS).forEach(function (key) {
      if (!Array.isArray(data[key]) || !data[key].length) {
        data[key] = DEMO_CHAPTERS[key].map(function (comment) {
          return Object.assign({}, comment);
        });
        changed = true;
      }
    });
    if (changed) writeChapters(data);

    try {
      localStorage.setItem(CHAPTER_SEED_KEY, "demo");
    } catch (error) {
      /* no-op */
    }
  }

  function forChapter(slug, chapter) {
    ensureChapterSeed(slug, chapter);
    var list = readChapters()[chapterKey(slug, chapter)];
    if (!Array.isArray(list)) return [];
    return list.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function countChapter(slug, chapter) {
    return forChapter(slug, chapter).length;
  }

  function allMine() {
    var entries = [];
    var data = read();

    Object.keys(data).forEach(function (slug) {
      if (!Array.isArray(data[slug])) return;
      data[slug].forEach(function (comment) {
        if (!comment.mine) return;
        entries.push({
          type: "title",
          slug: slug,
          chapter: null,
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt
        });
      });
    });

    var chapterData = readChapters();
    Object.keys(chapterData).forEach(function (key) {
      if (!Array.isArray(chapterData[key])) return;
      var parts = key.split(":");
      var chapter = Number(parts.pop());
      var slug = parts.join(":");
      chapterData[key].forEach(function (comment) {
        if (!comment.mine) return;
        entries.push({
          type: "chapter",
          slug: slug,
          chapter: chapter,
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt
        });
      });
    });

    return entries.sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function totalMine() {
    return allMine().length;
  }

  function add(slug, text, name) {
    var clean = String(text || "").trim().slice(0, MAX_LENGTH);
    if (!clean) return null;

    var data = read();
    if (!Array.isArray(data[slug])) data[slug] = [];

    var comment = {
      id: "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: String(name || "Ночной читатель").trim().slice(0, 40) || "Ночной читатель",
      text: clean,
      mine: true,
      createdAt: new Date().toISOString()
    };

    data[slug].unshift(comment);
    write(data);
    emit(slug);
    return comment;
  }

  function addChapter(slug, chapter, text, name) {
    var clean = String(text || "").trim().slice(0, CHAPTER_MAX_LENGTH);
    if (!clean) return null;

    var data = readChapters();
    var key = chapterKey(slug, chapter);
    if (!Array.isArray(data[key])) data[key] = [];

    var comment = {
      id: "cc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name: String(name || "Ночной читатель").trim().slice(0, 40) || "Ночной читатель",
      text: clean,
      mine: true,
      createdAt: new Date().toISOString()
    };

    data[key].unshift(comment);
    writeChapters(data);
    emitChapter(slug, chapter);
    return comment;
  }

  function remove(slug, id) {
    var data = read();
    if (!Array.isArray(data[slug])) return false;
    var before = data[slug].length;
    data[slug] = data[slug].filter(function (comment) {
      return !(comment.id === id && comment.mine);
    });
    if (data[slug].length === before) return false;
    write(data);
    emit(slug);
    return true;
  }

  function removeChapter(slug, chapter, id) {
    var data = readChapters();
    var key = chapterKey(slug, chapter);
    if (!Array.isArray(data[key])) return false;
    var before = data[key].length;
    data[key] = data[key].filter(function (comment) {
      return !(comment.id === id && comment.mine);
    });
    if (data[key].length === before) return false;
    writeChapters(data);
    emitChapter(slug, chapter);
    return true;
  }

  function clearChapters() {
    try {
      localStorage.removeItem(CHAPTER_STORAGE_KEY);
    } catch (error) {
      /* no-op */
    }
    emitChapter(null, null);
  }

  function clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CHAPTER_STORAGE_KEY);
      localStorage.setItem(SEED_KEY, "cleared");
      localStorage.setItem(CHAPTER_SEED_KEY, "cleared");
    } catch (error) {
      /* no-op */
    }
    emit(null);
    emitChapter(null, null);
  }

  function markSeeded(value) {
    try {
      localStorage.setItem(SEED_KEY, value || "cleared");
    } catch (error) {
      /* no-op */
    }
  }

  function markChapterSeeded(value) {
    try {
      localStorage.setItem(CHAPTER_SEED_KEY, value || "cleared");
    } catch (error) {
      /* no-op */
    }
  }

  function relativeTime(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    var diff = Date.now() - date.getTime();
    if (diff < 60 * 1000) return "только что";
    var minutes = Math.floor(diff / (60 * 1000));
    if (minutes < 60) return minutes + " " + plural(minutes, "минуту", "минуты", "минут") + " назад";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " " + plural(hours, "час", "часа", "часов") + " назад";
    var days = Math.floor(hours / 24);
    if (days === 1) return "вчера";
    if (days < 7) return days + " " + plural(days, "день", "дня", "дней") + " назад";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }

  function plural(number, one, few, many) {
    var abs = Math.abs(number) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
  }

  window.KurohaDiscussions = {
    STORAGE_KEY: STORAGE_KEY,
    SEED_KEY: SEED_KEY,
    CHAPTER_STORAGE_KEY: CHAPTER_STORAGE_KEY,
    CHAPTER_SEED_KEY: CHAPTER_SEED_KEY,
    MAX_LENGTH: MAX_LENGTH,
    CHAPTER_MAX_LENGTH: CHAPTER_MAX_LENGTH,
    read: read,
    ensureSeed: ensureSeed,
    forTitle: forTitle,
    count: count,
    allMine: allMine,
    totalMine: totalMine,
    add: add,
    remove: remove,
    chapterKey: chapterKey,
    ensureChapterSeed: ensureChapterSeed,
    forChapter: forChapter,
    countChapter: countChapter,
    addChapter: addChapter,
    removeChapter: removeChapter,
    clearChapters: clearChapters,
    clearAll: clearAll,
    markSeeded: markSeeded,
    markChapterSeeded: markChapterSeeded,
    relativeTime: relativeTime
  };
})();

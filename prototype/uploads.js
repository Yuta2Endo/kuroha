/* Kuroha prototype — local chapter uploads shared by admin, title and reader. */
(function () {
  "use strict";

  const STORAGE_KEY = "kuroha-admin-uploads";

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 80)));
    } catch (error) {}
  }

  function add(record) {
    const list = read().filter(function (entry) {
      return !(entry.slug === record.slug && Number(entry.chapter) === Number(record.chapter));
    });
    const entry = {
      id: "up-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      status: "published",
      pages: Number(record.pages) || 1,
      chapter: Number(record.chapter) || 1,
      chapterName: String(record.chapterName || "").trim(),
      slug: String(record.slug || ""),
      title: String(record.title || ""),
      files: Array.isArray(record.files) ? record.files.slice(0, 80) : []
    };
    list.unshift(entry);
    write(list);
    return entry;
  }

  function remove(id) {
    const list = read().filter(function (entry) {
      return entry.id !== id;
    });
    write(list);
    return list;
  }

  function forTitle(slug) {
    return read()
      .filter(function (entry) {
        return entry.slug === slug;
      })
      .sort(function (a, b) {
        return Number(a.chapter) - Number(b.chapter);
      });
  }

  function maxChapter(slug) {
    return forTitle(slug).reduce(function (max, entry) {
      return Math.max(max, Number(entry.chapter) || 0);
    }, 0);
  }

  function totalFor(slug, base) {
    return Math.max(Number(base) || 0, maxChapter(slug));
  }

  function latest(limit) {
    return read().slice(0, limit || 8);
  }

  function stats() {
    const list = read();
    return {
      uploads: list.length,
      titles: new Set(list.map(function (entry) { return entry.slug; })).size,
      pages: list.reduce(function (sum, entry) { return sum + (Number(entry.pages) || 0); }, 0)
    };
  }

  window.KurohaUploads = {
    read: read,
    add: add,
    remove: remove,
    forTitle: forTitle,
    maxChapter: maxChapter,
    totalFor: totalFor,
    latest: latest,
    stats: stats
  };
})();

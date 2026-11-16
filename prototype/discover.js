/* Kuroha prototype — genre and collection pages. */
(function () {
  "use strict";

  var titles = Array.isArray(window.KUROHA_TITLES) ? window.KUROHA_TITLES : [];
  var genres = Array.isArray(window.KUROHA_GENRES) ? window.KUROHA_GENRES : [];
  var collections = Array.isArray(window.KUROHA_COLLECTIONS) ? window.KUROHA_COLLECTIONS : [];
  var cards = window.KurohaCards;

  if (!titles.length || !genres.length || !cards) return;

  var $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };
  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  var TYPE_LABELS = {
    manga: "манга",
    manhwa: "манхва",
    manhua: "маньхуа",
    novel: "новелла"
  };

  var TYPE_FORMS = {
    manga: ["манга", "манги", "манг"],
    manhwa: ["манхва", "манхвы", "манхв"],
    manhua: ["маньхуа", "маньхуа", "маньхуа"],
    novel: ["новелла", "новеллы", "новелл"]
  };

  var STATUS_LABELS = {
    ongoing: "онгоинг",
    completed: "завершён",
    frozen: "заморожен"
  };

  var bySlug = {};
  titles.forEach(function (item) {
    bySlug[item.slug] = item;
  });

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function plural(number, forms) {
    var absolute = Math.abs(number) % 100;
    var last = absolute % 10;
    if (absolute > 10 && absolute < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function setText(selector, value) {
    var element = $(selector);
    if (element) element.textContent = value;
  }

  function setMeta(description) {
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
  }

  function sortedByPopularity(items) {
    return items.slice().sort(function (a, b) {
      return b.popularity - a.popularity;
    });
  }

  function itemsForGenre(slug) {
    return sortedByPopularity(
      titles.filter(function (item) {
        return item.genres.indexOf(slug) !== -1;
      })
    );
  }

  function collectionItems(collection) {
    return collection.titleSlugs
      .map(function (slug) {
        return bySlug[slug];
      })
      .filter(Boolean);
  }

  function coverStack(items, limit) {
    return items
      .slice(0, limit || 3)
      .map(function (item) {
        return cards.miniCoverHTML(item);
      })
      .join("");
  }

  function typeBreakdown(items) {
    var counts = { manga: 0, manhwa: 0, manhua: 0, novel: 0 };
    items.forEach(function (item) {
      if (counts[item.type] === undefined) counts[item.type] = 0;
      counts[item.type] += 1;
    });
    return counts;
  }

  function genreMeta(items) {
    var counts = typeBreakdown(items);
    var parts = [];
    Object.keys(TYPE_LABELS).forEach(function (type) {
      if (counts[type]) parts.push(counts[type] + " " + plural(counts[type], TYPE_FORMS[type]));
    });
    return parts.join(" · ");
  }

  function statusLine(items) {
    var ongoing = items.filter(function (item) {
      return item.status === "ongoing";
    }).length;
    var completed = items.filter(function (item) {
      return item.status === "completed";
    }).length;
    var frozen = items.filter(function (item) {
      return item.status === "frozen";
    }).length;
    var parts = [ongoing + " " + plural(ongoing, ["онгоинг", "онгоинга", "онгоингов"])];
    if (completed) parts.push(completed + " " + plural(completed, ["завершён", "завершено", "завершено"]));
    if (frozen) parts.push(frozen + " " + plural(frozen, ["заморожен", "заморожено", "заморожено"]));
    return parts.join(" · ");
  }

  function renderGenreHub() {
    var list = $("#genre-list");
    if (!list) return;

    setText("#genre-total", String(genres.length));
    setText("#title-total", String(titles.length));
    setText("#format-total", String(Object.keys(TYPE_LABELS).length));

    list.innerHTML = genres
      .map(function (genre) {
        var items = itemsForGenre(genre.slug);
        var meta = items.length + " " + plural(items.length, ["история", "истории", "историй"]);
        return [
          '<a class="genre-row" href="genre.html?genre=' + encodeURIComponent(genre.slug) + '"',
          ' style="--genre-accent:' + escapeHTML(genre.accent) + '">',
          '<span class="genre-row__swatch" aria-hidden="true"></span>',
          '<span class="genre-row__body">',
          '<span class="genre-row__name">' + escapeHTML(genre.title) + "</span>",
          '<span class="genre-row__desc">' + escapeHTML(genre.description) + "</span>",
          '<span class="genre-row__meta">' + meta + " · " + genreMeta(items) + "</span>",
          "</span>",
          '<span class="genre-row__covers" aria-hidden="true">' + coverStack(items, 3) + "</span>",
          '<span class="genre-row__open">смотреть</span>',
          "</a>"
        ].join("");
      })
      .join("");
  }

  function renderGenre() {
    var hero = $("#genre-hero");
    if (!hero) return;

    var requested = new URLSearchParams(window.location.search).get("genre");
    var genre =
      genres.find(function (item) {
        return item.slug === requested;
      }) || genres[0];
    var items = itemsForGenre(genre.slug);
    var count = items.length;

    hero.style.setProperty("--genre-accent", genre.accent);
    document.title = genre.title + " — Kuroha";
    setMeta(genre.title + " в библиотеке Kuroha: " + genre.description);

    setText("#genre-kicker", genre.kicker);
    setText("#genre-name", genre.title);
    setText("#genre-lead", genre.description);
    setText("#genre-count", String(count));
    setText("#genre-count-label", plural(count, ["история", "истории", "историй"]));
    setText("#genre-types", genreMeta(items));
    setText("#genre-status", statusLine(items));
    setText("#genre-breadcrumb", genre.title);
    setText("#genre-stack-label", genre.title);
    setText("#genre-stack-count", count + " " + plural(count, ["история", "истории", "историй"]));

    var stack = $("#genre-stack");
    if (stack) stack.innerHTML = coverStack(items, 3);

    var grid = $("#genre-grid");
    if (grid) grid.innerHTML = items.map(cards.cardHTML).join("");

    var catalogLink = $("#genre-catalog-link");
    if (catalogLink) catalogLink.href = "catalog.html?genre=" + encodeURIComponent(genre.slug);

    var related = $("#genre-related");
    if (related) {
      related.innerHTML = genres
        .filter(function (candidate) {
          return candidate.slug !== genre.slug;
        })
        .slice(0, 7)
        .map(function (candidate) {
          return (
            '<a class="chip" href="genre.html?genre=' +
            encodeURIComponent(candidate.slug) +
            '">' +
            escapeHTML(candidate.title) +
            "</a>"
          );
        })
        .join("");
    }

    var collectionsWrap = $("#genre-collections");
    var collectionsSection = $("#genre-collections-section");
    if (collectionsWrap) {
      var matched = collections
        .map(function (collection) {
          var collectionGenreItems = collectionItems(collection).filter(function (item) {
            return item.genres.indexOf(genre.slug) !== -1;
          });
          return { collection: collection, count: collectionGenreItems.length };
        })
        .filter(function (entry) {
          return entry.count > 0;
        })
        .sort(function (a, b) {
          return b.count - a.count;
        })
        .slice(0, 4);

      if (!matched.length && collectionsSection) {
        collectionsSection.hidden = true;
      } else {
        collectionsWrap.innerHTML = matched
          .map(function (entry) {
            return [
              '<a class="related-collection" href="collection.html?slug=' + encodeURIComponent(entry.collection.slug) + '">',
              "<b>" + escapeHTML(entry.collection.title) + "</b>",
              "<span>" + entry.count + " " + plural(entry.count, ["история", "истории", "историй"]) + "</span>",
              "</a>"
            ].join("");
          })
          .join("");
      }
    }
  }

  function renderCollections() {
    var grid = $("#collections-grid");
    if (!grid) return;

    var unique = {};
    collections.forEach(function (collection) {
      collectionItems(collection).forEach(function (item) {
        unique[item.slug] = true;
      });
    });

    setText("#collection-total", String(collections.length));
    setText("#collection-title-total", String(Object.keys(unique).length));

    grid.innerHTML = collections
      .map(function (collection) {
        var items = collectionItems(collection);
        return [
          '<a class="curated-card" href="collection.html?slug=' + encodeURIComponent(collection.slug) + '">',
          '<span class="curated-card__covers" aria-hidden="true">' + coverStack(items, 3) + "</span>",
          '<span class="curated-card__body">',
          '<span class="eyebrow">' + escapeHTML(collection.label) + "</span>",
          "<h2>" + escapeHTML(collection.title) + "</h2>",
          '<span class="curated-card__desc">' + escapeHTML(collection.description) + "</span>",
          '<span class="curated-card__foot"><span>' + items.length + " " + plural(items.length, ["история", "истории", "историй"]) + "</span>",
          "<span>куратор: " + escapeHTML(collection.curator) + "</span></span>",
          "</span>",
          "</a>"
        ].join("");
      })
      .join("");
  }

  function renderCollection() {
    var hero = $("#collection-hero");
    if (!hero) return;

    var requested = new URLSearchParams(window.location.search).get("slug");
    var collection =
      collections.find(function (item) {
        return item.slug === requested;
      }) || collections[0];
    var items = collectionItems(collection);

    hero.style.setProperty("--collection-accent", collection.accent);
    document.title = collection.title + " — Kuroha";
    setMeta(collection.title + " — собрание Kuroha. " + collection.description);

    setText("#collection-label", collection.label);
    setText("#collection-name", collection.title);
    setText("#collection-lead", collection.description);
    setText("#collection-count", String(items.length));
    setText("#collection-count-label", plural(items.length, ["история", "истории", "историй"]));
    setText("#collection-breadcrumb", collection.title);
    setText("#collection-note-text", collection.note);
    setText("#collection-curator", collection.curator);
    setText("#collection-stack-label", collection.title);
    setText("#collection-stack-count", items.length + " " + plural(items.length, ["история", "истории", "историй"]));

    var stack = $("#collection-stack");
    if (stack) stack.innerHTML = coverStack(items, 3);

    var grid = $("#collection-grid");
    if (grid) grid.innerHTML = items.map(cards.cardHTML).join("");

    var other = $("#other-collections");
    if (other) {
      other.innerHTML = collections
        .filter(function (item) {
          return item.slug !== collection.slug;
        })
        .slice(0, 3)
        .map(function (item) {
          var count = collectionItems(item).length;
          return [
            '<a href="collection.html?slug=' + encodeURIComponent(item.slug) + '">',
            "<b>" + escapeHTML(item.title) + "</b>",
            "<span>" + count + " " + plural(count, ["история", "истории", "историй"]) + "</span>",
            "</a>"
          ].join("");
        })
        .join("");
    }
  }

  function boot() {
    renderGenreHub();
    renderGenre();
    renderCollections();
    renderCollection();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* Keep the last opened collection visible in the footer link on small screens. */
  $$('a[href="#genre-list"]').forEach(function (link) {
    link.addEventListener("click", function () {
      var target = $("#genre-list");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();

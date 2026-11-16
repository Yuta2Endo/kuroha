const CACHE_NAME = "kuroha-v82";
const OFFLINE_URL = "./offline.html";

const PRECACHE_URLS = [
  "./index.html",
  "./catalog.html",
  "./title.html",
  "./reader.html",
  "./profile.html",
  "./feed.html",
  "./schedule.html",
  "./top.html",
  "./notes.html",
  "./quotes.html",
  "./bingo.html",
  "./evening.html",
  "./taste.html",
  "./about.html",
  "./rules.html",
  "./404.html",
  "./public-lists.html",
  "./backup.html",
  "./auth.html",
  "./cloud.html",
  "./year.html",
  "./recommendations.html",
  "./lists.html",
  "./notifications.html",
  "./teams.html",
  "./clubs.html",
  "./readers.html",
  "./letters.html",
  "./novels.html",
  "./genres.html",
  "./genre.html",
  "./collections.html",
  "./collection.html",
  "./admin.html",
  "./offline.html",
  "./tokens.css",
  "./styles.css",
  "./detail.css",
  "./listen.css",
  "./pages.css",
  "./age-gate.css",
  "./reports.css",
  "./ambience.css",
  "./profile.css",
  "./goal.css",
  "./profile-card.css",
  "./feed.css",
  "./top.css",
  "./notes.css",
  "./quotes.css",
  "./bingo.css",
  "./evening.css",
  "./taste.css",
  "./service.css",
  "./public-lists.css",
  "./backup.css",
  "./auth.css",
  "./cloud.css",
  "./postcards.css",
  "./ratings.css",
  "./novels.css",
  "./year.css",
  "./recommendations.css",
  "./lists.css",
  "./notifications.css",
  "./teams.css",
  "./clubs.css",
  "./readers.css",
  "./letters.css",
  "./schedule.css",
  "./discover.css",
  "./admin.css",
  "./data.js",
  "./search-data.js",
  "./discover-data.js",
  "./app.js",
  "./home.js",
  "./detail.js",
  "./listen.js",
  "./pages.js",
  "./age-gate.js",
  "./reports.js",
  "./ambience.js",
  "./profile.js",
  "./goal.js",
  "./profile-edit.js",
  "./profile-card.js",
  "./library.js",
  "./discussions.js",
  "./feed.js",
  "./top.js",
  "./notes.js",
  "./postcards.js",
  "./ratings.js",
  "./novels.js",
  "./year.js",
  "./recommendations.js",
  "./lists.js",
  "./notifications.js",
  "./teams-data.js",
  "./teams.js",
  "./clubs-data.js",
  "./clubs.js",
  "./readers-data.js",
  "./readers.js",
  "./quotes-data.js",
  "./quotes.js",
  "./bingo.js",
  "./evening.js",
  "./taste.js",
  "./public-lists-data.js",
  "./public-lists.js",
  "./backup.js",
  "./auth.js",
  "./cloud.js",
  "./letters.js",
  "./schedule.js",
  "./uploads.js",
  "./admin.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./assets/favicon.svg",
  "./assets/logo-symbol.svg",
  "./assets/logo-symbol-ink.svg",
  "./assets/logo-symbol-mono.svg",
  "./assets/social-avatar.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/og-image.png"
];
const PRECACHE = PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});


/*
 * Questly service worker: makes the installed app open instantly and show its shell
 * when the network is flaky. It never touches API calls, so data is always live.
 *
 *  - Pages (navigations): network first; if offline, fall back to the cached app shell.
 *  - Static files (/assets, /icons, fonts, images): cache first (they are content-hashed).
 *  - Everything else, and anything under /api: straight to the network.
 */
const VERSION = "v3";
const SHELL_CACHE = `questly-shell-${VERSION}`;
const ASSET_CACHE = `questly-assets-${VERSION}`;
// The app lives under a sub-path (/QuestlyTaskApp/), so everything is relative to the worker's scope.
const BASE = self.registration.scope;
const PRECACHE = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon-192.png`, `${BASE}icons/icon-512.png`, `${BASE}icon-q.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === new URL("sw.js", BASE).pathname) return;

  // App pages: always try the network so users get new deploys, fall back to the shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(BASE, copy));
          }
          return res;
        })
        .catch(() => caches.match(BASE).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Hashed build files, icons, fonts, images: cache first.
  if (/\/(assets|icons)\//.test(url.pathname) || /\.(woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

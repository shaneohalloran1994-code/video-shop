// Offline shell + poster cache. Bump VERSION on every release.
const VERSION = "take-one-r-2";
const SHELL = ["./", "index.html", "css/app.css", "js/app.js", "js/store.js", "js/tmdb.js", "js/importer.js", "js/library.js", "js/sound.js", "js/rasher.js", "js/lines.js", "js/quotes.js", "js/friends.js", "js/builder.js", "js/where.js", "js/arcade.js", "js/coming.js", "js/config.js", "js/card.js", "js/shelf.js", "vendor/jszip.min.js", "manifest.webmanifest",
  "fonts/marcellus-latin-400-normal.woff2", "fonts/monoton-latin-400-normal.woff2", "fonts/permanent-marker-latin-400-normal.woff2", "fonts/vt323-latin-400-normal.woff2",
  "fonts/courier-prime-latin-400-normal.woff2", "fonts/courier-prime-latin-700-normal.woff2", "fonts/barlow-latin-400-normal.woff2", "fonts/barlow-latin-500-normal.woff2",
  "fonts/barlow-latin-600-normal.woff2", "fonts/barlow-condensed-latin-600-normal.woff2", "fonts/barlow-condensed-latin-800-normal.woff2", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== "posters").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.hostname === "image.tmdb.org") {
    e.respondWith(caches.open("posters").then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (u.origin !== location.origin) return;
  // App files: network first so updates land, cache when offline.
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});

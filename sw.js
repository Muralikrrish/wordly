/* Wordly web — offline support. The app itself (page, script, styles, fonts,
   search index) is stored on the first visit; each definition file is stored
   the first time a word in it is opened, so words already read open offline.
   Bump APP when the page's own files change, so phones pick up the new ones. */
const APP = "wordly-app-6";
const DATA = "wordly-data";
const SHELL = [
  "./", "index.html", "style.css", "home.css", "word.css", "search.css", "lists.css", "quiz.css", "icons.js", "motion.js", "app.js", "word.js", "search.js", "lists.js", "quiz.js", "manifest.webmanifest", "icon-512.png",
  "data/index.json", "data/collections.json", "data/extras.json",
  "fonts/outfit_regular.ttf", "fonts/outfit_semibold.ttf", "fonts/outfit_bold.ttf",
  "fonts/inter_regular.ttf", "fonts/inter_medium.ttf", "fonts/inter_semibold.ttf", "fonts/inter_italic.ttf",
  "fonts/literata_regular.ttf", "fonts/literata_italic.ttf", "fonts/literata_semibold.ttf", "fonts/literata_bold.ttf",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k !== APP && k !== DATA).map((k) => caches.delete(k)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Definitions: from the phone if read before, else fetched and kept.
  if (url.pathname.includes("/data/defs/")) {
    e.respondWith(caches.open(DATA).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // Everything else: the network when online — always checking with the
  // server, never a stale browser copy, so updates show at once — else the copy kept.
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((res) => {
    if (res.ok) caches.open(APP).then((c) => c.put(e.request, res.clone()));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

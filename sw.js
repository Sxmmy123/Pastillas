const CACHE = "pastillas-shell-364d2eaa0dab";
const SHELL = ["./","./apple-touch-icon.png","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icon.svg","./manifest.webmanifest","./assets/firebase-CSXLdRJO.js","./assets/index-CqzalLv2.js","./assets/index-DUn-MBCs.css","./assets/index.esm-CTjUmntZ.js","./assets/index.esm-DzJYQOOt.js","./assets/index.esm-ZtiLxdjX.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("pastillas-shell-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const r = e.request,
    u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(r, res.clone()));
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }
  e.respondWith(
    caches.match(r).then(
      (hit) =>
        hit ||
        fetch(r).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(r, res.clone()));
          return res;
        }),
    ),
  );
});

const CACHE = "pastillas-shell-664e8b22b2ba";
const SHELL = ["./","./manifest.webmanifest","./icon.svg","./assets/firebase-CSXLdRJO.js","./assets/index-B8clensv.css","./assets/index-DtMHeSWD.js","./assets/index.esm-CTjUmntZ.js","./assets/index.esm-DzJYQOOt.js","./assets/index.esm-ZtiLxdjX.js"];
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

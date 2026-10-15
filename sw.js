const CACHE = "pastillas-shell-24573bc6118a";
const SHELL = ["./","./LICENCIA-FUENTES.txt","./apple-touch-icon.png","./configurar-firebase.html","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./icon.svg","./manifest.webmanifest","./reglas-firebase.txt","./assets/Atkinson-Bold-DND0wAMM.ttf","./assets/Atkinson-Regular-ycu_OfBo.ttf","./assets/firebase-CSXLdRJO.js","./assets/html2canvas-LgPHJRwO.js","./assets/index-BfBXVu6L.css","./assets/index-d8KWnu0K.js","./assets/index.es-BrtmwX0E.js","./assets/index.esm-CTjUmntZ.js","./assets/index.esm-DzJYQOOt.js","./assets/index.esm-ZtiLxdjX.js","./assets/purify.es-BZxk_wWO.js","./assets/reportFonts-COI-YSfZ.js","./assets/reportPdf-wcsGWK4I.js"];
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

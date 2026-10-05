/* MC ORCA GAMES — Service Worker für RESONA
   Ziel: Offline-Start. Alle Spieldateien werden vorab gecacht, Three.js liegt lokal in vendor/.
   Strategie: vendor/ = Cache zuerst (ändert sich nie), alles andere = Netz zuerst mit Cache-Rückfall.
   Dateien, die hier fehlen, werden trotzdem beim ersten Online-Abruf nachgecacht.
   WICHTIG: Bei neuen/entfernten Dateien ASSETS ergänzen und CACHE hochzählen. */
const CACHE = "orca-resona-v4";
const ASSETS = [
  "./",
  "./game.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./vendor/three.module.min.js",
  "./js/main.js",
  "./js/config.js",
  "./js/core/Engine.js",
  "./js/core/env.js",
  "./js/core/rng.js",
  "./js/creature/Behavior.js",
  "./js/creature/CreatureModel.js",
  "./js/creature/IdleBehavior.js",
  "./js/creature/Locomotion.js",
  "./js/world/Atmosphere.js",
  "./js/world/Backdrop.js",
  "./js/world/CameraRig.js",
  "./js/world/Habitat.js",
  "./js/world/Lighting.js"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((url) => c.add(url)))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes("/vendor/")) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || (e.request.mode === "navigate" ? caches.match("./game.html") : undefined)))
  );
});

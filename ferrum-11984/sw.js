/* MC ORCA GAMES — Service Worker fuer FERRUM-11984
   Erlaubt Installation als eigenstaendige App-Kachel und cached die
   Spielseite fuer den Offline-/Schnellstart. Bewusst minimal gehalten:
   nur die Spielseite selbst + Manifest + Icons, keine Audio-/Asset-Flut.

   v38 — Fix "ServiceWorker fing die Anfrage ab und es kam zu einem unerwarteten Fehler":
   Der Server leitet game.html per 307 auf /game um. Eine Weiterleitung darf bei Navigationen
   nicht als "redirected"-Response aus dem Service Worker zurueckgegeben werden, und der alte
   Fallback konnte respondWith(undefined) liefern. Jetzt: Navigationen folgen der Weiterleitung
   selbst und liefern eine saubere Kopie; jeder Fehlerpfad endet in einer gueltigen Response. */
const CACHE = "orca-ferrum11984-v78";
const ASSETS = ["./", "./game.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./art/logo.png", "./shiprules.js", "./art/sky/ferrum_home.jpg", "./art/sky/ferrum_home_2k.jpg", "./schiffsbauer/schiffsbauer.html", "./art/asteroids/ore_asteroids.json"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Weitergeleitete Responses in eine saubere Kopie umwandeln (sonst lehnt der Browser sie bei Navigationen ab).
async function clean(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function handle(req) {
  try {
    const res = req.mode === "navigate"
      ? await fetch(req.url, { credentials: "same-origin", redirect: "follow" })
      : await fetch(req);
    const out = await clean(res);
    if (out.ok && out.type === "basic") {
      const copy = out.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return out;
  } catch (err) {
    const hit = (await caches.match(req)) || (req.mode === "navigate" ? await caches.match("./game.html") : undefined);
    return hit || new Response("Offline", { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf("/art/music/") !== -1 || url.pathname.indexOf("/art/voice/") !== -1) return; // Audio (Range-Requests, grosse Dateien, optionale 404er) direkt ans Netz
  if (req.headers.has("range")) return;
  e.respondWith(handle(req));
});

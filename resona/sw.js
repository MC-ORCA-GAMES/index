/* MC ORCA GAMES — Service Worker für RESONA
   Ziel: Offline-Start. Alle Spieldateien werden vorab gecacht, Three.js liegt lokal in vendor/.
   Strategie: vendor/ = Cache zuerst (ändert sich nie), alles andere = Netz zuerst mit Cache-Rückfall.
   Dateien, die hier fehlen, werden trotzdem beim ersten Online-Abruf nachgecacht.
   WICHTIG: Bei neuen/entfernten Dateien ASSETS ergänzen und CACHE hochzählen. */
const CACHE = "orca-resona-v37";
const ASSETS = [
  "./",
  "./game.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./vendor/three.module.min.js",
  "./js/audio/Sfx.js",
  "./js/main.js",
  "./js/config.js",
  "./js/core/Engine.js",
  "./js/core/env.js",
  "./js/core/rng.js",
  "./js/creature/Behavior.js",
  "./js/creature/Cleaning.js",
  "./js/creature/CreatureModel.js",
  "./js/creature/EmotionExpression.js",
  "./js/creature/Feeding.js",
  "./js/creature/Gaming.js",
  "./js/creature/Growth.js",
  "./js/creature/FormLook.js",
  "./js/creature/ColorLook.js",
  "./js/creature/FormParts.js",
  "./js/creature/FormBehavior.js",
  "./js/creature/Training.js",
  "./js/creature/IdleBehavior.js",
  "./js/creature/Interaction.js",
  "./js/creature/Locomotion.js",
  "./js/creature/Playing.js",
  "./js/creature/Sleeping.js",
  "./js/data/bond.js",
  "./js/data/emotions.js",
  "./js/data/evolution.js",
  "./js/data/foods.js",
  "./js/data/health.js",
  "./js/data/hygiene.js",
  "./js/data/learning.js",
  "./js/data/lifecycle.js",
  "./js/data/minigames.js",
  "./js/data/training.js",
  "./js/data/needs.js",
  "./js/data/personality.js",
  "./js/data/habitat.js",
  "./js/data/hiddenTraits.js",
  "./js/data/colors.js",
  "./js/data/sleep.js",
  "./js/data/toys.js",
  "./js/systems/BondSystem.js",
  "./js/systems/EmotionSystem.js",
  "./js/systems/EvolutionSystem.js",
  "./js/systems/FoodSystem.js",
  "./js/systems/HealthSystem.js",
  "./js/systems/HygieneSystem.js",
  "./js/systems/LearningSystem.js",
  "./js/systems/LifecycleSystem.js",
  "./js/systems/MemoryGameSystem.js",
  "./js/systems/NeedSystem.js",
  "./js/systems/PersonalitySystem.js",
  "./js/systems/HiddenTraitSystem.js",
  "./js/systems/ColorSystem.js",
  "./js/systems/ReactionGameSystem.js",
  "./js/systems/SkillGameSystem.js",
  "./js/systems/TrainingSystem.js",
  "./js/systems/SleepSystem.js",
  "./js/systems/ToySystem.js",
  "./js/ui/FeedPanel.js",
  "./js/ui/GamePanel.js",
  "./js/ui/HealthNotice.js",
  "./js/ui/HygienePanel.js",
  "./js/ui/LifecycleNotice.js",
  "./js/ui/MemoryView.js",
  "./js/ui/NeedsPanel.js",
  "./js/ui/ReactionView.js",
  "./js/ui/RoomPicker.js",
  "./js/ui/SkillView.js",
  "./js/ui/TrainingPanel.js",
  "./js/ui/SleepPanel.js",
  "./js/ui/ToyPanel.js",
  "./js/world/Atmosphere.js",
  "./js/world/Backdrop.js",
  "./js/world/CameraRig.js",
  "./js/world/EggModel.js",
  "./js/world/Habitat.js",
  "./js/world/Furnishing.js",
  "./js/world/Navigation.js",
  "./js/world/RoomFocus.js",
  "./js/world/Lighting.js",
  "./js/world/SparkField.js",
  "./js/world/ToyModels.js"
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

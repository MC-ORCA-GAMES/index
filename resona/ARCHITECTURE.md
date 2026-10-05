# ARCHITECTURE – RESONA

Stand: 2026-10-03 · Phase 07. Beschreibt, was im Code **tatsächlich existiert**. Geplante Module stehen getrennt unten.

## Grundprinzipien
- Reines HTML/CSS/JavaScript, **ES-Module**, kein Build-Schritt, kein Framework.
- **Three.js 0.160.0 liegt lokal** in `resona/vendor/three.module.min.js` (MIT-Lizenz in `vendor/THREE_LICENSE.txt`). Grund: Offline-Start ohne CDN. Eingebunden über `importmap` in `game.html` (`"three": "./vendor/three.module.min.js"`). Hub-Spiele nutzen sonst CDN. Das ist eine bewusste Abweichung.
- Modulare Dateien statt Einzeldatei (vom Nutzer bestätigt).
- Läuft **nur über einen Webserver**, nicht per Doppelklick (`file://`), weil Browser Module von `file://` blockieren. `game.html` zeigt dann eine Hinweismeldung.
- Kein Backend, keine externen Dienste im Kern.

## Dateien (resona/)
| Datei | Aufgabe |
|---|---|
| `game.html` | Einstieg: Viewport, Importmap, Ladeanzeige `#boot`, Fehleranzeige `#fatal`, Wächter-Skript, lädt `js/main.js`, `../assets/pwa-install.js`, `/assets/js/update-watch.js` |
| `manifest.json`, `sw.js`, `icon*.png/svg` | PWA. SW: `vendor/` Cache zuerst, Rest Netz zuerst. **Neue Dateien in `ASSETS` eintragen und `CACHE` hochzählen.** |
| `js/main.js` | Startet alles, hängt Module an die Engine. Updater-Reihenfolge der Kreatur: `idle` -> `behavior` + `locomotion` (wichtig, siehe Konventionen) |
| `js/config.js` | **Alle Startwerte** (Farben, Kamera, Habitat, Zonen, Partikelzahlen, Save-Präfix) |
| `js/core/Engine.js` | Renderer, Szene, Kamera, Hauptschleife, Resize, Pause bei verstecktem Tab, WebGL-Context-Lost, `dispose()` |
| `js/core/env.js` | `prefersReducedMotion()` |
| `js/core/rng.js` | `createRng(seed)` (mulberry32), später für Genetik |
| `js/creature/IdleBehavior.js` | Idle-Leben (Phase 06): `createIdleBehavior(creature, { seed })` -> `{ update(dt, elapsed), lookAt(point|null), triggerGesture(name), setGesturesEnabled(bool) }`. Animiert nur die Pivots aus `parts`, rein prozedural |
| `js/creature/Locomotion.js` | Körperliche Bewegung (Phase 07): `createLocomotion(creature)` -> `{ update(dt), moveTo(point, onDone?), turnTo(point, onDone?), stop(), isBusy(), isMoving(), getBoundsRadius(), clampToBounds(point) }`. Bewegt `creature.group` (x/z, Drehung y), Gehanimation (Trab) addiert auf Idle |
| `js/creature/Behavior.js` | Verhaltenssystem (Phase 07): `createBehavior({ creature, idle, locomotion, habitat, getObserveTarget, seed })` -> `{ update(dt), getState(), onStateChange(fn), goTo, goToZone, observe, interrupt, setAutonomous }`. Zustände `IDLE`, `EXPLORE`, `INVESTIGATE`, `OBSERVE` (Export `STATES`) |
| `js/creature/CreatureModel.js` | 3D-Körper der Kreatur „Reson" (Phase 05): `createCreatureModel(appearance)` -> `{ group, parts, appearance, dispose() }`. Nur Aufbau aus Primitiven, keine Animation |
| `js/world/CameraRig.js` | Kamera um das Habitat (Phase 04): Orbit per Ziehen, Pinch-/Mausrad-Zoom, Pfeiltasten und +/-, Doppelklick bzw. R = Reset, Begrenzung von Polarwinkel und Abstand, sanfter Nachlauf, `fit(aspect)` rahmt das Habitat in Hoch- und Querformat ein, `onTap(fn)` meldet kurzes Tippen |
| `js/world/Lighting.js` | Hemisphären-, Key- und Kernlicht |
| `js/world/Backdrop.js` | Verlaufskuppel + Sterne |
| `js/world/Atmosphere.js` | Schwebende Staubpartikel |
| `js/world/Habitat.js` | Sockel, goldener Rand, Bodenringe, 5 Zonenmarkierungen, Spawnpunkt; `getZonePosition(id)`, `getZoneIds()`, `spawn` |

## Schnittstellen (für spätere Phasen)
- `engine.scene.add(obj)` – Inhalte anhängen.
- `engine.addUpdater((dt, elapsed) => ...)` – pro Frame; liefert eine Abmelde-Funktion.
- `engine.onResize(({width,height,aspect}) => ...)` – liefert eine Abmelde-Funktion.
- `new CameraRig(camera, domElement)`; `rig.fit(aspect)` bei Resize, `rig.update(dt)` pro Frame (in `main.js` angehängt), `rig.resetView()`, `rig.dispose()`.
- `rig.onTap(({x, y, event}) => ...)` – Client-Koordinaten eines kurzen Tippens ohne Ziehen (Schwellen in `CONFIG.camera.controls`). Phase 08 nutzt das für Raycasting auf die Kreatur; Ziehen und Pinch lösen kein Tippen aus.
- `createCreatureModel(appearance = CONFIG.creature.appearance)`: Ursprung der Gruppe = Boden zwischen den Füßen (y = 0), Blickrichtung +z (zur Kamera), Höhe ca. 1,2. `main.js` setzt `group.position` auf `habitat.spawn.position`. `parts` für Phase 06/07: `body` (Atmung, Füße bleiben am Boden), `head`, `eyes.left/right` (Gruppen, zum Blinzeln skalieren), `pupils.left/right`, `fins.left/right` (Pivots, Neigung über `rotation.z`), `tail[0..2]` (verschachtelte Pivots, Wedeln über `rotation.x/y`), `crystal`, `core`, `belt`, `feet[4]`, `shadow`. `dispose()` gibt Geometrien, Materialien und die Schattentextur frei.
- `idle.lookAt(THREE.Vector3 | null)` – Blickziel in Weltkoordinaten (Augen führen, Kopf folgt), `null` = freies Umherschauen. `idle.triggerGesture('finFlick'|'tailWag'|'headTilt'|'crystalPulse'|'hop')` für Reaktionen (Phase 08/13); bei „reduzierte Bewegung" liefert es `false` und tut nichts.
- `locomotion.moveTo(point, onDone)` – geht zu einem Punkt (auf `habitat.radius - boundsMargin` begrenzt), gibt den tatsächlichen Zielpunkt zurück; `turnTo(point, onDone)` dreht auf der Stelle; `stop()` bricht ab (ohne Rückruf, Kreatur bremst). Wer die Kreatur bewegen will, ruft `behavior.goTo/goToZone/observe`, nicht Locomotion direkt.
- `behavior.goTo(point, { state, dwell, lookAt, onDone })`, `behavior.goToZone(id, { state, dwell, lookAt, onDone })` (bleibt `zoneStandOff` vor der Zonenmitte stehen), `behavior.observe(point, { dwell, onDone })`, `behavior.interrupt()` (zurück nach IDLE, ohne `onDone`), `behavior.setAutonomous(false)` (keine selbstständige Wahl mehr, z. B. während Minispielen), `behavior.onStateChange((neu, alt) => ...)` liefert eine Abmelde-Funktion. Eine neue Aufgabe ersetzt die laufende. Selbstständige Wahl: `chooseNext()` gewichtet `explore`/`investigate`/`observe` über `CONFIG.creature.behavior.weights`; ab Phase 09/12 sollen Bedürfnisse und Persönlichkeit diese Gewichte verschieben.
- `CreatureModel` exportiert Maße: `BODY_BASE_Y`, `TORSO_BOTTOM`, `NECK_Y` (Hals-Pivot des Kopfes), `EYE_HEIGHT`.
- `habitat.spawn` (Object3D) – Startposition der Kreatur. `habitat.getZonePosition('sleep'|'food'|'play'|'research'|'deco')`.
- Koordinaten: Boden bei y = 0, Kamera blickt von +z zum Habitat. Winkel 0° = +x, 90° = +z.

## Konventionen
- Konstanten und Balancing-Werte nur in `config.js` bzw. später `js/data/`. Kamera-Grenzen und Empfindlichkeiten: `CONFIG.camera.controls`.
- Kamera-Entscheidung (Phase 04): eigene Pointer-Events-Steuerung statt `OrbitControls`. Gründe: keine zusätzliche Addon-Datei in `vendor/` (kein Eintrag in Importmap/`sw.js` nötig), Standardabstand hängt am Seitenverhältnis, Tippen vs. Ziehen lässt sich selbst trennen. Kein Verschieben (Pan), der Blickpunkt bleibt fest.
- Idle-Entscheidung (Phase 06): Verhalten rein prozedural (Sinus, Zufallstimer, gedämpfte Annäherung) statt Animationsclips, damit es zum Modell aus Primitiven passt und jede Kreatur über den Seed leicht anders wirkt. Der Kopf sitzt dafür jetzt auf einem Hals-Pivot (`NECK_Y`), Weltpositionen der Teile sind unverändert. Idle schreibt `rotation`/`scale` der Pivots; Phase 07 bewegt `creature.group` (Position, Drehung um y), damit beides nebeneinander läuft. Ausnahme: `parts.feet[].position.y` und `parts.body.position.y` setzt Idle für Atmung und Hüpfer.
- Bewegungs-Entscheidung (Phase 07): Zwei Module statt einem. `Locomotion` kennt nur Körper und Gehanimation, `Behavior` nur das „Was als Nächstes" (Zustände, Zielwahl, Verweilen, Blick). So können spätere Phasen (Bedürfnisse, Füttern, Schlafen) Behavior-Aufgaben auslösen, ohne die Animation anzufassen. **Updater-Reihenfolge ist Pflicht:** `idle.update` setzt `body.position.y`, `body.rotation.x/z`, `feet[].position.y` und `tail[].rotation.y` jeden Frame absolut; `locomotion.update` läuft danach und ADDIERT darauf (`+=`). Nur `feet[].position.z` setzt Locomotion selbst (Idle fasst das nicht an). Wer die Reihenfolge ändert, bekommt Zittern oder verlorene Gehanimation. Gehen in Trab (vorne links + hinten rechts gegen vorne rechts + hinten links, Reihenfolge `parts.feet` laut CreatureModel). Beim Laufen schaltet Behavior die zufälligen Idle-Gesten aus (`setGesturesEnabled(false)`), der Blick geht zum Ziel. „Spieler" für OBSERVE ist vorerst die Kamera-Position (`getObserveTarget` in `main.js`).
- Kreatur-Entscheidung (Phase 05): Aufbau komplett per Code aus Three.js-Primitiven statt Modelldatei (kein Asset-Ladevorgang, offline, später datengetrieben über `appearance`). Echte Schatten sind aus, deshalb ein Schattenfleck mit kleiner Canvas-Textur. Das Aussehen ist reine Daten (`CONFIG.creature.appearance`), damit Phase 26/27/29 nur ein anderes Objekt übergeben.
- Winkel der Kamera: Polar 0° = senkrecht von oben, 90° = waagerecht. Startwerte folgen aus `camera.position` und `camera.target`.
- Kein globaler Zustand außer den Wächter-Flags `window.__resonaBooted` und `window.__resonaFatal` (nur für die Fehleranzeige).
- „Reduzierte Bewegung" wird respektiert (Sterne, Staub, Lichtpuls, Zonenpuls stehen still).
- Schatten sind aus (`CONFIG.render.shadows = false`), Pixelratio begrenzt auf 2.

## Geplante Module (noch NICHT vorhanden)
CreatureSystem, NeedSystem, EmotionSystem, PersonalitySystem, InteractionSystem, InventorySystem, FoodSystem, ToySystem, TrainingSystem, EvolutionSystem, HabitatSystem (Ausbau), DiscoverySystem, QuestSystem, AchievementSystem, AudioSystem, SaveSystem, TimeSystem, WeatherSystem, UISystem, DebugSystem. Nur anlegen, wenn die jeweilige Phase sie braucht.

## Hub-Einbindung (offen)
Noch nicht erledigt, weil das Spiel noch nicht vorzeigbar ist: `resona/index.html`, `download.html`, `impressum.html`, `medien.html`, Eintrag in Hub-`index.html`, `sitemap.xml`, `tools/build_search_index.py` (Dict `GAMES`). Die drei Hub-Skripte in `game.html` verweisen auf `../assets/` bzw. `/assets/` und funktionieren erst im Hub-Ordner.

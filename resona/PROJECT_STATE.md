# PROJECT STATE

**Projekt:** 3D-Virtual-Pet im MC-ORCA-GAMES-Universum
**Spielname:** RESONA (vom Nutzer gewählt, 2026-10-03)
**Ordner/Slug:** `resona/` (im Hub-Root, neben den anderen Spielen)
**Stand:** 2026-10-03

Current Phase: 07
Completed Phases: 01, 02, 03, 04, 05, 06, 07
Status: COMPLETE (statisch geprüft, NICHT im Browser getestet)

## Current Objective
Phase 07 abgeschlossen (Bewegung, einfaches Behavior-System). Nächstes Ziel: Phase 08 – Interaktion (Kreatur antippen: Blick, Animation, Sound, Emotion). Dafür gibt es `rig.onTap(...)` (Phase 04), `idle.lookAt/triggerGesture` (Phase 06) und `behavior.observe/interrupt` (Phase 07).

## Implemented Systems
- Design: `GAME_DESIGN.md` (Phase 02)
- Code in `resona/` (Phase 03, **ungetestet im Browser**): Engine (Renderer, Schleife, Resize, Pause, Context-Lost), feste Kamera mit Hoch-/Querformat-Einrahmung, Beleuchtung, Hintergrundkuppel mit Sternen, Staubpartikel, Habitat „Kuppel" (Sockel, Rand, 5 Zonenmarkierungen, Spawnpunkt), PWA-Grundlage (Manifest, Service Worker, Icons), Fehler-/Ladeanzeige
- Kamera-Steuerung (Phase 04, **ungetestet im Browser**): `CameraRig` mit Orbit per Ein-Finger-Ziehen/linker Maustaste, Pinch- und Mausrad-Zoom, Pfeiltasten und +/- (optional), Doppelklick oder R = Reset, Begrenzung (Polarwinkel 12°–82°, Abstand 4,5–28), Nachlauf (bei „reduzierte Bewegung" ohne), `onTap()` für Phase 08. Werte in `CONFIG.camera.controls`
- Erste Kreatur „Reson" (Phase 05, **ungetestet im Browser**): `js/creature/CreatureModel.js`, `createCreatureModel(appearance)`. Tropfenförmiger Rumpf (Drehkörper), Kopf mit dunkler Gesichtsplatte, zwei leuchtende Augen mit Pupille und Glanzpunkt, zwei Sensorflossen mit goldener Spitze, schwebender Kristall, leuchtender Brustkern mit Ring, goldener Gürtel, dreigliedriger Schwanz mit orangem Ende, vier Füße, weicher Schattenfleck. Steht am Spawnpunkt, **animiert noch nichts**. Aussehen als Daten in `CONFIG.creature.appearance`
- Idle-Verhalten (Phase 06, **ungetestet im Browser**): `js/creature/IdleBehavior.js`, `createIdleBehavior(creature)`. Atmung (Unterkante bleibt am Boden, Brustkern pulsiert mit), Wippen, Schwanz-/Flossenschwingen, schwebender und drehender Kristall, Blinzeln (2,4–6 s, manchmal doppelt), Blickbewegungen (Augen führen, Kopf folgt, Hals-Pivot), alle 7–16 s eine kleine Geste (Flossenzucken, Schwanzwedeln, Kopfneigen, Kristallpuls, Hüpfer). „Reduzierte Bewegung": nur kleine Atem-/Wippbewegung, Blinzeln, ruhiger Blick, keine Gesten/Hüpfer/Leuchtpuls. Schnittstellen für spätere Phasen: `lookAt(point|null)`, `triggerGesture(name)`. Werte in `CONFIG.creature.idle`
- Bewegung (Phase 07, **ungetestet im Browser**): `js/creature/Locomotion.js` (stehen, auf der Stelle drehen, laufen, zu Punkten gehen, Begrenzung auf den Habitat-Kreis, Gehanimation im Trab mit Füßen, Rumpfwippen, Vorneigung, Rollen, Schwanz folgt Drehung) und `js/creature/Behavior.js` (Zustände `IDLE`, `EXPLORE`, `INVESTIGATE`, `OBSERVE`; die Kreatur wählt nach 3–8 s Ruhe selbstständig: zufälligen Punkt erkunden, eine Zone anlaufen und den Zonenboden betrachten, oder sich zur Kamera drehen und hinschauen). Von außen steuerbar über `goTo`, `goToZone`, `observe`, `interrupt`, `setAutonomous`. `IdleBehavior` bekam `setGesturesEnabled(bool)`. Werte in `CONFIG.creature.locomotion` und `CONFIG.creature.behavior`
- Three.js 0.160.0 lokal in `resona/vendor/`

## Not Implemented
Phase 08–50: Interaktion, Bedürfnisse, Persönlichkeit, Save, Evolution, Audio, UI usw. Außerdem: Hub-Seiten (`index/download/impressum/medien`) und Hub-Registrierung.

## Important Files
- `PROJECT_ANALYSIS.md` – Analyse des Hubs (18 Abschnitte, 2026-10-03 neu erstellt)
- `GAME_DESIGN.md` – Designentwurf (rekonstruiert 2026-10-03), Annahmen in Abschnitt 17
- `ARCHITECTURE.md` – Code-Aufbau, Schnittstellen, Konventionen (Phase 03)
- `resona/` – das Spiel: `game.html`, `js/`, `vendor/`, `sw.js`, `manifest.json`
- `PROJECT_STATE.md` – dieser Gesamtstand
- `PHASE_LOG.md` – Protokoll pro Phase
- Hub-Referenzen: `assets/pwa-install.js`, `assets/orca-settings.js`, `assets/js/update-watch.js`, `aetheris/dysonsphere.html` (Three.js 0.160 + OrbitControls), `ferrum-11984/game.html` (große 3D-Szene), `nexus-breach/HANDOFF.md` (Doku-Stil), `STORY.md` (Lore)

## Architecture (Entscheidungen, vom Nutzer bestätigt am 2026-10-03)
1. **Name:** RESONA, Ordner `resona/`.
2. **Three.js 0.160 als ES-Modul über importmap** (nicht r128). Nutzer überließ die Wahl Claude. Gründe: bereits im Hub im Einsatz (`aetheris/dysonsphere.html`), `OrbitControls` per Addon verfügbar (Phase 04), moderne API, passt zu mehreren Dateien mit `import`. r128 ist alt und nur als globales Skript nutzbar.
3. **Modularer Code in mehreren Dateien** (`js/systems/`, `js/data/`), bestätigt. Weicht bewusst von der Hub-Einzeldatei-Konvention ab, weil der Plan ca. 20 Systeme vorsieht und spätere Claude-Instanzen die Dateien lesen müssen.
4. **Kern komplett offline** mit `localStorage`, eigener Schlüsselpräfix, Save-Version. Kein Backend im MVP, bestätigt.
5. Neues Spiel im Hub nach 7-Dateien-Muster (index, game, download, impressum, medien, manifest, sw). Der Einstieg `game.html` lädt die Module.
6. Hub-Designtokens (Schwarz, Rot, Gold `#D4AF37`, Neonorange `#FF6A2B`, Teal `#21C7B8`).
7. **Three.js wird lokal mitgeliefert** (`resona/vendor/`), nicht per CDN. Grund: Offline-Start (Phase 03, Entscheidung Claude, zu 2. passend). Preis: ca. 670 KB zusätzlich im Ordner.
8. Service Worker cached alle Spieldateien vorab; neue Dateien müssen in `ASSETS` von `sw.js` eingetragen werden.
9. Spiel läuft nur über Webserver, nicht per `file://` (Modulpflicht).
11. **Bewegung (Phase 07): zwei Module, `Locomotion` (Körper) und `Behavior` (Entscheidung).** Updater-Reihenfolge `idle` -> `behavior` + `locomotion` ist Pflicht, weil Idle Pivot-Werte jeden Frame absolut setzt und Locomotion darauf addiert. Zustandsnamen folgen dem Master-Prompt (Abschnitt 18); nur vier sind belegt, die übrigen kommen mit ihren Phasen. „Spieler" für OBSERVE ist vorerst die Kamera. Details in `ARCHITECTURE.md`.
10. **Kamera-Steuerung (Phase 04): eigene Pointer-Events-Steuerung statt `OrbitControls`.** Damit entfällt der in Phase 03 geplante Addon-Import (`vendor/addons/`, Importmap-Eintrag). Kein Pan, Blickpunkt fest. Begründung siehe `ARCHITECTURE.md`.

## Known Issues
- `assets/audio/signals.json` ist ungültiges JSON (Zeile 10, doppelter Eintrag ohne `{`). Nicht verändert, gehört nicht zum Pet-Projekt. Wird von der GitHub Action neu gebaut.
- Icons der Spiel-Manifeste (`icon-192.png` usw.) im ZIP nicht sichtbar, Existenz auf dem Server nicht verifiziert (betrifft die bestehenden Spiele).
- **Nicht verifiziert – Laufzeittest wurde nicht durchgeführt:** ob RESONA im Browser startet, wie die Szene aussieht (Lichtwerte, Kamera im Hoch-/Querformat, Zonengrößen), ob Importmap/Service Worker/Offline-Start funktionieren, ob das Handy-Layout passt.
- `PROJECT_ANALYSIS.md` und `GAME_DESIGN.md` gingen verloren (Nutzer hat sie nicht mehr) und wurden am 2026-10-03 **neu erstellt**: die Analyse aus `MC_ORCA_GAMES.zip` neu gewonnen, das Design als Rekonstruktion aus Master-Prompt, `PHASE_LOG.md` und Code. Der Wortlaut der 8 ursprünglichen Annahmen ist nicht rekonstruierbar; `GAME_DESIGN.md` Abschnitt 17 listet die bekannten und kennzeichnet Vorschläge. Bei Widerspruch gilt der Code vor dem Dokument.
- **Nicht verifiziert (Phase 04):** Fingergefühl von Orbit und Pinch auf dem Handy, Zoom-/Winkelgrenzen, Mausrad-Tempo, ob Browser-Gesten (Rückwärts-Wischen, Pull-to-Refresh) die Eingabe stören, Tastaturfokus. Alle Werte sind Startwerte.
- **Nicht verifiziert (Phase 07):** ob die Kreatur im Browser tatsächlich läuft und wohin sie dreht (Vorzeichen von Drehung und Schwanzschwung), ob die Gehanimation gut aussieht (Fußpaare im Trab, Schrittlänge, Hubhöhe, Wippen, Vorneigung), ob Idle und Locomotion sich nicht stören (Hüpfer beim Stehenbleiben, Blick zum Ziel), ob Tempo, Wartezeiten und Gewichte der Zielwahl angenehm sind, ob sich die Kreatur bei Zonen nahe dem Rand sinnvoll verhält, ob OBSERVE zur Kamera natürlich wirkt, ob Verweilen und Gesten sauber ineinander übergehen. Alle Werte sind Startwerte.
- Die Icons von RESONA (`icon-*.png`, `icon.svg`) sind einfache Platzhalter.
- Hub-Skripte in `game.html` (`../assets/pwa-install.js`, `/assets/js/update-watch.js`) laufen erst, wenn der Ordner im Hub liegt.

## Syntax Status
Phase 01 (Hub, am 2026-10-03 mit dem aktuellen ZIP neu geprüft): 19 JS-Dateien OK, 203 Inline-Skripte in 66 HTML-Dateien OK, 10 von 11 JSON OK, 1 Fehler (`signals.json`, siehe oben).
Phase 03 (`resona/`): 10 Moduldateien + `sw.js` + `vendor/three.module.min.js` per `node --check` ohne Auffälligkeit; `manifest.json` und Importmap gültiges JSON; alle relativen Importe lösen auf; alle verwendeten `THREE.*`-Namen existieren in der mitgelieferten Datei; Service-Worker-Liste passt zu den Dateien; `game.html` Tag-Balance und ID-Referenzen OK. CSS-Syntax nicht geprüft. Phase 06: `IdleBehavior.js`, `CreatureModel.js`, `main.js`, `config.js`, `sw.js` und alle übrigen Module per `node --check` ohne Auffälligkeit; alle 14 `cfg.*`-Zugriffe in `IdleBehavior` haben einen Wert in `CONFIG.creature.idle` und umgekehrt; alle benutzten `parts`-Namen existieren im Modell; Import `TORSO_BOTTOM`/`EYE_HEIGHT` hat einen Export; `sw.js` `ASSETS` deckt alle Dateien in `js/` ab; keine verbotenen Zuweisungen an `position`/`rotation`/`scale`. **Nicht verifiziert – Laufzeittest wurde nicht durchgeführt:** ob Atmung, Blinzeln, Blick und Gesten gut aussehen (Stärke, Tempo, Takt), ob der Kopf am Hals-Pivot natürlich schwingt, ob der Kristall beim Kopfneigen sauber mitläuft, ob Hüpfer und Schattenfleck passen, ob die Augen beim Blinzeln als geschlossen lesbar sind.
Phase 07: alle 14 Moduldateien in `js/` und `sw.js` per `node --check` ohne Auffälligkeit; `manifest.json` gültiges JSON; Importe von `Locomotion.js`, `Behavior.js` und `main.js` lösen auf (`EYE_HEIGHT` hat einen Export); alle `cfg.*`-Zugriffe in `Locomotion.js` und `Behavior.js` haben einen Wert in `CONFIG.creature.locomotion` bzw. `behavior` und umgekehrt (auch `weights.explore/investigate/observe`); verwendete THREE-Namen (`Vector3`, `MathUtils`) existieren; `sw.js` `ASSETS` deckt alle Dateien in `js/` ab und verweist auf keine fehlende; keine verbotenen Zuweisungen an `position`/`rotation`/`scale`. **Nicht verifiziert – Laufzeittest wurde nicht durchgeführt:** siehe Known Issues (Phase 07).
Phase 05: `CreatureModel.js`, `main.js`, `config.js`, `sw.js` und alle übrigen Module per `node --check` ohne Auffälligkeit; alle verwendeten THREE-Namen (13) existieren in der mitgelieferten Datei; `sw.js` `ASSETS` deckt alle Dateien in `js/` ab und verweist auf keine fehlende; alle `CONFIG.creature`-Werte werden gelesen. Beim Prüfen gefundener Fehler behoben: `position` an Three-Objekten ist nicht überschreibbar (Zuweisung würde im Modulmodus einen Fehler werfen), stattdessen `position.set`. **Nicht verifiziert – Laufzeittest wurde nicht durchgeführt:** Aussehen und Proportionen, ob Augen, Flossen und Schwanz wie gedacht sitzen, Lichtwirkung der Leuchtteile, Sichtbarkeit des Schattenflecks.
Phase 04: `CameraRig.js`, `main.js`, `config.js` (+ alle übrigen Module und `sw.js`) per `node --check` ohne Auffälligkeit; Importe lösen auf; verwendete THREE-Namen (`Vector3`, `Spherical`, `MathUtils`, `setFromSphericalCoords`) existieren in der mitgelieferten Datei; alle 12 `controls`-Schlüssel in `config.js` werden im Code gelesen; jeder Listener in `CameraRig` hat ein Gegenstück in `dispose()`. **Keine Laufzeittests durchgeführt.** Phase 02 hat nur Markdown-Dateien erzeugt, es gibt nichts zu prüfen.

## Next Phase
08 – INTERAKTION (Spieler tippt/klickt die Kreatur an; Reaktionen: Blick, Animation, Sound, Emotion). Anknüpfungspunkte: `rig.onTap(({x, y}) => ...)` liefert Client-Koordinaten, per Raycast auf `creature.group` prüfen; `idle.triggerGesture(name)`, `idle.lookAt(point)`; `behavior.observe(cameraPosition, {...})` für Zuwenden, `behavior.interrupt()`; Zustand `INTERACT` ist noch nicht in `STATES` angelegt; Sound gibt es noch nicht (AudioSystem ist Phase 42, hier höchstens ein kleiner Platzhalter); Emotion kommt erst in Phase 13. Neue Dateien in `sw.js` `ASSETS` eintragen, `CACHE` hochzählen (aktuell `orca-resona-v4`).

## Offene Entscheidungen für den Nutzer
Keine blockierenden. Die 8 Annahmen in `GAME_DESIGN.md` Abschnitt 17 gelten, bis der Nutzer etwas anderes sagt.

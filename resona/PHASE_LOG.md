# PHASE LOG

## Phase 01 – Projektanalyse
Status: COMPLETE
Date: 2026-10-03

Changes:
- `MC_ORCA_GAMES.zip` (129 Dateien) statisch analysiert
- Befund: Das Pet-Spiel ist im ZIP nicht vorhanden. Der ZIP-Inhalt ist der Hub mit 9 Spielen
- `PROJECT_ANALYSIS.md` erstellt (18 Abschnitte)
- `PROJECT_STATE.md` erstellt
- `PHASE_LOG.md` erstellt
- Keine Projektdatei des Hubs verändert

Syntax:
- `node --check` auf 19 JS-Dateien und auf Inline-Skripte in 36 HTML-Dateien: keine Auffälligkeit
- JSON: 10 von 11 Dateien ohne Auffälligkeit
- Gefunden: `assets/audio/signals.json` ist kein gültiges JSON (nicht geändert, dokumentiert)
- HTML-/CSS-Syntax nicht geprüft (keine Werkzeuge)

Tests:
- NO runtime tests performed

Decisions (nach Abschluss der Analyse, 2026-10-03, vom Nutzer bestätigt):
- Spielname RESONA, Ordner `resona/`
- Three.js 0.160 als Modul mit importmap (Wahl Claude)
- Modularer Code in mehreren Dateien
- Kern offline mit localStorage, kein Backend
- Nur Dokumentation angepasst, kein Code

Next:
Phase 02 – GAME_DESIGN.md

## Phase 02 – Game Design Document
Status: COMPLETE
Date: 2026-10-03

Changes:
- `GAME_DESIGN.md` erstellt (17 Abschnitte): Vision/Säulen, Core Loop, Kreatur, Bedürfnisse, Emotionen, Persönlichkeit, Bindung/Erinnerungen, Lebenszyklus, Evolution, Habitat, Interaktion, Training/Spiel, Entdeckung/Story, Inventar/Wirtschaft, Langzeitmotivation, Anti-FOMO, MVP-Zuordnung
- `PROJECT_STATE.md` aktualisiert
- Kein Code geschrieben, keine Projektdatei des Hubs verändert

Decisions:
- Keine technischen. Designannahmen (Artname „Reson", Hochformat, Komfortboden, Stufendauern usw.) in `GAME_DESIGN.md` Abschnitt 17 gelistet, bisher nicht vom Nutzer bestätigt

Syntax:
- Nicht anwendbar (nur Markdown)

Tests:
- NO runtime tests performed

Next:
Phase 03 – 3D-Welt-Grundgerüst

## Phase 03 – 3D-Welt-Grundgerüst
Status: COMPLETE (statisch geprüft)
Date: 2026-10-03

Changes:
- Neuer Ordner `resona/` mit 19 Dateien: `game.html`, `manifest.json`, `sw.js`, Icons, `js/` (main, config, core: Engine/env/rng, world: CameraRig/Lighting/Backdrop/Atmosphere/Habitat), `vendor/three.module.min.js` (0.160.0) + Lizenz
- Szene: Boden (Sockel), goldener Rand, Bodenringe, 5 Zonenmarkierungen, Spawnpunkt, Licht, Kamera, Hintergrund, Sterne, Staub
- `ARCHITECTURE.md` neu, `PROJECT_STATE.md` aktualisiert
- Keine bestehende Hub-Datei verändert

Decisions:
- Three.js lokal statt CDN (Offline)
- Kamera in Phase 03 fest, mit Einrahmung für Hoch-/Querformat; Steuerung kommt in Phase 04
- Hub-Seiten und Hub-Registrierung bewusst auf später verschoben

Syntax:
- `node --check` auf allen Modulen, `sw.js`, `three.module.min.js`: keine Auffälligkeit
- JSON/Importmap gültig, Importe und THREE-Namen statisch aufgelöst, SW-Liste passt, HTML-Tags balanciert
- CSS-Syntax nicht geprüft

Tests:
- NO runtime tests performed
- Nicht verifiziert: Start im Browser, Aussehen, Offline-Start, Mobile-Layout

Next:
Phase 04 – Kamera

## Phase 04 – Kamera
Status: COMPLETE (statisch geprüft)
Date: 2026-10-03

Changes:
- `resona/js/world/CameraRig.js` neu geschrieben: Orbit (Ein-Finger-Ziehen / linke Maustaste), Pinch-Zoom, Mausrad-Zoom (exponentiell), Pfeiltasten + `+`/`-` (optional), Doppelklick bzw. `R`/`Home` = Reset, Nachlauf, `onTap()` (Tippen ohne Ziehen), `dispose()`
- Begrenzung: Polarwinkel 12°–82° (Kamera bleibt über dem Boden), Abstand 4,5–28, Azimut unbegrenzt (konfigurierbar)
- `fit(aspect)` bleibt: setzt den Standardabstand je Seitenverhältnis; ein vom Spieler eingestellter Zoom bleibt bei Drehung/Resize erhalten und wird nur in die Grenzen geklemmt
- `resona/js/config.js`: neuer Block `camera.controls` (12 Werte)
- `resona/js/main.js`: `CameraRig` bekommt das Canvas, `rig.update` als Updater angehängt
- `ARCHITECTURE.md`, `PROJECT_STATE.md` aktualisiert
- Keine neue Datei im Spiel, `sw.js` unverändert (Netz-zuerst, `CameraRig.js` ist bereits in `ASSETS`)

Decisions:
- Eigene Pointer-Events-Steuerung statt `OrbitControls`: keine Addon-Datei in `vendor/`, kein Importmap-Eintrag, Abstand hängt am Seitenverhältnis, Tippen und Ziehen sauber trennbar. Ersetzt den Plan aus Phase 03
- Kein Pan (Verschieben); Blickpunkt bleibt fest, bis eine spätere Phase etwas anderes braucht

Syntax:
- `node --check` auf allen Modulen und `sw.js`: keine Auffälligkeit
- Importe aufgelöst, THREE-Namen in `vendor/three.module.min.js` vorhanden, alle `controls`-Schlüssel in Config und Code abgeglichen, Listener in `dispose()` gegengeprüft
- CSS/HTML nicht geändert, daher nicht erneut geprüft

Tests:
- NO runtime tests performed
- Nicht verifiziert: Bedienung per Touch und Maus, Gefühl und Grenzen von Zoom/Neigung, Konflikte mit Browser-Gesten, Verhalten bei Drehung des Geräts

Hinweis:
- `PROJECT_ANALYSIS.md` und `GAME_DESIGN.md` fehlten im übergebenen ZIP, siehe Nachtrag unten

Next:
Phase 05 – Erste Kreatur

## Nachtrag – Dokumente wiederhergestellt
Status: COMPLETE (nur Dokumentation)
Date: 2026-10-03

Changes:
- `PROJECT_ANALYSIS.md` neu erstellt (18 Abschnitte) aus dem vom Nutzer erneut übergebenen `MC_ORCA_GAMES.zip` (129 Dateien)
- `GAME_DESIGN.md` neu geschrieben (17 Abschnitte) als Rekonstruktion aus Master-Prompt, `PHASE_LOG.md`, `PROJECT_STATE.md` und Code. Original-Wortlaut und die 8 ursprünglichen Annahmen sind verloren, Vorschläge sind im Dokument gekennzeichnet
- `PROJECT_STATE.md` angepasst (Known Issues, Syntaxstatus, Dateiliste)
- Kein Code geändert

Syntax:
- Hub neu geprüft: 19 JS-Dateien und 203 Inline-Skripte in 66 HTML-Dateien ohne Auffälligkeit; JSON 10 von 11 gültig (`assets/audio/signals.json` ungültig, nicht verändert)
- Nicht geprüft: CSS, HTML-Struktur, `nexus-breach/test/`

Tests:
- NO runtime tests performed

Next:
Phase 05 – Erste Kreatur

## Phase 05 – Erste Kreatur
Status: COMPLETE (statisch geprüft)
Date: 2026-10-03

Changes:
- Neu: `resona/js/creature/CreatureModel.js`: Kreatur „Reson" aus Primitiven. Tropfenrumpf (Drehkörper mit Spline-Profil), Kopf, Gesichtsplatte, zwei leuchtende Augen (Pupille, Glanzpunkt), zwei Sensorflossen, schwebender Kristall, Brustkern mit Ring, goldener Gürtel, dreigliedriger Schwanz, vier Füße, Schattenfleck
- Benannte Pivots in `parts` für Phase 06 (Idle) und 07 (Bewegung), noch keine Animation
- `resona/js/config.js`: neuer Block `creature` (Skalierung, Schattenstärke, 7 Farben in `appearance`)
- `resona/js/main.js`: Kreatur am Spawnpunkt in die Szene gehängt
- `resona/sw.js`: neue Datei in `ASSETS`, `CACHE` auf `orca-resona-v2`
- `ARCHITECTURE.md`, `PROJECT_STATE.md` aktualisiert

Decisions:
- Modell per Code statt Modelldatei (offline, kein Ladevorgang, Aussehen als Daten)
- Augen cyan, Kern neonorange, Zierteile Gold, Körper fast schwarz: knüpft an die MC-ORCA-Farben an (Vorschlag, nicht vom Nutzer bestätigt, Phase 29 erweitert das)
- Schattenfleck statt echter Schatten (Schatten bleiben aus)

Syntax:
- `node --check` auf allen Modulen und `sw.js`: keine Auffälligkeit
- 13 THREE-Namen gegen `vendor/three.module.min.js` abgeglichen, `sw.js`-Liste gegen Dateien abgeglichen
- Beim Prüfen behoben: Zuweisung an `position` eines Three-Objekts (nicht überschreibbar) durch `position.set` ersetzt

Tests:
- NO runtime tests performed
- Nicht verifiziert: Aussehen, Proportionen, Lichtwirkung der Leuchtteile, Schattenfleck, Kamera-Abstände zur neuen Kreatur

Next:
Phase 06 – Idle-Verhalten

## Phase 06 – Idle-Verhalten
Status: COMPLETE (statisch geprüft)
Date: 2026-10-03

Changes:
- Neu: `resona/js/creature/IdleBehavior.js`: Atmung (Unterkante bleibt am Boden, Brustkern pulsiert mit), Wippen, Schwanz- und Flossenschwingen, Kristall schwebt und dreht sich, Blinzeln (zufällig, manchmal doppelt), Blickbewegungen (Augen führen, Kopf folgt, Augen gleichen aus), kleine Gesten alle 7–16 s (Flossenzucken, Schwanzwedeln, Kopfneigen, Kristallpuls, Hüpfer ohne direkte Wiederholung)
- „Reduzierte Bewegung" beachtet: Amplituden auf 35 %, keine Gesten/Hüpfer, kein Leuchtpuls, Kristall still, Blinzeln und ruhiger Blick bleiben
- Schnittstellen für später: `lookAt(point|null)`, `triggerGesture(name)`
- `resona/js/creature/CreatureModel.js`: Kopf sitzt jetzt auf Hals-Pivot `NECK_Y` (Kinder entsprechend verschoben, Weltpositionen unverändert); neue Exporte `BODY_BASE_Y`, `TORSO_BOTTOM`, `NECK_Y`, `EYE_HEIGHT`
- `resona/js/config.js`: neuer Block `creature.idle` (14 Werte)
- `resona/js/main.js`: Idle-Verhalten angelegt und als Updater angehängt
- `resona/sw.js`: neue Datei in `ASSETS`, `CACHE` auf `orca-resona-v3`
- `ARCHITECTURE.md`, `PROJECT_STATE.md` aktualisiert

Decisions:
- Rein prozedurale Animation statt Clips (passt zum Modell aus Primitiven, Seed macht jede Kreatur leicht anders)
- Idle schreibt `rotation`/`scale` der Pivots, Phase 07 bewegt nur `creature.group`
- Blinzeln bleibt auch bei „reduzierte Bewegung" aktiv (Lebenszeichen, sehr kurz)
- Alle Zeiten, Winkel und Stärken sind Startwerte (Vorschlag), nicht getestet

Syntax:
- `node --check` auf allen Modulen und `sw.js`: keine Auffälligkeit
- Config-Schlüssel, `parts`-Namen, Import/Export und `sw.js`-Liste statisch abgeglichen; keine Zuweisungen an `position`/`rotation`/`scale` von Three-Objekten (nicht überschreibbar)

Tests:
- NO runtime tests performed
- Nicht verifiziert: Aussehen und Takt der Bewegungen, Kopfschwung am Hals, Kristall beim Kopfneigen, Hüpfer samt Schattenfleck, Lesbarkeit des Blinzelns

Next:
Phase 07 – Bewegung

## Phase 07 – Bewegung
Status: COMPLETE (statisch geprüft)
Date: 2026-10-03

Changes:
- Neu: `resona/js/creature/Locomotion.js`: stehen, auf der Stelle drehen, laufen, zu Punkten gehen (`moveTo`, `turnTo`, `stop`), Beschleunigen/Abbremsen vor dem Ziel, erst drehen wenn das Ziel weit seitlich liegt, Begrenzung auf den Habitat-Kreis (Radius minus Rand). Gehanimation im Trab: Füße heben und schwingen vor/zurück (diagonale Paare), Rumpf wippt, neigt sich nach vorn und rollt leicht, Schwanz folgt Drehungen verzögert. „Reduzierte Bewegung": Wippen/Neigen/Rollen/Schwanz auf 35 %
- Neu: `resona/js/creature/Behavior.js`: Zustände `IDLE`, `EXPLORE`, `INVESTIGATE`, `OBSERVE` (Export `STATES`). Selbstständige Wahl nach 3–8 s Ruhe (gewichtet): zufälliger Punkt, Zone anlaufen und den Zonenboden betrachten, zur Kamera drehen und hinschauen. Von außen: `goTo`, `goToZone`, `observe`, `interrupt`, `setAutonomous`, `onStateChange`
- `resona/js/creature/IdleBehavior.js`: neue Schnittstelle `setGesturesEnabled(bool)` (zufällige Gesten aus, solange die Kreatur läuft; laufende Geste wird beendet)
- `resona/js/config.js`: neue Blöcke `creature.locomotion` (21 Werte) und `creature.behavior` (12 Einträge, davon `weights` mit 3 Gewichten)
- `resona/js/main.js`: Locomotion und Behavior angelegt, Updater nach `idle`; Beobachtungsziel = Kamera-Position
- `resona/sw.js`: zwei neue Dateien in `ASSETS`, `CACHE` auf `orca-resona-v4`
- `ARCHITECTURE.md`, `PROJECT_STATE.md` aktualisiert

Decisions:
- Zwei Module: `Locomotion` (Körper, Animation) und `Behavior` (Entscheidung), damit spätere Phasen nur Aufgaben auslösen
- Updater-Reihenfolge `idle` -> `behavior` + `locomotion` ist Pflicht: Idle setzt Pivot-Werte absolut, Locomotion addiert darauf; nur `feet[].position.z` setzt Locomotion selbst
- Es werden nur vier der zwölf Zustände aus dem Master-Prompt angelegt; die übrigen kommen mit ihren Phasen
- Bei einer Zone bleibt die Kreatur 0,8 Einheiten davor stehen und schaut auf den Boden der Zone (statt auf der Markierung zu stehen)
- „Spieler" für OBSERVE ist die Kamera-Position, bis es eine bessere Definition gibt
- Alle Tempi, Zeiten und Gewichte sind Startwerte (Vorschlag), nicht vom Nutzer bestätigt

Syntax:
- `node --check` auf allen Modulen in `js/` und `sw.js`: keine Auffälligkeit; `manifest.json` gültig
- Importe, Exporte, Config-Schlüssel (beide neuen Blöcke), THREE-Namen und `sw.js`-Liste statisch abgeglichen; keine Zuweisungen an `position`/`rotation`/`scale` von Three-Objekten
- CSS/HTML nicht geändert, daher nicht erneut geprüft

Tests:
- NO runtime tests performed
- Nicht verifiziert: dass die Kreatur im Browser läuft, Drehrichtung und Schwanzschwung (Vorzeichen), Aussehen der Gehanimation, Zusammenspiel mit Idle (Hüpfer, Blick), Tempo und Wartezeiten, Verhalten an Zonen nahe dem Rand, Wirkung von OBSERVE

Next:
Phase 08 – Interaktion

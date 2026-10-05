# PROJECT ANALYSIS

**Stand:** 2026-10-03 · **Erstellt:** neu aus `MC_ORCA_GAMES.zip` (129 Dateien, 13 MB), weil das Original-Dokument aus Phase 01 verloren ging.
**Methode:** nur statische Analyse und Syntaxprüfung. **Keine Laufzeittests.** Alles hier stammt aus dem Code und den Dokumenten im ZIP, nichts aus dem Browser.
**Wichtig:** Das Pet-Spiel RESONA ist im Hub-ZIP **nicht** enthalten. Das ZIP ist der Hub mit den bestehenden Spielen. RESONA liegt als eigener Ordner `resona/` daneben (Details: `ARCHITECTURE.md`).

## 1. Projektübersicht
MC ORCA GAMES ist ein Hub aus browserbasierten Spielen ohne Download (Domain `www.mc-orca-games.de`, Sitemap und Canonical zeigen darauf). Der Hub-Einstieg `index.html` ist der Desktop „TERMINUS-7" (Interactive-Fiction-Rechner mit Terminal, Frequenzanalysator, Musikarchiv). Spiele laut Sitemap und Ordnern:

| Ordner | Spiel | Art (aus Code) |
|---|---|---|
| `aetheris/` | Aetheris – Echoes of an Eternal Empire | Canvas 2D, Supabase; Dyson-Sphäre separat in `dysonsphere.html` (three 0.160) |
| `astrion/` | Astrion | Canvas 2D, Supabase |
| `deepanchor/` | Deep Anchor – Satelliten-Produktion | Canvas 2D, Supabase |
| `pathofthestars/` | Path of the Stars: Drifting Worlds | Canvas 2D (Sternenkarte), Supabase |
| `nexus/` | NEXUS – Idle-Mining | DOM/Canvas 2D, Supabase (Schemata `crypto_farm`, `forge`, `platform`, `singularity`) |
| `nexus/nexus_singularity/` | Nexus Singularity (v0.2) | Endgame-Modul, Supabase (`platform`, `singularity`) |
| `foundry/` | FOUNDRY | Firmen-Gründer, Supabase (`foundry`, `platform`) |
| `domus-prime/` | Domus Prime: Verdantis | Kolonie-Aufbau, Supabase (`colony`, `platform`) |
| `nexus-breach/` | NEXUS: BREACH | Raycaster-FPS (Canvas 2D), laut `MISSIONS.md` bewusst nicht mit Account/Economy verbunden; `HANDOFF.md` und `test/` vorhanden |
| `ferrum-11984/` | FERRUM-11984 | Three.js-Sandbox (r128, CDN), kein Supabase, Schiffsbauer unter `schiffsbauer/` |

Dazu: `seiten/` (Portal, Profil, Ränge, Musik/Soundvault, Assistent, DataRescue, Suche, Uhr, Nutzungsbedingungen, Impressum), `tools/`, `worker/orca-assistent/` (Cloudflare Worker), `assets/` (geteilte Skripte), `STORY.md` (Lore/Changelog TERMINUS-7), `MISSIONS.md` (Roadmap TERMINUS-7).

## 2. Technologie
- Reines HTML/CSS/JavaScript, **kein Build-System, kein Framework**. Spiele sind **Einzeldateien** (`game.html`, 137 KB bis 1,2 MB, Skripte inline).
- Schriften über Google Fonts: Inter, Space Grotesk, JetBrains Mono.
- Backend: **Supabase** (Projekt-URL im Client, öffentlicher Schlüssel im Client üblich), mehrere Schemata je Spiel plus `platform` für Konto und Gemeinsames.
- Three.js: `ferrum-11984` r128 als globales Skript per CDN (cdnjs); `aetheris/dysonsphere.html` und `dyson-vorschau.html` 0.160.0 als Modul per Importmap (jsDelivr, mit `three/addons/`).
- Cloudflare Worker (Workers AI) für den T-7-Assistenten, laut README ohne Datenbank.
- GitHub Action `build-audio-manifest.yml` baut `assets/audio/signals.json` aus `assets/audio/` neu (Python, `tools/build_audio_manifest.py`).

## 3. Projektstruktur
Spielordner folgen dem **7-Dateien-Muster**: `index.html` (Startseite), `game.html` (Spiel), `download.html`, `impressum.html`, `medien.html`, `manifest.json`, `sw.js`. Nicht jeder Ordner hat alle sieben (z. B. fehlen bei `ferrum-11984` `medien.html`, bei `nexus-breach` Impressum und Medien). Geteiltes liegt in `assets/` (`orca-settings.js`, `orca-social.js`, `pwa-install.js`, `js/update-watch.js`, `audio/signals.json`). Suche: `search-index.js` (erzeugt von `tools/build_search_index.py`, Dict `GAMES`). Außerdem `sitemap.xml`, `robots.txt`.

## 4. Einstiegspunkt
Hub: `index.html` (TERMINUS-7). Je Spiel: `<ordner>/index.html` (Startseite) und `<ordner>/game.html` (Spiel). Hinweis: Memory/Doku nennen teils `desktop.html`; im vorliegenden ZIP existiert nur `index.html`.

## 5. Rendering
Überwiegend **Canvas 2D** (Aetheris, Astrion, Deep Anchor, Path of the Stars, Nexus, Foundry, Nexus: Breach als Raycaster). **WebGL/Three.js** nur in `ferrum-11984/game.html` und `schiffsbauer.html` (r128) sowie `aetheris/dysonsphere.html`/`dyson-vorschau.html` (0.160 Modul). Konsequenz: Für 3D gibt es im Hub zwei Three-Varianten; RESONA nutzt 0.160 lokal (siehe `ARCHITECTURE.md`).

## 6. UI
Dunkles Design mit gemeinsamen Farbtokens (`--bg:#0a0b12`, `--bg-alt:#12141f`, `--panel:#151726`, Gold `#D4AF37`, Rot `#D6303F`, Violett `#B23AFF`, Neonorange `#FF6A2B`, Teal `#21C7B8` in RESONA). Typografisch Inter/Space Grotesk, Monospace JetBrains Mono. UI ist DOM-basiert (Panels, Tabs, Popups), deutsch beschriftet. Gemeinsamer Einstellungsknopf `orca-settings.js` (unten mittig) und Social-Panel `orca-social.js`.

## 7. Daten
- Lokal: `localStorage` mit spielbezogenen Präfixen (z. B. `aetheris_save_v1`, `astrion_save`, `*_localts`/`*_localver` für Abgleich lokal/Cloud, `nexusActiveTab`, `ss11984_ship_*`, `nb_*`).
- Cloud: Supabase-Session unter `sb-iuvckfoikhifywayuwkj-auth-token`; Spieldaten in spielbezogenen Schemata, gemeinsames Konto in `platform`.
- Geteilte Audio-Schlüssel: `orcaMusicVolume`, `orcaMusicMuted`, `orcaSfxVolume`, `orcaSfxMuted`.
- RESONA: eigener Präfix `resona_` (`CONFIG.saveKeyPrefix`), kein Backend im Kern.

## 8. Assets
Spiele erzeugen Grafik überwiegend per Code. Ordner `art/` existiert in `domus-prime/` und `nexus-breach/`. Icons (`icon-192.png` usw.) liegen in den Hub-Spielordnern **nicht im ZIP**; ihre Existenz auf dem Server ist nicht verifiziert. Musikdateien (OST) liegen laut `index.html` nur auf dem Live-Server, nicht im ZIP.

## 9. Audio
Web Audio (`AudioContext`) in fast allen Spielen. Gemeinsame Oberfläche über `orca-settings.js` in Nexus, Nexus Singularity und Foundry; Aetheris, Astrion, Deep Anchor und Path of the Stars haben laut Kommentar eigene Systeme. Zentrale Musikbibliothek im Player `seiten/mc_orca_player.html` (laut `index.html`-Changelog 113 Titel). SSTV-/Signalkanäle über `signals.json`.

## 10. Eingabe
Maus/Touch/Tastatur je nach Spiel, PWA-fähig (Manifest + Service Worker). RESONA: Touch/Maus ab Phase 04 über Pointer Events (`CameraRig`).

## 11. Bestehende Systeme
Gemeinsames Konto/Login (`platform`-Schema), Cloud-Sync (`*_localts`/`*_localver`), geteilte Wirtschaft über Nexus-Währungen (MOGC) und Aktienmarkt (Foundry), Social/Chat/Freunde (`orca-social.js`), Ränge/Profil (`seiten/`), PWA-Installation (`pwa-install.js`), Update-Hinweis per HEAD-Request (`update-watch.js`), Suche, T-7-Assistent, Lore- und Signalsystem (TERMINUS-7).

## 12. Architektur
Statischer Hosting-Ansatz: Seiten + Einzeldatei-Spiele, Daten über Supabase direkt aus dem Client. Spiele sind untereinander lose gekoppelt (Datenbank-Schemata, `platform`-Konto, gemeinsame Skripte). Lore-Verbindung über TERMINUS-7 (`knoten`-Befehl, Sektoren laut `MISSIONS.md`). Ein neues Spiel wird über Ordner, 7 Dateien, `sitemap.xml`, `tools/build_search_index.py` (`GAMES`) und Hub-Startseite eingebunden.

## 13. Wiederverwendbare Komponenten
`pwa-install.js` und `update-watch.js` (Pflicht für Hub-Spiele), `orca-settings.js` (Musik/SFX-Oberfläche), Designtokens, Service-Worker-Muster, `aetheris/dysonsphere.html` als Referenz für Three 0.160 + Importmap, `ferrum-11984/game.html` als große Three-Szene, `nexus-breach/HANDOFF.md` als Doku-Stil, `STORY.md` als Lore-Quelle.

## 14. Fehlende Komponenten
Für das Pet-Spiel gab und gibt es im Hub nichts Vorhandenes: Kreatur, Verhalten, Bedürfnisse, Save-System, Zeit/Offline-Berechnung, 3D-Kamera-Steuerung mit Touch. Hub-seitig fehlen für RESONA noch `index/download/impressum/medien`, der Eintrag auf der Hub-Startseite, in `sitemap.xml` und in `GAMES` (`build_search_index.py`).

## 15. Technische Risiken
- Einzeldateien von 0,7–1,2 MB sind schwer zu pflegen; RESONA nutzt bewusst mehrere Module.
- Zwei Three-Versionen im Hub (r128 global, 0.160 Modul), nicht mischen.
- Module laufen nicht per `file://`.
- Service-Worker-Cache: neue Dateien in `ASSETS` eintragen.
- Supabase-Zugriff direkt aus dem Client: Rechte hängen komplett an den Datenbank-Regeln (nicht prüfbar aus dem ZIP).
- `signals.json` ist ungültiges JSON (siehe Abschnitt 18).

## 16. Empfohlene Entwicklungsrichtung
RESONA als **eigenständiges Offline-Spiel** (Three.js 0.160 lokal, mehrere Module, `localStorage`) im Hub-Stil entwickeln, Hub-Einbindung erst, wenn das Spiel vorzeigbar ist. Lore nur als optionale Hinweise (Phase 36), Spiel muss ohne Vorwissen funktionieren. Kein Backend im MVP.

## 17. Bereits vorhandene Arbeit
Nichts neu bauen, was im Hub existiert: Konto/Login, Cloud-Sync, Audio-Oberfläche, PWA-Skripte, Designtokens. Im Pet-Projekt bestehen bis jetzt: `resona/` (Phase 03 + 04), `GAME_DESIGN.md` (neu rekonstruiert), `ARCHITECTURE.md`, `PROJECT_STATE.md`, `PHASE_LOG.md`.

## 18. Syntaxstatus
Geprüft am 2026-10-03 (statisch, `node --check` bzw. JSON-Parser):
- **19 JS-Dateien** (ohne `nexus-breach/test/`): keine Auffälligkeit.
- **66 HTML-Dateien, 203 Inline-Skripte** (Importmap/leere ausgenommen): keine Auffälligkeit.
- **JSON: 10 von 11 gültig.** `assets/audio/signals.json` ist ungültig (Zeile 10, Spalte 3: fehlendes Komma/doppelter Eintrag). Nicht verändert, gehört nicht zum Pet-Projekt; die GitHub Action baut die Datei beim nächsten Audio-Push neu.
- HTML-Struktur und CSS-Syntax nicht geprüft (keine Werkzeuge). Die 20 Dateien in `nexus-breach/test/` wurden nicht geprüft und nicht ausgeführt.
- **Keine Laufzeittests durchgeführt.**

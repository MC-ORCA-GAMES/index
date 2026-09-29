# NEXUS: BREACH — Handoff

Stand: 29.09.2026 (Overhaul Phase 1–20 abgeschlossen; Story Mode Phase 1–12 fertig). Teil des MC ORCA Games Portfolios. Spielstände können seit dem Speichersystem (siehe unten) optional über den MC-Orca-Login in die Cloud gespiegelt werden; MOGC/Wirtschaft bleiben bewusst NICHT verbunden.

## Phase 21 — Musik-Dateien (`art/musik/`, 29.09.2026)
Echte Songs (KI-erzeugt, ~3 Min., `.ogg`) ersetzen die Synth-Musik, sobald sie auf dem Server liegen. **Ordner:** `nexus-breach/art/musik/` (Liste + Zuordnung: `art/musik/LIESMICH.txt`). **Fehlende Datei = kein Fehler:** dann spielt für diesen Zustand der Synth-Sequenzer (`Snd`) weiter, Song für Song nachlieferbar.
**Modul `MF`** (in `Snd`, vor `api.tick`; Konsole `__breach.Snd.files`): Streaming über `<audio>` + `createMediaElementSource` → `musBus` (Lautstärke, Ducking, Pause-Tiefpass, Mute wie bisher; kein Voll-Decode, 17×3 Min. PCM wären >1 GB). Ersatzformat `.mp3` bei Ogg-Fehler. Max. 8 Elemente im Speicher (ältester ungenutzter wird verworfen), Vorladen von Erkunden(Biom)/Kampf/Elite/Boss.
**Auswahl (`pick`):** Epilog → Titel/Archiv (Archiv erkannt über `#ar-back` in `#obox`) → Pause hält den Song → Boss (`lvl.bossName`: NULL SOVEREIGN `_a`/`_b` nach Phase, THE OBSERVER/TRANSMITTER/SECOND CORE `boss_story`, sonst `boss_a` P1–2 / `boss_b` P3–4) → Elite → Kampf → Erkunden (Story-Realm NULL `null`, Sektor 26 `collision`, Ascension `ascension`, sonst je Biom). Tabellen `FILES`, `STORY_BOSS`, `COLLISION_IDX`, `TRIM` oben im Modul.
**Wechsel:** hoch sofort (Ausblenden ~3,6 s, Einblenden ~1,5 s), runter erst nach `HOLD`=4 s; neuer Song wartet max. `GATE`=3 s, bis er spielbereit ist (Synth überbrückt). Erkunden/Titel/Archiv/NULL/Kollision/Ascension setzen fort, Kampf/Elite/Boss/Epilog starten neu. `MF.active` schaltet Synth-Sequenzer und Pad ab.
**Angepasst:** `Snd.tick` (MF-Aufruf, Pad-Gain, `sched`), `Snd.state` (+`file`), `__breach` exportiert jetzt `initAudio`, `sw.js` (Cache v33, `/art/musik/` wird nicht gecacht/abgefangen), `test/harness.js` (`setInterval`, `opts.extra`), neuer Test `test/t_music.js` (Mock-`AudioContext`/`Audio`: alle Dateien, keine Dateien, nur eine Datei; alles OK).
**Bekannt/offen:** Kein echter Browser-Test, keine echten Dateien gehört. `t_boss` (2) und `t_story` (18) melden weiter Fehler — **schon vor Phase 21 vorhanden**, unverändert. Ogg-Wiedergabe hängt vom Browser ab (ältere iOS-Safari: `.mp3` daneben legen). Loop-Punkte/Lautstärke je Song müssen gehört werden (`trim`). Boss-Wechsel `boss_a`→`boss_b` und Story-Boss-Zuordnung sind Annahmen, bitte prüfen. Songs laufen als Ganzes im Loop (kein Intro/Loop-Split).

## SPEICHERSYSTEM — Schnappschuss mitten im Level + Cloud-Sync (29.09.2026)
**Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check (`node --check` auf dem Inline-Skript, OK). `SAVE_VERSION` bleibt 4 (Haupt-Save unverändert), `sw.js` Cache v32.
**Modul `Snapshot`** (auch `__breach.Snapshot`): ein Platz in `localStorage['nb_run_save']`. Gesichert wird automatisch alle 20 s Spielzeit, beim Öffnen des Pause-Menüs, bei `pagehide`/Tab ausgeblendet und per Pause-Menü **„Spiel speichern“**. Titel: **„Spielstand laden — Sektor … · vor n Min.“** (nur sichtbar, wenn ein Schnappschuss existiert). Inhalt: Spieler (alle skalaren `P`-Werte inkl. Position/Blick, Waffen, Magazine, Wärme), Mods/Perks/Loot, Lauf-Zähler, Sektor-Zähler (`stats`, `totals`), Gegner (alle skalaren Felder + `em`), nicht eingesammelte Pickups (inkl. `loot`), Karten-Änderungen (Grid als Base64, temporäre Fallen `3` bleiben frisch), Nebel des Krieges (`seen`). Gilt für **Story-Sektoren** (`Story.live()`) und **Endlos-Einsätze** (Seed + Etage; Karte kommt per `generateProceduralSite`, Gegner/Pickups aus dem Schnappschuss). Nicht bei Ascension (Camp/Endless/Daily) und **nicht während eines aktiven Bosskampfs** (`bstarted`).
**Laden:** `Snapshot.load()` = `newRun()` + Loadout aus dem Schnappschuss, dann `startLevel(...)`; `startLevel` ruft danach `Snapshot.afterStart()`, das den Zustand über den frisch gebauten Sektor legt (Gegner werden aus dem Schnappschuss neu gebaut: `AI.init` + gespeicherte Felder; Pickups per Art+Position abgeglichen, nicht mehr vorhandene gelten als eingesammelt, neue Drops werden ergänzt). Weicht die Kartengröße ab, beginnt der Sektor von vorn (nur Loadout bleibt). `snap` (Neustart nach Tod) zeigt danach auf den geladenen Stand.
**Gelöscht:** `finishLevel` (Sektor gesäubert) und `finishRun`. Tod im Story-Sektor lässt den Schnappschuss stehen (Neustart-Knopf überschreibt ihn erst mit der nächsten Auto-Sicherung).
**Nicht gesichert (startet nach dem Laden frisch):** Level-Ereignisse (`Events`), Fallen-/Gefahren-Timer, Missionsfortschritt im Sektor, Kombo-Kette, an Ereignisse gebundene Pickups (können ihre Verknüpfung verlieren), Boss-Arena. Story-Flags/Zonen liegen im normalen Story-Save und bleiben erhalten.
**Modul `Cloud`** (auch `__breach.Cloud`): gleicher Supabase-Login wie Deep Anchor (E-Mail-Code, Projekt `iuvckfoikhifywayuwkj`, Tabelle `saves`, Spalte `version`). Schlüssel `nexusbreach_save` (= `Save.data`) und `nexusbreach_run` (Schnappschuss). Login-Bereich in **Einstellungen → KONTO & CLOUD-SYNC**, Status-Symbol **☁** im Titel (Klick öffnet Einstellungen). supabase-js wird lazy von jsDelivr geladen (nur bei vorhandener Sitzung oder geöffneten Einstellungen; `sw.js` cached Fremd-Domains nicht → Offline bleibt lokal). Upload debounced (Haupt-Save 15 s, Schnappschuss 45 s, „Spiel speichern“ sofort, `pagehide` best effort). Lokaler Versionszähler `nb_localver_main|run`. **Sync beim Login/Start:** nur lokal → hochladen; nur Cloud → laden (Haupt-Save danach `location.reload()`); frischer lokaler Save (keine Läufe, keine Story, 0 Credits) wird ohne Frage durch die Cloud ersetzt; sonst bei abweichendem **Haupt-Save Dialog „Cloud laden / Lokal behalten“** (mit Zeit + Credits/Sektoren/Tiefe/Spielzeit), beim **Schnappschuss gewinnt der jüngere** (`t`). Gast-Account (`c0ffee00-…-0001`) → kein Sync. Cloud-Stand mit `version` > `SAVE_VERSION` wird nicht geladen.
**Bekannt/offen:** Schnappschuss-Löschen in der Cloud passiert nur online (offline kann ein gesäuberter Sektor beim nächsten Sync wieder auftauchen). Titel-Zeile hat einen Button mehr (Handy-Umbruch prüfen). Tippen in den Login-Feldern: Tastenevents werden am Feld gestoppt — prüfen, ob Spiel-Hotkeys trotzdem reagieren. RLS-Policy der `saves`-Tabelle für Schlüssel `nexusbreach_*` nicht separat geprüft (Deep Anchor & Co. nutzen dieselbe Tabelle).
**Kein Browser-Test.** Bitte live prüfen: (1) Story Sektor 2 spielen, Gegner töten, Pickup nehmen → Pause → „Spiel speichern“ → Tab schließen → Titel „Spielstand laden“ → Position/Gegner/Pickups/Nebel stimmen; (2) Endlos-Einsatz dasselbe inkl. zweiter Etage; (3) Bossraum: Speichern-Knopf meldet „nicht möglich“ erst nach Kampfbeginn; (4) Login in Einstellungen (Code-Mail), ☁ wird grün, „Jetzt synchronisieren“; (5) zweites Gerät/Browser: Login → Haupt-Save + Schnappschuss kommen an, Konfliktdialog bei abweichenden Ständen; (6) Sektor säubern → „Spielstand laden“ verschwindet; (7) offline starten → keine Fehler in der Konsole. Konsole: `__breach.Snapshot.info()`, `.capture({force:true})`, `.load()`, `__breach.Cloud.state()`, `.sync()`.

## OVERHAUL — Fortschritt (20-Phasen-Plan)

| Phase | Status |
|---|---|
| 1 Foundation / Architektur | **fertig** |
| 2 Next-Gen HUD | **fertig** (siehe unten) |
| 3 Advanced Player System | **fertig** (siehe unten) |
| 4 Massive Weapon System | **fertig** (siehe unten) |
| 5 Weapon Modification System | **fertig** (siehe unten) |
| 6 Advanced Enemy AI | **fertig** (siehe unten) |
| 7 Enemy Classes | **fertig** (siehe unten) |
| 8 Elite Enemies | **fertig** (siehe unten) |
| 9 Boss Evolution | **fertig** (siehe unten) |
| 10 Level Events | **fertig** (siehe unten) |
| 11 Biome Overhaul | **fertig** (siehe unten) |
| 12 Environmental Hazards | **fertig** (siehe unten) |
| 13 Pickup & Loot System | **fertig** (siehe unten) |
| 14 Perk System | **fertig** (siehe unten) |
| 15 Meta Progression | **fertig** (siehe unten) |
| 16 Mission System | **fertig** (siehe unten) |
| 17 Combo / Style System | **fertig** (siehe unten) |
| 18 Audio & Juice Overhaul | **fertig** (siehe unten) |
| 19 Cinematic Presentation | **fertig** (siehe unten) |
| 20 Endgame / Nexus Ascension | **fertig** (siehe unten) |

## STORY MODE — Fortschritt (Master-Dokument `NEXUS_BREACH_Story_Mode_Master_Prompt.txt`, Phasen 0–12)

Zielspiel ist dieser Shooter (`nexus-breach/game.html`), nicht das Idle-Spiel `nexus`. Es wird immer nur die angeforderte Phase umgesetzt.

| Phase | Status |
|---|---|
| 0 Analyse | **fertig** (nur Bericht) |
| 1 Story Framework | **fertig** (siehe unten) |
| 2 Story UI / NEXUS ARCHIVE | **fertig** (siehe unten) |
| 3 Akt I (Sektor 01–05) | **fertig** (siehe unten, ohne Tests) |
| 4 Akt II (Sektor 06–10) | **fertig** (siehe unten, ohne Tests) |
| 5 Akt III (Sektor 11–15) | **fertig** (siehe unten, ohne Tests) |
| 6 Akt IV (Sektor 16–20) | **fertig** (siehe unten, ohne Tests) |
| 7 Akt V (Sektor 21–25) | **fertig** (siehe unten, ohne Tests) |
| 8 Akt VI (Sektor 26–30) | **fertig** (siehe unten, ohne Tests) |
| 9 Epilog (Storyabschluss, Terminal-Finale, Ascension-Freischaltung) | **fertig** (siehe unten, ohne Tests) |
| 10 Ascension-Story-Einstieg | **fertig** (siehe unten, ohne Tests) |
| 11 Polish | **fertig** (gezielt, ohne Tests, siehe unten) |
| 12 Final QA | **fertig** (statische Prüfung, ohne Tests, siehe unten) |

## Story Mode Phase 1 — Story Framework
Modul `Story` (vor `finishLevel`, auch `__breach.Story`, `NX.story`). **Nur die technische Grundlage** — keine Story-Texte, keine neuen Sektoren, kein neuer Boss.
**Save:** `SAVE_VERSION` = **4**, `MIGRATIONS[3]` ergänzt `story{}`; `sanitizeStory()` klemmt/bereinigt alles (Schlüssel nur `[A-Za-z0-9_.:-]` bis 48 Zeichen, kein `__proto__`, max. 1200 Flags (seit Phase 12, vorher 400), 300 Missionen/Logs/Realitäten/Unlocks). Felder in `Save.data.story`: `started, completed, act (0–6), sector (0–30, weitester erreichter/nächster), mission, flags, missions, cleared, realities, logs, bosses, signal/warden/breach (0–100), ending, unlocks, cp` (Checkpoint: freigeschaltete Waffen-Indizes + Munition). Entspricht den Feldern aus Master-Dokument Abschnitt 17 (`storyAct`, `storySector`, `storyMission`, `storyFlags`, `discoveredRealities`, `discoveredLogs`, `defeatedBosses`, `signalProgress`, `wardenProgress`, `breachProgress`, `endingState`).
**Akte/Sektoren:** `Story.ACTS` (6 Akte, nur Rahmen), Sektoren über `Story.registerSector({id,name,level,boss,missions,on,unlocks,requires})` (id 1–30; `level` = Index in `LEVELS[]`). Registriert sind **nur die 5 vorhandenen Sektoren als Akt-I-Platzhalter** (FARM HALL, THE BANK, AXIOM CORE, DOCKING RING, THE FIRST QUESTION → `LEVELS[0..4]`); Inhalt folgt in Phase 3.
**Regel:** Ein Sektor zählt als Story, wenn er freigeschaltet ist (Sektor 1 immer, sonst Vorgänger gesäubert). Direktwahl-Chips im Titel auf gesperrte Sektoren = freies Spiel ohne Story-Wirkung. Zufallslauf/Ascension (prozedural) sind nie Story.
**Missionen:** je Sektor Standard-Mission `sNN.main` (Typ `clear`, bei Boss-Sektoren `boss`; Typ `flag` möglich). Erfüllt bei Sektor-Abschluss (bzw. Boss-Tod, wenn kein weiterer Kern-Wächter lebt).
**Flags/Werte:** `flag/has/get/clearFlag`, `addSignal/addWarden/addBreach`, `discoverReality/discoverLog`, `setAct`, `setEnding`.
**Events:** `Story.on(evt,fn)` (`'*'` = alle), `emit`. Events: `start, sectorStart, sectorClear, bossDefeated, playerDeath, flag, unlock, mission, act, reality, log, progress, ending`. Daten-Aktionen `on:{start,enter,clear,boss,death}` über `Story.run([...])`: `{flag,value} {clearFlag} {msg,ms} {unlock} {reality} {log} {signal|warden|breach} {mission,state} {act} {ending} {emit} {if,then,else}`, jede mit optionalem `once:'key'`.
**Unlocks:** `Story.unlock(id)`, `isUnlocked`, `defineUnlock(id,{name,kind})`, `canEnter(sektor)`. Sektor-Abschluss schaltet `sector:<n+1>` frei (Zeile „Freigeschaltet“ im Ergebnis-Overlay). Reserviert: `archive` (Phase 2). **Ascension-Freischaltung war in Phase 1 unverändert** (Story-Abschluss als zusätzlicher Weg seit Phase 9).
**Fortsetzen:** Titel-Button „Story fortsetzen — Sektor n“ erscheint nur, wenn Story begonnen und ein freigeschalteter, nicht gesäuberter Sektor existiert (`Story.titleBtn/resume/resumeSector/enter`). Startet frischen Lauf mit Checkpoint-Waffen und Munition (wie Direktwahl: ab Sektor 2 Streu-Kanone). **Nicht gespeichert:** Mods/Perks/Loot/HP des Laufs.
**Hooks (klein gehalten):** `startLevel` → `Story.onSectorStart`, `finishLevel` → `Story.onSectorClear` (Zeilen im Ergebnis, sofortiger `Save.flush`), `Boss.onDeath` → `onBossDefeated`, `die` → `onPlayerDeath`, `showTitle` (Button), `NX.story`, `__breach.Story`. `sw.js` Cache v17. `NX.phase` bleibt 20 (Overhaul-Zähler).
**Konsole:** `__breach.Story.state()`, `.progress()`, `.flag('x')`, `.unlock('id')`, `.enter(1)`, `.resume()`, `.events`, `.reset()`.
**Tests:** neu `test/t_story.js` (58 Prüfungen: Save v4, Migration v2/v3→v4, Sanitize, freies Spiel, Story-Start/-Abschluss, Reload, Fortsetzen, Boss-Sektor, Tod-Event, Aktionen/Flags/Unlocks). `test/harness.js`: Stub für `style.setProperty` und `document.head` ergänzt (Harness lief seit Phase 11 nicht mehr). `test/t_save.js` prüft jetzt `NX.SAVE_VERSION` statt fest 1. `t_boss.js` hat 3–4 veraltete Prüfungen (schon vor Phase 1 rot: Boss-Text/Level-Label seit Phase 9/Threat), unabhängig von Story.
**Kein Browser-Test.** Bitte live prüfen: Titel-Button-Reihe mit „Story fortsetzen“ (Handy Hochformat), Sektor 1 → 2 → Reload → Fortsetzen, „Freigeschaltet“-Zeile im Ergebnis-Overlay, Direktwahl-Chips unverändert.

## Story Mode Phase 11 — Polish (gezielt, klein gehalten)
Nur Phase 11. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check (`node --check`, OK). Bestehende Systeme nicht umgebaut: nur die in den Handoffs von Phase 8–10 als offen genannten Punkte.
- **Balancing (Boss-Kurve):** Story-Boss-HP war nicht monoton (Sektor 25 ≈ 1216 < Sektor 20 ≈ 1488). Neues optionales Level-Feld `bossHpK` (Faktor auf Boss-HP, Standard 1), `LEVELS[24]` (THE SECOND CORE) = 1.3 → ca. 1581 HP. Damit: 320 (S1) · 816 (S3) · 1100 (S15) · 1488 (S20) · ~1581 (S25) · 1940 (S30). Sonst keine Kampfwerte geändert.
- **Boss-Farbe:** neues Patch-Feld `bossColor` (Boss-Balken, `Boss.color`). THE SECOND CORE `#FF4D6A`, NULL SOVEREIGN `#B000FF` (vorher Standardfarben der Varianten).
- **Audio:** neues Ambient `null` (verstimmte Intervalle, Rückwärts-Zischen, unruhiger Filter) — wird beim Realm `NULL` (Sektor 29) gesetzt und beim Zurückschalten wieder auf das Biom-Ambient gestellt. Epilog stoppt das Ambient (`stopAmbient`), damit nichts unter dem Finale läuft.
- **Übergänge/Animation:** Epilog blendet aus Schwarz ein (1,6 s, bei Reduced Motion ohne Animation). „Freigeschaltet: NEXUS ASCENSION“ im Abschluss-Overlay erscheint nur noch beim allerersten Abschluss (nicht, wenn Sektor 30 später erneut gespielt wird).
- **Mobile:** Info-Panel auf dem Titel (30 Direktwahl-Chips) scrollt jetzt (`overflow-y:auto`), statt bei 60cqw abgeschnitten zu werden.
- **Save/Performance/Story Consistency:** keine Änderung nötig gefunden (kein neues Save-Feld, `SAVE_VERSION` 4; Story-Tick/Zonen unverändert). Nicht umgesetzt (bewusst): Neubalance aller Gegnerdichten, Musik-Neukomposition, neue Partikel — ohne Live-Test zu riskant.
`sw.js` Cache v27.
**Bekannt/offen:** Kampfwerte/Gegnerdichten der Akte weiterhin nur geschätzt. NULL-Ambient-Lautstärke (.07) und Länge der Epilog-Pausen nach Gehör prüfen. `test/t_story.js` u. a. noch nicht an Phase 3–10 angepasst → **Phase 12 (Final QA)**.
**Kein Browser-Test.** Bitte live prüfen: Sektor 25 Bosskampf (etwas zäher als vorher), Boss-Balkenfarbe in 25/30, Sektor 29 NULL-Klang (nicht nervig, Wechsel zurück), Epilog-Einblendung ohne Musik/Ambient, Titel-Infopanel scrollt mit Touch, kein doppeltes „Freigeschaltet“.

## Story Mode Phase 10 — NEXUS ASCENSION als nächste Storystufe
Nur Phase 10. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check (`node --check`, OK). Vorhandene Ascension-Systeme (Camp 12 Sektoren, Endless, Daily, Endgame-Biome/Bosse) bleiben unverändert und werden nur eingerahmt; alles Neue greift nur, wenn die Story abgeschlossen ist (`story.completed`).
**Intro:** Erster Start von „Untersuchung beginnen“ (Camp-Modus) nach dem Story-Abschluss zeigt `Ascension.intro()`: „The breach was contained. / The signal was not. / The investigation continues.“ (nacheinander eingeblendet, Buttons nach ca. 7 s, bei Reduced Motion sofort), Buttons „Untersuchung beginnen“ / „Zurück“. Flag `asc.intro.seen` → danach direkt in den Lauf. Ohne Story-Abschluss (Freischaltung über Tiefe 9) unverändert kein Intro. Neu: `Ascension.begin(mode,back)`, `Ascension.intro(go,back)`.
**Menü:** nach Story-Abschluss Text „Der Breach wurde eingedämmt. Das Signal nicht.“, Button „Untersuchung beginnen“ (bis zum ersten Ascension-Abschluss), Zeile „Untersuchung: n / 6 Funde“.
**Untersuchungs-Ereignisse (nur Camp, nicht Endless/Daily):** in Ascension-Sektor 1/3/6/9/12 je eine Übertragung (WARDEN-01, AXIOM, UNKNOWN mit Glitch, RELAY, WARDEN-01), einmal je Lauf und Sektor, trägt Archiv-Eintrag `asc1`–`asc5` ein (Hinweise auf THE SIGNAL: Herkunftsfeld leer, ausgehender Verkehr ohne Ziel seit 03:14). **Der Ursprung bleibt ungelöst.**
**Abschluss-Screen:** nach Story-Abschluss anderer Text („Die Untersuchung geht weiter“, Signal wartet), Archiv-Eintrag `asc.end`, Zeile „Untersuchung“. Ohne Story-Abschluss bleibt der alte Text.
**Save:** keine neuen Felder, `SAVE_VERSION` bleibt 4 (Flags/Logs im Story-Save). `sw.js` Cache v26.
**Bekannt/offen:** Ascension-Läufe selbst (Gegner, Balance, Sektorinhalt) sind nicht story-spezifisch verändert; die fünf Übertragungen sind der ganze Story-Anteil (Ausbau optional in Phase 11). Übertragungen können mit der Biom-/Boss-Karte kollidieren (Warteschlange, blockiert nichts). Beim Story-Abschluss über Tiefe-9-Weg-Spieler (ohne Story) kein Intro (bewusst). Harness/Tests nicht angepasst.
**Kein Browser-Test.** Bitte live prüfen: Titel → Ascension nach Story-Abschluss (Menütexte, Intro-Timing, Handy-Hochformat), zweiter Start ohne Intro, Übertragungen in Sektor 1/3/6/9/12 (Lesbarkeit, HUD-Überlappung), Archiv `asc1`–`asc5`, Abschluss-Screen, Endless unverändert.

## Story Mode Phase 9 — Epilog · Terminal-Finale · Completion State
Nur Phase 9. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check (`node --check` auf dem Inline-Skript, OK). Inhalt folgt Master-Dokument Abschnitt 14/15.
**Ablauf:** Sieg über NULL SOVEREIGN → Sektor 30 gesäubert → `finishLevel` ruft `Epilogue.start(st)` (Hook `Story.finale()`, ersetzt das bisherige Akt-VI-Overlay). Zuerst wird der Abschluss **sofort gespeichert** (`Story.complete()` + `Save.flush`), dann läuft das Finale auf schwarzem Vollbild (`#stEpi`, z-index 95):
1. Szene 1: BREACH CONTAINED · REALITY NETWORK: STABLE · SEVEN NODES: ONLINE · WARDEN-01: MISSION COMPLETE, dann Schwarz.
2. Szene 2: 03:14 · SIGNAL RECEIVED · SOURCE: NEXUS → UNKNOWN → YOU (kurzes Glitchen), dann Schwarz.
3. Szene 3 (Terminal-Finale): NEXUS SYSTEM mit NEXUS/AXIOM/RELAY/FORK ONLINE, REALITY NODES 7, BREACH CLOSED, UNKNOWN PROCESS ACTIVE (rot); das System tippt `> listen`, Antwort `> I KNOW.`, dann `ENDE.`
4. Abschluss-Overlay „STORY ABGESCHLOSSEN“ (Stats, Buttons NEXUS ASCENSION / NEXUS ARCHIVE / Zum Titel; Ascension-Menü und Archiv führen per „Zurück“ wieder hierher).
**Finale nicht überspringen:** Beim ersten Mal gibt es keinen Skip. Erst wenn der Epilog einmal komplett gesehen wurde (Flag `epilog.seen`) und beim Wiederansehen gilt Esc/Enter/Leertaste/Tippen = überspringen (Hinweis unten rechts). Reduced Motion: Text erscheint ohne Tippen/Glitch, die Pausen bleiben.
**Completion State (Modul Story, klein):** `Story.complete()` (idempotent) setzt `story.completed=true`, `act=6`, `sector=30`, Flags `act6.complete` + `story.complete`, `ending='breach_contained'`, Unlock `ascension`, Archiv-Einträge `a6.ep1` (SIGNAL, 03:14) und `a6.ep2` (Abschlussprotokoll), Event `complete`; `Story.isCompleted()`, `Story.finale()`. Später wird zusätzlich Event `epilogue` gesendet. **Kein neues Save-Feld, `SAVE_VERSION` bleibt 4** (die Felder `completed`/`ending` existierten seit Phase 1).
**Ascension-Freischaltung:** `Ascension.unlocked` = bisherige Bedingungen (Ascension abgeschlossen oder Tiefe ≥ 9) **oder** Story abgeschlossen (alter Weg bleibt bewusst erhalten, damit bestehende Spielstände nichts verlieren). Sperr-Text im Menü nennt jetzt beide Wege. **Der Story-Einstieg/Intro von Ascension („The breach was contained…“) folgt in Phase 10.**
**Titel:** nach Abschluss erscheint der Button „Epilog ansehen“ (`Epilogue.start(null,{replay:true})`, ändert keinen Spielzustand, nur „Zum Titel“/Archiv/Ascension danach). Neuer Erfolg `storyEnd` (BREACH CONTAINED), wird erst nach dem Epilog gemeldet (nicht mitten im Finale).
**Konsole:** `__breach.Epilogue.start(null,{replay:true})`, `.skip()`, `.state()`, `__breach.Story.complete()`, `.isCompleted()`. `sw.js` Cache v25.
**Bekannt/offen:** Lauf-Abschluss-Buchhaltung (Meta/Style-Run-End, Lauf-Prämie) wird für den Story-Abschluss – wie schon bei den Akt-Overlays – **nicht** ausgelöst. Wer während des Finales den Tab schließt, hat den Abschluss trotzdem gespeichert (Ascension frei), sieht den Epilog aber nur über „Epilog ansehen“ (Flag `epilog.seen` fehlt dann, Skip bleibt gesperrt bis komplett gesehen). Timing/Länge (~1,5 Min.) und Lautstärke der Töne nicht abgestimmt. Bosskampf-Musik läuft eventuell unter dem Finale weiter (Audio-Feinschliff → Phase 11). Harness/Tests nicht angepasst: `t_story.js` erwartet evtl. noch das Akt-VI-Overlay nach Sektor 30.
**Kein Browser-Test.** Bitte live prüfen: Sektor 30 besiegen → Finale startet, kein Skip beim ersten Mal, Texte/Timing/Schwarz-Phasen, Handy-Hochformat (Zeilenbreite der Terminal-Zeilen), Abschluss-Overlay, Ascension danach entsperrt (Titel-Button zeigt „Ascension“ statt „(gesperrt)“), Reload → Titel zeigt „Epilog ansehen“, Archiv enthält `a6.ep1/ep2`, zweites Ansehen ist überspringbar.

## Story Mode Phase 8 — Akt VI · NEXUS: BREACH (Sektor 26–30)
Nur Akt VI. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check (`node --check`) und zwei Wegwerf-Rauchtests im Harness (30 Sektoren registriert, alle Auslöser der Sektoren 26–29 angefahren, Gate-Flags gesetzt, Boss-Stufen in Sektor 30 durchgeschaltet, 0 Fehler). Karten per Skript auf Rechteckigkeit und Erreichbarkeit (Start → Ausgang, alle Auslöser-Zellen, alle Feinde/Pickups) geprüft. Diesmal lag das Master-Dokument vor; Inhalt folgt Abschnitt 13/14 (Akt VI).
**Neu im Story-Modul (klein, nur Daten + ~50 Zeilen):**
- **Realm-Wechsel** `Story.realm(id,{ms})` / Aktion `{realm:'DOMUS_PRIME'}`: tauscht zur Laufzeit Wand-/Boden-/Deckentexturen, Nebel (`Biome.apply`, neu exportiert), Gegner-Sprites und einen Farbschleier `#stRealm` (mix-blend screen, folgt Reduced Motion). Realms: `NEXUS, DEEP_ANCHOR, FOUNDRY, AETHERIS, ASTRION, PATH_OF_THE_STARS, DOMUS_PRIME, NULL` (Biom + Farbe in `REALMS`). `{realm:'X',ms:5000}` nur zeitweise (danach zurück zum gehaltenen Realm), `{realm:'cycle',every:.9}` wechselt durch alle Realitäten, `{realm:'off'}` zurück zum Sektor-Biom. Reset bei jedem Sektorstart; Schleier nur im Zustand `play`.
- **Flux** (Sektor-Feld `flux:{every:[min,max],ms,realms}`): gelegentliches kurzes Aufflackern einer anderen Realität (Sektor 26).
- **Boss-Stufen** (Sektor-Feld `stages:[{at:HP-Anteil,run:[...]}]`): feuert die zuletzt erreichte Stufe, wenn der Boss (Typ `K`, gestartet) unter `at` fällt (`at>1` = beim Aufwachen). Überspringt nichts sichtbar Wichtiges, weil nur die aktuelle Stufe läuft.
**Sektoren** (`LEVELS[25..29]`, handgebaut, gehören auch zum freien Spiel: jetzt 30 Direktwahl-Chips):
- 26 COLLISION (55×17): sechs Hallen, Realm wechselt je Grenze (DEEP ANCHOR → AETHERIS → FOUNDRY → ASTRION → DOMUS PRIME), Realm-Zonen ohne `skipWhen` (Effekt greift nach Tod erneut, Texte/Meter nur einmal), Flux aktiv; letzte Zone (52,8) öffnet das Portal. Optional: Naht (2,14).
- 27 THE SEVEN SIGNALS (41×25): sieben Knoten im Ring in beliebiger Reihenfolge (DEEP ANCHOR, FOUNDRY, AETHERIS, ASTRION, PATH OF THE STARS, DOMUS PRIME, NEXUS; je Realm-Blitz + Echo + Terminal), dann Synchronisation in der Mitte (20,12): „Es waren nie sieben.“ Optional: Achter Sockel (3,20).
- 28 THE WARDENS (41×21): WARDEN-03 (SEAL), -04 (PURGE), -06 (FOLLOW) als Dialog-Stationen, **keine Gegner-Kämpfe gegen sie**; dann WARDEN-01 in der Mitte (20,10): „Selection registered. Selection was not required.“ Optional: Ungenutzte Doktrin (37,19).
- 29 THE NEXUS CORE (39×25): Halle → Korridor → Kernkammer; Zugriffsterminal (19,11), dann NULL am Kern (19,5), Realm `NULL`, Dialog nach Master-Dokument („They were created. But not by me.“). Optional: Schatten des Kerns (36,8).
- 30 NEXUS: BREACH (35×27, Boss-Sektor, `bossN:12, bossV:3`, HP 1940, Name per Patch `NULL SOVEREIGN`): acht Realm-Stufen bei HP-Anteil 1 / .86 / .72 / .58 / .44 / .30 / .18 / .08 (NEXUS, DEEP ANCHOR, AETHERIS, ASTRION, PATH OF THE STARS, DOMUS PRIME, FOUNDRY, FINALE = Realm-Zyklus „alle Realitäten gleichzeitig“) zusätzlich zu den 4 normalen Boss-Angriffsphasen. Nach dem Sieg Kurz-Dialog, Flag `act6.complete`, Overlay „AKT VI abgeschlossen“ (nur „Zum Titel“, **Epilog/Terminal-Finale/Ascension-Freischaltung folgen in Phase 9**).
**Archiv:** 24 neue Einträge `a6.*` (+ 4 optionale `a6.o.*`, versteckt). Absender `NULL`/`NULL SOVEREIGN` (`#B000FF`), `WARDEN-03/-04/-06`. Keine neuen Realitäten. Meter (breach/signal/warden) je Sektor erhöht. `T1`-Namen und Registrierschleife auf 30. `sw.js` Cache v24, `SAVE_VERSION` bleibt 4.
**Bekannt/offen:** Sektor 25 zeigt jetzt das Akt-V-Overlay mit „Weiter“. Sektor 30 ist der letzte Sektor (Overlay nur „Zum Titel“). Kampfwerte/Gegnerdichten und die Länge des NULL-SOVEREIGN-Kampfes (1940 HP) nicht ausbalanciert. NULL-Musik („falsch klingend“) und Boss-Farbe sind noch Standard (Void-Weber, mint) → Phase 11. Sektor-28-Dialoge pausieren das Spiel (bewusst). 30 Direktwahl-Chips: Umbruch auf dem Handy prüfen. Harness startet beim allerersten `Story.enter` aus dem Titel nicht (bekannt, nur Harness).
**Kein Browser-Test.** Bitte live prüfen: Sektor 26 Realm-Wechsel (Wand-/Bodentextur, Nebel, Schleier, Flux nicht zu nervig, Handy), Sektor 27 alle sieben Knoten + Mitte, Sektor 28 drei Dialoge + Mitte, Sektor 29 Korridor-Turrets + NULL-Dialog, Sektor 30 Bosskampf (Länge/Schwierigkeit), Stufen-Meldungen vs. Boss-Balken, Finale-Zyklus (Flackern/Reduced Motion), Reload + „Story fortsetzen“ mitten in Akt VI, Tod-Neustart in Sektor 26/30.

## Story Mode Phase 7 — Akt V · THE OTHER NEXUS (Sektor 21–25)
Nur Akt V. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check und Rauchtest (25 Sektoren registriert, alle Auslöser der Sektoren 21–24 angefahren, Gate-Flags gesetzt, Boss-Sieg in Sektor 25 löst Story-Ereignisse und Akt-Ende aus, 0 Fehler). Karten per Skript auf Rechteckigkeit und Erreichbarkeit geprüft. **Hinweis:** Master-Dokument lag weiterhin nicht vor; Inhalt aus dem Kanon abgeleitet (achtes Fenster, NEXUS (2), Frage „Who sent you?“ / „Nobody.“) und abzugleichen.
**Neu:** `LEVELS[20..24]` (gehören auch zum freien Spiel: 25 Direktwahl-Chips), Biome Dschungel (22) und Wüste (24), Absender `WARDEN-02` (`#FF6A8A`) und `THE SECOND CORE` (`#FF4D6A`), Boss-Sektor 25 `bossN:9, bossV:0` (Kern-Wächter-Variante, HP 1216), Name per Patch `THE SECOND CORE`. Nur Daten, keine neuen Modul-Features (Helfer `ch5/opt5/seq5`). Registrierungsschleife/`T1` auf 25. `sw.js` Cache v23. Sektor 20 zeigt jetzt Akt-IV-Overlay mit „Weiter“.
**Sektoren:**
- 21 THE OTHER FARM (Anlage, gespiegelt: Start Ost, Ausgang West, Blick nach Westen): drei Terminals (Rigs 0/12, ROGUE MINER noch aktiv, Spiegelung), dann Knoten im Westen (4,10), Echo `nexus` in Rot. Optional: Zwei Sockel (33,3).
- 22 THE FORWARD LEDGER (Dschungel): vier Einträge in Reihenfolge; Gegenbuchung zur Transaktion aus Sektor 2 (VALUE 0 → 1). Optional: Konto B (36,17).
- 23 THE OTHER WARDEN (Anlage, ruhig, 5 Gegner): drei Protokolle, dann Dialog WARDEN-02 / WARDEN-01 (28,14) — jeder hält den anderen für die Anomalie. Optional: Leere Zelle (2,16).
- 24 THE EIGHTH WINDOW (Wüste, Serpentine in drei Bahnen): vier Beobachtungspunkte, dann Blick auf unser NEXUS von außen (Echo cyan). Optional: Kein Rahmen (37,3).
- 25 THE SECOND CORE (Boss, gespiegelt: Start Nord, Ausgang Süd): Dialog „Who sent you?“ / „Nobody.“ / „That is what I answered too.“ / „Then who asked first?“; Flag `act5.complete`, Overlay „AKT V abgeschlossen“ (nur „Zum Titel“, bis Phase 8 Sektor 26 registriert).
**Archiv:** 19 neue Einträge `a5.*` (+ 4 optionale `a5.o.*`). Keine neuen Realitäten. **Bekannt/offen:** Kampfwerte/Gegnerdichten nicht ausbalanciert; 25 Direktwahl-Chips: Umbruch auf dem Handy prüfen; Spiegel-Start (Blick nach Westen/Süden) live prüfen; Harness startet beim allerersten `Story.enter` aus dem Titel nicht (Stub-Effekt). Kein Akt-VI-Inhalt.
**Kein Browser-Test.** Bitte live prüfen: Sektor 21 Terminals + Knoten, Sektor 22 Reihenfolge, Sektor 23 Dialog, Sektor 24 Serpentine + Beobachtungspunkte, Sektor 25 Bosskampf + Dialog, Akt-V-Overlay, Sektor 20 → 21 „Weiter“, Reload + „Story fortsetzen“ in Akt V.

## Story Mode Phase 6 — Akt IV · THE SIGNAL (Sektor 16–20)
Nur Akt IV. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check und Rauchtest (20 Sektoren registriert, alle Auslöser-Zellen der Sektoren 16–19 angefahren, Gate-Flags und optionale Funde gesetzt, Boss-Sieg in Sektor 20 löst Story-Ereignisse aus, 0 Fehler). Die 5 neuen Karten wurden per Skript auf Rechteckigkeit und Erreichbarkeit (Start → Ausgang, alle Auslöser, alle Feinde/Pickups) geprüft. **Hinweis:** Das Master-Dokument `NEXUS_BREACH_Story_Mode_Master_Prompt.txt` lag nicht vor; Inhalte von Akt IV sind aus dem bisherigen Kanon (Signal = Frage aus Sektor 5, „Nobody.“, NEXUS (2), THE OBSERVER) abgeleitet und mit dem Master-Dokument abzugleichen.
**Neu:** `LEVELS[15..19]` (gehören auch zum freien Spiel: jetzt 20 Direktwahl-Chips), Biome Wüste (16) und Schlucht (18), Absender `THE TRANSMITTER` (Farbe Orange `#FF9A2E`), Boss-Sektor 20 mit `bossN:7, bossV:2` (Reaktor-Titan-Variante, HP 1488, langsam mit Schockwellen/Spiralen), Name per Patch `THE TRANSMITTER`. Kein neues Story-Modul-Feature, nur Daten (Helfer `ch4`/`opt4`/`seq4` in der Sektor-Definition). `sw.js` Cache v22. `Story.ACTS[3]` (THE SIGNAL, 16–20) war schon angelegt; Registrierungsschleife und Titelliste `T1` auf 20 erweitert. Sektor 15 zeigt jetzt Akt-III-Overlay mit „Weiter“ + „Zum Titel“.
**Sektoren:**
- 16 THE ANTENNA FIELD (Wüste): drei Peilpunkte (Zellen 7,3 / 33,3 / 20,18, beliebige Reihenfolge, Peilwinkel 041°/197°/302°), danach „Antenne 0“ im Zentrum (20,10): kein Mast am Schnittpunkt, „das Signal verlässt NEXUS“. Optional: Sandbuch in der Ecknische (2,19).
- 17 THE DECODER (Anlage, drei Kammern): vier Fragmente in Reihenfolge West → Ost („WHO“ / „SENT“ / „YOU“ / „?“), Klartext „WHO SENT YOU?“ = wortgleich die Frage aus Sektor 5; AXIOM: wiederholt sich seit vor dem ersten Zyklus. Optional: Entschlüsselungsprotokoll (33,3).
- 18 THE ECHO CHAMBER (Schlucht): drei Aufzeichnungen in Reihenfolge (Zeitstempel +00:03:14 / +00:06:28 / +00:09:42, die Zukunft des eigenen Laufs); mit Flag `a3.shard.seen` zusätzlich „SYMBOL: THE SHARD“ im Hintergrund. Optional: Leere Aufnahme (37,3).
- 19 THE REPLY (Anlage, ruhig, 5 Gegner): vier Regale mit ausgehenden Antworten (Sektor 01 „PROCESS WAS NOT CREATED HERE.“, 03 „THE CONNECTION WAS ALREADY OPEN.“, 05 „NOBODY.“, Absender aller Antworten: keiner), dann Dialog in der Mitte (17,9): WARDEN-01/AXIOM – die Antworten haben keinen Absender („These did.“). Optional: Zweiter Kanal (32,17).
- 20 THE TRANSMITTER (Boss, Anlage): Nach dem Sieg Dialog „Transmission complete. / Reply received. / Reply from where? / NEXUS. The other one.“ Flag `act4.complete`, Overlay „AKT IV abgeschlossen“ (nur „Zum Titel“, bis Phase 7 Sektor 21 registriert).
**Archiv:** 21 neue Einträge `a4.*` (+ 4 optionale `a4.o.*`, versteckt). Meter: breach/signal/warden je Sektor erhöht (Boss zuletzt signal +8). Keine neuen Realitäten (NEXUS (2) bleibt ein UNKNOWN-Eintrag, erst Akt V).
**Bekannt/offen:** Kampfwerte von THE TRANSMITTER und Gegnerdichte nicht ausbalanciert (Transmitter ~35 % mehr HP als der Observer). 20 Direktwahl-Chips: Umbruch auf dem Handy prüfen. Optionale Nischen nur über Suchen auffindbar (Auslöse-Radius 0,9). Der Harness startet beim allerersten `Story.enter` aus dem Titel nicht (Fade-Effekt im Stub) – im Spiel unkritisch. Kein Akt-V-Inhalt.
**Kein Browser-Test.** Bitte live prüfen: Sektor 16 Peilpunkte + Antenne 0 (Wüsten-Optik, Sichtweite), Sektor 17 Fragment-Reihenfolge, Sektor 18 Aufzeichnungen (Canyon), Sektor 19 Regale + Dialog in der Mitte (Türöffnung Süd), Sektor 20 Bosskampf (Schwierigkeit) + Dialog, Akt-IV-Overlay, Sektor 15 → 16 „Weiter“, Reload + „Story fortsetzen“ mitten in Akt IV.

## Story Mode Phase 5 — Akt III · THE LOST REALITIES (Sektor 11–15)
Nur Akt III. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check und Boot-/Rauchtest (15 Sektoren registriert, alle Auslöser-Zellen angefahren, Portale öffnen, Boss-Werte, 0 Fehler). Die 5 neuen Karten wurden per Skript auf Rechteckigkeit, dichte Ränder und Erreichbarkeit (Start → Ausgang, alle Auslöser, alle Feinde/Pickups) geprüft.
**Neu:** `LEVELS[10..14]` (gehören auch zum freien Spiel: jetzt 15 Direktwahl-Chips), Echo-Art `shard` (Diamant-Symbol, Standardfarbe `#FF5DA8`), `Story.REALSTATE` + Status im Realitäten-Reiter des Archivs (` · ACTIVE/UNSTABLE`, erscheint erst nach Flag `a3.ar.states`), `Story.actBreak()`/`Story.roman(n)`: **Akt-Ende-Overlay jetzt an jeder Aktgrenze** (Sektor 5, 10, 15; bei 5/10 mit „Weiter“ + „Zum Titel“, bei 15 nur „Zum Titel“), Boss-Hook `lvl.bossN`/`lvl.bossV` in `Boss.init` (fester Boss-Level statt `lvIdx+1`), Absender `THE OBSERVER` (Farbe Türkis), optionale Funde als versteckte Archiv-Einträge (`hidden:true`, erst nach Entdeckung sichtbar). `sw.js` Cache v21.
**Sektoren:**
- 11 ASTRION (Anlage): vier Terminals in den Ecken (Kartendaten, Symbole, Spezies, Sternensysteme, beliebige Reihenfolge), danach Knoten im Osten (Zelle 30,9): THE SHARD (Echo `shard`, Realität ASTRION, Flag `a3.shard.seen`). Optional: Nische im Süden (16,20) „Ungedruckte Karte“ (Name: WARDEN-01).
- 12 PATH OF THE STARS (Schlucht-Biom, wenige Gegner): Logbuch I „WE LEFT OUR WORLD.“ → II „THE WORLD DID NOT LEAVE US.“ → Signal „SOURCE: HOME“ (HOME existiert in keinem Datensatz). Reihenfolge West → Ost, Rippen als Deckung. Optional: Kalender ohne Jahr (25,13, alles endet 03:14).
- 13 DOMUS PRIME (Dschungel-Biom): drei Proben (Pflanzen, Wasser, Leben), dann die Struktur in der Mitte (17,9): schwarzer Kristall, „NEXUS MATERIAL“; mit Flag `a3.shard.seen` zusätzlich Formabgleich „THE SHARD“. Optional: Wachstumsringe (17,19, Zählung 1847).
- 14 THE ARCHIVE (Anlage, ruhig, wenige Gegner): Serpentinen-Gänge mit vier Regalen (ACTIVE / UNSTABLE / LOST / UNKNOWN), dann Südsaal (16,18): NEXUS wurde *möglicherweise* gebaut, um Realitäten zu beobachten (bewusst nicht bestätigt). Optional: zwei Nischen (33,6 „Versiegeltes Fach“, 33,14 „Symbol ohne Realität“).
- 15 THE OBSERVER (Boss, Anlage): Boss = Void-Weber-Variante, `bossN:6` (HP/Schaden wie Boss-Stufe 6, nicht 15), Name per Patch `THE OBSERVER`. Nach dem Sieg Dialog: „You believe I created the breach.“ / „I only noticed it.“ / „Ask yourself who noticed it before I existed.“ Flag `act3.complete`, Overlay „AKT III abgeschlossen“.
**Archiv:** 21 neue Einträge `a3.*` (+ 5 optionale `a3.o.*`, versteckt). Realitäten ASTRION, PATH_OF_THE_STARS, DOMUS_PRIME werden auch hier entdeckt (Akt II hatte sie schon über die Fenster).
**Bekannt/offen:** Sektor 10 → 11 zeigt jetzt das Akt-II-Overlay (vorher „Weiter“ direkt). Sektor 15 ist wieder der letzte registrierte Sektor (Akt-III-Overlay ohne „Weiter“, bis Phase 6 Sektor 16 registriert). Optionale Nischen sind nur über Suchen auffindbar (Auslöse-Radius 0,9); Handy-Hochformat prüfen. 15 Direktwahl-Chips: Umbruch auf dem Handy prüfen. Kampfwerte des Observers und der Gegnerdichte nicht ausbalanciert. Kein Akt-IV-Inhalt.
**Kein Browser-Test.** Bitte live prüfen: Sektor 11 alle vier Terminals + Symbol-Knoten, Sektor 12 Logbuch-Reihenfolge und Signal, Sektor 13 Struktur öffnet sich erst nach drei Proben (Dschungel-Optik/Nebel auf handgebauter Karte), Sektor 14 Serpentinen + Südsaal, Realitäten-Reiter mit Status, Sektor 15 Bosskampf (Schwierigkeit) + Dialog, Akt-III-Overlay, Reload + „Story fortsetzen“ mitten in Akt III.

## Story Mode Phase 4 — Akt II · THE WINDOWS (Sektor 06–10)
Nur Akt II. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check und Boot-Rauchtest (10 Sektoren registriert, 0 Fehler). Die 5 neuen Karten wurden per Skript auf Rechteckigkeit und Erreichbarkeit (Start → Ausgang, alle Auslöser-Zellen) geprüft.
**Neu:** `LEVELS[5..9]` (5 neue handgebaute Karten, gehören zum freien Spiel/Direktwahl-Chips 6–10 dazu), Story-Aktion `{ifAll:[flags],then,else}`, `Story.actEnd()` (letzter registrierter Sektor → Overlay „AKT II abgeschlossen“ mit Button Titel statt Kampagnen-Ende; `actEndText` je Sektor), Echo-System erweitert: Arten `market|rift|nexus` zusätzlich zu `stations|planets|stars|arch`, Farbe per Suffix (`'planets:#7CFFB2'`), `label` je Echo (Bildunterschrift, wird gefiltert). `sw.js` Cache v20.
**Sektoren:**
- 06 DEEP ANCHOR: Ringstation mit Innenraum, Knoten im Zentrum (Zelle 14,9) → Echo, Terminal REALITY NODE (DEEP ANCHOR / ACTIVE / CONNECTION: IMPOSSIBLE), Realität DEEP_ANCHOR. Notiz: eigene Zeitlinie, keine Fortsetzung von NEXUS. Portal offen nach Knoten.
- 07 THE SIGNAL: drei Kammern, drei Knoten in Reihenfolge (DEEP ANCHOR → NEXUS, NEXUS → UNKNOWN, UNKNOWN → NEXUS); danach WARDEN-01: „nicht gesendet, es reagiert“.
- 08 FOUNDRY: Handelshalle, drei Terminals (Marktdaten, Transaktionen, Risikoanalyse) in beliebiger Reihenfolge; danach Ursprungs-Terminal im Osten: Entität „B“ (Keine Firma, keine Historie, keine Herkunft). Realität FOUNDRY.
- 09 AETHERIS: Beobachtungsgalerie **ohne Gegner**; vier Beobachtungspunkte (Riss, Sterne/Planeten, Stationen, Struktur, die einem NEXUS-Knoten ähnelt). Nur beobachten. Realität AETHERIS.
- 10 THE SEVEN WINDOWS: große Kammer mit Wächtern, sieben Fenster in Alkoven (DEEP ANCHOR, FOUNDRY, AETHERIS, ASTRION, PATH OF THE STARS, DOMUS PRIME, NEXUS; entdeckt je Realität im Archiv). Danach öffnet sich das achte Fenster (Alkoven Mitte oben) und zeigt ein anderes NEXUS (rot getönt). Portal danach offen; Ende: Akt-II-Overlay, Flag `act2.complete`.
**Archiv:** 12 neue Einträge `a2.*`. Realitäten: DEEP_ANCHOR, FOUNDRY, AETHERIS, ASTRION, PATH_OF_THE_STARS, DOMUS_PRIME (NEXUS schon seit Akt I).
**Bekannt/offen:** Akt-I-Sektor 5 führt jetzt normal zu Sektor 6 (vorher Kampagnen-Ende). Kampagnen-Ende „gamewin“ kommt weiterhin nur im freien Spiel nach Level 10 vor (Story fängt es ab). Sektor 9 hat 0 Gegner (Nutzung von `totals.foes=0` nicht getestet, wie Sektor 5). 10 Direktwahl-Chips auf dem Titel: Umbruch auf dem Handy prüfen. Missionen-Ziele („Makellos“ etc.) wurden nicht neu geprüft. Kein Akt-III-Inhalt.
**Kein Browser-Test.** Bitte live prüfen: Sektor 6 Knoten im Zentrum, Sektor 7 Reihenfolge West→Ost, Sektor 8 alle drei Terminals + Ursprungs-Terminal, Sektor 9 Echo-Overlays, Sektor 10 alle 7 Alkoven erreichbar (unten zwei Sackgassen-Alkoven), achtes Fenster, Akt-II-Overlay, Reload + „Story fortsetzen“ mitten in Akt II.

## Story Mode Phase 3 — Akt I (Sektor 01–05)
Nur Akt I, keine späteren Akte. **Keine Testsuiten gelaufen** (Kontextgrenze); nur Syntax-Check des Inline-Skripts und ein Boot-Rauchtest (Sektoren registriert, Story-Level-Variante von Sektor 1 lädt, 0 Fehler).
**Neu im Story-Modul:** `patch` je Sektor (Story-Variante von `LEVELS[level]`: `lock, name, intro, angle, bossName, map, set:[[x,y,zeichen]]`; Original bleibt für Direktwahl/gesperrte Sektoren), `zones[{id,x,y,r,sprite,need,skipWhen,run}]` (Auslöser per Nähe, feste Deko-Sprites `T`/`B`), `gate`/`gateMsg` (Portal bleibt zu bis Flag gesetzt), Aktion `{echo:{kinds,ms}}` (Reality-Echo-Overlay `StoryUI.echo`, Arten `stations|planets|stars|arch`, reducedMotion ohne Flackern). Hooks: `parseLevel` → `storyLevel()`, `Boss.name` nutzt `lvl.bossName`, `exitLocked`/Portal-Meldung → `storyGate()`, `frame` → `Story.tick`. `sw.js` Cache v19.
**Sektoren:**
- 01 FARM HALL: Start-Dialog (WARDEN-01), Terminal „NEXUS FARM · STATUS“, dann „UNKNOWN PROCESS DETECTED“. Story-Variante: Boss `K` mitten in der Halle, Portal gesperrt, Boss heißt ROGUE MINER (bestehender Kern-Wächter, umbenannt). Nach dem Sieg „PROCESS TERMINATED“ → „PROCESS WAS NOT CREATED HERE.“
- 02 THE BANK: Hauptbuch-Terminal mit rückwärts laufenden Buchungen. Sichtbares Terminal im Tresor (Zelle 12,8): Nähe löst die Transaktion (SOURCE UNKNOWN / DESTINATION NEXUS / VALUE 0 / TIMESTAMP 03:14) aus, setzt Flag `a1.bank.found` und öffnet das Portal.
- 03 AXIOM CORE: AXIOM „I did not open the connection.“ … „The connection was already open.“ Boss heißt CORE WARDEN (bestehender Boss). Nach dem Sieg Terminal „CONNECTION STATE: OPEN“.
- 04 DOCKING RING: RELAY-Übertragung, drei unsichtbare Zonen entlang des Wegs nach Westen (16,3 / 8,9 / 2,12) lösen kurze Reality-Echos aus (fremde Stationen, Planeten, Sterne, Architektur), danach wieder normal.
- 05 THE FIRST QUESTION: Story-Variante ist ein eigener leerer Raum (19×13, keine Gegner, nicht in LEVELS-Original). Knoten (Sprite `B`, Zelle 9,6): „Who sent you?“ / WARDEN-01: „...“ / „Nobody.“, dann „THE BREACH IS OPEN“ (Ende Akt I), Flag `a1.node` öffnet das Portal.
**Archiv:** 10 Einträge (`a1.*`: LOGS, SIGNAL, AXIOM, UNKNOWN, WARDEN), Realität NEXUS wird bei Sektor 1 entdeckt. **Fortschritt:** breach/signal/warden-Werte je Sektor, Flag `act1.complete`. Einmal-Beats laufen dank `once` nicht bei jedem Tod-Neustart erneut.
**Bekannt/offen:** `test/t_story.js` u. a. wurden nicht neu gefahren (könnten Platzhalter-Annahmen für Sektor 5 haben: `boss:false`, kein K mehr in der Story-Variante). Nach Sektor 5 gibt es noch keinen Sektor 6 (kommt mit Phase 4); Sektor-5-Abschluss zeigt weiterhin das bisherige Ergebnis-Overlay. Terminal-/Knoten-Sprites sind klein (Pickup-Größe).
**Kein Browser-Test.** Bitte live prüfen: Sektor 1 Boss + Portal, Terminal im Tresor (Sektor 2) findbar?, Echo-Overlay-Optik (Sektor 4, Handy Hochformat), Knoten in Sektor 5 (Dialog, Portal danach offen), Reload nach Sektor 3 → „Story fortsetzen“ → Sektor 4.

## Story Mode Phase 2 — Story UI + NEXUS ARCHIVE
Modul `StoryUI` (nach `Story`, vor `finishLevel`, auch `__breach.StoryUI`, `NX.storyUI`). **Nur Darstellung und Archiv-Gerüst — es gibt noch keinen Story-Text im Spiel** (Inhalte kommen ab Phase 3).
**Darstellungsarten** (alle über Warteschlangen, angepasst an bestehendes UI: `cqw`, `#stage`, `.rm`, Monospace):
- `terminal({title,lines,ms})` rechts unter der Minimap, tippt, blockiert nichts.
- `transmission({from,text,ms,glitch})` unten mittig über `#msg`, Absender-Farbe (AXIOM cyan, RELAY amber, FORK violett, WARDEN grün, NEXUS weiß, UNKNOWN rot; sonst cyan).
- `system(text,{tone:'info'|'warn'|'alert'})` große Zeile oben mittig; `note(text,{color})` kleine Notiz unten links.
- `dialog(lines,{id,once,done})` kurz, **pausiert das Spiel** (`setState('pause')`, Maus frei); Enter/Leertaste/E/Tippen weiter (erst Zeile komplett, dann nächste), Esc überspringt alles. Setzt Flag `dlg.<id>`, Event `dialog`. `once:true` verhindert Wiederholung. Wartet, solange nicht gespielt wird.
- Jede Darstellung darf `entry:'<archiv-id>'` und `reality:'<ID>'` tragen und trägt sie beim Start ins Archiv ein.
- Nichts läuft in Pause/Tod/Ergebnis; Wechsel zu `title|dead|levelwin|gamewin` räumt alles auf. Warteschlangen gekappt (6/6/3/3/4). `reducedMotion` (Einstellung oder Systemwunsch): Text sofort komplett, kein Flackern.
- Aus Daten: `Story.run([{tx:{...}},{terminal:{...}},{system:'..',tone:'warn'},{note:'..'},{dialog:{lines:[..],id:'x'}}])`, also direkt in `on:{enter,clear,boss,death,start}` von Sektoren.
- Hooks: `frame` → `StoryUI.tick(rdt)` (echte Zeit), globaler `keydown` → `StoryUI.keyDown(e)` (Dialog verbraucht Tasten).
**NEXUS ARCHIVE:** Titel-Button und Pause-Eintrag „NEXUS ARCHIVE (n neu)“ erscheinen erst, wenn `Story.archiveOpen()` (Freischaltung `archive` oder ein Eintrag entdeckt; die erste Entdeckung schaltet sie still frei). Der bestehende Titel-Button „Archiv“ (Meta-Upgrades) bleibt unverändert. 7 Reiter: LOGS, ÜBERTRAG., REALITÄTEN, WARDEN, AXIOM, SIGNAL, ??? (Reiter zeigen Entdeckt/Gesamt und ◆ für Neues). Einträge sind `<details>` (aufklappen = gelesen, NEU verschwindet); ungefundene Einträge als „???“, `hidden:true` erst nach Entdeckung sichtbar/gezählt. Entdeckte Einträge ohne Definition gehen nie verloren. Texte werden escaped. Signal-Reiter zeigt `signal`-Fortschritt, Realitäten-Reiter erinnert: jede Realität hat ihre eigene Zeitlinie.
**Register:** `Story.defineEntry({id,cat:'log|tx|warden|axiom|signal|unknown',title,from,text:[..],hidden})`, `entry(id)`, `entries(cat)`; entdeckt wird über `discoverLog(id)`. Die 7 Realitäten (`DEEP_ANCHOR, FOUNDRY, AETHERIS, ASTRION, PATH_OF_THE_STARS, DOMUS_PRIME, NEXUS`) sind fest hinterlegt (Kurztext aus dem Master-Dokument), entdeckt über `discoverReality(id)`. Neu-Verwaltung: `markSeen/isNew/newCount/newTotal`.
**Save:** neues Feld `story.seen` (gelesene Einträge, Realitäten mit Präfix `r.`), **ohne Versionssprung** (nur additiv über `sanitizeStory`, alte v4-Saves laden fehlerfrei, max. 600). `SAVE_VERSION` bleibt 4.
**Konsole:** `__breach.StoryUI.demo()` spielt alle Arten mit [TEST]-Texten (nichts wird gespeichert), `.state()`, `.clear()`, `.archive()`, `.archiveHtml('log')`.
**Tests:** neu `test/t_storyui.js` (65 Prüfungen: Register, Entdeckung/Neu, Escaping, Realitäten, Signal, Persistenz, Warteschlangen/Tippen/Kappung, Pause/Aufräumen, reducedMotion, Dialog inkl. Esc/once/Warten, Story-Aktionen). `sw.js` Cache v18.
**Kein Browser-Test.** Bitte live prüfen: `__breach.StoryUI.demo()` in der Konsole (Position von Terminal/Übertragung/Notiz gegen Minimap, `#msg` und HUD, besonders Handy Hochformat mit Touch-Steuerung), Dialog per Tippen auf Handy, Archiv-Overlay (`__breach.Story.discoverReality('NEXUS')` und `.discoverLog('x')` danach `__breach.StoryUI.archive()`).

## Fixes nach Live-Test (Screenshot, Sw-Cache v16)
- **„Feste Punkte“ (blaues Raster):** Ursache war `#bmFx i` (Biom-Staub-Overlay, `Biome.ensureDom`): ein CSS-Punktraster (90/140 px), das sich nur ~3 px/s bewegte und daher wie ein festes Raster wirkte. Jetzt zwei Ebenen **unregelmäßig verstreuter** Punkte (`dustLayer`, seeded, Kacheln 457/613 px, verschiedene Größe/Helligkeit) mit sichtbarer Drift (Anlage aufwärts ~12/17 px/s, Schlucht/Wüste seitwärts, Dschungel/Nest abwärts). Wand-Nieten und Deckenlampen sind wieder unverändert (Vermutung war falsch). Echte Cine-Partikel unverändert.
- **HUD zu groß:** neue Einstellung **HUD-Größe** (`hudScale`, 60–120 %, Standard 80 %, im Screen Einstellungen unter ANZEIGE). Skaliert `#bar` (unten) sowie `#top`, `#msHud`, `#stHud`, `#lootHud` per CSS-`transform` (`Settings.hud`); unter 900 px Breite nie unter 85 %. Alte Saves bekommen den Standard 0,8 automatisch (Sanitize-Default, `SAVE_VERSION` bleibt 3).
- **Missions-HUD:** kleinere Schrift (`clamp(10px,1.1cqw,16px)`), `top` 6,4 cqw statt 4,4 — überdeckt die Zielzeile „Portal erreichen“ nicht mehr.
**Bitte live prüfen:** Wände/Decke ohne Punkte-Raster, HUD-Größe-Regler (Untergrenze 60 %), ob `#combo`/Boss-Balken/Minimap bei 80 % noch gut zur skalierten Leiste passen (`#combo`, `#mini`, `#msg` werden NICHT skaliert), Handy-Hochformat.

## Missionen-Screen + Boss-besiegt-Karte (nach Erfolge)
**Missionen-Screen** `Missions.screen(back)` (auch `__breach.Missions.screen`). Erreichbar über Pause-Menü (Button „Missionen (erfüllt/gesamt)“) und Archiv (Button neben „Zurück“). Zeigt „AKTUELLER SEKTOR“ nur im Pause-Menü mit laufenden Missionen (◆ offen / ✓ erfüllt mit Belohnung / ✗ verfehlt, Fortschritt, Stufe, geschätzte Credits `(22+8·Tiefe)·(1+0,5·(Stufe−1))`, bei Schnellläufer Restzeit) sowie den „MISSIONSKATALOG“ (alle 8 Missionen mit Beschreibung und Stufe), Belohnungsregeln und Kosmetik-Zähler; Button „Kosmetik“ öffnet Archiv-Tab `co` und kehrt hierher zurück. Titel: kein eigener Button (Reihe ist schon voll), Zugang nur über Archiv.
**Boss-besiegt-Karte** `BossCard` (auch `__breach.BossCard`), **nicht blockierend** (Portal ist offen, Spiel läuft weiter, `pointer-events:none`, z-index 71, ~6,5 s, Farbe = Boss-Farbe). Inhalt: Boss + Level, Kampfzeit, kassierte Treffer („keine — makellos“), Prämie, Perk-Kern-Delta, dauerhafter Bonus, Boss-Kills gesamt. Aufruf aus `Boss.onDeath` (nur im Zustand `play`), Ausgangswerte (`bt0`, `bh0`, `bc0`) setzt `Boss.start`; `startLevel` blendet sie aus. Die verzögerte Ascension-Beute (Perk-Kern +1, Artefakt, Credits) steht NICHT in der Karte. Kein neues Save-Feld, `SAVE_VERSION` bleibt 3. Sw-Cache v14.
**Getestet:** `node --check` + Stub-Test (Missions-Screen live/Titel/Katalog, BossCard-Inhalt). KEIN Browser.
**Bitte live prüfen:** Karte vs. Boss-Balken/`#ascHud`/Boss-Titelkarte (top 20 %), Lesbarkeit im Handy-Hochformat, Missions-Liste scrollt im Pause-Menü, Pause-Button-Reihe (jetzt länger), ob die Karte beim Ascension-Finale mit dem End-Screen kollidiert.

## Erfolge (nach Settings-Menü)
Modul `Ach` (vor `finishLevel`, auch `__breach.Ach`). **15 Erfolge**, Freischaltung = Zeitstempel in `Save.data.achievements[id]` (kein neues Save-Feld, `SAVE_VERSION` bleibt 3). Vorgabe-Erfolge: FIRST BLOOD (1 Kill) · BREACH (1. Sektor) · ELIMINATION (100 Kills) · HUNTER (1000) · BOSS BREAKER (1. Boss) · VOID WALKER (Tiefe 25) · NEXUS (Tiefe 50) · ASCENSION · PERFECT RUN (Sektor ohne Schaden, `Style.hurtSec===0` und ≥ 1 Gegner, Hook in `finishLevel`). Zusätzlich: ELITE HUNTER (25 Elite-Kills, `meta.cnt.elites`) · OVERLOAD (×10-Kombo) · CONTRACTOR (10 Missionen) · ARSENAL (alle Waffen) · ARCHIVIST (alle 8 Artefakte) · ??? = NULL-SOUVERÄN (Geheim-Boss, Name/Text bis zur Freischaltung verdeckt).
**Prüfung:** Polling 1×/s in `update` (`Ach.tick`) aus vorhandenen Zählern plus Check in `finishLevel`/Screen-Öffnen → alte Saves bekommen fehlende Erfolge rückwirkend. Ein beim Titel (`Ach.init()` in `showTitle`) gemerkter Ausgangsstand verhindert Popups für früher freigeschaltete; von außen gesetzte Flags (Ascension: `ascension`, `voidWalker`, `nexus`, `secretBoss`) lösen ebenfalls das Popup aus.
**Popup** `#achPop` (oben mittig, `top:10%`, `pointer-events:none`, z-index 70, ~3,2 s, nacheinander; ab 4 gleichzeitig gesammelt „n ERFOLGE“), Klang `sfx.evSecret`; `.rm` = keine Animation. **Screen** „Erfolge“ (Titel-Button und Pause-Menü, Zurück führt dorthin zurück): Liste mit ◆/◇, Beschreibung, Datum bzw. Fortschritt `x / Ziel` + Balken; scrollt bei Bedarf. Keine Belohnung (bewusst, Wirtschaft unberührt). Sw-Cache v13.
**Getestet:** `node --check` + Stub-Test der Modullogik (Unlocks, Retro-Unlock, extern gesetzte Flags, PERFECT RUN mit/ohne Schaden, Screen-HTML). KEIN Browser.
**Bitte live prüfen:** Popup-Position (Kollision mit Boss-Balken/`#ascHud`/Sektorkarte oben, Handy Hochformat), Popup über Overlays (Sektor-Ende), Liste im Hochformat, ob `unlockedWeapons` bei ARSENAL wirklich alle 9 Waffen erreicht (sonst Ziel anpassen), Titel-Button-Reihe (jetzt 6 Buttons + i), PERFECT RUN bei reinem Umgebungsschaden (zählt nur `hurtPlayer`).
**Konsole:** `__breach.Ach.list()`, `.unlock('hunter')`, `.check()`, `.screen()`, `.reset()`.

## Settings-Menü (nach Phase 20)
Modul `Settings` (vor `finishLevel`, auch `__breach.Settings`). Screen „Einstellungen“ über Titel-Button und Pause-Menü (Zurück führt dorthin zurück). Regler (Slider, 36 px hoch, Zeilen ≥ 48 px): Gesamt-/Effekt-/Musiklautstärke, Screen Shake, Scanlines, Pixel-Effekte, Partikel, Schadensblitz, **FOV** (50–100°, `PLANE_LEN`/`PROJ` sind jetzt `let`, `Settings.apply()` setzt `tan(fov/2)`), **Maus-/Touch-Empfindlichkeit** (`Settings.mouseK/touchK` in `mousemove` und Touch-Blick), Schalter Reduzierte Bewegung, Button „Standard“. Alles live in `Save.data.settings` (`markDirty`, `flush` beim Zurück); kein neues Save-Feld, `SAVE_VERSION` bleibt 3. `apply()` läuft in `showTitle`. Sw-Cache v12 (Erfolge: v13).
**Nur `node --check`.** Bitte live prüfen: Slider auf dem Handy (Scrollen im Screen vs. Slider ziehen), FOV-Extreme (Sprites/Boden bei 100°), Empfindlichkeit, dass Musik/SFX-Regler hörbar live wirken, Überlauf des Screens im Hochformat.

## Phase 20 — Endgame / NEXUS Ascension
Modul `Ascension` (vor `finishLevel`, auch `__breach.Ascension`). Freischaltung: höchste Tiefe ≥ 9 **oder** erster Abschluss. Titel-Button „Ascension“ → Menü (Start / Endless / Tages-Herausforderung).
**Ascension-Lauf** = Zufallslauf mit Tiefen-Offset (Sektor a = Tiefe − 6, 12 Sektoren, Start mit Streu-Kanone, Overclock, Plasma, 110 Munition, 2 Perk-Kernen). **Endgame-Biome:** Eiswüste → Tote Stadt → Alien-Nest → Orbitalstation → Void → Singularitäts-Kern (je 2 Sektoren; `biomeForDepth` über `ASC_BIOME`; Fallen/Gefahren/Pickups kommen vom Basis-Biom, Ambient/Musik ebenso). **Skalierung:** Gegner-HP `0,85+0,07·(a−1)` (+0,05/Sektor ab 13), Schaden auf dich `0,9+0,035·(a−1)` (+0,04 ab 13, max ×3,5), gilt nur für Gegnerquellen (`hurtPlayer(n,src)`). **Elite-Varianten:** Chance ×1,6 + 8 %, ab Sektor 4 oft 2 Modifikatoren, ab 13 bis 3, Elite +25 % HP.
**Endgame-Bosse** (erweitern `Boss.BD` um Variante 4–8, nutzen die vorhandenen Angriffe/Phasen/Arena): Sektor 3 KERN-WÄCHTER PRIME · 6 DER ARCHITEKT · 9 DIE VOID-MASCHINE · 12 SINGULA OMEGA (Finale). Beute je Boss: Perk-Kern, Credits `250+40·a`, Artefakt (Episch, Omega/Geheim: Void) via `Loot.force`. **Sieg über Omega** → Cinematic-Screen „NEXUS ASCENSION COMPLETE“ (CSS-Sequenz, respektiert Reduced Motion), +2000 Cr (später 800), Endless freigeschaltet.
**Endless:** ab Sektor 13 unbegrenzt, Boss alle 3 Sektoren (Varianten rotieren, Level wächst), Prämie `20+4·a` Cr je Sektor, Rekord (Sektor + Punkte) im Save. **Geheim-Boss NULL-SOUVERÄN:** nur Endless, jeder 15. Sektor (Ziel `secretBoss`). **Tages-Herausforderung:** 2 Modifikatoren aus lokalem Datum (Glaskanone, Stahlfront, Elitejagd, Karger Tag, Kernvorrat, Schlachtfeld) mit Punkte-Multiplikator; Tagesrekord in `asc.daily` (max. 30 Tage). Level selbst sind nicht geseedet.
**Save:** `SAVE_VERSION` = **3**, `MIGRATIONS[2]` ergänzt `asc{done,clears,endDepth,endScore,bosses,secret,daily}`; Erfolge (nur Flags in `achievements`): `ascension`, `voidWalker` (Tiefe 25), `nexus` (Tiefe 50), `secretBoss`. Achievement-Screen und Settings-Menü existieren inzwischen (siehe oben).
**Angepasst:** `biomeForDepth`, `Boss.init`/`onDeath`, `hurtPlayer`, `Elite` (`rollElite`, `assign`), `parseLevel`/`spawnEnemy` (`onEnemy`), `newRun` (`reset`), `startLevel` (`onSector`, Ambient), `finishLevel`, `finishRun`, `showTitle`, `sw.js` (Cache v11), `NX.phase`=20.
**Konsole:** `__breach.Ascension.start('camp'|'endless'|'daily')`, `.unlock()`, `.complete()` (im Lauf), `.state()`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). `t_boot.js` bricht im Harness schon vorher an `dom.box.style.setProperty` (Phase 11, Stub fehlt) ab; `t_save.js` prüft evtl. noch die alte `SAVE_VERSION`.
**Bitte live prüfen:** Ascension-Start (Titel-Button-Reihe auf dem Handy), Balance (Tiefe 7 mit 100 HP, Boss-HP/-Schaden der neuen Bosse, Endless-Skalierung), ob Endgame-Biome (Alias-Texturen des Basis-Bioms) korrekt laden, `#ascHud`-Position (oben mittig, kann mit Boss-Balken/`#msHud` kollidieren), End-Screen-Timing, Boss-Musik-Variante (`bv&3`), Tages-Modifikatoren, Migration eines v2-Saves.

## Phase 19 — Cinematic Presentation
Modul `Cine` (nach `Snd`, auch `__breach.Cine`, `NX.cine`). Alles hängt an den Einstellungen (live, alle 0,4 s aus `Save.data.settings`; das Settings-Menü selbst fehlt noch): `screenShake` (0 = kein Shake **und** kein Hit-Stop), `damageFlash` (roter Treffer-Rand + Explosionsblitz), `particles` (Partikel-Obergrenze 200×Wert), `pixelFx` (Overlays: Mündungsblitz, Krit-Ring, Dash-Blur, Glitch, Verzerrung), `scanlines` (Deckkraft `#scan`, dort steckt auch die Vignette), `reducedMotion`/`prefers-reduced-motion` (kein Shake/Hit-Stop/Overlays, Partikel ×0,4, Boss-Balken statisch).
**Partikel:** Pool, als Sprites im Raycaster (`Cine.draw` in `renderSprites`, Wand-/Boden-Kollision, Umgebung max. 36). *Einschlagfunken* (`spawnSpark`), *Leuchtspur* (`hitscan`, Schrot 2 / sonst 4 Punkte), *Treffer* (rot, bei Krit gold + Ring), *Todes-Effekt* je Klasse/Elite/Boss (Trümmer + Funken, Ring bei Elite/Boss/Tank), *Explosion* (`spawnBoom` ab Größe 1,2: Feuerball, Rauch, Ring, Blitz je Abstand), *Projektil-Schweife* (Plasma cyan, Void/Singularität violett, max. 12 Schüsse), *Umgebung* je Biom (Anlage Staub, Schlucht Glut, Wüste Sandwehen, Dschungel Sporen).
**Overlays (`Cine.post` nach `drawWeapon`):** Mündungsblitz (Waffenfarbe, Schrot/Rail größer, Overclock/Arc klein, nicht bei Fäusten) · Krit-Ring am Fadenkreuz · Explosionsblitz (max. 0,4 Deckkraft) · Dash: Zoomblur + Speedlines · Glitch-Streifen (Schildbruch, Schaden ≥ 22, Tod, Boss, Sektor, niedrige HP alle ~2–4 s klein) · Wellen-Verzerrung (Boss-Phase, Tod, Void-Teleport `hzTele`, große Explosionen nah).
**Hit-Stop** (`Cine.stop`, `frame` skaliert `dt` auf 5 %, Sperre 0,25 s): Krit 0,03 · Tank/Krit-Kill 0,045 · Explosion 0,05 · Elite-Kill 0,08 · Boss-Phase 0,08 · Boss-Kill 0,16–0,18. **Boss-Einzug:** Letterbox-Balken + Titelkarte „WARNUNG / NAME / LV · Phase“ (ersetzt die Meldung), Glitch + Blitz. **Sektor-Wechsel:** Karte „TIEFE n / SEKTOR n + Biom“ (mit Scan-Linie), Sektor-Abschluss mit kurzem Glitch/Blitz.
**Angepasst:** `frame` (Hit-Stop, `Cine.tick`), `render` (`Cine.post`), `renderSprites`, `spawnBoom`, `spawnSpark`, `hitscan`, `damageEnemy`, `hurtPlayer`, `die`, `finishLevel`, `Boss` (`start`, `nextPhase`, Tod), `startLevel`, `applyShake` (× `shakeK`), `#hurt`-Deckkraft (× `dmgK`), `sw.js` (Cache v10), `NX.phase`=19. `SAVE_VERSION` bleibt 2.
**Konsole:** `__breach.Cine.state()`, `.boom(x,y,2)`, `.glitch(1)`, `.distort(1)`, `.flash(.4)`, `.bossIntro('TEST','LV 1')`, `.sector()`, `.hs(.1)`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 20 bitte `t_boot.js`, `t_boss.js`, `t_soak.js` einzeln starten.
**Bitte live prüfen:** Lesbarkeit (Blitze/Glitch zu stark?), Mündungsblitz-Position (`gy=H·0,575` geschätzt), Hit-Stop-Gefühl (bei Multi-Kills), Partikel-Sichtbarkeit/Höhe (`vo`), FPS auf dem Handy (Verzerrung nutzt 24-px-Streifen, Zoomblur = 1 `drawImage`), Boss-Titelkarte vs. Boss-Balken oben, Sektorkarte vs. Level-Intro unten, Umgebungspartikel je Biom (nervig? zu dicht?), Krit-Ring, `#scan`-Deckkraft bei `scanlines`=0 (Vignette verschwindet mit).

## Phase 18 — Audio & Juice Overhaul
Modul `Snd` (nach `Style`, auch `__breach.Snd`, `NX.audio.music`). **Busse:** `sfxBus` / `musBus` (→ Tiefpass `musFilt` → `duckG`) / `revBus` (Faltungshall, 1,5 s, generiert) → `master` → Kompressor. Lautstärken kommen **live aus `Save.data.settings`** (`masterVol`, `sfxVol`, `musicVol`, alle 0,4 s abgeglichen) — das Settings-Menü selbst ist noch nicht gebaut, die Regler wirken sofort, sobald es Werte schreibt. `tone()`/`noise()`/Ambient laufen jetzt über `sfxBus`.
**Klänge (gleiche Namen, überschrieben):** Waffenfeuer je Waffe (Sub-Schlag, Hall, Schrot-Pumpe, Rail-Nachhall, Singularität-Sog), Nachladen/Fertig **je Waffenart** (`sfx.reload(i)`, `reloadDone(i)`: Magazin / Schrot / Energie), Treffer, Krit (Glocke + Sub), **Gegner-Tod je Rolle** (`sfx.kill(d,e)`: Schwarm, Tank/Juggernaut, Assassine/Späher, Sniper, Schild/Support, Elite-Ring), Dash (Bandpass-Sweep), Schildbruch (Glas + Sub), Pickup, Boss-Intro/-Phase (`bossPhase(p)`, Phase 4 = Enrage-Brüller)/-Down, Sektor-Abschluss (Fanfare), Geheimnis (Arpeggio + Hall), Alarm, Explosionen (`Snd.boom`, `sfx.explosion(d,größe)`: boomP, evBoom, hzBoom, holeCollapse). Leichte Tonhöhen-Variation bei oft gehörten Klängen. **Ducking:** große Klänge (Rail, Singularität, Boss, Explosion, Tank-Tod, Abschluss) drücken die Musik kurz weg. Nicht neu: Niedrige HP (Herzschlag) blieb wie bisher; dafür dämpft die Musik jetzt (Tiefpass ab HP < 30).
**Dynamische Musik:** 16tel-Sequenzer mit Vorausplanung in Web-Audio-Zeit. Intensität `I` 0–1 (Anstieg schnell, Abfall langsam): **Erkunden** (~0,1: Pad-Drohne in Biom-Tonart) → **Kampf** (0,36–0,7 je wache Gegner in 22 Feldern; + Bass, Kick, Hats, ab ~0,55 Arpeggio/Snare) → **Elite** (~0,84: Stabs, Riser, Vier-auf-den-Boden) → **Boss** (1,0: Sub-Doppler, 16tel-Hats; Tempo 96/112/128/148 und Wurzeltöne 55/49/44/58 je Boss-Variante/Phase wie die alte Boss-Musik, ab Phase 3 Stabs + b5, Phase 4 Doppel-Kick). Alarm hebt auf ≥ 0,5, Stil-Hitze addiert bis +0,12. Tonarten je Biom (Anlage / Schlucht / Wüste / Dschungel, unbekannte Biome → Anlage). Titel: leises Pad, Pause: gedämpft, Tod/Sektor-Ende/Kampagnen-Ende: Stille. Die alte Boss-Kampfmusik (`Boss.music`) ist abgeschaltet (`return`).
**Angepasst:** `initAudio` (Busse), `tone`/`noise`/Ambient (Bus), `Boss.music`, `startReload`/`finishReload`, `damageEnemy` (`sfx.kill(d,e)`), `nextPhase` (`bossPhase(e.bp)`), `frame` (`Snd.tick`), `NX.phase`=18, `sw.js` (Cache v9). `SAVE_VERSION` bleibt 2.
**Konsole:** `__breach.Snd.state()`, `.force('boss',20)` (`erkunden|kampf|elite|boss`, Sekunden), `.boom(1,1.5,1)`, `__breach.NX.audio.sfx.rail()`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 19 bitte `t_boot.js`, `t_boss.js`, `t_soak.js` einzeln starten (Tests, die `sfx`/`tone`-Stubs erwarten, könnten wegen der neuen Busse anschlagen).
**Bitte live prüfen (Ohren!):** Musik-Lautstärke gegenüber SFX (Master .32, Musikbus .85), Timing/Knacksen des Sequenzers (Handy!), Übergang Kampf↔Erkunden (zu hektisch?), Boss-Musik je Phase, ob Ducking zu stark pumpt (Railgun/Explosionen), Hall zu dick, Mute-Umschalter (`Ton aus` stoppt Musik + Pad), Performance bei viel Feuer (Stimmen-Limit 56), Musik startet erst nach dem ersten Tipp/Klick (Browser-Autoplay).

## Phase 17 — Combo / Style System
Modul `Style` (nach `Missions`, auch `__breach.Style`). Arcade-Score mit Multiplikator **×1 / ×2 / ×3 / ×5 / ×10**. `heat` 0–100, Schwellen 25 / 50 / 75 / 95. Der alte Combat-Tracker (Kill-Kette/Streak, Element `#combo`) bleibt unverändert daneben.
**Steigt durch:** Kill (+12 Heat, Elite +18, Boss +40; Punkte `10+0,45·maxHP`, max 400, Elite ×2, Boss ×5) · **Schnell** (Kill < 1,5 s nach dem vorigen: +25 P, +6 H) · **Multi-Kill** (< 0,6 s: +60·(n−1) P, +8·(n−1) H) · **Krit** (+30 P, +5 H, jeder Krit-Treffer +2 H) · **Explosion** (Kill im `splash()`: +40 P, +8 H) · **Dash-Kill** (Dash aktiv oder < 1,2 s her: +50 P, +10 H) · **Umgebung** (Delta `Hazards.stats.envKills`: +60 P, +10 H) · **Unberührt** (alle 12 s im Kampf ohne Schaden: +40 P, +6 H). Punkte werden mit dem aktuellen Multiplikator multipliziert. *Kopfschüsse gibt es im Raycaster nicht → zählt als Krit.*
**Fällt bei:** Schaden (Heat ×0,8 bei Treffern < 3, sonst ×0,35; höchstens 1× je 0,8 s, damit Umgebungs-DOT nicht alles zerlegt; Meldung „KOMBO GEBROCHEN“ ab ×3-Stufe) · Leerlauf (2,6 s Haltezeit, dann Zerfall `8+0,12·Heat` pro s) · Tod (Heat 0, Punkte bleiben im Lauf).
**Sektor-Rang** D–S = Spitzen-Multiplikator im Sektor (+1 Rang bei null Schaden, max S), Credit-Bonus `[0,6,12,22,40]` + 2·Tiefe (ab Rang C). Ergebnis-Screen: Stil-Rang, Sektor-Punkte, Stil-Bonus; bei „Lauf beendet“/Kampagnen-Ende zusätzlich Punkte (+„NEUER REKORD“), Bestwert, höchster Multiplikator.
**Save:** `Save.data.bestScore` (war schon im Schema), `meta.cnt.x10`; neue Ziele **Punktejäger** (5 k / 25 k / 100 k / 400 k) und **Überlast** (×10-Kombos 1/10/40/100); Archiv → Rekorde zeigt „Beste Punktzahl“. `SAVE_VERSION` bleibt 2.
**HUD/Feedback:** `#stHud` (links unter `#combo`): großer Multiplikator in Tierfarbe (grau/cyan/amber/rot/violett), Heat-Balken, `PUNKTE n` (zählt weich hoch); `#stPop` (unter dem Fadenkreuz, max. 3 Zeilen, 1,5 s, CSS-Animation, `.rm` stoppt sie). Tier-Aufstieg: Meldung + Klang `stTier` + leichter Kick, Bruch: `stBreak`. DOM nur bei Änderung.
**Angepasst:** `damageEnemy` (Krit/Kill), `splash` (Explosions-Flag), `hurtPlayer`, `tryDash`, `die`, `update` (`Style.tick`), `newRun` (`reset`), `startLevel` (`onSector`), `finishLevel`, `finishRun`, `Meta.CH`/Rekorde, `sw.js` (Cache v8), `NX.phase`=17.
**Konsole:** `__breach.Style.state()`, `.add(200,30,'TEST')`, `.heat=99`.

**Getestet — bewusst nur `node --check`.** Keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 18 bitte `t_boot.js`, `t_save.js`, `t_soak.js` einzeln starten.
**Bitte live prüfen:** Position/Überlappung von `#stHud` mit `#combo`/`#msHud` (Handy Hochformat!), Lesbarkeit von `#stPop` über dem Geschehen, Balance (×10 erreichbar? Zerfall zu schnell/langsam?), ob Heat-Verlust bei DOT-Schaden fair ist, Explosions-Kills bei Plasma/Fässern.

## Phase 16 — Mission System
Modul `Missions` (direkt nach `Meta`, auch `__breach.Missions`). Pro Sektor **2 optionale Missionen (ab Tiefe 6: 3)**, beim ersten Spiel-Frame gewürfelt (nur machbare), gelten für Zufallslauf **und** Story-Sektoren; nach Tod-Neustart bleiben dieselben (`lvl._ms`), Fortschritt startet neu. Boss-Ebene: „Ohne Dash“ ist immer dabei. Etagenwechsel (Treppe) wertet die Ziele der Etage aus (`onFinish(true)`).

| ID | Mission | Erfolg / Fehlschlag |
|---|---|---|
| `nodmg` Makellos | 5+⌊Tiefe/2⌋ (max 14, höchstens ~70 % der Gegner) Kills am Stück ohne Schaden | Treffer setzt den Zähler zurück; Erfolg sofort |
| `speed` Schnellläufer | Sektor unter Par: `max(120, 70+7·Gegner)` s (auf 5 gerundet) | HUD-Countdown; Fehlschlag bei Zeitüberschreitung |
| `plasma` Nur Plasma | 4–8 Kills nur mit Plasma-Kanone (nur wenn im Besitz) | anderer Waffenkill = Fehlschlag; Auswertung am Sektorende |
| `nohp` Ohne Heilung | keine Health-Pickups (`h` und Loot-HP) nehmen | Aufnahme = Fehlschlag; Erfolg am Sektorende |
| `elite` Elite-Jäger | 2–3 Elite-Gegner besiegen (nur wenn ≥ 2 im Sektor) | sofort |
| `secret` Geheimnis | Geheimraum/Tresor (Phase-10-Ereignis) öffnen (nur wenn vorhanden) | sofort |
| `bossnd` Ohne Dash | Boss ohne Dash besiegen | Dash während Boss = Fehlschlag |
| `shards` Datensammler | alle MOGC-Splitter des Sektors | Sektorende |

**Belohnung:** Credits `(22+8·Tiefe)·(1+0,5·(Stufe−1))` (Stufe 1–3 je Mission) + Bonus (Chance 50/75/100 %): MOGC · Perk-Kern (ab Stufe 2) · Waffen-Mod · **Kosmetik** (6 „Signalfarben“, dauerhaft in `Save.data.cosmetics{own,sel}`; Fallback +25 Cr). Zählt `meta.cnt.missions`; neues Meta-Ziel **Missionar** (Phase 15).
**Kosmetik** (Archiv → Tab „Kosmetik“): färbt Fadenkreuz (`--cyan` auf `#xh`), `#msHud`-Kreis und Missionszeile. Kein neues Save-Feld-Schema nötig: `cosmetics` hat Default in `sanitize` (SAVE_VERSION bleibt 2).
**HUD:** ein DOM-Element `#msHud` (oben links unter `#top`), nur bei Änderung aktualisiert; Ergebnis-Screen zeigt „Missionen x / y“ + je erfüllte Mission.
**Angepasst:** `parseLevel` (`Missions.setup`), `hurtPlayer`, `updatePickups` + `Loot.take` (Heilung), `damageEnemy`, `tryDash`, `Events.openPocket`, `update` (`tick`), `finishLevel`, `climbStairs`, Archiv (Tab), `sw.js` (Cache v7), `NX.phase`=16.
**Konsole:** `__breach.Missions.force('speed')` (IDs s. o.), `.state()`, `.equip('amber')`.

**Getestet — bewusst nur `node --check`.** Keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 17 bitte `t_boot.js`, `t_save.js`, `t_soak.js` einzeln starten.
**Bitte live prüfen:** Position/Lesbarkeit von `#msHud` (Handy Hochformat, Kollision mit `#top`/Minimap), ob Fadenkreuz-Farbe greift, Balance (Par-Zeit, Kill-Ziele, Belohnungen), ob „Nur Plasma“ durch Umgebungs-Kills unfair fehlschlägt, Nachricht beim Sektorstart vs. Level-Intro.

## Phase 15 — Meta Progression
Modul `Meta` (direkt nach `Perks`, auch `__breach.Meta`). Alles in `Save.data` (LocalStorage, offline). **`SAVE_VERSION` = 2**: `MIGRATIONS[1]` ergänzt `meta`, `challenges`, `records`; alte Saves (v1) werden beim Laden migriert, `sanitize` bereinigt die neuen Felder.
**Neue Save-Felder:** `meta{up,tune,start,cnt}` · `challenges{id:Stufe}` · `records{sector{Tiefe:Zeit},bosses{Variante:Anzahl},bestKills,bestStreak}`. Vorhandene Felder (Credits, `unlockedWeapons`, `perks`, `artifacts`, `highestDepth`, `bestTime`, `stats`) werden weiter genutzt.
**Charakter-Upgrades** (Credits, Kosten `Basis·(1+0,9·Stufe)`): Panzerkern (+8 Panzerung/St., max 5) · Schildmatrix (+6 Schild, +1 Regen) · Energiekern (+8 Energie, +2 Regen) · Nanoreparatur (+0,15 HP/s, max 4) · Servo-Antrieb (+2 % Tempo, max 4) · Zielsystem (+1 % Krit, +4 % Krit-Schaden) · Phantomkondensator (Dash −0,06 s CD, +0,15 Weite, Stufe 3 = Doppel-Dash, max 3) · Einsatzpaket (+6 Startzellen, +5 % Sektor-Panzerung) · Kern-Vorrat (Zufallslauf startet mit 1–2 Perk-Kernen, max 2). Laufen über `Stats` (`meta:up`, bleibt bei `newRun` erhalten).
**Waffen:** *Start-Lizenz* (Shotgun 300 · Overclock 600 · Plasma 1000 · Arc 1500 · Rail 1800 · Void 2800 · Singularität 4500 Cr) legt die Waffe zu Beginn jedes **Zufallslaufs** ins Arsenal (nur wenn die Waffe schon einmal gefunden wurde, Story-Modus unberührt). *Feinabstimmung* je Waffe, 5 Stufen (100+120·Stufe Cr): +6 % Schaden, +1 % Krit je Stufe (`Mods.build`, sichtbar im Loadout).
**Herausforderungen** (11 dauerhafte Ziele mit je 4 Stufen, automatische Auszahlung in `Meta.check()`): Rogue-Jäger, Wächter-Bezwinger, Tiefenläufer, Sektor-Räumer, Dauerbrenner, Elite-Schlächter, Perk-Sammler, Artefakt-Archiv, Arsenal, Kill-Serie, Aufrüster. Bereits erreichte Stufen bestehender Saves werden beim ersten Check rückwirkend ausgezahlt.
**Rekorde/Prämien:** Bestzeit je Tiefe (Meldung bei Verbesserung), Boss-Kills je Variante, meiste Kills im Lauf, längste Serie. Neu: *Sektor-Prämie* `5+3·Tiefe` Cr (Zufallslauf) und *Lauf-Prämie* `12·Tiefe + Kills/2` Cr beim „Lauf beenden“ (Ergebniszeilen).
**UI:** Screen **Archiv** (Tabs Upgrades · Waffen · Ziele · Rekorde, Buttons ≥ 48 px, Scroll bleibt beim Kaufen erhalten) — Titel-Button „Archiv“ sowie Button in Tod-/Sektor-/Lauf-Ende-Overlays (`addMetaBtn`, `addLoadoutBtn` hängt ihn mit an). Nicht im Pause-Menü.
**Angepasst:** `Save` (Schema/Migration), `Mods.build` (Tuning), `damageEnemy` (`Meta.onKill`), `finishLevel`, `finishRun`, `startProceduralRun` (`Meta.onProcStart`), `startLevel` (Startzellen), `showTitle`, `sw.js` (Cache v6), `NX.phase` = 15.
**Konsole:** `__breach.Meta.state()`, `.screen()`, `.buyUp('armor')`, `.check()`; Testguthaben: `__breach.NX.save.data.credits+=5000`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). `t_save.js` prüft evtl. noch `SAVE_VERSION`=1 und kann anschlagen (erwartet); vor Phase 16 bitte `t_boot.js`, `t_save.js`, `t_soak.js` einzeln starten.
**Bitte live prüfen:** Archiv-Screen auf dem Handy (Hochformat, Scrollen, Tabs), Preise/Balance (Credits-Fluss vs. Upgrade-Kosten), ob Start-Lizenz + Startzellen im Zufallslauf greifen, Migration mit einem echten v1-Save, rückwirkende Ziel-Auszahlung beim ersten Öffnen.

## Phase 14 — Perk System
Modul `Perks` (direkt nach `Loot`, auch `__breach.Perks`). **10 Perks**, je Stufe I–III (Stapeln = Stufe hoch), Werte über `Stats` (`run:perk:*`), gehören zum Lauf (`newRun` → `Perks.reset`). Perks werden mit **Perk-Kernen** (`Loot.cores`) gekauft: Wahl 1 aus 3 (Overlay „Perk wählen“, Karten ≥ 56 px, Button „Später“ = 45 s Ruhe).

| Perk | Stufe I / II / III |
|---|---|
| BLOOD CIRCUIT | Kills heilen +2 / +3 / +5 HP |
| OVERDRIVE | Feuerrate +25 / 40 / 55 % |
| VOID HEART | Krits explodieren: 40 / 60 / 85 % des Treffers, R 1,2 / 1,5 / 1,8 (0,12 s Sperre, kein Kettenreaktions-Sturm) |
| PHANTOM STEP | Dash-Abklingzeit −0,2 / −0,35 / −0,5 s, Weite +0,4 / 0,7 / 1,0, Dauer −0,02 / −0,03 / −0,04 s |
| IRON CORE | max. Panzerung +15 / 25 / 40, Absorption +5 / 10 / 15 % (60 % des Zuwachses sofort gefüllt) |
| NEXUS MIND | Energie-Regen +10 / 18 / 28, max. Energie +10 / 20 / 30 |
| REAPER | Schaden +3 / 4 / 5 % je Kill-Stapel (max. 6 / 8 / 10, 4 s nach dem letzten Kill zerfällt je 1,1 s ein Stapel, Reset bei Sektorstart) |
| KINETIC BARRIER | Kills geben +5 / 8 / 12 Schild |
| DEADEYE | Krit +6 / 10 / 15 %, Krit-Schaden +20 / 35 / 50 % |
| GHOST PROTOCOL | Schild-Regen +4 / 7 / 11, Regen-Start −0,8 / 1,4 / 2 s |

**Synergien** (automatisch, wenn beide Perks vorhanden, Meldung + Klang beim ersten Mal): TREFFERSTURM (Overdrive+Deadeye: +8 % Krit) · SUPERNOVA (Void Heart+Deadeye: Explosionen +25 % Schaden/Radius) · BLUTERNTE (Blood+Reaper: +1 HP je 3 Kill-Stapel) · PHANTOM-SCHILD (Phantom+Ghost: Dash +20 Schild) · KERN-VERBUND (Iron+Nexus: +4 % Resistenz, +6 Energie-Regen). Angebote bevorzugen Perks, die eine Synergie vervollständigen (Gewicht +1,4) und bereits gestapelte (×1,3); maximierte fallen weg.
**Perk-Kerne (Quellen):** Loot-Pickup `perk` (ab Selten) und Boss-Beute (Phase 13) · Sektor-Abschluss (**Boss-Sektor +1, sonst jeder 2. Sektor im Lauf**, Zeile „Perk-Kern“ im Ergebnis) · **jeder 4. Elite-Kill**. Angebot öffnet sich automatisch, wenn ≥ 1 Kern da ist und ≥ 2 s lang kein Gegner im Kampf ist (nie mitten im Gefecht); alternativ Pause-Menü → **Perks (n)** (auch Übersicht der Perks/Synergien ohne Kern, Touch-tauglich). Schließen per Esc bricht ab (Kern bleibt).
**HUD:** `#lootHud` zeigt zusätzlich `PERKS n · REAPER ×k`. Save: `Save.data.perks[id]={n,max}` (wie oft gewählt, höchste Stufe) für Phase 15/Achievements; `SAVE_VERSION` bleibt 1.
**Angepasst:** `hitEnemy` (`Perks.onCrit`), `tryDash` (`Perks.onDash`), `damageEnemy` (`Perks.onKill`), `finishLevel` (`Perks.onSector`), `parseLevel` (`Perks.onLevel`), `update` (`Perks.tick`), `newRun` (`Perks.reset`), `pauseMenu` (Button), `Loot` (`extra`-Hook fürs HUD, Perk-Kern-Meldung), `sw.js` (Cache v5). Statistik `Perks.stats` (offers/picked/cores/synergies/healed/booms).
**Konsole:** `__breach.Perks.give('reaper')` (IDs: `blood over voidh phantom iron nexus reaper kinetic dead ghost`), `__breach.Loot.cores=3; __breach.Perks.offer()`, `.state()`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 15 bitte `t_boot.js`, `t_boss.js`, `t_soak.js` einzeln starten (`t_player`/`t_hud` könnten wegen neuer Pause-Buttons/Stats anschlagen).
**Bitte live prüfen:** Perk-Overlay auf dem Handy (Hochformat, Kartenhöhe/Scrollen), ob das automatische Öffnen nicht stört (2 s Ruhe), Balance (Phantom Step, Reaper-Stapel, Void-Heart-Explosionen bei Schrotflinte), Esc/Pause während Overlay, Position der HUD-Zeile.

## Phase 13 — Pickup & Loot System
Modul `Loot` (direkt nach `Hazards`, auch `__breach.Loot`). Alte Pickups (`h a m`, Waffen, Biom-Pickups, Ereignis-Drops) bleiben unverändert. Loot ist Pickup-Art `L` (`{kind:'L', loot:{t,r}}`), Spind `Q`/`Qo` ein festes Pickup.

**Raritäten** `r` 0–5: Gewöhnlich (grau) · Ungewöhnlich (grün) · Selten (blau, ab Tiefe 2) · Episch (violett, ab 4) · Legendär (amber, ab 7) · Void (magenta, ab 12). Gewichte wachsen mit Tiefe und `Loot.luck`; Common schrumpft. Kills/Truhen können eine Mindest-Rarität erzwingen.
**Loot-Arten** (Wert je Rarität I→VI): `hp` 20/30/45/60/80/100 · `ammo` 8/14/22/32/45/70 · `energy` 35/50/70/90/100/100 % · `shield` 30/50/75/100/100/100 % · `cr` (6+3·Tiefe)×1/1,6/2,6/4,5/8/14 · `mogc` 1/1/2/3/5/8 (zählt auch in `totals.shards`) · `wmod` (Waffen-Mod, Tiefe +0/0/2/4/7/10) · `amod` · `perk` (ab Selten) · `art` (ab Legendär) · `key`. Typwahl ist „klug“: HP/Munition/Energie/Schild werden bei Bedarf doppelt gewichtet, bei vollem Wert stark gedrosselt (voller Wert = Pickup bleibt liegen, wie bei `h`).
**Panzerungs-Mods** (`run:am:<slot>`, 6 Slots, je Slot nur die beste Rarität, sonst Duplikat → Credits): Panzerplatte (max. Panzerung) · Dämpfer-Gel (Resistenz) · Servo-Gelenke (Tempo) · Schildmatrix (max. Schild + Regen) · Nanogewebe (HP/s) · Energiekern (max. Energie + Regen). Laufen über `Stats`, verschwinden mit `newRun()`.
**Artefakte** (8, dauerhaft in `Save.data.artifacts`, `Stats` `meta:art:*`, Duplikate/alle gefunden → Credits): Kalter Kern, Splitter-Linse, Dietrich-Chip (Spinde +1 Beute), Phasenstein, Schwarzglas, Sonnenscherbe, Glücksmünze (Rarität), Void-Herz. Wird beim Start und nach jedem Fund über `Loot.applyArtifacts()` gesetzt. **Perk-Kerne**: `Loot.cores` (pro Lauf), `Loot.takeCore()` für Phase 14.
**Quellen:** *Kill-Drops* (nur Zustand `play`): Basis 7 % + 0,4 %/Tiefe (max. 13 %), Schwarm ×0,35, Tank/Juggernaut/Beschwörer/Sniper/Support/Schild ×2,2, Assassine ×1,8, max. alle 0,25 s; gewöhnlich/ungewöhnlich verschwinden nach 45 s (Blinken die letzten 6 s), max. 48 Loot-Pickups. Loot von Kills wird **magnetisch** angezogen (Radius ~1,8). *Elite*: 1 garantierter Wurf (Mindest ungewöhnlich, mit 2 Modifikatoren selten), 25 % zweiter, 35 % Zugangskarte — zusätzlich zu den alten Elite-Drops. *Boss*: 3 Würfe (Mindest selten/selten/episch), 1 Perk-Kern, 1 Zugangskarte, 45 % Artefakt. *Level*: `min(8, 2+⌊Tiefe/2⌋)` Loot-Stücke (Boss-Ebene halb), ≥ 6 Felder Weg vom Start, Abstand 4,5 zu Pickups/Ereignissen und ≥ 2,4–2,6 zu Fallen/Gefahren (neu: `Biome.near`, `Hazards.near`).
**Sicherheitsspind (ab Tiefe 2):** 1 pro Ebene, weit vom Start (≥ 10 Felder Weg), dazu eine **Zugangskarte** ≥ 7 Felder davon entfernt auf der Ebene (ohne Karte gäbe es keinen Spind). Nähe < 1 Feld mit Karte: Spind öffnet (verbraucht 1 Karte, max. 3 im Besitz), 3 (+1 Artefakt, +1 ab Tiefe 8) Beute-Stücke, erstes mindestens selten. Ohne Karte: Hinweis (alle 3 s). Erste Sichtung (< 6,5 Felder) zeigt einen Hinweis.
**Optik/HUD:** je Art ein 64×64-Icon (blind gezeichnet), pulsierender Ring in Raritätsfarbe (Karte cyan), ab Episch ein Lichtstrahl. Meldung in Raritätsfarbe (`showMsg` setzt die Farbe zurück, Loot färbt danach). Neue Zeile `#lootHud` (ein DOM-Element, unten mittig über der Leiste): `KARTE ×n · PERK-KERN ×n · ARTEFAKTE n`, nur bei Inhalt und im Spiel. Klang: `lootR` (steigt mit Rarität, ab Legendär Nachhall), `lootDrop`, `chestOpen`.
**Angepasst:** `parseLevel` (`Loot.setup()` nach `Hazards.setup()`), `damageEnemy` (`Loot.onKill`), `updatePickups` (Kind `L`), `renderSprites` (`Loot.draw`), `update` (`Loot.tick`), `newRun` (`Loot.reset`), `showMsg`, `Biome`/`Hazards` (`near`), `sw.js` (Cache v4). `SAVE_VERSION` bleibt 1. Statistik `Loot.stats` (dropped/taken/byRar/chests/keys/artifacts/credits/dupes) für Phase 16/17.
**Konsole:** `__breach.Loot.force('art',5)` (Art: `hp ammo energy shield cr mogc wmod amod perk art key`, Rarität 0–5, 1,6–4 Felder vor dir), `.state()`, `.roll(tiefe)`, `.ART`, `.AMOD`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Keine Suiten, kein `t_boot`, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 14 bitte `t_boot.js`, `t_boss.js`, `t_soak.js` einzeln starten (`t_hud`/`t_save` sind unberührt).
**Bitte live prüfen:** Lesbarkeit/Höhe von Icon, Ring und Strahl (blind gezeichnet, Ring `vo = bob−0,06`), ob Spind + Karte auf jeder Ebene erreichbar sind, Position von `#lootHud` (Handy Hochformat, Kollision mit Touch-Buttons), Drop-Raten/Balance (v. a. Boss-Beute zusätzlich zu den alten Boss-Belohnungen), Magnet-Gefühl, Perk-Kerne haben bis Phase 14 noch keinen Nutzen.

## Phase 12 — Environmental Hazards
Modul `Hazards` (direkt nach `Biome`, auch `__breach.Hazards`, `NX.level.hazards.env`). Läuft **zusätzlich** zu den Biom-Fallen/-Gefahren aus Phase 11. Nur prozedurale Ebenen ab Tiefe 2; Anzahl `min(8, 1+⌊(Tiefe+1)/2⌋)` (Boss-Ebene halb, dort keine Presse/Gas/Void). Platzierung wie Phase 11 (≥ 8 Felder Weg vom Start, freie Räume, Abstand 3,6 zu Fallen/Pickups/Ereignissen, nie in der Arena). Gewichte je Biom in `Hazards.RULE` (auch für Biome 5–10 vorbereitet).

| Art | Wirkung (Spieler) | Wirkung (Gegner) / Besonderheit |
|---|---|---|
| **Lava** `lava` (R 1,15) | 4+0,3·Tiefe alle 0,5 s + **Brennen** 2,5 s, Tempo ×0,78 | 12+Tiefe alle 0,5 s |
| **Gasleck** `gas` (R 2,0) | Zyklus 13,2 s (5 s ruhig, 1,2 s Aufbau, 6 s aktiv): **Gift** (1+⌊Tiefe/8⌋ HP/s, tötet nie, sperrt HP-Regen) | 3+0,3·Tiefe; **entzündbar**: Feuer, Explosion, Blitz, Plasma zünden es → Explosion (18+1,4·Tiefe) + Feuerflächen |
| **Tesla-Spule** `tesla` | Takt 3,4 s: 0,8 s Aufladen (Ton) → Blitz aufs **nächste Ziel** (Spieler oder Gegner, R 4,8, Sichtlinie): 9+0,8·Tiefe + 25 Energie | Gegner 26+1,6·Tiefe (Köder-Taktik) |
| **Strahlung** `rad` (R 2,3) | Schild lädt nicht, −8 Energie/s, ~½ HP/s (nicht tödlich), **Geigerzähler** tickt schon 4 Felder vorher | – |
| **Säure** `acid` (R 1,15) | frisst **Panzerung** (18/s), dazu 2+0,25·Tiefe alle 0,5 s, Tempo ×0,78 | 6+0,6·Tiefe |
| **Flammendüse** `fire` | Takt 3,8 s: 2 s ruhig → 0,8 s Zischen → 1 s Feuerstoß (R 1,3): 4+0,4·Tiefe alle 0,25 s + Brennen 3 s | 10+0,8·Tiefe; zündet Gas |
| **Kältezone** `frost` (R 2,4) | Frost +34 %/s (−22 %/s außerhalb), Tempo bis −45 %; bei 100 % **erstarrt** (1,3 s, Tempo ×0,12, **Dash befreit**); Brennen kühlt ab | – |
| **Void-Riss** `voidz` (R 2,6) | Sog (Dash widersteht), −10 Energie/s, −4 Schild/s; Kern (< 0,6) **teleportiert** 6–14 Felder weit (10+0,6·Tiefe Schaden, 2,5 s Pause) | Gegner werden gezogen, im Kern 40+2·Tiefe; **verschluckt gegnerische Schüsse** (Deckung) |
| **Lasergitter** `laser` | Strahl (3,2–4,6 lang) **wandert** ±1,4–2,2 quer; 4,5 s an / 1,6 s aus (0,4 s Flackern vorher): 11+0,9·Tiefe, Pause 0,8 s | Bahn beim Platzieren komplett frei geprüft |
| **Sprengfass** `barrel` | HP 10, schießbar (Hitscan/Rail/Arc/Projektil/Gegnerschüsse); Explosion R 2,7: 26+1,4·Tiefe (Abfall −50 %, Sichtlinie); 60% Chance auf Gruppe mit 1–2 Nachbarn → **Kettenreaktion** (0,08–0,22 s Verzug) | 60+3·Tiefe; 3 Feuerflächen (4–6 s), zündet Gas, beschädigt Türme |
| **Presse** `crusher` | 1 Zelle, Zyklus 6,2 s: offen → 1,2 s rotes Blinken (Ton) → 0,9 s **geschlossen (Wandtyp 3)**; wer drin steht, wird zur Nachbarzelle geschoben und erleidet 24+1,5·Tiefe (Dash = I-Frames) | 70+3·Tiefe (Umgebungs-Kill) |
| **Sicherheitsturm** `turret` | HP 40+2,5·Tiefe, schießbar; sieht bis 11 (Sichtlinie), 0,9 s Zielen (roter Laser, Ziel rastet 0,3 s vorher ein), 3er-Salve à 6+0,5·Tiefe, Pause ~2 s; weckt Gegner (Radius 6) | 35 % Munitionsdrop; **Sicherheits-Override (Phase 10) schaltet Laser, Türme, Tesla ab** |

**Feuerflächen** (dynamisch, max. 24): 4+0,4·Tiefe alle 0,5 s + Brennen; Gegner 10+0,8·Tiefe. **Brennen**: 3+0,3·Tiefe alle 0,6 s (Schild wird dadurch am Laden gehindert), endet bei Frost. **Gegner-Schaden** läuft im 0,5-s-Takt; Boss nimmt nur ½ Explosionsschaden. Gefahren ohne Dash-Schutz: nur Void-Sog (Dash widersteht) und Gift/Strahlung (nicht tödlich).
**HUD/Optik:** ein einziges DOM-Element `#hzFx` (Randschleier je Status: Brennen orange, Frost blau, Strahlung gelbgrün, Gift grün, Säure lime, Void violett), nur bei Änderung aktualisiert. Erster Kontakt (< 6,5 Felder) je Art zeigt einen Hinweis (1× pro Lauf, max. alle 4 s). Sprites blind gezeichnet (Zonen als flache Scheiben, `sc = R·2,5`).
**Klang:** `hzZap hzCharge hzGeiger hzBoom hzLava hzAcid hzFire hzGas hzVoid hzTele hzLaser hzLaserHit hzCrushW hzCrush hzTurret hzTurDie hzFreeze hzOff` + Blubbern/Brummen in 7 Feldern Nähe.
**Angepasst:** `Biome` (exportiert `cells`, `traps`), `hitscan`/`fireRail`/`fireArc`/`updatePshots`/`splash`/`updateShots` (Fässer & Türme treffen), `Events` (Override → `Hazards.disable()`), `parseLevel`, `newRun`, `update` (Tick + Tempo-Faktor `Hazards.speedMul()`), `renderSprites`, `NX.level.hazards`, `sw.js` (Cache v3). `SAVE_VERSION` bleibt 1. Statistik `Hazards.stats` (placed/contacts/envKills/barrels/turrets/crushes/ignites/teleports) für Phase 16/17 (Umgebungs-Kills).
**Konsole:** `__breach.Hazards.force('lava'|'gas'|'tesla'|'rad'|'acid'|'fire'|'frost'|'voidz'|'laser'|'barrel'|'crusher'|'turret')` (2,5–5 Felder vor dir, nur prozedurale Ebene), `.state()`, `.disable()`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Kein `t_boot`, keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 13 bitte `t_boot.js`, `t_boss.js`, `t_soak.js` einzeln starten.
**Bitte live prüfen:** Lesbarkeit/Höhe der neuen Bodensprites (Zonen, Gas, Presse, Laserpunkte), ob Zonen in kleinen Räumen den Weg zu stark blockieren, Presse (wird man immer sauber herausgeschoben? Minimap zeigt geschlossene Zelle nicht), Fairness Tesla/Laser/Turm, Lava-Schaden, Frost-Dauer, Void-Teleport-Ziel, Fass-Kettenreaktion + Performance (Sprite-Anzahl bei Lasern), Balance Override (schaltet Tesla mit ab), ob Beams (`arc`) der Tesla-Spule sichtbar sind.

## Phase 11 — Biome Overhaul
Modul `Biome` (direkt nach `Events`, auch `__breach.Biome`). Roster (Phase 6/7) und Ereignis-Gewichte (Phase 10) waren schon je Biom verschieden und bleiben; neu:

| Biom | Falle (statisch, ab Tiefe 2) | Gefahr (dynamisch, ab Tiefe 2, **nicht auf Boss-Ebenen**) | Pickup | Nebel / Sicht | Elite-Schwerpunkt (Faktor Chance) |
|---|---|---|---|---|---|
| Anlage | **Stromplatte** `arc`: Takt 3,4 s (2,0 s ruhig → 0,8 s Warnflackern → Entladung), Treffer 10+0,9·Tiefe + 20 Energie | **Überspannung** `surge`: alle 26–42 s: 1,1 s Warnung (Randleuchten), alle Platten entladen gleichzeitig, −20 % Energie | Energiezelle `bE` (Energie voll, Schild +30) | #04060C, 17 | Überladen/Reflektierend/Gepanzert (×1,0) |
| Schlucht | **Dampfschlot** `vent`: Takt 4,2 s (Zischen → Ausbruch 0,7 s), 9+0,8·Tiefe + Rückstoß | **Steinschlag** `rocks`: alle 9–14 s (ab Tiefe 9 zwei) roter Ring 1,35 s, dann Einschlag R 1,15: Spieler 14+0,9·Tiefe, Gegner 26+1,5·Tiefe | Panzerplatte `bP` (+20 Panzerung) | rostbraun, 19 | Gepanzert/Berserker (×1,1) |
| Wüste | **Treibsand** `sand`: Tempo ×0,5 im Radius 1,05 (Dash befreit) | **Sandsturm** `storm`: alle 38–65 s, 13–19 s, Rampe 2,5 s: Sicht bis −42 %, Gegner sehen ×0,7, Staub/Schleier | Kühlkern `bK` (Hitze 0, Energie +35) | sandgelb, 15,5 | Phasen/Vampir/Void (×1,15) |
| Dschungel | **Rankenfalle** `snare`: hält 1,3 s fest (Tempo ×0,12), lockt Gegner (Radius 6), lädt nach 12 s neu; Dash befreit | **Sporenwolken** `spores`: alle 8–13 s (max. 3, 13 s, R 1,7): Gift 4,5 s nach Verlassen, 1+⌊Tiefe/6⌋ HP/s, **tötet nie (min. 1 HP)**, sperrt HP-Regeneration | Bio-Gel `bG` (+30 HP, heilt Gift/Fessel) | dunkelgrün, 13,5 | Brut/Vampir/Berserker (×1,25) |

**Anzahl:** Fallen `min(11, 2+⌊0,9·Tiefe⌋)` (Boss-Ebene halb), Biom-Pickups `min(5, 2+⌊(Tiefe−1)/4⌋)`; Platzierung wie Ereignisse (erreichbar ≥ 7 Felder Weg vom Start, nicht an Wänden, nicht in Arena/Ausgang/Treppe, Abstand 4 bzw. 6).
**Atmosphäre:** `FR/FG/FB/FOGC/MAXD` sind jetzt `let` und werden je Biom gesetzt (`Biome.apply` in `setup`); DOM `#bmFx` (Randschleier + 2 Partikelschichten per CSS, folgt Einstellung `particles`, `.rm` stoppt Animation; Sandsturm verstärkt), einmal erzeugt, Updates nur bei Änderung.
**Elite:** `Elite.assign` wählt gewichtet (`Biome.pickElite`), `Roles.rollElite` skaliert die Chance (`Biome.eliteMul`, Deckel 30 %).
**Fortschritt:** Banner `#bmBan` „SEKTORWECHSEL · BIOM n · Name · Beschreibung · Gefahren“ beim ersten Betreten eines Bioms im Lauf und bei jedem Wechsel (Tiefe 4, 7, 10 …), +15+10·Stufe Credits und +10 Panzerung (einmal je Tiefe und Lauf). Erster Kontakt mit Falle/Gefahr zeigt einen Hinweis (einmal pro Lauf).
**Klang:** `ambientTick` je Biom drei Varianten (Anlage Piepen/Servo/Klacken · Schlucht Grollen/Wind/Steine · Wüste Rauschen/Heulen/Zischen · Dschungel Vogel/Insekten/Quaken); neue Sounds `bmWarn bmZap bmHiss bmRock bmRoot bmSpore bmSurge bmPick bmBan`.
**Vorbereitet (Biome 5–10):** `Biome.PREP` = Eiswüste, Tote Stadt, Alien-Nest, Orbitalstation, Void-Dimension, Singularitäts-Kern mit Nebel/Schleier/Partikelfarbe und geplanten Mechaniken (`plan`, Phase 12). Texturen, Roster und `BIOMES`-Eintrag sind Alias eines Basis-Bioms; **nicht** in `BIOME_ORDER` (`Biome.enable('frozen')` hängt eines an, Sprites/Ambient/Events fallen auf Anlage zurück). Eigene Texturen/Roster/Fallen kommen mit Phase 12/20.
**Angepasst:** `parseLevel` (`Biome.setup` nach `Events.setup`), `update` (`Biome.tick`, Tempo-Faktor), `AI` (Sicht × `Biome.sightMul`), `updatePickups` (Kinds mit 2 Zeichen → `Biome.take`), `renderSprites` (`Biome.draw`), `newRun` (`Biome.reset`), `ambientTick`. `NX.level.hazards` = `Biome.state()`. `SAVE_VERSION` bleibt 1.
**Konsole:** `__breach.Biome.force('rocks'|'surge'|'storm'|'spores')`, `.state()`, `.stats`, `.enable('frozen')`.

**Getestet — bewusst nur `node --check` (Syntax ok).** Kein `t_boot`, keine Suiten, KEIN Browser (auf Wunsch wegen Kontext). Vor Phase 12 bitte `t_boot.js`, `t_boss.js`, `t_soak.js` einzeln starten.
**Bitte live prüfen:** Bodensprites (Stromplatte/Schlot/Sand/Ranke/Felsmarker/Wolke sind blind gezeichnet — Lesbarkeit, Höhe), Banner-Position vs. Meldung/Boss-Leiste (Handy Hochformat), Fairness von Steinschlag/Überspannung, Treibsand-Bremse, Gift (1 HP/s zu hart/zu weich?), Nebelweite im Dschungel (13,5) vs. Sprites, Partikeldichte, ob Elite-Gewichte spürbar sind.

## Phase 10 — Level Events
Modul `Events` (vor `updateEnemy`, auch `__breach.Events`). Nur prozedurale Ebenen ab Tiefe 2. Wurf einmal je Ebene (`lvl._ev`, bleibt nach Tod-Neustart gleich): Tiefe 2–4 → 1 Ereignis, 5–9 → 1–2, ab 10 → 2 (30 % 3). Zwischenetagen: 45 % ein leichtes Ereignis. Gewichte nach Biom in `RULE`, Konflikte in `CONFLICT` (Stromausfall+Alarm/Meltdown, Lockdown+Meltdown/Zeitlimit, Meltdown+Zeitlimit). Boss-Ebenen: nur Kapsel, Jagd, Override, Geheimraum, Tresor.

| ID | Name | ab Tiefe | Ablauf |
|---|---|---|---|
| `alarm` | ALARM | 2 | nach 30–65 s (oder sobald Drohne/Turm Alarm ruft): 18 s Sirene, rote Randpulse, alle 3 s Geräusch (Radius 26) lockt Gegner; danach Credits + Health/Ammo-Drop |
| `lockdown` | LOCKDOWN | 3 | bei 30 % Kills: 3–7 Wachen (`e.guard`) erscheinen, **Portal versiegelt**, bis alle tot sind (Meldung im Portal-Trigger, Ziel-Text) |
| `blackout` | STROMAUSFALL | 2 | nach 22–52 s: 26–40 s Dunkelheit (Overlay `#evFx`, Flackern am Anfang/Ende), Gegner sehen ×0,7 (`Events.sightMul` in `AI`) |
| `meltdown` | REAKTOR-KERN | 5 | bei 25 % Kills oder 55 s: Countdown = 24 s + 0,55 s je Feld Weg zum Portal (45–150 s), Alarmton, Schütteln, oranger Schleier, Pfeil zum Portal; danach Strahlung (5+0,4·Tiefe alle 1,5 s) bis zum Portal; Erfolg = Credits im Ergebnis |
| `reinforce` | VERSTÄRKUNG | 3 | bei 50 % Kills (ab Tiefe 8 zusätzlich 85 %): 3–8 Gegner aus dem Biom-Roster, außer Sicht, sofort im Kampf; max. 36 lebende |
| `ambush` | HINTERHALT | 2 | Köder (Health/Ammo-Pickup) auf halber Route; Betreten (Radius 1,05) löst 3–6 Gegner 5,5–11 Felder entfernt ohne Sichtlinie aus |
| `supply` | VERSORGUNGSKAPSEL | 2 | nach 18–58 s Kapsel 9–16 Felder entfernt (Sprite `B`, HUD-Pfeil+Distanz): HP +40, Ammo +18, Schild voll, Panzerung +15, Credits, 55 % Mod |
| `hunt` | ELITE-JAGD | 3 | ein weit entfernter Gegner wird Elite (+Modifikator) und Kopfgeld-Ziel (HUD Pfeil/Distanz/HP); Kill = Credits, Mod, Health+Ammo |
| `override` | SICHERHEITS-OVERRIDE | 2 | Terminal (Sprite `T`) auf 45–85 % der Wegstrecke; 4,5 s daneben stehen (verfällt außerhalb, hacken ist laut, Radius 9); Erfolg: Karte aufgedeckt, Credits, entriegelt Tresor |
| `hidden` | GEHEIMRAUM | 2 | Sackgassen-Block des Labyrinths wird mit Wand (Typ 1, unsichtbar) verschlossen; 1,3 s an der Wand stehen öffnet sie; Hinweis-Ticken (lauter je näher, ≤ 6 Felder); Beute 2 Pickups + 2 Splitter, Credits, 50 % Mod |
| `vault` | TRESOR | 4 | wie Geheimraum, aber am weitesten vom Start und **nur nach Override** (Meldung sonst); Beute 3 Splitter + Health, 50+6·Tiefe Credits, garantierter Mod (Tiefe+3). Zieht `override` automatisch nach |
| `timer` | ZEITLIMIT | 2 | Par = 50 s + 0,9 s je Feld zum Portal + 4,5 s je Gegner; HUD-Countdown; im Ergebnis-Screen Credits + Mod bei Erfolg |

**Sackgassen-Erkennung** (`findPockets`): Labyrinth-Blöcke (Raster `CORR_W+1`) mit genau 1 offener Verbindung, leer (kein Gegner/Pickup/Spawn ≤ 4,5, kein Arena-/Ausgangs-/Treppenrand). Versiegeln kann nie etwas abschneiden. Nach dem Öffnen `buildMini()`.
**HUD:** Ereignis-Leiste `#evt` (max. 3 Zeilen unter der Boss-Leiste, Titel/Status/Balken, Warn-Blinken), Schleier `#evTint` (alarm/melt), `#evFx` (Dunkelheit); alles per JS einmalig erzeugt, DOM nur bei Änderung (`hset`), `.rm` schaltet Animationen ab. Ergebnis-Screen: Zeile „Ereignisse x / y“ + Meltdown/Zeitlimit.
**Angepasst:** `parseLevel` (`Events.setup()` vor `buildMini`), `update` (`Events.tick` nach Flow-Feld, vor `AI.tick`), `updatePickups` (`p.fixed` wird übersprungen), `exitLocked/checkExit` (Lockdown), `finishLevel` (`Events.onFinish`), `newRun` (`Events.reset`), `AI` (Sichtweite × `sightMul`), `objectiveText`. Neue Sounds `evAlarm evPower evOn evWarn evBoom evDrop evAmbush evHack evOK evSecret evHint evFail`. Credits gehen in `Save.data.credits`, `SAVE_VERSION` bleibt 1. Statistik: `Events.stats` (rolled/started/done/secrets/fails/credits) für Phase 16 (Missionen).
**Konsole:** `__breach.Events.force('alarm')` (Ids siehe `Events.NAME`) startet ein Ereignis sofort auf einer prozeduralen Ebene; `Events.list()` zeigt die aktiven.

**Getestet — bewusst nur minimal:** `node --check`, `t_boot.js`, dazu ein einmaliger Wegwerf-Rauchtest (Tiefen 2–15, je 420 Frames, alle 12 Ereignisse erzwungen): 0 Fehler, 0 Warnungen. **Keine** Suiten, KEIN Browser. Vor Phase 11 bitte `t_boss.js`, `t_roles`, `t_ai`, `t_soak` einzeln starten (Boss-Ebenen laden jetzt Events).
**Bitte live prüfen:** Lesbarkeit von `#evt` (Position vs. Boss-Leiste/Minimap, Handy Hochformat), Stärke der Dunkelheit (`#evFx` Gradient) und ob der Stromausfall noch spielbar ist, Meltdown-Zeitfenster (`24 + 0,55·Felder`), ob Geheimwände auffindbar sind (Hinweis-Ticken reicht?), Fairness des Hinterhalts (Spawn außer Sicht, 5,5–11 Felder), Lockdown-Wachen (Anzahl/Position), Pfeilrichtung ▶/◀ (Annahme: größerer Winkel = rechts), Ereignishäufigkeit pro Tiefe.

## Phase 9 — Boss Evolution
Modul `Boss` (vor `updateEnemy`, auch `NX.enemies.boss`, `__breach.Boss`). Boss-Sektor = alle 3 Tiefen; Boss-Nr. `n = Tiefe/3`, Variante `v = (n-1) % 4` (Kampagne: `lvIdx+1`). HP = 320 × Variante × (1+0,35·(n−1)), Schaden ×(1+0,1·(n−1)). Alles in `BD` (Name, Farbe, HP/Schaden/Tempo, Angriffslisten je Phase, Belohnung).

| v | Boss | Besonderheit (Angriffe je Phase 1 / 2 / 3 / 4) |
|---|---|---|
| 0 | Kern-Wächter (rot) | burst / +Ringwelle / +Nachschub / +Todesnova · Säulen 4 |
| 1 | Phantom-Prozess (violett, Tempo ×1,15, HP ×0,85) | burst / +Blink-Teleport / Blink+Nachschub+Ring / Blink+burst+Nova · Säulen 6 |
| 2 | Reaktor-Titan (orange, Tempo ×0,8, HP ×1,5) | dicke Salve / +Schockwelle / +Spirale / Slam+Spirale+Nova · Säulen 5 |
| 3 | Void-Weber (mint, HP ×1,25) | Spirale / Ring+burst / Nachschub+Blink+Spirale / +Nova · Säulen 3 |

**Phasen** bei 100/75/50/25 % HP (= Marken der Boss-Leiste): 1 normal · 2 neue Mechanik · 3 **Arena verändert sich** (isolierte Säulen, Wandtyp 3, nie an Wänden/auf Spieler/Gegner/Zugang → keine Engstellen) · 4 **Enrage** (Tempo ×1,4, Telegraphen ×0,85, Todesnova alle ~9 s). `Boss.clamp` (in `damageEnemy`) hält HP an der Grenze fest: **kein Überspringen** einer Phase durch einen großen Treffer. Phasenwechsel: 1,8 s unverwundbar + eingefroren, Gegnerschüsse verschwinden, Blitz/Ton/Meldung. Vor dem Aufwachen ist Schaden auf 24 % der HP begrenzt.
**Intro** 2,6 s (unverwundbar, Ton, Meldung „NAME — LV n · Phase-Titel“). **Arena-Sperre** (nur Vorraum-Level, `lvl.arena={ex,ey,cells}`): Zugang wird zur Wand (Typ 3), sobald der Spieler im Raum steht (nicht im Zugang, kein Gegner im Zugang, ein Boss-Wecken von außen sperrt nichts aus); Freigabe + Säulen weg beim Boss-Tod. Ohne Vorraum (Fallback/Kampagne) keine Sperre, Säulen im Umkreis 6.
**Angriffe:** `burst` Fächer (3/3/5/7 je Phase, Variante 2 langsamer/größer) · `ring` 16 Schüsse mit ~3er-Lücke (Phase 4: zweiter Ring 0,6 s später) · `spiral` 2,4 s drehender Dauerfeuer-Strahl · `nova` 1,3 s Ansage (wachsender Ring, Flackern), Radius 4,6, 30 Schaden, Dash entkommt · `slam` 0,8 s, Radius 3,2, 20 Schaden (+Ring ab Phase 3) · `blink` 0,7 s Ansage, Teleport 2,6–4 Felder neben den Spieler, dann Salve · `summon` 2 Biom-Minions (max. 3 lebende, `Roles.summon`). Boss steht während Telegraph-Angriffen still (`e.bat`).
**Musik:** synthetisierter Kampfpuls (Bass/Hat/Kick/Arpeggio), Tempo 96/112/128/148 BPM je Phase, nur solange der Boss kämpft, skaliert mit `settings.musicVol`. Phase 18 baut das später aus.
**Belohnung:** +50·n Credits, 2× Health + 2× Ammo, 2 Mods (bestehend), dauerhafter Lauf-Bonus (`Stats.add('run:boss<n>')`): Kern +4 % Resistenz · Phantom +5 % Tempo · Titan +10 max. Panzerung · Weber +3 % Krit/+15 % Krit-Schaden. Boss-Minions sterben mit dem Boss.
**HUD:** Boss-Leiste zeigt Name der Variante, „LV n · PHASE p“, Balkenfarbe je Boss; Ziel-Text nutzt den Boss-Namen. Boss trägt je Phase einen zusätzlichen farbigen Ring.
**Angepasst:** `parseLevel` (Boss.reset/init), `generateProceduralLevel` (`arena`), `damageEnemy` (Unverwundbarkeit, clamp, onDeath, kein Stagger ab Phase 3), `updateEnemy` (Boss.tick/hold/act, Tempo), `roleDecor`, HUD-Boss-Block, 5 neue Sounds (`bossIntro bossPhase bossLock bossRing bossDown`). `SAVE_VERSION` bleibt 1. Boss-Sprite unverändert (Unterscheidung über Ring-Farbe/Name).

**Getestet — bewusst nur minimal:** `node --check` + `test/t_boot.js`. **Keine** Suiten, KEIN Browser. Vor Phase 10 bitte `t_boss.js` (kann wegen Boss-Leisten-Änderung anschlagen), `t_roles`, `t_ai`, `t_soak` einzeln starten. Konsole: `__breach.Boss.BD`, Boss holen: `b=__breach.enemies.find(e=>e.type==='K')`, Phase erzwingen: `b.hp=Math.round(b.maxhp*.5)` und einmal treffen.
**Bitte live prüfen:** Ob die Arena-Sperre nie einsperrt/aussperrt, Fairness von Ring-Lücke/Spirale/Nova/Blink, Lesbarkeit des Telegraph-Rings, Säulen-Platzierung, Länge der Kämpfe (HP/Phasen), Musik-Lautstärke, ob die Boss-Leiste mit langem Namen auf dem Handy passt.

## Phase 8 — Elite Enemies
Modul `Elite` (direkt vor `updateEnemy`, auch `NX.enemies.elite`, `__breach.Elite`). Baut auf den Elite-Grundwerten aus Phase 7 auf (HP ×1,8, Schaden ×1,25, Nova-Stoß, Chance `min(22 %, (Tiefe−2)·2,5 %)` ab Tiefe 3). `Roles.rollElite` ruft jetzt `Elite.assign(e)`: **1 Modifikator**, ab Tiefe 12 mit 30 % Chance **2**. Felder: `e.mods` (IDs), `e.em[id]`.

| ID | Name | Wirkung |
|---|---|---|
| `over` | ÜBERLADEN | +35 % Schaden (Nahkampf, Schüsse, Nova, Ansturm), +15 % Feuerrate, Tempo ×1,05 |
| `armor` | GEPANZERT | −40 % Schaden (nach Schutzfeld), HP ×1,15, Tempo ×0,92, `e.armor=1` → Panzerbrecher-Mod wirkt |
| `vamp` | VAMPIRISCH | heilt 60 % des verursachten Schadens (`hurtPlayer(n,src)` → `Elite.onPlayerHit`) |
| `phase` | PHASEN | alle 6–9 s: 0,4 s Flackern, dann 1,3–1,7 s **unsichtbar + unverwundbar** (Tempo ×1,5, kein Angriff); Treffer prallen mit Funken ab. Nicht für stationäre Typen/Juggernaut; HP ×0,85 |
| `rage` | BERSERKER | unter 50 % HP stufenlos bis +45 % Tempo und +60 % Feuerrate, Ring pulsiert schneller |
| `void` | VOID | 0,6 s Ansage (Flackern + Ton), dann langsame violette Kugel (Tempo 7, 14 Schaden ×1,25), Treffer entzieht **30 Energie**, alle 3,2–4,5 s. Nicht für Sniper |
| `swarm` | BRUT | ruft bei 66 % und 33 % HP je einmal Nachschub (`Roles.summon`, max 4 lebende). Nicht für Beschwörer |
| `reflect` | REFLEKTIEREND | wirft 30 % des Schadens zurück (max 10, Abklingzeit 0,25 s → Schrotflinte/Dauerfeuer wird kaum bestraft, nur direkte Treffer, nicht der Todesstoß) |

**Optik:** je Modifikator farbiger Doppelring (Aura) + Icon über dem Kopf (`AURA`/`ICONTEX`, 5×7-Glyphen); ?/!-Marker rutschen darüber. Phasen-Elite flimmert und ist im Phasen-Zustand fast unsichtbar. Elites ohne Modifikator (manuell gesetzt) behalten den goldenen Ring.
**Belohnung:** pro Modifikator +10 Credits (`Save.data.credits`, noch ohne Nutzen bis Phase 15), zweites Pickup (Health + Ammo), Mod-Chance 50 % statt 30 %. Erster Kontakt je Modifikator pro Lauf zeigt einen Hinweis (`ELITE · …`).
**Angepasst:** `hurtPlayer(n,src)`, `spawnShot(...,own)`, `updateShots` (Void-Entzug), `damageEnemy` (Phase-Abprall, Reflexion/Brut), `Roles.mitigate/dmg/act/onDeath/onSpot`, `updateEnemy` (`Elite.tick`), `renderSprites/roleDecor`. `SAVE_VERSION` bleibt 1.

**Getestet — bewusst nur minimal:** `node --check` auf das Skript und `node test/t_boot.js` (Start ok). **Keine** neuen Tests, **keine** der Suiten, KEIN Browser. Bitte vor Phase 9 einmal `t_roles.js`, `t_ai.js` und `t_soak.js` starten. Zum Ausprobieren in der Konsole: `e=__breach.enemies.find(x=>x.alive&&x.type!=='K'); e.elite=true; __breach.Elite.assign(e)` (danach `e.mods`).
**Bitte live prüfen:** Lesbarkeit der 8 Ringfarben/Icons, ob Phasen-Elite fair wirkt (Ton reicht?), Stärke von Überladen/Vampir/Reflexion, Void-Kugel ausweichbar?, Brut-Nachschub nicht zu viel (Performance), Elite-Häufigkeit.

## Phase 7 — Enemy Classes
Modul `Roles` (direkt vor `updateEnemy`, auch `NX.enemies.roles`, `__breach.Roles`). Klassen liegen **über** der KI aus Phase 6: `e.role` (aus `ROLE_OF` per Typ), `Roles.act(e,…)` läuft nur im Zustand COMBAT und nach `AI.engaged`; `true` = Gegner beschäftigt (Zielen/Rufen/Sprung/Ansturm/Nova), `Roles.has/vx/vy` überschreiben nur die Bewegung, Angriffe laufen weiter über `MELEE_STATS/RANGED_STATS`. Fähigkeits-Zustand `e.rs` (0 keiner), Timer `e.rt`, Abklingzeit `e.rcd`. Bei Flucht/Suche werden Fähigkeiten abgebrochen. **Boss (K) unverändert** (Phase 9).

**Bestehende Typen → Klasse (nur Modifikatoren):** SPÄHER `x z g` (Tempo ×1,0, rufen bei Entdeckung Alarm im Radius 13) · SCHWARM `p v u` (Rudelbonus bis +30 % Tempo je Nachbar ≤ 4 Felder, ein Entdecker weckt alle Schwarm-Gegner ≤ 8) · TANK `k f o` (Rückstoß halbiert, Stagger 0,07 s, Nahkampftreffer mit Kamerawackeln). Nicht klassifiziert (bleiben wie in Phase 6): `d r t e n q y i b`.

**Neue Typen (freie Buchstaben `N M B C A J`):**
| Typ | Klasse | HP / Tempo | Fähigkeit |
|---|---|---|---|
| `N` Präzisions-Schütze | SNIPER | 32 / 1,3 | Sichtweite ×1,4; hält 7–13 Felder Abstand; **roter Laser + Zielzeit** 1,35/1,15/0,95 s (je Aggression), Ziel rastet 0,3 s vor dem Schuss ein (Ausweichfenster), Schuss 26 Schaden mit Tempo 24 (Teilschritte gegen Tunneln). Ab ≥ 20 % HP Schaden im Zielen wird unterbrochen. HUD: `#stage.aimed` (roter Rand), Warnton `sfx.aimWarn` |
| `M` Reparatur-Einheit | SUPPORT | 44 / 1,5 | heilt den schwächsten Verbündeten (Sicht, ≤ 8) mit 10 HP/s (grüner Strahl), folgt Verbündeten, hält ≥ 4,5 Felder Abstand zum Spieler, heilt keine Support-Kollegen und keinen Boss |
| `B` Schild-Generator | SHIELDER | 85 / 1,0 | Schutzfeld Radius 3,4 (Takt 4×/s): Verbündete darin nehmen −45 % Schaden (Ring cyan); Felder stapeln nicht, Schild-Generatoren schützen sich nicht gegenseitig; Tod beendet das Feld sofort |
| `C` Beschwörer-Kern | SUMMONER | 60 / 1,1 | ruft nach 1,4 s Kanalisierung 2 (Elite 3) Schwarm-Gegner je Biom (`p/v/x/u`), max. 4 lebende, Abklingzeit 10–13 s, **jeder Treffer unterbricht** den Ruf (Abklingzeit 4 s); Minions zählen in `totals.foes` |
| `A` Phasen-Klinge | ASSASSIN | 40 / 2,2 | 0,55 s Ansage (Flackern + Ton), springt dann hinter/neben den Spieler (freie, einsehbare Zelle 1,4–2 Felder), Schlag nach 0,4 s (14 Schaden), Abklingzeit 5,5–7,5 s; Treffer in der Ansage unterbricht |
| `J` Juggernaut | JUGGERNAUT | 420 / 0,9 | kein Rückstoß, flieht nie; Ansturm: 0,9 s Ansage → 1,1 s Lauf mit Tempo 9 (Richtung rastet beim Start ein) → trifft er dich 32 Schaden + 1 s Erholung, Wandaufprall = 1,8 s **betäubt (+25 % Schaden)**; Nahkampf 26 |

**ELITE:** `Roles.rollElite` (nur prozedurale Ebenen, ab Tiefe 3, Chance `min(22 %, (Tiefe−2)·2,5 %)`, nicht Schwarm/Sprenger/Boss): HP ×1,8, Schaden ×1,25, Tempo ×1,1, mind. Aggression „normal“, goldener Ring, Spezial **Nova-Stoß** (1 s Ansage mit Flackern, Radius 3,4, 18 Schaden, Ausweichen/Dash entkommt). Belohnung beim Kill: Health/Ammo-Pickup, 30 % Waffen-Mod. Erster Kontakt je Klasse/Elite pro Lauf zeigt einen Hinweistext (`Roles.TIP`). Phase 8 baut hierauf die Elite-Modifikatoren.
**Spawns:** `BIOME_ROSTER` um `N M B C A J` erweitert (Anlage alle; Schlucht N B A J; Wüste N C A; Dschungel M C A J), Hauptebenen: Sniper ab Tiefe 4, Medic ab 4, Schild-Generator ab 5, Beschwörer ab 6, Assassine ab 4, Juggernaut ab 7 (nicht auf Boss-Ebenen); Zwischenetagen je max. 1 (kein Juggernaut).
**Angepasst:** `damageEnemy` (→ `Roles.mitigate/onDeath`, Stagger je Klasse), `hitEnemy` (Lebensraub zählt jetzt den **tatsächlich abgezogenen** Schaden), `spawnShot(x,y,ang,dmg,v,k)` + `updateShots` (Teilschritte), `AI.init` (→ `Roles.init`), `AI.spot` (→ `Roles.onSpot`), `AI.idle` (Sniper-Sicht), `parseLevel` (Elite-Wurf), `newRun` (`Roles.reset`), Render (`roleDecor`: Ringe, Laser, Heilstrahl; Sniper-Schüsse größer), 8 neue Sounds (`aimWarn snipe summon blinkWind blink chargeWind stomp novaWind`), 6 neue Sprites + `SPR_ELITE/SHIELD/LASER/HEALDOT`. `SAVE_VERSION` bleibt 1.

**Getestet — bewusst nur ein Rauchtest, KEINE vollständigen Suiten und KEIN echter Browser:** neu `node test/t_roles.js` (32 Prüfungen: alle Klassen laufen je 300 Frames fehlerfrei, Sniper zielt+schießt, Summoner ruft, Schutzfeld reduziert, Medic heilt, Assassine springt, Juggernaut greift an, Elite-Nova). Zusätzlich `t_boot.js` und `t_ai.js` (78/78 grün). **Nicht** neu gelaufen: `t_player`, `t_mods`, `t_weapons`, `t_hud`, `t_save`, `t_aistress`, `t_soak`, Zufallsläufe — bitte vor Phase 8 einmal einzeln starten.

**Bitte live prüfen:** Balance (Zielzeit/Schaden Sniper, Heilrate Medic, Feldstärke Schild-Generator, Ansturm/Aufprall Juggernaut, Elite-Chance), Lesbarkeit von Laser/Ringen/Heilstrahl, ob die 6 neuen Sprites (blind gezeichnet) als Klassen erkennbar sind, ob Assassinen-Sprung fair wirkt (Ton reicht als Warnung?), Performance mit vielen Gegnern (Klassen-Takt läuft 4×/s, O(n²) bei ~30 Gegnern).

## Phase 6 — Advanced Enemy AI
**Zustände** (`e.ai`, Modul `AI` vor `updateEnemy`): `IDLE` (patrouilliert/wacht) → `INVEST` (Geräusch/Alarm untersuchen) → `COMBAT` → `SEARCH` (Sicht verloren: letzte bekannte Position absuchen) | `FLEE`. `e.awake` bedeutet weiter „im Kampf“ (COMBAT/SEARCH/FLEE) — Bedrohungsanzeige, Boss-Leiste, Tests laufen unverändert. **Der Boss (K) behält sein altes Verhalten** (wacht bei Sicht < 12, flieht nie, gibt nie auf); Boss-KI kommt in Phase 9.

| Fähigkeit | Umsetzung |
|---|---|
| **Sehen** | Blickfeld (`e.face`, FOV 109°/126°/149° je Stufe), Sichtweite 12 (Türme 14) × Stufe, unter 2,8 Feldern auch im Rücken; Wände blockieren. Sinne laufen gedrosselt (~9 Hz). Danach **Schrecksekunde** (0,65/0,4/0,18 s), erst dann Kampf. |
| **Hören** | `AI.noise(x,y,R)`: Waffenradius `NOISE` (Pistole 9, Streu 12, Auto 11, Plasma 10, Rail 13, Arc 8, Void 12, Singularität 7, Fäuste 3,5), Sprinten 4,5. Durch Wände nur innerhalb 60 % des Radius. Gegner **untersuchen den Ort** (nicht mehr allwissend), sehen sie dich, folgt der Kampf. |
| **Patrouille** | 65 % der beweglichen Gegner laufen Wegpunkte im Umkreis 2–5,5 ihrer Basis; Wachen und Türme scannen die Blickrichtung. |
| **Verfolgen/Suchen** | Kampf mit Sicht: direkt. Ohne Sicht 1,2 s „heiße Verfolgung“ (Flow-Feld), dann Suche an der letzten bekannten Position (Feld-Cache `AI.field`, max. 12), Umsehen, danach **Aufgeben → IDLE**. |
| **Alarm/Reaktion** | Beim Entdecken rufen Nahe (≤ 9) → nahe mit Sicht kämpfen sofort, andere untersuchen. **Drohne und Turm** lösen großen Alarm aus (18, Meldung „ALARM …“). Treffer wecken sofort (+ kurzer Ruf, Radius 6). Gegner entdecken Leichen (≤ 8). |
| **Flanken/Einkesseln** | Rusher mit `e.flank` bekommen Winkel-Slots um den Spieler (`AI.tick`, alle 0,4 s, max. ±1,3 rad zur Frontalen, Einzelner = 1,15 rad seitlich) und laufen im Bogen an. Aggressive flanken selten (12 %), vorsichtige oft (75 %). |
| **Flucht** | Unter HP-Schwelle (30 %/14 %/nie) oder **Moral** (vorsichtig + ≥ 2 Verluste in 7 Feldern/5 s bei < 70 % HP) → 2,5–4 s weglaufen (Tempo ×1,2, kein Angriff), max. 2×; danach kämpfen sie (in die Ecke gedrängt ebenfalls). Schwärme/Sprenger (`FEARLESS`: p v u e), Türme und Boss fliehen nie. |
| **Deckung** | Nur Drohne: nach einem Schuss/Treffer Deckungszelle suchen (`AI.findCover`: Zelle ohne Sicht mit Nachbarzelle mit Sicht), verstecken 0,8–2 s, herauslugen, 1/2/3 Schüsse (je Stufe), zurück. Ohne Deckung altes Kite-Verhalten. |
| **Aggression** | `e.aggr` 0/1/2 (`AGGR`): Sicht, Reaktion, Fluchtschwelle, Flankieren, Tempo (×0,95/1/1,08), Suchdauer (3,5/5/8 s). Verteilung ~30/50/20 %, mit Tiefe zunehmend aggressiver. |
**HUD/Optik:** über dem Gegner erscheint ein **?** (misstrauisch/sucht/untersucht) bzw. **!** (entdeckt) — nur im Spiel (`SPR_QUEST/SPR_EXCL`). Debug: `__breach.AI`, `AI.stats` (spots/alarms/flees/searches/giveups), `NX.enemies.ai`.
**Angepasst:** `alertNear(r)` (Radius je Waffe), `damageEnemy` → `AI.onHurt/onDeath`, Level-Start `AI.reset()` + `AI.init(e)` je Gegner, `updateEnemy` (Reihenfolge: Turm → Flucht → Suche → Drohnen-Deckung → Verfolgung → Kiten/Rusher). Neue Enemy-Felder siehe `AI.init`. Kein Save-Bezug (`SAVE_VERSION` bleibt 1).
**Balance-Folge:** Gegner sind nicht mehr allwissend — wer außer Sicht/Hörweite bleibt, verliert Verfolger; Schüsse locken dagegen Gegner an. Ein einzelner Schuss lockt nicht mehr sofort alle im Kampf, sondern lässt sie zur Quelle laufen.

**Getestet (Node-Harness, KEIN echter Browser):** neu `node test/t_ai.js` (78 Prüfungen: Blickfeld/Reichweite/Wand, Reaktionszeit je Stufe, Hören inkl. Wanddämpfung/Waffenradius, Untersuchen, Patrouille, Alarm, Leichen, Flanken-Slots + Bewegung, Flucht/Moral/Grenzen, Suchen/Aufgeben, Turm, Deckung, Boss unverändert, 600-Frames-Gruppe) und `node test/t_aistress.js [tiefen] [frames]` (tiefe prozedurale Ebenen, erzwungene Kämpfe: 0 Fehler, alle Zustände erreicht). Angepasst: `t_player.js` (Phase-Nr.). Alle älteren Tests + Zufallsläufe (5000 Frames Desktop, 1500 Touch): 0 Fehler, 0 Warnungen. Testreihenfolge: einzeln starten (`t_player` ~90 s, `t_mods` ~110 s).

**Bitte live prüfen:** Spielgefühl/Schwierigkeit (Reaktionszeiten, Sichtweiten, Suchdauer, Geräuschradien — alles in `AGGR`/`NOISE`), ob Flanken/Einkesseln sichtbar wirkt, Lesbarkeit der ?/!-Marker, Drohnen-Deckung in echten Räumen, ob Gegner zu leicht die Verfolgung verlieren, Performance bei vielen Gegnern (Deckungssuche ~600 Strahlen alle 1,5 s je Drohne).

## Phase 5 — Weapon Modification System
**Modell:** 5 Slots je Waffe (Fäuste keine): `barrel` LAUF, `core` KERN, `mag` MAGAZIN, `system` SYSTEM, `special` SPEZIAL. 17 Mod-Typen × 3 Stufen (I–III) = 51 Mods (`MOD_BASE` → `MODS`/`MOD_BY_ID`, IDs wie `b_dmg3`). Mods ändern `WEAPONS` nicht: `Mods.eff(waffe|index)` liefert ein abgeleitetes Werte-Paket (neutral ohne Mods; unbekannt/undefined = `Mods.NEUTRAL`), das Feuern/Nachladen/Hitze/Krit/Schaden auslesen. `WEAPONS[i].i` = Index.

| Slot | Mods (Wirkung Stufe I / II / III) |
|---|---|
| LAUF | Verstärkter Lauf (Schaden +10/17/25 %), Langlauf (Reichweite +20/35/50 %), Präzisionsdrall (Streuung −25/40/55 %) |
| KERN | Energie-Kern (Schaden +8/14/20 %, Energiekosten −15/25/35 %), Plasma-Kern (Flächenschaden 20/30/42 % des Treffers, R 1,2), Krit-Kern (Krit +6/10/15 %, Krit-Mult +0,25/0,4/0,6) |
| MAGAZIN | Erweitertes Magazin (+35/60/90 %, min. +1), Schnelllader (Nachladen 30/50/75 % schneller), Zellen-Sparer (12/20/30 % Freischuss) |
| SYSTEM | Übertaktung (Feuerrate +12/20/30 %), Kühlkörper (Hitze −25/40/55 %, Abkühlung +20/35/50 %), Stabilisator (Rückstoß −30/50/70 %, Streuung −10/15/20 %) |
| SPEZIAL | Kettenblitz (30/42/55 % Chance, 40/50/60 % Schaden, 1/2/2 Ziele), Explosivgeschosse (erster Treffer je Schuss explodiert 30/42/55 %, R 1,2/1,4/1,7; Projektilwaffen: Splash größer), Panzerbrecher (+30/50/75 % gegen `e.armor>0` oder Typ mit `sc>=1`), Lebensraub (3/5/8 % → HP), Schild-Entzug (10/18/28 % → Schild) |

**Regeln:** Effekte addieren sich; Spezial-Effekte (Plasma/Explosion/Kette) lösen je Schuss höchstens einmal aus (`Mods.shotId/lastShot`), ohne Rekursion (`Mods.busy`) → Streu-Kanone erzeugt keinen Blitz-Sturm. Lebensraub/Schild-Entzug zählen nur echten Schaden (kein Überschuss), HP ganzzahlig, Schild ≤ Max. Singularität: nur Werte-Mods (Schaden über `hole.dm`, Magazin, Hitze …), keine Spezial-Treffer-Effekte (Löcher sind keine Direkttreffer). Waffenlevel `P.wLv[i]` = 1 + Anzahl Mods (HUD zeigt es). Magazin-Verkleinerung beim Ablegen gibt überzählige Schüsse als Zellen zurück (`Mods.magSize(i)` statt `w.mag` im Nachladen/Fund/Reset).
**Inventar/Herkunft (vorläufig bis Phase 13):** `Mods.inv` (ID→Anzahl), `Mods.eq[i]`, `Mods.add/equip/unequip/free/count`. Ein Exemplar kann nur an einer Stelle stecken. Drops: Kill-Chance 3 % + 0,4 %/Kill seit letztem Drop (`Mods.onKill`), Boss = 2 Mods (mind. Stufe II), 1 Mod pro geschafftem Sektor (`sectorReward`, im Ergebnis-Screen). Stufe wächst mit Tiefe (`Mods.roll`, `modDepth()`). Mods gehören zum Lauf: `newRun()` → `Mods.reset()`. Fund-IDs landen in `Save.data.weaponUpgrades.discovered` (bereinigt beim Laden, max. 256); `SAVE_VERSION` bleibt 1. Meta-Freischaltung/Start-Mods kommen in Phase 15.
**Loadout-Screen** (`openLoadout(back)`): Waffen-Tabs, 5 Slot-Buttons, passende Mods (mit Beschreibung, Stapelzahl, „Ablegen“), Kennwert-Tabelle mit Vorher/Nachher. Erreichbar über **L** (pausiert), Pause-Menü „Loadout“ (Touch!), sowie Ergebnis-Screens „Sektor gesäubert“ und „Prozess beendet“ (`addLoadoutBtn`). `showOverlay({wide:true})` für breites Layout, CSS `.ld-*`. Alles Buttons ≥ 44 px, im Hochformat einspaltig.
**Code:** `Mods` (vor `Stats`), `hitEnemy` (Schaden, Panzerbrecher, Leech, onHit), `tryFire` (Kosten/Rate/Streuung/Reichweite), `fireRail/fireArc(w,M)`, Projektile tragen `m`/`rng`, `splash(...,M)`, Kühlung in `update` und für weggelegte Waffen. `NX.mods` und `__breach.Mods/MODS/openLoadout/pauseMenu`. Konsole: `__breach.Mods.add('x_ch3'); __breach.Mods.equip(0,'x_ch3')`.

**Getestet (Node-Harness, KEIN echter Browser):** neu `node test/t_mods.js` (90 Prüfungen: Katalog, Einbau-Regeln, jeder Effekt mit konkreten Zahlen, Drops, Reset, Save, Loadout-Screen, Taste L, 300 Zufalls-Loadouts). Angepasst: `t_player.js` (Phase-Nr.), `t_soak.js` (Zufalls-Mods). Alle Tests grün; Zufallsläufe 5000 Frames Desktop, 1500 Touch: 0 Fehler, 0 Warnungen. Laufzeiten: `t_player` ~90 s, `t_mods` ~100 s — Tests einzeln starten, nicht alle in einem Befehl.

**Bitte live prüfen:** Balance (Drop-Rate, Effektstärken, besonders Kettenblitz/Explosiv), Lesbarkeit und Bedienbarkeit des Loadout-Screens auf dem Handy (Hoch-/Querformat; CSS blind geschrieben), Pause-Menü-Höhe durch den neuen Button, Sichtbarkeit der Mod-Meldung beim Fund.

## Phase 4 — Massive Weapon System

Ziel: 9 Waffen mit echten Unterschieden, Magazin/Nachladen, Hitze und Energie je Waffe. Gegner-KI, Level-Generator (außer Waffenfunden), Raycaster-Kern und Touch-Grundsteuerung unverändert.

**Waffentabelle `WEAPONS`** (Index = Taste − 1; Indizes 0–3 unverändert, damit Alt-Code/Saves passen). Jede Waffe hat: `dmg, rate, mag, reload, heat, cool, range, spread, crit, critMul, rc (Rückstoß), energy, cost` (+ `kind`, Sound, Optik).

| # | Waffe | Verhalten | Fund |
|---|---|---|---|
| 1 | Puls-Pistole | Hitscan 12, Mag 12 | Start |
| 2 | Streu-Kanone | 7 Kugeln × 9, Reichweite 14, Mag 6 (2 Zellen/Schuss) | Tiefe 1 / Story (alt) |
| 3 | Fäuste | Nahkampf 26, keine Munition | Start |
| 4 | Overclock-Gewehr | Dauerfeuer 7, überhitzt nach ~12 Schuss | Tiefe 6 (alt) |
| 5 | Plasma-Kanone | Projektil 30 + Splash (R 1.5), Hitze 0.2/Schuss | ab Tiefe 3 |
| 6 | Railgun | Strahl 90, durchschlägt 4 Ziele (−25 %/Ziel), 25 Energie, 3 Zellen | ab Tiefe 8 |
| 7 | Arc-Blaster | Kegel Reichweite 7, Kettenblitz 100/60/40 % auf Ziele ≤ 3.2 | ab Tiefe 4 |
| 8 | Void-Werfer | Projektil 55 + Splash 45 (R 2.4) mit **Sog** zum Zentrum | ab Tiefe 10, ~50 % |
| 9 | Singularitäts-Kanone | Projektil öffnet ~2.6 s ein Loch: zieht Gegner, verschluckt Gegnerschüsse, tickt Schaden, kollabiert mit ~90 Schaden | ab Tiefe 12 |

**Magazin/Nachladen:** `P.mag[i]` zählt *Schüsse*, `P.ammo` = Vorrat in *Zellen* (`cost` je Schuss). Abbuchung erst beim Fertigstellen. **R** / Touch-Button „R“ (links neben dem Waffenwechsel-Button) lädt nach; leeres Magazin oder letzter Schuss lädt automatisch. Waffenwechsel bricht ab, ohne etwas zu verlieren. Waffen-Anzeige taucht beim Nachladen ab.
**Hitze je Waffe:** `P.heat/P.overheatT` gehören zur aktiven Waffe, weggelegte Waffen (`P.hs/P.os`) kühlen im Hintergrund. **Energie:** Plasma 5, Rail 25, Arc 1.2/Schuss, Void 15, Singularität 40 (bei Mangel kein Schuss + rotes EN-Blinken).
**Krit:** Waffenwert + Spielerbonus (`Stats.weaponCrit(w)`, `weaponCritMul(w)`); `P.crit` im HUD = aktive Waffe.
**Neue Stat-Hooks** (`Stats.add(id,{…})`, additiv): `fireRate` (+x), `dmgMul` (Basis 1), `reloadSpeed` (+x), `heatMul` (Basis 1) — Grundlage für Phase 5 (Mods).
**Arsenal:** `P.owned[]`; `P.hasSG/hasAuto` sind Alias-Properties (alter Code läuft weiter). `newRun()` setzt auf Pistole + Fäuste, Vorrat 36 zurück; Sektorstart behält Arsenal und zuletzt benutzte Waffe; Tod-Neustart stellt das Arsenal vom Sektorbeginn wieder her. Funde landen in `Save.data.unlockedWeapons` (Meta-Wirkung erst Phase 15).
**Steuerung:** Tasten **1–9**, **R**, Mausrad (wechselt), Touch: Waffen-Button wechselt zyklisch, neuer **R**-Button. Pause-Tastenliste ergänzt.
**HUD:** Anzeige „Magazin/Vorrat“ (Fäuste ∞), Nachlade-Balken + Text, Waffenleiste 1–9 (aktiv/gefunden), Low-Ammo/Ammo-0 je Waffe (Zellen gesamt ≤ 8 bzw. < Kosten), Hitze-Balken nur bei heißen Waffen.
**Code:** Pickup-Zeichen `c j l V S` (+ `s w`), `WPICK/WAMMO`, `grantWeapon()` (auch `NX.weapons.grant`), `NX.weapons.pshots/holes/beams`. Neue Sprites/Explosionsfarben (Plasma cyan, Void violett), Waffenansichten 5–9, Sounds `plasma/rail/arc/voidFire/singFire/reload/reloadDone/boomP/holeOpen/holeCollapse`.

**Getestet (Node-Harness, KEIN echter Browser):** neu `node test/t_weapons.js` (~130 Prüfungen: Daten, Fund, Wechsel, Magazin/Nachladen, Hitze, Energie, Reichweite, Rail-Durchschlag, Arc-Kette, Plasma/Void-Splash+Sog, Singularität, Krit, Pickups, Level-Drops, HUD, Arsenal). Angepasst: `t_hud.js` (Magazin statt Vorrat), `t_player.js` (Phase-Nr., Krit pro Waffe), `t_soak.js` (Waffenwechsel/Nachladen). Alle Tests + Zufallsläufe (6000 Frames Desktop, 1500 Touch): 0 Fehler, 0 Warnungen.

**Bitte live prüfen:** Waffengefühl/Balance (alle Werte in `WEAPONS`, Splash/Sog in `pdetonate`/`updateHoles`), Sichtbarkeit der Strahlen/Projektile/des Lochs, die 5 neuen Waffenansichten und Pickup-Sprites (nur blind gezeichnet), Lage des Touch-R-Buttons (Hoch-/Querformat), Höhe des Waffen-Panels durch die neue Leiste, ob Arc-Blaster (~8 Zellen/s) zu munitionshungrig ist.

## Phase 3 — Advanced Player System

Ziel: Schild, Panzerung, Energie, Sprint, Dash, Krit, Regeneration, Resistenz, Tempo — alles über **ein** Werte-Modul, damit Perks (Phase 14),
Waffenmods (5), Rüstungs-Loot (13) und Meta-Upgrades (15) nur noch „Bonusquellen“ eintragen müssen. Waffen, Gegner-KI, Level, Raycaster unverändert.

**Werte-Modul `Stats`** (Block „Spieler-Werte (Phase 3)“ vor `NX`, auch `NX.stats`, `__breach.Stats`)
- `PBASE` = Basiswerte, `PLIM` = Grenzen. `Stats.val` = abgeleitete Werte. `Stats.add(id,{key:+x})` trägt eine Bonusquelle ein (ersetzt gleiche id),
  `Stats.remove(id)`, `Stats.removePrefix(p)`, `Stats.sources()`. Boni sind additiv. **`run:`-Quellen** verschwinden bei `newRun()`, **`meta:`** und alles andere bleibt.
- Beispiele zum Testen in der Konsole: `__breach.Stats.add('meta:dd',{dashCharges:1})` (= Double Dash), `{hpRegen:1}`, `{resist:.2}`, `{speed:.15}`, `{crit:.1,critDmg:.5}`, `{armorMax:25}`.
- `Stats.onRunStart()` / `Stats.onSector()` (Aufruf am Ende von `parseLevel`, also bei jedem Sektorstart inkl. Neustart nach Tod) füllen Schild/Energie, Panzerung mindestens auf Grundfüllung, Dash bereit.

| Wert | Basis | Wirkung |
|---|---|---|
| Schild | max 25, Regen 8/s nach 3,5 s ohne Treffer | nimmt Schaden zuerst; Zusammenbruch = Ton + Meldung + cyan Randblitz |
| Panzerung | max 50, Sektorstart-Grundfüllung 30 % (=15), **kein** Regen | nimmt 50 % des Schadens auf, der das Schild durchschlägt (Doom-Prinzip, 1 Panzerung pro 1 abgefangenem Schaden) |
| Integrität (HP) | 100 (fest), Regen `hpRegen` Basis **0**, Verzögerung 4 s | bleibt **ganzzahlig** (Rest wird aufgerundet, mind. 1) |
| Resistenz | 0 %, Deckel 75 % | multipliziert den Eingangsschaden vor Schild/Panzerung |
| Energie | max 100, Regen 22/s nach 0,6 s | Sprint 15/s, Dash 20 |
| Sprint | Umschalt / Pad-Ausschlag > 78 % → Tempo 4,8 (Gehen 3,2) | kostet Energie; bei 0 **gesperrt**, bis Energie ≥ 20 % **und** Taste losgelassen (sonst Dauer-Sprint) |
| Tempo | Faktor 1,0 (0,5–2,0) | multipliziert Gehen + Sprint |
| Dash | 1 Ladung, Cooldown 1,2 s je Ladung, 20 Energie, Weite 2,6, 0,17 s, **unverwundbar** währenddessen | Richtung = Bewegungseingabe, ohne Eingabe nach vorn; Teilschritte (max 0,2), kein Durchtunneln von Wänden |
| Double Dash | `dashCharges` +1 | zwei Ladungen, laden nacheinander auf |
| Krit | Chance 5 %, Multiplikator 1,5× | jeder Spielertreffer rollt (Schrotkugeln einzeln); Fadenkreuz amber + `sfx.crit`; nur im echten Spiel, nicht in der Titel-Demo |

**Steuerung:** Desktop **F** oder **Rechtsklick** = Dash (Pause-Menü-Tastenliste ergänzt). Touch: neuer runder **Dash-Button** links neben dem Feuer-Button
(15cqw, max 78 px), wird bei leerer Ladung abgedunkelt. Bestehende Touch-Steuerung sonst unverändert.

**Schadenspipeline** (`hurtPlayer`): Dash-i-Frames → Resistenz → Schild → Panzerung → HP. Jeder Treffer, der den Spieler erreicht (auch nur aufs Schild), setzt
Combo/Streak zurück (wie Phase 2); ein per Dash ausgewichener Treffer nicht. `P.crit` bleibt das HUD-Feld (jetzt 5 % statt 0 %).

**HUD:** Shield/Armor/Energy-Slots leuchten jetzt (Max > 0). Neue vierte Zeile **DS** im Integrität-Panel: Balken = geladene Ladungen + Fortschritt der nächsten,
cyan wenn bereit, Trennstrich bei 2 Ladungen. Energie-Balken blinkt rot bei Sprint-Sperre bzw. Dash ohne Energie. Neue Randeffekte `#shieldFx` (cyan), `#dashFx` (hell).

**Balance-Hinweis:** Schild 25 + Panzerung 15 machen den Spieler zu Sektorbeginn ca. 30–40 HP „dicker“ als vorher. Stellschrauben: `PBASE.shieldMax`,
`armorSector`, `armorAbsorb`, `shieldDelay`. Gegner werden erst in Phase 6–8 härter.

**Noch ohne Quelle (Systeme laufen, Werte 0):** HP-Regen, Resistenz, Tempo-Bonus, Krit-Bonus, Double Dash — kommen über Perks/Meta/Mods (Phase 5/13/14/15).
Dash-/Sprint-Effekte sind bewusst schlicht (Randblitz + Ton); Trails/FOV-Kick folgen in Phase 19 (FOV ist wegen `PLANE_LEN`/`PROJ` konstant verdrahtet).

**Getestet (Node-Harness, KEIN echter Browser):** neu `node test/t_player.js` (~70 Prüfungen: Startwerte, Pipeline Schild→Panzerung→HP, Ganzzahligkeit, Resistenz,
Regen-Verzögerung, Sprint-Kosten/Sperre/Freigabe, Tempo, Dash inkl. i-Frames/Cooldown/Double Dash/Energiemangel, 400 zufällige Dashes ohne Wand-Treffer, Krit,
HP-Regen, Quellen/Lauf-Reset, Sektorstart, HUD). Angepasst: `t_hud.js` (Schild-Slot ist jetzt standardmäßig aktiv; Combo-Test ohne zufällige Gegnerschüsse),
`t_soak.js` (Dash + Bonusquellen im Zufallslauf). Alle älteren Tests + Zufallsläufe (6000 Frames Desktop, 1500 Touch): 0 Fehler, 0 Warnungen.

**Bitte live prüfen:** Dash-Gefühl (Weite/Dauer/Cooldown), Sprint-Dauer (≈ 6,7 s), ob Schild/Panzerung zu viel Puffer geben, Lage des Touch-Dash-Buttons
(Hoch- und Querformat), ob F/Rechtsklick gut erreichbar sind, Lesbarkeit der 4-zeiligen Balken im Integrität-Panel auf dem Handy.

## Phase 2 — Next-Gen HUD

Ziel: Sci-Fi-Combat-HUD mit allen geforderten Werten und dynamischen Warnungen — **rein darstellend**, es ändert keinen Spielwert
und keine Steuerung. Bestehende Panels (Integrität, Waffe/Munition, Gesicht, Splitter, Rogue-Prozesse) bleiben, `#bar` ist jetzt
`align-items:stretch` (gleich hohe Panels).

**Was jetzt im HUD steht**

| Wert | Wo | Stand |
|---|---|---|
| Integrität, Munition, Heat, Splitter, Feinde | wie bisher | echt |
| **Shield / Armor / Energy** | 3 dünne Balken (SH/AR/EN) im Integrität-Panel | Slots fertig, **gedimmt**, solange `P.shieldMax/armorMax/energyMax = 0`. Werden mit Phase 3 aktiv (Balken leuchtet automatisch, sobald Max > 0) |
| **Aktuelle Waffe + Waffenlevel** | Label im Waffen-Panel („Puls-Pistole  LV1") | Name echt, Level aus `P.wLv[weapon]` (Standard 1; Phase 4/5 füllen es) |
| **Crit Chance** | „KRIT 0%" im Waffen-Panel | aus `P.crit` (Standard 0; Phase 3 füllt es) |
| **Sektor** | oben links: Name + „Tiefe N · Biom" bzw. „Sektor N · Biom" | echt |
| **Objective** | oben links, amber: Boss besiegen / Treppe hinauf / Portal erreichen (+ Feindzahl) / Sektor erkunden | echt (aus Boss, `stairsCell`, `exitCell`) |
| **Threat Level** | 5 Segmente + Text (RUHIG … EXTREM) im Rogue-Prozesse-Panel | echt: gewichtete Summe **wacher** Gegner in 16 Feldern Umkreis (Boss ×3, nahe Gegner zählen voll), ~10×/s berechnet |
| **Combo + Kill Streak** | oben links unter dem Sektor, erscheint ab Kette ≥ 2 bzw. Streak ≥ 3 | echt, siehe unten |
| **Boss-Leiste** | oben mittig: Name, Level, HP-Balken mit Nachzieh-Anzeige und Marken bei 75/50/25 % (Vorbereitung für Boss-Phasen, Phase 9) | erscheint, sobald der Boss wach ist |

**Combat-Tracker** (`NX.combat`, Block „Architektur"): *Streak* = Kills seit dem letzten erlittenen Schaden (bleibt über Sektoren
erhalten, `newRun()` setzt zurück); *Kette* = Kills, die jeweils < 4 s auseinander liegen (`COMBO_WINDOW`), Balken zeigt die Restzeit.
Schaden setzt beides zurück. Zählt nur im Zustand `play` (die Titel-Demo beeinflusst nichts). **Kein Score-Multiplikator** — das
x1/x2/x3/x5/x10-System ist Phase 17 und baut auf diesem Tracker auf.

**Dynamische Warnungen** (Klassen auf `#stage`, CSS steuert die Optik, daher kaum JS-Kosten):
- **Low HP (≤ 30)**: rote Vignette pulsiert, Rahmen des Integrität-Panels rot, Zahl rot mit dezentem Glitch-Flackern (RGB-Versatz, nur kurze Aussetzer); ab ≤ 15 schneller. Herzschlag-Ton (`sfx.lowHp`, alle 1,5 s bzw. 0,9 s).
- **Low Ammo (≤ 8)**: Waffen-Panel blinkt amber, Zahl amber (rot bei 0), Doppel-Piep beim Unterschreiten (`sfx.lowAmmo`).
- **Heat > 66 %**: Balken glüht (`hot`). **Überhitzt**: orange pulsierende Vignette, „ÜBERHITZT" blinkt im Panel (der bestehende Overheat-Sound bleibt).
- **Boss**: Boss-Leiste blendet ein/aus (nicht mehr sichtbar nach Boss-Tod).
- **Reduced Motion**: Klasse `rm` auf `#stage` (aus `NX.settings.reducedMotion` oder `prefers-reduced-motion`) schaltet Pulsieren/Glitch/Blinken ab, statische Warnfarbe bleibt. `hudApplySettings()` ruft das Settings-Menü später erneut auf.

**Performance:** DOM wird nur bei Wertänderung beschrieben (`hset`/`hcls`-Cache), keine neuen Elemente zur Laufzeit,
Threat nur jeden 6. Frame. `updateHud(dt)` ruft weiter den alten Kern (`updateHudCore`) und danach `hud2Update`. Das neue HUD
(`#hud2`) ist im Titelbild ausgeblendet (`.hud-on` auf `#stage`, gesetzt über `NX.onState`).

**Touch:** alle neuen Elemente sind `pointer-events:none`, die Steuerung ist unverändert. Boss-Leiste auf Touch schmaler (34cqw)
wegen der Minimap. Die Touch-Elemente überdecken weiterhin teilweise die untere Leiste (war schon vorher so) — bitte live prüfen.

**Getestet (Node-Harness, KEIN echter Browser, nichts visuell geprüft):** `node test/t_hud.js` (Sichtbarkeit, Slots an/aus,
Low HP/Ammo/Heat/Overheat, Waffenlevel/Krit, Threat rauf/runter, Combo/Streak/Ablauf/Reset), `node test/t_boss.js`
(Leiste an/aus, Level, 100→50 %, Ghost, Boss-Tod); zusätzlich alle Phase-1-Tests + Zufallslauf Desktop/Touch ohne Fehler.
Neu im Harness: `classList`-Tracking, damit Klassen prüfbar sind.

**Bitte live prüfen:** Lesbarkeit/Platz der neuen Zeilen (v. a. Handy, Hochformat), Stärke von Vignette/Glitch (alles über
CSS-Werte `#vigLow`, `#vigHeat`, `@keyframes hudGlitch/vigPulse` schnell nachstellbar), Threat-Schwellen in `threatLevel()`,
Low-Ammo-Grenze (`P.ammo<=8`), ob Herzschlag-/Piep-Ton nicht nervt.

## Phase 1 — Foundation / Code Architecture

Ziel: saubere interne Architektur, **ohne** Verhalten zu ändern und ohne den Raycaster anzufassen.
Alles steckt in einem neuen Block „Architektur (Phase 1)" in `game.html` (direkt vor dem Abschnitt „Eingabe").

**Neu: Namespace `NX`** (auch als `window.__breach.NX` zum Debuggen erreichbar) — ein Einstiegspunkt für alle Teilzustände.
Bestehende Variablen bleiben unverändert und schnell (`P`, `enemies`, `grid` …); `NX` greift per Getter darauf zu,
weil Level-Variablen bei jedem Sektor neu zugewiesen werden:

- `NX.player` → `P` (Phase 3 erweitert: Shield/Armor/Energy/Dash …)
- `NX.weapons` → `defs` (`WEAPONS`), `current`, `isUnlocked(i)` (Phase 4/5)
- `NX.enemies` → `types` (`ETYPES`), `list`, `alive` (Phase 6–8)
- `NX.level` → `def`, `grid`, `width/height`, `biome`, `depth`, `exit`, `stairs`, `pickups`, `shots`, `totals` (Phase 10–12)
- `NX.progression` → `stats`, `run`, `save` (Phase 15–17)
- `NX.audio` → `ctx`, `muted`, `sfx` (Phase 18)
- `NX.fx` → `FX` (Phase 19)
- `NX.save`, `NX.settings` → Save State (siehe unten)

**Game State Manager:** `setState(next)` ersetzt alle rohen `state='…'`-Zuweisungen (10 Stellen).
Erlaubte Übergänge stehen in `STATE_FLOW`; ein ungewöhnlicher Übergang wird **einmalig gewarnt, aber nie blockiert**
(bewusst: keine Regression durch zu strenge Regeln). `NX.onState((next,prev)=>…)` registriert Listener
(Phase 2+ nutzen das z. B. fürs HUD/Musik). Beim Verlassen von `play` wird automatisch der Spielstand gesichert.
Die Variable `state` selbst bleibt bestehen — Lesezugriffe (`state==='play'`) sind unverändert.

**Effects State `FX`:** die lose verteilten Globals `shakeAmt, hurtT, healT, hitMarkT, msgT, flashAdd, faceKind`
sind jetzt `FX.shake, FX.hurt, FX.heal, FX.hitMark, FX.msg, FX.flashAdd, FX.faceKind` (reine Umbenennung, gleiche Logik).
Phase 19 (Juice) hängt sich hier ein.

**Save State (LocalStorage, offline, kein Konto):** Schlüssel `nexus_breach_save`, `SAVE_VERSION = 1`.
- Schema: `highestDepth, credits, bestScore, bestTime, unlockedWeapons, weaponUpgrades, perks, artifacts,
  achievements, stats{kills,deaths,runs,bossKills,sectorsCleared,playTime}, settings{…}`.
- Settings (Daten vorhanden, Menü folgt in einer späteren Phase): `masterVol, sfxVol, musicVol, screenShake, scanlines,
  pixelFx, particles, damageFlash, fov, mouseSens, touchSens, reducedMotion` — jeweils geklemmt auf gültige Bereiche.
- **Migration:** `MIGRATIONS[n]` hebt Version n auf n+1 (aktuell leer, Beispiel im Code). Ein Save mit **neuerer**
  Version wird nie überschrieben (`readOnly`).
- **Robustheit:** korrupter JSON → Defaults; Fremd-/Müllwerte werden beim Laden bereinigt; fehlt `localStorage`
  (Privatmodus) läuft das Spiel normal weiter; Schreiben ist entprellt (800 ms) plus Flush bei `pagehide`,
  Tab-Wechsel und Verlassen von `play`.
- **Legacy:** die alten Schlüssel `orca_breach_best` / `orca_breach_bestdepth` bleiben unverändert in Betrieb;
  beim allerersten Start ohne Save werden sie ins neue Save übernommen.
- **Hooks im Spielablauf:** `onRunStart` (newRun), `onLevelStart` (Tiefe — nicht beim Titel-Demo), `onKill` (nur im
  Zustand `play`, zählt Boss separat), `onDeath`, `onSectorClear`, `onRunEnd`, `onCampaignComplete`; `playTime` läuft in `update()`.

**Nicht angefasst:** Raycaster/Rendering, Level-Generierung, Gegner-KI, Waffen, Touch-Steuerung, Pointer-Lock, Audio,
PWA-Dateien (`sw.js`, `manifest.json`, `index.html`). Ein Frame kostet praktisch nichts extra (ein Additions-Schritt für `playTime`).

**Getestet (Node-Harness `test/`, gestubbte DOM/Canvas — KEIN echter Browser):**
- `node test/t_boot.js` — Boot + 120 Titel-Frames, 0 Konsolenfehler
- `node test/t_play.js` — Story-Sektor: Kill, Tod, Neustart, Sektor-Abschluss; State-Übergänge und Save-Zähler stimmen
- `node test/t_save.js` — 12 Save-Checks (korrupt, Müllwerte, neuere Version, Legacy-Import, kein Storage, Roundtrip, Pause)
- `node test/t_soak.js [touch] [frames]` — Zufallslauf mit zufälligem Input: 6000 Frames Desktop, 1500 Frames Touch-Modus, 0 Fehler/Warnungen

**Bitte einmal live prüfen (nicht automatisiert testbar):** Sieht das Spiel auf Desktop und Handy exakt aus wie vorher?
Funktionieren Pause (Esc/P), Waffenwechsel, Touch-Steuerung, Treffer-Rot/Heil-Grün-Flash, Kamerawackeln und Gesichts-HUD wie gewohnt?
Im Browser-Cache unter Application → Local Storage sollte nach dem ersten Spiel `nexus_breach_save` auftauchen.

---

## Frühere Änderungen (vor dem Overhaul)

Stand damals: 24.09.2026. Teil des MC ORCA Games Portfolios, bewusst NICHT
mit Supabase/Konto/MOGC verbunden.

## Touch-Steuerung für Handy/Tablet ergänzt

Rückmeldung: auf dem Handy ging das Spiel noch nicht — es gab bislang
ausschließlich Maus+Tastatur-Steuerung (inkl. Pointer-Lock fürs Umschauen),
keinerlei Touch-Eingabe. Jetzt per `isTouch`-Erkennung
(`matchMedia('(hover:none) and (pointer:coarse)')`) eine On-Screen-Steuerung,
die nur auf Touch-Primärgeräten eingeblendet wird (Desktop bleibt unverändert
bei Maus/Tastatur):

- **Move-Pad** unten links (fester Kreis, Finger zieht den Knauf) → Vor/
  Zurück/Strafe, wie bisher `WASD`. Volle Auslenkung (>78% Radius) löst
  zusätzlich Sprint aus (bisher `Shift`).
- **Blick-Drag**: jeder Touch außerhalb von Move-Pad/Buttons dreht die
  Kamera (horizontal) und steuert den Pitch (vertikal, siehe vorheriger
  Punkt) — Ersatz fürs Maus-Movement, läuft komplett ohne Pointer-Lock.
- **Feuer-Button** unten rechts (Kreis, gedrückt halten = Dauerfeuer wie
  `Space`/Maustaste).
- **Waffe-wechseln-Button** (⇄, zyklisch durch freigeschaltete Waffen:
  Pistole → Fäuste → Streu-Kanone (falls gefunden) → Overclock-Gewehr (falls
  gefunden) → zurück zur Pistole) und **Pause-Button** (❚❚) rechts oben,
  da `1`-`4`/`P` auf Touch nicht existieren.
- Pointer-Lock-Versuche werden auf Touch komplett übersprungen (`requestLock()`
  ist dort ein No-Op), das lief vorher schon ins Leere, hätte aber theoretisch
  Fehlerpfade auslösen können.
- Viewport-Meta um `maximum-scale=1, user-scalable=no` ergänzt, damit
  Pinch-/Doppeltipp-Zoom beim Spielen nicht dazwischenfunkt; die
  Touch-Fläche selbst hat `touch-action:none` gegen Scroll-Geste.
- Move-/Blick-/Feuer-Touches werden über eigene `identifier`s sauber
  auseinandergehalten (Mehrfingerbedienung möglich) und beim Verlassen des
  `play`-Status (Pause/Tod/Levelende) jeden Frame zurückgesetzt, damit keine
  "hängenden" Touch-IDs überleben.
- Menü-Overlays (Titel, Pause, Sektor geschafft) funktionieren unverändert
  über normale Taps/Klicks — die Touch-Steuerungs-Fläche liegt im DOM vor dem
  Overlay und ist außerhalb von `play` per `pointer-events:none` inaktiv.
- Kein Gerätetest möglich (kein Handy hier) — nur Syntaxprüfung und Logik
  gegengelesen. Bitte einmal live auf dem Handy testen, v.a. Move-Pad-Gefühl,
  Blick-Sensitivität (`TOUCH_TURN`/`TOUCH_PITCH`) und ob die Button-Größen für
  den Daumen passen — alles über cqw-Einheiten schnell nachjustierbar.

## Freie Kopfbewegung (Pitch-Begrenzung stark erweitert)

Rückmeldung: nach oben/unten kucken (Maus-Pitch) war kaum spürbar möglich,
dadurch wurden kleine/niedrige oder tiefsitzende Gegner kaum getroffen.
Ursache: `P.pitch` war auf ±32 begrenzt (bei HALF=300 nur ~10% der
Bildschirmhöhe). Der Raycaster faked Pitch rein über eine Verschiebung der
Horizont-Linie (`horizon=HALF+P.pitch+...`), Boden/Decke/Wände/Sprites sind
alle sauber auf die Canvas-Höhe geclampt (`Math.max(0,...)`/`Math.min(H-1,...)`)
— eine größere Pitch-Spanne bricht das Rendering also nicht. Grenze auf ±220
angehoben, Maus-Sensitivität unverändert gelassen. Nur Desktop/Maus (Pointer-
Lock) betroffen — es gibt aktuell keine Touch-/Mobile-Steuerung im Spiel.

## Sync der beiden Arbeitsstände

Es gab zwei parallele Stände: einen bereits veröffentlichten (Login-Gate
entfernt, PWA-Dateien index.html/manifest.json/sw.js/Icons/download.html,
game.html aber noch mit dem alten, biom-unabhängigen Gegner-Roster) und einen
mit dem neuen, biom-spezifischen Gegner-Roster (5-6 Typen je Biom, siehe
unten), der aber noch das interne Test-Login-Gate und den "Testspiel"-Titel
hatte. Zusammengeführt: game.html hat jetzt den neuen Gegner-Content, aber
ohne Login-Gate, mit öffentlichem Titel und den PWA-Head-/Body-Tags. Die
PWA-Wrapper-Dateien (index.html, manifest.json, sw.js, Icons, download.html)
kommen unverändert vom veröffentlichten Stand.

## Großer Nachschlag: 5-6 Gegnertypen pro Biom, Außenbiome jetzt kreaturen-lastig

Wunsch: mehr Gegner, 5-6 je Biom, aber in den Außenbiomen überwiegend
Lebewesen statt Robotern (nur noch vereinzelt eine Drohne draußen), Anlage
bleibt mechanisch. Vorher-Zustand war noch robot-lastig (jedes Außenbiom
hatte 2-3 Roboter + nur 1 eigene Kreatur). 11 neue Typen dazu, Roster komplett
neu zugeschnitten:

**Anlage (6, mechanisch):** d,p,r,t (bestehend) + neu **`e` Sprenger-Einheit**
(hp16, spd2.5, rennt bis auf Kontakt ran und detoniert einmalig — 22 Schaden,
tötet sich selbst über den normalen `damageEnemy`-Pfad für korrekte Kill-
Zählung/Boom-Effekt, kein Cooldown-Zyklus wie sonst) und **`k` Schild-Läufer**
(hp160, spd0.85, langsamer Juggernaut mit 20-Schaden-Nahkampf — Wieder-
verwendung von `sprRig` mit neuem `bulwarkExtra`-Schulterpanzer statt eigener
Zeichenfunktion).

**Schlucht (5):** d (jetzt nur noch 0.3 Gewicht, "vereinzelt"), g (bestehend)
+ neu **`f` Fels-Brecher** (hp90, träger Nahkampf-Brecher, übernimmt Rigs
alte Tank-Rolle organisch), **`q` Kristall-Spucker** (hp50, stationär,
Fernkampf — übernimmt Turms alte Rolle organisch), **`v` Geier-Schwarm**
(hp16, spd2.3, schneller fliegender Sturzangriff). r und t komplett aus der
Schlucht entfernt.

**Wüste (5):** d (0.3), b (bestehend) + neu **`x` Skorpion-Läufer** (hp26,
schneller Nahkampf), **`y` Sandschleier-Geist** (hp38, stationär, Fernkampf
— übernimmt Turms Rolle organisch), **`z` Dünen-Rochen** (hp30, schneller
Nahkampf, zweite Geschwindigkeit/Statistik-Variante zu x). t entfernt.

**Dschungel (5):** d (0.2), n (bestehend) + neu **`i` Ranken-Schlinger**
(hp36, mittelschneller Ambush), **`u` Leucht-Schwarm** (hp10, spd2.8,
schnellster/schwächster Schwarm-Typ überhaupt), **`o` Moos-Koloss** (hp100,
träger Nahkampf-Brecher — Jungle-Pendant zu Fels-Brecher). p und r entfernt.

**Sprite-Wiederverwendung** (4 neue Grundformen statt 11 komplett eigener,
hält die Codemenge im Rahmen — Chassis-/Hautfarbe je Biom sorgt trotzdem für
Unterscheidung): `sprBomber`→e, `sprBrute`→f+o (Fels-Brecher/Moos-Koloss,
gleiche "breitschultriger Brecher"-Silhouette), `sprCaster`→q+y (Kristall-
Spucker/Sandschleier-Geist, wurzelnde Fernkampf-Form mit Spitzen- vs.
Ranken-Krone als Unterscheidungs-Flag), `sprSwarmling`→v+u (Geier-/Leucht-
Schwarm, geflügelte Kleinform), `sprRidge` (bereits für g) wiederverwendet für
x+z, `sprWorm` (bereits für b) wiederverwendet für i (aufrichtende Tendril-
Form passt auch für "aus dem Unterholz schießende Ranke").

**KI datengetrieben statt 20+ einzelner if/else-Zweige:** `STATIONARY_TYPES`
(bewegt sich nie: t,n,q,y), `APPROACH_STOP` (rennt ungebremst bis X Distanz:
p,r,g,b,k,f,o,v,x,z,u,i,e — nur der Zahlenwert unterscheidet sich),
`MELEE_STATS`/`RANGED_STATS` (Reichweite/Cooldown/Schaden pro Typ als Array).
Nur d (Kite-Verhalten) und K (Burst-Fire/Rage) bleiben eigene Zweige, weil ihr
Verhalten strukturell anders ist. Deutlich kürzer und wartbarer als 22 einzelne
Typ-Vergleiche, bei identischer Formel pro Fall.

**Gefundener Bug beim ersten Simulationslauf:** `o` (Moos-Koloss) fehlte
komplett in `BIOME_ROSTER` (in keinem der vier Biome gelistet) — `roster.o`
wäre `undefined` gewesen, `place('o', NaN, ...)` hätte still gar nichts
platziert. Gefixt, mit `o:0`/`o:1` explizit in allen vier Biom-Objekten.

Per Node-Simulation (Depths 1–30, alle 4 Biome durchgezählt welche Typen mit
Anzahl>0 je vorkommen) verifiziert: **Anlage 6, Schlucht 5, Wüste 5, Dschungel
5 Typen** — trifft die gewünschten 5-6 exakt. Kein Browsertest — nur Syntax-
und Zahlenprüfung, keine visuelle Kontrolle der 4 neuen Sprite-Grundformen.

## Drei organische "korrumpierte" Kreaturen (je eine pro Außenbiom)

Rückmeldung: die Biom-Unterscheidung von eben (andere Chassis-Farbe, anderes
Roboter-Roster je Biom) hat noch nichts an der Grundform geändert — überall
nur Roboter/Drohnen mit anderer Lackierung. Jetzt kommt in jedem Außenbiom
zusätzlich EIN organischer, klar nicht-mechanischer Gegnertyp dazu, der
zugleich eine taktische Lücke der jeweiligen Roboter-Mischung füllt statt nur
zu duplizieren:

- **`g` Grat-Läufer (Schlucht)** — niedriger, vierbeiniger Kletterer mit
  Rückenstacheln, rissiger Panzerhaut. Aggressiver Ambush-Rush (hp 34, spd
  2.1, Nahkampf 11 Schaden alle 0.85–1.15s). Ergänzt die zähen, aber
  langsameren Roboter der Schlucht (Rig/Turm) um eine schnelle Bedrohung.
- **`b` Sandwurm-Wirt (Wüste)** — segmentierter, sich aufrichtender Wurm
  ("taucht aus dem Sand auf"). Schwerer Überraschungs-Biss (hp 40, spd 1.7,
  15 Schaden alle 1.3–1.7s). Die Wüste war bisher rein Fernkampf
  (Drohne+Turm) — der Wurm bringt die einzige Nahkampf-Bedrohung dort rein.
  Kein echtes Burrow-Verstecken implementiert (bräuchte eigene
  Sichtbarkeits-/Awake-Logik) — bewegt sich wie ein normaler Nahkämpfer,
  reine Optik+Statistik-Differenzierung.
- **`n` Sporen-Wächter (Dschungel)** — verwurzelte, bulböse Pflanzenkreatur
  mit sichtbaren Sporenkapseln, bewegt sich nie (teilt sich die
  Stationär-Logik jetzt mit dem Turm-Sentinel, `e.type==='t'||e.type==='n'`).
  Fernkampf-Sporenwurf (hp 45, 10 Schaden alle 1.8–2.4s, Reichweite 9 statt
  der 14 des Turms — dichteres Blattwerk, kürzere Sichtlinien). Der Dschungel
  war bisher rein Nahkampf (Spinne+Rig) — der Sporen-Wächter ist dort die
  einzige Fernkampf-Bedrohung.

Eigene Akzentfarbe für alle drei: Violett (`#C13DFF`) statt dem mechanischen
Amber/Cyan der Roboter (`TYPE_ACCENT`) — Korruptions-Glühfarbe, die "organisch,
aber vom selben Rogue-Prozess infiziert" signalisiert, nicht einfach eine
vierte zufällige Farbe. Chassis-/Hauttöne kommen weiter aus `BIOME_GRIME`
(dasselbe Rost/Sand/Moos-System wie bei den Robotern), damit sie trotzdem
farblich in ihr Biom passen.

Rein additiv in bestehende Systeme eingehängt: `ETYPES`, `SPR_BUILDERS`,
`TYPE_ACCENT`, `BIOME_ROSTER` (Gewicht 1 nur im eigenen Biom, sonst 0),
`place()`-Aufrufe in beiden Generatoren — keine Sonderfälle nötig außer der
Stationär-Logik-Erweiterung für `n`. Per Node-Simulation (Depths 1–14)
gegengeprüft: jede Kreatur bleibt strikt auf ihr Biom beschränkt, keine
Streuung in andere Biome.

Kein Browsertest — nur Syntaxprüfung und Zahlen-Simulation, keine visuelle
Kontrolle der drei neuen Sprites.

## Jedes Biom hat jetzt sein eigenes Gegner-Roster + eigene Chassis-Farben

Vorher spawnten `d`/`p`/`r`/`t` überall gleich, unabhängig vom Biom. Jetzt zwei
unabhängige Ebenen der Differenzierung:

**1) Roster pro Biom** (`BIOME_ROSTER`, Gewicht 0–1 je Typ, skaliert die sonst
übliche Anzahl in `generateProceduralLevel`/`generateStairFloor`):
- **Anlage**: volle Mischung (d/p/r/t), wie bisher — die "Heimat" aller Typen.
- **Schlucht**: Rogue-Rig + Turm-Sentinel voll, Glitch-Drohne halbe Dichte,
  keine Spinnen-Sonden — eingegrabene, zähe Verteidigung.
- **Wüste**: nur Glitch-Drohne + Turm-Sentinel, kein Nahkampf — offene
  Sichtlinien, reine Fernkampf-Biome.
- **Dschungel**: nur Spinnen-Sonde + Rogue-Rig, keine Drohne/kein Turm —
  dichtes Unterholz verhindert Fernsicht/Flugmanöver, reine Nahkampf-/
  Schwarm-Ambush-Biome.
Per Node-Check gegengeprüft (Depths 1–14 durchsimuliert): Gewichtung greift
korrekt, keine negativen/kaputten Zählwerte, Biome ohne einen Typ bekommen
davon konsequent 0.

**2) Chassis-Farbe pro Biom** (`BIOME_GRIME`, an die jeweiligen Wand-/Boden-
Texturen angelehnt: rostig in der Schlucht, sandig in der Wüste, bemoost im
Dschungel): `sprDrone`/`sprSpider`/`sprTurret` (vorher hart codierte Farben)
und `sprRig` (war schon parametrisiert) nehmen jetzt alle dieselbe
Palettenform `{body,dark,acc,vis}`. Signalfarben (Warnlicht-Auge, Cyan-
Techglow-Punkte, je Typ die feste Akzentfarbe aus `TYPE_ACCENT`) bleiben über
alle Biome hinweg gleich, damit ein Gegnertyp am Leuchtton erkennbar bleibt —
nur die Chassis-Grundfarbe wechselt. Sprite-Sätze werden einmalig beim Start
für alle 4 Biome vorberechnet (`SPR_BIOME`, wie die Wand-/Boden-Texturen es
schon vormachen), `curSPR` schaltet beim Levelstart passend zum Biom um
(`parseLevel`, analog zu `curWall`/`curFloor`/`curCeil`).

Boss (`K` Kern-Wächter) bewusst NICHT biomabhängig gemacht — bleibt überall
optisch/statistisch identisch. Hand-kuratierte Kampagnen-Level (Sektor 1–5)
weiterhin nicht angefasst (nutzen automatisch die Facility-Sprites, da sie
kein `biome`-Feld setzen → Fallback).

Kein Browsertest — Syntaxprüfung plus Node-Simulation der Roster-Zahlen, keine
visuelle Kontrolle der neuen Farbvarianten.

## Zwei neue Gegnertypen (Zufallslauf + Zwischenetagen)

Vorher nur 3 Typen insgesamt: Glitch-Drohne (`d`, Fernkampf, mittlere Distanz
haltend), Rogue-Rig (`r`, Nahkampf-Rusher), Kern-Wächter (`K`, Boss). Zwei neue,
bewusst als Verhaltens-*und* Silhouetten-Gegenpole zu den bestehenden entworfen
(nicht nur Recolors — eigene `sprSpider`/`sprTurret`-Zeichenfunktionen statt
Wiederverwendung von `sprRig`):

- **`p` Spinnen-Sonde** — flacher, achtbeiniger Chassis-Läufer. Sehr
  zerbrechlich (12 HP, stirbt in 1-2 Pistolenschuss), sehr schnell (spd 2.6),
  reiner ungebremster Nahkampf-Rush ohne Rückzugsphase (anders als Rogue-Rig:
  kein `dist<0.95`-Reset, rennt bis zum Anschlag rein), schneller Angriffs-
  zyklus (0.55–0.85s) aber wenig Schaden pro Treffer (6) — Schwarm-/Panik-
  Bedrohung, will in Zahl auftreten statt einzeln gefährlich zu sein.
- **`t` Turm-Sentinel** — gedrungener, stationärer Sockel mit Linsenkopf,
  bewegt sich *nie* (eigener `spd:0`-Zweig in `updateEnemy`, übergeht auch das
  Flowfield-Pathing bei fehlender Sicht komplett — bleibt garantiert stehen).
  Tanky (110 HP), langsamer Fernkampf-Zyklus (2.4–3s) aber harter Einzeltreffer
  (16 Schaden, engerer Streuwinkel als die Drohne) und größere Erkennungs-
  reichweite (14 statt 11) — klassisches Hindernis: entweder aus der Distanz
  wegsnipen oder unter Beschuss anrennen und flankieren.

Platzierung folgt demselben Tiefen-Progressions-Muster wie `d`/`r`: Spinnen-
Sonden ab Tiefe 2 (skaliert bis 5 auf Hauptebenen), Turm-Sentinel ab Tiefe 5
(Hauptebenen) bzw. 7 (Zwischenetagen), auf Zwischenetagen durchgehend etwas
schwächer besetzt — analog zum bestehenden Muster bei `d`/`r`. Beide Typen
sind komplett generisch in `ETYPES`/`SPR` eingehängt, keine Sonderfälle in der
Platzierungs-/Render-Pipeline nötig (die bestehende `ETYPES[c]`-Zuordnung beim
Level-Aufbau greift automatisch für jeden neuen Buchstaben).

Legende oben im File aktualisiert. Hand-kuratierte Kampagnen-Level (Sektor
1–5) bewusst NICHT angefasst — nur der Zufallslauf-Generator und die
Zwischenetagen, wo die Session gerade dran arbeitet.

Kein Browsertest — nur Syntaxprüfung und manuelle Koordinaten-Kontrolle der
neuen Sprite-Zeichenfunktionen (beide Canvas 64×64, alle Koordinaten innerhalb
der Grenzen bis auf ein kosmetisch irrelevantes 1px-Clipping an einer
Spinnenbein-Spitze im Tod-Frame). Balance (HP/Schaden/Tempo) ist eine erste,
plausible Einschätzung relativ zu den bestehenden Typen, keine Spielprobe.

## Einige Deckenlampen flackern jetzt

Decke war bisher eine einzige, überall identisch gekachelte Textur (`texCeil`,
mit fest eingebackenem Lampen-Icon) — jede Deckenzelle sah exakt gleich aus,
keine Variation, kein Blinken. Jetzt: `renderFloorCeil` bekommt pro
Bildschirm-Pixel im Deckenbereich zusätzlich die Gitterzelle (`mx,my`) und
hasht sie genau wie schon die Server-Racks (`(mx*928371)^(my*589301)`); nur
etwa 1 von 7 Zellen (gehasht, nicht pro Frame neu gewürfelt — bleibt über die
ganze Laufzeit stabil dieselbe Teilmenge) ist eine "Flacker-Lampe". Für diese
Zellen wird statt der ruhigen `texCeil` ein 15-Frame-Zyklus
(`CEIL_FLICKER_FRAMES`, größtenteils an, mit vereinzelten Dunkel-/Aus-
Stotterern — wie eine kaputte Leuchtstoffröhre statt gleichmäßigem Pulsieren)
abgespielt, Phase wieder pro Zelle über den Hash versetzt, damit nicht alle
im Gleichtakt flackern. Wichtig: nicht nur die Lampen-Grafik wechselt, auch
die tatsächliche lokale Helligkeit (`f`-Faktor in `shade()`) sinkt synchron
mit (`CEIL_FLICKER_F`, z. B. 0.28 im Aus-Frame) — eine flackernde Zelle wird
also wirklich dunkler, nicht nur optisch anders texturiert.

Dichte (aktuell 1/7) und Zyklus-Timing (`time*2.4 + (h%97)*0.08`) sind zwei
einzelne Werte in `renderFloorCeil`, leicht nachjustierbar falls mehr/weniger
oder schneller/langsamer gewünscht ist.

Kein Browsertest — nur Syntax-/Strukturprüfung. Der zusätzliche Hash+Branch
läuft pro Pixel im Deckenbereich (~halbe Bildschirmfläche); sollte angesichts
der bereits pixelweisen Floor/Ceiling-Berechnung unproblematisch sein, aber
tatsächliche FPS im Browser bitte gegenprüfen.

## Gänge strukturell verbreitert (Zufallslauf-Modus)

Recherche zuerst (Original-Doom): Spieler dort 32 Einheiten breit, Türen min.
64 Einheiten (2:1), normale/"enge" Gänge min. 128 Einheiten (4:1). Eigener
Stand vorher: Spielerradius `0.22` (Durchmesser `0.44`), Gänge exakt 1.0
Welteinheit breit über den klassischen Recursive-Backtracker (`carveMaze`,
ungerades Raster, Zelle+Wand je 1 Zelle) → Verhältnis nur ~2,3:1, also auf
Doom-Türschwellen-Niveau, aber für JEDEN Gang statt nur an Engstellen. Das war
die Ursache für das beengte Gefühl.

Fix: `carveMaze(size, blockedIdx, cw)` verallgemeinert — jede logische Zelle
belegt jetzt ein `cw×cw`-Block physischer Gitterzellen (Korridorbreite), die
Wand dazwischen bleibt immer exakt 1 Zelle dünn (`cw=1` = exaktes altes
Verhalten, per Node-Sim gegengeprüft: identisches Ergebnis). Neue Konstante
`CORR_W=2` (in `generateProceduralLevel`/`generateStairFloor` verwendet) ergibt
Gangbreite 2.0 Welteinheiten bei unverändertem Spielerdurchmesser → Verhältnis
~4,5:1, jetzt über Doom-Normalgang-Niveau. Wandtiefe hat keinen sichtbaren
Effekt (Raycasting rendert nur die erste getroffene Wandzelle als flache
Ebene, unabhängig davon wie "tief" die Wand dahinter ist) — rein kosmetisch
irrelevant, nur die physische Kartengröße wächst mit.

Maze-Komplexität (Anzahl logischer Zellen `n`, also Verzweigungen/Weglänge pro
Tiefe) bewusst NICHT verändert — nur die physische Rastergröße wächst mit der
neuen Schrittweite (`size = n*(CORR_W+1)+2` statt vorher `n*2+2`), damit sich
an Schwierigkeit/Kartengröße pro Tiefe nichts verschiebt, nur an der
Gangbreite. `MAXD=17` (Fog-Sichtweite) begrenzt Raycasts ohnehin auf 17
Einheiten, die größere Kartenfläche (physische Größe jetzt bis 89 statt 61)
ist für den Raycaster also unproblematisch.

**Gefundene und gefixte Regression (Node-Simulation, 2000+ Läufe je Variante):**
Die Vorraum-Reservierung (`planAntechamber`) sperrte bisher Innenraum + kompletten
Pufferring vorab, bevor `carveMaze` drumherum wächst. Mit blockbasierter
2-breiter Carve-Logik ließ die volle Ring-Reservierung dem Backtracker am
Kartenrand kaum noch Platz zum Umrouten — Vorraum-Erfolgsquote brach von ~75%
auf unter 9% ein (Rest fiel auf die alte Einzeltür zurück). Fix: bei `cw>1`
wird nur noch der Innenraum vorab reserviert, der Ring bleibt dem bestehenden
Sicherheitsnetz (Erreichbarkeits-Check nach dem Carven, fällt bei Problemen
automatisch zurück) überlassen — bringt die Quote auf ~61%. Bei `cw=1`
bleibt das alte Verhalten (Ring+Innenraum reserviert, ~75%) unverändert, per
Sim bestätigt identisch zum Ausgangswert.

**Verifiziert per Node-Simulation** (Kern-Funktionen aus `<script>` extrahiert,
`test/` im ZIP): 0 abgeschnittene/unerreichbare Karten in 2000 Läufen je
`CORR_W=1` und `CORR_W=2` über zufällige Tiefen 1–30 und alle 4 Größen-Tiers.
Kein Browsertest — nur Struktur-/Erreichbarkeits-Verifikation.

**Offen/nicht angefasst:** Fog-Sichtweite (`MAXD=17`) und Fog-of-War-
Aufdeckradius sind unverändert — bei breiteren Gängen deckt die gleiche
Sichtweite jetzt weniger logische Zellen Richtung Tiefe auf (weniger "wie
viele Räume sehe ich voraus", dafür breiter pro Raum). Falls sich das auch
zu eng/weit anfühlt, wäre das ein separater Tuning-Pass.

## HUD-Redesign: Paneele statt durchgehendem Balken

Vorher war `#bar` ein einziger Balken über die volle Breite mit hartem
cyanfarbenem `border-top` + Glow-Schatten — genau der "Streifen unten", der
als störend gemeldet wurde. Jetzt:

- `#bar` selbst ist nur noch ein unsichtbarer Grid-Container (kein Hintergrund,
  kein Rand). Jede `.cell` (Integrität, Waffe/Munition, Splitter, Gegner) ist
  ein eigenes freistehendes Panel mit angeschnittenen Ecken — der im Spiel
  schon etablierte Look von `button.primary`/`button.chip` (gleiches
  `clip-path`-Prinzip), nicht neu erfunden. Zwischen den Panels ist jetzt
  echte Lücke statt durchgehender Fläche.
- Das Gesicht (`#face`) sitzt jetzt in einer eigenen `.face-frame`-Medaillon-
  Fassung: runder Rahmen mit Verlauf, dünnem Cyan-Rand und Glow, schwebt
  minimal höher als die eckigen Panele als optischer Blickfang.
- Reine CSS-/Markup-Änderung, keine JS-Logik angefasst — `.cell`-Inhalte
  (`#hp`, `#ammo`, `#shards`, `#foes`, `#hpfill`, `#heatfill` usw.) unverändert
  referenziert.

Kein Browsertest — nur Struktur-/Klammer-Check der CSS-Änderung. Feinjustierung
(Panel-Abstände, Medaillon-Größe, Glow-Stärke) im Spiel bitte gegenprüfen.

## Was in einer früheren Session fertiggestellt wurde

**Begehbarer Vorraum mit Säulen vor dem Ausgang (Zufallslauf-Modus).**

Vorher gab es am Ausgang nur eine einzelne Zellenbreite Tür in der Randwand —
kein Raum zum Bewegen, kein Versteckspiel vor dem Boss. Jetzt:

- **`carveMaze(size, blockedIdx)`** akzeptiert jetzt optional ein Set reservierter
  Zellen, die der Recursive-Backtracker nie betritt (Wert `3` im Grid). Damit kann
  die Fläche eines Vorraums *vor* dem eigentlichen Carven gesperrt werden — die
  Maze wächst organisch drumherum, statt hinterher Löcher in eine fertige Karte
  zu stanzen (das hätte immer riskiert, einen für den Rest der Karte nötigen
  Gang zu kappen).
- **`planAntechamber(size, doorCand)`**: plant Lage/Größe des Vorraums an der
  vorher gefundenen Ausgangs-Randzelle. Raumgröße richtet sich nach der
  Kartengröße (3×3 bei kleinen Sektoren bis 9×9 bei großen), schrumpft
  automatisch, wenn am Kartenrand nicht genug Platz ist, und gibt `null`
  zurück (→ Fallback auf alte Einzelzellen-Tür), wenn selbst 3×3 nicht passt.
- **`finishAntechamber(g, size, plan)`**: trägt den Innenraum als begehbaren
  Flur ein, setzt genau einen Zugang (Ring bleibt sonst Wand), platziert
  Säulen im Innern (Rand bleibt frei, damit man an Tür/Zugang immer
  vorbeikommt) — nur ab Raumgröße 5×5 aufwärts, 3×3 bleibt Säulen-frei.
- **Zwei-Durchlauf-Generierung**: Durchlauf 1 baut eine Test-Maze nur, um die
  beste Ausgangsposition zu finden; Durchlauf 2 baut die echte Maze mit der
  Vorraum-Fläche als Sperrzone. Nach dem Zusammenbau läuft ein
  Sicherheitsnetz-Check (volle Erreichbarkeits-Prüfung); im (praktisch nie
  auftretenden) Fehlerfall fällt der Code komplett auf die alte,
  bewährte Einzelzellen-Tür zurück.
- **Boss-Platzierung**: Wenn ein Vorraum gebaut wurde, steht der Kern-Wächter
  jetzt im Vorraum selbst (möglichst zentral, weicht Säulen/Eingang/Türschwelle
  aus) — bewacht also den ganzen Raum, nicht nur eine einzelne Zelle davor.
  Ohne Vorraum (Fallback) bleibt die bisherige Logik (Boss nahe am Ausgang).
- **Item-/Gegner-Platzierung** schließt Zugangszelle und Türschwelle des
  Vorraums jetzt aus, damit dort nichts Zufälliges landet.

### Testergebnis (Node-Simulation, kein Browsertest)

2100 Durchläufe über alle Tiefen 1–30, alle vier Größenstufen:
- **0 abgeschnittene Kartenteile** — die Karte ist in jedem Lauf aus einem Stück.
- **1843 von 2100 Läufen** bekommen einen echten Vorraum (Rest fällt sauber auf
  die alte Einzelzellen-Tür zurück, meist bei sehr kleinen Sektoren ohne Platz).
- **1659 der 1843 Vorräume** haben Säulen (ab Raumgröße 5×5).
- Raumgrößen-Verteilung: 3×3 in 184 Fällen, 5×5 in 87, 7×7 in 388, 9×9 in 1184.
- Boss wird in jedem Fall platziert, wo `depth % 3 === 0` gilt (700/700).

## Bildschirm füllt jetzt immer randlos (kein festes 16:10 mehr)

Vorher war die Bühne (`#stage`) fest auf 16:10 (`aspect-ratio:16/10`, Breite
`min(100vw,160vh)`) begrenzt — auf Bildschirmen, die davon abweichen (z. B.
Ultrawide-Monitore), blieben schwarze Seitenstreifen übrig.

Jetzt füllt `#stage` immer `100vw` × `100dvh` (voller Bildschirm). Das Canvas
(`#view`) wird per `object-fit:cover` reinskaliert: es rendert weiterhin intern
in der festen Auflösung 960×600 (16:10, unverändert im JS — `const W=960,
H=600`), wird aber verzerrungsfrei so weit vergrößert, dass es die ganze
Bühne ausfüllt. Bei abweichendem Seitenverhältnis wird dabei minimal oben/
unten bzw. links/rechts beschnitten (kein Verzerren, keine schwarzen Balken).
HUD-Elemente (`cqw`-Einheiten, `container-type:inline-size` auf `#stage`)
skalieren automatisch mit der jetzt immer vollen Bildschirmbreite mit.

Kein Browsertest — nur Syntax-/Struktur-Check der CSS-Änderung. Sollte auf
Bildschirmen mit sehr extremem Seitenverhältnis (sehr schmal/hoch, z. B.
Hochformat-Handy) mehr als üblich vom oberen/unteren Bildrand abschneiden;
falls das im Test auffällt, ließe sich mit `object-position` nachjustieren,
oder alternativ die Render-Auflösung selbst dynamisch ans Seitenverhältnis
anpassen (größerer Umbau, siehe unten).

## Mehrere Etagen pro Standort (Keller / Erdgeschoss / Stockwerke)

Umgesetzt auf Wunsch: Ab einer bestimmten Tiefe besteht ein Sektor im
Zufallslauf nicht mehr aus nur einer Maze-Ebene, sondern aus mehreren
übereinanderliegenden Etagen, die man per Treppe verbindet — man startet
z. B. im Keller und klettert Stück für Stück hoch bis zum Sektor mit dem
eigentlichen Ausgang.

**Wichtig zu verstehen:** Das ist **kein echtes 3D mit Blick durch ein Loch
nach oben** — der Raycaster ist klassisch (eine Grid-Ebene, ein Boden, eine
Decke pro Sektor, wie altes Doom). Eine "Etage" ist technisch eine eigene,
komplett neu generierte Karte; eine Treppe ist ein Spezial-Feld, das beim
Erreichen per Fade-Transition auf die nächsthöhere Karte umschaltet — exakt
das gleiche Prinzip, das der Zufallslauf schon für den Wechsel zwischen
Tiefen benutzt hat ("Weiter — Tiefe X"), nur jetzt zusätzlich *innerhalb*
einer Tiefe.

### Wie es funktioniert

- **`floorsForDepth(depth)`**: legt fest, wie viele Etagen ein Standort bei
  dieser Tiefe hat — 1 bei Tiefe 1–3 (unverändertes altes Verhalten), 2 bei
  4–9, 3 bei 10–17, ab 18 dann 4. Frühe Tiefen bleiben also exakt wie vorher.
- **`floorName(i)`**: Beschriftung — `Keller`, `Erdgeschoss`, `1. Stock`,
  `2. Stock`, usw.
- **`generateStairFloor(depth, floorIdx, totalFloors)`**: erzeugt eine
  "Zwischen-Etage" — normale Maze mit Gegnern/Items (etwas schwächer besetzt
  als eine volle Tiefe, damit sich die Schwierigkeit über mehrere Etagen
  nicht unnötig aufschaukelt), aber **kein Boss, kein Schloss, kein echter
  Ausgang**. Stattdessen eine Treppe hoch (`'U'`) — nach exakt demselben
  Prinzip wie der bisherige einfache Ausgang platziert: `findDoorCell()` +
  `sealExtraApproaches()` sorgen für eine Tür am Kartenrand mit garantiert
  genau einem Zugang.
- **`generateProceduralSite(depth)`**: baut alle Etagen eines Standorts.
  Die **oberste** Etage ist unverändert `generateProceduralLevel(depth)` —
  also inklusive Vorraum-mit-Säulen und Boss, exakt der bereits getestete
  Code von vorhin, hier nicht angefasst. Nur die Etagen darunter sind neu.
- **Treppen-Rendering**: Die Treppe ist — wie der Ausgang — eine Tür in der
  Wand, kein begehbares Bodenfeld (neuer Wandwert `5` neben `# R H X`),
  eigene pulsierende Portal-Textur (`texStairs`, grün `#0ECB81` statt cyan/
  rot), gleicher Trigger-Mechanismus wie beim Ausgang (Annäherung auf ~1
  Feld genügt, kein tatsächliches Hineinlaufen nötig — die Zelle bleibt
  physisch massiv).
- **`checkStairs()`/`climbStairs()`**: laufen wie `checkExit()` in der
  Update-Schleife mit. Beim Auslösen werden Kills/Splitter/Zeit der
  aktuellen Etage in die Lauf-Statistik übernommen (wie beim normalen
  Tiefenwechsel), dann `startLevel()` auf die nächste Etage — Waffen/HP/
  Munition bleiben erhalten. Absicherung gegen Mehrfachauslösung während der
  laufenden Fade-Transition über die schon vorhandene `fadeBusy`-Sperre.
- **Minimap**: Die Treppe wird — sobald durch den Nebel des Krieges entdeckt
  — grün markiert, genau wie der (rot markierte) gesperrte Ausgang.
- **Bugfix nebenbei**: `exitCell`/`stairsCell` wurden vorher nie
  zurückgesetzt, wenn eine neue Karte kein `X`/`U` enthielt — dadurch hätte
  auf einer Etage ohne Ausgang der `checkExit()`-Check versehentlich mit der
  Zellposition der *vorherigen* Karte weitergerechnet. Jetzt werden beide zu
  Beginn jeder `parseLevel()` explizit genullt.

### Testergebnis (Node-Simulation, kein Browsertest)

3000 komplette Standorte (Tiefe 1–30, alle Größenstufen, bis zu 4 Etagen
pro Standort) durchsimuliert:
- **0 abgeschnittene Kartenteile** auf irgendeiner Etage.
- **Jede Nicht-oberste Etage** hat exakt eine Treppe, keinen Ausgang, kein
  Schloss.
- **Jede oberste Etage** hat exakt einen Ausgang, Boss ist immer da, wo
  `Tiefe % 3 === 0` gilt — unverändert zur bisherigen Logik.
- Generierung eines kompletten Standorts dauert im Schnitt ~4ms — unkritisch,
  da nur einmal pro Standort (nicht pro Frame) nötig.

### Bekannte offene Punkte zu diesem Feature

- **Kein Browsertest** — nur Grid-Ebene simuliert. Ob sich das Treppen-Portal
  in der 3D-Ansicht optisch klar von der normalen Ausgangstür unterscheidet
  und ob die Balance (Gegnerdichte pro Zwischen-Etage) sich richtig anfühlt,
  ist ungeprüft.
- Aktuell geht es nur "hoch" (Keller → Erdgeschoss → 1. Stock → …), keine
  Abzweigungen oder "runter"-Treppen. Wäre als nächster Schritt möglich,
  ist aber bewusst nicht eingebaut, um die erste Version einfach zu halten.
- Die Werte in `floorsForDepth()` (ab welcher Tiefe wie viele Etagen) und die
  Gegnerdichte in `generateStairFloor()` sind erste Schätzwerte, keine im
  Spiel getesteten Balance-Werte.

## Nachbesserung: Etagen nur in der Anlage + blinkende Server-Racks

Auf Rückmeldung angepasst: "Etagen" (Keller/Erdgeschoss/Stock) unter offenem
Himmel ergeben keinen Sinn — man kann in der Wüste/Schlucht/im Dschungel
nicht "ein Gebäude hochklettern". Deshalb jetzt:

- **`floorsForDepth(depth)`** prüft zuerst das Biom dieser Tiefe
  (`biomeForDepth(depth)`). Ist es ein Außenbiom (`BIOMES[...].outdoor`,
  also Schlucht/Wüste/Dschungel), bleibt der Standort **immer einstöckig**
  — unabhängig von der Tiefenzahl. Nur die Anlage (`facility`, Innenbereich,
  Server-Räume) bekommt die Etagen-Staffelung wie bisher (1 → 2 → 3 → 4 ab
  Tiefe 4/10/18).
- **Blinkende Server-Racks** (nur im Anlage-Biom, also passend zum
  "Serverraum"-Thema): Die Rack-Wand (`texRack`, Wandtyp `R`) hat jetzt 4
  vorgerenderte Frames mit unterschiedlichen LED-Zuständen/-Farben
  (`RACK_FRAMES`, erzeugt über `makeRackFrame(seed)` — identischer
  Panel-Hintergrund, aber eigene unabhängig gewürfelte LEDs pro Frame).
  In `renderWalls()` wird für Rack-Zellen im Anlage-Biom der Frame aus
  Zeit **plus** einem Hash der Zellposition gewählt — dadurch blinken
  nicht alle Racks im Gleichtakt, sondern phasenversetzt, wie in einem
  echten Serverraum.

Kein Browsertest — nur die Frame-Auswahl-Formel numerisch geprüft (bleibt
immer im gültigen Bereich 0–3, keine NaN, unterschiedliche Zellen bekommen
unterschiedliche Phasen). Ob das Blinktempo (Faktor `2.2`) und die
LED-Dichte gut aussehen, lässt sich nur im Browser beurteilen — bei Bedarf
in `makeRackFrame()` (Wahrscheinlichkeit `rl()<.62` für "an") bzw. in der
Frame-Formel in `renderWalls()` nachjustieren.

### Noch offen (auf Rückfrage, nicht umgesetzt)

Zusätzlich gewünscht: Displays/Schilder im Level, die die **Etagennummer**
anzeigen (nicht nur der HUD-Text oben, sondern ein sichtbares Objekt in der
3D-Welt). Das ist ein separates, etwas größeres Stück Arbeit — braucht eine
gepixelte Ziffern-/Segmentanzeige-Schrift, die es im Spiel noch nicht gibt.
Auf Rückfrage zurückgestellt, um erst zu klären, wie aufwändig das werden
soll (z. B. einfache 7-Segment-Optik neben dem Spawnpunkt vs. mehrere
Anzeigen verteilt in der Karte).

## Nachbesserung 2: Mehrere Etagen-Anzeigeschilder verteilt in der Karte

Auf Rückfrage gewünscht: nicht nur ein Schild am Spawn, sondern mehrere
kleine Displays über die Karte verteilt, die die aktuelle Etage anzeigen.

- **Anzeige im Fahrstuhl-Schema**: Keller = `-1`, Erdgeschoss = `0`,
  1. Stock = `1`, 2. Stock = `2` usw. (`f.signDigit = f.floorIdx - 1`).
- **`SEG_DIGITS`/`drawSegChar()`/`makeFloorSignTex()`**: kleine gepixelte
  7-Segment-Ziffernschrift (wie eine LED-Anzeige), unterstützt `0`–`9` und
  `-`. `SIGN_TEX` hält fertige Texturen für die Werte `-1` bis `3` vor.
- **`scatterFloorSigns(mapRows, count)`**: rein kosmetische
  Nachbearbeitung einer fertigen Karte — sucht normale, bereits massive
  Wandzellen (`#`/`R`/`H`), die an mindestens eine Flurzelle angrenzen
  (also sichtbar sind), und wandelt bis zu `count` davon (mit Mindestabstand
  zueinander) in Anzeige-Schilder (`'D'`, neuer Wandwert `6`) um. Da dabei
  nur bereits solide Wandzellen umbenannt werden (keine Flurzelle wird zur
  Wand), kann das die Erreichbarkeit der Karte nie beeinflussen.
- Läuft in `generateProceduralSite()` über **jede** Etage eines Standorts
  (Zwischen-Etagen UND die oberste Etage mit Boss/Ausgang) — aber **nur**,
  wenn der Standort wirklich mehrstöckig ist (`n>1`). Ein einstöckiger
  Sektor (jedes Außenbiom, oder Tiefe 1–3) bekommt keine Fahrstuhl-Schilder,
  das wäre dort unpassend.
- Minimap-Farbtabellen (`buildMini()`/`drawFogMini()`) um die Wandwerte `5`
  (Treppe) und `6` (Schild) ergänzt — vorher hätten diese beiden Werte dort
  ein `undefined`-`fillStyle` erzeugt (kein Absturz, aber ein stiller
  Farb-Bug). Schilder bekommen bewusst dieselbe unauffällige Minimap-Farbe
  wie normale Wände (kein Landmark, rein dekorativ); die Treppe bleibt grün
  hervorgehoben.

### Testergebnis (Node-Simulation, kein Browsertest)

900 Standorte simuliert: **0 Fehler**. Jede Karte bleibt nach dem Verteilen
der Schilder vollständig verbunden, jeder Mehr-Etagen-Standort bekommt 3–4
Schilder pro Etage, kein einstöckiger Standort bekommt versehentlich welche,
Spawn/Ausgang/Treppen-Zahl bleiben überall korrekt.

Kein Browsertest — die eigentliche Canvas-Zeichnung der Ziffern
(`makeFloorSignTex`) läuft nur im Browser (nutzt `document.createElement
('canvas')`), konnte hier nur durch Nachrechnen der Segment-Koordinaten
geprüft werden (alle Werte positiv, alles innerhalb des 64×64-Textur-
Bereichs). Ob die Ziffern wirklich lesbar/gut positioniert aussehen, bitte
im Spiel kontrollieren.

## Bekannte offene Punkte / mögliche nächste Schritte

- **Noch kein Browser-Spieltest** — nur Node-Simulation auf Grid-Ebene. Ob sich
  der Vorraum im 3D-Raycaster (Sichtlinien, Kollisionen an Säulen, Beleuchtung)
  gut anfühlt, ist ungeprüft.
- Lineare Story-Kampagne auf den Biome-Assets aufbauen (bisher nur im
  Zufallslauf genutzt).
- Balancing der Zufallslauf-Größen/Gegnerabstände weiterhin nur per Simulation
  getestet, kein echter Spieltest.
- Aus früheren Sessions offen: Muzzle-Flash am Lauf selbst, weiterer Gegnertyp
  (Sniper/Fernkämpfer), Secret Rooms, erweitertes lokales Stats-Tracking vor
  Supabase-Anbindung, Schwierigkeitsgrad-Auswahl.

## Story Mode Phase 12 — Final QA (statisch, ohne Testläufe)
Bewusst **keine Testsuiten und keine Simulation** (Kontextgrenze); nur Code-Audit per `node --check` und gezielter Quelltext-Analyse.
- **Syntax:** Inline-Script von `game.html` besteht `node --check`.
- **Sektoren/Unlocks:** 30 Sektoren werden in einer Schleife (Sektor 1–30, `LEVELS[0..29]`) registriert, je mit `sector:<n>`-Unlock; Sektor 1 immer frei, sonst Vorgänger gesäubert.
- **Flags:** alle in `need`/`skipWhen`/`has` verwendeten Flags haben einen Setzer (die scheinbar fehlenden `*.ready`, `a5.wd.3`, `a6.co.5` werden dynamisch als `'aN.'+pre+'.'+i` gesetzt). `once:`-Schlüssel werden als Flags `once.<key>` gespeichert.
- **Logs/Archiv/Echos:** 111 Archiv-Einträge (`EN(...)`), keine doppelten IDs; 7 Realitäten + Reality-Echo-Zonen konsistent; `reality:'ID'` in Zeile 8357 ist nur ein Kommentar.
- **Finale/Epilog/Ascension:** Sektor 30 → `Story.finale()` → `Epilogue.start`; `Story.complete()` speichert VOR dem Finale (`Save.flush`), setzt `story.complete`, `ending`, Unlock `ascension`, Logs `a6.ep1/ep2`; `Ascension.unlocked()` berücksichtigt `storyDone()`. Wiederholung (`replay`) vergibt nichts doppelt.
- **Gefundener Fehler / behoben:** `sanitizeStory` kappte Flags bei **400**. Ein vollständiger Durchlauf (≈59 Flag-Aktionen + 63 `once`-Schlüssel + dynamische Zonen-/Fenster-/Sequenz-Flags) kommt nahe an diese Grenze; überzählige Flags wären beim Laden still verworfen worden (zuletzt gesetzte, also Finale-Flags, zuerst). Limit auf **1200** angehoben (Manipulationsschutz bleibt).
- `sw.js` Cache v28.
**Nicht geprüft (bitte live testen):** kompletter Durchlauf Sektor 1→30 im Browser, Reload/Fortsetzen mitten in der Kampagne, Archiv-Anzeige (Neu-Zähler), Epilog-Skip, Ascension-Start nach Abschluss, Handy-Layout. `test/t_story.js` ist weiterhin nicht an Phase 3–10 angepasst (Zahl der Sektoren/Missionen/Flags) — bei Bedarf separat aktualisieren.

## Story Mode — Sprachdurchgang (nach Phase 12, ohne Tests)
Story-Dialoge, Archiv-Logs, Hinweise und Terminal-Texte waren überwiegend Englisch (Beschriftungen schon Deutsch). Jetzt auf **Deutsch** (176 Ersetzungen, nur Textinhalte, keine Logik, `node --check` OK).
- **Übersetzt:** alle Funk-/Wächter-/Kern-Dialoge, Archiv-Logs, Hinweise, System-Einblendungen (z. B. ALLE SIEBEN FENSTER AKTIV, MUSTER GEFUNDEN), Epilog-Terminal (BREACH EINGEDÄMMT … QUELLE: DU, `> zuhören`, `> ICH WEISS.`).
- **Leitmotive einheitlich:** „PROZESS WURDE NICHT HIER ERZEUGT.“ · „DIE VERBINDUNG WAR BEREITS OFFEN.“ · „NIEMAND.“ · „Wer hat dich geschickt?“ (Signalfragmente: WER / HAT / DICH / GESCHICKT?).
- **Bewusst Englisch geblieben:** Eigennamen (NEXUS, WARDEN-01/02, AXIOM, RELAY, THE SHARD), Sektor- und Aktnamen (THE BANK, THE SEVEN WINDOWS …), Realitätsnamen, Statuswörter ACTIVE/UNSTABLE/ONLINE sowie reine Maschinen-Zeilen (RIGS ONLINE, MINING: NORMAL).
- Die Fragment-Zone 4 zeigt jetzt „GESCHICKT?“ statt „?“. Länge der Texte im Handy-Layout bitte kurz live prüfen (deutsche Sätze sind etwas länger).
`sw.js` Cache v29.

## Titelbildschirm aufgeräumt (nach Story Phase 12, ohne Tests)
- **Entfernt:** Badge „Testspiel — Wächter-Programm aktiv“, Text-Überschrift „NEXUS: BREACH“, Fußnote „Testspiel …“, „(Beta)“ am Zufallslauf. Das **Logo** ist deutlich größer (`.title-logo`, bis 46cqw / 680px).
- **Beschreibung** („Worum geht es?“) steht jetzt im Info-Panel (i) oberhalb der Steuerung.
- **„Sektor 1 starten“ → „Story“** (`Story.menu(back)`): Solange nur Sektor 1 freigeschaltet ist, startet der Klick direkt Sektor 1. Sobald mehr frei ist, öffnet sich ein Sektor-Fenster: „Fortsetzen — Sektor n“, darunter freigeschaltete Sektoren nach Akt gruppiert (✓ = gesäubert), noch nicht erreichte Sektoren als „gesperrt“ ohne Namen (kein Spoiler), Akte ganz ohne freien Sektor werden nur als Zahl zusammengefasst.
- **Entfallen:** eigener Titel-Button „Story fortsetzen — Sektor n“ (steckt im Story-Fenster) und die 30 Direktwahl-Chips im Info-Panel. Dadurch ist freies Spielen **gesperrter** Sektoren nicht mehr möglich.
`sw.js` Cache v30. Nur Syntax-Check.

## Story-Fenster: NEXUS ARCHIVE und Epilog (nach Titel-Umbau, ohne Tests)
- **NEXUS ARCHIVE** („n neu“) und **Epilog ansehen** liegen jetzt im Story-Fenster (`Story.menu`), nicht mehr auf dem Titel (`Story.titleBtn()` liefert leer). „Zurück“ aus dem Archiv führt ins Story-Fenster.
- Der Klick auf „Story“ startet Sektor 1 nur dann direkt, wenn nur Sektor 1 offen ist, das Archiv noch leer/gesperrt ist und die Story nicht abgeschlossen wurde; sonst öffnet sich das Fenster (damit Archiv/Epilog erreichbar bleiben). Das einfache „Archiv“ (Meta-Progression) bleibt auf dem Titel.
`sw.js` Cache v31. Nur Syntax-Check.


## Endlos-Einsatz (ehem. „Zufallslauf“): Räume, eigene Seite, Seed, Schwierigkeit

- **Umbenennung:** „Zufallslauf“ heißt jetzt **Endlos-Einsatz** (Titelmenü, Info-Panel, Meta-/Ascension-Texte).
- **Wände:** `makeWallZones(size)` ersetzt das Würfeln pro Wandzelle. Karte in Voronoi-Zonen (~4 Zellen), eine Zone = ein Wandtyp; Rack-Zonen wechseln Rack/Panel im festen Takt, Tresor nur als seltene ganze Zone (nie zwei Nachbarn).
- **Räume:** `carveMaze` räumt am Ende zufällige 2x2–3x3-Zellblöcke (ab n≥12 bis 4x4) frei (`ENDLESS_ROOMS`). Äußerer Zellenring und reservierte Zellen (Vorraum) bleiben unberührt, Eingänge = vorhandene Gänge, große Räume mit Säulen. Kurztest: 280 Level (Tiefe 1–20), alle vollständig erreichbar, Ausgang immer vorhanden.
- **Eigene Seite:** `Endless.menu(back)` (Titel → Endlos-Einsatz): Schwierigkeit, Seed-Feld (+ „Würfeln“), Höchste Tiefe, Start. Auswahl wird in `localStorage['nb_endless']` gemerkt.
- **Seed:** gleicher Seed + gleiche Tiefe = gleiche Karte. `Math.random` wird nur während `generateProceduralSite` durch `seedRng(seed|tiefe)` ersetzt und danach wiederhergestellt. Leerer Seed → zufälliger 6-Zeichen-Seed. Seed/Schwierigkeit erscheinen im Sektor-Intro.
- **Schwierigkeit:** Leicht (Gegner −20 % Leben, −25 % Schaden) · Normal · Schwer (+40 % Leben, +30 % Schaden, **Minimap dauerhaft aus**, M-Taste wirkungslos). Boss `K` bekommt keinen HP-Faktor. Hooks: `hurtPlayer`, `Ascension.onEnemy`, `drawMini`, KeyM. Ascension setzt `Endless.on=false`.
- **Getestet (Node-Harness, KEIN echter Browser):** Erreichbarkeit, Seed-Determinismus, Hooks, 0 Fehler/Warnungen. **Bitte live prüfen:** Menüseite auf Handy/Desktop, Raumgrößen/Optik, Balance der Schwierigkeit.
- **Idee für später:** Schwierigkeit im Archiv/Bestzeiten getrennt führen, weitere Stufen (z. B. „Albtraum“), Raum-Typen (Lager, Serverhalle) mit eigener Deko.


## Archiv in den Endlos-Einsatz verschoben + Speicherpunkt

- **Archiv (Meta):** Der Titel-Button „Archiv“ ist entfernt. Das Archiv (Credits, Upgrades, Waffen/Lizenzen, Ziele, Rekorde je Tiefe, Kosmetik, Missionen) liegt jetzt auf der Seite **Endlos-Einsatz** (Button „Archiv“, Credits werden dort angezeigt). Begründung: Start-Lizenzen, Startzellen, Kern-Vorrat, Sektor-/Lauf-Prämien und Bestzeiten je Tiefe gelten nur für Endlos-Einsätze. Das „NEXUS ARCHIVE“ der Story ist davon unabhängig und bleibt bei der Story. Die „Archiv“-Buttons auf Tod-/Lauf-Ende-Overlays bleiben.
- **Speicherpunkt (`Checkpoint`, localStorage `nb_endless_run`):** wird automatisch zu Beginn jedes Sektors (erste Etage einer Tiefe, `lvl.floorIdx===0`) geschrieben — in `startLevel` nach `snap=`. Inhalt: Seed, Schwierigkeit, Tiefe, Spieler (HP/Schild/Panzerung/Energie/Munition/Waffen/Magazine/Waffenlevel), Mods (Inventar + Einbauten + Pity), Perks (`Perks.load`), Kerne/Schlüssel/Munitionsstand (`Loot`), Lauf-Zähler, Score. **Fortsetzen** (Endlos-Einsatz-Seite → „Fortsetzen — Tiefe N“) baut den Zustand nach `newRun()` wieder auf und startet den Sektor per Seed neu (gleiche Karte, Gegner/Funde frisch). Zählt nicht als neuer Lauf (`stats.runs` wird zurückgesetzt).
- **Pause:** neuer Button „Speichern & zum Titel“ (Speicherpunkt liegt schon vom Sektorbeginn), Hinweistext im Pausenmenü.
- **Gelöscht wird** nur bei „Lauf beenden“ (`finishRun`). Tod bleibt wie bisher: „Sektor neu starten“. Neuer Einsatz bei vorhandenem Speicherstand fragt zweistufig („Speicherstand überschreiben?“).
- **Bewusste Grenze:** Gespeichert wird der Sektorbeginn, nicht die exakte Position/Gegner mitten im Sektor (dafür müssten alle Gegner-KI-Zustände, Pickups, Nebel, Gefahren, Geheimräume usw. serialisiert werden). Ascension hat keinen Speicherpunkt (`Endless.on=false`).
- **Tests:** `test/t_soak.js` startet jetzt per `B.startEndless()` (Titel-Button öffnet die Menüseite). Eigener Kurztest (Speichern → neue Sitzung → Fortsetzen: Tiefe, Seed, Schwierigkeit, Waffen, Mods, Kerne, Munition, HP stimmen; 0 Fehler). Soak 6000 Frames: 0 Fehler. `t_story.js` (18) und `t_storyui.js` (9) melden Fehler — identisch in der hochgeladenen Originalversion, also schon vorher.

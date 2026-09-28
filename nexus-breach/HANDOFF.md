# NEXUS: BREACH — Handoff

Stand: 28.09.2026 (Overhaul Phase 1–6 abgeschlossen). Teil des MC ORCA Games Portfolios, bewusst NICHT
mit Supabase/Konto/MOGC verbunden.

## OVERHAUL — Fortschritt (20-Phasen-Plan)

| Phase | Status |
|---|---|
| 1 Foundation / Architektur | **fertig** |
| 2 Next-Gen HUD | **fertig** (siehe unten) |
| 3 Advanced Player System | **fertig** (siehe unten) |
| 4 Massive Weapon System | **fertig** (siehe unten) |
| 5 Weapon Modification System | **fertig** (siehe unten) |
| 6 Advanced Enemy AI | **fertig** (siehe unten) |
| 7–20 | offen |

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

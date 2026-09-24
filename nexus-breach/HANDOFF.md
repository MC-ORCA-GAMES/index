# NEXUS: BREACH — Handoff

Stand: 24.09.2026 (Fortsetzung). Teil des MC ORCA Games Portfolios, bewusst NICHT
mit Supabase/Konto/MOGC verbunden.

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

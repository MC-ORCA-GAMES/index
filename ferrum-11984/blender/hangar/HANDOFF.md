# HANGAR – HANDOFF (Übergabe für neue Chats)  ·  FERRUM-11984

Stichwort des Spielers: **"HANGAR TEIL 1" … "HANGAR TEIL 6"**. Es wird NUR der genannte Teil gebaut, danach Check, ZIP neu packen, kurzer Bericht, STOP.
Nie mehrere Teile mischen, nie automatisch weitermachen. Vor jedem Teil: diese Datei + `referenz.png` + `hangar_build.py` (falls vorhanden) lesen.

## 1. Auftrag (Kurzfassung des Original-Briefings)
Wiederaufbau des Hangar-INNENRAUMS aus `referenz.png` (Innenansicht, Seitenschnitt, Draufsicht, 3/4, Klammer offen/geschlossen) als modulares Spiel-Asset.
Der Hangar ist EIN Raum mit offenem Tor zum Weltraum, kein Außenmodell der Station, kein Schiff darin, keine Figuren, kein Text/Logo/UI.
- KEIN schlichter Quader: facettiertes Gewölbe (Wände unten senkrecht, dann abgeschrägt, Mitte fast flach), Wände neigen leicht nach innen, echte Rippen mit Tiefe (Hauptträger, Verstärkung, Paneelanschluss, Kabelkanal), zurückgesetzte Seitenbuchten, Laufstege auf Stützen, Rückwand mit Technik und EINEM Kontrollraum-Fenster, EIN Deckenkran.
- Landeplatz: EIN runder Platz, bündig im Boden (Ring + Markierungen + Plattensegmente), freie Mitte.
- Klammern: genau VIER, flach, klein (max. Höhe = 1/8 Landeplatz-Durchmesser), im Boden versenkt, offen = eingeklappt bündig, geschlossen = hochgeklappt mit gepolsterter Greifspitze. Ein Modul, 4x gedreht verwendet.
- Material: dunkles Gunmetal/Stahl, Boden abgenutzt dunkelgrau mit Gitterlinien, Messing-Gold `#C9A24A` als MATERIAL (Zierleisten, Markierungen), orange Warnstreifen nur am Tor und an Gefahrenstellen. Benutzt, aber aktiv (Kratzer, Öl, Kantenabrieb; nicht dreckig/verlassen).
- Licht: nur schlichte Lampenstreifen. KEIN Neon, KEIN Emissive an Struktur/Gold/Boden. Schutzfeld am Tor nur eine sehr dezente transparente Ebene.
- Spiel: saubere Topologie, ca. ≤ 80.000 Dreiecke gesamt, wenige Materialien (Instancing), Hauptboden eben, Tor frei, Seitenausstattung blockiert die Mitte nicht.
- Verboten: Quader-Architektur, flache Decke/Wände, riesige Klammern/Kran, Schiffe, Figuren, Neon, glühendes Gold, zu viele Warnstreifen, wilde Kabel, Greebling-Überfluss, Text/Logos.

## 2. Bauweise (wie bei den Stationen)
`hangar_build.py` -> `hangar.obj/.mtl` (Blender: File > Import > Wavefront) + `hangar_layout.json` (Prototypen + Instanzen, im Spiel als `HANGAR_LAYOUT` eingebettet, InstancedMeshes pro Material).
Vorlage: `../stationen/trivar_hub/trivar_hub_build.py` (Primitive Box/Zylinder/Kugel + Prototypen). Für Gewölbe, Wandprofil und Rippen kommt ein zusätzliches Primitiv **PRISM** (Querschnittspolygon, entlang einer Achse extrudiert) dazu, plus Boxen mit Drehung um alle Achsen.
Der Hangar wächst über die Teile in EINER Datei (`hangar_build.py`): jeder Teil ergänzt Prototypen und Instanzen; `hangar_params.json` hält alle Maße.
Hierarchie (Gruppen im OBJ/JSON): HANGAR_ROOT > STRUCTURE (FLOOR, WALLS, CEILING, RIBS, GATE_FRAME, BACK_WALL) · LANDING_AREA (LANDING_PAD, DOCKING_CLAMPS) · WALKWAYS · SIDE_BAYS · CRANE · EQUIPMENT · LIGHTING · CONTROL_ROOM.
Einheit: 1 = 1 Spieleinheit (wie `HG_*` im Spiel). Z oben im Skript (wie Stationen), Umrechnung ins Spiel erst in Teil 6.

## 3. Maße (in Teil 1 FESTGESCHRIEBEN, Quelle: `hangar_params.json`, nie hart codieren)
| Parameter | Wert | Bemerkung |
|---|---|---|
| Boden-Innenbreite | 64 | Spiel bisher 76 inkl. Wände |
| Seitenbuchten | je +6 | ergibt ca. 76 außen |
| Tiefe | 112 | 8 Rippen im Abstand 14 (Teil 1 geändert: 112 passt auf das 8er-Raster) |
| Höhe Mitte | 34 | Spiel bisher 36 |
| Halbprofil (x,z) | (32,0) (30,12) (22,24) (10,31) (0,34) | Wand senkrecht bis 12, dann Facetten |
| Landeplatz Ø | 30 | = 0,47 x Breite (Referenz ca. 0,45), mittig |
| Klammer-Höhe max | 3,75 | = Ø/8 (bisher ca. 9 = viel zu groß) |
| Klammer-Position | 4x bei 45/135/225/315°, Radius 9 | INNERHALB des Pads (Teil 1 geändert), Klammern greifen von unten; Aussparung 3,4 (radial) x 5,2 (tangential), 2,0 tief |
| Boden-Raster | Module 8x8, Randstreifen 6x8, Pad-Zone 32x32 | Boden Oberkante z=0, Platten 0,5 dick, Unterbau bis z=-3 |
| Schiff schwebt | Unterkante ca. Boden + 3,0 | bisher 4,5; Klammern (3,75 hoch) greifen von unten, in Teil 2 prüfen, Teil 6 setzt `hangarLift` |
Offen: Größe des kleinsten Schiffs im Verhältnis zum Platz (Spieler hat noch nicht geantwortet). Danach Landeplatz-Ø/Klammerradius nur im Parameterfile ändern und `python3 hangar_build.py` neu laufen lassen.

## 3b. Dateien und Konventionen (seit Teil 1)
- `hangar_params.json` (alle Maße), `hangar_build.py` (Prototypen + Instanzen, `python3 hangar_build.py`), `render_preview.py` (`python3 render_preview.py hangar.obj vorschau_teil1.png`), `hangar.obj/.mtl`, `hangar_layout.json`, `vorschau_teil1.png`. Abhängigkeiten: `numpy shapely mapbox-earcut matplotlib`.
- Materialien fest nummeriert über alle Teile: hull, hull2, floor, floor2, under, brass, hazard, dark, padding, glass, lamp, field, guide. NIE emissive (keine `Ke`-Zeilen). `guide` = dunkles Grün, das Spiel färbt die Leitlichter zur Laufzeit.
- Primitive: BOX, CYL, PRISM (Polygon mit Löchern, extrudiert; im Spiel per `THREE.Shape` + `ExtrudeGeometry` oder eigener Earcut). `hangar_layout.json` enthält außerdem `groups` (Gruppenname -> Instanzindizes), `colliders`, `params`, `profile_half`.
- Gruppen für den Spielanschluss: `GUIDE_LIGHTS` (10 einzelne Instanzen für das Lauflicht), `PAD_RING` (Messing-Ring, später als eine Einheit), `CLAMP_PITS` (4 Aussparungen, Pose `rz` = Winkel), `GATE_THRESHOLD`, `FLOOR_*`, `LANDING_PAD`, `INLAYS`, `FLOOR_UNDERLAY`.
- Neue Teile hängen nur Prototypen/Instanzen/Gruppen an `hangar_build.py` an (`build_protos()` und eine neue `build_hangar_partN()`), `part` im JSON hochzählen. Der Hangar-Ursprung ist die Padmitte auf Bodenhöhe.

## 4. Teile (Berechnung aus den ca. 21 Modultypen des Briefings)
Gesamt ca. 57 Prototypen, ca. 730 Instanzen, ca. 65.000 Dreiecke -> 6 Teile (jeder Teil = eine Session).
| Teil | Inhalt | Proto | Inst | Tris |
|---|---|---|---|---|
| 1 MASSE + BODEN | hangar_params.json, Querschnittsprofil, Bodenmodule (Mitte/Rand/Wartungsklappen), Landeplatz bündig mit Ring/Markierungen, 4 Klammer-Aussparungen, Torschwelle mit Warnstreifen | 6 | 90 | 4k |
| 2 DOCKING_CLAMP | FLOOR_HOUSING, PIVOT_BASE, ARM, GRIP_JOINT, PADDED_GRIP; Zustände OPEN/CLOSED; 4 Positionen; Pivot-Achse und Winkel dokumentiert | 6 | 8 | 3k |
| 3 HUELLE | Wandpaneele (6 Varianten), angeschrägte Wände, Gewölbe-Decke + Deckenpaneele, Rippen (MAIN_BEAM, INNER_SUPPORT, PANEL_CONNECTION, CABLE_CHANNEL), Torrahmen, dezente Schutzfeld-Ebene | 16 | 250 | 25k |
| 4 RUECKWAND + LAUFSTEGE | Rückwandmodule, Kontrollraum mit Fenster, Laufstege links/rechts mit Stützen, Geländer, Treppe, Leiter | 12 | 200 | 15k |
| 5 BUCHTEN + AUSSTATTUNG + KRAN | Seitenbuchten, Kisten, Treibstofftanks, Wartungsgeräte, Werkzeugschränke, Kabelrollen, Kran (Schiene, Träger, Laufkatze, Hubwerk, Haken) | 14 | 150 | 15k |
| 6 LICHT + ENDMONTAGE | Lampenstreifen, Alterung (Farbvariation), Kollisionsboxen, Gesamtcheck, `hangar_layout.json`, Einbau ins Spiel, Vorschau-Renders, Cache-Version | 3 | 40 | 1k |
Schätzwerte; ändern sie sich, hier nachtragen.

## 5. Schnittstelle zum Spiel (gilt für Teil 2 und 6)
Aktuell: `buildHangarScene()` in `game.html` (ca. Zeile 3288) baut den Raum aus Boxen; `hangarAnimExtra()` (ca. Zeile 3615) animiert. Der neue Hangar muss liefern oder Teil 6 passt den Code an:
- `field` (Schutzfeld-Ebene, Opazität ca. 0,09 pulsierend), `ring` (Landeplatz-Ring, Farbe wird grün bei Klammern zu), `beacons` (2 Tor-Lichter), `guide` (10 Leitlichter vom Tor zum Platz), `arms` (2 Deckenarme, Rotation Y), `clamps` = je `{arm, lampM}`.
- Klammer-Ansteuerung bisher: `arm.rotation.z = -0.45 + 1.3*k` (k 0..1, `hgClampK`), Lampe rot -> gelb -> grün bei k>=0,98. Neu: Winkel = offen (flach, 0°) bis geschlossen (ca. 75°) um die tangentiale Pivot-Achse; Teil 2 dokumentiert Achse/Winkel, Teil 6 stellt `hangarAnimExtra()` darauf um.
- Konstanten `HG_W/HG_H/HG_D/HG_FY`, `HANGAR_ORIGIN (0,-600000,0)`, Kameradistanz 30–50 aus Schiffsbox, `hangarLift` (Schiffshöhe) hängen am Raum; in Teil 6 neu abstimmen. Die Kamera kreist im Raum, der Hangar muss von allen Seiten gut aussehen.
- Außerdem Teil 6: `sw.js` Cache hochzählen (aktuell v78), `blender/STRUKTUR.md` und diese Datei aktualisieren.

## 6. Ablauf jeder Session
1. ZIP vom Spieler entpacken, `HANDOFF.md`, `referenz.png`, `hangar_params.json`, `hangar_build.py` lesen.
2. Nur den genannten Teil bauen, Vorschau (Vorne/Seite/Oben/3-4) rendern und mit `referenz.png` vergleichen.
3. Checkliste des Teils (Abschnitt 7) abhaken, Status unten eintragen.
4. ZIP in der Projektstruktur neu packen (ohne `__pycache__`), Bericht in wenigen Sätzen, STOP.

## 7. Abnahme je Teil
- Teil 1: Boden aus Modulen (kein Riesenmesh), Landeplatz bündig, genau 4 Aussparungen, Gitterlinien, Maße im Parameterfile.
- Teil 2: genau 4 Klammern, Höhe <= Ø/8, OPEN bündig, CLOSED mit gepolsterter Spitze, ein Modul 4x gedreht, Pivot dokumentiert.
- Teil 3: Gewölbe sichtbar (kein Quader), Rippen mit Tiefe und gleichem Abstand, Wände geneigt, Tor komplett frei, Schutzfeld dezent.
- Teil 4: Laufstege mit Stützen (nichts schwebt), Zugang über Treppe/Leiter, ein Kontrollraum-Fenster, nicht riesig.
- Teil 5: Buchten zurückgesetzt und gefüllt, Mitte frei, EIN kleiner Kran, Kisten und Tanks vorhanden.
- Teil 6: kein Emissive an Struktur, nur Lampenstreifen, benutzt aber aktiv, Dreiecke <= 80k, im Spiel getestet (Andocken, Klammern, Abflug, Kamera kreisen).

## 8. Status
| Teil | Status |
|---|---|
| 1 | **fertig** (236 Instanzen, 19 Prototypen, ca. 16.800 Dreiecke) |
| 2 | offen |
| 3 | offen |
| 4 | offen |
| 5 | offen |
| 6 | offen |
Teil 1 geliefert: Bodenmodule, bündiger Landeplatz (4 Quadranten, 4 Eckfüller, Messingring), 4 Klammer-Aussparungen mit Messingrahmen, Torschwelle mit Warnstreifen, Wartungsklappen, Messing-Einlagen, 10 Leitlichter, Unterbau und Boden-Kollisionsbox. Nächster Schritt: Teil 2 (DOCKING_CLAMP in die vorhandenen Aussparungen, `clamp_pit`).

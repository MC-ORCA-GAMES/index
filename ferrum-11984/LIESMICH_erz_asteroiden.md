# Erz-Asteroiden (FERRUM-11984)

Handgebaute Erzbrocken mit echter Geometrie (Kristallcluster, Platten, Adern, aufgeworfene Krusten) statt der rein prozeduralen Kugel.
Pro Erzsorte 3 Varianten: **A** rund/kompakt, **B** länglich, **C** gebrochen (Riss + Erz im Spalt). Kein Emissive, kein Glow.

| Phase | Erze              | Status  | GLB (Blender, hohe Detailstufe; per Befehl unten neu erzeugen)     |
|-------|-------------------|---------|-------------------------------------------------------------------|
| 1     | Eisen + Nickel    | fertig  | `blender/erz_asteroiden/ore_asteroids_phase_01_iron_nickel.glb`   |
| 2     | Kupfer + Titan    | fertig  | `blender/erz_asteroiden/ore_asteroids_phase_02_copper_titanium.glb` |
| 3     | Silizium + Eis    | fertig  | `blender/erz_asteroiden/ore_asteroids_phase_03_silicon_ice.glb`   |

## Im Spiel
- `game.html` lädt beim Start `art/asteroids/ore_asteroids.json` (`loadOreModels()`), danach nutzen Asteroidenfelder und Oberflächenvorkommen
  für iron / nickel / copper / titan / silicon / ice automatisch die Modelle (`makeOreRock()`). Bereits gespawnte Brocken werden nachträglich getauscht.
- Erzsorten ohne Modell und fehlende Datei: automatisch weiter die alte prozedurale Kugel. Seit Phase 3 haben alle sechs Erze ein Modell.
- Spielversion = schlanke Detailstufe (ca. 3.600–6.400 Dreiecke pro Brocken, flach schattiert, Vertexfarben). Radius ~1 wie vorher,
  Skalierung/Rotation/Abbau-Schrumpfen laufen unverändert über das Mesh. Das Zielen-Leuchten (emissive) kommt weiterhin vom Spiel.
- Service Worker: Cache `v78`, die JSON ist im Offline-Cache.
- Geometrien werden zwischen gleichen Varianten geteilt (nur ein Satz pro Erz im Speicher).

## Blender / Neu bauen
- GLB in Blender: File → Import → glTF 2.0. Je Asteroid ein Wurzelobjekt (`IRON_A` …) mit `ROCK_BODY`, `MINERAL_CLUSTERS`, `MINERAL_PLATES`,
  `MINERAL_VEINS`, `OPTIONAL_SURFACE_DETAILS` (und `FRACTURE_DETAILS` bei C). Cluster/Platten sind einzelne Objekte (frei verschiebbar).
- Neu erzeugen (ohne Blender, braucht `numpy trimesh scipy matplotlib`), im Ordner `blender/erz_asteroiden/`:
  `python3 erz_build.py 1 . ../../art/asteroids/ore_asteroids.json` (Phase 1), `... 2 ...` (Phase 2), `... 3 ...` (Phase 3).
  Das schreibt die GLB und ergänzt die Spiel-JSON (bestehende Erze bleiben erhalten).
- Stellschrauben: `erz_build.py` (Erzanteil `covA/covB/rank_select`, Anzahl `nf(...)`, Größen) und `oregen.py` (Körperformen, Riss in `body_C`).
- `vorschau_phase_0X.png` zeigt Vorne/Seite/Oben je Variante, `referenz.png` ist das Referenzblatt.

> Hinweis: GLB-, OBJ- und Vorschau-Dateien wurden zum Verkleinern aus dem Projekt entfernt. Mit `erz_build.py` (siehe oben) sind sie jederzeit wieder da.

# HALCYON — verlassene Forschungsstation (FERRUM-11984)

Im Spiel: `buildHalcyonStation()` in `game.html` (direkt vor `spawnFacility`). Sie ersetzt beim Story-Schritt „STATION HALCYON“
den Leuchtfeuer-Platzhalter (Kern + Ring). Die Station ist **tot**: keine Emission, keine Punktlichter, keine Drehung.
Nur ein schwaches, kaltes Orientierungs-Leuchten bleibt als Navigationshilfe (Sprite, kein Licht der Station).

Aufbau: Referenz `blender/stationen/halcyon/referenz.png` -> `halcyon_build.py` (20 Prototypen, 197 Instanzen) ->
`halcyon_layout.json` (im Spiel als `HALCYON_LAYOUT` eingebettet) und `halcyon.obj/.mtl` (Blender: File > Import > Wavefront; Materialien ohne Emission).

- Aenderung am Aufbau: `python3 halcyon_build.py`, danach den Inhalt der JSON in `const HALCYON_LAYOUT=` in game.html ersetzen.
- Vorschau: `python3 render_preview.py halcyon.obj vorschau.png`
- Masstab: Layout-Einheit 10 m, Spielgroesse = Einheit x `HUB_SC` (0,03) -> ca. 1,8 km lang, 1,6 km hoch.
- Achsen: Z = Turm (oben/unten), X = Rumpf quer, Y = Bug (-Y) / Heck (+Y). Referenz nicht streng orthografisch: FRONT = Master fuer X/Z, SEITE legt Y fest, OBEN die Anordnung (Ring, Aussenlabore).
- Schaeden sind eigene Instanzen (Kommentare im Skript, Spalte `col` = DAMAGE): Ringsektor eingestuerzt, ein Aussenlabor abgesackt,
  Plattform gekippt, Antennen/Schuessel abgeknickt, 3 Huellenoeffnungen mit freiliegenden Streben, Truemmer. Eis liegt nur auf (Kappen, Zapfen).
- `buildLayoutStation(PR,INS,unit,mats)` hat jetzt eine optionale eigene Materialliste. `write_obj(path, emit=())` im Hub-Skript schreibt OBJ ohne Emission.
- Die vier Ruinen (Weltraum-Varianten) folgen als naechstes; die Planeten-Bauwerke der Vorlage kommen spaeter als eigenes HTML-Modul.

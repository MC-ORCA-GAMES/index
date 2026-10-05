# Die vier verlassenen Anlagen (Weltraum-Ruinen) — FERRUM-11984

Im Spiel: `buildRuinN()` in `game.html` (direkt vor `spawnFacility`). Sie ersetzt den alten Platzhalter (Ikosaeder + Arm + flackerndes Licht)
bei jeder untersuchbaren Ruine (System mit Anlage, aber ohne aktive Station). Art und Schadensvariante sind je System fest (Systemseed),
die Schieflage auch (im Weltraum gibt es kein Oben/Unten). Alles ist **tot**: keine Emission, keine Lichter, keine Drehung. HALCYON ist unveraendert.

| # | Anlage | Funktion | Groesse | Silhouette |
|---|--------|----------|---------|------------|
| 0 | Relais- & Forschungsposten | Wohn-/Labormodule, Forschungskuppel, Sensormast, Antennen, Datenspeicher, Solarausleger | ~180 m | kompakt, vertikal |
| 1 | Raffinerie-Plattform | Prozesstuerme, Tankgruppen, Kugeldruckbehaelter, Kuehlmodule, Rohrnetz, Wartungsplattformen | ~290 m | dicht, turmlastig |
| 2 | Bergbau-/Frachtverladestation | Vierbein-Gittermast, Verladearm, haengende Container, Erzsilos, Foerderbaender, Andockrahmen, Kran | ~400 m | breites Geruest, schwere Technik |
| 3 | Beobachtungs- & Navigationsboje | Zentralmast, Ringantenne, Kugelsensoren, Schuesseln, Solarpanels, Wartungsmodul | ~230 m | hoch, duenn, antennendominiert |

## Aufbau (wie bei Halcyon)
Referenz `blender/ruinen/referenz.png` -> `ruinen_build.py` -> `ruinen_layout.json` (im Spiel als `RUIN_LAYOUT` eingebettet) und je Anlage eine `.obj/.mtl` (Variante 0, ohne Emission).
Alle Teile sind Instanzen wiederverwendbarer Prototypen (29, gemeinsam fuer alle vier; die Halcyon-Prototypen werden mitbenutzt).

- **Basis** = intakte Architektur, immer gleich. **Variante 0-2** = Schaeden + Eis als eigene Instanzen (Basis + Variante wird zusammengesetzt).
- **Schaden als Slots mit Zustand:** Antenne ok / frozen / bent / broken / missing · Rohr/Foerderband/Traeger ok / frozen / damaged / disconnected / missing ·
  Solarpanel ok / frozen / broken / missing · Modul ok / frozen / tilt / drift (losgerissen, nacktes Geruest bleibt) · Huellenoeffnungen mit aufgebogenem Panel und Strebe · Truemmer.
- **Eis modular:** Auflagen (`icecap`) und Zapfen (`icicles`) auf allen Flaechenrichtungen (Platten, Balken, Rohre, Tanks, Container, Antennen); die Konstruktion bleibt sichtbar.
- Aenderung am Aufbau: `python3 ruinen_build.py`, danach den Inhalt von `ruinen_layout.json` in `const RUIN_LAYOUT=` in game.html ersetzen.
- Gesamtgroesse im Spiel: `RUIN_SC` (Spielgroesse je Layout-Einheit, 1 Einheit = 10 m). Die Groessenverhaeltnisse der vier Anlagen untereinander bleiben dabei erhalten.
- Achsen: Z = oben, X = rechts, Y = Tiefe. Das Blatt ist nicht streng orthografisch: FRONT = Master fuer X/Z, SEITE legt Y fest, OBEN die Anordnung.

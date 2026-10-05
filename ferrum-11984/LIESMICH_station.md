# Handelsknoten TRIVAR IV-4 (FERRUM-11984)

Im Spiel (`game.html`, Funktion `buildHubStation`, direkt vor `spawnFacility`) ersetzt die modulare Grossstation den alten Handelsknoten.
Aufbau: Referenz `blender/stationen/trivar_hub/referenz.png` -> `trivar_hub_build.py` (16 Prototypen, 284 Instanzen) ->
`trivar_hub_layout.json` (im Spiel als `HUB_LAYOUT` eingebettet) und `trivar_hub.obj/.mtl` (Blender: File > Import > Wavefront).

- Aenderung am Aufbau: `python3 trivar_hub_build.py`, danach den Inhalt der JSON in `const HUB_LAYOUT=` in game.html ersetzen.
- Vorschau: `python3 render_preview.py trivar_hub.obj vorschau.png`
- Masstab: `HUB_SC` (0,03 Spieleinheiten je Meter), Layout-Einheit = 100 m -> Station ca. 12 km hoch = 360 Einheiten.
- ~23 Draw-Calls (alle gleichen Primitive/Materialien in InstancedMeshes). Andock-Reichweite 420 und Autopilot-Stopp 320 (statt 200).
- Das Referenzblatt ist nicht streng orthografisch: FRONT = Master fuer X/Z, SEITE legt die Y-Tiefe fest, OBEN liefert die XY-Anordnung.

## NPC-Handelsstationen (4 Entwuerfe)
Ordner `blender/stationen/npc_stationen/` (`referenz.png`, `npc_stationen_build.py`, je Station OBJ/MTL + `stN_vorschau.png`, `npc_stationen_layout.json`).
Im Spiel: `NPC_LAYOUT` + `buildNpcStationN(typ)` in game.html; die Art ist je System fest (`npcStationType(sys)`, aus dem System-Seed), TRIVAR behaelt den Hub.

| Typ | Station | Groesse | Andock-Reichweite | Autopilot-Stopp |
|-----|---------|---------|-------------------|-----------------|
| 0 | Lokaler Posten | ca. 0,9 km | 140 | 45 |
| 1 | Standardstation (Horizontalring, Querbalken) | ca. 1,3 km | 150 | 55 |
| 2 | Industrieposten (Frachtgitter, Tuerme, Beine) | ca. 2,2 km | 170 | 75 |
| 3 | Regionaler Handelsknoten (senkrechtes Speichenrad, 8 Sektoren) | ca. 3,5 km | 220 | 110 |

Aenderung: `python3 npc_stationen_build.py`, dann den Inhalt von `npc_stationen_layout.json` in `const NPC_LAYOUT=` ersetzen.
Gemeinsame Bauteile kommen aus `blender/stationen/trivar_hub/trivar_hub_build.py` (Prototypen), plus `dome` und `wheel`.

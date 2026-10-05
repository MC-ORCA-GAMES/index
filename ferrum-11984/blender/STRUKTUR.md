# BLENDER-STRUKTUR (Referenz fuer kuenftige Aufgaben) - FERRUM-11984

Stichwort "schau in blender/Struktur": diese Datei lesen, dann gezielt den passenden Unterordner oeffnen.
Das Spiel (game.html) laedt NICHTS aus blender/. Layouts/Modelle sind eingebettet bzw. in art/asteroids/.
GLB/OBJ/MTL/Vorschau-Bilder sind aus Platzgruenden entfernt -> mit den *_build.py neu erzeugen.

## Ordner
| Ordner | Inhalt | Skript / Erzeugen | Doku |
|---|---|---|---|
| erz_asteroiden/ | 6 Erze x A/B/C (Eisen, Nickel, Kupfer, Titan, Silizium, Eis) | `python3 erz_build.py <Phase 1-3> . ../../art/asteroids/ore_asteroids.json` (braucht numpy trimesh scipy matplotlib) | ../LIESMICH_erz_asteroiden.md |
| stationen/trivar_hub/ | Handelsknoten Trivar IV-4 | trivar_hub_build.py -> trivar_hub_layout.json (+ OBJ) | ../LIESMICH_station.md |
| stationen/npc_stationen/ | 4 NPC-Handelsstationen | npc_stationen_build.py | ../LIESMICH_station.md |
| stationen/halcyon/ | Forschungsstation Halcyon (Story) | halcyon_build.py | ../LIESMICH_halcyon.md |
| ruinen/ | 4 verlassene Anlagen | ruinen_build.py | ../LIESMICH_ruinen.md |
| tore/ | stargate, acceleration_gate, stellar_accelerator | je *_build.py | ../LIESMICH_tore.md |
| hangar/ | Hangar-Innenraum (6 Teile, Teil 1 fertig) | siehe hangar/HANDOFF.md, Start mit "HANGAR TEIL n" | hangar/HANDOFF.md |
| trivar_iv4_station.py | aelteres Einzelskript Trivar | - | - |

Je Unterordner: `referenz.png` (Vorlage), `*_build.py`, `*_layout.json`, `render_preview.py` (Vorschau). 

## Erz-Asteroiden (Kurzregeln)
- Phasen: 1 = Eisen+Nickel, 2 = Kupfer+Titan, 3 = Silizium+Eis (alle fertig). Pro Erz A = rund, B = laenglich, C = gebrochen.
- Dunkler Fels + echte Mineral-Geometrie (Cluster, Platten, Adern, Krusten), KEIN Emissive, kein Glow, kein Text/Schiffe/Stationen.
- Hierarchie: ASTEROID_ROOT > ROCK_BODY, MINERAL_CLUSTERS, MINERAL_PLATES, MINERAL_VEINS, FRACTURE_DETAILS, OPTIONAL_SURFACE_DETAILS.
- Spiel-Export: art/asteroids/ore_asteroids.json (Vertexfarben, ~3.600-6.400 Dreiecke), Service-Worker-Cache in sw.js hochzaehlen (aktuell v78).
- Farben/Materialien: oregen.py (MAT_DEF). Formen: oregen.py (body_A/B/C). Erzlogik: erz_build.py.

## Regel fuer neue Arbeiten
Neue Modelle: eigener Unterordner mit referenz.png, *_build.py, *_layout.json; Doku als ../LIESMICH_<name>.md; diese Tabelle ergaenzen.

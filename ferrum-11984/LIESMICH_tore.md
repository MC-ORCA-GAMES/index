# Sprungtor-Arten (FERRUM-11984)

Im Spiel (`game.html`, Abschnitt "SPRUNGTOR-ARTEN") gibt es drei Tor-Arten:

| Art           | Beschreibung                                                        | Builder                      |
|---------------|---------------------------------------------------------------------|------------------------------|
| `classic`     | altes Tor (32 Segmente, 8 Halter)                                   | `buildGateModelClassic`      |
| `stargate`    | Stargate nach Referenz: 12 Segmente, 4 Arme, Innenring, 16 Module   | `buildGateModelStargate`     |
| `accelerator` | Beschleunigungsstrecke: 2 Schienen, 16 Module, 4 Rahmen, Korridor   | `buildGateModelAccelerator`  |
| `stellar`     | Stellar-Beschleuniger (Tor 3): Hub, 3 Arme, 228 Module, Fachwerk    | `buildGateModelStellar`      |

- Standard: `GATE_DEFAULT_TYPE` (aktuell `stargate`).
- `stellar` gibt es nur zweimal: an der Sonne des Startsystems und an der Sonne von TRIVAR (verbindet genau diese beiden).
- Welche Art ein Tor bekommt: `gateTypeFor(sysId, i)`.
- Zum Ansehen: `game.html?gate=accelerator` (bzw. `classic` / `stargate` / `stellar`).
- Neue Art: Builder schreiben (liefert `{ring, outer, ...}`) und in `GATE_BUILDERS` eintragen.
  Optionale Flags: `rotOuter:false`, `noSpin:true`, `noDisc:true`, `range:<Zahl>`.
- Maßstab je Art: Konstante `SC` im jeweiligen Builder (Meter -> Spieleinheiten).

## Blender (Ordner `blender/tore/`)
Je Tor: `*_build.py` (in Blender: Scripting -> Open -> Run Script; ohne Blender: `python3 *_build.py`
schreibt die OBJ), fertige `.obj/.mtl`, `vorschau.png` und das Referenzbild `referenz.png`.

## Torlogik (Phase 42)
- **Startsystem** hat genau EIN Tor: den Stellar-Beschleuniger an der Sonne nach **TRIVAR**. Kein anderes Tor.
- **TRIVAR** hat den Stellar-Beschleuniger an der Sonne (Rückweg ins Startsystem) plus seine normalen Tore.
- Alle anderen Systeme sind nur noch über TRIVAR erreichbar (der Tornetz-Aufbau prüft die Erreichbarkeit). Das alte Fernverbindungs-Merkmal `gate` führt jetzt nach TRIVAR statt nach Hause.
- Der Stellar-Beschleuniger steht 3,7 Sternradien vom Sternmittelpunkt (knapp außerhalb der Hitzezone), Ankunft 330 Einheiten vor dem Tor.

## Mission "Beschleuniger-Staffel" (`accel_relay`)
- Kette aus Beschleunigerstrecken (Tor-Art `accelerator`) in dem System, in dem der Auftrag angenommen wird: Start A -> Station 1 -> ... -> Station N (2-4 Stationen je nach Schwierigkeit).
- An jeder Station wartet eine Aufgabe (`RELAY_TASKS`): `hold` (im Ladefeld der Bake bleiben) oder `buoys` (3 Sensorbojen abfliegen). Erst danach wird der Beschleuniger dieser Station frei (G). Die Aufgabe an der letzten Station schließt die Mission ab.
- Neue Aufgabe: Eintrag in `RELAY_TASKS` + Zweig in `relayTick`.
- Beschleuniger und Baken erscheinen im Ziel-Panel (Autopilot/Warp möglich).

/*
  Farbentwicklung (Phase 29). Nur Daten, Logik: js/systems/ColorSystem.js, Anwenden auf den Körper: js/creature/ColorLook.js.
  Der Körper (`body`) und die Füße/Flossen (`bodyLight`) der Kreatur nehmen mit dem Wachstum langsam Farbe an. Welche Farben, bestimmen die
  verborgenen Farbpigmente (Phase 28 Teil C, `hidden.getPigments()`): die führende Farbe tönt den Körper, die zweite Farbe Füße und Flossen.
  Die Leuchtteile (Augen, Kern, Kristall, Flossenspitzen, Ringe) gehören weiter `FormLook` (Farbe der Evolutionsform) und werden hier NICHT berührt;
  die Gesichtsplatte bleibt dunkel (Kontrast zu den Augen).

  Jede Farbe hat eine „Farbwelt“ mit der Endfarbe von Körper und Füßen (voll entwickelt). `null` = Grundfarbe (Schwarz ist die Grundfarbe von MC ORCA,
  eine Kreatur mit führendem Schwarz bleibt also so, wie sie immer aussah). Ids wie `PIGMENT_IDS` in hiddenTraits.js. Eine neue Farbe =
  neues Pigment HINTEN in `PIGMENTS` plus neuer Eintrag hier (Inhalts-Pipeline); `rare` der Formen und weitere seltene Farben sind nicht Teil dieser Phase.

  Fairness: alle Farbwelten haben ähnliche Helligkeit (Körper linear 0,030–0,036 gegen 0,013 der Grundfarbe, Füße 0,064–0,076; der Körper bleibt dunkel, die MC-ORCA-Anmutung), keine Farbe gibt einen Wert, Gewinn oder Vorteil;
  nichts geht zurück (die Entwicklung hängt nur an der erreichten Lebensstufe, die Stufen gehen nie rückwärts). Alle Zahlen und Farben sind
  Startwerte (Vorschlag), NICHT im Browser gesehen.
*/
const freeze = (o) => Object.freeze(o);

/** Endfarben je Pigment. `body` = Körper, `light` = Füße und Flossen (etwas heller als der Körper). */
export const COLOR_WORLDS = freeze({
  black:  freeze({ label: 'Schwarz',     body: null,     light: null }),
  red:    freeze({ label: 'Rot',         body: 0x52202c, light: 0x74323f }),
  gold:   freeze({ label: 'Gold',        body: 0x3c3118, light: 0x5a4a26 }),
  orange: freeze({ label: 'Neonorange',  body: 0x4e2c1a, light: 0x6e432c }),
  blue:   freeze({ label: 'Blau',        body: 0x1e3064, light: 0x2f4a8c }),
  violet: freeze({ label: 'Violett',     body: 0x3a2870, light: 0x523c98 }),
  cyan:   freeze({ label: 'Cyan',        body: 0x123840, light: 0x1c5560 }),
});

export const COLOR_RULES = freeze({
  // Wie weit die Farbe entwickelt ist (0 = Grundfarben, 1 = Endfarbe), jeweils am ANFANG der Stufe. Innerhalb der Stufe gleitet der Wert zur
  // nächsten Stufe (wie `LIFE_STAGES[id].look`), im Übergang gilt schon der Wert der nächsten. Ei und Baby bleiben in den Grundfarben.
  // Die Spezialform färbt den Körper nicht weiter (keine Form sieht „bunter“ aus; ihre Farbe kommt von `FormLook`).
  development: freeze({ germ: 0, baby: 0, juvenile: 0.3, adolescent: 0.6, adult: 1, special: 1 }),
  // Stärke gegenüber den Grundfarben bei voller Entwicklung (1 = ganz die Endfarbe).
  maxMix: freeze({ body: 1, light: 1 }),
});

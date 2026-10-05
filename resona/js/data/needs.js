/*
  Bedürfnis-Daten (Phase 09). Reine Daten, keine Logik. Die Logik steht in js/systems/NeedSystem.js.

  Skala: ALLE Werte laufen von 0 bis 100, und 100 ist immer der gute Zustand.
    hunger  = 100 ist satt (der Wert misst die Sättigung, nicht den Hunger). Die Oberfläche (Phase 10)
              kann daraus „Hunger" = 100 - Wert machen oder einfach „satt" anzeigen.
    energy  = 100 ist ausgeruht
    hygiene = 100 ist sauber
    happiness = 100 ist sehr glücklich
    health  = 100 ist kerngesund
    bond    = 100 ist sehr enge Bindung
    curiosity = 100 ist angeregt (Neugier ist gerade gut gefüttert); sinkt, wenn nichts Neues passiert

  Komfortboden (Annahme 3 in GAME_DESIGN.md): `floor` ist die Untergrenze, bis zu der ein Wert von
  selbst sinken kann. Darunter fällt er nie, die Kreatur leidet nicht und stirbt nicht. Erholung ist
  immer möglich. Die Bindung sinkt gar nicht (decayPerHour 0), damit Wegbleiben nie bestraft wird.

  Zeitangaben: Spielzeit entspricht echter Zeit (Stunden). Alle Zahlen sind Startwerte (Vorschlag),
  NICHT getestet und NICHT balanciert. Neue Bedürfnisse = neuer Eintrag in NEEDS.

  Felder pro Bedürfnis:
    label          deutscher Name für die Oberfläche (Phase 10; `hunger` heißt dort „Sättigung", weil 100 = satt)
    start          Startwert einer neuen Kreatur
    floor          Komfortboden (siehe oben)
    decayPerHour   Abnahme pro Stunde (0 = sinkt nicht von selbst)
*/

const freeze = (o) => Object.freeze(o);

export const NEEDS = freeze({
  hunger:    freeze({ label: 'Sättigung',  start: 80, floor: 15, decayPerHour: 6   }),
  energy:    freeze({ label: 'Energie',    start: 85, floor: 15, decayPerHour: 5   }),
  hygiene:   freeze({ label: 'Hygiene',    start: 90, floor: 20, decayPerHour: 2.5 }),
  happiness: freeze({ label: 'Glück',      start: 70, floor: 25, decayPerHour: 0   }),   // folgt den anderen Werten (NEED_RULES.happiness)
  health:    freeze({ label: 'Gesundheit', start: 90, floor: 35, decayPerHour: 0   }),   // reagiert nur auf langfristige Pflege (NEED_RULES.health)
  bond:      freeze({ label: 'Bindung',    start: 15, floor: 0,  decayPerHour: 0   }),   // wächst nur, sinkt nie von selbst
  curiosity: freeze({ label: 'Neugier',    start: 70, floor: 20, decayPerHour: 4   }),
});

/**
 * Welche Werte die Oberfläche (Phase 10) immer zeigt und welche erst nach dem Aufklappen.
 * Wenige wichtige Werte zuerst: die vier, die der Spieler direkt beeinflusst.
 */
export const NEED_UI = Object.freeze({
  primary: Object.freeze(['hunger', 'energy', 'hygiene', 'happiness']),
  secondary: Object.freeze(['health', 'bond', 'curiosity']),
  levelText: Object.freeze({ good: 'gut', ok: 'mittel', low: 'niedrig' }),
});

/** Reihenfolge der Bedürfnisse (für Serialisierung und spätere Anzeige). */
export const NEED_IDS = Object.freeze(Object.keys(NEEDS));

export const NEED_RULES = freeze({
  // Längster Rechenschritt in Sekunden. Größere Zeitsprünge (Offline-Zeit, Phase 45) werden in Schritte
  // dieser Länge zerlegt, damit das sanfte Nachziehen von Glück und Gesundheit stabil bleibt.
  maxStepSec: 120,

  // Stufen für Anzeige und Emotionen (Phase 10/13): >= good = 'good', < low = 'low', dazwischen 'ok'.
  levels: freeze({ good: 60, low: 30 }),

  // Glück folgt den anderen Werten: es nähert sich dem gewichteten Mittel der Gewichte unten an.
  // followPerHour: Geschwindigkeit des Nachziehens (0,5 = Zeitkonstante von ca. 2 Stunden).
  happiness: freeze({
    followPerHour: 0.5,
    weights: freeze({ hunger: 0.3, energy: 0.25, hygiene: 0.15, curiosity: 0.2, bond: 0.1 }),
  }),

  // Gesundheit reagiert nur auf langfristige Pflege: Mittel der Pflegewerte.
  // Ab goodAbove steigt sie (schnell), unter poorBelow sinkt sie (sehr langsam, nie unter ihren Komfortboden),
  // dazwischen bleibt sie unverändert. Erholung ist deutlich schneller als der Abbau.
  health: freeze({
    careNeeds: freeze(['hunger', 'energy', 'hygiene']),
    goodAbove: 55,
    poorBelow: 30,
    recoverPerHour: 3,
    drainPerHour: 0.8,
  }),

  // Kleine Wirkung des Antippens (Phase 08 -> Phase 09). Die Schlüssel sind die Emotionen aus Interaction.js.
  // Nur die ersten maxEffectStreak Taps einer Serie wirken: Dauertippen bringt nichts (kein Grinden).
  interaction: freeze({
    maxEffectStreak: 3,
    effects: freeze({
      curious:   freeze({ curiosity: 2,   happiness: 1 }),
      happy:     freeze({ happiness: 3,   bond: 0.8 }),
      surprised: freeze({ curiosity: 1.5 }),
      content:   freeze({ happiness: 1.5, bond: 0.4 }),
    }),
  }),
});

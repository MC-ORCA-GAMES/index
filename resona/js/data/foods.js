/*
  Futter-Daten (Phase 11). Reine Daten, keine Logik. Die Logik steht in js/systems/FoodSystem.js
  (Wirkung auf die Werte) und js/creature/Feeding.js (Kreatur geht hin und frisst).

  Neues Futter = neuer Eintrag in FOODS (Inhalts-Pipeline, Master-Prompt Abschnitt 26). Skala wie in needs.js:
  alle Wirkungen sind Punkte auf der 0..100-Skala, die auf den jeweiligen Wert addiert werden.

  Felder pro Futter:
    label      deutscher Name
    taste      Geschmacksrichtung (Schlüssel aus FOOD_TASTES); die Kreatur mag Richtungen unterschiedlich gern
    shape      Form des Futterobjekts im Habitat: 'orb' | 'crystal' | 'root' | 'jelly' (siehe Feeding.js)
    color      Farbe des Futterobjekts und des Punkts im Auswahlfeld
    hunger     Sättigung (needs.hunger steigt, 100 = satt)
    energy     Energie
    health     Gesundheit (kleiner Schub, kein Abzug: keine Bestrafung)
    happiness  Glück (Leckerei)
  Alle Zahlen sind Startwerte (Vorschlag), NICHT getestet und NICHT balanciert.
*/
const freeze = (o) => Object.freeze(o);

export const FOODS = freeze({
  glowfruit:  freeze({ label: 'Leuchtfrucht', taste: 'sweet',   shape: 'orb',     color: 0xff6a2b, hunger: 22, energy: 4,  health: 2, happiness: 0 }),
  crystalnut: freeze({ label: 'Kristallnuss', taste: 'crunchy', shape: 'crystal', color: 0x21c7b8, hunger: 16, energy: 10, health: 1, happiness: 0 }),
  emberroot:  freeze({ label: 'Glutwurzel',   taste: 'savory',  shape: 'root',    color: 0xd4af37, hunger: 26, energy: 2,  health: 3, happiness: 0 }),
  starjelly:  freeze({ label: 'Sterngelee',   taste: 'tangy',   shape: 'jelly',   color: 0x8a6bff, hunger: 10, energy: 6,  health: 0, happiness: 4 }),
});

export const FOOD_IDS = Object.freeze(Object.keys(FOODS));

/** Geschmacksrichtungen. Jede Kreatur ordnet sie (aus ihrem Seed) in vier Stufen von „liebt\" bis „naja\". */
export const FOOD_TASTES = Object.freeze(['sweet', 'crunchy', 'savory', 'tangy']);

export const FOOD_RULES = freeze({
  // Ab diesem Sättigungswert lehnt die Kreatur Futter freundlich ab (kein Überfüttern, keine Strafe).
  refuseAbove: 88,

  // Wie die Kreatur zum Futter steht. Reihenfolge der Stufen = Rangfolge der Geschmacksrichtungen im Seed.
  // bonus wird zusätzlich zur Wirkung des Futters addiert (nie negativ). reaction = Reaktion aus Interaction.js.
  tiers: freeze(['loves', 'likes', 'okay', 'meh']),
  enjoyment: freeze({
    loves: freeze({ reaction: 'happy',   bonus: freeze({ happiness: 6, bond: 0.6 }) }),
    likes: freeze({ reaction: 'happy',   bonus: freeze({ happiness: 3, bond: 0.3 }) }),
    okay:  freeze({ reaction: 'content', bonus: freeze({ happiness: 1 }) }),
    meh:   freeze({ reaction: 'curious', bonus: freeze({}) }),
  }),

  // Ablauf im Habitat (Sekunden bzw. Habitat-Einheiten)
  eatSec: 3.4,          // so lange frisst die Kreatur am Futterplatz
  standOff: 0.6,        // Abstand der Kreatur zur Zonenmitte beim Fressen (Futter liegt in der Mitte)
  foodY: 0.26,          // Schwebehöhe des Futterobjekts
  foodSize: 0.17,       // Grundgröße des Futterobjekts
  appearSec: 0.35,      // Einblenden des Futters
});

// Texte der Oberfläche (Phase 11). Nur Deutsch.
export const FOOD_UI = freeze({
  openLabel: 'Füttern',
  closeLabel: 'Schließen',
  trayLabel: 'Futter auswählen',
  status: freeze({
    walking: 'Reson geht zum Futterplatz.',
    full: 'Reson ist gerade satt.',
    busy: 'Reson ist beim Essen.',
    asleep: 'Reson schläft gerade.',
    washing: 'Reson wird gerade gewaschen.',
    playing: 'Reson spielt gerade.',   // Phase 18
    gaming: 'Reson spielt gerade ein Minispiel mit dir.',   // Phase 20
    training: 'Reson übt gerade.',   // Phase 23
    egg: 'Reson ist noch im Ei.',   // Phase 25 (Absicherung; im Ei sind die Knöpfe ausgeblendet)
    done: freeze({
      loves: 'Das hat Reson besonders gut geschmeckt.',
      likes: 'Das hat Reson geschmeckt.',
      okay: 'Reson hat gegessen.',
      meh: 'Reson hat gegessen, war aber nicht begeistert.',
    }),
  }),
  statusSec: 4,         // so lange bleibt eine Meldung stehen
});

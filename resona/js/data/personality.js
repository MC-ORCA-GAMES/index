/*
  Persönlichkeits-Daten (Phase 12). Nur Daten, keine Logik (Logik: js/systems/PersonalitySystem.js).
  Neuer Zug = neuer Eintrag in TRAITS.

  Jeder Zug verschiebt Entscheidungen der Kreatur über Multiplikatoren (1 = unverändert, fehlt = 1):
    behavior.explore / investigate / observe   Auswahlgewicht der jeweiligen Aktion in Behavior.chooseNext
    behavior.wait                              Ruhephase zwischen zwei Aktionen (größer = ruhiger)
    behavior.dwell                             Verweildauer bei einer Zone
    behavior.look                              Dauer des Hinschauens zur Kamera (OBSERVE)
    behavior.repeatZone                        Neigung, dieselbe Zone nochmal anzulaufen (Basis: CONFIG.creature.behavior.repeatZoneChance)
    reaction.curious / happy / surprised / content   Gewicht der Reaktion beim Antippen (Interaction.chooseReaction)
    emotion.<Emotions-Id>                      Stärke der Ereignis-Impulse dieser Emotion und bei `lonely` der Einsamkeit (EmotionSystem, Phase 13)
  Der Einfluss eines Zugs wird mit seinem Gewicht (0..1) abgeschwächt: Faktor = 1 + Gewicht * (Multiplikator - 1).
  Alle Zahlen sind Startwerte (Vorschlag), nicht balanciert, nicht getestet.
*/

export const TRAITS = Object.freeze({
  curious: {
    label: 'neugierig',
    behavior: { investigate: 1.7, explore: 1.2, wait: 0.85 },
    reaction: { curious: 1.6 },
    emotion: { curious: 1.3 },
  },
  calm: {
    label: 'ruhig',
    behavior: { explore: 0.8, wait: 1.4, dwell: 1.2 },
    reaction: { content: 1.7, surprised: 0.7 },
    emotion: { content: 1.3, excited: 0.7, surprised: 0.8 },
  },
  playful: {
    label: 'verspielt',
    behavior: { explore: 1.4, observe: 1.2 },
    reaction: { happy: 1.6 },
    emotion: { excited: 1.2, happy: 1.2 },
  },
  shy: {
    label: 'schüchtern',
    // beobachtet lieber still und länger, statt selbst loszuziehen
    behavior: { observe: 1.4, look: 1.6, explore: 0.8, investigate: 0.85 },
    reaction: { surprised: 1.5, curious: 0.8, happy: 0.8 },
    emotion: { cautious: 1.4, surprised: 1.2, excited: 0.8 },
  },
  brave: {
    label: 'mutig',
    behavior: { explore: 1.3, investigate: 1.4, wait: 0.9 },
    reaction: { surprised: 0.55, curious: 1.2 },
    emotion: { cautious: 0.6, surprised: 0.7 },
  },
  energetic: {
    label: 'energiegeladen',
    behavior: { wait: 0.6, explore: 1.3, dwell: 0.8 },
    reaction: { happy: 1.3, content: 0.7 },
    emotion: { excited: 1.4 },
  },
  cautious: {
    label: 'vorsichtig',
    behavior: { explore: 0.8, observe: 1.3, dwell: 1.2, look: 1.2, wait: 1.1 },
    reaction: { surprised: 1.3 },
    emotion: { cautious: 1.4 },
  },
  social: {
    label: 'sozial',
    behavior: { observe: 1.9, wait: 0.9, look: 1.2 },
    reaction: { happy: 1.3 },
    emotion: { lonely: 1.4, happy: 1.1 },
  },
  stubborn: {
    label: 'stur',
    behavior: { repeatZone: 4, dwell: 1.25, wait: 1.15 },
    reaction: { content: 1.3, happy: 0.8 },
    emotion: { excited: 0.8 },
  },
});

export const TRAIT_IDS = Object.freeze(Object.keys(TRAITS));

/** Züge, die sich widersprechen. Ein dominanter Zug schließt seinen Gegenpart aus. */
export const OPPOSITES = Object.freeze([
  ['calm', 'energetic'],
  ['shy', 'brave'],
  ['cautious', 'brave'],
  ['shy', 'social'],
]);

export const PERSONALITY_RULES = Object.freeze({
  traitCount: { min: 3, max: 5 },        // Annahme 6 in GAME_DESIGN.md: drei bis fünf Züge
  dominantCount: 2,                      // davon zwei dominant
  dominantWeight: 1,
  minorWeight: { min: 0.3, max: 0.6 },   // leichte Gewichte der übrigen Züge
  modifierClamp: { min: 0.4, max: 2.5 }, // Grenze für den Gesamtfaktor je Wert
});

export const PERSONALITY_UI = Object.freeze({
  title: 'Wesen',
  joiner: ' und ',
  minorPrefix: 'leicht ',
});

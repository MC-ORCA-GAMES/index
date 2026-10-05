/*
  Gesundheits-Daten (Phase 17). Nur Daten, keine Logik.
  Logik: js/systems/HealthSystem.js (Zustand, Pflege-Schub). Meldungen: js/ui/HealthNotice.js.
  Sichtbar am Körper wird sie über die Emotion `unwell` („angeschlagen“, js/data/emotions.js), die aus dem Wert `health` abgeleitet
  wird; die Pose läuft über die vorhandene Stimmungsschicht (js/creature/EmotionExpression.js), es gibt keine eigene Körperschicht.

  Alle Zahlen sind Startwerte (Vorschlag), NICHT balanciert, NICHT im Browser getestet.

  Die Grundrechnung der Gesundheit steht seit Phase 09 im NeedSystem (NEED_RULES.health): Mittel aus Sättigung/Energie/Hygiene,
  ab 55 steigt sie um 3/h, unter 30 sinkt sie um 0,8/h, Komfortboden 35, sie fällt also nie in einen Bereich, in dem Reson leidet.
  Phase 17 setzt DARAUF auf und ändert diese Rechnung nicht.

  Grundgedanke „keine brutalen Bestrafungen, Erholung immer möglich“:
  - Nichts wird zusätzlich abgezogen. Schwach ist ein Zustand, kein Strafzähler: kein Verhalten wird gesperrt, nichts verschwindet.
  - Pflege hilft sofort ein Stück (kleiner Schub pro Pflegehandlung), nicht erst nach Stunden. Der Schub wirkt nur, solange sie nicht
    schon recht gesund ist, und jede Art Pflege hat eine Pause (kein Grinden).
  - Hinweise sind freundlich und sagen, was ihr guttäte, nie, was der Spieler falsch gemacht hat.
  - Das Verlassen des Zustands braucht einen Abstand (Hysterese), damit er nicht flackert.
*/

const freeze = (o) => Object.freeze(o);

export const HEALTH_RULES = freeze({
  weakBelow: 55,          // Gesundheit darunter: Reson ist „schlapp“ (Zustand `weak`)
  recoveredAt: 65,        // ab hier gilt sie wieder als fit (Abstand zur Schwelle gegen Flackern)
  boostBelow: 85,         // Pflege-Schub wirkt nur, solange die Gesundheit darunter liegt
  boostCooldownSec: 60,   // pro Art der Pflege: so lange nach einem Schub kein weiterer
  hintBelow: 50,          // ein Pflegewert unter diesem Wert wird im Hinweis genannt
  // Schub auf `health` je Pflegehandlung (Punkte)
  boost: freeze({
    feed: 3,              // gefüttert
    sleep: 5,             // ausgeschlafen (natürliches Aufwachen)
    sleepEarly: 1,        // sanft geweckt
    wash: 3,              // frisch gewaschen (natürliches Ende, wirklich etwas zu waschen)
    washEarly: 1,         // Waschen vorzeitig beendet
  }),
  // Pflegewerte, aus denen der Hinweis „was ihr guttäte“ gewählt wird (der niedrigste unter hintBelow zählt)
  hintNeeds: freeze(['hunger', 'energy', 'hygiene']),
});

export const HEALTH_UI = freeze({
  statusWord: freeze({ fit: 'fit', weak: 'schlapp' }),
  status: freeze({
    weak: 'Reson fühlt sich etwas schlapp.',
    recovered: 'Reson geht es wieder gut.',
  }),
  // Hinweis, was ihr guttäte (Ton: freundlich, ohne Vorwurf)
  hint: freeze({
    hunger: 'Ein Happen würde ihr guttun.',
    energy: 'Etwas Schlaf würde ihr guttun.',
    hygiene: 'Ein Bad würde ihr guttun.',
    general: 'Futter, Schlaf und ein Bad helfen ihr.',
  }),
});

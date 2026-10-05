/*
  Lern-Daten (Phase 24). Nur Daten und Texte, keine Logik (Logik: js/systems/LearningSystem.js).
  Langzeitverhalten: Reson verbindet positive Erlebnisse mit dem ORT, an dem sie passierten (Zone), und mit dem OBJEKT (Futter, Spielzeug).
  Daraus wächst eine Zuneigung 0..1, die NIE sinkt (keine Bestrafung, kein Vergessen, kein Meiden: unbekannte Orte bleiben neutral, Faktor 1).

  LEARN_RULES   gain (Zuwachs je Erlebnis nach Stufe), Bremse, Mindestabstand, Wirkung auf die Wahl der Orte (`placeBoost`; die Spielzeugwahl hat ihren Faktor `TOY_RULES.free.affinityWeight` in toys.js)
  LEARN_EXPERIENCES  welches positive Erlebnis wie stark zählt (Schlüssel = Art; Stufen loves/likes/okay wie bei Futter und Spielzeug)
  LEARN_TIERS   Wortstufen der Zuneigung (aufsteigend nach `min`); die Oberfläche zeigt nur Worte, keine Zahlen
  LEARN_UI      Texte (nur Deutsch)
  Alle Zahlen sind Startwerte (Vorschlag), NICHT balanciert, NICHT im Browser getestet.
*/
const freeze = (o) => Object.freeze(o);

export const LEARN_RULES = freeze({
  slowdown: 0.6,           // Zuwachs = Stärke * (1 - slowdown * Zuneigung): je vertrauter, desto langsamer (nähert sich 1, erreicht es nie ganz)
  minGapSec: 20,           // Mindestabstand (Laufzeit) zwischen zwei zählenden Erlebnissen derselben Art am selben Ort/Objekt (gegen Grinden)
  placeBoost: 2.2,         // Faktor auf das Gewicht eines Ortes bei Zuneigung 1 (Orte: Gewicht = 1 + Zuneigung * (placeBoost - 1))
  firstMemoryAt: 0.2,      // ab dieser Zuneigung zählt es als erster „gelernter“ Moment (Bindung, einmalig)
  showMax: 3,              // so viele Einträge zeigt die Zeile im Panel höchstens
});

/** Stärke je Erlebnis (Zuwachs bei Zuneigung 0). `levels` = Stufe des Erlebnisses (loves/likes/okay), `flat` = feste Stärke. */
export const LEARN_EXPERIENCES = freeze({
  feed:  freeze({ place: 'food',  object: 'food', levels: freeze({ loves: 0.10, likes: 0.07, okay: 0.04, meh: 0.02 }) }),
  play:  freeze({ place: 'play',  object: 'toy',  levels: freeze({ loves: 0.10, likes: 0.07, okay: 0.04 }) }),
  wash:  freeze({ place: 'wash',  object: null,   flat: 0.06 }),
  sleep: freeze({ place: 'sleep', object: null,   flat: 0.08 }),
});

export const LEARN_TIERS = Object.freeze([
  freeze({ id: 'none',     min: 0,   label: '' }),
  freeze({ id: 'familiar', min: 0.2, label: 'vertraut' }),
  freeze({ id: 'likes',    min: 0.5, label: 'mag' }),
  freeze({ id: 'loves',    min: 0.8, label: 'liebt' }),
]);

export const LEARN_UI = freeze({
  title: 'Gelernt',
  separator: ' \u00b7 ',
  entry: (name, tierLabel) => name + ' (' + tierLabel + ')',
  firstMemory: 'Reson verbindet etwas Schönes mit einem Ort',
});

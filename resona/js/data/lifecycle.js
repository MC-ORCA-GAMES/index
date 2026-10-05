/*
  Lebenszyklus-Daten (Phase 25). Nur Daten, keine Logik (Logik: js/systems/LifecycleSystem.js,
  Körper und Szene: js/creature/Growth.js und js/world/EggModel.js).
  Neue Stufe oder neue Zahl = Eintrag hier (Inhalts-Pipeline, Master-Prompt Abschnitt 26).

  Stufen laut Master-Prompt: Ei/Keim -> Baby -> Jungtier -> Heranwachsende Form -> Erwachsene Form -> Spezialform.
  Der Weg `LIFE_PATH` führt bis zur erwachsenen Form. Die Spezialform ist als Stufe definiert, wird aber NICHT durch Zeit
  erreicht: sie gehört der Evolution (Phase 26/27) und wird dort über `lifecycle.promote('special')` betreten.

  Pro Stufe (`LIFE_STAGES[id]`):
    label          Wort für die Oberfläche
    durationSec    Länge der Stufe in Sekunden Laufzeit bei Pflegefaktor 1 (null = Endstufe, wächst nicht weiter)
    transitionSec  Dauer des Übergangs in die nächste Stufe (beim Ei: das Schlüpfen)
    look           Aussehen am ANFANG der Stufe: size (Gesamtgröße, Anteil von CONFIG.creature.scale), head (Kopfgröße im Verhältnis,
                   Kindchenschema), pitch (Stimmlage, höher = jünger), speed (Lauftempo, Anteil). Innerhalb der Stufe wird gleitend
                   zum Aussehen der nächsten Stufe überblendet, deshalb wächst Reson sichtbar und nicht in Sprüngen.
    abilities      was in dieser Stufe (noch) nicht geht, `false` = geht nicht; fehlt der Schlüssel, geht es. Nur `training` ist belegt.
    words          Wörter für den Fortschritt innerhalb der Stufe [[ab Anteil, Text], ...] aufsteigend (keine Zahlen in der Oberfläche)

  Alles hier sind Startwerte (Vorschlag), NICHT getestet und NICHT balanciert. Nichts in diesem System bestraft:
  schlechte Pflege macht das Wachsen langsamer, aber nie stoppt es, und nichts geht zurück.
*/
const freeze = (o) => Object.freeze(o);
const look = (size, head, pitch, speed) => freeze({ size, head, pitch, speed });

export const LIFE_PATH = freeze(['germ', 'baby', 'juvenile', 'adolescent', 'adult']);

export const LIFE_STAGES = freeze({
  germ: freeze({
    label: 'Ei',
    durationSec: 300,        // ca. 5 Minuten, damit auch ein kurzer Besuch das Schlüpfen erlebt
    transitionSec: 3.4,      // Schlüpfen: das Ei bebt und leuchtet
    look: look(0.5, 1.3, 1.35, 0.75),   // = Aussehen des Babys (das Ei selbst hat ein eigenes Modell)
    abilities: freeze({}),
    words: freeze([[0, 'ruht noch'], [0.3, 'wird wärmer'], [0.7, 'regt sich'], [0.92, 'bald schlüpft es']]),
  }),
  baby: freeze({
    label: 'Baby',
    durationSec: 2400,       // ca. 40 Minuten
    transitionSec: 1.4,
    look: look(0.5, 1.3, 1.35, 0.75),
    abilities: freeze({ training: false }),   // zu klein zum Üben
    words: freeze([[0, 'ist ganz frisch'], [0.3, 'wächst'], [0.7, 'wächst kräftig'], [0.92, 'wird bald größer']]),
  }),
  juvenile: freeze({
    label: 'Jungtier',
    durationSec: 10800,      // ca. 3 Stunden
    transitionSec: 1.4,
    look: look(0.68, 1.18, 1.2, 0.9),
    abilities: freeze({}),
    words: freeze([[0, 'ist neugierig auf alles'], [0.3, 'wächst'], [0.7, 'wächst kräftig'], [0.92, 'wird bald größer']]),
  }),
  adolescent: freeze({
    label: 'Heranwachsend',
    durationSec: 28800,      // ca. 8 Stunden
    transitionSec: 1.4,
    look: look(0.86, 1.08, 1.08, 0.97),
    abilities: freeze({}),
    words: freeze([[0, 'streckt sich'], [0.3, 'wächst'], [0.7, 'wächst kräftig'], [0.92, 'ist bald ausgewachsen']]),
  }),
  adult: freeze({
    label: 'Erwachsen',
    durationSec: null,       // Endstufe des Zeitwegs; weiter geht es über die Evolution (Phase 26/27)
    transitionSec: 1.4,
    look: look(1, 1, 1, 1),
    abilities: freeze({}),
    words: freeze([[0, 'ist ausgewachsen']]),
  }),
  special: freeze({
    label: 'Spezialform',
    durationSec: null,       // nur über `promote('special')` (Evolution, Phase 26/27)
    transitionSec: 1.4,
    look: look(1.1, 0.98, 0.95, 1),   // Phase 26: etwas größer, Kopf etwas kleiner, etwas tiefere Stimme
    abilities: freeze({}),
    words: freeze([[0, 'ist etwas ganz Besonderes']]),
  }),
});

export const LIFE_STAGE_IDS = freeze(Object.keys(LIFE_STAGES));

export const LIFE_RULES = freeze({
  startStage: 'germ',        // eine neue Kreatur beginnt als Ei (der Start kann über `?stage=` in der Adresse überschrieben werden, Dev-Hilfe bis Phase 48)
  timeScale: 1,              // Zeitfaktor für das Wachstum (Dev/Debug, Phase 48)
  maxDt: 0.25,               // größere Frame-Sprünge zählen nur so viel (z. B. nach einem Tab-Wechsel)

  // Pflege bestimmt nur das TEMPO. Mittel der Werte (Gewichte unten, 0..1): ab `goodAbove` volles Tempo `maxRate`, bis `poorBelow`
  // Mindesttempo `minRate`, dazwischen gleitend. `minRate` > 0: auch bei schlechter Pflege wächst Reson weiter (keine Bestrafung).
  care: freeze({
    weights: freeze({ hunger: 1, energy: 1, hygiene: 1, happiness: 1.5, health: 1, bond: 0.5 }),
    poorBelow: 0.3,
    goodAbove: 0.9,
    minRate: 0.45,
    maxRate: 1.3,
  }),
  growthFactorRange: freeze([0.5, 2]),   // Grenzen für das verborgene Merkmal „Wachstum“ (Phase 28, `getGrowthFactor`)

  // Das Ei braucht keine Pflege, nur Wärme: Antippen wärmt (kleiner Schub, mit Pause und Obergrenze gegen Grinden).
  warm: freeze({
    bonusSec: 5,             // so viele Sekunden Fortschritt bringt ein wirksamer Tipp
    cooldownSec: 1.5,        // schneller folgende Tipps bewegen das Ei nur
    maxPerStage: 20,         // höchstens so viele wirksame Tipps (also höchstens 100 s von 300 s)
  }),

  // Zeit in der Abwesenheit (Phase 45 ruft `advance(seconds)`): zählt anteilig und höchstens bis zum Ende der aktuellen Stufe.
  // Der Übergang selbst (Schlüpfen, Wachsen) passiert immer live, damit der Spieler ihn erlebt und nichts übersprungen wird.
  offlineFactor: 0.4,
  offlineMaxSec: 7 * 24 * 3600,

  emergeSec: 0.9,            // das frisch geschlüpfte Baby wächst so lange aus der Eierschale heraus
});

/** Texte der Oberfläche (Phase 25). Nur Deutsch. Keine Zahlen außer dem Alter. */
export const LIFE_UI = freeze({
  title: 'Wachstum',
  separator: ' \u00b7 ',
  eggMood: 'noch im Ei',
  hint: freeze({
    egg: 'Ein Ei ruht im Habitat. Antippen wärmt es, bald schlüpft etwas.',
  }),
  warm: freeze([
    'Das Ei fühlt sich warm an.',
    'Im Inneren pocht etwas.',
    'Das Ei summt leise.',
  ]),
  growing: freeze({
    germ: 'Das Ei bebt und leuchtet auf …',
    default: 'Reson leuchtet auf – sie verändert sich.',
  }),
  stage: freeze({
    baby: 'Reson ist geschlüpft!',
    juvenile: 'Reson ist jetzt ein Jungtier.',
    adolescent: 'Reson wächst heran. Sie wirkt schon ganz anders.',
    adult: 'Reson ist ausgewachsen.',
    special: 'Reson hat eine ganz besondere Form angenommen.',
  }),
  age: freeze({ justNow: 'gerade erst', minutes: 'Min.', hours: 'Std.', day: 'Tag', days: 'Tage' }),
  ageSuffix: 'alt',
});

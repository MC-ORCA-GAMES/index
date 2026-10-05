/*
  Trainings-Daten (Phase 23). Nur Daten und Texte, keine Logik (Logik: js/systems/TrainingSystem.js, Vorführung: js/creature/Training.js,
  Oberfläche: js/ui/TrainingPanel.js). Neue Fähigkeit = neuer Eintrag in SKILLS (plus Drehbuch in Training.js, `makeParams` im System,
  Texte in TRAINING_UI, Text in BOND_SPECIAL `skill_<id>`).

  SKILLS          die fünf Fähigkeiten aus dem Master-Prompt (Folgen, Warten, Springen, Objekt bringen, Geräusche erkennen) mit den Zahlen
                  für die Vorführung. Wege und Abstände in Welteinheiten (Raum 5,3 breit, begehbar ca. 4,2 breit, Phase 30), Zeiten in Sekunden.
  LEVEL_TIERS     Wortstufen des Lernstands (0..1), aufsteigend nach `min`. Die Oberfläche zeigt nur diese Worte, keine Zahlen.
  MASTER_TIER     Id der obersten Stufe; ihr Erreichen ist ein besonderer Moment (Bindung, einmalig je Fähigkeit).
  TRAINING_RULES  Ablauf, Lernzuwachs, Belohnung, Abnutzung, Zeiten der Vorführung.
  TRAINING_UI     alle Texte (nur Deutsch).

  Nichts davon bestraft: Der Lernstand sinkt nie, ein misslungener Versuch (`tried`) lehrt trotzdem, Beenden kostet nichts.
  Alle Zahlen und Texte sind Startwerte (Vorschlag), NICHT balanciert, NICHT im Browser getestet.
*/
const freeze = (o) => Object.freeze(o);

export const SKILLS = freeze({
  follow: freeze({
    label: 'Folgen',
    desc: 'Folgt einem Lichtpunkt',
    aria: 'Folgen üben: Reson folgt einem Lichtpunkt',
    legsMin: 1, legsMax: 3,        // Etappen des Lichtpunkts (wächst mit dem Lernstand)
    legLen: 1.4,                   // Länge einer Etappe
    standOff: 0.5,                 // so weit hinter dem Lichtpunkt bleibt sie stehen
    prop: freeze({ color: 0xffd27a, size: 0.13 }),
    actMaxSec: 24,                 // Sicherung: ein hängender Versuch endet spätestens hier
  }),
  wait: freeze({
    label: 'Warten',
    desc: 'Wartet auf die Erlaubnis',
    aria: 'Warten üben: Reson wartet, bis sie das Leckerli nehmen darf',
    holdMin: 2, holdMax: 5,        // so lange wartet sie (wächst mit dem Lernstand)
    treatDist: 1.2,                // Abstand des Leckerlis vor ihr
    prop: freeze({ color: 0xff6a2b, size: 0.12 }),
    actMaxSec: 18,
  }),
  jump: freeze({
    label: 'Springen',
    desc: 'Springt auf Kommando',
    aria: 'Springen üben: Reson springt auf Kommando',
    hopsMin: 1, hopsMax: 3,        // Zahl der Sprünge (wächst mit dem Lernstand)
    liftMin: 0.25, liftMax: 0.6,   // Sprunghöhe
    hopSec: 0.6,                   // Dauer eines Sprungs
    hopGapSec: 0.25,               // Pause zwischen zwei Sprüngen
    prop: freeze({ color: 0x21c7b8, size: 0.1 }),   // wird beim Springen nicht gezeigt, steht der Form halber da
    actMaxSec: 12,
  }),
  fetch: freeze({
    label: 'Bringen',
    desc: 'Holt einen Ball und bringt ihn',
    aria: 'Objekt bringen üben: Reson holt einen Ball und bringt ihn zu dir',
    ballDist: 2.2,                 // so weit liegt der Ball von ihr entfernt
    standOff: 0.45,                // Abstand zum Ball beim Aufnehmen
    handover: freeze({ x: 0, z: 1.6 }),   // Übergabepunkt (+z = zur Kamera hin)
    carry: freeze({ y: 0.55, z: 0.55 }),  // Lage des getragenen Balls vor ihr (Höhe, Abstand nach vorn)
    prop: freeze({ color: 0x4fd8ff, size: 0.17 }),
    actMaxSec: 26,
  }),
  listen: freeze({
    label: 'Lauschen',
    desc: 'Erkennt, woher ein Geräusch kommt',
    aria: 'Geräusche erkennen üben: Reson findet heraus, woher ein Ton kommt',
    sourceDist: 2.4,               // Abstand der Klangquelle
    sounds: Object.freeze(['tick', 'chime', 'pop']),   // Namen aus Sfx.js
    prop: freeze({ color: 0x8a6bff, size: 0.14 }),
    actMaxSec: 16,
  }),
});

export const SKILL_IDS = Object.freeze(Object.keys(SKILLS));

/** Wortstufen des Lernstands, aufsteigend nach `min`. */
export const LEVEL_TIERS = Object.freeze([
  freeze({ id: 'novice',     min: 0,    label: 'Anfänger' }),
  freeze({ id: 'learning',   min: 0.25, label: 'lernt' }),
  freeze({ id: 'practiced',  min: 0.55, label: 'geübt' }),
  freeze({ id: 'confident',  min: 0.85, label: 'sicher' }),
]);

export const MASTER_TIER = 'confident';

export const TRAINING_RULES = freeze({
  // ---- Ablauf ----
  attempts: 5,               // Versuche je Übung
  introSec: 1.2,             // Pause nach dem Start (Hinweistext lesen)
  cueSec: 1.4,               // das Kommando steht
  feedbackSec: 2.6,          // Rückmeldung (hier kann der Spieler loben)
  endSec: 0.9,               // Ausklingen nach dem natürlichen Ende
  stopEndSec: 0.3,           // Ausklingen nach vorzeitigem Ende
  maxSessionSec: 200,        // Sicherung: so lange hält Behavior den Zustand TRAIN höchstens
  minEnergy: 25,             // darunter ist sie zu müde (freundliche Ablehnung, nichts kostet etwas)

  // ---- Ausgang eines Versuchs: Wahrscheinlichkeit [bei Lernstand 0, bei Lernstand 1], dazwischen linear; `good` ist der Rest ----
  chance: freeze({
    great: Object.freeze([0.15, 0.8]),
    tried: Object.freeze([0.45, 0.03]),
  }),

  // ---- Lernzuwachs je Versuch: gain[kind] * (1 - slowdown * Lernstand) * Lerntempo ----
  gain: freeze({ great: 0.07, good: 0.05, tried: 0.025 }),
  slowdown: 0.5,
  praiseBonus: 0.5,          // Loben gibt zusätzlich diesen Anteil des Zuwachses des Versuchs
  praiseEffects: freeze({ happiness: 1.2, bond: 0.2 }),

  // ---- Lerntempo = Abnutzung * Persönlichkeit * Bindung, jeder Faktor begrenzt ----
  traitClamp: freeze({ min: 0.7, max: 1.4 }),
  bondFactor: freeze({ min: 0.9, max: 1.1 }),   // Bindungswert 0 -> min, 100 -> max
  traitFactor: freeze({
    follow: freeze({ social: 1.3, curious: 1.15, shy: 0.9, stubborn: 0.8 }),
    wait:   freeze({ calm: 1.3, cautious: 1.15, energetic: 0.8, playful: 0.85, stubborn: 0.85 }),
    jump:   freeze({ energetic: 1.3, playful: 1.2, calm: 0.85, cautious: 0.9 }),
    fetch:  freeze({ playful: 1.3, social: 1.2, stubborn: 0.8 }),
    listen: freeze({ curious: 1.25, cautious: 1.15, calm: 1.1 }),
  }),

  // ---- Belohnung für Werte (Skala wie bei den Minispielen) ----
  minAttemptsForReward: 3,   // vorzeitig beendet: erst ab so vielen Versuchen zählt die Übung
  rewardBase: 0.5,           // Belohnung = effects * (rewardBase + rewardPerFrac * Anteil) * Abnutzung
  rewardPerFrac: 0.5,
  effects: freeze({ happiness: 6, bond: 0.8, curiosity: 3, energy: -3 }),
  participation: freeze({ happiness: 1.5, bond: 0.2 }),   // nur bei natürlichem Ende

  // ---- Abnutzung gegen Grinden (je Fähigkeit getrennt) ----
  fatiguePerSession: 0.3,
  fatigueStopped: 0.12,
  fatigueDecayPerSec: 0.004,
  minFactor: 0.25,

  // ---- Ergebnis der Übung ----
  resultWeights: freeze({ great: 1, good: 0.65, tried: 0.2 }),
  resultTiers: Object.freeze([
    freeze({ id: 'great', min: 0.75, reaction: 'happy' }),
    freeze({ id: 'good',  min: 0.5,  reaction: 'happy' }),
    freeze({ id: 'ok',    min: 0,    reaction: 'content' }),
  ]),

  // ---- Vorführung (Training.js) ----
  propFadeSec: 0.35,         // Ein- und Ausblenden des Hilfsobjekts
  hoverY: 0.9,               // Höhe schwebender Hilfsobjekte (Lichtpunkt, Klangquelle)
  calmLiftFactor: 0.4,       // „reduzierte Bewegung“: Sprünge nur klein und langsam
  calmHopSec: 0.9,
  freeTimeoutSec: 3,         // Warten auf das Ende der Drehung zur Kamera
  turnTimeoutSec: 4,         // Sicherungszeiten je Schritt
  moveTimeoutSec: 8,
});

export const TRAINING_UI = freeze({
  title: 'Üben',
  pickTitle: 'Was soll Reson üben?',
  openLabel: 'Üben',
  openAria: 'Üben: Fähigkeit auswählen',
  closeLabel: 'Schließen',
  stopLabel: 'Beenden',
  stopAria: 'Übung beenden',
  praiseLabel: 'Loben',
  praiseAria: 'Reson loben',
  againLabel: 'Nochmal',
  moodWord: 'übt',
  intro: 'Gleich geht es los …',
  praised: 'Gut gemacht, Reson!',
  attemptOf: (n, total) => 'Versuch ' + n + ' von ' + total,
  levelUp: (tierLabel) => 'Stufe erreicht: ' + tierLabel + '.',
  levelLine: (skillLabel, tierLabel) => skillLabel + ': ' + tierLabel,
  cue: freeze({
    follow: 'Folge dem Licht, Reson!',
    wait: 'Warte, Reson!',
    jump: 'Spring, Reson!',
    fetch: 'Hol den Ball, Reson!',
    listen: 'Hör genau hin, Reson!',
  }),
  acting: freeze({
    follow: 'Reson folgt dem Licht …',
    wait: 'Reson wartet …',
    jump: 'Reson springt …',
    fetch: 'Reson holt den Ball …',
    listen: 'Reson lauscht …',
  }),
  feedback: freeze({
    great: 'Das hat super geklappt!',
    good: 'Gut – fast perfekt.',
    tried: 'Noch nicht ganz – das übt ihr weiter.',
  }),
  result: freeze({
    great: 'Das war eine tolle Übung!',
    good: 'Das hat schon gut geklappt.',
    ok: 'Ihr habt zusammen geübt. Das wird noch besser.',
    stopped: 'Übung beendet. Was Reson gelernt hat, bleibt.',
  }),
  status: freeze({
    tired: 'Reson ist gerade zu müde zum Üben.',
    asleep: 'Reson schläft gerade.',
    washing: 'Reson wird gerade gewaschen.',
    playing: 'Reson spielt gerade mit einem Spielzeug.',
    gaming: 'Reson spielt gerade ein Minispiel mit dir.',
    busy: 'Reson ist gerade beschäftigt.',
    young: 'Reson ist noch zu klein zum Üben. Sie wächst ja noch.',   // Phase 25: Lebensstufe Baby
    unknown: 'Diese Übung gibt es nicht.',
  }),
});

/*
  Spielzeug-Daten (Phase 18). Reine Daten, keine Logik.
  Logik: js/systems/ToySystem.js (wann, wie lange, Wirkung auf die Werte, Abnutzung).
  Szene und Körper: js/creature/Playing.js (Weg zum Spielbereich, Blick, Gesten, Nachwirkung) und js/world/ToyModels.js (die fünf Objekte).
  Knopf und Meldungen: js/ui/ToyPanel.js. Freies Spiel (Phase 19): TOY_RULES.free, Entscheidung in ToySystem.pollAuto(), Auslöser in Playing.update. Die Zone `play` („Spielbereich“, Raum `play`, Phase 30) steht in CONFIG.habitat.zones.

  Neues Spielzeug = neuer Eintrag in TOYS (Inhalts-Pipeline, Master-Prompt Abschnitt 26). Die Form (`shape`) muss in
  js/world/ToyModels.js einen Baustein haben (`ball`, `cube`, `drone`, `crystal`, `ring`), der Stil (`style`) einen Eintrag in TOY_POSE.

  Felder pro Spielzeug:
    label      deutscher Name (Auswahlfeld)
    withText   Text für Meldungen im Dativ („Reson spielt mit dem Leuchtball.“)
    shape      Form des Objekts (siehe ToyModels.js)
    color      Farbe des Objekts und des Punkts im Auswahlfeld
    size       Grundgröße des Objekts (Gruppen-Skalierung)
    style      Spielstil: 'chase' | 'ponder' | 'follow' | 'calm' | 'resonate'. Bestimmt Körperbewegung (TOY_POSE) und Bahn des Objekts
    sound      Laut aus Sfx.js, der in `soundEverySec` Abständen kommt
    playSec    so lange spielt sie (verdichtet wie Schlaf und Waschen: Sekunden statt Minuten)
    effects    Punkte auf der 0..100-Skala (wie bei Futter), bei vollem Spiel; Energie darf negativ sein (sinkt nie unter den Komfortboden)
    fits       Passung zur Persönlichkeit: Zug -> Faktor. Passung = Summe aus Faktor * Gewicht des Zugs der Kreatur (nie negativ)
    mood       Emotions-Impulse nach dem Spiel (nur bei gezähltem Spiel), Schlüssel aus EMOTIONS
    after      Nachwirkung auf das selbstständige Verhalten (Faktoren für Behavior.setBias): explore / investigate / observe / wait
    gestures   Gesten, die sie beim Spielen abwechselnd zeigt (Namen aus IdleBehavior)

  Alle Zahlen sind Startwerte (Vorschlag), NICHT balanciert, NICHT im Browser getestet.
*/
const freeze = (o) => Object.freeze(o);

export const TOYS = freeze({
  glowball: freeze({
    label: 'Leuchtball', withText: 'dem Leuchtball', shape: 'ball', color: 0xff6a2b, size: 0.2,
    style: 'chase', sound: 'bounce', soundEverySec: 1.7, playSec: 9,
    effects: freeze({ happiness: 7, curiosity: 3, energy: -5, bond: 0.4 }),
    fits: freeze({ playful: 1, energetic: 1, brave: 0.5, curious: 0.3 }),
    mood: freeze({ excited: 0.45 }),
    after: freeze({ explore: 1.7, investigate: 0.9, observe: 0.8, wait: 0.7 }),
    gestures: freeze(['hop', 'tailWag']),
  }),
  floatcube: freeze({
    label: 'Schwebender Würfel', withText: 'dem schwebenden Würfel', shape: 'cube', color: 0x8a6bff, size: 0.2,
    style: 'ponder', sound: 'tick', soundEverySec: 2.6, playSec: 10,
    effects: freeze({ happiness: 4, curiosity: 8, energy: -1, bond: 0.3 }),
    fits: freeze({ curious: 1, cautious: 0.6, stubborn: 0.5, calm: 0.4 }),
    mood: freeze({ curious: 0.6 }),
    after: freeze({ explore: 0.8, investigate: 1.9, observe: 1, wait: 1 }),
    gestures: freeze(['headTilt', 'crystalPulse']),
  }),
  minidrone: freeze({
    label: 'Mini-Drohne', withText: 'der Mini-Drohne', shape: 'drone', color: 0x4fd8ff, size: 0.2,
    style: 'follow', sound: 'whirr', soundEverySec: 3.2, playSec: 9,
    effects: freeze({ happiness: 6, curiosity: 4, energy: -4, bond: 0.8 }),
    fits: freeze({ social: 1, brave: 0.7, energetic: 0.5, playful: 0.4 }),
    mood: freeze({ excited: 0.35, curious: 0.3 }),
    after: freeze({ explore: 1, investigate: 1, observe: 1.9, wait: 0.9 }),
    gestures: freeze(['finFlick', 'tailWag']),
  }),
  crystal: freeze({
    label: 'Kristall', withText: 'dem Kristall', shape: 'crystal', color: 0x21c7b8, size: 0.2,
    style: 'calm', sound: 'chime', soundEverySec: 3.4, playSec: 12,
    effects: freeze({ happiness: 4, curiosity: 2, energy: 2, bond: 0.5 }),
    fits: freeze({ calm: 1, shy: 0.7, cautious: 0.5, social: 0.2 }),
    mood: freeze({ content: 0.65 }),
    after: freeze({ explore: 0.7, investigate: 1, observe: 1.2, wait: 1.5 }),
    gestures: freeze(['crystalPulse']),
  }),
  resonancering: freeze({
    label: 'Resonanzring', withText: 'dem Resonanzring', shape: 'ring', color: 0xd4af37, size: 0.22,
    style: 'resonate', sound: 'resonate', soundEverySec: 3.8, playSec: 11,
    effects: freeze({ happiness: 5, curiosity: 5, energy: -1, bond: 1 }),
    fits: freeze({ curious: 0.6, social: 0.6, calm: 0.5, playful: 0.4 }),
    mood: freeze({ happy: 0.5, curious: 0.4 }),
    after: freeze({ explore: 1, investigate: 1.4, observe: 1.4, wait: 1 }),
    gestures: freeze(['crystalPulse', 'headTilt']),
  }),
});

export const TOY_IDS = Object.freeze(Object.keys(TOYS));

export const TOY_RULES = freeze({
  // Ab hier zu müde zum Spielen: sie lehnt freundlich ab (Reaktion „zufrieden“, nichts kostet etwas, keine Strafe).
  // Die Energie fällt von selbst nur bis zum Komfortboden 15 (needs.js), die Schwelle liegt darüber.
  minEnergy: 25,

  // Wie gut ein Spielzeug zur Persönlichkeit passt (Passung = Summe aus `fits`-Faktor * Gewicht des Zugs). Nie negativ, kein „schlechtes“ Spielzeug.
  // Die erste Stufe, deren minScore erreicht ist, gilt. reaction = Reaktion aus Interaction.js, bonus kommt bei natürlichem Ende dazu.
  tiers: freeze([
    freeze({ id: 'loves', minScore: 1.0, reaction: 'happy',   bonus: freeze({ happiness: 4, bond: 0.4 }) }),
    freeze({ id: 'likes', minScore: 0.4, reaction: 'happy',   bonus: freeze({ happiness: 2 }) }),
    freeze({ id: 'okay',  minScore: 0,   reaction: 'content', bonus: freeze({}) }),
  ]),
  defaultScore: 0.5,      // ohne Persönlichkeit

  // Ablauf (Sekunden bzw. Habitat-Einheiten)
  standOff: 0.95,         // Abstand der Kreatur zur Mitte des Spielbereichs
  dwellSlackSec: 8,       // Zusatzzeit der Verhaltensaufgabe, damit Playing immer VOR dem Ende der Aufgabe beendet
  minPlaySec: 4,          // vorher gestoppt: nichts wirkt und nichts zählt (kostet nichts)
  countFraction: 0.5,     // ab diesem Anteil der Spielzeit zählt es als gespielt (Bindung, Statistik, Abnutzung, Nachwirkung)
  appearSec: 0.6,         // Spielzeug erscheint
  disappearSec: 0.7,      // Spielzeug verschwindet
  endSec: 0.8,            // Ausklingen nach natürlichem Ende
  stopEndSec: 0.35,       // Ausklingen nach Stoppen
  calmEndSec: 0.5,        // „reduzierte Bewegung“: kurze Pause

  // Abnutzung gegen Grinden: jedes gezählte Spiel macht die nächsten Wirkungen etwas kleiner, das erholt sich mit der Zeit.
  // Wirkungsfaktor = 1 - Müdigkeit (nicht unter minFactor). Dasselbe Spielzeug direkt nochmal macht mehr müde (Abwechslung zählt).
  fatiguePerPlay: 0.3,
  sameToyExtra: 0.2,
  fatigueDecayPerSec: 0.008,   // von 1 auf 0 in gut 2 Minuten
  minFactor: 0.25,

  // Nachwirkung auf das selbstständige Verhalten (Behavior.setBias), Sekunden Laufzeit
  afterglowSec: 90,

  // Freies Spiel (Phase 19): Reson greift von selbst zu einem Spielzeug, ohne dass der Spieler etwas auslöst.
  // Sparsam und ohne Dauerschleife: lange Pause nach jedem Spiel (auch nach dem vom Spieler ausgelösten), nur im freien Zustand IDLE,
  // nur wenn sie fit genug ist, und nur mit einer Wahrscheinlichkeit pro Prüfung. Kein Zwang, nichts geht verloren, wenn sie nicht spielt.
  free: freeze({
    enabled: true,          // Grundeinstellung (zur Laufzeit über ToySystem.setFreePlay umschaltbar, z. B. Einstellungen/Debug)
    firstDelaySec: 50,      // Pause nach dem Start, bevor sie zum ersten Mal von selbst spielen will
    cooldownSec: 150,       // Pause nach einem Spiel (natürliches Ende, vom Spieler ausgelöst oder von selbst)
    cooldownStoppedSec: 240,   // längere Pause nach „Fertig“/Abbruch: der Spieler hat sie unterbrochen, sie drängt sich nicht auf
    checkEverySec: 5,       // so oft würfelt sie, ob sie spielen möchte
    baseChance: 0.12,       // Wahrscheinlichkeit pro Prüfung bei Lust 1 (erwartet gut 40 s nach Ende der Pause)
    minEnergy: 40,          // darunter will sie nicht von selbst spielen (der Knopf geht weiter bis `minEnergy` 25)
    minHunger: 35,          // ist sie recht hungrig (Sättigung darunter), spielt sie nicht von selbst
    // Lust = Bedürfnis nach Abwechslung (niedrige Neugier) mal Persönlichkeit mal Frische (Abnutzung)
    curiosityFrom: 75,      // Neugier ab hier: kaum Lust aus dem Wert (Faktor `needMin`)
    curiosityTo: 25,        // Neugier ab hier: größte Lust (Faktor `needMax`)
    needMin: 0.6,
    needMax: 1.5,
    traitFactor: freeze({ playful: 0.8, energetic: 0.5, curious: 0.4, calm: -0.4, shy: -0.3 }),   // Faktor = 1 + Summe(Wert * Gewicht des Zugs)
    desireMin: 0.4,
    desireMax: 2.2,
    freshness: 0.7,         // Lust *= (1 - freshness) + freshness * Wirkungsfaktor (Abnutzung macht sie weniger spielfreudig)
    // Auswahl des Spielzeugs: Gewicht = 1 + Passung * fitWeight (+ favoriteBonus für das Lieblingsspielzeug), * sameToyFactor für das zuletzt benutzte
    fitWeight: 1.5,
    favoriteBonus: 1.2,
    sameToyFactor: 0.35,
    affinityWeight: 1.0,      // Phase 24: Gewicht * (1 + Zuneigung (0..1) * affinityWeight), Zuneigung aus dem LearningSystem
  }),

  // Beim Spielen
  gestureMin: 2.2,        // Pause zwischen zwei Gesten
  gestureMax: 4.0,
  turnEverySec: 0.5,      // so oft prüft sie, ob sie sich zum Spielzeug drehen muss
  turnMinAngle: 0.45,     // erst ab dieser Abweichung (rad) dreht sie sich nach
});

// Körperbewegung beim Spielen je Stil (Phase 18), bei voller Tiefe. Alles wird auf die Werte ADDIERT, die IdleBehavior jeden Frame
// absolut setzt (nichts summiert sich über Frames). Winkel in rad, Frequenzen in Schwingungen pro Sekunde.
export const TOY_POSE = freeze({
  blendInSec: 0.6,
  blendOutSec: 0.5,
  calmHeadTilt: 0.06,     // „reduzierte Bewegung“: nur eine ruhige Kopfneigung
  styles: freeze({
    chase:    freeze({ bodyRoll: 0.06, bodyHz: 3.2, headTilt: 0.10, headHz: 1.6, finFlap: 0.25, finHz: 3.0, tailWag: 0.35, tailHz: 4.0 }),
    ponder:   freeze({ bodyRoll: 0.00, bodyHz: 0.0, headTilt: 0.22, headHz: 0.35, finFlap: 0.05, finHz: 0.6, tailWag: 0.08, tailHz: 0.8 }),
    follow:   freeze({ bodyRoll: 0.03, bodyHz: 1.4, headTilt: 0.12, headHz: 0.8, finFlap: 0.18, finHz: 2.0, tailWag: 0.20, tailHz: 2.4 }),
    calm:     freeze({ bodyRoll: 0.00, bodyHz: 0.0, headTilt: 0.06, headHz: 0.3, finFlap: 0.06, finHz: 0.5, tailWag: 0.05, tailHz: 0.6 }),
    resonate: freeze({ bodyRoll: 0.02, bodyHz: 0.9, headTilt: 0.10, headHz: 0.5, finFlap: 0.12, finHz: 0.9, tailWag: 0.10, tailHz: 1.0 }),
  }),
});

// Texte der Oberfläche (Phase 18). Nur Deutsch.
export const TOY_UI = freeze({
  openLabel: 'Spielen',
  closeLabel: 'Schließen',
  stopLabel: 'Fertig',
  openAria: 'Spielzeug auswählen',
  closeAria: 'Spielzeugauswahl schließen',
  stopAria: 'Spielen beenden',
  trayLabel: 'Spielzeug auswählen',
  moodWord: 'spielt',     // ersetzt in der Zeile „Stimmung: ...“, solange sie spielt
  status: freeze({
    going: 'Reson geht zum Spielbereich.',
    goingAuto: 'Reson möchte spielen und geht zum Spielbereich.',
    playing: (withText) => 'Reson spielt mit ' + withText + '.',
    done: freeze({
      loves: 'Das hat Reson besonders viel Freude gemacht.',
      likes: 'Reson hat gern gespielt.',
      okay: 'Reson hat gespielt.',
    }),
    stopped: 'Reson ist für jetzt fertig mit Spielen.',
    cancelled: 'Reson bleibt, wo sie ist.',
    tired: 'Reson ist gerade zu müde zum Spielen.',
    asleep: 'Reson schläft gerade.',
    washing: 'Reson wird gerade gewaschen.',
    busy: 'Reson ist gerade beschäftigt.',
    nozone: 'Reson findet keinen Spielbereich.',
  }),
});

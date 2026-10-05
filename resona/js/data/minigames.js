/*
  Minispiel-Daten (Phase 20: Reaktionsspiel, Phase 21: Memory, Phase 22: Lichtfunken (3D-Geschicklichkeit)).
  Reine Daten, keine Logik.
  Reaktionsspiel: Logik js/systems/ReactionGameSystem.js, Oberfläche js/ui/ReactionView.js.
  Memory:         Logik js/systems/MemoryGameSystem.js,   Oberfläche js/ui/MemoryView.js.
  Lichtfunken:    Logik js/systems/SkillGameSystem.js,    3D-Szene js/world/SparkField.js, Oberfläche js/ui/SkillView.js.
  Kreatur und Verhalten (alle Spiele): js/creature/Gaming.js. Knopf und Spielauswahl: js/ui/GamePanel.js.

  Das Reaktionsspiel: drei Felder (Kreis, Dreieck, Raute) liegen unten im Bild. Nach einer zufälligen kurzen Pause leuchtet eines auf,
  der Spieler tippt es so schnell wie möglich an. Reson sieht zu und freut sich mit. Nach `rounds` Runden gibt es ein Ergebnis und
  eine kleine Belohnung (Glück, Bindung, Neugier, ein paar „Resonanzsplitter“ als kleine Ressource).

  Memory (Phase 21): zwölf verdeckte Karten (sechs Paare). Kurze Vorschau, dann umdrehen, immer zwei Karten aufdecken; ein Paar bleibt offen,
  sonst drehen beide zurück. Gezählt werden Versuche (je zwei aufgedeckte Karten); weniger ist besser. Reson sieht zu, wackelt bei
  Paaren mit dem Schwanz und hüpft, wenn alle gefunden sind. Gleiche Belohnungsarten wie beim Reaktionsspiel, ruhiger (mehr Neugier, weniger Energie).

  Lichtfunken (Phase 22): ein leuchtender Funke erscheint in der Kuppel und schwebt auf einer Bahn um Reson. Der Spieler tippt ihn im
  3D-Bild an (kein Feld auf der Oberfläche: das Ziel liegt in der Szene). Je genauer der Treffer, desto mehr Punkte; zehn Funken nacheinander,
  Reson sieht zu und freut sich mit. Gleiche Belohnungsarten wie bei den anderen Spielen, aktiver (mehr Energieverbrauch).

  Grundgedanke „nicht frustrierend, kein Grinden“ (für alle Spiele):
  - Nichts kann „verloren“ gehen: Fehler geben nur weniger Punkte bzw. mehr Versuche, nie einen Abzug bei den Werten.
  - Auch ein schwaches Ergebnis gibt eine kleine Teilnahme-Belohnung (nur bei vollständig gespieltem Spiel).
  - Abnutzung wie bei den Spielzeugen: direkt nochmal spielen bringt weniger, das erholt sich mit der Zeit (kein Dauer-Grinden, kein Verbot).
    Die Müdigkeit ist je Minispiel getrennt.
  - Jederzeit „Beenden“ (kostet nichts; ab `minRoundsForReward` Runden bzw. `minPairsForReward` Paaren zählt der gespielte Teil).
  - Lichtfunken: Daneben tippen kostet nichts (nur ein freundlicher Hinweis), die Funken werden nicht schneller, großzügige Trefferfläche.
  - Keine Tempoverschärfung, kein Zeitlimit (Reaktion und Lichtfunken: nur das Zeitfenster je Runde; Memory: gar keines).

  Alle Zahlen sind Startwerte (Vorschlag), NICHT balanciert, NICHT im Browser getestet. Typische Tipp-Reaktionszeiten auf dem Handy
  sind eine Annahme (ca. 0,4–0,9 s), die Stufen unten sind danach geschätzt. Die Memory-Stufen (Versuche) sind geschätzt:
  mit sechs Paaren braucht man mindestens 6 Versuche, mit guter Merkleistung etwa 8–10, ohne Merken deutlich mehr.
*/
const freeze = (o) => Object.freeze(o);

export const REACTION = freeze({
  rounds: 8,                 // Runden pro Spiel
  introSec: 1.2,             // kurze Pause nach dem Start, bevor die erste Runde beginnt (Hinweistext lesen, Hand bereit)
  windowSec: 1.8,            // so lange leuchtet ein Feld; danach gilt die Runde als verpasst (0 Punkte)
  waitMin: 0.9,              // zufällige Pause vor dem Aufleuchten (Sekunden)
  waitMax: 2.3,
  earlyHoldSec: 0.6,         // zu früh getippt: die Pause dauert danach mindestens noch so lange (kein Raten durch Dauertippen)
  feedbackSec: 0.75,         // so lange bleibt die Rückmeldung der Runde stehen
  minEnergy: 20,             // darunter ist sie zu müde (freundliche Ablehnung, nichts kostet etwas)
  minRoundsForReward: 3,     // vorzeitig beendet: erst ab so vielen gespielten Runden zählt der Anteil
  maxGameSec: 90,            // Sicherung: so lange hält Behavior den Zustand GAME höchstens
  endSec: 0.9,               // Ausklingen nach dem natürlichen Ende (Reson noch im Spiel, dann Reaktion)
  stopEndSec: 0.3,           // Ausklingen nach vorzeitigem Ende

  // Felder. `shape` bestimmt die Form (nicht nur die Farbe), `label` den Namen. Reihenfolge = Reihenfolge im Bild.
  pads: Object.freeze([
    freeze({ id: 'circle',   label: 'Kreis',    shape: 'circle',   color: 0x21c7b8 }),
    freeze({ id: 'triangle', label: 'Dreieck',  shape: 'triangle', color: 0xff6a2b }),
    freeze({ id: 'diamond',  label: 'Raute',    shape: 'diamond',  color: 0x8a6bff }),
  ]),

  // Punkte je Runde nach Reaktionszeit (Sekunden vom Aufleuchten bis zum richtigen Tippen). Die erste passende Stufe gilt.
  // Wurde in der Runde vorher auf ein falsches Feld getippt, zählt höchstens `wrongTapMaxPoints`.
  tiers: Object.freeze([
    freeze({ id: 'great', maxSec: 0.65, points: 3 }),
    freeze({ id: 'good',  maxSec: 1.05, points: 2 }),
    freeze({ id: 'ok',    maxSec: 1.8,  points: 1 }),   // bis zum Ende des Zeitfensters (windowSec)
  ]),
  wrongTapMaxPoints: 1,

  // Ergebnis nach Anteil der erreichten Punkte (0..1) an allen möglichen (rounds * 3). Die erste Stufe, deren `min` erreicht ist, gilt.
  // reaction = Reaktion aus Interaction.js (Quelle 'game').
  resultTiers: Object.freeze([
    freeze({ id: 'great', min: 0.85, reaction: 'happy' }),
    freeze({ id: 'good',  min: 0.55, reaction: 'happy' }),
    freeze({ id: 'ok',    min: 0,    reaction: 'content' }),
  ]),

  // Belohnung bei vollem Ergebnis (Anteil 1). Punkte auf der 0..100-Skala wie bei Futter und Spielzeug; Energie darf negativ sein
  // (sinkt nie unter den Komfortboden). Wirkung = Wert * Anteil * Abnutzungsfaktor.
  effects: freeze({ happiness: 9, bond: 0.8, curiosity: 3, energy: -2 }),
  // Teilnahme: nur bei vollständig gespielter Runde, unabhängig vom Ergebnis (mal Abnutzungsfaktor)
  participation: freeze({ happiness: 1.5, bond: 0.2 }),
  // Kleine Ressource „Resonanzsplitter“: ganze Zahl, 1 + Anteil * perFrac (gerundet) mal max(minFactor, Abnutzungsfaktor), mindestens 1.
  // Es gibt noch kein Inventar (Phase 37): die Menge wird nur gezählt (ReactionGameSystem.getResources, serialisierbar).
  shards: freeze({ base: 1, perFrac: 3, minFactor: 0.5 }),

  // Abnutzung gegen Grinden (wie ToySystem): jedes Spiel macht die Wirkungen des nächsten kleiner, das erholt sich mit der Zeit.
  fatiguePerGame: 0.35,
  fatigueStopped: 0.15,
  fatigueDecayPerSec: 0.004,   // von 0,35 auf 0 in gut 85 Sekunden
  minFactor: 0.25,

  // Kreatur beim Zusehen (Gaming.js)
  gestureGapSec: 3,           // Mindestabstand zwischen zwei Gesten
  gestureGreat: 'hop',        // bei „great“
  gestureGood: 'tailWag',     // bei „good“
  gestureMiss: 'headTilt',    // bei verpasst (neugierig, kein Vorwurf)
});

// Texte der Oberfläche (Phase 20). Nur Deutsch.
export const REACTION_UI = freeze({
  openLabel: 'Minispiel',
  openAria: 'Reaktionsspiel starten',
  title: 'Reaktionsspiel',
  moodWord: 'spielt mit dir',   // ersetzt in der Zeile „Stimmung: ...“, solange das Minispiel läuft
  stopLabel: 'Beenden',
  stopAria: 'Reaktionsspiel beenden',
  againLabel: 'Nochmal',
  closeLabel: 'Schließen',
  roundOf: (n, total) => 'Runde ' + n + ' von ' + total,
  intro: 'Tippe das leuchtende Feld an, so schnell du kannst.',
  waiting: 'Warte auf das Leuchten …',
  go: 'Jetzt!',
  early: 'Noch nicht – warte auf das Leuchten.',
  wrong: 'Das war ein anderes Feld.',
  feedback: freeze({
    great: 'Blitzschnell!',
    good: 'Gut!',
    ok: 'Geschafft.',
    miss: 'Verpasst – kein Problem.',
  }),
  result: freeze({
    great: 'Glänzend! Reson ist begeistert.',
    good: 'Gut gespielt! Reson hat sich gefreut.',
    ok: 'Geschafft! Reson hatte Spaß.',
    stopped: 'Fertig für jetzt.',
  }),
  scoreLine: (points, max) => points + ' von ' + max + ' Punkten',
  bestLine: (best) => 'Bestes Ergebnis: ' + best,
  newBest: 'Neues bestes Ergebnis!',
  shardsLine: (n) => (n === 1 ? '1 Resonanzsplitter' : n + ' Resonanzsplitter'),
  status: freeze({
    tired: 'Reson ist gerade zu müde zum Spielen.',
    asleep: 'Reson schläft gerade.',
    washing: 'Reson wird gerade gewaschen.',
    playing: 'Reson spielt gerade mit einem Spielzeug.',
    busy: 'Reson ist gerade beschäftigt.',
  }),
});

// ---------------------------------------------------------------------------------------------------------------------------
// Memory (Phase 21)
// ---------------------------------------------------------------------------------------------------------------------------
export const MEMORY = freeze({
  pairs: 6,                  // Anzahl Paare (Karten = 2 * pairs); höchstens so viele wie `symbols`
  columns: 4,                // Spalten des Kartenrasters im Hochformat (im flachen Querformat macht das CSS mehr Spalten daraus)
  introSec: 1.2,             // Pause nach dem Start (Hinweistext lesen), danach die Vorschau
  peekSec: 1.8,              // Vorschau: alle Karten liegen kurz offen, dann drehen sie um
  mismatchSec: 1.1,          // zwei verschiedene Karten bleiben so lange offen; Antippen einer anderen Karte beendet das früher
  clearSec: 0.9,             // nach dem letzten Paar kurz stehen lassen, dann kommt das Ergebnis
  minEnergy: 20,             // darunter ist sie zu müde (freundliche Ablehnung, nichts kostet etwas)
  minPairsForReward: 3,      // vorzeitig beendet: erst ab so vielen gefundenen Paaren zählt der gespielte Teil
  maxGameSec: 300,           // Sicherung: so lange hält Behavior den Zustand GAME höchstens (Memory hat kein Zeitlimit für den Spieler)
  endSec: 0.9,               // Ausklingen nach dem natürlichen Ende (Reson noch im Spiel, dann Reaktion)
  stopEndSec: 0.3,           // Ausklingen nach vorzeitigem Ende

  // Kartenbilder. `shape` bestimmt die Form (nicht nur die Farbe), `label` den Namen (Screenreader). Es werden die ersten `pairs` genommen,
  // sind es weniger Paare als Symbole, mischt das System die Auswahl.
  symbols: Object.freeze([
    freeze({ id: 'circle',   label: 'Kreis',     shape: 'circle',   color: 0x21c7b8 }),
    freeze({ id: 'triangle', label: 'Dreieck',   shape: 'triangle', color: 0xff6a2b }),
    freeze({ id: 'diamond',  label: 'Raute',     shape: 'diamond',  color: 0x8a6bff }),
    freeze({ id: 'square',   label: 'Quadrat',   shape: 'square',   color: 0xf2b632 }),
    freeze({ id: 'star',     label: 'Stern',     shape: 'star',     color: 0xff4d6d }),
    freeze({ id: 'hexagon',  label: 'Sechseck',  shape: 'hexagon',  color: 0x5ab8ff }),
  ]),

  // Bewertung nach Versuchen (je zwei aufgedeckte Karten = 1 Versuch). Bestwert = `pairs` Versuche.
  // Anteil (0..1) = 1 - (Versuche - pairs) / slackTurns, mindestens `minFraction` bei vollständig gespieltem Spiel.
  slackTurns: 12,            // 6 Versuche = 1,0; 12 = 0,5; 18 und mehr = Untergrenze
  minFraction: 0.15,
  stoppedFraction: 0.5,      // vorzeitig beendet: Anteil = gefundene Paare / pairs * stoppedFraction
  // Ergebnisstufe nach Versuchen; die erste Stufe, deren `maxTurns` nicht überschritten ist, gilt. reaction = Reaktion aus Interaction.js (Quelle 'game').
  resultTiers: Object.freeze([
    freeze({ id: 'great', maxTurns: 9,        reaction: 'happy' }),
    freeze({ id: 'good',  maxTurns: 13,       reaction: 'happy' }),
    freeze({ id: 'ok',    maxTurns: Infinity, reaction: 'content' }),
  ]),

  // Belohnung bei vollem Ergebnis (Anteil 1); Skala wie bei Futter und Spielzeug. Wirkung = Wert * Anteil * Abnutzungsfaktor.
  // Ruhiger als das Reaktionsspiel: mehr Neugier, weniger Energieverbrauch.
  effects: freeze({ happiness: 8, bond: 0.8, curiosity: 6, energy: -1.5 }),
  participation: freeze({ happiness: 1.5, bond: 0.2 }),
  shards: freeze({ base: 1, perFrac: 3, minFactor: 0.5 }),

  // Abnutzung gegen Grinden (je Minispiel getrennt, wie ToySystem)
  fatiguePerGame: 0.35,
  fatigueStopped: 0.15,
  fatigueDecayPerSec: 0.004,
  minFactor: 0.25,

  // Kreatur beim Zusehen (Gaming.js)
  gestureGapSec: 3,          // Mindestabstand zwischen zwei Gesten
  gestureMatch: 'tailWag',   // Paar gefunden
  gestureClear: 'hop',       // letztes Paar (ignoriert den Mindestabstand)
  gestureMismatch: 'headTilt',   // verschiedene Karten: neugierig, kein Vorwurf
  gestureMismatchEvery: 3,   // nur bei jedem dritten Fehlversuch, damit es nicht nervt
});

// Texte des Memory (Phase 21). Nur Deutsch.
export const MEMORY_UI = freeze({
  title: 'Memory',
  intro: 'Merk dir die Karten – gleich drehen sie sich um.',
  peek: 'Schau genau hin!',
  pick: 'Finde die Paare.',
  pickSecond: 'Welche Karte passt dazu?',
  match: 'Ein Paar!',
  matchLast: 'Alle Paare gefunden!',
  mismatch: 'Nicht ganz – merk dir die Karten.',
  counter: (turns, found, pairs) => 'Paare ' + found + '/' + pairs + ' · Versuche ' + turns,
  cardAria: (n, total, state) => 'Karte ' + n + ' von ' + total + ', ' + state,
  cardHidden: 'verdeckt',
  cardMatched: (label) => label + ', Paar gefunden',
  cardOpen: (label) => label,
  againLabel: 'Nochmal',
  closeLabel: 'Schließen',
  result: freeze({
    great: 'Was für ein Gedächtnis! Reson ist begeistert.',
    good: 'Gut gemerkt! Reson hat sich gefreut.',
    ok: 'Geschafft! Reson hatte Spaß.',
    stopped: 'Fertig für jetzt.',
  }),
  scoreLine: (turns, pairs) => 'Alle ' + pairs + ' Paare in ' + turns + ' Versuchen',
  bestLine: (best) => 'Bestes Ergebnis: ' + best + ' Versuche',
  newBest: 'Neues bestes Ergebnis!',
  shardsLine: (n) => (n === 1 ? '1 Resonanzsplitter' : n + ' Resonanzsplitter'),
});

// ---------------------------------------------------------------------------------------------------------------------------
// Lichtfunken (Phase 22): 3D-Geschicklichkeit
// ---------------------------------------------------------------------------------------------------------------------------
export const SKILL = freeze({
  rounds: 10,                // Funken pro Spiel
  introSec: 1.2,             // Pause nach dem Start (Hinweistext lesen)
  waitMin: 0.6,              // Pause vor dem nächsten Funken (Sekunden, zufällig)
  waitMax: 1.4,
  lifeSec: 3.2,              // so lange schwebt ein Funke; danach „entwischt“ (0 Punkte, kein Abzug)
  lifeSecCalm: 4.8,          // bei „reduzierte Bewegung“ (der Funke steht still, bleibt länger)
  feedbackSec: 0.7,          // Rückmeldung der Runde
  minEnergy: 20,             // darunter ist sie zu müde (freundliche Ablehnung, nichts kostet etwas)
  minRoundsForReward: 3,     // vorzeitig beendet: erst ab so vielen gespielten Runden zählt der Anteil
  maxGameSec: 120,           // Sicherung: so lange hält Behavior den Zustand GAME höchstens
  endSec: 0.9,               // Ausklingen nach dem natürlichen Ende
  stopEndSec: 0.3,           // Ausklingen nach vorzeitigem Ende

  // Bahn eines Funkens (Weltkoordinaten, Boden y = 0, Mitte des Habitats = Ursprung, Kreatur steht nahe (0, 0, 0,8)).
  // Der Funke kreist in einem Ring um die Mitte; Radius, Höhe, Startwinkel, Richtung und Tempo sind je Funke zufällig.
  // Gleichbleibendes Tempo über das ganze Spiel (keine Verschärfung).
  orbit: freeze({
    radiusMin: 1.9, radiusMax: 3.3,
    heightMin: 0.8, heightMax: 2.0,
    speedMin: 0.45, speedMax: 0.85,   // Winkelgeschwindigkeit in rad/s (Richtung zufällig)
    bob: 0.12,                        // kleines Auf und Ab (Höhe +- bob, Teil der Position, auch für die Trefferprüfung)
    minAngleStep: 1.1,                // mindestens so weit (rad) vom Startwinkel des vorigen Funkens entfernt, damit nicht dort wieder etwas aufblitzt
  }),

  // Treffer: `offset` = Abstand des Tipps vom Funkenmittelpunkt in Funkenradien (0 = genau Mitte). Die erste passende Stufe gilt.
  // Über `hitOffset` ist es ein Fehltipp (kein Abzug, nur ein Hinweis).
  hitOffset: 1.7,
  tiers: Object.freeze([
    freeze({ id: 'great', maxOffset: 0.55, points: 3 }),
    freeze({ id: 'good',  maxOffset: 1.05, points: 2 }),
    freeze({ id: 'ok',    maxOffset: 1.7,  points: 1 }),
  ]),
  sparkRadius: 0.3,          // sichtbarer Radius des Funkens (Welteinheiten), die Trefferfläche ist `hitOffset` mal so groß

  // Ergebnis nach Anteil der Punkte (0..1) an allen möglichen (rounds * 3)
  resultTiers: Object.freeze([
    freeze({ id: 'great', min: 0.8, reaction: 'happy' }),
    freeze({ id: 'good',  min: 0.5, reaction: 'happy' }),
    freeze({ id: 'ok',    min: 0,   reaction: 'content' }),
  ]),

  // Belohnung bei vollem Ergebnis (Anteil 1); Skala wie bei Futter und Spielzeug. Aktiver als Memory: mehr Energieverbrauch.
  effects: freeze({ happiness: 9, bond: 0.8, curiosity: 4, energy: -2.5 }),
  participation: freeze({ happiness: 1.5, bond: 0.2 }),
  shards: freeze({ base: 1, perFrac: 3, minFactor: 0.5 }),

  // Abnutzung gegen Grinden (je Minispiel getrennt)
  fatiguePerGame: 0.35,
  fatigueStopped: 0.15,
  fatigueDecayPerSec: 0.004,
  minFactor: 0.25,

  // Kreatur beim Zusehen (Gaming.js)
  gestureGapSec: 3,
  gestureGreat: 'hop',
  gestureGood: 'tailWag',
  gestureMiss: 'headTilt',
});

// Texte der Lichtfunken (Phase 22). Nur Deutsch.
export const SKILL_UI = freeze({
  title: 'Lichtfunken',
  roundOf: (n, total) => 'Funke ' + n + ' von ' + total,
  intro: 'Tippe die Lichtfunken im Bild an.',
  waiting: 'Gleich erscheint ein Funke …',
  spark: 'Fang ihn!',
  stray: 'Knapp daneben – versuch es weiter.',
  feedback: freeze({
    great: 'Volltreffer!',
    good: 'Gut!',
    ok: 'Erwischt.',
    miss: 'Entwischt – kein Problem.',
  }),
  result: freeze({
    great: 'Glänzend gefangen! Reson ist begeistert.',
    good: 'Gut gezielt! Reson hat sich gefreut.',
    ok: 'Geschafft! Reson hatte Spaß.',
    stopped: 'Fertig für jetzt.',
  }),
  againLabel: 'Nochmal',
  closeLabel: 'Schließen',
  scoreLine: (points, max) => points + ' von ' + max + ' Punkten',
  bestLine: (best) => 'Bestes Ergebnis: ' + best,
  newBest: 'Neues bestes Ergebnis!',
  shardsLine: (n) => (n === 1 ? '1 Resonanzsplitter' : n + ' Resonanzsplitter'),
});

// ---------------------------------------------------------------------------------------------------------------------------
// Knopf und Spielauswahl (Phase 21): GamePanel.js. Der Knopf „Minispiel“ öffnet eine Auswahl, jedes Spiel hat sein eigenes Spielfeld.
// ---------------------------------------------------------------------------------------------------------------------------
export const MINIGAME_UI = freeze({
  openLabel: 'Minispiel',
  openAria: 'Minispiele öffnen',
  closeLabel: 'Schließen',
  stopLabel: 'Beenden',
  stopAria: 'Minispiel beenden',
  pickTitle: 'Minispiel wählen',
  moodWord: 'spielt mit dir',   // wie REACTION_UI.moodWord: ersetzt in der Zeile „Stimmung: ...“, solange ein Minispiel läuft
  // Reihenfolge = Reihenfolge in der Auswahl
  games: Object.freeze([
    freeze({ id: 'reaction', name: 'Reaktion', desc: 'Tippe das leuchtende Feld.', aria: 'Reaktionsspiel starten' }),
    freeze({ id: 'memory',   name: 'Memory',   desc: 'Finde die Paare.',           aria: 'Memory starten' }),
    freeze({ id: 'skill',    name: 'Funken',   desc: 'Fang die Lichtfunken.',      aria: 'Lichtfunken starten' }),
  ]),
  // Ablehnungsgründe von Gaming.start (für beide Spiele gleich)
  status: freeze({
    tired: 'Reson ist gerade zu müde zum Spielen.',
    asleep: 'Reson schläft gerade.',
    washing: 'Reson wird gerade gewaschen.',
    playing: 'Reson spielt gerade mit einem Spielzeug.',
    busy: 'Reson ist gerade beschäftigt.',
  }),
});

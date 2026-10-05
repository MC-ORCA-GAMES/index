/*
  Schlaf-Daten (Phase 15). Nur Daten, keine Logik.
  Logik: js/systems/SleepSystem.js (wann, wie lange, Erholung). Umsetzung am Körper und in der Szene:
  js/creature/Sleeping.js. Knopf und Meldungen: js/ui/SleepPanel.js.

  Alle Zahlen sind Startwerte (Vorschlag), NICHT balanciert, NICHT im Browser getestet.

  Zeit: Schlaf ist bewusst „verdichtet“. Ein Nickerchen dauert Minuten statt Stunden, damit auch kurze Besuche
  (5 bis 20 Minuten) den Schlaf erleben und die Energie sichtbar wieder steigt. Die Energie sinkt dagegen weiter
  in Stunden (NEEDS.energy.decayPerHour), die Kreatur wird also nur nach längerer Zeit von selbst müde.

  Keine Strafe: Wecken schadet nichts (nur eine kurze Pause, in der sie sich nicht von selbst wieder hinlegt),
  zu frühes Schlafenlegen wird freundlich abgelehnt („noch ausgeruht“), nichts sinkt durch Schlaf.
*/

const freeze = (o) => Object.freeze(o);

export const SLEEP_RULES = freeze({
  autoBelow: 35,          // Energie darunter: Reson legt sich von selbst hin (nur wenn sie gerade nichts anderes tut)
  requestBelow: 80,       // Ab hier darf der Spieler sie schlafen legen; darüber ist sie „noch ausgeruht“
  wakeAt: 88,             // Energie, ab der sie von selbst aufwacht
  minSleepSec: 45,        // so lange schläft sie mindestens (außer der Spieler weckt sie)
  maxSleepSec: 240,       // spätestens dann wacht sie auf (Sicherung)
  dwellSlackSec: 30,      // Zusatzzeit der Verhaltensaufgabe, damit Sleep immer VOR dem Ende der Aufgabe weckt
  energyPerSec: 0.45,     // Erholung der Energie pro Sekunde im Schlaf
  wakeHappiness: 2,       // kleiner Glücksschub beim natürlichen Aufwachen („ausgeschlafen“)
  napCooldownSec: 150,    // nach Wecken/Abbrechen legt sie sich so lange nicht von selbst wieder hin
  standOff: 0.15,         // Abstand zur Mitte des Schlafplatzes beim Hinlegen (sie liegt auf dem Platz)
});

// Liegepose am Körper (Phase 15), bei voller Tiefe (1). Wird mit der Tiefe 0..1 überblendet.
// Faktoren multiplizieren die Werte, die IdleBehavior jeden Frame absolut setzt; Winkel in rad.
export const SLEEP_POSE = freeze({
  lower: 0.1,             // Rumpf sinkt (Gruppen-Einheiten; Unterkante liegt im Stand ca. 0,12 über dem Boden)
  squashY: 0.9,           // Rumpf wird flacher (Faktor auf die Höhe, Unterkante bleibt)
  widenXZ: 1.05,          // und etwas breiter
  feetScale: 0.7,         // Füße werden eingezogen (Skalierung)
  headPitch: 0.3,         // Kopf sinkt nach vorn/unten
  finSpread: -0.22,       // Flossen angelegt
  tailCurl: 0.35,         // Schwanz rollt sich zur Seite (pro Glied etwas mehr)
  eyeOpen: 0.07,          // Faktor auf die Augenhöhe (Augen fast zu)
  eyeGlow: 0.25,          // Faktor auf das Augenleuchten
  core: 0.55,             // Faktor auf das Brustkern-Leuchten
  crystal: 0.45,          // Faktor auf das Kristall-Leuchten
  breathPeriod: 6.5,      // langsamer Schlafatem (Sekunden pro Atemzug), zusätzlich zur normalen Atmung
  breathAmp: 0.012,       // Stärke des zusätzlichen Atems (Anteil der Höhe)
  sighEverySec: 7,        // leiser Atemlaut im Abstand (Sekunden)
});

// Dämmerlicht beim Schlafen (Abdunklung, Anteil bei voller Tiefe). Die echte Tageszeit kommt in Phase 32.
export const SLEEP_LIGHT = freeze({
  hemi: 0.45,             // Hemisphärenlicht um diesen Anteil dunkler
  key: 0.55,              // Hauptlicht
  core: 0.3,              // Punktlicht des Habitats
});

// Zzz über dem Kopf (kleine Sprites). Bei „reduzierte Bewegung“ steht nur ein einzelnes z still.
export const SLEEP_ZZZ = freeze({
  count: 3,
  riseSec: 3.4,           // Dauer, bis ein z aufgestiegen und verblasst ist
  startY: 1.55,           // Starthöhe über dem Boden (Gruppen-Einheiten)
  height: 0.65,           // Aufstieg
  startX: 0.26,           // seitlich versetzt, damit es nicht den Kristall verdeckt
  sway: 0.08,             // seitliches Schwanken
  size: 0.2,              // Grundgröße, wächst beim Aufsteigen
  opacity: 0.85,
  color: '#cfd8ff',
});

export const SLEEP_UI = freeze({
  sleepLabel: 'Schlafen',
  wakeLabel: 'Wecken',
  sleepAria: 'Reson schlafen legen',
  wakeAria: 'Reson sanft wecken',
  moodWord: 'schläft',    // ersetzt in der Zeile „Stimmung: ...“, solange sie schläft
  status: freeze({
    going: 'Reson geht zum Schlafplatz.',
    goingAuto: 'Reson ist müde und geht zum Schlafplatz.',
    asleep: 'Reson schläft.',
    woke: 'Reson ist ausgeschlafen.',
    wokeEarly: 'Reson wurde sanft geweckt.',
    cancelled: 'Reson bleibt wach.',
    rested: 'Reson ist noch ausgeruht.',
    busy: 'Reson ist gerade beschäftigt.',
    waking: 'Reson wacht gerade auf.',
    nozone: 'Reson findet keinen Schlafplatz.',
  }),
});

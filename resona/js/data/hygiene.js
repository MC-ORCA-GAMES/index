/*
  Hygiene-Daten (Phase 16, Teil A). Nur Daten, keine Logik.
  Logik: js/systems/HygieneSystem.js (wann, wie lange, Wirkung auf den Wert `hygiene`).
  Umsetzung am Körper und in der Szene (Waschplatz, Seifenblasen, Schütteln): js/creature/Cleaning.js (Phase 16, Teil B).
  Knopf und Meldungen: js/ui/HygienePanel.js (Teil B). Die Zone `wash` („Waschplatz“) steht in CONFIG.habitat.zones.

  Alle Zahlen sind Startwerte (Vorschlag), NICHT balanciert, NICHT im Browser getestet.

  Grundgedanke „nicht frustrierend“:
  - Hygiene sinkt langsam (2,5 pro Stunde) und höchstens bis zum Komfortboden 20 (NEEDS.hygiene, Phase 09). Schmutz ist nie ein Notfall.
  - Waschen ist kurz (Sekunden), wirkt sofort und lässt sich nicht „falsch“ machen: zu frühes Waschen wird freundlich
    abgelehnt („noch sauber“), Abbrechen kostet nichts und behält die bisherige Wirkung.
  - Kein Mehrfach-Grinden: Der Glücksschub gibt es nur beim natürlichen Ende und nur, wenn vorher wirklich etwas zu waschen war.
  - Zeit: Waschen ist „verdichtet“ wie der Schlaf (Sekunden statt Stunden). Die Hygiene sinkt dagegen in Stunden,
    also ist Waschen im normalen Spiel selten nötig; der Knopf ist der Normalweg bis Phase 45 (Abwesenheit).
*/

const freeze = (o) => Object.freeze(o);

export const HYGIENE_RULES = freeze({
  autoBelow: 30,          // Hygiene darunter: Reson putzt sich von selbst (nur wenn sie gerade nichts anderes tut)
  requestBelow: 85,       // Ab hier darf der Spieler sie waschen; darüber ist sie „noch sauber“
  doneAt: 100,            // Hygiene, ab der das Waschen von selbst endet
  minWashSec: 3,          // so lange wäscht sie mindestens (außer der Spieler bricht ab)
  maxWashSec: 12,         // spätestens dann endet es (Sicherung)
  dwellSlackSec: 8,       // Zusatzzeit der Verhaltensaufgabe, damit Cleaning immer VOR dem Ende der Aufgabe beendet
  perSec: 12,             // Hygiene-Zuwachs pro Sekunde beim Waschen (von 20 auf 100 in ca. 7 s)
  doneHappiness: 1.5,     // kleiner Glücksschub beim natürlichen Ende („frisch gewaschen“)
  minGainForBonus: 10,    // Glücksschub nur, wenn die Hygiene beim Start mindestens so weit unter doneAt lag
  cooldownSec: 90,        // nach Abbrechen/Stoppen putzt sie sich so lange nicht von selbst wieder
  standOff: 0.15,         // Abstand zur Mitte des Waschplatzes (sie steht auf dem Platz)
});

export const HYGIENE_UI = freeze({
  washLabel: 'Waschen',
  stopLabel: 'Fertig',
  washAria: 'Reson waschen',
  stopAria: 'Waschen beenden',
  moodWord: 'wird gewaschen',   // ersetzt in der Zeile „Stimmung: ...“, solange sie gewaschen wird
  status: freeze({
    going: 'Reson geht zum Waschplatz.',
    goingAuto: 'Reson möchte sich putzen und geht zum Waschplatz.',
    washing: 'Reson wird gewaschen.',
    done: 'Reson ist frisch und sauber.',
    stopped: 'Reson ist für jetzt fertig.',
    cancelled: 'Reson bleibt, wo sie ist.',
    clean: 'Reson ist noch sauber.',
    asleep: 'Reson schläft gerade.',
    busy: 'Reson ist gerade beschäftigt.',
    nozone: 'Reson findet keinen Waschplatz.',
  }),
});

// Wasch-Animation am Körper (Phase 16, Teil B), bei voller Tiefe (1). Wird mit der Tiefe 0..1 überblendet.
// Alles wird auf die Werte ADDIERT, die IdleBehavior jeden Frame absolut setzt (nichts summiert sich über Frames). Winkel in rad.
export const HYGIENE_POSE = freeze({
  blendInSec: 0.5,        // Einblenden der Wasch-Bewegung nach dem Ankommen
  blendOutSec: 0.5,       // Ausblenden nach dem Ende
  scrubHz: 2.4,           // Schrubb-Wippen (Schwingungen pro Sekunde)
  bodyRoll: 0.07,         // seitliches Wippen des Rumpfes (Amplitude)
  headTilt: 0.12,         // Kopf wiegt leicht mit (gegenläufig zum Rumpf)
  finFlap: 0.22,          // Flossen planschen (Amplitude)
  shakeSec: 0.9,          // „Abschütteln“ nach dem natürlichen Ende
  shakeHz: 8,             // Schüttel-Frequenz
  shakeRoll: 0.16,        // Amplitude des Schüttelns (Rumpf)
  shakeHead: 0.2,         // Amplitude des Schüttelns (Kopf)
  calmEndSec: 0.6,        // „reduzierte Bewegung“: kurze Pause statt Schütteln
  stopEndSec: 0.3,        // Stoppen: kurzes Ausklingen, dann frei
});

// Seifenblasen um die Kreatur (kleine Sprites). Bei „reduzierte Bewegung“ stehen wenige Blasen still.
export const HYGIENE_BUBBLES = freeze({
  count: 9,
  calmCount: 4,
  riseSec: 2.4,           // Dauer, bis eine Blase aufgestiegen und geplatzt ist
  startY: 0.25,           // Starthöhe über dem Boden (Gruppen-Einheiten)
  height: 1.3,            // Aufstieg
  radius: 0.52,           // Abstand zur Mitte der Kreatur
  sway: 0.07,             // Schwanken
  size: 0.17,             // Grundgröße, wächst beim Aufsteigen
  opacity: 0.8,
  color: '#c9f4ff',
});


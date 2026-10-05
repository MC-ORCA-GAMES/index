/*
  SleepSystem – Schlaf der Kreatur (Phase 15). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Entscheidet nur, WANN geschlafen wird und WIE die Erholung läuft; Gehen, Hinlegen, Pose, Licht und Laute
  macht js/creature/Sleeping.js, Knopf und Meldungen js/ui/SleepPanel.js.

  Phasen:
    awake   wach (Standard)
    going   geht zum Schlafplatz (von Sleeping gesetzt, sobald die Aufgabe läuft)
    asleep  schläft: die Energie steigt pro Sekunde um SLEEP_RULES.energyPerSec

  Auslöser:
    automatisch  `shouldAutoSleep()`: Energie unter SLEEP_RULES.autoBelow, keine Pause nach dem Wecken
                 (die Prüfung, ob sie gerade frei ist, macht Sleeping)
    Spieler      `canRequest()`: nur wenn die Energie unter SLEEP_RULES.requestBelow liegt, sonst „noch ausgeruht“
  Aufwachen:
    natürlich    `shouldWake()`: mindestens minSleepSec geschlafen UND Energie >= wakeAt, oder maxSleepSec erreicht;
                 gibt einen kleinen Glücksschub (SLEEP_RULES.wakeHappiness)
    geweckt      `wake({ natural: false })`: kein Schub, aber auch keine Strafe; danach napCooldownSec Pause,
                 in der sie sich nicht von selbst wieder hinlegt (gilt auch beim Abbrechen des Weges)

  Zeit: `update(dt)` pro Frame (nur Laufzeit). Offline-Zeit und Schlaf in der Abwesenheit rechnet Phase 45 nach.
  Nichts wird bestraft: kein Wert sinkt durch Schlaf, Wecken kostet nichts.

  createSleepSystem({ needs }) ->
    {
      update(dt), getPhase(), isAsleep(), getSleptSec(), getCooldown(),
      canRequest() -> { ok, reason },       reason: 'asleep' | 'rested' | null
      shouldAutoSleep(), shouldWake(),
      start(reason), arrived(), cancel(), wake({ natural }),
      onEvent(fn), getStats(), serialize(), restore(data), reset()
    }
  Ereignisse: { type: 'start' | 'asleep' | 'wake' | 'cancelled', ... }
    start: { reason: 'player' | 'auto' }, wake: { natural, sleptSec }
  Werte in js/data/sleep.js (SLEEP_RULES), NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { SLEEP_RULES } from '../data/sleep.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const SLEEP_SAVE_VERSION = 1;

export function createSleepSystem({ needs }) {
  const R = SLEEP_RULES;
  const listeners = new Set();

  let phase = 'awake';
  let sleptSec = 0;       // Dauer des laufenden Schlafs
  let cooldown = 0;       // Sekunden, in denen sie sich nicht von selbst hinlegt
  let sleeps = 0;         // Anzahl begonnener Schlafphasen (Statistik, für spätere Phasen)
  let totalSleepSec = 0;  // gesamte Schlafzeit (Statistik)

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Abfragen ----------
  function canRequest() {
    if (phase !== 'awake') return { ok: false, reason: 'asleep' };
    if (needs.get('energy') >= R.requestBelow) return { ok: false, reason: 'rested' };
    return { ok: true, reason: null };
  }

  function shouldAutoSleep() {
    return phase === 'awake' && cooldown <= 0 && needs.get('energy') < R.autoBelow;
  }

  function shouldWake() {
    if (phase !== 'asleep') return false;
    if (sleptSec >= R.maxSleepSec) return true;
    return sleptSec >= R.minSleepSec && needs.get('energy') >= R.wakeAt;
  }

  // ---------- Übergänge ----------
  /** Beginnt den Weg zum Schlafplatz. reason: 'player' | 'auto'. */
  function start(reason = 'player') {
    if (phase !== 'awake') return false;
    phase = 'going';
    emit({ type: 'start', reason });
    return true;
  }

  /** Am Schlafplatz angekommen: ab jetzt schläft sie. */
  function arrived() {
    if (phase !== 'going') return false;
    phase = 'asleep';
    sleptSec = 0;
    sleeps += 1;
    emit({ type: 'asleep' });
    return true;
  }

  /** Der Weg wird abgebrochen (Spieler oder von außen ersetzt). Kurze Pause, damit sie nicht sofort neu startet. */
  function cancel() {
    if (phase !== 'going') return false;
    phase = 'awake';
    cooldown = R.napCooldownSec;
    emit({ type: 'cancelled' });
    return true;
  }

  /** Aufwachen. natural: true = ausgeschlafen (kleiner Glücksschub), false = geweckt (kurze Pause, keine Strafe). */
  function wake({ natural = false } = {}) {
    if (phase !== 'asleep') return false;
    phase = 'awake';
    if (natural) needs.adjust('happiness', R.wakeHappiness);
    else cooldown = R.napCooldownSec;
    emit({ type: 'wake', natural: !!natural, sleptSec });
    return true;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
    if (phase === 'asleep') {
      sleptSec += dt;
      totalSleepSec += dt;
      needs.adjust('energy', R.energyPerSec * dt);
    }
  }

  // ---------- Statistik, Speichern (für Phase 44) ----------
  function getStats() { return { sleeps, totalSleepSec }; }

  function serialize() {
    return { version: SLEEP_SAVE_VERSION, sleeps, totalSleepSec: Math.round(totalSleepSec) };
  }

  /** Stellt die Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Der Schlaf selbst wird nicht gespeichert. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== SLEEP_SAVE_VERSION) return false;
    if (Number.isFinite(data.sleeps) && data.sleeps >= 0) sleeps = Math.floor(data.sleeps);
    if (Number.isFinite(data.totalSleepSec) && data.totalSleepSec >= 0) totalSleepSec = data.totalSleepSec;
    return true;
  }

  function reset() {
    phase = 'awake';
    sleptSec = 0;
    cooldown = 0;
    sleeps = 0;
    totalSleepSec = 0;
  }

  return {
    update,
    getPhase: () => phase,
    isAsleep: () => phase === 'asleep',
    getSleptSec: () => sleptSec,
    getCooldown: () => cooldown,
    canRequest, shouldAutoSleep, shouldWake,
    start, arrived, cancel, wake,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getStats, serialize, restore, reset,
  };
}

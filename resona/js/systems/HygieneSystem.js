/*
  HygieneSystem – Waschen und Putzen der Kreatur (Phase 16, Teil A). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Entscheidet nur, WANN gewaschen wird und WIE der Wert `hygiene` steigt; Gehen zum Waschplatz, Animation, Seifenblasen
  und Laute macht js/creature/Cleaning.js, Knopf und Meldungen js/ui/HygienePanel.js (beides Phase 16, Teil B).
  Aufbau und Schnittstelle folgen bewusst dem SleepSystem (Phase 15).

  Phasen:
    idle      nichts zu tun (Standard)
    going     geht zum Waschplatz (von Cleaning gesetzt, sobald die Aufgabe läuft)
    washing   wird gewaschen: `hygiene` steigt pro Sekunde um HYGIENE_RULES.perSec

  Auslöser:
    automatisch  `shouldAutoClean()`: Hygiene unter HYGIENE_RULES.autoBelow, keine Pause nach Abbruch
                 (die Prüfung, ob sie gerade frei ist, macht Cleaning)
    Spieler      `canRequest()`: nur wenn die Hygiene unter HYGIENE_RULES.requestBelow liegt, sonst „noch sauber“
  Ende:
    natürlich    `shouldFinish()`: mindestens minWashSec gewaschen UND Hygiene >= doneAt, oder maxWashSec erreicht;
                 `stop({ natural: true })` gibt einen kleinen Glücksschub (doneHappiness), aber nur, wenn beim Start
                 mindestens minGainForBonus zu waschen war (kein Grinden)
    gestoppt     `stop({ natural: false })`: kein Schub, keine Strafe, die bisherige Wirkung bleibt; danach cooldownSec
                 Pause, in der sie sich nicht von selbst wieder putzt (gilt auch beim Abbrechen des Weges)

  Zeit: `update(dt)` pro Frame (nur Laufzeit). Offline-Zeit und Waschen in der Abwesenheit rechnet Phase 45 nach.
  Nichts wird bestraft: kein Wert sinkt durch Waschen, Abbrechen kostet nichts.

  createHygieneSystem({ needs }) ->
    {
      update(dt), getPhase(), isWashing(), getWashedSec(), getCooldown(),
      canRequest() -> { ok, reason },       reason: 'busy' | 'clean' | null
      shouldAutoClean(), shouldFinish(),
      start(reason), arrived(), cancel(), stop({ natural }),
      onEvent(fn), getStats(), serialize(), restore(data), reset()
    }
  Ereignisse: { type: 'start' | 'washing' | 'done' | 'cancelled', ... }
    start: { reason: 'player' | 'auto' }, done: { natural, washedSec, gained }
  Werte in js/data/hygiene.js (HYGIENE_RULES), NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { HYGIENE_RULES } from '../data/hygiene.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const HYGIENE_SAVE_VERSION = 1;

export function createHygieneSystem({ needs }) {
  const R = HYGIENE_RULES;
  const listeners = new Set();

  let phase = 'idle';
  let washedSec = 0;       // Dauer des laufenden Waschens
  let startValue = 0;      // Hygiene beim Beginn des Waschens (für Gewinn und Glücksschub)
  let cooldown = 0;        // Sekunden, in denen sie sich nicht von selbst putzt
  let washes = 0;          // Anzahl begonnener Wäschen (Statistik, für spätere Phasen)
  let totalWashSec = 0;    // gesamte Waschzeit (Statistik)

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Abfragen ----------
  function canRequest() {
    if (phase !== 'idle') return { ok: false, reason: 'busy' };
    if (needs.get('hygiene') >= R.requestBelow) return { ok: false, reason: 'clean' };
    return { ok: true, reason: null };
  }

  function shouldAutoClean() {
    return phase === 'idle' && cooldown <= 0 && needs.get('hygiene') < R.autoBelow;
  }

  function shouldFinish() {
    if (phase !== 'washing') return false;
    if (washedSec >= R.maxWashSec) return true;
    return washedSec >= R.minWashSec && needs.get('hygiene') >= R.doneAt;
  }

  // ---------- Übergänge ----------
  /** Beginnt den Weg zum Waschplatz. reason: 'player' | 'auto'. */
  function start(reason = 'player') {
    if (phase !== 'idle') return false;
    phase = 'going';
    emit({ type: 'start', reason });
    return true;
  }

  /** Am Waschplatz angekommen: ab jetzt wird gewaschen. */
  function arrived() {
    if (phase !== 'going') return false;
    phase = 'washing';
    washedSec = 0;
    startValue = needs.get('hygiene');
    washes += 1;
    emit({ type: 'washing' });
    return true;
  }

  /** Der Weg wird abgebrochen (Spieler oder von außen ersetzt). Kurze Pause, damit sie nicht sofort neu startet. */
  function cancel() {
    if (phase !== 'going') return false;
    phase = 'idle';
    cooldown = R.cooldownSec;
    emit({ type: 'cancelled' });
    return true;
  }

  /** Ende des Waschens. natural: true = fertig (kleiner Glücksschub bei echtem Bedarf), false = gestoppt (kurze Pause, keine Strafe). */
  function stop({ natural = false } = {}) {
    if (phase !== 'washing') return false;
    phase = 'idle';
    const gained = Math.max(0, needs.get('hygiene') - startValue);
    if (natural && R.doneAt - startValue >= R.minGainForBonus) needs.adjust('happiness', R.doneHappiness);
    if (!natural) cooldown = R.cooldownSec;
    emit({ type: 'done', natural: !!natural, washedSec, gained });
    return true;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
    if (phase === 'washing') {
      washedSec += dt;
      totalWashSec += dt;
      needs.adjust('hygiene', R.perSec * dt);
    }
  }

  // ---------- Statistik, Speichern (für Phase 44) ----------
  function getStats() { return { washes, totalWashSec }; }

  function serialize() {
    return { version: HYGIENE_SAVE_VERSION, washes, totalWashSec: Math.round(totalWashSec) };
  }

  /** Stellt die Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Das Waschen selbst wird nicht gespeichert. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== HYGIENE_SAVE_VERSION) return false;
    if (Number.isFinite(data.washes) && data.washes >= 0) washes = Math.floor(data.washes);
    if (Number.isFinite(data.totalWashSec) && data.totalWashSec >= 0) totalWashSec = data.totalWashSec;
    return true;
  }

  function reset() {
    phase = 'idle';
    washedSec = 0;
    startValue = 0;
    cooldown = 0;
    washes = 0;
    totalWashSec = 0;
  }

  return {
    update,
    getPhase: () => phase,
    isWashing: () => phase === 'washing',
    getWashedSec: () => washedSec,
    getCooldown: () => cooldown,
    canRequest, shouldAutoClean, shouldFinish,
    start, arrived, cancel, stop,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getStats, serialize, restore, reset,
  };
}

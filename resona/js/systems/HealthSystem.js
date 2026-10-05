/*
  HealthSystem – Gesundheitszustand und Pflege-Schub (Phase 17). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Setzt auf dem Wert `health` des NeedSystem auf (Rechnung seit Phase 09: Mittel aus Sättigung/Energie/Hygiene steigt oder sinkt ihn
  langsam, Komfortboden 35) und ändert diese Rechnung nicht. Neu ist:
    Zustand   `fit` oder `weak` („schlapp“) mit Abstand zwischen Eintritt und Austritt (HEALTH_RULES.weakBelow / recoveredAt),
              damit er nicht flackert. Ereignis `change` für Meldungen.
    Hinweis   `getHint()` nennt freundlich, was ihr guttäte (der niedrigste Pflegewert unter HEALTH_RULES.hintBelow), sonst allgemein.
    Erholung  `noteCare(kind)` gibt nach einer Pflegehandlung (füttern, ausschlafen, waschen) sofort einen kleinen Schub auf `health`,
              solange sie unter HEALTH_RULES.boostBelow liegt, mit Pause je Art (kein Grinden). So ist Erholung auch in kurzen
              Besuchen sichtbar, nicht erst nach Stunden.
  Nichts wird bestraft: das System zieht nie etwas ab und sperrt kein Verhalten.
  Körperlich sichtbar wird der Zustand über die Emotion `unwell` („angeschlagen“, EmotionSystem), nicht über eigenen Code am Körper.

  Zeit: `update(dt)` pro Frame (nur Laufzeit). Gesundheit in der Abwesenheit rechnet Phase 45 über `needs.advance` nach.

  createHealthSystem({ needs }) ->
    {
      update(dt), getStatus() -> 'fit' | 'weak', isWeak(), getHint() -> 'hunger' | 'energy' | 'hygiene' | 'general',
      noteCare(kind) -> Punkte (0, wenn kein Schub), onChange(fn({ status, prev })), getStats(), serialize(), restore(data), reset()
    }
    kind: 'feed' | 'sleep' | 'sleepEarly' | 'wash' | 'washEarly' (Schlüssel von HEALTH_RULES.boost)
  Werte in js/data/health.js (HEALTH_RULES), NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { HEALTH_RULES } from '../data/health.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const HEALTH_SAVE_VERSION = 1;

export function createHealthSystem({ needs }) {
  const R = HEALTH_RULES;
  const listeners = new Set();

  let status = needs.get('health') < R.weakBelow ? 'weak' : 'fit';
  const cooldown = {};     // kind -> Restsekunden bis zum nächsten Schub
  let weakSpells = 0;      // Anzahl der Phasen, in denen sie schlapp war (Statistik, für spätere Phasen)
  let recoveries = 0;      // Anzahl der Erholungen (Statistik)
  let boosts = 0;          // Anzahl gegebener Pflege-Schübe (Statistik)

  function emit(event) { for (const fn of listeners) fn(event); }

  function update(dt) {
    if (!(dt > 0)) return;
    for (const k of Object.keys(cooldown)) {
      cooldown[k] = Math.max(0, cooldown[k] - dt);
      if (cooldown[k] === 0) delete cooldown[k];
    }
    const h = needs.get('health');
    let next = status;
    if (status === 'fit' && h < R.weakBelow) next = 'weak';
    else if (status === 'weak' && h >= R.recoveredAt) next = 'fit';
    if (next !== status) {
      const prev = status;
      status = next;
      if (next === 'weak') weakSpells += 1; else recoveries += 1;
      emit({ status, prev });
    }
  }

  /** Was ihr gerade guttäte: der niedrigste Pflegewert unter hintBelow, sonst 'general'. */
  function getHint() {
    let best = null;
    let bestValue = R.hintBelow;
    for (const id of R.hintNeeds) {
      const v = needs.get(id);
      if (v < bestValue) { best = id; bestValue = v; }
    }
    return best || 'general';
  }

  /** Pflegehandlung gelang: kleiner Schub auf `health`. Gibt die gegebenen Punkte zurück (0 = kein Schub). */
  function noteCare(kind) {
    const amount = R.boost[kind];
    if (!(amount > 0)) return 0;
    if (cooldown[kind] > 0) return 0;
    if (needs.get('health') >= R.boostBelow) return 0;
    cooldown[kind] = R.boostCooldownSec;
    needs.adjust('health', amount);
    boosts += 1;
    return amount;
  }

  function getStats() { return { weakSpells, recoveries, boosts }; }

  function serialize() {
    return { version: HEALTH_SAVE_VERSION, weakSpells, recoveries, boosts };
  }

  /** Stellt die Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Zustand und Pausen werden aus `health` neu abgeleitet. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== HEALTH_SAVE_VERSION) return false;
    if (Number.isFinite(data.weakSpells) && data.weakSpells >= 0) weakSpells = Math.floor(data.weakSpells);
    if (Number.isFinite(data.recoveries) && data.recoveries >= 0) recoveries = Math.floor(data.recoveries);
    if (Number.isFinite(data.boosts) && data.boosts >= 0) boosts = Math.floor(data.boosts);
    status = needs.get('health') < R.weakBelow ? 'weak' : 'fit';
    return true;
  }

  function reset() {
    for (const k of Object.keys(cooldown)) delete cooldown[k];
    weakSpells = 0;
    recoveries = 0;
    boosts = 0;
    status = needs.get('health') < R.weakBelow ? 'weak' : 'fit';
  }

  return {
    update,
    getStatus: () => status,
    isWeak: () => status === 'weak',
    getHint, noteCare,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getStats, serialize, restore, reset,
  };
}

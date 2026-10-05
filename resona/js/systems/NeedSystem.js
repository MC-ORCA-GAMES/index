/*
  NeedSystem – die Grundbedürfnisse der Kreatur (Phase 09).
  Sieben Werte (Hunger, Energie, Hygiene, Glück, Gesundheit, Bindung, Neugier), alle 0..100, 100 = gut.
  Definitionen und Zahlen stehen als Daten in js/data/needs.js, hier steht nur die Logik.

  Wie sich die Werte ändern (alles langsam, in Stunden):
    Hunger, Energie, Hygiene, Neugier   sinken gleichmäßig, aber nie unter ihren Komfortboden (`floor`)
    Glück       nähert sich sanft dem gewichteten Mittel der anderen Werte (folgt ihnen), Stöße durch
                Ereignisse klingen dadurch wieder ab
    Gesundheit  reagiert nur auf langfristige Pflege: steigt bei guter Pflege schneller, als sie bei
                schlechter sinkt, und fällt nie unter ihren Komfortboden
    Bindung     sinkt nie von selbst, wächst nur durch Ereignisse (z. B. Antippen)
  Es gibt keine Bestrafung: kein Wert erreicht einen Zustand, aus dem es keine Erholung gäbe.

  Zeit: `update(dt)` läuft pro Frame mit echten Sekunden. Der Tab pausiert die Engine, wenn er versteckt
  ist; die dann vergangene Zeit rechnet erst Phase 45 (Offline-Zeit) nach, und zwar mit `advance(seconds)`.

  Noch NICHT angebunden (spätere Phasen): Anzeige (Phase 10), Futter (11), Schlaf (15), Hygiene-Aktion (16),
  Emotionen (13), Verhaltensgewichte (Behavior.chooseNext nutzt dann `get`/`getLevel`), Speichern (44).

  createNeedSystem({ rateScale }) ->
    {
      update(dt), advance(seconds),
      get(id), getAll(), getLevel(id), ids,
      adjust(id, delta), adjustMany(deltas), set(id, value), applyInteraction({ emotion, streak }),
      setRateScale(id, factor),
      serialize(), restore(data), reset(),
    }
  rateScale: optionale Faktoren pro Bedürfnis für die Abnahme (z. B. Energiebedarf der Kreatur, Phase 28).
  Werte in js/data/needs.js, NICHT im Browser getestet.
*/
import { NEEDS, NEED_IDS, NEED_RULES } from '../data/needs.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const NEED_SAVE_VERSION = 1;

const clamp100 = (v) => Math.min(100, Math.max(0, v));

export function createNeedSystem({ rateScale = {} } = {}) {
  const values = {};
  const scale = {};
  for (const id of NEED_IDS) {
    values[id] = NEEDS[id].start;
    scale[id] = Number.isFinite(rateScale[id]) && rateScale[id] >= 0 ? rateScale[id] : 1;
  }

  // ---------- Rechnen ----------
  /** Ein Rechenschritt von höchstens maxStepSec Sekunden. */
  function stepOnce(sec) {
    const hours = sec / 3600;

    // 1. gleichmäßige Abnahme bis zum Komfortboden
    for (const id of NEED_IDS) {
      const def = NEEDS[id];
      if (!(def.decayPerHour > 0)) continue;
      const v = values[id];
      if (v > def.floor) values[id] = Math.max(def.floor, v - def.decayPerHour * scale[id] * hours);
    }

    // 2. Glück zieht zum gewichteten Mittel der anderen Werte nach
    const hr = NEED_RULES.happiness;
    let sum = 0;
    let wsum = 0;
    for (const id of Object.keys(hr.weights)) {
      sum += values[id] * hr.weights[id];
      wsum += hr.weights[id];
    }
    if (wsum > 0) {
      const target = sum / wsum;
      const k = 1 - Math.exp(-hr.followPerHour * hours);
      const hFloor = NEEDS.happiness.floor;
      values.happiness = clamp100(Math.max(hFloor, values.happiness + (target - values.happiness) * k));
    }

    // 3. Gesundheit: langfristige Pflege
    const he = NEED_RULES.health;
    let care = 0;
    for (const id of he.careNeeds) care += values[id];
    care /= he.careNeeds.length;
    if (care >= he.goodAbove) {
      values.health = clamp100(values.health + he.recoverPerHour * hours);
    } else if (care < he.poorBelow) {
      const hFloor = NEEDS.health.floor;
      if (values.health > hFloor) values.health = Math.max(hFloor, values.health - he.drainPerHour * hours);
    }
  }

  /** Lässt `seconds` Sekunden Spielzeit vergehen (große Sprünge werden in Schritte zerlegt). */
  function advance(seconds) {
    if (!(seconds > 0) || !Number.isFinite(seconds)) return;
    let left = seconds;
    while (left > 0) {
      const step = Math.min(left, NEED_RULES.maxStepSec);
      stepOnce(step);
      left -= step;
    }
  }

  function update(dt) { advance(dt); }

  // ---------- Lesen ----------
  function get(id) { return id in values ? values[id] : undefined; }

  /** Kopie aller Werte { hunger: 80, ... }. */
  function getAll() { return { ...values }; }

  /** 'good' | 'ok' | 'low' nach NEED_RULES.levels. */
  function getLevel(id) {
    const v = values[id];
    if (v === undefined) return undefined;
    if (v >= NEED_RULES.levels.good) return 'good';
    if (v < NEED_RULES.levels.low) return 'low';
    return 'ok';
  }

  // ---------- Ändern ----------
  /**
   * Verändert einen Wert um `delta` (positiv oder negativ). Negative Änderungen führen nie unter den
   * Komfortboden (stand der Wert schon darunter, etwa nach set(), bleibt er unverändert).
   * Gibt den neuen Wert zurück, bei unbekanntem Bedürfnis oder ungültigem delta undefined.
   */
  function adjust(id, delta) {
    if (!(id in values) || !Number.isFinite(delta)) return undefined;
    const cur = values[id];
    let next = clamp100(cur + delta);
    if (delta < 0) next = Math.max(next, Math.min(cur, NEEDS[id].floor));
    values[id] = next;
    return next;
  }

  /** adjustMany({ happiness: 2, bond: 0.5 }) */
  function adjustMany(deltas) {
    if (!deltas) return;
    for (const id of Object.keys(deltas)) adjust(id, deltas[id]);
  }

  /** Setzt einen Wert direkt (0..100). Für Debug (Phase 48), ohne Komfortboden. */
  function set(id, value) {
    if (!(id in values) || !Number.isFinite(value)) return false;
    values[id] = clamp100(value);
    return true;
  }

  /**
   * Wirkung einer Reaktion auf Antippen (Ereignis von Interaction.onReaction).
   * Nur die ersten Taps einer Serie wirken (NEED_RULES.interaction.maxEffectStreak). Nur Ereignisse mit source 'tap'.
   */
  function applyInteraction(event) {
    if (!event) return;
    if (event.source && event.source !== 'tap') return;   // z. B. Reaktion nach dem Füttern (Phase 11): Futter wirkt selbst
    const rule = NEED_RULES.interaction;
    if (event.streak > rule.maxEffectStreak) return;
    adjustMany(rule.effects[event.emotion]);
  }

  /** Abnahme-Faktor eines Bedürfnisses ändern (z. B. Energiebedarf der Kreatur, Phase 28). */
  function setRateScale(id, factor) {
    if (!(id in scale) || !Number.isFinite(factor) || factor < 0) return false;
    scale[id] = factor;
    return true;
  }

  function reset() {
    for (const id of NEED_IDS) values[id] = NEEDS[id].start;
  }

  // ---------- Speichern (für Phase 44) ----------
  function serialize() {
    return { version: NEED_SAVE_VERSION, values: { ...values } };
  }

  /**
   * Stellt Werte aus serialize() wieder her. Unbekannte Schlüssel werden ignoriert, fehlende behalten ihren
   * Startwert, ungültige Zahlen werden übersprungen. Gibt false zurück, wenn das Format nicht passt.
   */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== NEED_SAVE_VERSION) return false;
    if (!data.values || typeof data.values !== 'object') return false;
    for (const id of NEED_IDS) {
      const v = data.values[id];
      if (Number.isFinite(v)) values[id] = clamp100(v);
    }
    return true;
  }

  return {
    update, advance,
    get, getAll, getLevel, ids: NEED_IDS,
    adjust, adjustMany, set, applyInteraction, setRateScale,
    serialize, restore, reset,
  };
}

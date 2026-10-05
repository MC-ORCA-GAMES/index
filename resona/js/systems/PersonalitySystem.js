/*
  PersonalitySystem – Persönlichkeit der Kreatur (Phase 12). Reine Logik, kein Three.js, kein DOM.

  Pro Kreatur eine feste Mischung aus 3–5 Zügen (Daten: js/data/personality.js), aus dem Seed erzeugt
  (createRng): zwei Züge dominant (Gewicht 1), die übrigen leicht (Gewicht 0.3–0.6). Widersprüchliche
  Züge (OPPOSITES) kommen nicht zusammen vor, wenn einer davon dominant ist.

  Die Persönlichkeit ändert sich nicht von selbst. Sie wirkt über getModifier(gruppe, schlüssel):
  das Produkt der Zug-Faktoren (1 + Gewicht * (Multiplikator - 1)), begrenzt auf PERSONALITY_RULES.modifierClamp.
  Behavior und Interaction fragen damit ab; ohne Persönlichkeit bleibt alles bei Faktor 1.

  createPersonalitySystem({ seed }) ->
    { getTraits(), getDominant(), has(id), getWeight(id), getModifier(group, key), describe(),
      serialize(), restore(data), reset(), setHints(list), getHints() }
  Speicherformat: { version: 1, seed, traits: [{ id, weight, dominant }] } (Phase 44).
  NICHT im Browser getestet, die Zahlen sind Startwerte.
*/
import { createRng } from '../core/rng.js';
import { TRAITS, TRAIT_IDS, OPPOSITES, PERSONALITY_RULES, PERSONALITY_UI } from '../data/personality.js';

const VERSION = 1;

function areOpposite(a, b) {
  return OPPOSITES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Erzeugt die Zugmischung aus dem Seed. Gibt [{ id, weight, dominant }] zurück (dominante zuerst). */
function generate(seed) {
  const rules = PERSONALITY_RULES;
  const rng = createRng(seed);

  const count = rules.traitCount.min + Math.floor(rng() * (rules.traitCount.max - rules.traitCount.min + 1));

  const pool = TRAIT_IDS.slice();            // Fisher-Yates-Mischung
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const dominant = [];
  for (const id of pool) {
    if (dominant.length >= rules.dominantCount) break;
    if (dominant.some((d) => areOpposite(d, id))) continue;
    dominant.push(id);
  }

  const minor = [];
  for (const id of pool) {
    if (dominant.length + minor.length >= count) break;
    if (dominant.includes(id)) continue;
    if (dominant.some((d) => areOpposite(d, id))) continue;
    minor.push(id);
  }

  const { min, max } = rules.minorWeight;
  const traits = dominant.map((id) => ({ id, weight: rules.dominantWeight, dominant: true }));
  for (const id of minor) {
    const weight = Math.round((min + (max - min) * rng()) * 100) / 100;
    traits.push({ id, weight, dominant: false });
  }
  return traits;
}

export function createPersonalitySystem({ seed = 12012 } = {}) {
  let traits = generate(seed);
  let hints = [];   // Phase 28 Teil B: leise, verborgene Züge { id, weight <= 0,15 }; wirken nur in getModifier, erscheinen nie in getTraits/describe/Evolution

  const clampMod = (v) => Math.max(PERSONALITY_RULES.modifierClamp.min, Math.min(PERSONALITY_RULES.modifierClamp.max, v));

  function getModifier(group, key) {
    let factor = 1;
    for (const t of traits) {
      const m = TRAITS[t.id][group] && TRAITS[t.id][group][key];
      if (m === undefined) continue;
      factor *= 1 + t.weight * (m - 1);
    }
    for (const h of hints) {
      const m = TRAITS[h.id][group] && TRAITS[h.id][group][key];
      if (m === undefined) continue;
      factor *= 1 + h.weight * (m - 1);
    }
    return clampMod(factor);
  }

  /** Phase 28 Teil B: leise Züge setzen (von HiddenTraitSystem). Unbekannte Züge, doppelte und Züge der sichtbaren Mischung werden verworfen, Gewicht auf 0..0,15 begrenzt. */
  function setHints(list) {
    hints = [];
    if (!Array.isArray(list)) return;
    for (const h of list) {
      if (!h || !TRAITS[h.id] || !Number.isFinite(h.weight)) continue;
      if (traits.some((t) => t.id === h.id) || hints.some((x) => x.id === h.id)) continue;
      hints.push({ id: h.id, weight: Math.max(0, Math.min(0.15, h.weight)) });
    }
  }

  /** Text für die Oberfläche, z. B. „Neugierig und verspielt · leicht schüchtern, vorsichtig“. Ohne Zahlen. */
  function describe() {
    const dom = traits.filter((t) => t.dominant).map((t) => TRAITS[t.id].label);
    const min = traits.filter((t) => !t.dominant).map((t) => TRAITS[t.id].label);
    let text = dom.join(PERSONALITY_UI.joiner);
    if (min.length) text += ' \u00B7 ' + PERSONALITY_UI.minorPrefix + min.join(', ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function serialize() {
    return { version: VERSION, seed, traits: traits.map((t) => ({ ...t })) };
  }

  /** Lädt gespeicherte Daten. Unbekannte Züge werden verworfen. Gibt false zurück, wenn nichts Brauchbares da ist. */
  function restore(data) {
    if (!data || data.version !== VERSION || !Array.isArray(data.traits)) return false;
    const valid = [];
    for (const t of data.traits) {
      if (!t || !TRAITS[t.id] || typeof t.weight !== 'number' || !Number.isFinite(t.weight)) continue;
      if (valid.some((v) => v.id === t.id)) continue;
      valid.push({ id: t.id, weight: Math.max(0, Math.min(1, t.weight)), dominant: !!t.dominant });
    }
    if (valid.length === 0) return false;
    traits = valid;
    if (typeof data.seed === 'number') seed = data.seed;
    return true;
  }

  /** Würfelt die Mischung neu aus dem aktuellen Seed (identisches Ergebnis). */
  function reset() { traits = generate(seed); hints = []; }

  return {
    getTraits: () => traits.map((t) => ({ ...t })),
    getDominant: () => traits.filter((t) => t.dominant).map((t) => t.id),
    has: (id) => traits.some((t) => t.id === id),
    getWeight: (id) => { const t = traits.find((x) => x.id === id); return t ? t.weight : 0; },
    getModifier, describe, serialize, restore, reset, setHints,
    getHints: () => hints.map((h) => ({ ...h })),
  };
}

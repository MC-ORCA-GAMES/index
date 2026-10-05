/*
  HiddenTraitSystem – verborgene Merkmale der Kreatur (Phase 28 Teil A, B und C). Reine Logik, kein Three.js, kein DOM.
  Die Werte entstehen aus dem Seed (createRng), sind danach fest und werden nie angezeigt. Daten und Fairness-Regeln: js/data/hiddenTraits.js.

  Wirkung (leise, eng begrenzt):
    energyNeed  -> `needs.setRateScale('energy', f)`: die Energie sinkt etwas schneller oder langsamer (0,85–1,2).            (Teil A)
    growth      -> `lifecycle.setGrowthTrait(f)`: die Lebensstufen vergehen etwas schneller oder langsamer (0,92–1,1).      (Teil A)
    hints       -> `personality.setHints(list)`: zwei ganz leise Züge (Gewicht 0,06–0,14), die NICHT zur sichtbaren Mischung gehören und nicht im
                   Gegensatz zu einem dominanten Zug stehen; sie färben nur die Entscheidungen (getModifier), nie die Anzeige.   (Teil B)
    evoLean     -> `evolution.setLean({ faktor: f })`: ein Punkt-Faktor wächst um 1,05–1,12 schneller (nie langsamer). Entscheidet keine Form. (Teil B)
    pigments    -> nur abrufbar: `getPigments()` -> { weights, primary, secondary }. Wie stark jede Farbe in der Kreatur steckt (0–1).     (Teil C)
                   KEIN Anschluss, keine Wirkung; Phase 29 (Farbentwicklung) liest es später.
    environment -> nur abrufbar: `getFavoriteEnvironment()` -> { area, decoration, time }. Drei verborgene Vorlieben.                 (Teil C)
                   KEIN Anschluss, keine Wirkung; Phase 30 (Bereich), 31 (Dekoration), 32 (Tageszeit) lesen es später.
  Ohne das jeweilige System passiert nichts. `apply()` setzt alles (mehrfach aufrufbar); `evolution` kommt später als die anderen und wird mit
  `attach({ evolution })` nachgereicht (spät gebunden).

  Die Ziehungen aus dem Seed haben eine feste Reihenfolge: erst die Zahlen aus `HIDDEN_TRAITS` (Teil A), dann Mischung der Züge, Gewichte, Faktor (Teil B),
  dann je eine Zahl pro Pigment in der Reihenfolge von `PIGMENT_IDS`, dann je eine Wahl pro Facette in der Reihenfolge von `ENVIRONMENT_KEYS` (Teil C).
  Neue Merkmale immer HINTEN anhängen, sonst ändern sich die Werte bestehender Kreaturen.

  createHiddenTraitSystem({ seed, needs, lifecycle, personality, evolution }) ->
    { get(id), getAll(), getHints(), getEvoLean(), getPigments(), getFavoriteEnvironment(), getSeed(), attach({ evolution }), apply(), serialize(), restore(data) -> bool, reset(newSeed), ids }
  `getAll()` bleibt bei den Zahlen aus Teil A (energyNeed, growth); Farbe und Umgebung haben eigene Abfragen.
  Speicherformat: { version: 3, seed, values: { energyNeed, growth }, hints: [{ id, weight }], evoLean: { factor, value },
                    pigments: { black, red, gold, orange, blue, violet, cyan }, environment: { area, decoration, time } } (Phase 44).
  Version 1 (nur Teil A) und 2 (A und B) werden beim Laden gelesen, Fehlendes kommt dann aus dem Seed. NICHT im Browser getestet, Zahlen sind Startwerte.
*/
import { createRng } from '../core/rng.js';
import { HIDDEN_TRAITS, HIDDEN_TRAIT_IDS, HIDDEN_RULES, PIGMENTS, PIGMENT_IDS, ENVIRONMENT, ENVIRONMENT_KEYS } from '../data/hiddenTraits.js';
import { TRAIT_IDS, OPPOSITES } from '../data/personality.js';
import { POINT_FACTORS } from '../data/evolution.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round3 = (v) => Math.round(v * 1000) / 1000;
const areOpposite = (a, b) => OPPOSITES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Erzeugt alle Merkmale aus dem Seed. Reihenfolge der Ziehungen siehe Kopf. `visible` = [{ id, dominant }] der sichtbaren Persönlichkeit (oder leer). */
function generate(seed, visible) {
  const rng = createRng(seed);
  const values = {};
  for (const id of HIDDEN_TRAIT_IDS) {
    const def = HIDDEN_TRAITS[id];
    let u = 0;
    for (let i = 0; i < def.spread; i++) u += rng();
    u /= def.spread;
    values[id] = def.range[0] + (def.range[1] - def.range[0]) * u;
  }
  // Teil B: Mischung aller Züge (Fisher-Yates), dann Gewichte, dann Faktor und Wert der Evolutionsneigung. Die Ziehungen geschehen immer, auch wenn Züge
  // übersprungen werden, damit die Reihenfolge fest bleibt.
  const pool = TRAIT_IDS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const H = HIDDEN_RULES.hints;
  const weights = [];
  for (let i = 0; i < H.count; i++) weights.push(H.weight[0] + (H.weight[1] - H.weight[0]) * rng());
  const factorIdx = Math.floor(rng() * POINT_FACTORS.length);
  const L = HIDDEN_RULES.evoLean.factor;
  const leanValue = L[0] + (L[1] - L[0]) * rng();
  // Teil C (immer ganz hinten, damit die Werte aus Teil A und B für jeden Seed gleich bleiben): Pigmente, dann Lieblingsumgebung.
  const pigments = {};
  for (const id of PIGMENT_IDS) {
    const r = PIGMENTS[id].range;
    pigments[id] = round3(r[0] + (r[1] - r[0]) * rng());
  }
  const environment = {};
  for (const key of ENVIRONMENT_KEYS) {
    const list = ENVIRONMENT[key];
    environment[key] = list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  }

  const dominant = visible.filter((v) => v.dominant).map((v) => v.id);
  const hints = [];
  for (const id of pool) {
    if (hints.length >= H.count) break;
    if (visible.some((v) => v.id === id)) continue;
    if (dominant.some((d) => areOpposite(d, id))) continue;
    hints.push({ id, weight: Math.round(weights[hints.length] * 1000) / 1000 });
  }
  return { values, hints, evoLean: { factor: POINT_FACTORS[factorIdx], value: round3(leanValue) }, pigments, environment };
}

/** Führende und zweite Farbe aus den Gewichten (bei Gleichstand gilt die Reihenfolge von `PIGMENT_IDS`). Wird bei jeder Abfrage berechnet, nicht gespeichert. */
function rankPigments(weights) {
  const ranked = PIGMENT_IDS.slice().sort((a, b) => (weights[b] - weights[a]) || (PIGMENT_IDS.indexOf(a) - PIGMENT_IDS.indexOf(b)));
  return { primary: ranked[0], secondary: ranked[1] };
}

export function createHiddenTraitSystem({ seed = 28028, needs = null, lifecycle = null, personality = null, evolution = null } = {}) {
  let curSeed = seed >>> 0;
  let evo = evolution;
  const visibleOf = () => (personality ? personality.getTraits().map((t) => ({ id: t.id, dominant: !!t.dominant })) : []);
  let state = generate(curSeed, visibleOf());

  function apply() {
    if (needs && typeof needs.setRateScale === 'function') needs.setRateScale(HIDDEN_RULES.energyNeedId, state.values.energyNeed);
    if (lifecycle && typeof lifecycle.setGrowthTrait === 'function') lifecycle.setGrowthTrait(state.values.growth);
    if (personality && typeof personality.setHints === 'function') personality.setHints(state.hints);
    if (evo && typeof evo.setLean === 'function') evo.setLean({ [state.evoLean.factor]: state.evoLean.value });
  }

  /** Reicht später entstandene Systeme nach (die Evolution entsteht nach den anderen) und setzt die Wirkung. */
  function attach({ evolution: e = null } = {}) {
    if (e) evo = e;
    apply();
  }

  function serialize() {
    return {
      version: HIDDEN_RULES.version, seed: curSeed, values: { ...state.values },
      hints: state.hints.map((h) => ({ ...h })), evoLean: { ...state.evoLean },
      pigments: { ...state.pigments }, environment: { ...state.environment },
    };
  }

  /** Stellt aus serialize() wieder her. Version 1 bis 3 gelten; Fehlendes oder Ungültiges wird aus dem Seed neu erzeugt, Werte werden begrenzt. */
  function restore(data) {
    if (!data || typeof data !== 'object' || (data.version !== 1 && data.version !== 2 && data.version !== 3) || !Number.isFinite(data.seed)) return false;
    curSeed = data.seed >>> 0;
    const fresh = generate(curSeed, visibleOf());
    const src = data.values && typeof data.values === 'object' ? data.values : {};
    const values = {};
    for (const id of HIDDEN_TRAIT_IDS) {
      const r = HIDDEN_TRAITS[id].range;
      values[id] = Number.isFinite(src[id]) ? clamp(src[id], r[0], r[1]) : fresh.values[id];
    }
    let hints = fresh.hints;
    if (Array.isArray(data.hints)) {
      const H = HIDDEN_RULES.hints;
      const seen = [];
      for (const h of data.hints) {
        if (!h || !TRAIT_IDS.includes(h.id) || !Number.isFinite(h.weight) || seen.some((x) => x.id === h.id)) continue;
        if (visibleOf().some((v) => v.id === h.id)) continue;
        seen.push({ id: h.id, weight: clamp(h.weight, H.weight[0], H.weight[1]) });
      }
      if (seen.length) hints = seen.slice(0, H.count);
    }
    let evoLean = fresh.evoLean;
    const el = data.evoLean;
    if (el && POINT_FACTORS.includes(el.factor) && Number.isFinite(el.value)) {
      const L = HIDDEN_RULES.evoLean.factor;
      evoLean = { factor: el.factor, value: clamp(el.value, L[0], L[1]) };
    }
    // Teil C: Pigmente (je Farbe begrenzt auf den Bereich) und Umgebung (nur bekannte Ids); Fehlendes oder Unbekanntes kommt aus dem Seed.
    const pigments = {};
    const pSrc = data.pigments && typeof data.pigments === 'object' ? data.pigments : {};
    for (const id of PIGMENT_IDS) {
      const r = PIGMENTS[id].range;
      pigments[id] = Number.isFinite(pSrc[id]) ? round3(clamp(pSrc[id], r[0], r[1])) : fresh.pigments[id];
    }
    const environment = {};
    const eSrc = data.environment && typeof data.environment === 'object' ? data.environment : {};
    for (const key of ENVIRONMENT_KEYS) environment[key] = ENVIRONMENT[key].includes(eSrc[key]) ? eSrc[key] : fresh.environment[key];
    state = { values, hints, evoLean, pigments, environment };
    apply();
    return true;
  }

  function reset(newSeed = curSeed) {
    curSeed = newSeed >>> 0;
    state = generate(curSeed, visibleOf());
    apply();
  }

  apply();
  return {
    get: (id) => (id in state.values ? state.values[id] : null),
    getAll: () => ({ ...state.values }),
    getHints: () => state.hints.map((h) => ({ ...h })),
    getEvoLean: () => ({ ...state.evoLean }),
    /** Teil C: wie stark jede Farbe steckt (0–1) und welche zwei führen. Nur zum Lesen; sichtbar erst ab Phase 29. */
    getPigments: () => ({ weights: { ...state.pigments }, ...rankPigments(state.pigments) }),
    /** Teil C: verborgene Vorlieben { area, decoration, time }. Nur zum Lesen; sichtbar erst ab Phase 30–32. */
    getFavoriteEnvironment: () => ({ ...state.environment }),
    getSeed: () => curSeed,
    attach, apply, serialize, restore, reset,
    ids: HIDDEN_TRAIT_IDS,
  };
}

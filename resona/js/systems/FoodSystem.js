/*
  FoodSystem – Wirkung von Futter auf die Bedürfnisse, Geschmack und Vorlieben (Phase 11).
  Reine Logik: kein Three.js, kein DOM, kein Verhalten. Der Weg der Kreatur zum Futterplatz und das Fressen
  selbst stehen in js/creature/Feeding.js, Zahlen und Futterarten in js/data/foods.js.

  Geschmack und Vorlieben:
    Jede Kreatur ordnet die vier Geschmacksrichtungen (FOOD_TASTES) aus ihrem Seed in Stufen
    loves > likes > okay > meh. Die Stufe bestimmt einen kleinen Bonus auf Glück/Bindung und die Reaktion
    (Freude, Zufriedenheit, neugieriges „hm?"). „meh" heißt nur weniger Freude: das Futter sättigt trotzdem,
    es gibt nie einen Abzug. Der Seed ist vorerst fest (Phase 28 gibt später jeder Kreatur ihren eigenen).
    Welche Richtung beliebt ist, zeigt das Spiel nicht an; der Spieler findet es über die Reaktionen heraus.

  Ablehnen statt Überfüttern: ab `FOOD_RULES.refuseAbove` Sättigung frisst die Kreatur nichts und es passiert nichts.

  createFoodSystem({ needs, seed }) ->
    {
      canFeed(foodId) -> { ok, reason },                 reason: 'full' | 'unknown'
      eat(foodId) -> { ok, enjoyment, reaction, first, applied } | { ok: false, reason }
      getEnjoyment(foodId) -> 'loves'|'likes'|'okay'|'meh',  getTasteTiers() -> { sweet: 'loves', ... }
      getStats() -> { total, byFood },  getFavorite() -> foodId | null
      serialize(), restore(data), reset()
    }
  Format von serialize(): { version: 1, seed, total, byFood } (für Phase 44).
  Werte in js/data/foods.js, NICHT im Browser getestet.
*/
import { FOODS, FOOD_IDS, FOOD_TASTES, FOOD_RULES } from '../data/foods.js';
import { createRng } from '../core/rng.js';

export const FOOD_SAVE_VERSION = 1;

export function createFoodSystem({ needs, seed = 11011 } = {}) {
  let curSeed = seed >>> 0;
  let tiers = {};            // taste -> 'loves' | 'likes' | 'okay' | 'meh'
  let total = 0;
  let byFood = {};

  function deriveTiers() {
    const rng = createRng(curSeed);
    const order = FOOD_TASTES.slice();
    for (let i = order.length - 1; i > 0; i--) {       // Fisher-Yates aus dem Seed
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    tiers = {};
    order.forEach((taste, idx) => { tiers[taste] = FOOD_RULES.tiers[Math.min(idx, FOOD_RULES.tiers.length - 1)]; });
  }

  function resetCounts() {
    total = 0;
    byFood = {};
    for (const id of FOOD_IDS) byFood[id] = 0;
  }

  deriveTiers();
  resetCounts();

  function getEnjoyment(foodId) {
    const f = FOODS[foodId];
    return f ? tiers[f.taste] : undefined;
  }

  function canFeed(foodId) {
    if (!FOODS[foodId]) return { ok: false, reason: 'unknown' };
    if (needs.get('hunger') >= FOOD_RULES.refuseAbove) return { ok: false, reason: 'full' };
    return { ok: true, reason: null };
  }

  /** Wendet die Wirkung eines Futters an (Kreatur hat gegessen). Prüft canFeed erneut. */
  function eat(foodId) {
    const check = canFeed(foodId);
    if (!check.ok) return { ok: false, reason: check.reason };
    const f = FOODS[foodId];
    const enjoyment = getEnjoyment(foodId);
    const rule = FOOD_RULES.enjoyment[enjoyment];

    const applied = {
      hunger: f.hunger, energy: f.energy, health: f.health, happiness: f.happiness,
    };
    for (const k of Object.keys(rule.bonus)) applied[k] = (applied[k] || 0) + rule.bonus[k];
    needs.adjustMany(applied);

    const first = total === 0;
    total += 1;
    byFood[foodId] += 1;
    return { ok: true, enjoyment, reaction: rule.reaction, first, applied };
  }

  function getTasteTiers() { return { ...tiers }; }
  function getStats() { return { total, byFood: { ...byFood } }; }

  /** Am häufigsten gefressenes Futter (bei Gleichstand das beliebtere), null wenn noch nichts gefressen wurde. */
  function getFavorite() {
    let best = null;
    let bestScore = -1;
    for (const id of FOOD_IDS) {
      const n = byFood[id];
      if (n <= 0) continue;
      const rank = FOOD_RULES.tiers.length - FOOD_RULES.tiers.indexOf(getEnjoyment(id));
      const score = n * 10 + rank;
      if (score > bestScore) { best = id; bestScore = score; }
    }
    return best;
  }

  function serialize() {
    return { version: FOOD_SAVE_VERSION, seed: curSeed, total, byFood: { ...byFood } };
  }

  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== FOOD_SAVE_VERSION) return false;
    if (Number.isFinite(data.seed)) { curSeed = data.seed >>> 0; deriveTiers(); }
    resetCounts();
    if (data.byFood && typeof data.byFood === 'object') {
      for (const id of FOOD_IDS) {
        const n = data.byFood[id];
        if (Number.isFinite(n) && n > 0) byFood[id] = Math.floor(n);
      }
    }
    total = FOOD_IDS.reduce((sum, id) => sum + byFood[id], 0);
    return true;
  }

  function reset() { resetCounts(); }

  return { canFeed, eat, getEnjoyment, getTasteTiers, getStats, getFavorite, serialize, restore, reset };
}

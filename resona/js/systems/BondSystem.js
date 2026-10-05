/*
  BondSystem – langfristige Beziehung zwischen Spieler und Kreatur (Phase 14).
  Reine Logik: kein Three.js, kein DOM, kein Verhalten. Es SAMMELT und merkt sich, es steuert noch nichts
  (Erinnerungen sollen später das Verhalten beeinflussen, Master-Prompt Abschnitt 23).

  Gemerkt wird (Master-Prompt Phase 14):
    häufige Interaktionen   Zähler je Art der Zuwendung (BOND_KINDS: Antippen, Füttern, Spielen)
    Lieblingsfutter         abgeleitet aus FoodSystem (am häufigsten gefressen), ab `favoriteFoodMinMeals`
    Lieblingsspielzeug      Zähler je Spielzeug (`notePlay({ toyId })`, Spielzeuge kommen in Phase 18/19)
    Lieblingsplatz          Sekunden, die die Kreatur still in der Nähe einer Zonenmitte verbracht hat
    besondere Ereignisse    Erinnerungen (BOND_MEMORIES) mit Zeitstempel, jede nur einmal; Bindungsstufen
                            und `noteSpecial(id)` erzeugen `special_event`

  Der Bindungswert selbst bleibt im NeedSystem (`needs.get('bond')`, sinkt nie von selbst). Neu ist nur:
  jede neue Erinnerung gibt einmalig einen kleinen Schub auf `bond` (`BOND_MEMORIES[key].bond`), kein Grinden.
  Nichts hier bestraft: nichts sinkt, Wegbleiben ändert nichts (Aufenthaltszeit zählt nur Laufzeit).

  createBondSystem({ needs, food, zones, getPosition, isStill, getToyLabel, now }) ->
    {
      update(dt),                              Aufenthaltszeit je Zone, Favoriten, Bindungsstufen (alles gedrosselt)
      onReaction(event),                       Antippen (nur source 'tap' zählt), von interaction.onReaction
      onFeed(event),                           Füttern (nur type 'done' zählt), von feeding.onEvent
      notePlay({ toyId, solo }), noteSpecial(id), remember(key, data) -> Eintrag | null,
      hasMemory(key, id?), getMemories(), getLatestMemory(),
      getTier() -> Eintrag aus BOND_TIERS, getFavorites() -> { food, place, toy }, getFrequent() -> id | null,
      getSummary(), getRevision(), onMemory(fn(entry)) -> abmelden,
      serialize(), restore(data), reset()
    }
  zones: [{ id, label, x, z }] (aus main.js, die Zonenmitten in Weltkoordinaten); getPosition() -> { x, z };
  isStill() -> bool (Aufenthalt zählt nur im Stehen); getToyLabel(id) -> Text.
  Format von serialize(): { version: 1, counts, placeSec, toyUse, favoritePlace, favoriteToy, memories } (Phase 44).
  Der Lieblingsfutter-Zähler lebt im FoodSystem (eigenes serialize), hier steht nur die Erinnerung dazu.
  NICHT im Browser getestet, alle Zahlen in js/data/bond.js sind Startwerte.
*/
import { FOODS } from '../data/foods.js';
import {
  BOND_MEMORIES, BOND_SPECIAL, BOND_TIERS, BOND_KINDS, BOND_RULES,
} from '../data/bond.js';

export const BOND_SAVE_VERSION = 1;

const KIND_IDS = Object.keys(BOND_KINDS);
const TICK_SEC = 0.5;          // Favoriten und Stufen werden nur alle halbe Sekunde geprüft

function cleanId(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= BOND_RULES.maxIdLength ? v : null;
}

/** Kleine, serialisierbare Zusatzdaten: nur kurze Texte, Zahlen, Wahrheitswerte, höchstens sechs Felder. */
function cleanData(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  let n = 0;
  for (const k of Object.keys(data)) {
    if (n >= 6) break;
    const v = data[k];
    if (typeof v === 'string' && v.length <= BOND_RULES.maxIdLength) out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else continue;
    n += 1;
  }
  return out;
}

export function createBondSystem({
  needs, food = null, zones = [], getPosition = null, isStill = null,
  getToyLabel = (id) => id, now = () => Date.now(),
  getFormLabel = null, getEvolutionId = null,   // Phase 27 Teil B4: Name der Form für die Erinnerungen (spät gebunden, optional)
} = {}) {
  const R = BOND_RULES;
  const zoneById = new Map(zones.map((z) => [z.id, z]));

  let counts = {};
  let placeSec = {};
  let toyUse = {};
  let favoritePlace = null;
  let favoriteToy = null;
  let memories = [];
  let revision = 0;
  let tierIdx = -1;        // -1 = noch nicht abgeglichen (siehe syncTiers)
  let tickAcc = 0;
  let lastFrequent = null;
  let lastFavoriteFood = null;
  const listeners = new Set();

  function resetState() {
    counts = {};
    for (const id of KIND_IDS) counts[id] = 0;
    placeSec = {};
    for (const z of zones) placeSec[z.id] = 0;
    toyUse = {};
    favoritePlace = null;
    favoriteToy = null;
    memories = [];
    tierIdx = -1;
    tickAcc = 0;
    lastFrequent = null;
    lastFavoriteFood = null;
    revision += 1;
  }
  resetState();

  // ---------- Erinnerungen ----------
  function findMemory(key, id) {
    for (const m of memories) {
      if (m.key !== key) continue;
      if (id === undefined || (m.data && m.data.id === id)) return m;
    }
    return null;
  }

  function hasMemory(key, id) { return findMemory(key, id) !== null; }

  /**
   * Merkt ein Ereignis. Jede Erinnerung entsteht nur einmal (`special_event`: einmal pro data.id).
   * Gibt den Eintrag zurück oder null (unbekannter Schlüssel, schon vorhanden). Gibt einmalig einen kleinen
   * Schub auf den Bindungswert.
   */
  function remember(key, data = {}) {
    const def = BOND_MEMORIES[key];
    if (!def) return null;
    const clean = cleanData(data);
    if (key === 'special_event') {
      const id = cleanId(clean.id);
      if (!id) return null;
      if (hasMemory(key, id)) return null;
    } else if (hasMemory(key)) {
      return null;
    }
    const entry = { key, t: now(), data: clean };
    memories.push(entry);
    if (memories.length > R.maxMemories) memories.shift();
    if (needs && def.bond > 0) needs.adjust('bond', def.bond);
    revision += 1;
    for (const fn of listeners) fn(entry);
    return entry;
  }

  function memoryLabel(entry) {
    if (!entry) return null;
    // Phase 27 Teil B4: Name der Form hinten dran (ohne Namen bleibt der allgemeine Text)
    const formName = (id) => {
      try { return id && getFormLabel ? getFormLabel(id) || null : null; } catch (e) { return null; }
    };
    if (entry.key === 'special_event') {
      const id = entry.data && entry.data.id;
      const base = BOND_SPECIAL[id] || BOND_MEMORIES.special_event.label;
      if (id === 'stage_special' && getEvolutionId) {
        let evoId = null;
        try { evoId = getEvolutionId(); } catch (e) { evoId = null; }
        const name = formName(evoId);
        return name ? base + ': ' + name : base;
      }
      return base;
    }
    if (entry.key === 'first_evolution') {
      const name = formName(entry.data && entry.data.id);
      return name ? BOND_MEMORIES.first_evolution.label + ': ' + name : BOND_MEMORIES.first_evolution.label;
    }
    return BOND_MEMORIES[entry.key].label;
  }

  // ---------- Ereignisse von außen ----------
  function onReaction(event) {
    if (event && event.source && event.source !== 'tap') return;   // Reaktionen auf Futter zählen dort
    counts.tap += 1;
    remember('first_touch');
    noteDerived();
  }

  function onFeed(event) {
    if (!event || event.type !== 'done') return;
    counts.feed += 1;
    remember('first_feed', { foodId: event.foodId });
    checkFavoriteFood();
    noteDerived();
  }

  /**
   * Phase 18/19: die Kreatur hat gespielt, optional mit einem Spielzeug. `solo: true` (Phase 19, freies Spiel): sie hat von selbst gespielt,
   * das zählt weder als Zuwendung des Spielers noch als „erstes gemeinsames Spiel“, wohl aber für das Lieblingsspielzeug.
   */
  function notePlay({ toyId = null, solo = false } = {}) {
    const id = cleanId(toyId);
    if (!solo) {
      counts.play += 1;
      remember('first_play', id ? { toyId: id } : {});
    }
    if (id && (id in toyUse || Object.keys(toyUse).length < R.maxToyIds)) {
      toyUse[id] = (toyUse[id] || 0) + 1;
      checkFavoriteToy();
    }
    noteDerived();
  }

  /** Besonderer Moment (Phase 33/34/35 usw.): `id` kurz und stabil, optional Text in BOND_SPECIAL. */
  function noteSpecial(id) { return remember('special_event', { id }); }

  // ---------- Favoriten ----------
  /** Wählt aus einer Zähltabelle den Favoriten mit Mindestwert und Vorsprung (kein Hin und Her). */
  function pickFavorite(map, current, min) {
    let top = null;
    for (const id of Object.keys(map)) if (top === null || map[id] > map[top]) top = id;
    if (top === null || map[top] < min) return current;
    if (current === null || !(current in map)) return top;
    if (top !== current && map[top] > map[current] * R.switchFactor) return top;
    return current;
  }

  function checkFavoritePlace() {
    const next = pickFavorite(placeSec, favoritePlace, R.favoritePlaceMinSec);
    if (next === favoritePlace) return;
    favoritePlace = next;
    revision += 1;
    if (next) remember('favorite_place_found', { zoneId: next });
  }

  function checkFavoriteToy() {
    const next = pickFavorite(toyUse, favoriteToy, R.favoriteToyMinUses);
    if (next === favoriteToy) return;
    favoriteToy = next;
    revision += 1;
    if (next) remember('favorite_toy_found', { toyId: next });
  }

  /** Lieblingsfutter: live aus dem FoodSystem (dort steht der Zähler), erst ab genug Mahlzeiten. */
  function getFavoriteFood() {
    if (!food) return null;
    if (food.getStats().total < R.favoriteFoodMinMeals) return null;
    return food.getFavorite();
  }

  function checkFavoriteFood() {
    const fav = getFavoriteFood();
    if (fav === lastFavoriteFood) return;
    lastFavoriteFood = fav;
    revision += 1;
    if (fav) remember('favorite_food_found', { foodId: fav });
  }

  /** Häufigste Art der Zuwendung (ab `frequentMin`), sonst null. Bei Gleichstand gilt die Reihenfolge in BOND_KINDS. */
  function getFrequent() {
    let best = null;
    for (const id of KIND_IDS) if (best === null || counts[id] > counts[best]) best = id;
    return best !== null && counts[best] >= R.frequentMin ? best : null;
  }

  function noteDerived() {
    const f = getFrequent();
    if (f !== lastFrequent) { lastFrequent = f; revision += 1; }
  }

  // ---------- Bindungsstufen ----------
  function currentTierIndex() {
    const v = needs ? needs.get('bond') : 0;
    let idx = 0;
    for (let i = 0; i < BOND_TIERS.length; i++) if (v >= BOND_TIERS[i].min) idx = i;
    return idx;
  }

  function getTier() { return BOND_TIERS[currentTierIndex()]; }

  /**
   * Jede erreichte Stufe hat einen besonderen Moment. `remember` dedupliziert, deshalb ist der Abgleich nach
   * dem Laden eines Spielstands (tierIdx = -1) sicher. Ein Schub durch eine Erinnerung kann die nächste Stufe
   * erreichen, deshalb wird wiederholt, bis nichts mehr dazukommt.
   */
  function syncTiers() {
    let idx = currentTierIndex();
    for (let guard = 0; guard < BOND_TIERS.length; guard++) {
      for (let i = 1; i <= idx; i++) {
        const special = BOND_TIERS[i].special;
        if (special) remember('special_event', { id: special });
      }
      const again = currentTierIndex();
      if (again === idx) break;
      idx = again;
    }
    if (idx !== tierIdx) { tierIdx = idx; revision += 1; }
  }

  // ---------- Zeit ----------
  function sampleWhere(dt) {
    if (!getPosition || zones.length === 0) return;
    if (isStill && !isStill()) return;
    const p = getPosition();
    if (!p) return;
    const r2 = R.placeRadius * R.placeRadius;
    let best = null;
    let bestD = r2;
    for (const z of zones) {
      const dx = p.x - z.x;
      const dz = p.z - z.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) { best = z; bestD = d; }
    }
    if (best) placeSec[best.id] += Math.min(dt, R.placeSampleMaxDt);
  }

  function update(dt) {
    if (!(dt > 0)) return;
    sampleWhere(dt);
    tickAcc += dt;
    if (tickAcc < TICK_SEC) return;
    tickAcc = 0;
    checkFavoritePlace();
    syncTiers();
  }

  // ---------- Abfragen ----------
  function getFavorites() {
    return { food: getFavoriteFood(), place: favoritePlace, toy: favoriteToy };
  }

  function getMemories() {
    return memories.map((m) => ({ key: m.key, t: m.t, data: { ...m.data } }));
  }

  function getLatestMemory() {
    const m = memories[memories.length - 1];
    return m ? { key: m.key, t: m.t, data: { ...m.data }, label: memoryLabel(m) } : null;
  }

  /** Alles, was die Oberfläche braucht (Texte, keine Zahlen). Neu aufbauen nur, wenn getRevision()/getTier() sich ändern. */
  function getSummary() {
    const fav = getFavorites();
    const frequent = getFrequent();
    return {
      tier: getTier(),
      favoriteFood: fav.food ? { id: fav.food, label: FOODS[fav.food] ? FOODS[fav.food].label : fav.food } : null,
      favoritePlace: fav.place && zoneById.has(fav.place) ? { id: fav.place, label: zoneById.get(fav.place).label } : null,
      favoriteToy: fav.toy ? { id: fav.toy, label: getToyLabel(fav.toy) } : null,
      frequent: frequent ? { id: frequent, label: BOND_KINDS[frequent] } : null,
      memoryCount: memories.length,
      latest: getLatestMemory(),
    };
  }

  function getRevision() { return revision; }

  function onMemory(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // ---------- Speichern (Phase 44) ----------
  function serialize() {
    const secs = {};
    for (const id of Object.keys(placeSec)) secs[id] = Math.round(placeSec[id] * 10) / 10;
    return {
      version: BOND_SAVE_VERSION,
      counts: { ...counts },
      placeSec: secs,
      toyUse: { ...toyUse },
      favoritePlace,
      favoriteToy,
      memories: getMemories(),
    };
  }

  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== BOND_SAVE_VERSION) return false;
    resetState();

    if (data.counts && typeof data.counts === 'object') {
      for (const id of KIND_IDS) {
        const n = data.counts[id];
        if (Number.isFinite(n) && n > 0) counts[id] = Math.floor(n);
      }
    }
    if (data.placeSec && typeof data.placeSec === 'object') {
      for (const z of zones) {
        const s = data.placeSec[z.id];
        if (Number.isFinite(s) && s > 0) placeSec[z.id] = s;
      }
    }
    if (data.toyUse && typeof data.toyUse === 'object') {
      for (const id of Object.keys(data.toyUse)) {
        if (Object.keys(toyUse).length >= R.maxToyIds) break;
        const n = data.toyUse[id];
        if (cleanId(id) && Number.isFinite(n) && n > 0) toyUse[id] = Math.floor(n);
      }
    }
    if (typeof data.favoritePlace === 'string' && zoneById.has(data.favoritePlace)) favoritePlace = data.favoritePlace;
    if (typeof data.favoriteToy === 'string' && data.favoriteToy in toyUse) favoriteToy = data.favoriteToy;

    if (Array.isArray(data.memories)) {
      for (const m of data.memories) {
        if (!m || typeof m !== 'object' || !BOND_MEMORIES[m.key] || !Number.isFinite(m.t)) continue;
        const clean = cleanData(m.data);
        if (m.key === 'special_event') {
          const id = cleanId(clean.id);
          if (!id || hasMemory(m.key, id)) continue;
        } else if (hasMemory(m.key)) {
          continue;
        }
        memories.push({ key: m.key, t: m.t, data: clean });   // ohne Bindungsschub: der Wert steht im NeedSystem-Spielstand
        if (memories.length >= R.maxMemories) break;
      }
    }
    lastFrequent = getFrequent();
    lastFavoriteFood = getFavoriteFood();
    revision += 1;
    return true;
  }

  function reset() { resetState(); }

  return {
    update, onReaction, onFeed, notePlay, noteSpecial, remember, hasMemory,
    getMemories, getLatestMemory, getTier, getFavorites, getFrequent, getSummary, getRevision, onMemory,
    serialize, restore, reset,
  };
}

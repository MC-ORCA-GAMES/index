/*
  EvolutionSystem – wann und wohin Reson sich verwandelt (Phase 26).
  Reine Logik, kein Three.js. Zahlen, Faktoren und Evolutionen stehen in js/data/evolution.js.

  Evolution ist nicht „XP = 100“. Acht Faktoren (Neugier, Pflege, Bindung, Training, Erkundung, Zuwendung, Kreativität, Ausgewogenheit)
  wachsen langsam aus dem, was passiert. Sie wachsen nur, nichts geht zurück:
    Punkt-Faktoren   Neugier, Pflege, Erkundung, Zuwendung, Kreativität: Punkte aus Ereignissen (`note(kind, data)`) und Zeit, Faktor =
                     1 - exp(-Punkte / scale); Anti-Grinden über Mindestabstände je Ereignisart und „neu“-Zählung (erstes Futter, erstes Spielzeug ...)
    Bindung          = needs `bond` / 80 (das NeedSystem hat die Wahrheit, keine zweite Zahl)
    Training         = mittlerer Lernstand der Fähigkeiten (TrainingSystem, `getTrainingMean`)
    Ausgewogenheit   abgeleitet aus den anderen sieben (Mittel mal Gleichmäßigkeit), der Höchststand wird gemerkt
  Die Persönlichkeit färbt das Wachstum der Punkt-Faktoren leicht (`TRAIT_BIAS`). „Umgebung“ kommt später (Phase 30–34).

  Wann es soweit ist: nur in der Endstufe „Erwachsen“ (`lifecycle`), nach `minStageSec` Laufzeit dort, wenn die Grundbedingung (Gesamtwert,
  mehrere Faktoren) erfüllt ist. Dann wählt das System die Form (Phase 27, siehe unten), ruft `lifecycle.promote(stage)` (Übergang live und
  sichtbar) und trägt beim Eintritt der neuen Stufe die Verwandlung in die Geschichte ein (`evolutionHistory`) und meldet `evolved`.
  Der Lebenszyklus kennt weiterhin nur EINE Stufe `special`; WELCHE Form es ist, steht allein in `getEvolutionId()` (Entscheidung Phase 27).

  Verzweigungen (Phase 27): Jede Form in `EVOLUTIONS` hat Voraussetzungen (`requires`): Schwerpunkt-Formen (`focus`) liegen nahe, wenn ihr Hauptfaktor
  (und ein wenig ihr Nebenfaktor) vorn liegt (Affinität), die ausgewogene Form (`balanced`) braucht hohe Ausgewogenheit und kleine Streuung der
  sieben Faktoren. Gewählt wird die erfüllte Form mit dem höchsten `weight`, bei Gleichstand mit der größeren Affinität. Die Wahl fällt im
  Moment der Bereitschaft (`ready`) und bleibt dann fest. Die Grundform „Erwachte Form“ ist nur der Rückfall. Es gibt kein Scheitern.

  Nichts hier bestraft: Es gibt kein Scheitern und kein Verpassen. Wer anders spielt, bekommt später oder eine andere Form, nie eine schlechtere.
  Aufenthalt an Orten zählt nur Laufzeit im Stehen (keine Offline-Zeit, kein Druck).

  createEvolutionSystem({ needs, lifecycle, personality, zones, getPosition, isStill, getTrainingMean }) ->
    {
      update(dt), note(kind, data),
      getFactor(id), getFactors() (gemeinsames Objekt, nur lesen), getDominant() -> id | null, getScore(), getReadiness() (0..1),
      getReadyEvolution() -> id | null, getLeaning() -> id | null (Form, die jetzt am nächsten läge, auch vor der Bereitschaft),
      getAffinities() -> { <id>: 0..1 } (neues Objekt, für Anzeige/Debug), isEvolved(), getEvolutionId(), getPendingId() (Form während der
      Verwandlung, Phase 27 Teil B1), getHistory(), getWord(), getSummary(), getRevision(),
      onEvent(fn) -> abmelden, setPoints(obj) (Dev/Debug), serialize(), restore(data) -> bool, reset()
    }
  kind für `note`: 'tap' ({ emotion }), 'feed' ({ foodId }), 'play' ({ toyId, auto }), 'game' ({ id }), 'train' ({ skillId }), 'wash', 'sleep', 'explore'.
  zones: [{ id, x, z }]; getPosition() -> { x, z }; isStill() -> bool; getTrainingMean() -> 0..1.
  Ereignisse (onEvent): { type: 'ready', id } (Voraussetzungen erfüllt, Übergang beginnt) und { type: 'evolved', id, label, entry }.
  Format von serialize(): { version: 1, points, seen, adultSec, evolved, history, peakBalance } (Phase 44).
  NICHT im Browser getestet, nicht ausgeführt, alle Zahlen sind Startwerte.
*/
import {
  FACTOR_IDS, FACTORS, POINT_FACTORS, EVO_RULES, TRAIT_BIAS, EVOLUTIONS, EVOLUTION_IDS, EVO_WORDS, EVO_UI,
} from '../data/evolution.js';

export const EVOLUTION_SAVE_VERSION = 1;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);

export function createEvolutionSystem({
  needs = null, lifecycle, personality = null, zones = [], getPosition = null, isStill = () => true, getTrainingMean = () => 0,
} = {}) {
  const R = EVO_RULES;
  const P = R.points;

  const points = {};
  for (const id of POINT_FACTORS) points[id] = 0;
  const seen = { foods: {}, toys: {}, games: {}, zones: {} };
  let adultSec = 0;
  let evolved = null;            // Id der erreichten Evolution oder null
  let pending = null;            // Id, solange der Übergang läuft
  let lean = null;               // Phase 28 Teil B: verborgene Neigung { Faktor: >= 1 } (HiddenTraitSystem), nicht gespeichert hier
  let history = [];              // [{ id, at (Alter in Sekunden), factors }]
  let peakBalance = 0;
  let clock = 0;
  let checkAcc = 0;
  let placeAcc = 0;
  let revision = 0;
  const lastAt = {};             // Ereignisart -> Laufzeit des letzten gezählten Ereignisses
  const stay = {};               // Zonen-Id -> Sekunden im Stehen am Ort (bis zum ersten Zählen)
  const listeners = new Set();
  const factors = {};            // gemeinsames Objekt für getFactors()
  for (const id of FACTOR_IDS) factors[id] = 0;

  const emit = (event) => { for (const fn of listeners) fn(event); };

  // ---------- Persönlichkeit ----------
  /** Faktor auf die Punkte eines Faktors: Mischung der Züge nach ihrem Gewicht, begrenzt. */
  function bias(id) {
    let f = 1;
    if (personality) {
      for (const t of personality.getTraits()) {
        const b = TRAIT_BIAS[t.id];
        if (b && b[id]) f *= 1 + (b[id] - 1) * clamp01(t.weight);
      }
    }
    if (lean && lean[id] > 0) f *= lean[id];   // Phase 28 Teil B: verborgene Evolutionsneigung (eine Spur schneller, nie langsamer)
    return clamp(f, R.biasRange[0], R.biasRange[1]);
  }

  /** Phase 28 Teil B: verborgene Neigung { <Punkt-Faktor>: Faktor >= 1 } oder null. Nur Punkt-Faktoren, Faktor auf 1..1,15 begrenzt. */
  function setLean(map) {
    lean = null;
    if (!map || typeof map !== 'object') return;
    const out = {};
    for (const id of Object.keys(map)) if (POINT_FACTORS.includes(id) && Number.isFinite(map[id])) out[id] = clamp(map[id], 1, 1.15);
    lean = Object.keys(out).length ? out : null;
  }

  function addPoints(id, amount) {
    if (!(amount > 0) || !(id in points)) return;
    points[id] += amount * bias(id);
    revision += 1;
  }

  /** Ob eine Ereignisart gezählt wird (Mindestabstand); merkt sich den Zeitpunkt. */
  function gate(kind) {
    const gap = R.gapSec[kind] || 0;
    if (kind in lastAt && clock - lastAt[kind] < gap) return false;
    lastAt[kind] = clock;
    return true;
  }

  /** Erstes Mal? Trägt es ein und gibt true zurück. */
  function isNew(bucket, id) {
    if (!id || seen[bucket][id]) return false;
    seen[bucket][id] = true;
    return true;
  }

  // ---------- Ereignisse ----------
  function note(kind, data = {}) {
    switch (kind) {
      case 'tap':
        if (!gate('tap')) return;
        addPoints('social', P.socialTap);
        if (data.emotion === 'curious') addPoints('curiosity', P.curiosityTap);
        break;
      case 'feed':
        if (isNew('foods', data.foodId)) addPoints('curiosity', P.curiosityNewFood);
        if (!gate('feed')) return;
        addPoints('care', P.careFeed);
        addPoints('social', P.socialFeed);
        break;
      case 'play':
        if (isNew('toys', data.toyId)) { addPoints('curiosity', P.curiosityNewToy); addPoints('creativity', P.creativityNewToy); }
        if (!gate('play')) return;
        addPoints('creativity', P.creativityPlay);
        if (!data.auto) addPoints('social', P.socialPlay);   // von selbst gespielt ist keine Zuwendung des Spielers
        break;
      case 'game':
        if (isNew('games', data.id)) addPoints('curiosity', P.curiosityNewGame);
        if (!gate('game')) return;
        addPoints('creativity', P.creativityGame);
        addPoints('social', P.socialGame);
        break;
      case 'train':
        if (!gate('train')) return;
        addPoints('social', P.socialTrain);
        break;
      case 'wash':
        if (!gate('wash')) return;
        addPoints('care', P.careWash);
        break;
      case 'sleep':
        if (!gate('sleep')) return;
        addPoints('care', P.careSleep);
        break;
      case 'explore':
        if (!gate('explore')) return;
        addPoints('exploration', P.explore);
        break;
      default:
        break;
    }
  }

  // ---------- Faktoren ----------
  function careLevel() {
    if (!needs) return 1;
    let sum = 0;
    let n = 0;
    for (const id of ['hunger', 'energy', 'hygiene', 'happiness', 'health']) {
      const v = needs.get(id);
      if (Number.isFinite(v)) { sum += v / 100; n += 1; }
    }
    return n ? sum / n : 1;
  }

  function recompute() {
    for (const id of POINT_FACTORS) factors[id] = 1 - Math.exp(-points[id] / FACTORS[id].scale);
    factors.bond = needs ? clamp01(needs.get('bond') / FACTORS.bond.full) : 0;
    factors.training = clamp01(getTrainingMean());
    // Ausgewogenheit: Mittel der anderen sieben mal Gleichmäßigkeit, Höchststand wird gemerkt
    let sum = 0;
    let lo = 1;
    let hi = 0;
    let n = 0;
    for (const id of FACTOR_IDS) {
      if (id === 'balance') continue;
      sum += factors[id];
      lo = Math.min(lo, factors[id]);
      hi = Math.max(hi, factors[id]);
      n += 1;
    }
    const mean = sum / n;
    const bal = mean >= R.balanceMinMean ? mean * (1 - clamp01(hi - lo)) : 0;
    if (bal > peakBalance) peakBalance = bal;
    factors.balance = peakBalance;
  }

  /** Gewichtetes Mittel aller Faktoren (0..1). */
  function getScore() {
    let sum = 0;
    let w = 0;
    for (const id of FACTOR_IDS) { sum += FACTORS[id].weight * factors[id]; w += FACTORS[id].weight; }
    return w > 0 ? sum / w : 0;
  }

  function getDominant() {
    let best = null;
    for (const id of FACTOR_IDS) if (factors[id] > 0.0001 && (best === null || factors[id] > factors[best])) best = id;
    return best;
  }

  /** Abstand zwischen stärkstem und schwächstem der sieben Faktoren (ohne Ausgewogenheit), 0..1. */
  function getSpread() {
    let lo = 1;
    let hi = 0;
    for (const id of FACTOR_IDS) {
      if (id === 'balance') continue;
      lo = Math.min(lo, factors[id]);
      hi = Math.max(hi, factors[id]);
    }
    return hi - lo;
  }

  /** Nähe zu einer Schwerpunkt-Form (0..1): Hauptfaktor und ein wenig der Nebenfaktor. */
  function affinityOf(def) {
    const f = def.requires.focus;
    if (!f) return 0;
    const w = R.branch.supportWeight;
    return ((factors[f.main] || 0) + w * (factors[f.support] || 0)) / (1 + w);
  }

  /** Grundbedingung für alle Formen: Gesamtstand und genug entwickelte Faktoren. */
  function meetsBase(def) {
    const q = def.requires;
    if (getScore() < q.minScore) return false;
    let count = 0;
    for (const id of FACTOR_IDS) if (factors[id] >= q.minFactorValue) count += 1;
    return count >= q.minFactors;
  }

  /**
   * Ist diese Form jetzt eine Möglichkeit? -> { weight, affinity } oder null. `ignoreBase`: Grundbedingung überspringen (für `getLeaning`).
   * Schwerpunkt-Form: Affinität ab `EVO_RULES.branch.minAffinity`. Ausgewogene Form: Ausgewogenheit und Streuung. Grundform: immer (Rückfall).
   */
  function candidateOf(def, ignoreBase) {
    if (!ignoreBase && !meetsBase(def)) return null;
    const q = def.requires;
    if (q.focus) {
      const a = affinityOf(def);
      return a >= R.branch.minAffinity ? { weight: def.weight, affinity: a } : null;
    }
    if (q.balanced) {
      return factors.balance >= q.balanced.minBalance && getSpread() <= q.balanced.maxSpread
        ? { weight: def.weight, affinity: factors.balance } : null;
    }
    return { weight: def.weight, affinity: 0 };
  }

  /** Beste Möglichkeit: höchstes `weight`, bei Gleichstand die größere Affinität, bei erneutem Gleichstand die frühere in `EVOLUTIONS`. */
  function pickBest(ignoreBase) {
    let best = null;
    let bestC = null;
    for (const id of EVOLUTION_IDS) {
      const c = candidateOf(EVOLUTIONS[id], ignoreBase);
      if (!c) continue;
      if (best === null || c.weight > bestC.weight || (c.weight === bestC.weight && c.affinity > bestC.affinity)) { best = id; bestC = c; }
    }
    return best;
  }

  /** Die Form, in die Reson sich jetzt verwandeln würde (oder null, solange die Grundbedingung nicht erfüllt ist). */
  function getReadyEvolution() { return pickBest(false); }

  /** Die Form, die dem aktuellen Stand am nächsten liegt, auch vor der Bereitschaft (für Anzeige, Debug, Phase 27 Teil B). */
  function getLeaning() { return pickBest(true); }

  /** Nähe zu jeder Form (0..1): Schwerpunkt-Formen die Affinität, die ausgewogene Form die Ausgewogenheit, die Grundform 0. Neues Objekt. */
  function getAffinities() {
    const out = {};
    for (const id of EVOLUTION_IDS) {
      const def = EVOLUTIONS[id];
      out[id] = def.requires.focus ? affinityOf(def) : (def.requires.balanced ? factors.balance : 0);
    }
    return out;
  }

  /** Wie nah an der ersten Voraussetzung (Gesamtwert), 0..1, nur für Worte. */
  function getReadiness() {
    let need = Infinity;
    for (const id of EVOLUTION_IDS) need = Math.min(need, EVOLUTIONS[id].requires.minScore);
    return Number.isFinite(need) && need > 0 ? clamp01(getScore() / need) : 0;
  }

  function getWord() {
    if (evolved) return EVO_UI.done;
    const r = getReadiness();
    let w = EVO_WORDS[0][1];
    for (const [from, text] of EVO_WORDS) if (r >= from) w = text;
    return w;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    const d = Math.min(dt, R.maxDt);
    clock += d;

    // Pflege: gute Werte über längere Zeit
    points.care += P.careTimePerSec * careLevel() * d * bias('care');

    // Orte: im Stehen nahe einer Zonenmitte, beim ersten Mal (gedrosselt)
    placeAcc += d;
    if (placeAcc >= 0.5 && getPosition) {
      const step = placeAcc;
      placeAcc = 0;
      if (isStill()) {
        const pos = getPosition();
        for (const z of zones) {
          if (seen.zones[z.id]) continue;
          if (Math.hypot(pos.x - z.x, pos.z - z.z) <= R.placeRadius) {
            stay[z.id] = (stay[z.id] || 0) + step;
            if (stay[z.id] >= R.placeMinSec) { seen.zones[z.id] = true; addPoints('exploration', P.exploreNewZone); }
          } else {
            stay[z.id] = 0;
          }
        }
      }
    }

    recompute();

    // Wann ist es soweit? Nur in der Endstufe, nach einer Weile dort.
    if (!evolved && !pending && lifecycle.getStageId() === 'adult') {
      adultSec += d;
      checkAcc += d;
      if (checkAcc >= R.checkEverySec) {
        checkAcc = 0;
        if (adultSec >= R.minStageSec) {
          const id = getReadyEvolution();
          if (id && lifecycle.promote(EVOLUTIONS[id].stage)) {
            pending = id;
            revision += 1;
            emit({ type: 'ready', id });
          }
        }
      }
    }
  }

  // ---------- Verwandlung abschließen (Eintritt der neuen Stufe) ----------
  const offLife = lifecycle.onEvent((e) => {
    if (e.type !== 'stage' || !pending) return;
    const id = pending;
    pending = null;
    evolved = id;
    const snap = {};
    for (const f of FACTOR_IDS) snap[f] = Math.round(factors[f] * 100) / 100;
    const entry = { id, at: Math.round(lifecycle.getAge()), factors: snap };
    history.push(entry);
    revision += 1;
    emit({ type: 'evolved', id, label: EVOLUTIONS[id].label, entry });
  });

  // ---------- Abfragen ----------
  function getSummary() {
    const dom = getDominant();
    return {
      word: getWord(),
      dominant: dom ? { id: dom, label: FACTORS[dom].label } : null,
      evolved: evolved !== null,
      evolutionId: evolved,
      label: evolved ? EVOLUTIONS[evolved].label : null,
      stageId: lifecycle.getStageId(),
      readiness: getReadiness(),
    };
  }

  // ---------- Dev (bis Phase 48) ----------
  /** Setzt Punkte (und optional `adultSec`) direkt (nur Entwicklung/Debug). */
  function setPoints(obj = {}) {
    for (const id of POINT_FACTORS) if (Number.isFinite(obj[id]) && obj[id] >= 0) points[id] = obj[id];
    if (Number.isFinite(obj.adultSec) && obj.adultSec >= 0) adultSec = obj.adultSec;
    recompute();
    revision += 1;
  }

  // ---------- Speichern (Phase 44) ----------
  function serialize() {
    return {
      version: EVOLUTION_SAVE_VERSION,
      points: { ...points },
      seen: { foods: { ...seen.foods }, toys: { ...seen.toys }, games: { ...seen.games }, zones: { ...seen.zones } },
      adultSec, evolved, history: history.map((h) => ({ ...h, factors: { ...h.factors } })), peakBalance,
    };
  }

  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== EVOLUTION_SAVE_VERSION) return false;
    reset();
    if (data.points && typeof data.points === 'object') {
      for (const id of POINT_FACTORS) if (Number.isFinite(data.points[id]) && data.points[id] > 0) points[id] = data.points[id];
    }
    if (data.seen && typeof data.seen === 'object') {
      for (const b of Object.keys(seen)) {
        const src = data.seen[b];
        if (src && typeof src === 'object') for (const k of Object.keys(src)) if (src[k] === true && String(k).length <= 40) seen[b][k] = true;
      }
    }
    adultSec = Number.isFinite(data.adultSec) && data.adultSec > 0 ? data.adultSec : 0;
    evolved = typeof data.evolved === 'string' && EVOLUTIONS[data.evolved] ? data.evolved : null;
    if (Array.isArray(data.history)) {
      history = data.history.filter((h) => h && EVOLUTIONS[h.id]).slice(0, 20)
        .map((h) => ({ id: h.id, at: Number.isFinite(h.at) ? h.at : 0, factors: { ...(h.factors || {}) } }));
    }
    peakBalance = Number.isFinite(data.peakBalance) ? clamp01(data.peakBalance) : 0;
    recompute();
    return true;
  }

  function reset() {
    for (const id of POINT_FACTORS) points[id] = 0;
    seen.foods = {}; seen.toys = {}; seen.games = {}; seen.zones = {};
    for (const k of Object.keys(stay)) delete stay[k];
    for (const k of Object.keys(lastAt)) delete lastAt[k];
    adultSec = 0; evolved = null; pending = null; history = []; peakBalance = 0;
    checkAcc = 0; placeAcc = 0;
    revision += 1;
    recompute();
  }

  recompute();

  return {
    update, note,
    getFactor: (id) => factors[id] || 0,
    getFactors: () => factors,
    getDominant, getScore, getReadiness, getReadyEvolution, getLeaning, getAffinities, getWord, getSummary,
    isEvolved: () => evolved !== null,
    getEvolutionId: () => evolved,
    getPendingId: () => pending,   // Form, in die sich Reson gerade verwandelt (Übergang läuft), sonst null (Phase 27 Teil B1, für FormLook)
    getHistory: () => history.map((h) => ({ ...h })),
    getRevision: () => revision,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setPoints, setLean, serialize, restore, reset,
    dispose() { offLife(); listeners.clear(); },
  };
}

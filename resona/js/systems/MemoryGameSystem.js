/*
  MemoryGameSystem – Minispiel 2: Memory (Phase 21). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Mischt die Karten, entscheidet Aufdecken, Paare, Versuche, Ergebnis, Belohnung und Abnutzung. Kreatur und Verhalten: js/creature/Gaming.js,
  Karten und Ergebnisanzeige: js/ui/MemoryView.js. Daten und Texte: js/data/minigames.js (MEMORY, MEMORY_UI).
  Schnittstelle bewusst wie ReactionGameSystem (canRequest/start/stop/update/getPhase/isPlaying/onEvent/serialize/restore/reset), damit
  Gaming.js beide gleich behandelt. Die beiden Systeme teilen absichtlich keinen Code (ReactionGameSystem blieb in Phase 21 unverändert);
  eine gemeinsame Grundlage (Müdigkeit, Splitter, Statistik) lohnt erst mit dem dritten Minispiel (Phase 22).

  Ablauf (Schritt `step` innerhalb der Phase `playing`):
    intro      kurze Pause nach dem Start (MEMORY.introSec), der Hinweistext steht
    peek       Vorschau: alle Karten liegen offen (MEMORY.peekSec), Tippen tut nichts
    pick       der Spieler deckt Karten auf. Erste Karte: bleibt offen. Zweite Karte: ein Versuch ist gezählt.
               Gleiches Bild = Paar (beide bleiben offen und gelten als gefunden); verschieden = Schritt `mismatch`.
    mismatch   beide Karten bleiben MEMORY.mismatchSec offen; danach drehen sie zurück. Tippt der Spieler vorher eine andere Karte
               (die nicht schon gefunden ist), drehen sie sofort zurück und die getippte Karte ist die erste des nächsten Versuchs.
    clear      alle Paare gefunden: kurz stehen lassen (MEMORY.clearSec), dann endet das Spiel natürlich.
  Es gibt kein Zeitlimit für den Spieler. Nichts kann verloren gehen: Fehlversuche kosten nur einen Versuch mehr, nie Werte.

  Ergebnis: Bestwert sind `pairs` Versuche. Anteil (`fraction`, 0..1) = 1 - (Versuche - pairs) / slackTurns, mindestens `minFraction`.
  Ergebnisstufe (great/good/ok) nach Versuchen (MEMORY.resultTiers). Vorzeitig beendet („Beenden“, kostet nichts): erst ab `minPairsForReward`
  gefundenen Paaren zählt der gespielte Teil, Anteil = gefundene Paare / pairs * stoppedFraction, Ergebnis `stopped`.
  Wirkung (bei `stop`, nur bei gezähltem Spiel): MEMORY.effects * Anteil * Abnutzungsfaktor auf die Bedürfnisse; bei natürlichem Ende zusätzlich
  MEMORY.participation * Faktor. Dazu „Resonanzsplitter“ (ganze Zahl, mindestens 1), nur gezählt (`getResources`), Inventar kommt in Phase 37.
  Abnutzung wie ReactionGameSystem, aber getrennt je Minispiel: Faktor = 1 - Müdigkeit, mindestens `minFactor`; klingt mit der Zeit ab.

  Zeit: `update(dt)` pro Frame (nur Laufzeit, kein Nachrechnen von Offline-Zeit). Der Zufall (Mischen) kommt aus einem Seed (testbar).

  createMemoryGameSystem({ needs, seed }) ->
    {
      update(dt), canRequest() -> { ok, reason },       reason: 'busy' | 'tired' | null
      start(source) -> bool, tap(index) -> { ok, kind }, stop({ natural }) -> Ergebnis | null,
      getPhase() ('idle' | 'playing'), isPlaying(), getState(), getCards(), getSource(), getFatigue(), getFactor(), getBest(), getResources(),
      getStats(), onEvent(fn), serialize(), restore(data), reset()
    }
  tap-Ergebnis `kind`: 'first' (erste Karte offen), 'match' (Paar), 'mismatch' (zwei verschiedene), 'ignored' (nichts passiert).
  getCards() -> Liste je Karte { index, faceUp, matched, symbolId }. `symbolId` ist nur bei offenen Karten gesetzt (sonst null),
    `faceUp` ist während der Vorschau bei allen Karten wahr.
  getState() -> { phase, step, pairs, total, pairsFound, turns, first }   (`first`: Index der ersten offenen Karte des Versuchs oder -1)
  Ereignisse: { type, ... }
    start     { pairs, total, source }
    peek      {}                                         die Vorschau beginnt (alle Karten offen)
    begin     {}                                         die Karten sind umgedreht, das Spiel wartet auf das erste Aufdecken
    flip      { index, symbolId, second, turns }         eine Karte wurde aufgedeckt (second: zweite des Versuchs; turns zählt den Versuch schon mit)
    match     { a, b, symbolId, pairsFound, pairs, turns }
    mismatch  { a, b, turns }
    hide      { a, b }                                   die beiden verschiedenen Karten drehen zurück
    done      { natural, counted, pairs, pairsFound, turns, fraction, result, reaction, applied, factor, shards, shardsTotal,
                bestTurns, newBest, source }
                result: 'great' | 'good' | 'ok' (nur natürlich) oder 'stopped'; reaction: Reaktion aus Interaction.js oder null
  Format von serialize(): { version: 1, games, stopped, bestTurns, shards } (für Phase 44; Müdigkeit und laufendes Spiel nicht).
  NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { MEMORY } from '../data/minigames.js';
import { createRng } from '../core/rng.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const MEMORY_SAVE_VERSION = 1;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createMemoryGameSystem({ needs, seed = 9021 }) {
  const M = MEMORY;
  const rng = createRng(seed);
  const listeners = new Set();

  const PAIRS = Math.max(1, Math.min(M.pairs, M.symbols.length));
  const TOTAL = PAIRS * 2;
  const INTRO_SEC = Number.isFinite(M.introSec) ? M.introSec : 1;   // Schutz, falls die Daten den Schlüssel nicht haben

  let phase = 'idle';       // 'idle' | 'playing'
  let step = 'intro';       // 'intro' | 'peek' | 'pick' | 'mismatch' | 'clear' (nur in der Phase playing)
  let source = 'player';
  let cards = [];           // [{ symbolId, state: 'hidden' | 'open' | 'matched' }]
  let first = -1;           // Index der ersten offenen Karte des laufenden Versuchs
  let pending = null;       // [a, b] der beiden verschiedenen offenen Karten im Schritt mismatch
  let pairsFound = 0;
  let turns = 0;            // Versuche (je zwei aufgedeckte Karten)
  let timer = 0;            // Restzeit von intro / peek / mismatch / clear
  let fatigue = 0;          // 0..1, klingt ab; macht die Wirkung kleiner
  let games = 0;            // vollständig gespielte Spiele (Statistik)
  let stoppedGames = 0;     // vorzeitig beendete, aber gezählte Spiele
  let bestTurns = 0;        // wenigste Versuche eines vollständigen Spiels (0 = noch keins)
  let shards = 0;           // gesammelte Resonanzsplitter (Phase 37 macht daraus ein Inventar)

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Abfragen ----------
  const getFactor = () => Math.max(M.minFactor, 1 - fatigue);

  function canRequest() {
    if (phase !== 'idle') return { ok: false, reason: 'busy' };
    if (needs.get('energy') < M.minEnergy) return { ok: false, reason: 'tired' };
    return { ok: true, reason: null };
  }

  function resultTierFor(turnCount) {
    for (const tier of M.resultTiers) if (turnCount <= tier.maxTurns) return tier;
    return M.resultTiers[M.resultTiers.length - 1];
  }

  /** Anteil eines vollständig gespielten Spiels nach Versuchen (siehe Kopf). */
  function fractionFor(turnCount) {
    const raw = 1 - (turnCount - PAIRS) / M.slackTurns;
    return Math.max(M.minFraction, clamp01(raw));
  }

  // ---------- Karten ----------
  /** Wählt `PAIRS` Symbole (bei weniger Paaren als Symbolen gemischt), legt jedes zweimal und mischt (Fisher-Yates). */
  function dealCards() {
    const ids = M.symbols.map((s) => s.id);
    shuffle(ids);
    const chosen = ids.slice(0, PAIRS);
    const list = [];
    for (const id of chosen) {
      list.push({ symbolId: id, state: 'hidden' });
      list.push({ symbolId: id, state: 'hidden' });
    }
    shuffle(list);
    return list;
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
  }

  // ---------- Ablauf ----------
  /** Beginnt ein Spiel (source: 'player'). Gibt false zurück, wenn es nicht geht. Ob sie gerade frei ist, prüft Gaming. */
  function start(from = 'player') {
    if (!canRequest().ok) return false;
    phase = 'playing';
    step = 'intro';
    source = from === 'auto' ? 'auto' : 'player';
    cards = dealCards();
    first = -1;
    pending = null;
    pairsFound = 0;
    turns = 0;
    timer = INTRO_SEC;
    emit({ type: 'start', pairs: PAIRS, total: TOTAL, source });
    return true;
  }

  function beginPeek() {
    step = 'peek';
    timer = M.peekSec;
    emit({ type: 'peek' });
  }

  function beginPick() {
    step = 'pick';
    timer = 0;
    emit({ type: 'begin' });
  }

  function hideMismatch() {
    if (!pending) return;
    const [a, b] = pending;
    cards[a].state = 'hidden';
    cards[b].state = 'hidden';
    pending = null;
    step = 'pick';
    timer = 0;
    emit({ type: 'hide', a, b });
  }

  /** Der Spieler tippt eine Karte (Index im Raster, ab 0). Nur im Spiel; zählt nach Schritt (siehe Kopf). */
  function tap(index) {
    if (phase !== 'playing' || !Number.isInteger(index) || index < 0 || index >= cards.length) return { ok: false, kind: 'ignored' };
    if (step === 'mismatch') {
      if (cards[index].state === 'matched') return { ok: false, kind: 'ignored' };   // eine gefundene Karte beendet das Zurückdrehen nicht
      hideMismatch();                                                                // sonst: sofort zurückdrehen, die Karte zählt als neuer Versuch
    }
    if (step !== 'pick') return { ok: false, kind: 'ignored' };                      // intro, peek, clear: nichts
    const card = cards[index];
    if (card.state !== 'hidden') return { ok: false, kind: 'ignored' };              // schon offen oder gefunden

    card.state = 'open';
    if (first < 0) {
      first = index;
      emit({ type: 'flip', index, symbolId: card.symbolId, second: false, turns });
      return { ok: true, kind: 'first' };
    }

    const a = first;
    first = -1;
    turns += 1;
    emit({ type: 'flip', index, symbolId: card.symbolId, second: true, turns });
    if (cards[a].symbolId === card.symbolId) {
      cards[a].state = 'matched';
      card.state = 'matched';
      pairsFound += 1;
      emit({ type: 'match', a, b: index, symbolId: card.symbolId, pairsFound, pairs: PAIRS, turns });
      if (pairsFound >= PAIRS) {
        step = 'clear';
        timer = M.clearSec;
      }
      return { ok: true, kind: 'match' };
    }
    pending = [a, index];
    step = 'mismatch';
    timer = M.mismatchSec;
    emit({ type: 'mismatch', a, b: index, turns });
    return { ok: true, kind: 'mismatch' };
  }

  /**
   * Ende des Spiels. natural: true = alle Paare gefunden, false = vorzeitig („Beenden“). Gibt das Ergebnis zurück (auch als Ereignis
   * `done`) oder null, wenn gerade nicht gespielt wurde.
   */
  function stop({ natural = false } = {}) {
    if (phase !== 'playing') return null;
    const counted = natural || pairsFound >= M.minPairsForReward;
    let fraction = 0;
    if (counted) fraction = natural ? fractionFor(turns) : clamp01(pairsFound / PAIRS) * M.stoppedFraction;
    const factor = getFactor();

    const applied = {};
    let gained = 0;
    if (counted) {
      for (const k of Object.keys(M.effects)) applied[k] = M.effects[k] * fraction * factor;
      if (natural) for (const k of Object.keys(M.participation)) applied[k] = (applied[k] || 0) + M.participation[k] * factor;
      needs.adjustMany(applied);
      const S = M.shards;
      gained = Math.max(1, Math.round((S.base + fraction * S.perFrac) * Math.max(S.minFactor, factor)));
      shards += gained;
      fatigue = Math.min(1, fatigue + (natural ? M.fatiguePerGame : M.fatigueStopped));
    }

    let newBest = false;
    if (natural) {
      newBest = games > 0 && bestTurns > 0 && turns < bestTurns;   // beim allerersten Spiel gibt es nichts zu überbieten
      if (bestTurns === 0 || turns < bestTurns) bestTurns = turns;
      games += 1;
    } else if (counted) {
      stoppedGames += 1;
    }

    const tier = resultTierFor(turns);
    const result = {
      type: 'done', natural: !!natural, counted, pairs: PAIRS, pairsFound, turns, fraction,
      result: natural ? tier.id : 'stopped', reaction: natural ? tier.reaction : null,
      applied, factor, shards: gained, shardsTotal: shards, bestTurns, newBest, source,
    };
    phase = 'idle';
    step = 'intro';
    first = -1;
    pending = null;
    emit(result);
    return result;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    if (fatigue > 0) fatigue = Math.max(0, fatigue - M.fatigueDecayPerSec * dt);
    if (phase !== 'playing') return;

    if (step === 'intro') {
      timer -= dt;
      if (timer <= 0) beginPeek();
    } else if (step === 'peek') {
      timer -= dt;
      if (timer <= 0) beginPick();
    } else if (step === 'mismatch') {
      timer -= dt;
      if (timer <= 0) hideMismatch();
    } else if (step === 'clear') {
      timer -= dt;
      if (timer <= 0) stop({ natural: true });
    }
  }

  // ---------- Statistik, Speichern (für Phase 44) ----------
  function getState() {
    return { phase, step, pairs: PAIRS, total: TOTAL, pairsFound, turns, first };
  }

  function getCards() {
    const peeking = phase === 'playing' && step === 'peek';
    return cards.map((c, index) => {
      const faceUp = peeking || c.state !== 'hidden';
      return { index, faceUp, matched: c.state === 'matched', symbolId: faceUp ? c.symbolId : null };
    });
  }

  const getStats = () => ({ games, stopped: stoppedGames, bestTurns, shards });

  function serialize() {
    return { version: MEMORY_SAVE_VERSION, games, stopped: stoppedGames, bestTurns, shards };
  }

  /** Stellt die Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Laufendes Spiel und Müdigkeit werden nicht gespeichert. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== MEMORY_SAVE_VERSION) return false;
    const whole = (v, max) => (Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);
    games = whole(data.games, 1e9);
    stoppedGames = whole(data.stopped, 1e9);
    bestTurns = whole(data.bestTurns, 999);
    shards = whole(data.shards, 1e9);
    return true;
  }

  function reset() {
    phase = 'idle';
    step = 'intro';
    source = 'player';
    cards = [];
    first = -1;
    pending = null;
    pairsFound = 0;
    turns = 0;
    timer = 0;
    fatigue = 0;
    games = 0;
    stoppedGames = 0;
    bestTurns = 0;
    shards = 0;
  }

  return {
    update, canRequest, start, tap, stop,
    getPhase: () => phase,
    isPlaying: () => phase === 'playing',
    getState,
    getCards,
    getSource: () => source,
    getFatigue: () => fatigue,
    getFactor,
    getBest: () => bestTurns,
    getResources: () => ({ shards }),
    getStats,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    serialize, restore, reset,
  };
}

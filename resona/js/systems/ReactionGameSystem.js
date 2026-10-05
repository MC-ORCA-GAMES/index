/*
  ReactionGameSystem – Minispiel 1: Reaktionsspiel (Phase 20). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Entscheidet Runden, Zeitfenster, Punkte, Ergebnis, Belohnung und Abnutzung. Kreatur und Verhalten: js/creature/Gaming.js,
  Felder und Ergebnisanzeige: js/ui/ReactionView.js (Knopf und Auswahl: js/ui/GamePanel.js). Daten und Texte: js/data/minigames.js (REACTION, REACTION_UI).

  Ablauf einer Runde (Schritt `step` innerhalb der Phase `playing`):
    intro      kurze Pause nach dem Start (REACTION.introSec), der Hinweistext steht
    wait       zufällige Pause (waitMin..waitMax); zu frühes Tippen verlängert sie auf mindestens `earlyHoldSec` (kein Raten durch Dauertippen)
    lit        ein Feld leuchtet (windowSec); richtiges Tippen = Punkte nach Reaktionszeit (REACTION.tiers); falsches Feld = die Runde zählt
               höchstens `wrongTapMaxPoints`, das richtige darf danach trotzdem noch getippt werden; läuft das Fenster ab = verpasst (0 Punkte)
    feedback   Rückmeldung der Runde (feedbackSec), danach die nächste Runde oder das Ende
  Nichts kann verloren gehen: Daneben tippen, zu früh tippen oder verpassen gibt nie einen Abzug bei den Werten, nur weniger Punkte.

  Ende: `stop({ natural })`. Natürlich = alle Runden gespielt (das passiert in `update` von selbst). Vorzeitig („Beenden“, kostet nichts):
  erst ab `minRoundsForReward` abgeschlossenen Runden zählt der gespielte Teil (die Punkte stehen ohnehin im Verhältnis zu ALLEN Runden,
  das ist der „anteilige“ Teil). Der Anteil (`fraction`) = Punkte / (rounds * höchste Punktzahl je Runde).

  Wirkung (bei `stop`, nur bei gezähltem Spiel): REACTION.effects * Anteil * Abnutzungsfaktor auf die Bedürfnisse; bei natürlichem Ende
  zusätzlich REACTION.participation * Faktor (Teilnahme, unabhängig vom Ergebnis). Dazu „Resonanzsplitter“ (ganze Zahl, mindestens 1);
  es gibt noch kein Inventar (Phase 37), die Menge wird nur gezählt (`getResources`).
  Abnutzung (gegen Grinden, wie ToySystem): jedes gezählte Spiel erhöht die Müdigkeit, sie klingt mit der Zeit ab;
  Faktor = 1 - Müdigkeit, mindestens `minFactor`. Direkt nochmal spielen bringt weniger, aber nie nichts und nie ein Verbot.

  Zeit: `update(dt)` pro Frame (nur Laufzeit, kein Nachrechnen von Offline-Zeit). Der Zufall kommt aus einem Seed (testbar).

  createReactionGameSystem({ needs, seed }) ->
    {
      update(dt), canRequest() -> { ok, reason },       reason: 'busy' | 'tired' | null
      start(source) -> bool, tap(padId) -> { ok, kind }, stop({ natural }) -> Ergebnis | null,
      getPhase() ('idle' | 'playing'), isPlaying(), getState(), getFatigue(), getFactor(), getBest(), getResources(), getStats(),
      onEvent(fn), serialize(), restore(data), reset()
    }
  tap-Ergebnis `kind`: 'hit' (richtiges Feld in der Runde, mit `points`), 'wrong', 'early', 'ignored'.
  Ereignisse: { type, ... }
    start     { rounds, source }
    round     { round, total }                              eine neue Runde beginnt (Pause läuft)
    lit       { round, padId }                              ein Feld leuchtet
    early     { round }                                     zu früh getippt
    wrong     { round, padId }                              falsches Feld getippt
    feedback  { round, kind, points, total, reactionSec, padId, wrongTapped }
                kind: Stufe 'great' | 'good' | 'ok' (nach Punkten der Runde) oder 'miss'
    done      { natural, counted, roundsDone, points, maxPoints, fraction, result, reaction, applied, factor, shards, shardsTotal,
                bestPoints, newBest, source }
                result: 'great' | 'good' | 'ok' (nur natürlich) oder 'stopped'; reaction: Reaktion aus Interaction.js oder null
  Format von serialize(): { version: 1, games, stopped, bestPoints, shards } (für Phase 44; Müdigkeit und laufendes Spiel nicht).
  NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { REACTION } from '../data/minigames.js';
import { createRng } from '../core/rng.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const REACTION_SAVE_VERSION = 1;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createReactionGameSystem({ needs, seed = 9020 }) {
  const R = REACTION;
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const listeners = new Set();

  const PAD_IDS = R.pads.map((p) => p.id);
  const PER_ROUND_MAX = Math.max(...R.tiers.map((t) => t.points));
  const MAX_POINTS = R.rounds * PER_ROUND_MAX;
  const INTRO_SEC = Number.isFinite(R.introSec) ? R.introSec : 1;   // Schutz, falls die Daten den Schlüssel nicht haben

  let phase = 'idle';       // 'idle' | 'playing'
  let step = 'intro';       // 'intro' | 'wait' | 'lit' | 'feedback' (nur in der Phase playing)
  let source = 'player';
  let round = 0;            // laufende Runde, ab 1
  let roundsDone = 0;       // abgeschlossene Runden (Treffer, verpasst)
  let points = 0;
  let padId = null;         // gerade leuchtendes Feld
  let lastPadId = null;     // damit dasselbe Feld nicht zweimal hintereinander kommt
  let timer = 0;            // Restzeit von intro / wait / feedback
  let litSec = 0;           // Sekunden seit dem Aufleuchten
  let wrongTapped = false;  // in dieser Runde schon ein falsches Feld getippt
  let fatigue = 0;          // 0..1, klingt ab; macht die Wirkung kleiner
  let games = 0;            // vollständig gespielte Spiele (Statistik)
  let stoppedGames = 0;     // vorzeitig beendete, aber gezählte Spiele
  let bestPoints = 0;       // bestes Ergebnis (Punkte eines vollständigen Spiels)
  let shards = 0;           // gesammelte Resonanzsplitter (Phase 37 macht daraus ein Inventar)

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Abfragen ----------
  const getFactor = () => Math.max(R.minFactor, 1 - fatigue);

  function canRequest() {
    if (phase !== 'idle') return { ok: false, reason: 'busy' };
    if (needs.get('energy') < R.minEnergy) return { ok: false, reason: 'tired' };
    return { ok: true, reason: null };
  }

  function resultTierFor(fraction) {
    for (const tier of R.resultTiers) if (fraction >= tier.min) return tier;
    return R.resultTiers[R.resultTiers.length - 1];
  }

  /** Stufe einer Runde nach ihren Punkten (3 = great, 2 = good, 1 = ok); die Tabelle ist absteigend sortiert. */
  function feedbackKindFor(pts) {
    for (const tier of R.tiers) if (tier.points <= pts) return tier.id;
    return R.tiers[R.tiers.length - 1].id;
  }

  // ---------- Ablauf ----------
  /** Beginnt ein Spiel (source: 'player'). Gibt false zurück, wenn es nicht geht. Ob sie gerade frei ist, prüft Gaming. */
  function start(from = 'player') {
    if (!canRequest().ok) return false;
    phase = 'playing';
    step = 'intro';
    source = from === 'auto' ? 'auto' : 'player';
    round = 1;
    roundsDone = 0;
    points = 0;
    padId = null;
    lastPadId = null;
    litSec = 0;
    wrongTapped = false;
    timer = INTRO_SEC;
    emit({ type: 'start', rounds: R.rounds, source });
    return true;
  }

  function beginRound() {
    step = 'wait';
    timer = rand(R.waitMin, R.waitMax);
    litSec = 0;
    wrongTapped = false;
    padId = null;
    emit({ type: 'round', round, total: R.rounds });
  }

  function light() {
    const choices = PAD_IDS.filter((id) => id !== lastPadId);
    const pool = choices.length ? choices : PAD_IDS;
    padId = pool[Math.floor(rng() * pool.length)];
    lastPadId = padId;
    litSec = 0;
    step = 'lit';
    emit({ type: 'lit', round, padId });
  }

  function finishRound(pts, reactionSec) {
    roundsDone += 1;
    points += pts;
    const done = padId;
    step = 'feedback';
    timer = R.feedbackSec;
    emit({
      type: 'feedback', round, kind: pts > 0 ? feedbackKindFor(pts) : 'miss', points: pts, total: points,
      reactionSec, padId: done, wrongTapped,
    });
    padId = null;
  }

  /** Der Spieler tippt ein Feld. Nur im Spiel; zählt nach Schritt (siehe Kopf). */
  function tap(id) {
    if (phase !== 'playing' || !PAD_IDS.includes(id)) return { ok: false, kind: 'ignored' };
    if (step === 'wait') {
      timer = Math.max(timer, R.earlyHoldSec);   // zu früh: die Pause dauert danach mindestens noch so lange
      emit({ type: 'early', round });
      return { ok: true, kind: 'early' };
    }
    if (step !== 'lit') return { ok: false, kind: 'ignored' };   // intro und feedback: nichts
    if (id !== padId) {
      wrongTapped = true;
      emit({ type: 'wrong', round, padId: id });
      return { ok: true, kind: 'wrong' };
    }
    let pts = 0;
    for (const tier of R.tiers) {
      if (litSec <= tier.maxSec) { pts = tier.points; break; }
    }
    if (pts === 0) pts = R.tiers[R.tiers.length - 1].points;   // Sicherung: im Zeitfenster gibt es mindestens die kleinste Stufe
    if (wrongTapped) pts = Math.min(pts, R.wrongTapMaxPoints);
    const reactionSec = litSec;
    finishRound(pts, reactionSec);
    return { ok: true, kind: 'hit', points: pts };
  }

  /**
   * Ende des Spiels. natural: true = alle Runden gespielt, false = vorzeitig („Beenden“). Gibt das Ergebnis zurück (auch als Ereignis
   * `done`) oder null, wenn gerade nicht gespielt wurde.
   */
  function stop({ natural = false } = {}) {
    if (phase !== 'playing') return null;
    const maxFraction = clamp01(points / MAX_POINTS);
    const counted = natural || roundsDone >= R.minRoundsForReward;
    const fraction = counted ? maxFraction : 0;
    const factor = getFactor();

    const applied = {};
    let gained = 0;
    if (counted) {
      for (const k of Object.keys(R.effects)) applied[k] = R.effects[k] * fraction * factor;
      if (natural) for (const k of Object.keys(R.participation)) applied[k] = (applied[k] || 0) + R.participation[k] * factor;
      needs.adjustMany(applied);
      const S = R.shards;
      gained = Math.max(1, Math.round((S.base + fraction * S.perFrac) * Math.max(S.minFactor, factor)));
      shards += gained;
      fatigue = Math.min(1, fatigue + (natural ? R.fatiguePerGame : R.fatigueStopped));
    }

    let newBest = false;
    if (natural) {
      newBest = games > 0 && points > bestPoints;   // beim allerersten Spiel gibt es nichts zu überbieten
      if (points > bestPoints) bestPoints = points;
      games += 1;
    } else if (counted) {
      stoppedGames += 1;
    }

    const tier = resultTierFor(maxFraction);
    const result = {
      type: 'done', natural: !!natural, counted, roundsDone, points, maxPoints: MAX_POINTS, fraction,
      result: natural ? tier.id : 'stopped', reaction: natural ? tier.reaction : null,
      applied, factor, shards: gained, shardsTotal: shards, bestPoints, newBest, source,
    };
    phase = 'idle';
    step = 'intro';
    padId = null;
    emit(result);
    return result;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    if (fatigue > 0) fatigue = Math.max(0, fatigue - R.fatigueDecayPerSec * dt);
    if (phase !== 'playing') return;

    if (step === 'intro') {
      timer -= dt;
      if (timer <= 0) beginRound();
    } else if (step === 'wait') {
      timer -= dt;
      if (timer <= 0) light();
    } else if (step === 'lit') {
      litSec += dt;
      if (litSec >= R.windowSec) finishRound(0, R.windowSec);   // verpasst: 0 Punkte, kein Abzug
    } else if (step === 'feedback') {
      timer -= dt;
      if (timer <= 0) {
        if (roundsDone >= R.rounds) stop({ natural: true });
        else { round += 1; beginRound(); }
      }
    }
  }

  // ---------- Statistik, Speichern (für Phase 44) ----------
  function getState() {
    return { phase, step, round, total: R.rounds, roundsDone, points, maxPoints: MAX_POINTS, padId };
  }

  const getStats = () => ({ games, stopped: stoppedGames, bestPoints, shards });

  function serialize() {
    return { version: REACTION_SAVE_VERSION, games, stopped: stoppedGames, bestPoints, shards };
  }

  /** Stellt die Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Laufendes Spiel und Müdigkeit werden nicht gespeichert. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== REACTION_SAVE_VERSION) return false;
    const whole = (v, max) => (Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);
    games = whole(data.games, 1e9);
    stoppedGames = whole(data.stopped, 1e9);
    bestPoints = whole(data.bestPoints, MAX_POINTS);
    shards = whole(data.shards, 1e9);
    return true;
  }

  function reset() {
    phase = 'idle';
    step = 'intro';
    source = 'player';
    round = 0;
    roundsDone = 0;
    points = 0;
    padId = null;
    lastPadId = null;
    timer = 0;
    litSec = 0;
    wrongTapped = false;
    fatigue = 0;
    games = 0;
    stoppedGames = 0;
    bestPoints = 0;
    shards = 0;
  }

  return {
    update, canRequest, start, tap, stop,
    getPhase: () => phase,
    isPlaying: () => phase === 'playing',
    getState,
    getSource: () => source,
    getFatigue: () => fatigue,
    getFactor,
    getBest: () => bestPoints,
    getResources: () => ({ shards }),
    getStats,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    serialize, restore, reset,
  };
}

/*
  SkillGameSystem – Minispiel 3: Lichtfunken, ein 3D-Geschicklichkeitsspiel (Phase 22). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Entscheidet Runden, Bahn des Funkens, Treffer, Punkte, Ergebnis, Belohnung und Abnutzung. Die 3D-Szene (der Funke in der Kuppel, Tippen im Bild):
  js/world/SparkField.js. Meldungen und Ergebnis: js/ui/SkillView.js. Reson sieht zu: js/creature/Gaming.js. Daten und Texte: js/data/minigames.js
  (SKILL, SKILL_UI). Schnittstelle wie ReactionGameSystem/MemoryGameSystem (canRequest/start/stop/update/getPhase/isPlaying/onEvent/serialize/restore/reset),
  damit Gaming.js alle Spiele gleich behandelt. Die drei Systeme teilen absichtlich weiterhin keinen Code (Entscheidung dazu: PROJECT_STATE.md, Phase 22).

  Ablauf einer Runde (Schritt `step` innerhalb der Phase `playing`):
    intro      kurze Pause nach dem Start (SKILL.introSec), der Hinweistext steht
    wait       zufällige Pause (waitMin..waitMax), noch kein Funke; Tippen ins Bild tut nichts
    live       ein Funke schwebt auf seiner Bahn (lifeSec, bei „reduzierte Bewegung“ lifeSecCalm: der Funke steht dann still). Tippt der Spieler ihn
               an, zählt der Abstand des Tipps zur Funkenmitte (`offset` in Funkenradien): Stufen great/good/ok (3/2/1 Punkte). Ein Tipp außerhalb
               (`offset` > hitOffset) ist ein Fehltipp: Ereignis `stray`, kein Abzug, der Funke bleibt. Läuft die Zeit ab = entwischt (0 Punkte)
    feedback   Rückmeldung der Runde (feedbackSec), danach die nächste Runde oder das Ende
  Nichts kann verloren gehen: Fehltipps und entwischte Funken geben nie einen Abzug bei den Werten, nur weniger Punkte. Das Tempo bleibt über das
  ganze Spiel gleich (kein Verschärfen), nur die Bahn wechselt zufällig.

  Bahn: Der Funke kreist um den Ursprung (Mitte des Habitats): Position = (r cos a, h + bob sin(...), r sin a) mit a = Startwinkel + Richtung * Tempo * Alter
  (bei „reduzierte Bewegung“ Tempo 0 und kein Auf und Ab). Die Position wird hier berechnet (`getSpark()`), die Szene zeichnet sie nur, die Treffer-
  prüfung (Strahl durch den Tipp gegen diese Position) liegt in der Szene, die `tap(offset)` aufruft.

  Ende: `stop({ natural })`. Natürlich = alle Runden gespielt (passiert in `update` von selbst). Vorzeitig („Beenden“, kostet nichts): erst ab
  `minRoundsForReward` abgeschlossenen Runden zählt der gespielte Teil (Punkte stehen im Verhältnis zu ALLEN Runden). Wirkung, Splitter und Abnutzung
  wie bei den anderen Spielen: SKILL.effects * Anteil * Abnutzungsfaktor (bei natürlichem Ende plus Teilnahme), Splitter mindestens 1 (nur gezählt,
  Inventar kommt in Phase 37), Müdigkeit je Spiel getrennt.

  Zeit: `update(dt)` pro Frame (nur Laufzeit, kein Nachrechnen von Offline-Zeit). Zufall aus einem Seed (testbar).

  createSkillGameSystem({ needs, seed, isCalm }) ->
    {
      update(dt), canRequest() -> { ok, reason },       reason: 'busy' | 'tired' | null
      start(source) -> bool, tap(offset) -> { ok, kind, points? }, stop({ natural }) -> Ergebnis | null,
      getPhase() ('idle' | 'playing'), isPlaying(), getState(), getSpark(), getSource(), getFatigue(), getFactor(), getBest(), getResources(),
      getStats(), onEvent(fn), serialize(), restore(data), reset()
    }
    isCalm(): optional, liefert „reduzierte Bewegung“; wird bei jedem Start gelesen (Standard: nein)
  tap-Ergebnis `kind`: 'hit' (mit `points`), 'stray' (Fehltipp), 'ignored' (gerade kein Funke oder ungültiger Wert).
  getSpark() -> null oder { x, y, z, age, life, left, k }  (`left` Restzeit, `k` = Restanteil 0..1, nur im Schritt `live`)
  Ereignisse: { type, ... }
    start     { rounds, source, calm }
    round     { round, total }                              eine neue Runde beginnt (Pause läuft)
    spark     { round, x, y, z, life }                      ein Funke erscheint (Startposition)
    stray     { round }                                     Fehltipp
    feedback  { round, kind, points, total, offset, x, y, z }   kind: Stufe 'great' | 'good' | 'ok' oder 'miss' (entwischt); x/y/z = letzte Position
    done      { natural, counted, roundsDone, points, maxPoints, fraction, result, reaction, applied, factor, shards, shardsTotal,
                bestPoints, newBest, source }
                result: 'great' | 'good' | 'ok' (nur natürlich) oder 'stopped'; reaction: Reaktion aus Interaction.js oder null
  Format von serialize(): { version: 1, games, stopped, bestPoints, shards } (für Phase 44; Müdigkeit und laufendes Spiel nicht).
  NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { SKILL } from '../data/minigames.js';
import { createRng } from '../core/rng.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const SKILL_SAVE_VERSION = 1;

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createSkillGameSystem({ needs, seed = 9022, isCalm = () => false }) {
  const S = SKILL;
  const O = S.orbit;
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const listeners = new Set();

  const PER_ROUND_MAX = Math.max(...S.tiers.map((t) => t.points));
  const MAX_POINTS = S.rounds * PER_ROUND_MAX;
  const INTRO_SEC = Number.isFinite(S.introSec) ? S.introSec : 1;   // Schutz, falls die Daten den Schlüssel nicht haben

  let phase = 'idle';       // 'idle' | 'playing'
  let step = 'intro';       // 'intro' | 'wait' | 'live' | 'feedback' (nur in der Phase playing)
  let source = 'player';
  let calm = false;         // „reduzierte Bewegung“ beim Start gelesen
  let round = 0;            // laufende Runde, ab 1
  let roundsDone = 0;       // abgeschlossene Runden (Treffer, entwischt)
  let points = 0;
  let timer = 0;            // Restzeit von intro / wait / feedback
  let spark = null;         // { angle0, dir, speed, radius, height, bobPhase, age, life } im Schritt live
  let lastAngle = null;     // Startwinkel des vorigen Funkens
  let lastPos = { x: 0, y: 1, z: 0 };   // letzte Position (für die Rückmeldung)
  let fatigue = 0;          // 0..1, klingt ab; macht die Wirkung kleiner
  let games = 0;            // vollständig gespielte Spiele (Statistik)
  let stoppedGames = 0;     // vorzeitig beendete, aber gezählte Spiele
  let bestPoints = 0;       // bestes Ergebnis (Punkte eines vollständigen Spiels)
  let shards = 0;           // gesammelte Resonanzsplitter (Phase 37 macht daraus ein Inventar)

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Abfragen ----------
  const getFactor = () => Math.max(S.minFactor, 1 - fatigue);

  function canRequest() {
    if (phase !== 'idle') return { ok: false, reason: 'busy' };
    if (needs.get('energy') < S.minEnergy) return { ok: false, reason: 'tired' };
    return { ok: true, reason: null };
  }

  function resultTierFor(fraction) {
    for (const tier of S.resultTiers) if (fraction >= tier.min) return tier;
    return S.resultTiers[S.resultTiers.length - 1];
  }

  /** Stufe einer Runde nach ihren Punkten (3 = great, 2 = good, 1 = ok); die Tabelle ist absteigend sortiert. */
  function kindFor(pts) {
    for (const tier of S.tiers) if (tier.points <= pts) return tier.id;
    return S.tiers[S.tiers.length - 1].id;
  }

  /** Position des laufenden Funkens (siehe Kopf). */
  function positionOf(sp) {
    const a = sp.angle0 + (calm ? 0 : sp.dir * sp.speed * sp.age);
    const bob = calm ? 0 : O.bob * Math.sin(sp.age * 3 + sp.bobPhase);
    return { x: sp.radius * Math.cos(a), y: sp.height + bob, z: sp.radius * Math.sin(a) };
  }

  // ---------- Ablauf ----------
  /** Beginnt ein Spiel (source: 'player'). Gibt false zurück, wenn es nicht geht. Ob sie gerade frei ist, prüft Gaming. */
  function start(from = 'player') {
    if (!canRequest().ok) return false;
    phase = 'playing';
    step = 'intro';
    source = from === 'auto' ? 'auto' : 'player';
    calm = !!isCalm();
    round = 1;
    roundsDone = 0;
    points = 0;
    spark = null;
    lastAngle = null;
    timer = INTRO_SEC;
    emit({ type: 'start', rounds: S.rounds, source, calm });
    return true;
  }

  function beginRound() {
    step = 'wait';
    timer = rand(S.waitMin, S.waitMax);
    spark = null;
    emit({ type: 'round', round, total: S.rounds });
  }

  /** Neuer Startwinkel, mindestens `minAngleStep` vom vorigen entfernt (kürzester Winkelabstand). */
  function pickAngle() {
    for (let i = 0; i < 8; i += 1) {
      const a = rng() * TAU;
      if (lastAngle === null) return a;
      let d = Math.abs(a - lastAngle) % TAU;
      if (d > Math.PI) d = TAU - d;
      if (d >= O.minAngleStep) return a;
    }
    return (lastAngle + Math.PI) % TAU;   // Sicherung: gegenüber dem vorigen
  }

  function light() {
    const angle0 = pickAngle();
    lastAngle = angle0;
    spark = {
      angle0,
      dir: rng() < 0.5 ? -1 : 1,
      speed: rand(O.speedMin, O.speedMax),
      radius: rand(O.radiusMin, O.radiusMax),
      height: rand(O.heightMin, O.heightMax),
      bobPhase: rand(0, TAU),
      age: 0,
      life: calm ? S.lifeSecCalm : S.lifeSec,
    };
    step = 'live';
    const p = positionOf(spark);
    lastPos = p;
    emit({ type: 'spark', round, x: p.x, y: p.y, z: p.z, life: spark.life });
  }

  function finishRound(pts, offset) {
    roundsDone += 1;
    points += pts;
    step = 'feedback';
    timer = S.feedbackSec;
    emit({
      type: 'feedback', round, kind: pts > 0 ? kindFor(pts) : 'miss', points: pts, total: points, offset,
      x: lastPos.x, y: lastPos.y, z: lastPos.z,
    });
    spark = null;
  }

  /**
   * Der Spieler tippt ins Bild. `offset` = Abstand des Tipps zur Funkenmitte in Funkenradien (die Szene berechnet ihn aus dem Strahl durch den Tipp);
   * Infinity oder ein ungültiger Wert = der Tipp lag nicht in der Nähe.
   */
  function tap(offset) {
    if (phase !== 'playing' || step !== 'live' || !spark) return { ok: false, kind: 'ignored' };
    if (typeof offset !== 'number' || Number.isNaN(offset) || offset < 0) return { ok: false, kind: 'ignored' };
    if (offset > S.hitOffset) {
      emit({ type: 'stray', round });
      return { ok: true, kind: 'stray' };
    }
    let pts = 0;
    for (const tier of S.tiers) {
      if (offset <= tier.maxOffset) { pts = tier.points; break; }
    }
    if (pts === 0) pts = S.tiers[S.tiers.length - 1].points;   // Sicherung: innerhalb der Trefferfläche gibt es mindestens die kleinste Stufe
    finishRound(pts, offset);
    return { ok: true, kind: 'hit', points: pts };
  }

  /**
   * Ende des Spiels. natural: true = alle Runden gespielt, false = vorzeitig („Beenden“). Gibt das Ergebnis zurück (auch als Ereignis
   * `done`) oder null, wenn gerade nicht gespielt wurde.
   */
  function stop({ natural = false } = {}) {
    if (phase !== 'playing') return null;
    const maxFraction = clamp01(points / MAX_POINTS);
    const counted = natural || roundsDone >= S.minRoundsForReward;
    const fraction = counted ? maxFraction : 0;
    const factor = getFactor();

    const applied = {};
    let gained = 0;
    if (counted) {
      for (const k of Object.keys(S.effects)) applied[k] = S.effects[k] * fraction * factor;
      if (natural) for (const k of Object.keys(S.participation)) applied[k] = (applied[k] || 0) + S.participation[k] * factor;
      needs.adjustMany(applied);
      const R = S.shards;
      gained = Math.max(1, Math.round((R.base + fraction * R.perFrac) * Math.max(R.minFactor, factor)));
      shards += gained;
      fatigue = Math.min(1, fatigue + (natural ? S.fatiguePerGame : S.fatigueStopped));
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
    spark = null;
    emit(result);
    return result;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    if (fatigue > 0) fatigue = Math.max(0, fatigue - S.fatigueDecayPerSec * dt);
    if (phase !== 'playing') return;

    if (step === 'intro') {
      timer -= dt;
      if (timer <= 0) beginRound();
    } else if (step === 'wait') {
      timer -= dt;
      if (timer <= 0) light();
    } else if (step === 'live' && spark) {
      spark.age += dt;
      lastPos = positionOf(spark);
      if (spark.age >= spark.life) finishRound(0, Infinity);   // entwischt: 0 Punkte, kein Abzug
    } else if (step === 'feedback') {
      timer -= dt;
      if (timer <= 0) {
        if (roundsDone >= S.rounds) stop({ natural: true });
        else { round += 1; beginRound(); }
      }
    }
  }

  // ---------- Szene, Statistik, Speichern (für Phase 44) ----------
  /** Der laufende Funke (nur im Schritt `live`), sonst null. */
  function getSpark() {
    if (phase !== 'playing' || step !== 'live' || !spark) return null;
    const p = positionOf(spark);
    const left = Math.max(0, spark.life - spark.age);
    return { x: p.x, y: p.y, z: p.z, age: spark.age, life: spark.life, left, k: spark.life > 0 ? left / spark.life : 0 };
  }

  function getState() {
    return { phase, step, round, total: S.rounds, roundsDone, points, maxPoints: MAX_POINTS, calm };
  }

  const getStats = () => ({ games, stopped: stoppedGames, bestPoints, shards });

  function serialize() {
    return { version: SKILL_SAVE_VERSION, games, stopped: stoppedGames, bestPoints, shards };
  }

  /** Stellt die Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Laufendes Spiel und Müdigkeit werden nicht gespeichert. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== SKILL_SAVE_VERSION) return false;
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
    calm = false;
    round = 0;
    roundsDone = 0;
    points = 0;
    timer = 0;
    spark = null;
    lastAngle = null;
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
    getSpark,
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

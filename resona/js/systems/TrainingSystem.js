/*
  TrainingSystem – Training trainierbarer Fähigkeiten (Phase 23). Reine Logik, kein Three.js, kein DOM, kein Verhalten.
  Entscheidet Ablauf der Übung, Ausgang jedes Versuchs, Lernstand je Fähigkeit, Belohnung, Abnutzung und Statistik. Die Vorführung (Reson läuft,
  springt, bringt den Ball ...): js/creature/Training.js. Auswahl, Meldungen und Ergebnis: js/ui/TrainingPanel.js. Daten und Texte:
  js/data/training.js (SKILLS, LEVEL_TIERS, TRAINING_RULES, TRAINING_UI).

  Fähigkeiten: follow (Folgen), wait (Warten), jump (Springen), fetch (Objekt bringen), listen (Geräusche erkennen).
  Lernstand `level` 0..1 je Fähigkeit: wächst durch Üben, sinkt NIE (nicht durch Pause, nicht durch Abnutzung, nicht durch Abwesenheit),
  gezeigt nur über Wortstufen (`getTier`). Andere Systeme (Phase 24 Lernen u. a.) lesen ihn über `getLevel(id)`.

  Ablauf (Schritt `step` innerhalb der Phase `training`):
    intro      kurze Pause nach dem Start (TRAINING_RULES.introSec)
    cue        das Kommando steht (cueSec), Ereignis `cue`
    act        Reson führt die Fähigkeit vor. Der Ausgang (`kind`) steht beim Beginn fest (Ereignis `act`, mit `params` für die Vorführung).
               Der Schritt endet, wenn der Körper `actDone()` ruft, oder spätestens nach SKILLS[id].actMaxSec (Sicherung)
    feedback   Rückmeldung (feedbackSec), Ereignis `feedback`. Hier kann der Spieler loben (`praise()`, einmal je Versuch)
  Danach der nächste Versuch oder das Ende nach `attempts` Versuchen (natürlich).

  Ausgang eines Versuchs: `great` / `good` / `tried`. Die Wahrscheinlichkeit von `great` steigt, die von `tried` fällt linear mit dem Lernstand
  (TRAINING_RULES.chance). `tried` ist freundlich gemeint (kein Abzug, kein Vorwurf).

  Lernzuwachs je Versuch: gain[kind] * (1 - slowdown * level) * Lerntempo; Lerntempo = Abnutzung dieser Fähigkeit * Persönlichkeit (traitFactor) *
  Bindung (0,9..1,1). Alle drei sind begrenzt und nie ein Verbot. Auch `tried` lehrt etwas. Loben gibt zusätzlich praiseBonus * Zuwachs des Versuchs.
  Der Zuwachs eines abgeschlossenen Versuchs bleibt erhalten, auch wenn die Übung danach vorzeitig endet.

  Ende: `stop({ natural })`. Natürlich = alle Versuche gemacht (passiert in `update` von selbst). Vorzeitig („Beenden“, kostet nichts): ab
  `minAttemptsForReward` abgeschlossenen Versuchen zählt die Übung für die Belohnung. Belohnung = effects * (rewardBase + rewardPerFrac * Anteil) *
  Abnutzung, bei natürlichem Ende plus participation (Anteil = gewichtete Erfolge / Versuche, `resultWeights`). Abnutzung wächst je gezählter
  Übung der Fähigkeit und klingt ab (fatigueDecayPerSec).

  Zeit: `update(dt)` pro Frame (nur Laufzeit, kein Nachrechnen von Offline-Zeit). Zufall aus einem Seed (testbar).

  createTrainingSystem({ needs, personality, seed }) ->
    {
      update(dt), canRequest(skillId) -> { ok, reason },     reason: 'unknown' | 'busy' | 'tired' | null
      start(skillId, source) -> bool, actDone() -> bool, praise() -> { ok }, canPraise(), stop({ natural }) -> Ergebnis | null,
      getPhase() ('idle' | 'training'), isTraining(), getState(), getCurrentSkill(),
      getSkill(id), getAll(), getLevel(id), getTier(id), getFatigue(id), getFactor(id), getStats(),
      onEvent(fn), serialize(), restore(data), reset()
    }
    needs: NeedSystem (Energie prüfen, Belohnung, Bindungswert), personality: optionales PersonalitySystem (getWeight)
  Ereignisse: { type, ... }
    start     { skillId, attempts, level, tier, tierLabel, source }
    cue       { skillId, attempt, total }
    act       { skillId, attempt, total, kind, level, params }     params je Fähigkeit (siehe makeParams)
    feedback  { skillId, attempt, total, kind, gain, level, tier, tierLabel, tierUp }
    praise    { skillId, attempt, bonus, level, tier, tierLabel, tierUp }
    mastered  { skillId }        die oberste Stufe (MASTER_TIER) wurde erreicht (einmalig je Fähigkeit, Lernstand sinkt nie)
    done      { natural, counted, skillId, attemptsDone, attempts, tally, fraction, result, reaction, applied, factor,
                levelBefore, level, tierBefore, tier, tierLabel, tierUp, source }
                result: 'great' | 'good' | 'ok' (nur natürlich) oder 'stopped'; reaction: Reaktion aus Interaction.js oder null
  Format von serialize(): { version: 1, skills: { <id>: { level, sessions, successes } }, stopped } (für Phase 44; Müdigkeit und laufende Übung nicht).
  NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { SKILLS, SKILL_IDS, LEVEL_TIERS, MASTER_TIER, TRAINING_RULES } from '../data/training.js';
import { createRng } from '../core/rng.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const TRAINING_SAVE_VERSION = 1;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;

export function createTrainingSystem({ needs, personality = null, seed = 9023 }) {
  const R = TRAINING_RULES;
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const listeners = new Set();

  const skills = {};      // id -> { level, sessions, successes }
  const fatigue = {};     // id -> 0..1, klingt ab
  for (const id of SKILL_IDS) { skills[id] = { level: 0, sessions: 0, successes: 0 }; fatigue[id] = 0; }
  let stoppedSessions = 0;

  let phase = 'idle';     // 'idle' | 'training'
  let step = 'intro';     // 'intro' | 'cue' | 'act' | 'feedback' (nur in der Phase training)
  let skillId = null;
  let source = 'player';
  let attempt = 0;        // laufender Versuch, ab 1
  let attemptsDone = 0;   // abgeschlossene Versuche
  let timer = 0;          // Restzeit von intro / cue / feedback
  let actAge = 0;         // Dauer des laufenden Versuchs (Sicherung)
  let current = null;     // { kind, params } des laufenden Versuchs
  let lastGain = 0;       // Lernzuwachs des letzten Versuchs (für das Loben)
  let praised = false;    // in diesem Versuch schon gelobt
  let levelBefore = 0;    // Lernstand beim Start der Übung
  const tally = { great: 0, good: 0, tried: 0 };

  function emit(event) { for (const fn of listeners) fn(event); }

  // ---------- Abfragen ----------
  function tierFor(level) {
    let tier = LEVEL_TIERS[0];
    for (const t of LEVEL_TIERS) if (level >= t.min) tier = t;
    return tier;
  }

  const getFactor = (id) => Math.max(R.minFactor, 1 - (fatigue[id] || 0));

  function traitFactor(id) {
    if (!personality) return 1;
    const table = R.traitFactor[id];
    if (!table) return 1;
    let f = 1;
    for (const trait of Object.keys(table)) {
      const w = personality.getWeight(trait);
      if (w > 0) f *= 1 + w * (table[trait] - 1);
    }
    return clamp(f, R.traitClamp.min, R.traitClamp.max);
  }

  function bondFactor() {
    const b = needs ? needs.get('bond') : 0;
    return lerp(R.bondFactor.min, R.bondFactor.max, clamp01((Number.isFinite(b) ? b : 0) / 100));
  }

  /** Lerntempo einer Fähigkeit: Abnutzung * Persönlichkeit * Bindung. */
  const learnFactor = (id) => getFactor(id) * traitFactor(id) * bondFactor();

  function canRequest(id) {
    if (!SKILLS[id]) return { ok: false, reason: 'unknown' };
    if (phase !== 'idle') return { ok: false, reason: 'busy' };
    if (needs && needs.get('energy') < R.minEnergy) return { ok: false, reason: 'tired' };
    return { ok: true, reason: null };
  }

  function resultTierFor(fraction) {
    for (const tier of R.resultTiers) if (fraction >= tier.min) return tier;
    return R.resultTiers[R.resultTiers.length - 1];
  }

  // ---------- Versuch ----------
  /** Ausgang eines Versuchs nach dem Lernstand. */
  function rollKind(level) {
    const great = lerp(R.chance.great[0], R.chance.great[1], level);
    const tried = lerp(R.chance.tried[0], R.chance.tried[1], level);
    const good = Math.max(0, 1 - great - tried);
    const r = rng();
    if (r < great) return 'great';
    if (r < great + good) return 'good';
    return 'tried';
  }

  /** Neue Richtung (Radiant, Peilung wie atan2(dx, dz)), mindestens 1,1 rad von der vorigen entfernt. */
  function pickBearing(prev) {
    for (let i = 0; i < 8; i += 1) {
      const b = rng() * TAU;
      if (prev === null) return b;
      let d = Math.abs(b - prev) % TAU;
      if (d > Math.PI) d = TAU - d;
      if (d >= 1.1) return b;
    }
    return (prev + Math.PI) % TAU;   // Sicherung: gegenüber der vorigen
  }

  /**
   * Zahlen für die Vorführung (Training.js). Richtungen sind Peilungen (Radiant, Richtung (sin b, cos b) in x/z); Training.js macht daraus
   * Punkte relativ zu Resons Stand.
   *   follow  { legs, bearings[], legLen, standOff }
   *   wait    { hold (Sekunden), treatDist }
   *   jump    { hops (tatsächliche Sprünge, 0 = misslungen), planned, lift, hopSec, hopGapSec }
   *   fetch   { bearing, dist, standOff }
   *   listen  { bearing, dist, sound, wrong[2] (falsche Richtungen für good/tried) }
   */
  function makeParams(id, level, kind) {
    const D = SKILLS[id];
    switch (id) {
      case 'follow': {
        const legs = Math.max(D.legsMin, Math.round(lerp(D.legsMin, D.legsMax, level)));
        const bearings = [];
        let prev = null;
        for (let i = 0; i < legs; i += 1) { prev = pickBearing(prev); bearings.push(prev); }
        return { legs, bearings, legLen: D.legLen, standOff: D.standOff };
      }
      case 'wait':
        return { hold: lerp(D.holdMin, D.holdMax, level), treatDist: D.treatDist };
      case 'jump': {
        const planned = Math.max(D.hopsMin, Math.round(lerp(D.hopsMin, D.hopsMax, level)));
        let hops = planned;
        if (kind === 'good') hops = Math.max(1, planned - 1);
        else if (kind === 'tried') hops = 0;
        const lift = lerp(D.liftMin, D.liftMax, level) * (kind === 'good' ? 0.85 : 1);
        return { hops, planned, lift, hopSec: D.hopSec, hopGapSec: D.hopGapSec };
      }
      case 'fetch':
        return { bearing: rand(0, TAU), dist: D.ballDist, standOff: D.standOff };
      case 'listen': {
        const bearing = rand(0, TAU);
        const side = rng() < 0.5 ? -1 : 1;
        return {
          bearing, dist: D.sourceDist, sound: D.sounds[Math.floor(rng() * D.sounds.length)],
          wrong: [bearing + side * rand(1.8, 2.8), bearing - side * rand(1.0, 1.8)],
        };
      }
      default:
        return {};
    }
  }

  function beginAttempt() {
    attempt += 1;
    step = 'cue';
    timer = R.cueSec;
    praised = false;
    current = null;
    emit({ type: 'cue', skillId, attempt, total: R.attempts });
  }

  function beginAct() {
    const level = skills[skillId].level;
    const kind = rollKind(level);
    current = { kind, params: makeParams(skillId, level, kind) };
    step = 'act';
    actAge = 0;
    emit({ type: 'act', skillId, attempt, total: R.attempts, kind, level, params: current.params });
  }

  /** Rückmeldung zum Stufenwechsel; meldet den Meilenstein (oberste Stufe) einmalig. */
  function noteTier(before, after) {
    if (after.id !== before.id && after.id === MASTER_TIER) emit({ type: 'mastered', skillId });
  }

  function finishAttempt() {
    const sk = skills[skillId];
    const kind = current ? current.kind : 'tried';
    const before = tierFor(sk.level);
    const gain = R.gain[kind] * (1 - R.slowdown * sk.level) * learnFactor(skillId);
    sk.level = clamp01(sk.level + gain);
    lastGain = gain;
    attemptsDone += 1;
    tally[kind] += 1;
    if (kind !== 'tried') sk.successes += 1;
    step = 'feedback';
    timer = R.feedbackSec;
    const after = tierFor(sk.level);
    emit({
      type: 'feedback', skillId, attempt, total: R.attempts, kind, gain, level: sk.level,
      tier: after.id, tierLabel: after.label, tierUp: after.id !== before.id,
    });
    noteTier(before, after);
    current = null;
  }

  // ---------- Ablauf ----------
  /** Beginnt eine Übung (source: 'player'). Gibt false zurück, wenn es nicht geht. Ob sie gerade frei ist, prüft Training.js. */
  function start(id, from = 'player') {
    if (!canRequest(id).ok) return false;
    phase = 'training';
    step = 'intro';
    skillId = id;
    source = from === 'auto' ? 'auto' : 'player';
    attempt = 0;
    attemptsDone = 0;
    timer = R.introSec;
    actAge = 0;
    current = null;
    lastGain = 0;
    praised = false;
    tally.great = 0; tally.good = 0; tally.tried = 0;
    levelBefore = skills[id].level;
    const tier = tierFor(levelBefore);
    emit({ type: 'start', skillId: id, attempts: R.attempts, level: levelBefore, tier: tier.id, tierLabel: tier.label, source });
    return true;
  }

  /** Der Körper meldet: die Vorführung ist zu Ende. Gibt false zurück, wenn gerade kein Versuch läuft. */
  function actDone() {
    if (phase !== 'training' || step !== 'act') return false;
    finishAttempt();
    return true;
  }

  const canPraise = () => phase === 'training' && step === 'feedback' && !praised;

  /** Der Spieler lobt Reson nach einem Versuch (einmal je Versuch): zusätzlicher Lernzuwachs und ein kleiner Schub auf die Werte. */
  function praise() {
    if (!canPraise()) return { ok: false };
    praised = true;
    const sk = skills[skillId];
    const before = tierFor(sk.level);
    const bonus = lastGain * R.praiseBonus;
    sk.level = clamp01(sk.level + bonus);
    if (needs) {
      const scale = getFactor(skillId);
      const applied = {};
      for (const k of Object.keys(R.praiseEffects)) applied[k] = R.praiseEffects[k] * scale;
      needs.adjustMany(applied);
    }
    const after = tierFor(sk.level);
    emit({
      type: 'praise', skillId, attempt, bonus, level: sk.level,
      tier: after.id, tierLabel: after.label, tierUp: after.id !== before.id,
    });
    noteTier(before, after);
    return { ok: true };
  }

  /**
   * Ende der Übung. natural: true = alle Versuche gemacht, false = vorzeitig („Beenden“). Gibt das Ergebnis zurück (auch als Ereignis `done`)
   * oder null, wenn gerade nicht geübt wurde. Der Lernstand der abgeschlossenen Versuche bleibt in jedem Fall.
   */
  function stop({ natural = false } = {}) {
    if (phase !== 'training') return null;
    const id = skillId;
    const sk = skills[id];
    const counted = natural || attemptsDone >= R.minAttemptsForReward;

    let fraction = 0;
    if (attemptsDone > 0) {
      let sum = 0;
      for (const k of Object.keys(tally)) sum += tally[k] * R.resultWeights[k];
      fraction = clamp01(sum / attemptsDone);
    }

    const factor = getFactor(id);
    const applied = {};
    if (counted) {
      const scale = (R.rewardBase + R.rewardPerFrac * fraction) * factor;
      for (const k of Object.keys(R.effects)) applied[k] = R.effects[k] * scale;
      if (natural) for (const k of Object.keys(R.participation)) applied[k] = (applied[k] || 0) + R.participation[k] * factor;
      if (needs) needs.adjustMany(applied);
      fatigue[id] = Math.min(1, fatigue[id] + (natural ? R.fatiguePerSession : R.fatigueStopped));
      if (natural) sk.sessions += 1;
      else stoppedSessions += 1;
    }

    const tierBefore = tierFor(levelBefore);
    const tierAfter = tierFor(sk.level);
    const tier = resultTierFor(fraction);
    const result = {
      type: 'done', natural: !!natural, counted, skillId: id, attemptsDone, attempts: R.attempts,
      tally: { ...tally }, fraction,
      result: natural ? tier.id : 'stopped', reaction: natural ? tier.reaction : null,
      applied, factor,
      levelBefore, level: sk.level, tierBefore: tierBefore.id, tier: tierAfter.id, tierLabel: tierAfter.label,
      tierUp: tierAfter.id !== tierBefore.id, source,
    };
    phase = 'idle';
    step = 'intro';
    skillId = null;
    current = null;
    emit(result);
    return result;
  }

  // ---------- Zeit ----------
  function update(dt) {
    if (!(dt > 0)) return;
    for (const id of SKILL_IDS) if (fatigue[id] > 0) fatigue[id] = Math.max(0, fatigue[id] - R.fatigueDecayPerSec * dt);
    if (phase !== 'training') return;

    if (step === 'intro') {
      timer -= dt;
      if (timer <= 0) beginAttempt();
    } else if (step === 'cue') {
      timer -= dt;
      if (timer <= 0) beginAct();
    } else if (step === 'act') {
      actAge += dt;
      if (actAge >= SKILLS[skillId].actMaxSec) finishAttempt();   // Sicherung: ein hängender Versuch endet, wie er ist
    } else if (step === 'feedback') {
      timer -= dt;
      if (timer <= 0) {
        if (attemptsDone >= R.attempts) stop({ natural: true });
        else beginAttempt();
      }
    }
  }

  // ---------- Zugriff, Statistik, Speichern (für Phase 24 und 44) ----------
  function describe(id) {
    const sk = skills[id];
    const tier = tierFor(sk.level);
    return { id, label: SKILLS[id].label, level: sk.level, tier: tier.id, tierLabel: tier.label, sessions: sk.sessions, successes: sk.successes, fatigue: fatigue[id] };
  }

  function getSkill(id) { return skills[id] ? describe(id) : null; }

  function getAll() {
    const out = {};
    for (const id of SKILL_IDS) out[id] = describe(id);
    return out;
  }

  function getState() {
    return {
      phase, step, skillId, attempt, total: R.attempts, attemptsDone,
      canPraise: canPraise(), level: skillId ? skills[skillId].level : 0,
    };
  }

  function getStats() {
    let sessions = 0;
    let successes = 0;
    for (const id of SKILL_IDS) { sessions += skills[id].sessions; successes += skills[id].successes; }
    return { sessions, stopped: stoppedSessions, successes };
  }

  function serialize() {
    const out = {};
    for (const id of SKILL_IDS) {
      const sk = skills[id];
      out[id] = { level: Math.round(sk.level * 10000) / 10000, sessions: sk.sessions, successes: sk.successes };
    }
    return { version: TRAINING_SAVE_VERSION, skills: out, stopped: stoppedSessions };
  }

  /** Stellt Lernstände und Statistik wieder her. Gibt false zurück, wenn das Format nicht passt. Müdigkeit und laufende Übung werden nicht gespeichert. */
  function restore(data) {
    if (!data || typeof data !== 'object' || data.version !== TRAINING_SAVE_VERSION || !data.skills || typeof data.skills !== 'object') return false;
    const whole = (v) => (Number.isFinite(v) && v > 0 ? Math.min(1e9, Math.floor(v)) : 0);
    for (const id of SKILL_IDS) {
      const d = data.skills[id];
      if (!d || typeof d !== 'object') continue;
      skills[id].level = Number.isFinite(d.level) ? clamp01(d.level) : 0;
      skills[id].sessions = whole(d.sessions);
      skills[id].successes = whole(d.successes);
    }
    stoppedSessions = whole(data.stopped);
    return true;
  }

  function reset() {
    phase = 'idle';
    step = 'intro';
    skillId = null;
    source = 'player';
    attempt = 0;
    attemptsDone = 0;
    timer = 0;
    actAge = 0;
    current = null;
    lastGain = 0;
    praised = false;
    levelBefore = 0;
    tally.great = 0; tally.good = 0; tally.tried = 0;
    stoppedSessions = 0;
    for (const id of SKILL_IDS) { skills[id].level = 0; skills[id].sessions = 0; skills[id].successes = 0; fatigue[id] = 0; }
  }

  return {
    update, canRequest, start, actDone, praise, canPraise, stop,
    getPhase: () => phase,
    isTraining: () => phase === 'training',
    getState,
    getCurrentSkill: () => skillId,
    getSource: () => source,
    getSkill, getAll,
    getLevel: (id) => (skills[id] ? skills[id].level : 0),
    getTier: (id) => (skills[id] ? tierFor(skills[id].level) : null),
    getFatigue: (id) => fatigue[id] || 0,
    getFactor,
    getStats,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    serialize, restore, reset,
  };
}

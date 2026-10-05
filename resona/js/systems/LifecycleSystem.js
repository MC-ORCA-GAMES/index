/*
  LifecycleSystem – der Lebenszyklus der Kreatur (Phase 25).
  Reine Logik, kein Three.js. Zahlen und Texte stehen in js/data/lifecycle.js.

  Stufen: Ei/Keim -> Baby -> Jungtier -> Heranwachsende Form -> Erwachsene Form (-> Spezialform, nur über die Evolution, Phase 26/27).
  Wie Reson wächst:
    - Jede Stufe hat einen Fortschritt 0..1. Er wächst mit der Laufzeit; Pflege bestimmt nur das TEMPO (Mittel aus Sättigung, Energie,
      Hygiene, Glück, Gesundheit, Bindung): gute Pflege wächst schneller, schlechte langsamer, aber nie steht es still (`care.minRate`).
    - Das Ei braucht keine Pflege (die Bedürfnisse ruhen, solange sie im Ei ist), nur Wärme: Antippen (`warm()`) gibt einen kleinen Schub
      mit Pause und Obergrenze.
    - Ist der Fortschritt voll, beginnt ein kurzer Übergang (`growing`, beim Ei das Schlüpfen), danach gilt die neue Stufe (`stage`).
    - Nichts geht zurück, nichts stirbt, nichts wird abgezogen. Abwesenheit schadet nicht (siehe `advance`).
  Das Aussehen (Größe, Kopf, Stimme, Tempo) gleitet innerhalb der Stufe zum Aussehen der nächsten Stufe (`getLook()`), damit das Wachsen
  sichtbar ist und es keine Sprünge gibt.

  Dieses System kennt keine Szene: `Growth.js` (Körper, Ei, Sichtbarkeit), `LifecycleNotice.js` (Meldungen) und `NeedsPanel.js` (Zeile)
  lesen es nur. Es steuert nichts außer über Abfragen (`isDormant`, `can`, `getLook`).

  createLifecycleSystem({ needs, getGrowthFactor, startStage }) ->
    {
      update(dt), advance(seconds) -> Fortschritt (Anteil, der gutgeschrieben wurde),
      warm() -> { ok, effective },
      promote('special') -> bool,                     Einstieg für die Evolution (Phase 26/27), nur von „Erwachsen“ aus
      getStageId(), getStage() (Datenobjekt), getProgress(), getRate(), getLook() (gemeinsames Objekt, nur lesen),
      getTransition() -> { from, to, u } | null (gemeinsames Objekt, nur lesen),
      isDormant() (noch im Ei), can(ability), getAge() (Sekunden), getAgeText(), getProgressWord(), getSummary(), getStats(),
      getRevision(), onEvent(fn) -> abmelden,
      setStage(id, { progress }), setTimeScale(f), setGrowthTrait(f), serialize(), restore(data) -> bool, reset(stage)
    }
  Ereignisse (onEvent): { type: 'growing', from, to }   Übergang beginnt (Fortschritt voll)
                        { type: 'stage', from, to, hatched }   neue Stufe gilt (hatched: aus dem Ei geschlüpft)
                        { type: 'warm', effective, count }   Ei wurde gewärmt
  Format von serialize(): { version: 1, stage, progress, ageSec, warms, warmTaps } (Phase 44).
  needs: optional (NeedSystem, nur `get(id)` wird gelesen); getGrowthFactor: optional () -> Zahl (verborgenes Merkmal „Wachstum“, Phase 28).
  NICHT im Browser getestet, nicht ausgeführt, alle Zahlen sind Startwerte.
*/
import { LIFE_PATH, LIFE_STAGES, LIFE_RULES, LIFE_UI } from '../data/lifecycle.js';

/** Version des gespeicherten Formats (für Phase 44, Save-Versionierung). */
export const LIFECYCLE_SAVE_VERSION = 1;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => u * u * (3 - 2 * u);

export function createLifecycleSystem({ needs = null, getGrowthFactor = null, startStage = LIFE_RULES.startStage } = {}) {
  const R = LIFE_RULES;

  let stageId = LIFE_STAGES[startStage] ? startStage : R.startStage;
  let progress = 0;            // 0..1 in der aktuellen Stufe
  let transition = null;       // { from, to, t, dur } oder null
  let ageSec = 0;              // Alter in Sekunden (Laufzeit plus Zeit in der Abwesenheit)
  let warms = 0;               // wirksame Wärme-Tipps in der Eistufe (Obergrenze)
  let warmTaps = 0;            // alle Tipps aufs Ei insgesamt (Statistik)
  let warmCooldown = 0;
  let timeScale = R.timeScale;
  let growthTrait = 1;       // Phase 28 Teil A: verborgenes Merkmal „Wachstum“ (0,92–1,1), getrennt von `timeScale` (Dev/Debug)
  let revision = 0;
  let wordIndex = 0;
  const listeners = new Set();

  const look = { size: 1, head: 1, pitch: 1, speed: 1 };    // gemeinsames Objekt, wird bei jedem Aufruf überschrieben
  const trans = { from: null, to: null, u: 0 };             // dasselbe für den Übergang

  const emit = (event) => { for (const fn of listeners) fn(event); };

  function nextOf(id) {
    const i = LIFE_PATH.indexOf(id);
    return i >= 0 && i < LIFE_PATH.length - 1 ? LIFE_PATH[i + 1] : null;
  }

  // ---------- Tempo ----------
  /** Pflegefaktor: Mittel der Pflegewerte, gleitend zwischen Mindest- und Höchsttempo. Im Ei und ohne NeedSystem 1. */
  function careFactor() {
    if (!needs || stageId === 'germ') return 1;
    const C = R.care;
    let sum = 0;
    let wsum = 0;
    for (const id of Object.keys(C.weights)) {
      const v = needs.get(id);
      if (!Number.isFinite(v)) continue;
      sum += C.weights[id] * (v / 100);
      wsum += C.weights[id];
    }
    if (!(wsum > 0)) return 1;
    const u = clamp((sum / wsum - C.poorBelow) / (C.goodAbove - C.poorBelow), 0, 1);
    return lerp(C.minRate, C.maxRate, u);
  }

  function growthFactor() {
    if (!getGrowthFactor) return 1;
    const f = getGrowthFactor();
    return Number.isFinite(f) ? clamp(f, R.growthFactorRange[0], R.growthFactorRange[1]) : 1;
  }

  /** Aktuelles Wachstumstempo (1 = Normalzeit). */
  function getRate() { return careFactor() * growthFactor() * timeScale * growthTrait; }

  // ---------- Fortschrittswort ----------
  function computeWordIndex() {
    const words = LIFE_STAGES[stageId].words;
    let idx = 0;
    for (let i = 0; i < words.length; i++) if (progress >= words[i][0]) idx = i;
    return idx;
  }

  // ---------- Stufenwechsel ----------
  function startTransition(to) {
    transition = { from: stageId, to, t: 0, dur: Math.max(0, LIFE_STAGES[stageId].transitionSec || 0) };
    revision += 1;
    emit({ type: 'growing', from: stageId, to });
  }

  function finishTransition() {
    const { from, to } = transition;
    transition = null;
    stageId = to;
    progress = 0;
    warms = 0;
    warmCooldown = 0;
    wordIndex = 0;
    revision += 1;
    emit({ type: 'stage', from, to, hatched: from === 'germ' });
  }

  // ---------- Zeit ----------
  /** Pro Frame mit echten Sekunden. */
  function update(dt) {
    if (!(dt > 0)) return;
    const d = Math.min(dt, R.maxDt);
    ageSec += d;
    if (warmCooldown > 0) warmCooldown = Math.max(0, warmCooldown - d);

    if (transition) {
      transition.t += d;
      if (transition.t >= transition.dur) finishTransition();
      return;
    }

    const def = LIFE_STAGES[stageId];
    if (!(def.durationSec > 0)) return;           // Endstufen wachsen nicht weiter
    progress = Math.min(1, progress + (d * getRate()) / def.durationSec);
    const w = computeWordIndex();
    if (w !== wordIndex) { wordIndex = w; revision += 1; }
    if (progress >= 1) {
      const to = nextOf(stageId);
      if (to) startTransition(to);
    }
  }

  /**
   * Zeit in der Abwesenheit (Phase 45). Das Alter zählt voll, der Fortschritt anteilig (`offlineFactor`, mit dem Pflegetempo von jetzt)
   * und höchstens bis zum Ende der aktuellen Stufe. Es beginnt hier KEIN Übergang: der Wechsel passiert beim nächsten `update`,
   * live und sichtbar. Gibt den gutgeschriebenen Anteil zurück.
   */
  function advance(seconds) {
    if (!(seconds > 0)) return 0;
    const sec = Math.min(seconds, R.offlineMaxSec);
    ageSec += sec;
    if (transition) return 0;
    const def = LIFE_STAGES[stageId];
    if (!(def.durationSec > 0) || !nextOf(stageId)) return 0;
    const before = progress;
    progress = Math.min(1, progress + (sec * R.offlineFactor * getRate()) / def.durationSec);
    const w = computeWordIndex();
    if (w !== wordIndex) { wordIndex = w; revision += 1; }
    return progress - before;
  }

  // ---------- Ei wärmen ----------
  /** Antippen des Eis. Immer ok (das Ei reagiert), wirksam nur mit Pause und bis zur Obergrenze. */
  function warm() {
    if (stageId !== 'germ' || transition) return { ok: false, effective: false };
    warmTaps += 1;
    if (warmCooldown > 0 || warms >= R.warm.maxPerStage) return { ok: true, effective: false };
    warms += 1;
    warmCooldown = R.warm.cooldownSec;
    progress = Math.min(1, progress + R.warm.bonusSec / LIFE_STAGES.germ.durationSec);
    const w = computeWordIndex();
    if (w !== wordIndex) { wordIndex = w; revision += 1; }
    emit({ type: 'warm', effective: true, count: warms });
    return { ok: true, effective: true };
  }

  // ---------- Einstieg für die Evolution (Phase 26/27) ----------
  /** Spezialform betreten (nur aus „Erwachsen“, nicht während eines Übergangs). Gibt true zurück, wenn der Übergang beginnt. */
  function promote(id) {
    if (id !== 'special' || stageId !== 'adult' || transition) return false;
    startTransition('special');
    return true;
  }

  // ---------- Abfragen ----------
  /** Aussehen jetzt: gleitend vom Anfang der Stufe zum Anfang der nächsten (im Übergang: schon das der nächsten). */
  function getLook() {
    const a = LIFE_STAGES[stageId].look;
    const nextId = transition ? transition.to : nextOf(stageId);
    const b = nextId ? LIFE_STAGES[nextId].look : a;
    // Im Übergang: mindestens so weit wie der Fortschritt; aus der Endstufe (Fortschritt 0, `promote`) gleitet es mit der Übergangszeit (Phase 26)
    const u = transition ? Math.max(ease(progress), ease(clamp(transition.t / Math.max(transition.dur, 0.001), 0, 1))) : (nextId ? ease(progress) : 0);
    look.size = lerp(a.size, b.size, u);
    look.head = lerp(a.head, b.head, u);
    look.pitch = lerp(a.pitch, b.pitch, u);
    look.speed = lerp(a.speed, b.speed, u);
    return look;
  }

  function getTransition() {
    if (!transition) return null;
    trans.from = transition.from;
    trans.to = transition.to;
    trans.u = transition.dur > 0 ? clamp(transition.t / transition.dur, 0, 1) : 1;
    return trans;
  }

  const isDormant = () => stageId === 'germ';

  /** Ob eine Fähigkeit in dieser Stufe geht (z. B. 'training'). Unbekannte Schlüssel gehen. */
  function can(ability) { return LIFE_STAGES[stageId].abilities[ability] !== false; }

  function getProgressWord() {
    const words = LIFE_STAGES[stageId].words;
    return words[Math.min(wordIndex, words.length - 1)][1];
  }

  function getAgeText() {
    const A = LIFE_UI.age;
    if (ageSec < 120) return A.justNow;
    if (ageSec < 3600) return Math.floor(ageSec / 60) + ' ' + A.minutes;
    if (ageSec < 48 * 3600) return Math.floor(ageSec / 3600) + ' ' + A.hours;
    const days = Math.floor(ageSec / 86400);
    return days + ' ' + (days === 1 ? A.day : A.days);
  }

  function getSummary() {
    const def = LIFE_STAGES[stageId];
    return {
      stageId, label: def.label, progress, word: getProgressWord(), ageText: getAgeText(),
      dormant: isDormant(), growing: transition !== null,
    };
  }

  // ---------- Setzen (Start, Debug, Laden) ----------
  /** Setzt die Stufe direkt, ohne Übergang und ohne Ereignis (Start, Laden, Debug). */
  function setStage(id, { progress: p = 0 } = {}) {
    if (!LIFE_STAGES[id]) return false;
    stageId = id;
    progress = clamp(Number.isFinite(p) ? p : 0, 0, 1);
    transition = null;
    warms = 0;
    warmCooldown = 0;
    wordIndex = computeWordIndex();
    revision += 1;
    return true;
  }

  /** Phase 28 Teil A: Faktor des verborgenen Merkmals „Wachstum“ (eng begrenzt, 1 = unverändert). */
  function setGrowthTrait(f) { growthTrait = Number.isFinite(f) ? clamp(f, 0.5, 2) : 1; }

  function setTimeScale(f) { timeScale = Number.isFinite(f) ? clamp(f, 0, 1000) : 1; }

  // ---------- Speichern (Phase 44) ----------
  function serialize() {
    return { version: LIFECYCLE_SAVE_VERSION, stage: stageId, progress, ageSec, warms, warmTaps };
  }

  function restore(data) {
    if (!data || typeof data !== 'object' || !LIFE_STAGES[data.stage]) return false;
    setStage(data.stage, { progress: data.progress });
    ageSec = Number.isFinite(data.ageSec) && data.ageSec > 0 ? data.ageSec : 0;
    warms = Number.isInteger(data.warms) && data.warms > 0 ? Math.min(data.warms, R.warm.maxPerStage) : 0;
    warmTaps = Number.isInteger(data.warmTaps) && data.warmTaps > 0 ? data.warmTaps : 0;
    return true;
  }

  function reset(stage = R.startStage) {
    setStage(LIFE_STAGES[stage] ? stage : R.startStage);
    ageSec = 0;
    warmTaps = 0;
  }

  wordIndex = computeWordIndex();

  return {
    update, advance, warm, promote,
    getStageId: () => stageId,
    getStage: () => LIFE_STAGES[stageId],
    getProgress: () => progress,
    getRate, getLook, getTransition, isDormant, can,
    getAge: () => ageSec,
    getAgeText, getProgressWord, getSummary,
    getStats: () => ({ warmTaps, warms }),
    getRevision: () => revision,
    onEvent(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setStage, setTimeScale, setGrowthTrait, serialize, restore, reset,
  };
}

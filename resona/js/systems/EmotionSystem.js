/*
  EmotionSystem – Emotionen der Kreatur (Phase 13). Reine Logik, kein Three.js, kein DOM.

  Zehn Emotionen (Daten: js/data/emotions.js): glücklich, neugierig, müde, hungrig, einsam, aufgeregt,
  zufrieden, vorsichtig, überrascht, angeschlagen (Phase 17, <- Gesundheit). Jede hat eine Stärke 0..1, die aus zwei Quellen kommt (das Maximum zählt):
    Grundstimmung  langsam aus den Bedürfnissen (hungrig <- Sättigung, müde <- Energie, glücklich <- Glück,
                   neugierig <- niedriger Neugier-Wert, angeschlagen <- niedrige Gesundheit, zufrieden <- alle Pflegewerte gut) und einsam aus der
                   Zeit ohne Zuwendung, WÄHREND das Spiel läuft (nie aus Offline-Zeit, höchstens 0.55)
    Impulse        kurz durch Ereignisse (Antippen, Serie schneller Taps -> aufgeregt, Füttern nach Geschmack,
                   freundliches Ablehnen), klingen mit der Halbwertszeit der Emotion ab
  Die Persönlichkeit färbt Impulse und Einsamkeit: `personality.getModifier('emotion', id)`.
  Dominant ist die stärkste Emotion; ein Wechsel braucht einen Vorsprung (`switchMargin`), unter `minShow`
  gibt es keine (`id: null`). Nichts davon bestraft: Emotionen verändern nur den Ausdruck, nicht die Werte.

  createEmotionSystem({ needs, personality }) ->
    { update(dt), onReaction(event), onFeed(event), onPlay(event), onGame(event), noteCare(), getCurrent(), getLevels(), onChange(fn), reset() }
  getCurrent() -> { id | null, label, intensity }  (gemeinsames Objekt, nur lesen, nicht speichern)
  onChange(fn(current, prevId)) liefert eine Abmelde-Funktion.
  Emotionen werden nicht gespeichert: sie leiten sich aus Bedürfnissen und Ereignissen ab (Phase 44 braucht nichts).
  NICHT im Browser getestet, alle Zahlen sind Startwerte.
*/
import { EMOTIONS, EMOTION_IDS, EMOTION_RULES, EMOTION_UI } from '../data/emotions.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** 0 bei `from`, 1 bei `to` (auch absteigend, from > to). */
const ramp = (v, from, to) => clamp01((v - from) / (to - from));

export function createEmotionSystem({ needs, personality = null }) {
  const R = EMOTION_RULES;
  const pm = (id) => (personality ? personality.getModifier('emotion', id) : 1);

  const base = {};      // Grundstimmung (geglättet)
  const impulse = {};   // Ereignis-Impulse (klingen ab)
  const level = {};     // Maximum aus beiden
  for (const id of EMOTION_IDS) { base[id] = 0; impulse[id] = 0; level[id] = 0; }

  let sinceCare = 0;    // Sekunden ohne Zuwendung (nur Laufzeit)
  const current = { id: null, label: EMOTION_UI.none, intensity: 0 };
  const listeners = new Set();

  function targets() {
    const t = {};
    for (const id of EMOTION_IDS) t[id] = 0;
    for (const id of Object.keys(R.fromNeeds)) {
      const r = R.fromNeeds[id];
      t[id] = ramp(needs.get(r.need), r.from, r.to) * r.max;
    }
    let low = 100;
    for (const n of R.content.needs) low = Math.min(low, needs.get(n));
    t.content = ramp(low, R.content.from, R.content.to) * R.content.max;
    t.lonely = Math.min(1, ramp(sinceCare, R.lonely.startSec, R.lonely.startSec + R.lonely.rampSec) * R.lonely.max * pm('lonely'));
    return t;
  }

  function choose() {
    let best = null;
    for (const id of EMOTION_IDS) if (best === null || level[id] > level[best]) best = id;
    const cur = current.id;
    if (cur === null || level[cur] < R.minShow) return level[best] >= R.minShow ? best : null;
    if (best !== cur && level[best] > level[cur] + R.switchMargin) return best;
    return cur;
  }

  function update(dt) {
    sinceCare += dt;
    const k = 1 - Math.exp(-R.smoothPerSec * dt);
    const t = targets();
    for (const id of EMOTION_IDS) {
      base[id] += (t[id] - base[id]) * k;
      impulse[id] *= Math.pow(0.5, dt / EMOTIONS[id].halfLife);
      level[id] = Math.max(base[id], impulse[id]);
    }
    const next = choose();
    const prev = current.id;
    current.id = next;
    current.label = next ? EMOTIONS[next].label : EMOTION_UI.none;
    current.intensity = next ? level[next] : 0;
    if (next !== prev) for (const fn of listeners) fn(current, prev);
  }

  function addImpulse(id, value) {
    if (!EMOTIONS[id]) return;
    impulse[id] = Math.max(impulse[id], Math.min(1, value * pm(id)));
  }
  function addAll(map) { if (map) for (const id of Object.keys(map)) addImpulse(id, map[id]); }

  /** Zuwendung des Spielers (Antippen, Füttern): setzt die Einsamkeit zurück. */
  function noteCare() { sinceCare = 0; }

  /** Ereignis von interaction.onReaction. Reaktionen mit anderer Quelle als 'tap' (z. B. Füttern) zählen hier nicht. */
  function onReaction(event) {
    if (event.source && event.source !== 'tap') return;
    noteCare();
    addAll(R.onReaction[event.emotion]);
    const ex = R.excitedStreak;
    if (event.streak >= ex.from) addImpulse('excited', Math.min(ex.max, (event.streak - ex.from + 1) * ex.perTap));
  }

  /** Ereignis von feeding.onEvent. */
  function onFeed(event) {
    if (event.type === 'start') { noteCare(); return; }
    if (event.type === 'done') { noteCare(); addAll(R.onFeed[event.enjoyment]); return; }
    if (event.type === 'refused' && event.reason === 'full') { noteCare(); addAll(R.onFeed.refused); }
  }

  /** Ereignis von toys.onEvent (Phase 18): Spielbeginn zählt als Zuwendung, ein gezähltes Spiel gibt Impulse nach Passung und Stimmung des Spielzeugs. */
  function onPlay(event) {
    const care = event.source !== 'auto';   // Phase 19: von selbst gespielt zählt nicht als Zuwendung des Spielers (Einsamkeit bleibt)
    if (event.type === 'start') { if (care) noteCare(); return; }
    if (event.type === 'done' && event.counted) {
      if (care) noteCare();
      addAll(R.onPlay[event.enjoyment]);
      addAll(event.mood);
    }
  }

  /**
   * Ereignis von game.onEvent (Phase 20, Reaktionsspiel): der Start zählt als Zuwendung, ein gezähltes Spiel gibt Impulse nach Ergebnisstufe
   * (great -> wie „loves“, good -> „likes“, ok -> „okay“, vorzeitig beendet: keine Impulse). Das Spiel macht der Spieler mit Reson, also immer Zuwendung.
   */
  function onGame(event) {
    if (event.type === 'start') { noteCare(); return; }
    if (event.type === 'done' && event.counted) {
      noteCare();
      const key = { great: 'loves', good: 'likes', ok: 'okay' }[event.result];
      if (key) addAll(R.onPlay[key]);
    }
  }

  function reset() {
    sinceCare = 0;
    for (const id of EMOTION_IDS) { base[id] = 0; impulse[id] = 0; level[id] = 0; }
    current.id = null; current.label = EMOTION_UI.none; current.intensity = 0;
  }

  return {
    update, onReaction, onFeed, onPlay, onGame, noteCare, reset,
    getCurrent: () => current,
    getLevels: () => ({ ...level }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

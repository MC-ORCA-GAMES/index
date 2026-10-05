/*
  EmotionExpression – macht die Emotion am Körper sichtbar (Phase 13).
  Eine dauerhafte, sanft überblendete „Stimmungsschicht“ über dem Idle-Verhalten, getrennt vom EmotionSystem:
    Augenhöhe (müde = halb zu, aufgeregt = weit), Augen-, Kern- und Kristallleuchten, Kopfneigung
    (müde/einsam = gesenkt, neugierig = leicht gehoben), Flossen (offen = froh/aufgeregt, angelegt = vorsichtig/müde).
  Zusätzlich beim Wechsel zu einer Emotion mit `gesture` (Daten) eine kleine Geste, höchstens alle
  `gestureMinGap` Sekunden, nur ab `gestureMinLevel`, nur im Zustand IDLE (nie mitten in Gehen, Fressen, Reaktion).
  Nicht nur Farbe: Haltung, Augen und Leuchtstärke tragen die Information, die Oberfläche zeigt zusätzlich das Wort.

  REIHENFOLGE (wichtig): läuft NACH idle/behavior/locomotion und VOR interaction. Idle setzt Augenhöhe (`eyes.scale.y`),
  Kopf-Pitch (`head.rotation.x`), Flossen (`fins.*.rotation.z`), Kern- und Kristallleuchten jeden Frame absolut, hier wird
  darauf multipliziert bzw. addiert (nichts summiert sich über Frames). Das Augenleuchten gehört dieser Schicht
  (absolut), Interaction überschreibt es nur während einer kurzen Reaktion. Kern in „reduzierte Bewegung“: Idle schreibt ihn
  dann nicht, deshalb absolut aus dem Startwert. Berührt NICHT: Augen x/z-Skalierung (Interaction), Position, Körperskalierung.
  „Reduzierte Bewegung“: halbe Stärke, keine Gesten (triggerGesture tut dann ohnehin nichts).

  createEmotionExpression({ creature, idle, behavior, emotion }) -> { update(dt), dispose() }
  Pose-Werte in js/data/emotions.js (EMOTIONS[id].pose), CONFIG.creature.emotion. NICHT im Browser getestet.
*/
import { CONFIG } from '../config.js';
import { EMOTIONS, EMOTION_RULES } from '../data/emotions.js';
import { prefersReducedMotion } from '../core/env.js';
import { STATES } from './Behavior.js';

const NEUTRAL = Object.freeze({ eyeOpen: 1, eyeGlow: 1, core: 1, crystal: 1, headPitch: 0, finSpread: 0 });
const KEYS = Object.keys(NEUTRAL);

export function createEmotionExpression({ creature, idle, behavior, emotion }) {
  const cfg = CONFIG.creature.emotion;
  const calm = prefersReducedMotion();
  const strength = calm ? cfg.calmFactor : 1;
  const { parts } = creature;

  const eyes = [parts.eyes.left, parts.eyes.right];
  const eyeMat = parts.eyes.left.getObjectByName('eyeball').material;   // gleiches Material für beide Augen
  const base = { eye: eyeMat.emissiveIntensity, core: parts.core.material.emissiveIntensity };

  const cur = { ...NEUTRAL };          // aktuell angezeigte Pose (geglättet)
  const target = { ...NEUTRAL };
  let clock = 0;
  let lastGestureAt = -Infinity;

  // Geste beim Wechsel zu einer Emotion (selten, nur im Ruhezustand)
  const offChange = emotion.onChange((now, prevId) => {
    if (!now.id || prevId === null) return;   // erster Wechsel aus „keine Emotion“ bleibt still
    const gesture = EMOTIONS[now.id].gesture;
    if (!gesture || calm) return;
    if (now.intensity < EMOTION_RULES.gestureMinLevel) return;
    if (clock - lastGestureAt < EMOTION_RULES.gestureMinGap) return;
    if (behavior.getState() !== STATES.IDLE) return;
    lastGestureAt = clock;
    idle.triggerGesture(gesture);
  });

  function update(dt) {
    clock += dt;
    const e = emotion.getCurrent();
    const pose = e.id ? EMOTIONS[e.id].pose : NEUTRAL;
    const k = e.id ? Math.min(1, e.intensity) * strength : 0;
    for (const key of KEYS) target[key] = NEUTRAL[key] + (pose[key] - NEUTRAL[key]) * k;

    const f = 1 - Math.exp(-cfg.blendPerSec * dt);
    for (const key of KEYS) cur[key] += (target[key] - cur[key]) * f;

    // Augen: Höhe auf Idles Blinzelwert multiplizieren (Idle setzt scale.y jeden Frame neu), Leuchten absolut
    for (const eye of eyes) eye.scale.y *= cur.eyeOpen;
    eyeMat.emissiveIntensity = base.eye * cur.eyeGlow;

    // Kern (ohne „reduzierte Bewegung“ schreibt Idle ihn jeden Frame) und Kristall (Idle schreibt immer)
    if (calm) parts.core.material.emissiveIntensity = base.core * cur.core;
    else parts.core.material.emissiveIntensity *= cur.core;
    parts.crystal.material.emissiveIntensity *= cur.crystal;

    // Kopf und Flossen: additiv auf Idles Absolutwerte
    parts.head.rotation.x += cur.headPitch;
    parts.fins.left.rotation.z += cur.finSpread;
    parts.fins.right.rotation.z -= cur.finSpread;
  }

  function dispose() { offChange(); }

  return { update, dispose };
}

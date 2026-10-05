/*
  Interaction – der Spieler tippt/klickt die Kreatur an (Phase 08).
  Reaktion besteht aus vier Teilen:
    Blick       dreht sich zur Kamera (= Spieler) und schaut hin (behavior.observe, Zustand INTERACT)
    Animation   Geste je nach Reaktion (Kopfneigen, Hüpfer + Schwanzwedeln, Kristallpuls, Flossenzucken)
    Sound       kleiner Laut aus Sfx (Platzhalter bis Phase 42)
    Emotion     kurzer sichtbarer Ausdruck: Augen weiten sich, Augen/Kern/Kristall leuchten auf
  Vier Reaktionen: curious (neugierig), happy (glücklich), surprised (überrascht), content (zufrieden).
  Die Wahl ist gewichtet zufällig, wiederholt nie direkt dieselbe und hängt von der „Serie" ab
  (Taps innerhalb weniger Sekunden): erst neugierig/glücklich, bei schnellem Zweittipp eher
  überrascht, bei sehr vielen Taps beruhigt sie sich („content") statt zu nerven oder zu bestrafen.
  Taps, die schneller als `minInterval` aufeinander folgen, lösen keine neue Reaktion aus (Serie zählt trotzdem).

  Trefferprüfung: unsichtbare Kugel um den Körper (größer als das Modell, damit Touch verzeiht).
  Tippen daneben tut nichts (Idee für später: Blick zum angetippten Boden).
  Doppelklick auf die Kreatur setzt NICHT die Kamera zurück (`rig.setResetGuard`), daneben schon.

  „Reduzierte Bewegung": Blick, Sound und Leuchten bleiben (Leuchten nur halb so stark), Gesten
  entfallen (IdleBehavior.triggerGesture tut dann nichts).

  Läuft NACH idle/behavior/locomotion: Idle setzt `eyes.scale.y`, Kern- und Kristallglühen absolut,
  Interaction multipliziert darauf (`eyes.scale.x/z`, Augenglühen gehört ganz Interaction).
  Schnittstellen für spätere Phasen: onReaction(fn) (Phase 13 Emotion, Phase 14 Bindung zählt
  Interaktionen), react(type) (Debug Phase 48, Reaktionen auf Futter/Spielzeug), getStats().
  Werte in CONFIG.creature.interaction, NICHT im Browser getestet.

  Persönlichkeit (Phase 12): optionales `personality` (PersonalitySystem) gewichtet die Reaktionswahl beim Antippen
  (`getModifier('reaction', name)`: z. B. verspielt -> öfter glücklich, schüchtern -> öfter überrascht).

  Phase 25: optionales `isEnabled()` (Standard immer an): liefert es false (Reson ist noch im Ei), löst Antippen nichts aus (das Ei
  bearbeitet `Growth.js`). Die Trefferkugel schrumpft bei kleinen Lebensstufen nicht unter `hitMinScale` (Touch bleibt gut zu treffen).

  createInteraction({ creature, idle, behavior, rig, camera, dom, sfx, seed, personality, isEnabled }) ->
    { update(dt), onReaction(fn), react(type), hitTest(x, y), getStats(), dispose() }
    Ereignis: { type, emotion, streak, total, source }   source: 'tap' (Standard) | 'feed' (Phase 11) | ...
    Reaktionen mit source != 'tap' zählen nicht für die Tipp-Wirkung auf die Bedürfnisse (NeedSystem.applyInteraction).
    Beim Essen (BUSY_STATES in Behavior.js) löst Antippen nichts aus.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRng } from '../core/rng.js';
import { prefersReducedMotion } from '../core/env.js';
import { STATES, BUSY_STATES } from './Behavior.js';

// Ausdruck pro Reaktion. wide/eyeGlow/core/crystal sind Anteile (0.2 = +20 %), dur in Sekunden.
const REACTIONS = {
  curious: {
    emotion: 'curious', sound: 'curious', gesture: 'headTilt', seq: [],
    look: [2.4, 3.4], dur: 1.7,
    expr: { wide: 0.10, eyeGlow: 0.35, core: 0.10, crystal: 0.2 },
  },
  happy: {
    emotion: 'happy', sound: 'happy', gesture: 'hop', seq: [{ at: 0.62, gesture: 'tailWag' }],
    look: [2.2, 3.0], dur: 2.1,
    expr: { wide: 0.06, eyeGlow: 0.25, core: 0.45, crystal: 0.3 },
  },
  surprised: {
    emotion: 'surprised', sound: 'surprised', gesture: 'crystalPulse', seq: [],
    look: [1.6, 2.2], dur: 1.1,
    expr: { wide: 0.22, eyeGlow: 0.6, core: 0.2, crystal: 0.4 },
  },
  content: {
    emotion: 'content', sound: 'content', gesture: 'finFlick', seq: [],
    look: [2.0, 3.0], dur: 2.0,
    expr: { wide: 0, eyeGlow: -0.2, core: 0.25, crystal: 0.1 },
  },
};

const ease = (u) => u * u * (3 - 2 * u);

export function createInteraction({
  creature, idle, behavior, rig, camera, dom, sfx, seed = 8008, personality = null, isEnabled = null,
}) {
  const cfg = CONFIG.creature.interaction;
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const calm = prefersReducedMotion();
  const glowF = calm ? cfg.calmFactor : 1;
  const { group, parts } = creature;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const sphere = new THREE.Sphere();

  const eyeBalls = [parts.eyes.left, parts.eyes.right];
  const eyeMat = parts.eyes.left.getObjectByName('eyeball').material;   // gleiches Material für beide Augen
  const base = {
    eye: eyeMat.emissiveIntensity,
    core: parts.core.material.emissiveIntensity,
  };

  let clock = 0;
  let lastTapAt = -Infinity;
  let lastReactionAt = -Infinity;
  let lastType = null;
  let streak = 0;
  let total = 0;
  let pending = [];                // zeitversetzte Gesten: { at, gesture }
  const listeners = new Set();
  const expr = { active: false, t: 0, dur: 1, wide: 0, eyeGlow: 0, core: 0, crystal: 0 };
  let applied = false;             // wurde zuletzt ein Ausdruck auf die Teile geschrieben?

  // ---------- Treffer ----------
  /** true, wenn der Bildschirmpunkt (Client-Koordinaten) die Kreatur trifft. */
  function hitTest(clientX, clientY) {
    const rect = dom.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const s = group.scale.x;
    sphere.center.set(group.position.x, group.position.y + cfg.hitCenterY * s, group.position.z);
    sphere.radius = cfg.hitRadius * Math.max(s, cfg.hitMinScale);   // Phase 25: Babys bleiben gut zu treffen
    return raycaster.ray.intersectsSphere(sphere);
  }

  // ---------- Reaktion wählen ----------
  function chooseReaction(sinceLastTap) {
    if (streak >= cfg.calmStreak) return 'content';
    const w = streak <= 1
      ? { curious: 3, happy: 2, surprised: 0.8, content: 1 }
      : { happy: 3, curious: 1, surprised: sinceLastTap < 1.0 ? 2.5 : 0.5, content: 0.5 };
    if (personality) for (const n of Object.keys(w)) w[n] *= personality.getModifier('reaction', n);
    const names = Object.keys(w).filter((n) => n !== lastType);
    let total_w = 0;
    for (const n of names) total_w += w[n];
    let r = rng() * total_w;
    for (const n of names) {
      r -= w[n];
      if (r <= 0) return n;
    }
    return names[names.length - 1];
  }

  // ---------- Reaktion ausführen ----------
  /** Spielt eine Reaktion ab (auch von außen nutzbar). Gibt false bei unbekanntem Typ zurück. */
  function react(type, { source = 'tap' } = {}) {
    const def = REACTIONS[type];
    if (!def) return false;
    lastType = type;
    lastReactionAt = clock;
    total += 1;

    // Blick + Zuwenden: zur Kamera drehen und eine Weile hinschauen
    behavior.observe(camera.position.clone(), {
      state: STATES.INTERACT, dwell: rand(def.look[0], def.look[1]),
    });

    // Animation (bei „reduzierte Bewegung" tut triggerGesture nichts)
    pending = def.seq.map((s) => ({ at: s.at, gesture: s.gesture }));
    idle.triggerGesture(def.gesture);

    // Sound
    if (sfx) sfx.play(def.sound);

    // Emotion (sichtbarer Ausdruck)
    expr.active = true;
    expr.t = 0;
    expr.dur = def.dur;
    expr.wide = def.expr.wide;
    expr.eyeGlow = def.expr.eyeGlow;
    expr.core = def.expr.core;
    expr.crystal = def.expr.crystal;

    const event = { type, emotion: def.emotion, streak, total, source };
    for (const fn of listeners) fn(event);
    return true;
  }

  // ---------- Tippen ----------
  function handleTap({ x, y }) {
    if (isEnabled && !isEnabled()) return;   // Phase 25: noch im Ei
    if (!hitTest(x, y)) return;
    if (BUSY_STATES.has(behavior.getState())) return;   // Phase 11: beim Essen lässt sie sich nicht stören
    const sinceLastTap = clock - lastTapAt;
    streak = sinceLastTap > cfg.streakWindow ? 1 : streak + 1;
    lastTapAt = clock;
    if (clock - lastReactionAt < cfg.minInterval) return;   // zu schnell: keine neue Reaktion, Serie zählt
    react(chooseReaction(sinceLastTap));
  }

  const offTap = rig.onTap(handleTap);
  rig.setResetGuard(hitTest);   // Doppelklick auf die Kreatur setzt die Kamera nicht zurück

  // ---------- Frame ----------
  function update(dt) {
    clock += dt;

    // zeitversetzte Gesten (z. B. Schwanzwedeln nach dem Hüpfer)
    if (pending.length) {
      const since = clock - lastReactionAt;
      const due = pending.filter((p) => p.at <= since);
      if (due.length) {
        pending = pending.filter((p) => p.at > since);
        idle.triggerGesture(due[due.length - 1].gesture);
      }
    }

    // Ausdruck: kurzer Anstieg, langsames Abklingen
    let env = 0;
    if (expr.active) {
      expr.t += dt;
      const u = expr.t / expr.dur;
      if (u >= 1) expr.active = false;
      else env = ease(u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
    }
    const k = env * glowF;

    if (env > 0) {
      const w = 1 + expr.wide * k;
      for (const eye of eyeBalls) { eye.scale.x = w; eye.scale.z = w; }
      eyeMat.emissiveIntensity = base.eye * (1 + expr.eyeGlow * k);
      // Idle schreibt Kern (nur ohne „reduzierte Bewegung") und Kristall jeden Frame absolut -> darauf multiplizieren
      const coreCur = calm ? base.core : parts.core.material.emissiveIntensity;
      parts.core.material.emissiveIntensity = coreCur * (1 + expr.core * k);
      parts.crystal.material.emissiveIntensity *= 1 + expr.crystal * k;
      applied = true;
    } else if (applied) {
      for (const eye of eyeBalls) { eye.scale.x = 1; eye.scale.z = 1; }
      eyeMat.emissiveIntensity = base.eye;
      if (calm) parts.core.material.emissiveIntensity = base.core;   // Idle schreibt ihn hier nicht, deshalb selbst zurücksetzen
      applied = false;
    }
  }

  function onReaction(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getStats() { return { total, streak }; }

  function dispose() {
    offTap();
    rig.setResetGuard(null);
    listeners.clear();
  }

  return { update, onReaction, react, hitTest, getStats, dispose };
}

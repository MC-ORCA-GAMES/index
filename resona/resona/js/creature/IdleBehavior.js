/*
  IdleBehavior – die Kreatur lebt auch ohne Eingabe (Phase 06).
  Animiert die benannten Pivots aus CreatureModel (`parts`) rein prozedural, ohne Animationsclips:
  - Atmung (Rumpf hebt/senkt sich, Füße bleiben am Boden) und Brustkern pulsiert mit
  - Wippen (sanfte Gewichtsverlagerung), Schwanz- und Flossenschwingen, Kristall schwebt und dreht sich
  - Blinzeln in zufälligen Abständen, manchmal doppelt
  - Blickbewegungen: Augen springen zum Ziel, der Kopf folgt langsamer und die Augen gleichen aus
  - kleine Gesten alle paar Sekunden: Flossenzucken, Schwanzwedeln, Kopfneigen, Kristallpuls, Hüpfer
  „Reduzierte Bewegung": nur kleine Atem-/Wippbewegung, Blinzeln und ruhiger Blick, keine Gesten,
  kein Hüpfen, kein Leuchtpuls, Kristall steht still.
  Später (Phase 08/13): lookAt(point) für Blickziele, triggerGesture(name) für Reaktionen.
  Phase 07: setGesturesEnabled(false) hält die zufälligen Gesten an (z. B. beim Laufen); eine bereits
  laufende Geste wird zu Ende gespielt, Blinzeln, Atmung und Blick laufen immer weiter.
  Werte in CONFIG.creature.idle, NICHT im Browser getestet.

  createIdleBehavior(creature, { seed }) ->
    { update(dt, elapsed), lookAt(point|null), triggerGesture(name), setGesturesEnabled(bool) }
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRng } from '../core/rng.js';
import { prefersReducedMotion } from '../core/env.js';
import { TORSO_BOTTOM, EYE_HEIGHT } from './CreatureModel.js';

const TAU = Math.PI * 2;
const MAX_EYE_ANGLE = 0.5;          // so weit drehen sich die Augen relativ zum Kopf
const HOP_HEIGHT = 0.07;

const GESTURES = {
  finFlick:     { dur: [0.8, 1.1],  weight: 2 },
  tailWag:      { dur: [1.5, 2.0],  weight: 2 },
  headTilt:     { dur: [1.8, 2.6],  weight: 2 },
  crystalPulse: { dur: [1.4, 1.8],  weight: 1.5 },
  hop:          { dur: [0.55, 0.65], weight: 1 },
};

const clamp = THREE.MathUtils.clamp;
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

export function createIdleBehavior(creature, { seed = 6006 } = {}) {
  const cfg = CONFIG.creature.idle;
  const { group, parts } = creature;
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const calm = prefersReducedMotion();
  const amp = calm ? cfg.calmFactor : 1;

  // Ausgangswerte der Pivots (so baut CreatureModel sie auf)
  const base = {
    bodyY: parts.body.position.y,
    footY: parts.feet.map((f) => f.position.y),
    finZ: { left: parts.fins.left.rotation.z, right: parts.fins.right.rotation.z },
    tail: parts.tail.map((t) => ({ x: t.rotation.x, y: t.rotation.y })),
    crystalY: parts.crystal.position.y,
    crystalScale: parts.crystal.scale.clone(),
    coreGlow: parts.core.material.emissiveIntensity,
    crystalGlow: parts.crystal.material.emissiveIntensity,
    shadowOpacity: parts.shadow.material.opacity,
  };

  const breathPhase0 = rng() * TAU;
  const swayPhase = rng() * TAU;
  const finPhase = rng() * TAU;

  const blink = { next: rand(cfg.blinkMin, cfg.blinkMax), t: 0, active: false, chain: false, again: false };
  const gaze = {
    next: rand(0.5, 1.5), wanderYaw: 0, wanderPitch: 0, target: null,
    headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0,
  };
  const gesture = { type: null, t: 0, dur: 1, dir: 1, next: rand(3, 6), last: null, enabled: true };
  const tmp = new THREE.Vector3();

  // ---------- Blick ----------
  function updateGaze(dt) {
    let yawT;
    let pitchT;
    if (gaze.target) {
      group.updateWorldMatrix(true, false);
      tmp.copy(gaze.target);
      group.worldToLocal(tmp);
      yawT = clamp(Math.atan2(tmp.x, tmp.z), -0.9, 0.9);
      pitchT = clamp(Math.atan2(tmp.y - EYE_HEIGHT, Math.hypot(tmp.x, tmp.z) || 0.001), -0.4, 0.45);
    } else {
      gaze.next -= dt;
      if (gaze.next <= 0) {
        const far = rng() < 0.3;
        const range = cfg.gazeYaw * (far ? 1 : 0.5) * (calm ? 0.5 : 1);
        gaze.wanderYaw = rand(-range, range);
        gaze.wanderPitch = rand(-cfg.gazePitchDown, cfg.gazePitchUp) * (calm ? 0.5 : 1);
        gaze.next = rand(cfg.gazeMin, cfg.gazeMax) * (calm ? 1.6 : 1);
      }
      yawT = gaze.wanderYaw;
      pitchT = gaze.wanderPitch;
    }
    const headK = calm ? 2 : 3.5;
    gaze.headYaw = damp(gaze.headYaw, yawT * 0.5, headK, dt);
    gaze.headPitch = damp(gaze.headPitch, pitchT * 0.45, headK, dt);
    // Augen führen, der Kopf holt auf, die Augen gleichen den Rest aus
    gaze.eyeYaw = damp(gaze.eyeYaw, clamp(yawT - gaze.headYaw, -MAX_EYE_ANGLE, MAX_EYE_ANGLE), 14, dt);
    gaze.eyePitch = damp(gaze.eyePitch, clamp(pitchT - gaze.headPitch, -MAX_EYE_ANGLE, MAX_EYE_ANGLE), 14, dt);
  }

  // ---------- Blinzeln ----------
  function updateBlink(dt) {
    let lid = 0;   // 0 offen, 1 zu
    if (blink.active) {
      blink.t += dt;
      const u = blink.t / cfg.blinkDur;
      if (u >= 1) {
        blink.active = false;
        blink.next = blink.again ? 0.09 : rand(cfg.blinkMin, cfg.blinkMax);
        blink.chain = blink.again;
        blink.again = false;
      } else {
        lid = Math.sin(Math.PI * u);
      }
    } else {
      blink.next -= dt;
      if (blink.next <= 0) {
        blink.active = true;
        blink.t = 0;
        blink.again = !blink.chain && rng() < cfg.doubleBlinkChance;
        if (!blink.again) blink.chain = false;
      }
    }
    const s = 1 - 0.93 * lid;
    parts.eyes.left.scale.y = s;
    parts.eyes.right.scale.y = s;
  }

  // ---------- Gesten ----------
  function pickGesture() {
    const names = Object.keys(GESTURES).filter((n) => n !== gesture.last);
    let total = 0;
    for (const n of names) total += GESTURES[n].weight;
    let r = rng() * total;
    for (const n of names) {
      r -= GESTURES[n].weight;
      if (r <= 0) return n;
    }
    return names[names.length - 1];
  }

  function startGesture(name) {
    const def = GESTURES[name];
    gesture.type = name;
    gesture.t = 0;
    gesture.dur = rand(def.dur[0], def.dur[1]);
    gesture.dir = rng() < 0.5 ? -1 : 1;
  }

  function triggerGesture(name) {
    if (calm || !GESTURES[name]) return false;
    startGesture(name);
    return true;
  }

  /** Liefert die aktuellen Gestenanteile (alle 0, wenn keine Geste läuft). */
  function stepGesture(dt) {
    const out = { finLeft: 0, finRight: 0, wag: 0, tilt: 0, crystalPulse: 0, hop: 0 };
    if (calm) return out;
    if (!gesture.type) {
      if (!gesture.enabled) return out;   // Phase 07: beim Laufen keine zufälligen Gesten
      gesture.next -= dt;
      if (gesture.next <= 0) startGesture(pickGesture());
      else return out;
    }
    gesture.t += dt;
    const u = Math.min(gesture.t / gesture.dur, 1);
    const env = Math.sin(Math.PI * u);
    switch (gesture.type) {
      case 'finFlick': {
        const v = 0.45 * env * (0.5 + 0.5 * Math.sin(u * TAU * 3));
        if (gesture.dir < 0) out.finLeft = v; else out.finRight = v;
        break;
      }
      case 'tailWag':
        out.wag = Math.sin(u * TAU * 3) * env;
        break;
      case 'headTilt':
        out.tilt = gesture.dir * 0.2 * Math.min(1, env * 2.2);
        break;
      case 'crystalPulse':
        out.crystalPulse = env;
        break;
      case 'hop':
        out.hop = 4 * u * (1 - u) * HOP_HEIGHT;
        break;
      default:
        break;
    }
    if (u >= 1) {
      gesture.last = gesture.type;
      gesture.type = null;
      gesture.next = rand(cfg.gestureMin, cfg.gestureMax);
    }
    return out;
  }

  // ---------- Frame ----------
  function update(dt, t) {
    updateGaze(dt);
    updateBlink(dt);
    const g = stepGesture(dt);

    // Atmung: Rumpf wird höher/schmaler, Unterkante bleibt auf gleicher Höhe
    const breath = Math.sin((TAU * t) / cfg.breathPeriod + breathPhase0);
    const sY = 1 + cfg.breathAmp * amp * breath;
    const sXZ = 1 - cfg.breathAmp * 0.45 * amp * breath;
    parts.body.scale.set(sXZ, sY, sXZ);
    parts.body.position.y = base.bodyY + TORSO_BOTTOM * (sY - 1) + g.hop;

    // Wippen
    parts.body.rotation.z = cfg.swayAmp * amp * Math.sin(t * 0.72 + swayPhase);
    parts.body.rotation.x = cfg.swayAmp * 0.45 * amp * Math.sin(t * 0.51 + swayPhase * 1.7);

    // Hüpfer: Füße heben leicht mit, Schatten wird kleiner und blasser
    for (let i = 0; i < parts.feet.length; i++) parts.feet[i].position.y = base.footY[i] + g.hop * 0.7;
    parts.shadow.scale.setScalar(1 - g.hop * 2.2);
    parts.shadow.material.opacity = base.shadowOpacity * (1 - g.hop * 2);

    // Kopf und Augen
    parts.head.rotation.y = gaze.headYaw;
    parts.head.rotation.x = -gaze.headPitch;
    parts.head.rotation.z = g.tilt;
    for (const eye of [parts.eyes.left, parts.eyes.right]) {
      eye.rotation.y = gaze.eyeYaw;
      eye.rotation.x = -gaze.eyePitch;
    }

    // Schwanz (Schwingen + Wedeln): jedes Glied etwas später und stärker
    const w = t * cfg.tailSwaySpeed;
    for (let i = 0; i < parts.tail.length; i++) {
      parts.tail[i].rotation.y = base.tail[i].y
        + amp * (0.10 + 0.06 * i) * Math.sin(w - i * 0.7)
        + g.wag * 0.18 * (1 + 0.5 * i);
    }

    // Flossen (nach außen geneigt, Zucken öffnet sie weiter)
    parts.fins.left.rotation.z = base.finZ.left + amp * 0.035 * Math.sin(t * 1.3 + finPhase) + g.finLeft;
    parts.fins.right.rotation.z = base.finZ.right + amp * 0.035 * Math.sin(t * 1.3 + finPhase + 1.4) - g.finRight;

    // Kristall und Leuchtteile
    if (!calm) {
      parts.crystal.rotation.y += dt * 0.7;
      parts.crystal.position.y = base.crystalY + 0.018 * Math.sin(t * 1.6 + 1);
      parts.core.material.emissiveIntensity = base.coreGlow * (1 + 0.12 * breath);
    }
    const m = 1 + 0.4 * g.crystalPulse;
    parts.crystal.scale.set(base.crystalScale.x * m, base.crystalScale.y * m, base.crystalScale.z * m);
    parts.crystal.material.emissiveIntensity = base.crystalGlow * (1 + g.crystalPulse);
  }

  /** Blickziel in Weltkoordinaten (THREE.Vector3) oder null für freies Umherschauen. */
  function lookAt(point) {
    gaze.target = point ? point.clone() : null;
  }

  /** Phase 07: zufällige Gesten an/aus (Behavior schaltet sie beim Laufen aus). */
  function setGesturesEnabled(on) {
    gesture.enabled = !!on;
  }

  return { update, lookAt, triggerGesture, setGesturesEnabled };
}

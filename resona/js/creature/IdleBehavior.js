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
  Phase 27 Teil B4: `setFormGesture(def, share)` gibt der Spezialform EINE eigene kleine Geste (`EVOLUTIONS[id].animationSet`: scan, nuzzle, stand, sway, breathe).
  Sie liegt als Eintrag `form` im Zufallstopf der Gesten (gleiche Dauer und gleiches Gewicht für alle Formen), ihre Stärke wächst mit dem Anteil des
  Übergangs; `triggerGesture('form')` spielt sie gezielt (Fähigkeiten, siehe FormBehavior). Ohne Form: kein Eintrag. „Reduzierte Bewegung“: keine Geste.
  Werte in CONFIG.creature.idle, NICHT im Browser getestet.

  createIdleBehavior(creature, { seed }) ->
    { update(dt, elapsed), lookAt(point|null), triggerGesture(name, { dur }?), setGesturesEnabled(bool), setFormGesture(def|null, share) }
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
  // Phase 11: Kauen. Nur von außen (Feeding), nie zufällig; die Dauer kommt von triggerGesture(name, { dur }).
  munch:        { dur: [3, 3], weight: 0, random: false },
  // Phase 27 Teil B4: die eigene Geste der Form (Art, Dauer, Gewicht kommen aus `setFormGesture`; ohne Form nie gewählt).
  form:         { dur: [1.8, 2.4], weight: 1, random: true },
};
const FORM_GESTURE_TYPES = new Set(['scan', 'nuzzle', 'stand', 'sway', 'breathe']);

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
  const gesture = { type: null, t: 0, dur: 1, dir: 1, next: rand(3, 6), last: null, enabled: true, form: null, amp: 1 };
  const formG = { def: null, share: 0 };   // Phase 27 Teil B4: Geste der Form und Anteil des Übergangs
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
    const names = Object.keys(GESTURES).filter((n) => n !== gesture.last && GESTURES[n].random !== false && (n !== 'form' || formG.def));
    const weightOf = (n) => (n === 'form' ? formG.def.weight : GESTURES[n].weight);
    let total = 0;
    for (const n of names) total += weightOf(n);
    let r = rng() * total;
    for (const n of names) {
      r -= weightOf(n);
      if (r <= 0) return n;
    }
    return names[names.length - 1];
  }

  function startGesture(name, durOverride = null) {
    const def = GESTURES[name];
    const range = name === 'form' && formG.def ? formG.def.dur : def.dur;
    gesture.type = name;
    gesture.t = 0;
    gesture.dur = durOverride > 0 ? durOverride : rand(range[0], range[1]);
    gesture.dir = rng() < 0.5 ? -1 : 1;
    gesture.form = name === 'form' && formG.def ? formG.def.type : null;   // Art und Stärke gelten bis zum Ende dieser Geste
    gesture.amp = name === 'form' ? formG.share : 1;
  }

  function triggerGesture(name, { dur = null } = {}) {
    if (calm || !GESTURES[name]) return false;
    if (name === 'form' && !formG.def) return false;
    startGesture(name, dur);
    return true;
  }

  /** Liefert die aktuellen Gestenanteile (alle 0, wenn keine Geste läuft). */
  function stepGesture(dt) {
    const out = { finLeft: 0, finRight: 0, wag: 0, tilt: 0, crystalPulse: 0, hop: 0, munch: 0, finBoth: 0, scan: 0, nod: 0, stretch: 0, sway: 0 };
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
      case 'munch': {
        // Kopf senkt sich (rotation.x positiv = nach vorn/unten) und kaut: kleines Auf und Ab, ca. 2,5 Bisse pro Sekunde
        const lead = Math.min(1, u * 8, (1 - u) * 6);
        out.munch = lead * (0.2 + 0.06 * Math.sin(gesture.t * TAU * 2.5));
        break;
      }
      case 'form': {
        // Phase 27 Teil B4: eine kleine Geste je Form. Alle gleich lang, gleich klein; `a` = Anteil des Übergangs (0..1). Nur Pivots, die Idle ohnehin setzt.
        const a = gesture.amp;
        const soft = Math.min(1, env * 2.5);   // weiches Ein- und Ausblenden
        switch (gesture.form) {
          case 'scan':      // Kopf wandert nach einer Seite und zur anderen, Flossen heben sich leicht
            out.scan = a * 0.35 * Math.sin(u * TAU) * soft;
            out.finBoth = a * 0.2 * soft;
            break;
          case 'nuzzle':    // Kopf neigt sich und senkt sich etwas, Schwanz wedelt leise
            out.tilt = gesture.dir * a * 0.22 * soft;
            out.nod = a * 0.1 * soft;
            out.wag = a * 0.6 * Math.sin(u * TAU * 2.5) * env;
            break;
          case 'stand':     // richtet sich auf, Kopf hebt sich, Flossen öffnen sich
            out.stretch = a * 0.05 * soft;
            out.nod = -a * 0.08 * soft;
            out.finBoth = a * 0.3 * soft;
            break;
          case 'sway':      // wiegt sich zweimal, Kristall pulsiert im Takt
            out.sway = a * 0.12 * Math.sin(u * TAU * 2) * env;
            out.crystalPulse = a * 0.6 * env * (0.5 + 0.5 * Math.sin(u * TAU * 2));
            break;
          case 'breathe':   // ein langsamer, tiefer Atemzug, leiser Kristallschimmer
            out.stretch = a * 0.045 * env;
            out.finBoth = a * 0.15 * env;
            out.crystalPulse = a * 0.5 * env;
            break;
          default:
            break;
        }
        break;
      }
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
    const sY = 1 + cfg.breathAmp * amp * breath + g.stretch;
    const sXZ = 1 - cfg.breathAmp * 0.45 * amp * breath;
    parts.body.scale.set(sXZ, sY, sXZ);
    parts.body.position.y = base.bodyY + TORSO_BOTTOM * (sY - 1) + g.hop;

    // Wippen
    parts.body.rotation.z = cfg.swayAmp * amp * Math.sin(t * 0.72 + swayPhase) + g.sway;
    parts.body.rotation.x = cfg.swayAmp * 0.45 * amp * Math.sin(t * 0.51 + swayPhase * 1.7);

    // Hüpfer: Füße heben leicht mit, Schatten wird kleiner und blasser
    for (let i = 0; i < parts.feet.length; i++) parts.feet[i].position.y = base.footY[i] + g.hop * 0.7;
    parts.shadow.scale.setScalar(1 - g.hop * 2.2);
    parts.shadow.material.opacity = base.shadowOpacity * (1 - g.hop * 2);

    // Kopf und Augen
    parts.head.rotation.y = gaze.headYaw + g.scan;
    parts.head.rotation.x = -gaze.headPitch + g.munch + g.nod;
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
    parts.fins.left.rotation.z = base.finZ.left + amp * 0.035 * Math.sin(t * 1.3 + finPhase) + g.finLeft + g.finBoth;
    parts.fins.right.rotation.z = base.finZ.right + amp * 0.035 * Math.sin(t * 1.3 + finPhase + 1.4) - g.finRight - g.finBoth;

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

  /**
   * Phase 27 Teil B4: eigene Geste der Spezialform. `def` = `EVOLUTIONS[id].animationSet` ({ type, dur, weight }) oder null, `share` = Anteil des Übergangs 0..1.
   * Eine gerade laufende Geste behält Art und Stärke bis zum Ende.
   */
  function setFormGesture(def, share = 0) {
    const ok = def && FORM_GESTURE_TYPES.has(def.type) && share > 0.05;
    formG.def = ok ? def : null;
    formG.share = ok ? clamp(share, 0, 1) : 0;
  }

  return { update, lookAt, triggerGesture, setGesturesEnabled, setFormGesture };
}

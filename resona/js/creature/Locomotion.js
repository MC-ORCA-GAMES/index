/*
  Locomotion – die Kreatur bewegt sich durch das Habitat (Phase 07).
  Zuständig nur für KÖRPERLICHE Bewegung: stehen, drehen, laufen, zu einem Punkt gehen und die
  passende Gehanimation. WOHIN die Kreatur geht und WARUM, entscheidet Behavior.js.

  - Bewegt `creature.group` (Position in x/z, Drehung um y). Blickrichtung des Modells = +z.
  - Gehanimation (Trab: diagonale Fußpaare im Wechsel): Füße heben und schwingen vor/zurück,
    Rumpf wippt, neigt sich nach vorn und rollt leicht, Schwanz schwingt gegen die Drehrichtung.
  - Läuft NACH IdleBehavior.update() und ADDIERT auf dessen Werte (Idle setzt `body.position.y`,
    `body.rotation.x/z`, `feet[].position.y`, `tail[].rotation.y` jeden Frame absolut). Nur die
    Füße-x/z setzt Locomotion selbst, die fasst Idle nicht an. Reihenfolge der Updater in main.js
    deshalb: idle -> behavior -> locomotion.
  - Phase 30 Teil A: Ziele werden auf die begehbare Fläche des Grundrisses begrenzt (`nav.clamp`), und zwischen Räumen läuft die Kreatur über
    Wegpunkte durch die Türen (`nav.plan`). Ohne `nav` (Aufruf wie früher) gilt der alte Kreis um den Ursprung.
  - „Reduzierte Bewegung": Laufen bleibt (es ist Funktion), Wippen/Neigen/Rollen/Schwanz nur
    noch mit `calmFactor`.
  Werte in CONFIG.creature.locomotion, NICHT im Browser getestet.

  createLocomotion(creature, nav = null) ->
    { update(dt), moveTo(point, onDone?), turnTo(point, onDone?), stop(),
      isBusy(), isMoving(), getBoundsRadius(), clampToBounds(point), setSpeedScale(f) }
  Phase 30: `nav` (js/world/Navigation.js) ist optional; `getBoundsRadius()` bleibt als grobe Größe des Wohnbereichs erhalten.
  Phase 25: `setSpeedScale(f)` (0,3 bis 1,5, Standard 1) skaliert Lauftempo und Schrittlänge mit der Lebensstufe (Babys sind langsamer
  und machen kleinere Schritte). Beschleunigung, Drehung und Gehanimation bleiben sonst unverändert.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

/** Kürzester Winkelunterschied von a nach b in (-PI, PI]. */
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

export function createLocomotion(creature, nav = null) {
  const cfg = CONFIG.creature.locomotion;
  const { group, parts } = creature;
  const calm = prefersReducedMotion();
  const calmF = calm ? cfg.calmFactor : 1;
  // Ohne Navigation (alter Aufruf): Kreis um den Ursprung. Mit Navigation: grobe Größe des Wohnbereichs (nur noch Information).
  const boundsRadius = Math.max(0.5, (nav ? CONFIG.habitat.extent : 4.8) - cfg.boundsMargin);

  // Ausgangs-z der Füße (Reihenfolge laut CreatureModel: vorne links, vorne rechts, hinten links,
  // hinten rechts). Trab: vorne links + hinten rechts gleichzeitig, vorne rechts + hinten links versetzt.
  const footBaseZ = parts.feet.map((f) => f.position.z);
  const footPhase = [0, Math.PI, Math.PI, 0];

  let speedScale = 1;   // Phase 25: Lebensstufe

  const s = {
    speed: 0,          // aktuelle Laufgeschwindigkeit (Einheiten pro Sekunde)
    turnVel: 0,        // aktuelle Drehgeschwindigkeit (Radiant pro Sekunde, + = nach links von oben gesehen)
    target: null,      // THREE.Vector3 oder null (aktueller Wegpunkt oder das Ziel)
    path: [],          // Phase 30: weitere Wegpunkte nach `target` (Türen), das letzte ist das eigentliche Ziel
    face: null,        // THREE.Vector3 oder null (nur drehen)
    onDone: null,
    gaitPhase: 0,
    gaitAmp: 0,        // 0 = steht, 1 = volle Gehbewegung
    lean: 0,
  };

  /** Begrenzt einen Punkt auf die begehbare Fläche (Kopie, y = 0). Mit Navigation: Grundriss, sonst Kreis. */
  function clampToBounds(point) {
    if (nav) {
      const c = nav.clamp({ x: point.x, z: point.z });
      return new THREE.Vector3(c.x, 0, c.z);
    }
    const p = new THREE.Vector3(point.x, 0, point.z);
    const r = Math.hypot(p.x, p.z);
    if (r > boundsRadius) p.multiplyScalar(boundsRadius / r);
    return p;
  }

  function finish() {
    const cb = s.onDone;
    s.target = null;
    s.path = [];
    s.face = null;
    s.onDone = null;
    if (cb) cb();
  }

  /** Geht zu einem Punkt (wird begrenzt). Gibt den tatsächlich angesteuerten Punkt zurück. */
  function moveTo(point, onDone = null) {
    const goal = clampToBounds(point);
    s.path = [];
    if (nav) {
      // Phase 30: durch die Türen. Wegpunkte aus der Navigation, das letzte ist das Ziel.
      const wps = nav.plan({ x: group.position.x, z: group.position.z }, { x: goal.x, z: goal.z });
      for (let i = 0; i < wps.length - 1; i++) s.path.push(new THREE.Vector3(wps[i].x, 0, wps[i].z));
      s.path.push(goal);
      s.target = s.path.shift();
    } else {
      s.target = goal;
    }
    s.face = null;
    s.onDone = onDone;
    return goal.clone();
  }

  /** Dreht sich auf der Stelle zu einem Punkt. */
  function turnTo(point, onDone = null) {
    s.face = new THREE.Vector3(point.x, 0, point.z);
    s.target = null;
    s.path = [];
    s.onDone = onDone;
  }

  /** Bricht das aktuelle Ziel ab (ohne Rückruf); die Kreatur bremst ab. */
  function stop() {
    s.target = null;
    s.path = [];
    s.face = null;
    s.onDone = null;
  }

  function isBusy() { return s.target !== null || s.face !== null; }
  function isMoving() { return s.speed > 0.02 || Math.abs(s.turnVel) > 0.05; }

  // ---------- Steuerung ----------
  function steer(dt) {
    const pos = group.position;
    let turnRate = 0;
    let desiredSpeed = 0;
    let arrived = false;

    if (s.target) {
      const dx = s.target.x - pos.x;
      const dz = s.target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      const hasMore = s.path.length > 0;   // Phase 30: Zwischenpunkt (Tür) – nicht abbremsen, nicht anhalten
      if (dist <= (hasMore ? cfg.arriveRadius * 1.5 : cfg.arriveRadius)) {
        if (hasMore) { s.target = s.path.shift(); return steer(dt); }
        arrived = true;
      } else {
        const diff = angleDiff(group.rotation.y, Math.atan2(dx, dz));
        turnRate = clamp(diff * cfg.turnGain, -cfg.turnSpeed, cfg.turnSpeed);
        // Erst auf der Stelle drehen, wenn das Ziel weit seitlich liegt; sonst im Bogen laufen.
        const aligned = clamp(1 - Math.abs(diff) / cfg.turnThreshold, 0, 1);
        const slow = hasMore ? 1 : clamp(dist / cfg.slowRadius, cfg.minSpeedFactor, 1);
        desiredSpeed = cfg.walkSpeed * speedScale * slow * aligned;
      }
    } else if (s.face) {
      const diff = angleDiff(group.rotation.y, Math.atan2(s.face.x - pos.x, s.face.z - pos.z));
      if (Math.abs(diff) < cfg.faceTolerance) arrived = true;
      else turnRate = clamp(diff * cfg.turnGain, -cfg.turnSpeed, cfg.turnSpeed);
    }

    // Geschwindigkeit mit Beschleunigung/Bremsen (linear)
    const maxDelta = (desiredSpeed > s.speed ? cfg.accel : cfg.decel) * dt;
    s.speed += clamp(desiredSpeed - s.speed, -maxDelta, maxDelta);
    if (s.speed < 0.005 && desiredSpeed === 0) s.speed = 0;

    // Drehung
    s.turnVel = damp(s.turnVel, turnRate, 14, dt);
    group.rotation.y += s.turnVel * dt;

    // Vorwärtsbewegung entlang der Blickrichtung, nie über das Ziel hinaus
    if (s.speed > 0) {
      let step = s.speed * dt;
      if (s.target) {
        const remaining = Math.hypot(s.target.x - pos.x, s.target.z - pos.z);
        if (step >= remaining) {
          step = remaining;
          if (s.path.length === 0) arrived = true;   // Zwischenpunkt: nächster Frame nimmt den nächsten Wegpunkt
        }
      }
      const yaw = group.rotation.y;
      pos.x += Math.sin(yaw) * step;
      pos.z += Math.cos(yaw) * step;
    }

    // Begrenzung auf die begehbare Fläche (Phase 30: Grundriss mit Türen; sonst Kreis wie früher)
    if (nav) {
      if (!nav.isWalkable(pos)) {
        const c = nav.clamp({ x: pos.x, z: pos.z });
        pos.x = c.x;
        pos.z = c.z;
      }
    } else {
      const r = Math.hypot(pos.x, pos.z);
      if (r > boundsRadius) {
        pos.x *= boundsRadius / r;
        pos.z *= boundsRadius / r;
      }
    }

    if (arrived) {
      if (s.target) s.speed = 0;
      finish();
    }
  }

  // ---------- Gehanimation (addiert auf die Werte von IdleBehavior) ----------
  function animate(dt) {
    const moveNorm = clamp(s.speed / (cfg.walkSpeed * speedScale), 0, 1);
    const turnNorm = clamp(Math.abs(s.turnVel) / cfg.turnSpeed, 0, 1) * cfg.turnStepFactor;
    s.gaitAmp = damp(s.gaitAmp, Math.max(moveNorm, turnNorm), 12, dt);
    s.gaitPhase += TAU * (s.speed * dt / (cfg.strideLength * speedScale)) + Math.abs(s.turnVel) * dt * cfg.turnStepRate;
    s.lean = damp(s.lean, moveNorm, 8, dt);

    const amp = s.gaitAmp;
    for (let i = 0; i < parts.feet.length; i++) {
      const ph = s.gaitPhase + footPhase[i];
      const foot = parts.feet[i];
      foot.position.y += cfg.footLift * amp * Math.max(0, Math.sin(ph));   // Idle setzt y jeden Frame neu
      foot.position.z = footBaseZ[i] - Math.cos(ph) * cfg.footStride * amp;  // vorschwingen beim Heben
    }

    const body = parts.body;
    body.position.y += cfg.bobAmp * calmF * amp * Math.abs(Math.sin(s.gaitPhase));
    body.rotation.x += cfg.leanAmp * calmF * s.lean;
    body.rotation.z += cfg.rollAmp * calmF * amp * Math.sin(s.gaitPhase);

    // Schwanz folgt der Drehung verzögert (Glieder weiter hinten stärker)
    const swing = clamp(s.turnVel, -cfg.turnSpeed, cfg.turnSpeed) * cfg.tailTurnLag * calmF;
    for (let i = 0; i < parts.tail.length; i++) parts.tail[i].rotation.y -= swing * (1 + 0.5 * i);
  }

  function update(dt) {
    steer(dt);
    animate(dt);
  }

  /** Phase 25: Tempo der Lebensstufe (1 = erwachsen). */
  function setSpeedScale(f) { speedScale = Number.isFinite(f) ? clamp(f, 0.3, 1.5) : 1; }

  return {
    update, moveTo, turnTo, stop, isBusy, isMoving,
    getBoundsRadius: () => boundsRadius,
    clampToBounds,
    setSpeedScale,
  };
}

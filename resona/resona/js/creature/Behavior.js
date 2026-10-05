/*
  Behavior – einfaches Verhaltenssystem der Kreatur (Phase 07).
  Entscheidet, was die Kreatur als Nächstes tut, und steuert dafür Locomotion (Körper) und
  IdleBehavior (Blick, Gesten). Die Kreatur bleibt auch ohne Eingabe interessant.

  Zustände (Namen aus dem Master-Prompt, Abschnitt 18). Umgesetzt in Phase 07:
    IDLE         steht und lebt (Idle-Animation), wartet auf die nächste Aufgabe
    EXPLORE      geht zu einem zufälligen Punkt im Habitat
    INVESTIGATE  geht zu einer Zone, bleibt davor stehen und betrachtet den Zonenboden
    OBSERVE      dreht sich zur Kamera (= Spieler) und schaut dorthin
  Reserviert für spätere Phasen (noch nicht verwendet): EAT, SLEEP, PLAY, FOLLOW, INTERACT,
  SEEK_FOOD, SEEK_REST, SEEK_PLAYER. Ab Phase 09/12 sollen Bedürfnisse und Persönlichkeit die
  Gewichte in `chooseNext()` verschieben (CONFIG.creature.behavior.weights).

  Ablauf einer Aufgabe: Gehen/Drehen -> optional Verweilen (Blick auf einen Punkt) -> zurück zu IDLE.
  Während des Gehens startet Idle keine neuen Gesten, der Blick geht zum Ziel.

  Von außen steuerbar (z. B. Phase 08 Interaktion, Phase 11 Füttern):
    goTo(point, opts), goToZone(id, opts), observe(point, opts), interrupt(), setAutonomous(bool)
    opts: { state, dwell (Sekunden), lookAt (Vector3 für das Verweilen), onDone }
  Werte in CONFIG.creature.behavior, NICHT im Browser getestet.

  createBehavior({ creature, idle, locomotion, habitat, getObserveTarget, seed }) ->
    { update(dt), getState(), onStateChange(fn), goTo, goToZone, observe, interrupt, setAutonomous }
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRng } from '../core/rng.js';
import { prefersReducedMotion } from '../core/env.js';
import { EYE_HEIGHT } from './CreatureModel.js';

export const STATES = Object.freeze({
  IDLE: 'IDLE',
  EXPLORE: 'EXPLORE',
  INVESTIGATE: 'INVESTIGATE',
  OBSERVE: 'OBSERVE',
});

export function createBehavior({
  creature, idle, locomotion, habitat, getObserveTarget = null, seed = 7007,
}) {
  const cfg = CONFIG.creature.behavior;
  const rng = createRng(seed);
  const rand = (a, b) => a + (b - a) * rng();
  const calmWait = prefersReducedMotion() ? cfg.calmWaitFactor : 1;
  const { group } = creature;

  let state = STATES.IDLE;
  let current = null;            // laufende Aufgabe oder null
  let autonomous = true;
  let waitTimer = rand(cfg.firstWaitMin, cfg.firstWaitMax);
  let lastZone = null;
  const listeners = new Set();

  function setState(next) {
    if (next === state) return;
    const prev = state;
    state = next;
    for (const fn of listeners) fn(next, prev);
  }

  /** Punkt in Augenhöhe-Nähe über dem Boden, damit der Blick zum Ziel leicht nach unten geht. */
  function gazePoint(p, heightFactor = 0.7) {
    return new THREE.Vector3(p.x, EYE_HEIGHT * heightFactor, p.z);
  }

  function endTask() {
    const task = current;
    current = null;
    idle.lookAt(null);
    idle.setGesturesEnabled(true);
    setState(STATES.IDLE);
    waitTimer = rand(cfg.idleMin, cfg.idleMax) * calmWait;
    if (task && task.onDone) task.onDone();
  }

  function startDwell() {
    if (!current) return;
    if (!(current.dwell > 0)) { endTask(); return; }
    current.phase = 'dwell';
    current.timer = current.dwell;
    idle.setGesturesEnabled(true);
    idle.lookAt(current.lookAt || null);
  }

  /** Startet eine Aufgabe und ersetzt eine laufende. task: { kind:'walk'|'turn', point, state, dwell, lookAt, onDone } */
  function begin(task) {
    if (current) { locomotion.stop(); }
    current = { ...task, phase: 'move', timer: 0 };
    setState(task.state);
    if (task.kind === 'turn') {
      idle.setGesturesEnabled(true);
      idle.lookAt(task.lookAt || null);
      locomotion.turnTo(task.point, startDwell);
    } else {
      idle.setGesturesEnabled(false);
      const reached = locomotion.moveTo(task.point, startDwell);
      idle.lookAt(gazePoint(reached));
    }
  }

  // ---------- Aufgaben von außen ----------
  function goTo(point, { state: st = STATES.EXPLORE, dwell = 0, lookAt = null, onDone = null } = {}) {
    begin({ kind: 'walk', point, state: st, dwell, lookAt, onDone });
  }

  function goToZone(id, { state: st = STATES.INVESTIGATE, dwell = 0, lookAt = null, onDone = null } = {}) {
    const zone = habitat.getZonePosition(id);
    if (!zone) return false;
    // Nicht auf die Zonenmitte, sondern kurz davor stehen bleiben (aus Richtung der Kreatur)
    const from = group.position;
    const away = new THREE.Vector3(from.x - zone.x, 0, from.z - zone.z);
    if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
    away.setLength(cfg.zoneStandOff);
    const stand = zone.clone().add(away);
    lastZone = id;
    begin({
      kind: 'walk', point: stand, state: st, dwell,
      lookAt: lookAt || new THREE.Vector3(zone.x, 0.05, zone.z), onDone,
    });
    return true;
  }

  function observe(point, { state: st = STATES.OBSERVE, dwell = cfg.observeMin, onDone = null } = {}) {
    begin({ kind: 'turn', point, state: st, dwell, lookAt: point, onDone });
  }

  /** Bricht die aktuelle Aufgabe ab und geht zurück nach IDLE (ohne onDone). */
  function interrupt() {
    if (!current) return;
    locomotion.stop();
    current.onDone = null;
    endTask();
  }

  function setAutonomous(on) { autonomous = !!on; }

  // ---------- Selbstständige Wahl ----------
  function pickExplorePoint() {
    const R = locomotion.getBoundsRadius();
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rng()) * R;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (p.distanceTo(group.position) >= cfg.exploreMinDist) break;
    }
    return p;
  }

  function chooseNext() {
    const options = [];
    options.push({ name: 'explore', w: cfg.weights.explore });
    if (habitat.getZoneIds().length > 0) options.push({ name: 'investigate', w: cfg.weights.investigate });
    const camPos = getObserveTarget ? getObserveTarget() : null;
    if (camPos) options.push({ name: 'observe', w: cfg.weights.observe });

    let total = 0;
    for (const o of options) total += o.w;
    let r = rng() * total;
    let pick = options[options.length - 1];
    for (const o of options) {
      r -= o.w;
      if (r <= 0) { pick = o; break; }
    }

    if (pick.name === 'investigate') {
      const ids = habitat.getZoneIds().filter((id) => id !== lastZone);
      const id = ids.length ? ids[Math.floor(rng() * ids.length)] : habitat.getZoneIds()[0];
      goToZone(id, { dwell: rand(cfg.dwellMin, cfg.dwellMax) });
    } else if (pick.name === 'observe') {
      observe(camPos, { dwell: rand(cfg.observeMin, cfg.observeMax) });
    } else {
      const p = pickExplorePoint();
      goTo(p, { state: STATES.EXPLORE, dwell: rng() < cfg.exploreDwellChance ? rand(0.8, 1.8) : 0 });
    }
  }

  function update(dt) {
    if (current) {
      if (current.phase === 'dwell') {
        current.timer -= dt;
        if (current.timer <= 0) endTask();
      }
      return;
    }
    if (!autonomous) return;
    waitTimer -= dt;
    if (waitTimer <= 0) chooseNext();
  }

  return {
    update,
    getState: () => state,
    onStateChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    goTo, goToZone, observe, interrupt, setAutonomous,
  };
}

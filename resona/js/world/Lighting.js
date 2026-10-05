/*
  Lighting – Grundbeleuchtung des Habitats.
  Lichtwerte sind Startwerte für die physikalisch basierten Lichter von three r160
  und wurden NICHT visuell geprüft. Tageszeit-Wechsel kommt in Phase 32.

  Phase 30 Teil B: `setFocus(x, z, { color, strength })` – das Kernlicht (ein einziges Punktlicht) gleitet zum Raum, auf den die Kamera schaut,
  und färbt sich dort zur Farbe des Bereichs (`ROOM_LIGHT` in js/data/habitat.js). So sind der Raum der Kreatur und seine Nachbarn nicht dunkler,
  nur weil das Licht früher fest bei der Halle saß. Bei „reduzierte Bewegung" springt es sofort, ohne Gleiten und Flackern. Kein Licht je Raum.

  Phase 15: `setDim(k, amounts)` dunkelt das Habitat ab (k 0..1, `amounts` = Anteile je Licht bei k = 1: { hemi, key, core },
  Daten in SLEEP_LIGHT). Genutzt von Sleeping.js als Dämmerlicht beim Schlafen. Bei k = 0 sind alle Lichter wie vorher.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';
import { ROOM_LIGHT } from '../data/habitat.js';

export function createLighting() {
  const group = new THREE.Group();
  group.name = 'lighting';

  const hemi = new THREE.HemisphereLight(0x8fa0ff, 0x241830, 1.1);
  group.add(hemi);

  const key = new THREE.DirectionalLight(0xffe6c0, 2.0);
  key.position.set(5, 9, 6);
  key.castShadow = CONFIG.render.shadows;
  group.add(key);

  const core = new THREE.PointLight(CONFIG.colors.gold, 14, 14, 2);
  core.position.set(0, 2.4, 0.5);
  group.add(core);

  const baseIntensity = core.intensity;
  const baseHemi = hemi.intensity;
  const baseKey = key.intensity;
  const calm = prefersReducedMotion();
  let coreScale = 1;    // Faktor auf das Punktlicht (Phase 15, Dämmerlicht)

  // Phase 30 Teil B: Ziel des Kernlichts (Raum der Kamera). Start: wie bisher bei der Halle, in Gold.
  const gold = new THREE.Color(CONFIG.colors.gold);
  const focus = {
    pos: new THREE.Vector3(0, ROOM_LIGHT.height, ROOM_LIGHT.offsetZ),
    color: gold.clone(),
    strength: 1,
    set: false,                                  // erster Aufruf von setFocus springt direkt hin
    goalPos: new THREE.Vector3(0, ROOM_LIGHT.height, ROOM_LIGHT.offsetZ),
    goalColor: gold.clone(),
    goalStrength: 1,
  };

  function applyFocus() {
    core.position.copy(focus.pos);
    core.color.copy(focus.color);
  }

  /** Dämmerlicht (Phase 15). k 0..1, amounts: Anteil, um den hemi/key/core bei k = 1 dunkler werden. */
  function setDim(k, amounts = {}) {
    const x = Math.max(0, Math.min(1, k));
    hemi.intensity = baseHemi * (1 - (amounts.hemi || 0) * x);
    key.intensity = baseKey * (1 - (amounts.key || 0) * x);
    coreScale = 1 - (amounts.core || 0) * x;
    if (calm) core.intensity = baseIntensity * coreScale * focus.strength;   // ohne Flackern setzt update() das Punktlicht nicht
  }

  /** Phase 30 Teil B: Kernlicht zum Raum mit der Mitte (x, z) führen; `room` = { color, strength } (optional). */
  function setFocus(x, z, room = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    focus.goalPos.set(x, ROOM_LIGHT.height, z + ROOM_LIGHT.offsetZ);
    focus.goalColor.copy(gold).lerp(new THREE.Color(room.color ?? CONFIG.colors.gold), ROOM_LIGHT.mix);
    focus.goalStrength = Number.isFinite(room.strength) ? room.strength : 1;
    if (!focus.set || calm) {
      focus.set = true;
      focus.pos.copy(focus.goalPos);
      focus.color.copy(focus.goalColor);
      focus.strength = focus.goalStrength;
      applyFocus();
      if (calm) core.intensity = baseIntensity * coreScale * focus.strength;
    }
  }

  function update(dt, t) {
    if (calm) return;
    const k = 1 - Math.exp(-ROOM_LIGHT.glideSpeed * Math.max(0, dt || 0));
    focus.pos.lerp(focus.goalPos, k);
    focus.color.lerp(focus.goalColor, k);
    focus.strength += (focus.goalStrength - focus.strength) * k;
    applyFocus();
    core.intensity = baseIntensity * coreScale * focus.strength * (1 + 0.06 * Math.sin(t * 0.7));
  }

  return { group, update, setDim, setFocus };
}

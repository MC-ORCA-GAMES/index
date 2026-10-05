/*
  Lighting – Grundbeleuchtung des Habitats.
  Lichtwerte sind Startwerte für die physikalisch basierten Lichter von three r160
  und wurden NICHT visuell geprüft. Tageszeit-Wechsel kommt in Phase 32.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';

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
  const calm = prefersReducedMotion();

  function update(dt, t) {
    if (calm) return;
    core.intensity = baseIntensity * (1 + 0.06 * Math.sin(t * 0.7));
  }

  return { group, update };
}

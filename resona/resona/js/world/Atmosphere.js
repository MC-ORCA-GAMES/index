/*
  Atmosphere – schwebende Staub-/Energiepartikel im Habitat.
  Rein visuell. Bei „reduzierte Bewegung" stehen die Partikel still.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRng } from '../core/rng.js';
import { prefersReducedMotion } from '../core/env.js';

export function createAtmosphere() {
  const n = CONFIG.atmosphere.dustCount;
  const radius = CONFIG.habitat.radius * 0.95;
  const maxY = 4;
  const rng = createRng(7);
  const positions = new Float32Array(n * 3);
  const speeds = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = rng() * maxY;
    positions[i * 3 + 2] = Math.sin(a) * r;
    speeds[i] = 0.04 + rng() * 0.08;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: CONFIG.colors.dust, size: 2.2, sizeAttenuation: false,
    transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  points.name = 'atmosphere';

  const calm = prefersReducedMotion();
  function update(dt) {
    if (calm) return;
    const attr = geo.attributes.position;
    for (let i = 0; i < n; i++) {
      let y = attr.getY(i) + speeds[i] * dt;
      if (y > maxY) y = 0;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  }

  return { group: points, update };
}

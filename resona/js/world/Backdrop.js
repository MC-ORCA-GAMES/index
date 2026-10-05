/*
  Backdrop – Hintergrund: Verlaufskuppel plus Sterne. Rein dekorativ.
  Die Kuppel ist ein großes Kugelnetz mit Vertexfarben (kein Shader, kein Bild).
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRng } from '../core/rng.js';
import { prefersReducedMotion } from '../core/env.js';

const DOME_RADIUS = 120;

export function createBackdrop() {
  const group = new THREE.Group();
  group.name = 'backdrop';

  // Verlaufskuppel
  const geo = new THREE.SphereGeometry(DOME_RADIUS, 32, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(CONFIG.colors.skyTop);
  const bottom = new THREE.Color(CONFIG.colors.skyBottom);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / DOME_RADIUS;                       // -1 .. 1
    const t = THREE.MathUtils.clamp((y + 0.2) / 1.2, 0, 1);
    c.copy(bottom).lerp(top, t);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
  dome.renderOrder = -2;
  group.add(dome);

  // Sterne (obere Halbkugel)
  const rng = createRng(1847);
  const n = CONFIG.atmosphere.starCount;
  const starPos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rng() * Math.PI * 2;
    const v = 0.05 + rng() * 0.95;                 // 0..1 von Horizont bis Zenit
    const r = 90 + rng() * 20;
    const ring = Math.sqrt(1 - v * v);
    starPos[i * 3] = Math.cos(u) * ring * r;
    starPos[i * 3 + 1] = v * r;
    starPos[i * 3 + 2] = Math.sin(u) * ring * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: CONFIG.colors.star, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.8, depthWrite: false, fog: false,
  }));
  stars.renderOrder = -1;
  group.add(stars);

  const calm = prefersReducedMotion();
  function update(dt) {
    if (!calm) stars.rotation.y += dt * 0.004;
  }

  return { group, update };
}

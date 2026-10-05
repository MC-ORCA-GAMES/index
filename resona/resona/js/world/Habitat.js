/*
  Habitat – der kleine Lebensraum („Kuppel"): Boden, Rand, fünf Zonenmarkierungen,
  Spawnpunkt. Die Zonen sind in Phase 03 nur sichtbare Platzhalter ohne Funktion.
  Ab Phase 07 wählt die Kreatur Zonen über getZonePosition(id) selbst.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';

export class Habitat {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'habitat';
    this.zones = new Map();          // id -> { def, position, ring }
    this.spawn = new THREE.Object3D();
    this.spawn.name = 'spawn';
    this._calm = prefersReducedMotion();
    this._build();
  }

  _build() {
    const h = CONFIG.habitat;
    const col = CONFIG.colors;

    // Sockel mit Bodenfläche (Oberseite liegt bei y = 0)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(h.radius, h.radius * 1.06, 0.4, 96),
      new THREE.MeshStandardMaterial({ color: col.floor, roughness: 0.9, metalness: 0.1 }),
    );
    base.position.y = -0.2;
    base.name = 'floor';
    this.group.add(base);

    // Goldener Rand
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(h.radius, 0.05, 8, 128),
      new THREE.MeshStandardMaterial({
        color: col.gold, emissive: col.gold, emissiveIntensity: 0.6,
        roughness: 0.4, metalness: 0.6,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.name = 'rim';
    this.group.add(rim);

    // Feine Ringe im Boden
    for (const r of [1.6, 3.9]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.015, r + 0.015, 128),
        new THREE.MeshBasicMaterial({
          color: col.teal, transparent: true, opacity: 0.14, depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      this.group.add(ring);
    }

    // Zonenmarkierungen
    for (const def of h.zones) {
      const a = THREE.MathUtils.degToRad(def.angleDeg);
      const position = new THREE.Vector3(Math.cos(a) * def.dist, 0, Math.sin(a) * def.dist);

      const pad = new THREE.Group();
      pad.name = 'zone_' + def.id;
      pad.position.copy(position);

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 40),
        new THREE.MeshBasicMaterial({
          color: def.color, transparent: true, opacity: 0.1, depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.015;
      pad.add(disc);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.62, 48),
        new THREE.MeshBasicMaterial({
          color: def.color, transparent: true, opacity: 0.55, depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      pad.add(ring);

      this.group.add(pad);
      this.zones.set(def.id, { def, position, ring });
    }

    // Spawnpunkt (unsichtbares Objekt + dezenter Ring)
    this.spawn.position.set(...h.spawn);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.31, 48),
      new THREE.MeshBasicMaterial({
        color: col.teal, transparent: true, opacity: 0.35, depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.02;
    this.spawn.add(marker);
    this.group.add(this.spawn);
  }

  getZoneIds() { return [...this.zones.keys()]; }

  /** Weltposition der Zonenmitte (Kopie, darf verändert werden). */
  getZonePosition(id) {
    const z = this.zones.get(id);
    return z ? z.position.clone() : null;
  }

  update(dt, t) {
    if (this._calm) return;
    let i = 0;
    for (const z of this.zones.values()) {
      z.ring.material.opacity = 0.5 + 0.08 * Math.sin(t * 0.8 + i * 1.3);
      i++;
    }
  }
}

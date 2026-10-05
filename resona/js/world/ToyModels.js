/*
  ToyModels – die fünf Spielzeug-Objekte (Phase 18). Aufbau komplett aus Three.js-Primitiven (kein Asset, offline), wie die Kreatur.
  Jede Form aus TOYS[...].shape hat einen Baustein: `ball` (Leuchtball), `cube` (schwebender Würfel), `drone` (Mini-Drohne),
  `crystal` (Kristall), `ring` (Resonanzring). Das Objekt kennt nur seine eigene Bewegung (Bahn, Drehen, Pulsieren, Einblenden);
  Ablauf, Blick und Laute stehen in js/creature/Playing.js.

  createToyModel(def, { calm }) -> { group, update(t, dt, k, anchors), dispose() }
    def      Eintrag aus TOYS (shape, color, size, style)
    calm     „reduzierte Bewegung“: keine Bahn, kein Drehen, kein Pulsieren (das Objekt hängt ruhig an seinem Platz)
    update   t = Spielzeit in Sekunden, dt = Frame, k = Einblendung 0..1 (Skalierung), anchors = { center: Vector3 (Mitte des Spielbereichs),
             creature: Vector3 (Position der Kreatur, live) }. Setzt `group.position` (Weltkoordinaten) und alle Eigenbewegungen.
    group    wird von Playing in die Szene gehängt; `group.position` ist die Weltposition (Blickziel der Kreatur)
    dispose  gibt Geometrien und Materialien frei

  Bahnen je Stil (Weltkoordinaten, Boden y = 0, Kreatur ca. 1,2 hoch):
    chase     Ball hüpft auf einer kleinen Ellipse um den Spielbereich
    ponder    Würfel schwebt fast still über der Mitte, dreht sich langsam
    follow    Drohne umkreist die Kreatur auf Kopfhöhe
    calm      Kristall schwebt über der Mitte, pulsiert leise
    resonate  Ring dreht sich über der Mitte, drei Wellenringe weiten sich aus und verblassen
  Alle Werte sind Startwerte, NICHT im Browser getestet (Aussehen, Größe, Höhen sind Annahmen).
*/
import * as THREE from 'three';

const TAU = Math.PI * 2;
const ease = (u) => u * u * (3 - 2 * u);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createToyModel(def, { calm = false } = {}) {
  const geos = [];
  const mats = [];
  const group = new THREE.Group();
  group.name = 'toy_' + def.shape;
  const inner = new THREE.Group();      // Drehung und Eigenbewegung; `group` trägt Position und Größe
  group.add(inner);
  group.scale.setScalar(0.0001);

  function track(geo, mat) { geos.push(geo); mats.push(mat); }

  function glowMat(color, intensity = 0.9, extra = {}) {
    return new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.1, ...extra,
    });
  }

  function addMesh(geo, mat, parent = inner) {
    const mesh = new THREE.Mesh(geo, mat);
    track(geo, mat);
    parent.add(mesh);
    return mesh;
  }

  const state = { waves: [], rotors: [], pulseMats: [], spinners: [] };
  let build = null;       // pro Form: (t) -> { x, y, z } in Weltkoordinaten relativ zu anchors

  switch (def.shape) {
    case 'ball': {
      addMesh(new THREE.SphereGeometry(1, 20, 14), glowMat(def.color, 1.1));
      const halo = addMesh(
        new THREE.SphereGeometry(1.4, 16, 12),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      halo.name = 'halo';
      build = (t, a) => {
        const ang = t * 1.3;
        return {
          x: a.center.x + Math.cos(ang) * 0.5,
          z: a.center.z + Math.sin(ang) * 0.4,
          bounce: true,   // die Höhe (Hüpfen) setzt update()
        };
      };
      break;
    }
    case 'cube': {
      const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      addMesh(boxGeo, glowMat(def.color, 0.8, { transparent: true, opacity: 0.88 }));
      const edgeGeo = new THREE.EdgesGeometry(boxGeo);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xd4af37 });
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      track(edgeGeo, edgeMat);
      inner.add(edges);
      const core = addMesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), glowMat(0xeae4ff, 1.2));
      state.spinners.push({ obj: core, ax: -0.9, ay: -0.6 });
      build = (t, a) => ({
        x: a.center.x + Math.sin(t * 0.5) * 0.15,
        y: 0.85 + Math.sin(t * 1.1) * 0.1,
        z: a.center.z + Math.cos(t * 0.4) * 0.15,
      });
      break;
    }
    case 'drone': {
      const body = addMesh(new THREE.SphereGeometry(1, 20, 12), glowMat(0x2c3046, 0.15, { metalness: 0.4 }));
      body.scale.set(1, 0.5, 1);
      const lens = addMesh(new THREE.SphereGeometry(0.28, 12, 10), glowMat(def.color, 1.4));
      lens.position.set(0, 0.05, 0.85);
      const light = addMesh(new THREE.SphereGeometry(0.18, 10, 8), glowMat(def.color, 1.2));
      light.position.set(0, -0.55, 0);
      for (const side of [-1, 1]) {
        const rotor = addMesh(
          new THREE.CylinderGeometry(0.75, 0.75, 0.03, 20),
          new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.35, depthWrite: false }),
        );
        rotor.position.set(side * 1.15, 0.35, 0);
        state.rotors.push(rotor);
      }
      build = (t, a) => {
        if (calm) return { x: a.creature.x + 0.9, y: 1.25, z: a.creature.z + 0.1 };
        const ang = t * 0.9;
        return {
          x: a.creature.x + Math.cos(ang) * 0.95,
          y: 1.25 + Math.sin(t * 1.7) * 0.08,
          z: a.creature.z + Math.sin(ang) * 0.95,
          faceCenter: true,
        };
      };
      break;
    }
    case 'crystal': {
      const outer = addMesh(
        new THREE.OctahedronGeometry(1),
        glowMat(def.color, 0.7, { transparent: true, opacity: 0.88, flatShading: true }),
      );
      outer.scale.y = 1.7;
      state.pulseMats.push(outer.material);
      const core = addMesh(new THREE.OctahedronGeometry(0.45), glowMat(0xdffcff, 1.1, { flatShading: true }));
      core.scale.y = 1.7;
      build = (t, a) => ({
        x: a.center.x,
        y: 0.7 + Math.sin(t * 0.9) * 0.08,
        z: a.center.z,
      });
      break;
    }
    case 'ring':
    default: {
      addMesh(new THREE.TorusGeometry(1, 0.09, 12, 48), glowMat(def.color, 0.9));
      addMesh(new THREE.TorusGeometry(0.62, 0.05, 10, 40), glowMat(0x4fd8ff, 0.9));
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0, depthWrite: false });
        const wave = addMesh(new THREE.TorusGeometry(1, 0.03, 8, 48), mat);
        state.waves.push(wave);
      }
      build = (t, a) => ({
        x: a.center.x,
        y: 0.75 + Math.sin(t * 0.8) * 0.06,
        z: a.center.z,
      });
      break;
    }
  }

  const baseSize = def.size;

  function update(t, dt, k, anchors) {
    const e = ease(clamp01(k));
    const time = calm ? 0 : t;
    const p = build(time, anchors);

    // Größe: nur Einblenden (keine Verformung)
    group.scale.setScalar(baseSize * e);

    // Position. Der Ball hüpft in Weltmaßen: Basishöhe 0,2 plus Sprung bis ca. 0,45
    if (p.bounce) group.position.set(p.x, 0.2 + Math.abs(Math.sin(time * 3.2)) * 0.45, p.z);
    else group.position.set(p.x, p.y, p.z);

    if (p.faceCenter) group.rotation.y = Math.atan2(anchors.creature.x - p.x, anchors.creature.z - p.z);

    // Eigenbewegung (nicht bei „reduzierte Bewegung“)
    if (!calm) {
      switch (def.shape) {
        case 'ball': inner.rotation.z += dt * 3; inner.rotation.x += dt * 1.4; break;
        case 'cube': inner.rotation.y += dt * 0.6; inner.rotation.x += dt * 0.35; break;
        case 'crystal': inner.rotation.y += dt * 0.5; break;
        case 'ring': inner.rotation.y += dt * 0.7; break;
        default: break;
      }
      for (const s of state.spinners) { s.obj.rotation.x += dt * s.ax; s.obj.rotation.y += dt * s.ay; }
      for (const r of state.rotors) r.rotation.y += dt * 24;
      for (const m of state.pulseMats) m.emissiveIntensity = 0.7 + 0.3 * Math.sin(time * 1.8);
      state.waves.forEach((w, i) => {
        const u = ((time / 2.4) + i / state.waves.length) % 1;
        w.scale.setScalar(1 + u * 1.2);
        w.material.opacity = (1 - u) * 0.5 * e;
      });
    } else {
      // ruhig: eine einzelne, schwache Welle bleibt stehen
      state.waves.forEach((w, i) => {
        w.scale.setScalar(1 + 0.5 * (i + 1));
        w.material.opacity = i === 0 ? 0.25 * e : 0;
      });
    }
  }

  function dispose() {
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    geos.length = 0;
    mats.length = 0;
  }

  return { group, update, dispose };
}

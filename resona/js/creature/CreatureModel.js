/*
  CreatureModel – 3D-Körper der Kreatur „Reson" (Phase 05).
  Reiner Aufbau aus Three.js-Primitiven (keine Modelldatei, keine Textur außer einem
  Schattenfleck). Weich, bio-technisch, ein Kristall schwebt über dem Kopf.

  Konventionen:
  - Ursprung der Gruppe = Boden zwischen den Füßen (y = 0), Blickrichtung +z (zur Kamera).
  - Gesamthöhe ca. 1,2 Einheiten bei scale 1.
  - Die beweglichen Teile hängen an benannten Pivots in `parts`, damit Phase 06 (Idle:
    Atmung, Blinzeln, Blick, Gesten) und Phase 07 (Bewegung) sie nur noch animieren müssen.
  - Dieses Modul animiert nichts. Animation: IdleBehavior.js (Phase 06). Die Form ist nicht
    visuell geprüft (keine Laufzeittests).
  - Phase 06: Kopf-Gruppe sitzt jetzt auf dem Hals-Pivot NECK_Y (Kinder entsprechend
    verschoben, Weltpositionen unverändert), damit Kopfneigen am Hals schwingt.

  createCreatureModel(appearance) -> { group, parts, appearance, dispose() }
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Maße, auf die sich Idle/Bewegung (Phase 06/07) verlassen. Alle in Gruppen-Einheiten (scale 1).
export const BODY_BASE_Y = 0.5;     // Höhe des Körper-Pivots über dem Boden
export const TORSO_BOTTOM = 0.38;   // Abstand Rumpfunterseite zum Körper-Pivot
export const NECK_Y = 0.4;          // Kopf-Pivot (Hals) im Körper-Raum: Kopfdrehung schwingt hier, nicht im Bauch
export const EYE_HEIGHT = 1.14;     // Augenhöhe über dem Boden (für Blickziele)

function glowMaterial(color, intensity) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0,
  });
}

/** Tropfenförmiger Rumpf als Drehkörper (Profil: Radius, Höhe), Boden bei -0.38, Spitze bei 0.44. */
function createTorsoGeometry() {
  const profile = [
    [0.0, -TORSO_BOTTOM], [0.17, -0.355], [0.33, -0.22], [0.43, 0.0], [0.4, 0.2], [0.29, 0.36], [0.11, 0.435], [0.0, 0.44],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const smooth = new THREE.SplineCurve(profile).getPoints(28)
    .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(smooth, 40);
}

/** Weicher dunkler Fleck als Ersatz für Schatten (Schatten sind in CONFIG.render aus). */
export function createBlobShadow(opacity) {   // Phase 25: exportiert, das Ei nutzt denselben Schattenfleck
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 32),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.name = 'blobShadow';
  return mesh;
}

function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  return m;
}

/** Setzt die Position und gibt das Objekt zurück (position selbst ist in three nicht überschreibbar). */
function at(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}

function buildEye(side, mats) {
  const eye = new THREE.Group();
  eye.name = 'eye_' + (side < 0 ? 'left' : 'right');
  eye.position.set(0.13 * side, 0.64 - NECK_Y, 0.325);

  const ball = mesh(new THREE.SphereGeometry(0.088, 20, 14), mats.eye, 'eyeball');
  eye.add(ball);

  const pupil = mesh(new THREE.SphereGeometry(0.042, 14, 10), mats.pupil, 'pupil');
  pupil.position.set(0, 0, 0.06);
  eye.add(pupil);

  const shine = mesh(new THREE.SphereGeometry(0.018, 8, 6), mats.shine, 'shine');
  shine.position.set(0.03, 0.035, 0.075);
  eye.add(shine);

  return { eye, pupil };
}

function buildFin(side, mats) {
  const pivot = new THREE.Group();
  pivot.name = 'fin_' + (side < 0 ? 'left' : 'right');
  pivot.position.set(0.3 * side, 0.76 - NECK_Y, -0.02);
  pivot.rotation.z = -side * 0.55;   // neigt sich nach außen

  const blade = mesh(new THREE.CapsuleGeometry(0.036, 0.25, 4, 10), mats.bodyLight, 'finBlade');
  blade.position.y = 0.15;
  pivot.add(blade);

  const tip = mesh(new THREE.SphereGeometry(0.05, 12, 8), mats.accentGlow, 'finTip');
  tip.position.y = 0.34;
  pivot.add(tip);
  return pivot;
}

function buildTail(mats) {
  const root = new THREE.Group();
  root.name = 'tail1';
  root.position.set(0, -0.18, -0.38);
  root.add(at(mesh(new THREE.SphereGeometry(0.075, 14, 10), mats.body), 0, 0, -0.05));

  const t2 = new THREE.Group();
  t2.name = 'tail2';
  t2.position.set(0, 0, -0.12);
  t2.rotation.x = 0.25;               // hebt das Ende leicht an
  t2.add(at(mesh(new THREE.SphereGeometry(0.058, 14, 10), mats.body), 0, 0, -0.05));
  root.add(t2);

  const t3 = new THREE.Group();
  t3.name = 'tail3';
  t3.position.set(0, 0, -0.11);
  t3.rotation.x = 0.3;
  t3.add(at(mesh(new THREE.SphereGeometry(0.046, 12, 8), mats.body), 0, 0, -0.04));
  t3.add(at(mesh(new THREE.SphereGeometry(0.052, 12, 8), mats.coreGlow, 'tailGlow'), 0, 0, -0.12));
  t2.add(t3);

  return { root, t2, t3 };
}

export function createCreatureModel(appearance = CONFIG.creature.appearance) {
  const a = appearance;
  const group = new THREE.Group();
  group.name = 'creature';
  group.scale.setScalar(CONFIG.creature.scale);

  const mats = {
    body: new THREE.MeshStandardMaterial({ color: a.body, roughness: 0.55, metalness: 0.15 }),
    bodyLight: new THREE.MeshStandardMaterial({ color: a.bodyLight, roughness: 0.6, metalness: 0.1 }),
    plate: new THREE.MeshStandardMaterial({ color: a.plate, roughness: 0.2, metalness: 0.35 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x05060b }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    eye: glowMaterial(a.eye, 1.5),
    coreGlow: glowMaterial(a.core, 1.7),
    accentGlow: glowMaterial(a.accent, 1.2),
    crystalGlow: glowMaterial(a.crystal, 1.6),
    ring: new THREE.MeshStandardMaterial({
      color: a.accent, emissive: a.accent, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.6,
    }),
  };

  // Körper-Pivot: hier greift später die Atmung an (Füße bleiben am Boden).
  const body = new THREE.Group();
  body.name = 'body';
  body.position.y = BODY_BASE_Y;
  group.add(body);

  const torso = mesh(createTorsoGeometry(), mats.body, 'torso');
  body.add(torso);

  const belt = mesh(new THREE.TorusGeometry(0.405, 0.012, 8, 64), mats.ring, 'belt');
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.2;
  body.add(belt);

  const core = mesh(new THREE.SphereGeometry(0.075, 16, 12), mats.coreGlow, 'core');
  core.position.set(0, -0.02, 0.405);
  body.add(core);
  const coreRing = mesh(new THREE.TorusGeometry(0.115, 0.012, 8, 40), mats.ring, 'coreRing');
  coreRing.position.set(0, -0.02, 0.395);
  body.add(coreRing);

  // Kopf
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = NECK_Y;
  body.add(head);

  const skull = mesh(new THREE.SphereGeometry(0.36, 32, 22), mats.body, 'skull');
  skull.scale.set(1.15, 0.95, 1.0);
  skull.position.y = 0.62 - NECK_Y;
  head.add(skull);

  const plate = mesh(new THREE.SphereGeometry(0.3, 28, 18), mats.plate, 'facePlate');
  plate.scale.set(1.1, 0.6, 0.45);
  plate.position.set(0, 0.63 - NECK_Y, 0.27);
  head.add(plate);

  const left = buildEye(-1, mats);
  const right = buildEye(1, mats);
  head.add(left.eye, right.eye);

  const finLeft = buildFin(-1, mats);
  const finRight = buildFin(1, mats);
  head.add(finLeft, finRight);

  const crystal = mesh(new THREE.OctahedronGeometry(0.075, 0), mats.crystalGlow, 'crystal');
  crystal.scale.y = 1.6;
  crystal.position.set(0, 1.13 - NECK_Y, 0);
  head.add(crystal);

  // Schwanz
  const tail = buildTail(mats);
  body.add(tail.root);

  // Füße (am Boden, nicht im Körper-Pivot)
  const feet = [];
  for (const [x, z, id] of [[-0.2, 0.14, 'frontLeft'], [0.2, 0.14, 'frontRight'], [-0.18, -0.12, 'backLeft'], [0.18, -0.12, 'backRight']]) {
    const foot = mesh(new THREE.SphereGeometry(0.1, 16, 10), mats.bodyLight, 'foot_' + id);
    foot.scale.set(1, 0.7, 1.25);
    foot.position.set(x, 0.07, z);
    group.add(foot);
    feet.push(foot);
  }

  const shadow = createBlobShadow(CONFIG.creature.blobShadowOpacity);
  group.add(shadow);

  const parts = {
    body, torso, head, belt, core, shadow, feet, crystal,
    eyes: { left: left.eye, right: right.eye },
    pupils: { left: left.pupil, right: right.pupil },
    fins: { left: finLeft, right: finRight },
    tail: [tail.root, tail.t2, tail.t3],
  };

  function dispose() {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(mats)) m.dispose();
    if (shadow.material.map) shadow.material.map.dispose();
    shadow.material.dispose();
  }

  return { group, parts, appearance: a, dispose };
}

/*
  Furnishing – die feste Einrichtung der Räume (Phase 30 Teil B).
  Baut aus den Daten `FURNISHING` (js/data/habitat.js) je Raum Möbel aus Mesh-Primitiven: Halle (Leuchtpfosten), Forschungsbereich (Konsole, Rack),
  Dekoration (leere Galerie-Sockel), Schlafplatz (Nest, Nachtlicht), Futterplatz (Schale, Spender), Spielbereich (Matte, Kiste),
  Waschplatz (Becken, Seifensäule, Duschring). Keine Dateien, keine Geometrie aus Modellen.

  Zonenanker bleiben frei: alles in der Mitte eines Raums ist flach oder schwebt, Wandstücke stehen im Wandstreifen, den die Kreatur nicht betritt
  (`reserve` im Grundriss, Navigation.js). Der Code hier prüft das nicht, Node-Prüfung beim Bauen der Phase.

  Puppenhaus-Verhalten wie bei den Wänden (Habitat.js): ein Stück an einer Außenwand fährt auf `lowScale` seiner Höhe herunter, wenn die Kamera
  auf dieser Seite der Wand steht (`setViewer`), damit es Reson nie verdeckt. Bei „reduzierte Bewegung“ sofort, ohne Animation.
  Leuchtteile pulsieren leise (nur ohne „reduzierte Bewegung“).

  createFurnishing({ nav, zones }) -> { group, setViewer(position), update(dt, t), getRoomLight(roomId), getItemIds(), getItem(id) }
    nav   = Navigation aus Habitat (`habitat.nav`, liefert Räume mit Mitte `cx`, `cz`)
    zones = `CONFIG.habitat.zones` (Farbe je Bereich für die Teile mit `color: 'zone'` und für das Raumlicht)
  getRoomLight(roomId) -> { color, strength } für `lighting.setFocus` (Farbe des Bereichs, in der Halle Gold).
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';
import { FURNISHING, FURNITURE_COLORS, ROOM_LIGHT, FLOORPLAN } from '../data/habitat.js';

const WALL_NORMALS = {
  n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, w: { x: -1, z: 0 }, e: { x: 1, z: 0 },
};

export function createFurnishing({ nav, zones }) {
  const calm = prefersReducedMotion();
  const group = new THREE.Group();
  group.name = 'furnishing';

  const zoneColorOfRoom = new Map((zones || []).map((z) => [z.room, z.color]));
  const geometries = new Map();
  const materials = new Map();
  const glows = [];                      // { mat, base, phase }
  const items = new Map();               // id -> { def, group, normal|null, h (aktueller Höhenanteil), cx, cz }

  function geometryFor(shape, args) {
    const key = shape + ':' + args.join(',');
    let g = geometries.get(key);
    if (g) return g;
    switch (shape) {
      case 'box': g = new THREE.BoxGeometry(args[0], args[1], args[2]); break;
      case 'cyl': g = new THREE.CylinderGeometry(args[0], args[1], args[2], args[3] || 16); break;
      case 'torus': g = new THREE.TorusGeometry(args[0], args[1], args[2] || 8, args[3] || 24); break;
      case 'sphere': g = new THREE.SphereGeometry(args[0], 20, 14); break;
      case 'cone': g = new THREE.ConeGeometry(args[0], args[1], args[2] || 20); break;
      case 'octa': g = new THREE.OctahedronGeometry(args[0]); break;
      default: throw new Error('Einrichtung: unbekannte Form ' + shape);
    }
    geometries.set(key, g);
    return g;
  }

  function resolveColor(c, roomId) {
    if (c === 'zone') return zoneColorOfRoom.has(roomId) ? zoneColorOfRoom.get(roomId) : CONFIG.colors.gold;
    if (typeof c === 'string') {
      if (!(c in FURNITURE_COLORS)) throw new Error('Einrichtung: unbekannte Farbe ' + c);
      return FURNITURE_COLORS[c];
    }
    return c;
  }

  function materialFor(color, glow, opacity) {
    const key = color + '|' + (glow || 0) + '|' + (opacity ?? 1);
    let m = materials.get(key);
    if (m) return m;
    const translucent = opacity !== undefined && opacity < 1;
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: glow ? 0.4 : 0.7,
      metalness: glow ? 0.3 : 0.35,
      emissive: glow ? color : 0x000000,
      emissiveIntensity: glow || 0,
      transparent: translucent,
      opacity: translucent ? opacity : 1,
      depthWrite: !translucent,
      side: translucent ? THREE.DoubleSide : THREE.FrontSide,
    });
    materials.set(key, m);
    if (glow) glows.push({ mat: m, base: glow, phase: glows.length * 1.7 });
    return m;
  }

  function buildItem(def) {
    const room = nav.getRoom(def.room);
    if (!room) throw new Error('Einrichtung ' + def.id + ' verweist auf unbekannten Raum ' + def.room);
    const holder = new THREE.Group();
    holder.name = 'furniture_' + def.id;
    holder.position.set(room.cx + def.at[0], 0, room.cz + def.at[1]);
    holder.rotation.y = def.rot || 0;
    for (const p of def.parts) {
      const mesh = new THREE.Mesh(
        geometryFor(p.shape, p.args),
        materialFor(resolveColor(p.color, def.room), p.glow, p.opacity),
      );
      if (p.pos) mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      mesh.name = def.id + '_' + p.shape;
      if (p.overhead) mesh.userData.overhead = true;
      holder.add(mesh);
    }
    group.add(holder);
    const normal = def.wall ? WALL_NORMALS[def.wall] : null;
    if (def.wall && !normal) throw new Error('Einrichtung ' + def.id + ': unbekannte Wand ' + def.wall);
    items.set(def.id, { def, group: holder, normal, h: 1, cx: holder.position.x, cz: holder.position.z });
  }

  for (const def of FURNISHING.items) buildItem(def);

  let viewer = null;

  function setViewer(position) { viewer = position || null; }

  /** Wandstücke zur Kamera hin niedrig, die anderen in voller Höhe (gleiche Regel wie die Außenwände in Habitat.js). */
  function updateItems(dt) {
    if (!viewer) return;
    const k = calm ? 1 : 1 - Math.exp(-FLOORPLAN.wallFadeSpeed * dt);
    for (const it of items.values()) {
      if (!it.normal) continue;
      const facing = it.normal.x * (viewer.x - it.cx) + it.normal.z * (viewer.z - it.cz);
      const target = facing > 0.5 ? FURNISHING.lowScale : 1;
      if (it.h === target) continue;
      it.h += (target - it.h) * k;
      if (Math.abs(target - it.h) < 0.004) it.h = target;
      it.group.scale.y = it.h;
    }
  }

  function update(dt, t) {
    updateItems(dt);
    if (calm) return;
    for (const g of glows) {
      g.mat.emissiveIntensity = g.base * (1 + FURNISHING.glowPulse * Math.sin(t * 1.1 + g.phase));
    }
  }

  /** Licht für den Raum: Farbe des Bereichs (Halle: Gold) und Helligkeitsfaktor. */
  function getRoomLight(roomId) {
    const color = zoneColorOfRoom.has(roomId) ? zoneColorOfRoom.get(roomId) : CONFIG.colors.gold;
    const strength = ROOM_LIGHT.strength[roomId] ?? 1;
    return { color, strength };
  }

  return {
    group, setViewer, update, getRoomLight,
    getItemIds: () => [...items.keys()],
    getItem: (id) => items.get(id) || null,
  };
}

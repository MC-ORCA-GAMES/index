/*
  Habitat – der Lebensraum: ein Grundriss aus echten Räumen (Phase 30 Teil A): Halle in der Mitte, Schlafplatz, Futterplatz, Spielbereich,
  Forschungsbereich, Dekorationsraum und Waschplatz als eigene Räume mit Boden, Wänden und Türen. Daten: `FLOORPLAN` (js/data/habitat.js),
  Begehbarkeit und Wege: js/world/Navigation.js (`habitat.nav`).
  Zonen: jeder Bereich hat weiter eine Zone (Anker im Raum, `CONFIG.habitat.zones`) mit Bodenmarkierung und -zeichen; Ab Phase 07 wählt die Kreatur
  Zonen über getZonePosition(id) selbst (Phase 16: Zone `wash` = Waschplatz). Phase 30: jede Zone trägt ein flaches Bodenzeichen (Form je Bereich).
  Wände (Puppenhaus-Ansicht): Außenwände auf der Seite der Kamera fahren herunter, die gegenüberliegenden stehen hoch; Innenwände sind immer niedrig,
  damit die Kreatur nie verdeckt wird. `setViewer(position)` meldet die Kamera, `update(dt, t)` bewegt die Wände (bei „reduzierte Bewegung" sofort).
  Alles aus Mesh-Primitiven, keine Dateien. Nicht im Browser gesehen.
*/
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { prefersReducedMotion } from '../core/env.js';
import { AREA_GLYPHS, HABITAT_RULES, FLOORPLAN } from '../data/habitat.js';
import { createNavigation } from './Navigation.js';

/** Flaches Bodenzeichen (Radius `r`) als Gruppe in der Farbe `color`; Form nach `kind` (siehe AREA_GLYPHS). Nur Mesh-Primitive, kein Laden von Dateien. */
function createGlyph(kind, color, r) {
  const G = HABITAT_RULES.glyph;
  const mat = () => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: G.opacity, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const group = new THREE.Group();
  group.name = 'glyph_' + kind;
  const flat = (geo) => {
    const m = new THREE.Mesh(geo, mat());
    m.rotation.x = -Math.PI / 2;
    group.add(m);
    return m;
  };
  if (kind === 'crescent') {
    // Mondsichel: großer Kreisbogen minus versetzter kleinerer Bogen
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65, false);
    sh.absarc(r * 0.38, 0, r * 0.82, Math.PI * 1.55, Math.PI * 0.45, true);
    flat(new THREE.ShapeGeometry(sh, 24));
  } else if (kind === 'hexagon') {
    flat(new THREE.RingGeometry(r * 0.68, r, 6));
    flat(new THREE.CircleGeometry(r * 0.2, 16));
  } else if (kind === 'triangle') {
    const t = flat(new THREE.RingGeometry(r * 0.62, r, 3));
    t.rotation.z = Math.PI / 2;      // Spitze zeigt nach hinten (von der Kamera weg)
  } else if (kind === 'cross') {
    flat(new THREE.RingGeometry(r * 0.52, r * 0.62, 32));
    flat(new THREE.PlaneGeometry(r * 2, r * 0.1));
    flat(new THREE.PlaneGeometry(r * 0.1, r * 2));
  } else if (kind === 'diamond') {
    flat(new THREE.RingGeometry(r * 0.66, r, 4));   // 4 Segmente ergeben bereits eine Raute (Spitzen auf den Achsen)
  } else if (kind === 'drop') {
    // Tropfen: Spitze oben (hinten im Raum), runder Bauch unten
    const sh = new THREE.Shape();
    sh.moveTo(0, r);
    sh.bezierCurveTo(r * 0.15, r * 0.45, r * 0.7, r * 0.1, r * 0.7, -r * 0.3);
    sh.absarc(0, -r * 0.3, r * 0.7, 0, Math.PI, true);
    sh.bezierCurveTo(-r * 0.7, r * 0.1, -r * 0.15, r * 0.45, 0, r);
    flat(new THREE.ShapeGeometry(sh, 24));
  }
  group.position.y = G.y;
  return group;
}

export class Habitat {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'habitat';
    this.zones = new Map();          // id -> { def, position, ring }
    this.nav = createNavigation(FLOORPLAN);
    this.spawn = new THREE.Object3D();
    this.spawn.name = 'spawn';
    this._calm = prefersReducedMotion();
    this._walls = [];                // { body, trim, normal|null, cx, cz, h, low, high }
    this._viewer = null;             // Kamera-Position (THREE.Vector3) oder null
    this._build();
  }

  _build() {
    const h = CONFIG.habitat;
    const col = CONFIG.colors;
    const fp = FLOORPLAN;
    const T = fp.wallThickness;
    const zoneColor = new Map(h.zones.map((z) => [z.room, z.color]));

    // ---------- Böden: eine Platte je Raum (Oberseite bei y = 0), leicht in der Farbe des Bereichs getönt ----------
    const floorBase = new THREE.Color(col.floor);
    for (const r of this.nav.rooms.values()) {
      const tint = zoneColor.has(r.id) ? floorBase.clone().lerp(new THREE.Color(zoneColor.get(r.id)), 0.1) : floorBase.clone();
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(r.maxX - r.minX, 0.4, r.maxZ - r.minZ),
        new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, metalness: 0.1 }),
      );
      slab.position.set(r.cx, -0.2, r.cz);
      slab.name = 'floor_' + r.id;
      this.group.add(slab);
    }

    // Feiner Ring in der Halle (wie vorher im runden Raum)
    const hall = this.nav.getRoom('halle');
    if (hall) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.6 - 0.015, 1.6 + 0.015, 96),
        new THREE.MeshBasicMaterial({ color: col.teal, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(hall.cx, 0.01, hall.cz);
      this.group.add(ring);
    }

    this._buildWalls(fp, T, zoneColor);

    // ---------- Zonenmarkierungen (Anker in den Räumen) ----------
    for (const def of h.zones) {
      const room = this.nav.getRoom(def.room);
      if (!room) throw new Error('Zone ' + def.id + ' verweist auf unbekannten Raum ' + def.room);
      const off = def.offset || [0, 0];
      const position = new THREE.Vector3(room.cx + off[0], 0, room.cz + off[1]);

      const pad = new THREE.Group();
      pad.name = 'zone_' + def.id;
      pad.position.copy(position);

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 40),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.015;
      pad.add(disc);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.62, 48),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      pad.add(ring);

      // Bodenzeichen des Bereichs (Phase 30)
      const kind = AREA_GLYPHS[def.id];
      if (kind) pad.add(createGlyph(kind, def.color, HABITAT_RULES.glyph.size));

      this.group.add(pad);
      this.zones.set(def.id, { def, position, ring });
    }

    // Spawnpunkt (unsichtbares Objekt + dezenter Ring), in der Halle
    this.spawn.position.set(...h.spawn);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.31, 48),
      new THREE.MeshBasicMaterial({ color: col.teal, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.02;
    this.spawn.add(marker);
    this.group.add(this.spawn);
  }

  /** Wände auf den Zellgrenzen: gemeinsame Wände einmal, mit Lücken für die Türen; Türschwellen als dünner Streifen. */
  _buildWalls(fp, T, zoneColor) {
    const col = CONFIG.colors;
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x232640, roughness: 0.8, metalness: 0.2 });
    const trimMats = new Map();
    const trimMat = (color) => {
      if (!trimMats.has(color)) {
        trimMats.set(color, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.5 }));
      }
      return trimMats.get(color);
    };
    const r3 = (v) => Math.round(v * 1000) / 1000;

    // 1. Kanten sammeln (jede Raumkante; gemeinsame Kanten fallen zusammen)
    const edges = new Map();
    const addEdge = (orient, coord, start, end, roomId, nx, nz) => {
      const key = orient + ':' + r3(coord) + ':' + r3(start) + ':' + r3(end);
      let e = edges.get(key);
      if (!e) { e = { orient, coord, start, end, owners: [], normal: { x: nx, z: nz } }; edges.set(key, e); }
      e.owners.push(roomId);
    };
    for (const r of this.nav.rooms.values()) {
      addEdge('h', r.minZ, r.minX, r.maxX, r.id, 0, -1);
      addEdge('h', r.maxZ, r.minX, r.maxX, r.id, 0, 1);
      addEdge('v', r.minX, r.minZ, r.maxZ, r.id, -1, 0);
      addEdge('v', r.maxX, r.minZ, r.maxZ, r.id, 1, 0);
    }

    // 2. Türlücken je Kante
    const gapsFor = (e) => {
      const gaps = [];
      for (const d of this.nav.doors) {
        const horizontal = d.along.x !== 0;               // Wand läuft in x-Richtung
        if ((e.orient === 'h') !== horizontal) continue;
        const wallCoord = horizontal ? d.z : d.x;
        const lateral = horizontal ? d.x : d.z;
        if (Math.abs(wallCoord - e.coord) > 1e-3) continue;
        if (lateral < e.start - 1e-3 || lateral > e.end + 1e-3) continue;
        gaps.push([lateral - d.width / 2, lateral + d.width / 2]);
        this._addThreshold(d, T, trimMat(col.gold));
      }
      return gaps.sort((a, b) => a[0] - b[0]);
    };

    // 3. Wandstücke bauen
    for (const e of edges.values()) {
      const internal = e.owners.length > 1;
      const color = internal ? col.gold : (zoneColor.get(e.owners[0]) ?? col.teal);
      const pieces = [];
      let cursor = e.start;
      let cursorIsGap = false;
      for (const g of gapsFor(e)) {
        pieces.push([cursor, g[0], cursorIsGap, true]);
        cursor = g[1];
        cursorIsGap = true;
      }
      pieces.push([cursor, e.end, cursorIsGap, false]);
      for (const [a0, a1, startsAtGap, endsAtGap] of pieces) {
        const from = a0 - (startsAtGap ? 0 : T / 2);   // an Ecken um die Wanddicke verlängern, an Türen nicht
        const to = a1 + (endsAtGap ? 0 : T / 2);
        if (to - from < 0.05) continue;
        const len = to - from;
        const mid = (from + to) / 2;
        const cx = e.orient === 'h' ? mid : e.coord;
        const cz = e.orient === 'h' ? e.coord : mid;
        const sx = e.orient === 'h' ? len : T;
        const sz = e.orient === 'h' ? T : len;

        const high = internal ? fp.innerWallHeight : fp.wallHeight;
        const low = internal ? fp.innerWallHeight : fp.wallLowHeight;
        const body = new THREE.Mesh(unit, wallMat);
        body.scale.set(sx, high, sz);
        body.position.set(cx, high / 2, cz);
        body.name = 'wall';
        const trim = new THREE.Mesh(unit, trimMat(color));
        trim.scale.set(sx, 0.05, sz);
        trim.position.set(cx, high + 0.025, cz);
        trim.name = 'wall_trim';
        this.group.add(body, trim);
        this._walls.push({ body, trim, normal: internal ? null : e.normal, cx, cz, h: high, low, high, sx, sz });
      }
    }
  }

  _addThreshold(d, T, mat) {
    const horizontal = d.along.x !== 0;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? d.width : T, 0.02, horizontal ? T : d.width),
      mat,
    );
    strip.position.set(d.x, 0.012, d.z);
    strip.name = 'door_threshold';
    this.group.add(strip);
  }

  /** Kameraposition für die Puppenhaus-Wände (Kopie wird nicht angelegt, die Referenz wird gelesen). */
  setViewer(position) { this._viewer = position || null; }

  getZoneIds() { return [...this.zones.keys()]; }

  /** Weltposition der Zonenmitte (Kopie, darf verändert werden). */
  getZonePosition(id) {
    const z = this.zones.get(id);
    return z ? z.position.clone() : null;
  }

  /** Raum-Id an einem Weltpunkt (`{ x, z }`, z. B. die Kreatur-Position) oder null. */
  getRoomAt(p) { return this.nav.regionAt(p); }

  /** Mitte eines Raums als { x, z } oder null. */
  getRoomCenter(id) {
    const r = this.nav.getRoom(id);
    return r ? { x: r.cx, z: r.cz } : null;
  }

  update(dt, t) {
    this._updateWalls(dt);
    if (this._calm) return;
    let i = 0;
    for (const z of this.zones.values()) {
      z.ring.material.opacity = 0.5 + 0.08 * Math.sin(t * 0.8 + i * 1.3);
      i++;
    }
  }

  /** Außenwände zur Kamera hin niedrig, die anderen hoch. */
  _updateWalls(dt) {
    const cam = this._viewer;
    if (!cam) return;
    const k = this._calm ? 1 : 1 - Math.exp(-FLOORPLAN.wallFadeSpeed * dt);
    for (const w of this._walls) {
      if (!w.normal) continue;
      const facing = w.normal.x * (cam.x - w.cx) + w.normal.z * (cam.z - w.cz);
      const target = facing > 0.5 ? w.low : w.high;
      if (w.h === target) continue;
      w.h += (target - w.h) * k;
      if (Math.abs(target - w.h) < 0.004) w.h = target;
      w.body.scale.y = w.h;
      w.body.position.y = w.h / 2;
      w.trim.position.y = w.h + 0.025;
    }
  }
}

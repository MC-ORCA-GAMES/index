/*
  Navigation – Begehbarkeit und Wegfindung im Grundriss (Phase 30 Teil A).
  Reine Rechnung auf Zahlen ({ x, z }), kein Three.js: leicht lesbar und in Node prüfbar.

  Aus `FLOORPLAN` (js/data/habitat.js) entstehen
    - Räume: Rechtecke (Zelle des Rasters),
    - Türen: Öffnungen in der gemeinsamen Wand zweier Räume,
    - begehbare Flächen: jeder Raum nach innen um `walkMargin` verkleinert, plus je ein Rechteck pro Tür.
  Die Kreatur darf nur dort stehen (`clamp`) und geht zwischen Räumen über Wegpunkte durch die Türmitten (`plan`).
  Räume bilden einen Graph (Türen = Kanten); `plan` nimmt den Weg mit den wenigsten Räumen (Breitensuche).

  createNavigation(plan) ->
    { rooms, doors, regionAt(p), isWalkable(p), clamp(p), plan(from, to), randomPoint(regionId, rng), getRoom(id), getRegionIds() }
*/

const EPS = 1e-6;

/** Baut aus dem Grundriss Räume und Türen mit Weltkoordinaten. */
export function buildLayout(fp) {
  const rooms = new Map();
  for (const r of fp.rooms) {
    const cx = r.col * fp.pitch;
    const cz = r.row * fp.pitch;
    const half = fp.pitch / 2;
    rooms.set(r.id, {
      id: r.id, label: r.label, zone: r.zone || null, col: r.col, row: r.row, reserve: r.reserve || null,
      cx, cz, hx: half, hz: half,                // Zelle bis zur Wandmitte
      minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half,
    });
  }

  const doors = [];
  for (const d of fp.doors) {
    const A = rooms.get(d.a);
    const B = rooms.get(d.b);
    if (!A || !B) throw new Error('Tür verweist auf unbekannten Raum: ' + d.a + ' / ' + d.b);
    const dc = B.col - A.col;
    const dr = B.row - A.row;
    if (Math.abs(dc) + Math.abs(dr) !== 1) throw new Error('Tür nur zwischen Nachbarräumen: ' + d.a + ' / ' + d.b);
    // Wandmitte zwischen den Räumen; `axis` zeigt von a nach b, `along` läuft an der Wand entlang
    const x = (A.cx + B.cx) / 2;
    const z = (A.cz + B.cz) / 2;
    doors.push({
      a: d.a, b: d.b, x, z,
      axis: { x: dc, z: dr }, along: { x: dr !== 0 ? 1 : 0, z: dc !== 0 ? 1 : 0 },
      width: fp.doorWidth,
      before: { x: x - dc * fp.doorStep, z: z - dr * fp.doorStep },   // Wegpunkt auf der Seite von a
      after: { x: x + dc * fp.doorStep, z: z + dr * fp.doorStep },    // Wegpunkt auf der Seite von b
    });
  }
  return { rooms, doors };
}

export function createNavigation(fp) {
  const { rooms, doors } = buildLayout(fp);
  const margin = fp.walkMargin;
  const wall = fp.wallThickness / 2;
  const walkInset = wall + margin;

  // Begehbare Rechtecke: Räume (verkleinert) und Türdurchgänge
  const rects = [];
  const roomRect = new Map();
  for (const r of rooms.values()) {
    const rs = r.reserve || {};   // Teil B: Wandstreifen mit Einrichtung (n hinten, s vorn, w links, e rechts), nie an einer Tür
    const rect = {
      minX: r.minX + walkInset + (rs.w || 0), maxX: r.maxX - walkInset - (rs.e || 0),
      minZ: r.minZ + walkInset + (rs.n || 0), maxZ: r.maxZ - walkInset - (rs.s || 0), room: r.id,
    };
    rects.push(rect);
    roomRect.set(r.id, rect);
  }
  const doorHalfWidth = Math.max(0.1, fp.doorWidth / 2 - 0.15);   // Körper passt mit etwas Luft durch
  const doorReach = fp.doorStep + 0.05;                           // reicht bis an die Wegpunkte, überlappt die Raumflächen
  for (const d of doors) {
    const alongX = d.along.x !== 0;   // Wand verläuft in x-Richtung -> Durchgang ist in z lang
    rects.push(alongX
      ? { minX: d.x - doorHalfWidth, maxX: d.x + doorHalfWidth, minZ: d.z - doorReach, maxZ: d.z + doorReach, door: true }
      : { minX: d.x - doorReach, maxX: d.x + doorReach, minZ: d.z - doorHalfWidth, maxZ: d.z + doorHalfWidth, door: true });
  }

  // Graph: Raum -> [{ to, door, from: Wegpunkt auf eigener Seite, into: Wegpunkt auf der Gegenseite }]
  const edges = new Map();
  for (const id of rooms.keys()) edges.set(id, []);
  for (const d of doors) {
    edges.get(d.a).push({ to: d.b, door: d, from: d.before, into: d.after });
    edges.get(d.b).push({ to: d.a, door: d, from: d.after, into: d.before });
  }

  const inside = (p, r) => p.x >= r.minX - EPS && p.x <= r.maxX + EPS && p.z >= r.minZ - EPS && p.z <= r.maxZ + EPS;
  const clampTo = (p, r) => ({ x: Math.min(r.maxX, Math.max(r.minX, p.x)), z: Math.min(r.maxZ, Math.max(r.minZ, p.z)) });

  function isWalkable(p) {
    for (const r of rects) if (inside(p, r)) return true;
    return false;
  }

  /** Nächster begehbarer Punkt (liegt der Punkt schon auf begehbarer Fläche, bleibt er unverändert). */
  function clamp(p) {
    if (isWalkable(p)) return { x: p.x, z: p.z };
    let best = null;
    let bestD = Infinity;
    for (const r of rects) {
      const c = clampTo(p, r);
      const d = (c.x - p.x) * (c.x - p.x) + (c.z - p.z) * (c.z - p.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /** Raum, in dem der Punkt liegt (Zelle bis zur Wandmitte); in Türen und außerhalb: der nächste Raum. */
  function regionAt(p) {
    let best = null;
    let bestD = Infinity;
    for (const r of rooms.values()) {
      const dx = Math.max(r.minX - p.x, 0, p.x - r.maxX);
      const dz = Math.max(r.minZ - p.z, 0, p.z - r.maxZ);
      const d = dx * dx + dz * dz;
      if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && best && Math.hypot(p.x - r.cx, p.z - r.cz) < Math.hypot(p.x - best.cx, p.z - best.cz))) {
        bestD = d; best = r;
      }
    }
    return best ? best.id : null;
  }

  /** Raumfolge von `from` nach `to` (Raum-Ids, beide enthalten) oder null. Breitensuche, wenigste Räume. */
  function route(from, to) {
    if (from === to) return [from];
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of edges.get(cur)) {
        if (prev.has(e.to)) continue;
        prev.set(e.to, { room: cur, edge: e });
        if (e.to === to) {
          const out = [];
          let at = to;
          while (at !== null) { out.push(at); const q = prev.get(at); at = q ? q.room : null; }
          return out.reverse();
        }
        queue.push(e.to);
      }
    }
    return null;
  }

  /**
   * Wegpunkte von `from` nach `to` (Ziel wird auf begehbare Fläche gesetzt und ist der letzte Punkt).
   * Im selben Raum nur das Ziel; sonst vor jeder Tür der Punkt davor und dahinter, dann das Ziel.
   */
  function plan(from, to) {
    const goal = clamp(to);
    const rFrom = regionAt(from);
    const rTo = regionAt(goal);
    if (rFrom === null || rTo === null || rFrom === rTo) return [goal];
    const path = route(rFrom, rTo);
    if (!path) return [goal];
    const out = [];
    for (let i = 0; i < path.length - 1; i++) {
      const e = edges.get(path[i]).find((x) => x.to === path[i + 1]);
      out.push({ x: e.from.x, z: e.from.z }, { x: e.into.x, z: e.into.z });
    }
    out.push(goal);
    return out;
  }

  /** Zufälliger begehbarer Punkt im Raum `regionId` (rng: () => [0,1)). */
  function randomPoint(regionId, rng) {
    const r = roomRect.get(regionId) || roomRect.get(rooms.keys().next().value);
    return { x: r.minX + rng() * (r.maxX - r.minX), z: r.minZ + rng() * (r.maxZ - r.minZ) };
  }

  return {
    rooms, doors,
    regionAt, isWalkable, clamp, plan, route, randomPoint,
    getRoom: (id) => rooms.get(id) || null,
    getRegionIds: () => [...rooms.keys()],
  };
}

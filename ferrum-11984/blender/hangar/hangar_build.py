"""
HANGAR-INNENRAUM (FERRUM-11984) - Teil 1: MASSE + BODEN
=======================================================
Nutzung (ohne Blender):  python3 hangar_build.py
   -> hangar.obj + hangar.mtl     (Blender: File > Import > Wavefront; je Gruppe+Material ein Objekt)
   -> hangar_layout.json          (Prototypen + Instanzen + Gruppen + Kollision + Profil;
                                   das Spiel baut daraus InstancedMeshes, spaeter als HANGAR_LAYOUT eingebettet)
Vorschau:  python3 render_preview.py hangar.obj vorschau_teil1.png
Abhaengigkeiten: numpy shapely mapbox-earcut matplotlib

Koordinaten: Z oben, X rechts, Y Tiefe. Tor bei y=-D/2, Rueckwand bei y=+D/2. Alle Masse stehen in hangar_params.json.
Primitive:  BOX / CYL (wie Stationen) und PRISM = Polygon (mit Loechern) in lokaler XY, entlang Z extrudiert.
Zeilenformat (JSON): [kind, cx, cy, cz, sx, sy, sz, rz_oder_achse, mat, seg]  (+ PRISM: 11. Eintrag = Ringe [[x,y]..]; sz = Dicke, cz = Mitte)
Hierarchie-Gruppen (Teil 1): STRUCTURE/FLOOR_*, LANDING_AREA/LANDING_PAD, PAD_RING, CLAMP_PITS, GATE_THRESHOLD, FLOOR_UNDERLAY, INLAYS, GUIDE_*
Spaetere Teile ergaenzen dieses Skript (Prototypen + Instanzen), siehe HANDOFF.md.
"""
import json, math, os, sys
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, box as sbox, Point
from shapely.geometry.polygon import orient
from shapely import affinity
import mapbox_earcut as earcut

HERE = os.path.dirname(os.path.abspath(__file__))
PAR = json.load(open(os.path.join(HERE, "hangar_params.json")))

# ---------------------------------------------------------------- Materialien (Reihenfolge fest ueber alle Teile!)
# name: (Kd sRGB, metallic, roughness)   -- NIRGENDS emissive (Ke wird nie geschrieben)
HULL, HULL2, FLOOR, FLOOR2, UNDER, BRASS, HAZARD, DARK, PADDING, GLASS, LAMP, FIELD, GUIDE = range(13)
MATS = [
    ("hull",    (.17, .18, .20), .60, .55),
    ("hull2",   (.09, .09, .10), .60, .60),
    ("floor",   (.20, .21, .23), .70, .50),
    ("floor2",  (.15, .16, .18), .70, .55),
    ("under",   (.04, .04, .05), .50, .70),
    ("brass",   (.788, .635, .290), .80, .40),   # #C9A24A als MATERIAL
    ("hazard",  (.90, .38, .10), .10, .60),
    ("dark",    (.03, .03, .035), .50, .70),
    ("padding", (.05, .05, .055), .00, .90),
    ("glass",   (.20, .45, .60), .00, .10),
    ("lamp",    (1.0, .95, .82), .00, .50),
    ("field",   (.30, .65, 1.0), .00, .30),
    ("guide",   (.055, .227, .133), .00, .60),
]
BOX, CYL, PRISM = 0, 1, 3

# ---------------------------------------------------------------- Prototypen
PROTOS, PNAMES = {}, []
def new(name):
    PROTOS[name] = []; PNAMES.append(name); return PROTOS[name]
def box(L, c, s, m, rz=0.0): L.append([BOX, *c, *s, rz, m, 0])
def geoms(g):
    if g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    return [x for part in getattr(g, "geoms", []) for x in geoms(part)]
def prism(L, geom, z0, z1, m):
    for pg in geoms(geom):
        if pg.area < 1e-4: continue
        pg = orient(pg, 1.0)
        rings = [[[round(x, 3), round(y, 3)] for x, y in list(pg.exterior.coords)[:-1]]]
        rings += [[[round(x, 3), round(y, 3)] for x, y in list(h.coords)[:-1]] for h in pg.interiors]
        L.append([PRISM, 0, 0, round((z0 + z1) / 2, 4), 0, 0, round(z1 - z0, 4), 2, m, 0, rings])

RIM = 0.35      # Randleiste der Bodenplatten
GAP = 0.05      # halbe Fuge zwischen Platten

def panel_rect(L, w, d, body_m, rim_m, bolts=False):
    """Bodenplatte w x d: Koerper bis z=-0.06 (eingelassene Flaeche) + erhabene Randleiste bis z=0"""
    pw, pd = w - 2 * GAP, d - 2 * GAP
    box(L, (0, 0, -0.28), (pw, pd, 0.44), body_m)
    for sy in (-1, 1): box(L, (0, sy * (pd - RIM) / 2, -0.03), (pw, RIM, 0.06), rim_m)
    for sx in (-1, 1): box(L, (sx * (pw - RIM) / 2, 0, -0.03), (RIM, pd - 2 * RIM, 0.06), rim_m)
    if bolts:
        for sx in (-1, 1):
            for sy in (-1, 1): box(L, (sx * (pw / 2 - .55), sy * (pd / 2 - .55), -0.035), (.32, .32, .05), DARK)

def build_protos():
    P = PAR; pnl = P["panel"]; bay = P["bay_width"]; rr = P["pad_diameter"] / 2; rw = P["pad_ring_width"]
    # --- Bodenmodule (8 x 8 Zentrum, 6 x 8 Rand)
    panel_rect(new("floor_panel_a"), pnl, pnl, FLOOR2, FLOOR)
    panel_rect(new("floor_panel_b"), pnl, pnl, FLOOR, FLOOR2, bolts=True)
    panel_rect(new("floor_strip"), bay, pnl, FLOOR2, FLOOR)
    panel_rect(new("floor_half_8x4"), pnl, 4, FLOOR2, FLOOR)
    panel_rect(new("floor_strip_half_6x4"), bay, 4, FLOOR2, FLOOR)
    # Wartungsklappe: Platte mit Messingrahmen + 2 versenkte Griffmulden
    L = new("floor_hatch"); panel_rect(L, pnl, pnl, FLOOR, FLOOR2)
    fw = 6.2; ft = .25
    for sy in (-1, 1): box(L, (0, sy * (fw - ft) / 2, .01), (fw, ft, .04), BRASS)
    for sx in (-1, 1): box(L, (sx * (fw - ft) / 2, 0, .01), (ft, fw - 2 * ft, .04), BRASS)
    for sx in (-1, 1): box(L, (sx * 1.3, 0, -.1), (1.3, .5, .1), DARK)
    # --- Warnstreifen am Tor (diagonale Streifen, auf das Rechteck geschnitten)
    for nm, w in (("hazard_8x4", pnl), ("hazard_6x4", bay)):
        L = new(nm); d = P["hazard_depth"]
        box(L, (0, 0, -0.26), (w - 2 * GAP, d - 2 * GAP, 0.48), DARK)
        rect = sbox(-w / 2 + .1, -d / 2 + .1, w / 2 - .1, d / 2 - .1); x = -w / 2 - d
        while x < w / 2:
            par = Polygon([(x, -d / 2), (x + .9, -d / 2), (x + .9 + d, d / 2), (x + d, d / 2)])
            prism(L, par.intersection(rect), -0.02, 0.01, HAZARD); x += 1.8
    # --- Landeplatz
    g = 0.06
    quad = Polygon([(0, 0)] + [(rr - rw) * np.array([math.cos(a), math.sin(a)]) for a in np.linspace(0, math.pi / 2, 28)])
    quad = quad.intersection(sbox(g, g, 100, 100))
    pits = pit_polys()
    quad_h = quad.difference(pits[0])                       # Klammer-Aussparung bei 45 Grad
    L = new("pad_plate_quadrant")
    prism(L, quad_h, -0.5, -0.06, FLOOR2)
    prism(L, quad_h.difference(quad_h.buffer(-RIM)), -0.06, 0.0, FLOOR)
    L = new("pad_ring_seg")                                 # 16 Segmente, bundig eingelegtes Messing
    def arc(r0, r1, a0, a1, n=8):
        t = np.linspace(a0, a1, n)
        return Polygon([(r1 * math.cos(a), r1 * math.sin(a)) for a in t] + [(r0 * math.cos(a), r0 * math.sin(a)) for a in t[::-1]])
    da = math.radians(.35)
    prism(L, arc(rr - rw, rr, da, math.pi / 8 - da), -0.5, 0.03, BRASS)
    L = new("pad_inner_seg")                                # innere Fuehrungslinie, 8 Segmente
    prism(L, arc(6.0, 6.3, math.radians(2), math.pi / 4 - math.radians(2), 6), -0.5, 0.03, BRASS)
    L = new("pad_corner_filler")                            # Viertel-Quadrat 16x16 minus Kreis (Bodenanschluss ums runde Pad)
    fil = sbox(GAP, GAP, P["pad_zone"] / 2 - GAP, P["pad_zone"] / 2 - GAP).difference(Point(0, 0).buffer(rr, 32))
    prism(L, fil, -0.5, -0.06, FLOOR2)
    prism(L, fil.difference(fil.buffer(-RIM)), -0.06, 0.0, FLOOR)
    L = new("pad_underlay")                                 # Unterbau der Pad-Zone mit 4 Loechern
    z = P["pad_zone"] / 2
    prism(L, sbox(-z, -z, z, z).difference(MultiPoly(pits_all())), P["underlay_bottom_z"], -0.5, UNDER)
    # --- Klammer-Aussparung: Boden + Messingrahmen (das Klammer-Modul selbst folgt in Teil 2)
    L = new("clamp_pit")
    pr, pt, pd = P["clamp_pit_radial"], P["clamp_pit_tangential"], P["clamp_pit_depth"]
    box(L, (0, 0, -pd - .05), (pr + .4, pt + .4, .1), DARK)
    fr = .25
    for sy in (-1, 1): box(L, (0, sy * (pt + fr) / 2, .01), (pr + 2 * fr, fr, .04), BRASS)
    for sx in (-1, 1): box(L, (sx * (pr + fr) / 2, 0, .01), (fr, pt, .04), BRASS)
    # --- Einlagen, Unterbau, Leitlicht
    box(new("inlay_unit"), (.5, 0, .005), (1, .3, .05), BRASS)
    box(new("under_unit"), (0, 0, 0), (1, 1, 1), UNDER)
    box(new("threshold_edge"), (0, 0, -.2), (1, .5, .5), BRASS)
    box(new("guide_frame"), (0, 0, .03), (2.9, 1.9, .08), DARK)
    box(new("guide_light"), (0, 0, .09), (2.4, 1.4, .05), GUIDE)

def pit_rect(ang_deg):
    P = PAR; pr, pt = P["clamp_pit_radial"], P["clamp_pit_tangential"]
    r = sbox(-pr / 2, -pt / 2, pr / 2, pt / 2)
    r = affinity.translate(r, P["clamp_radius"], 0)
    return affinity.rotate(r, ang_deg, origin=(0, 0))
def pit_polys(): return [pit_rect(a) for a in PAR["clamp_angles_deg"]]
def pits_all(): return pit_polys()
def MultiPoly(lst):
    from shapely.ops import unary_union
    return unary_union(lst)

# ---------------------------------------------------------------- Instanzen
INST = []
GROUPS = {}
def inst(p, loc, rz=0.0, scale=(1, 1, 1), g=None):
    c, s = math.cos(rz), math.sin(rz)
    R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.0]])
    INST.append(dict(p=p, loc=tuple(loc), scale=tuple(scale), R=R, g=g))
    if g: GROUPS.setdefault(g, []).append(len(INST) - 1)

def build_hangar_part1():
    P = PAR; pnl = P["panel"]; W = P["floor_inner_width"]; D = P["depth"]; bay = P["bay_width"]
    ncol, nrow = int(W // pnl), int(D // pnl)
    xs = [-W / 2 + pnl / 2 + pnl * i for i in range(ncol)]
    ys = [-D / 2 + pnl / 2 + pnl * j for j in range(nrow)]
    zone = P["pad_zone"] / 2
    haz = P["hazard_depth"]
    hatches = {(-20, -28), (20, -28), (-20, 28), (20, 28)}      # Wartungsklappen (Zellmitten)
    # --- Zentrum-Boden (8x8-Module); Pad-Zone und Tor-Reihe ausgenommen
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            if abs(x) < zone and abs(y) < zone: continue
            if j == 0:
                inst("hazard_8x4", (x, y - pnl / 2 + haz / 2, 0), g="GATE_THRESHOLD")
                inst("floor_half_8x4", (x, y + pnl / 2 - 2, 0), g="FLOOR_CENTER")
                continue
            if (x, y) in hatches: inst("floor_hatch", (x, y, 0), g="FLOOR_HATCHES"); continue
            p = "floor_panel_b" if (i * 7 + j * 3) % 5 == 0 else "floor_panel_a"
            inst(p, (x, y, 0), g="FLOOR_CENTER")
    # --- Randstreifen (6x8) rechts/links, Platz fuer die Seitenbuchten (Teil 5)
    for sx in (-1, 1):
        cx = sx * (W / 2 + bay / 2)
        for j, y in enumerate(ys):
            if j == 0:
                inst("hazard_6x4", (cx, y - pnl / 2 + haz / 2, 0), g="GATE_THRESHOLD")
                inst("floor_strip_half_6x4", (cx, y + pnl / 2 - 2, 0), g="FLOOR_PERIMETER")
            else: inst("floor_strip", (cx, y, 0), g="FLOOR_PERIMETER")
    # --- Landeplatz (bundig): 4 Quadranten-Platten, 4 Eckfueller, 16 + 8 Messingsegmente
    for k in range(4):
        inst("pad_plate_quadrant", (0, 0, 0), rz=k * math.pi / 2, g="LANDING_PAD")
        inst("pad_corner_filler", (0, 0, 0), rz=k * math.pi / 2, g="LANDING_PAD")
    for k in range(16): inst("pad_ring_seg", (0, 0, 0), rz=k * math.pi / 8, g="PAD_RING")
    for k in range(8): inst("pad_inner_seg", (0, 0, 0), rz=k * math.pi / 4, g="PAD_RING")
    inst("pad_underlay", (0, 0, 0), g="FLOOR_UNDERLAY")
    for a in P["clamp_angles_deg"]:
        r = math.radians(a)
        inst("clamp_pit", (P["clamp_radius"] * math.cos(r), P["clamp_radius"] * math.sin(r), 0), rz=r, g="CLAMP_PITS")
    for rz in (0, math.pi / 2):                               # kleines Fadenkreuz in der Padmitte
        for sx in (-1, 1): inst("inlay_unit", (0, 0, 0), rz=rz + (0 if sx > 0 else math.pi), scale=(2.2, 1, 1), g="INLAYS")
    # --- Unterbau (dunkel, unter den Fugen): 4 Felder um die Pad-Zone + 2 Randstreifen
    ub0, ub1 = P["underlay_bottom_z"], -P["panel_thickness"]
    zc, zh = (ub0 + ub1) / 2, ub1 - ub0
    inst("under_unit", (0, -(D / 2 + zone) / 2, zc), scale=(W, D / 2 - zone, zh), g="FLOOR_UNDERLAY")
    inst("under_unit", (0, (D / 2 + zone) / 2, zc), scale=(W, D / 2 - zone, zh), g="FLOOR_UNDERLAY")
    for sx in (-1, 1):
        inst("under_unit", (sx * (W / 2 + zone) / 2, 0, zc), scale=(W / 2 - zone, 2 * zone, zh), g="FLOOR_UNDERLAY")
        inst("under_unit", (sx * (W / 2 + bay / 2), 0, zc), scale=(bay, D, zh), g="FLOOR_UNDERLAY")
    # --- Messing-Einlagen: Rechteck-Linie im Zentrum (in modularen Segmenten) und Torschwelle
    def line(x0, y0, x1, y1, n, gapf=.97):
        L = math.hypot(x1 - x0, y1 - y0); a = math.atan2(y1 - y0, x1 - x0); seg = L / n
        for k in range(n):
            inst("inlay_unit", (x0 + math.cos(a) * seg * k, y0 + math.sin(a) * seg * k, 0), rz=a, scale=(seg * gapf, 1, 1), g="INLAYS")
    y0 = -D / 2 + haz + 1.4; y1 = D / 2 - 2.2; xl = W / 2 - 1.5
    for sx in (-1, 1): line(sx * xl, y0, sx * xl, y1, 13)
    line(-xl, y1, xl, y1, 8)
    inst("threshold_edge", (0, -D / 2 + .25, 0), scale=(W + 2 * bay, 1, 1), g="GATE_THRESHOLD")
    # --- Leitlicht Tor -> Pad (10 einzeln ansteuerbare Lichter, wie bisher im Spiel)
    n = P["guide_light_count"]; yA = -D / 2 + haz + 3.0; yB = -zone - 3.2
    for k in range(n):
        y = yA + (yB - yA) * k / (n - 1)
        inst("guide_frame", (0, y, 0), g="GUIDE_FRAMES")
        inst("guide_light", (0, y, 0), g="GUIDE_LIGHTS")

COLLIDERS = []
def build_colliders():
    P = PAR; W = P["floor_inner_width"] + 2 * P["bay_width"]; D = P["depth"]
    COLLIDERS.append(dict(name="FLOOR", c=[0, 0, P["underlay_bottom_z"] / 2], s=[W, D, -P["underlay_bottom_z"]]))

# ---------------------------------------------------------------- Geometrie / OBJ
def unit_geo(kind, seg=16):
    if kind == BOX:
        v = np.array([[x, y, z] for x in (-.5, .5) for y in (-.5, .5) for z in (-.5, .5)])
        f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    else:
        a = np.linspace(0, 2 * math.pi, seg, endpoint=False)
        v = np.array([[math.cos(t), -.5, math.sin(t)] for t in a] + [[math.cos(t), .5, math.sin(t)] for t in a])
        f = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
        f += [tuple(range(seg - 1, -1, -1)), tuple(range(seg, 2 * seg))]
    # nach aussen orientieren (konvexe Koerper)
    out = []
    for fc in f:
        p = v[list(fc)]; n = np.cross(p[1] - p[0], p[2] - p[0])
        if n @ p.mean(0) < 0: fc = tuple(reversed(fc))
        out.append(fc)
    return v, out

def prism_geo(pr):
    rings = [np.array(r, float) for r in pr[10]]; z0 = pr[3] - pr[6] / 2; z1 = pr[3] + pr[6] / 2
    flat = np.concatenate(rings); ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
    tri = earcut.triangulate_float64(flat, ends).reshape(-1, 3)
    n = len(flat)
    V = np.concatenate([np.c_[flat, np.full(n, z0)], np.c_[flat, np.full(n, z1)]])
    F = []
    for t in tri:                                          # Deckel (+Z) und Boden (-Z)
        a, b, c = flat[t[0]], flat[t[1]], flat[t[2]]
        up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0
        t = list(t) if up else [t[0], t[2], t[1]]
        F.append(tuple(i + n for i in t)); F.append((t[0], t[2], t[1]))
    off = 0
    for ri, r in enumerate(rings):
        m = len(r)
        sgn = 1 if ri == 0 else -1                         # Aussenring CCW, Loecher CW
        area = sum(r[i][0] * r[(i + 1) % m][1] - r[(i + 1) % m][0] * r[i][1] for i in range(m))
        idx = list(range(off, off + m)); 
        if area * sgn < 0: idx = idx[::-1]
        for i in range(m):
            a, b = idx[i], idx[(i + 1) % m]
            F.append((a, b, b + n, a + n))
        off += m
    return V, F

def prim_geo(pr, cache={}):
    k = pr[0]
    if k == PRISM: return prism_geo(pr)
    key = (k, pr[9])
    if key not in cache: cache[key] = unit_geo(k, pr[9] or 16)
    v, f = cache[key]
    if k == BOX: S = np.diag(pr[4:7]); R3 = np.array([[math.cos(pr[7]), -math.sin(pr[7]), 0], [math.sin(pr[7]), math.cos(pr[7]), 0], [0, 0, 1.0]])
    else: S = np.diag([pr[4], pr[5], pr[4]]); R3 = np.eye(3)
    return (R3 @ S @ v.T).T + np.array(pr[1:4]), f

def write_obj(path):
    nv = 1; verts = []; faces = {}
    for it in INST:
        M = it["R"] @ np.diag(it["scale"])
        for pr in PROTOS[it["p"]]:
            v, f = prim_geo(pr); w = (M @ np.asarray(v).T).T + np.array(it["loc"])
            verts.extend(w.tolist())
            key = (it["g"] or it["p"], MATS[pr[8]][0])
            faces.setdefault(key, []).extend([tuple(i + nv for i in fc) for fc in f]); nv += len(v)
    base = os.path.basename(path).rsplit(".", 1)[0]
    with open(path, "w") as fo:
        fo.write("# Hangar Teil 1 - Z oben, Einheit = Spieleinheit\nmtllib %s.mtl\n" % base)
        for v in verts: fo.write("v %.3f %.3f %.3f\n" % tuple(v))
        for (g, m), fl in sorted(faces.items()):
            fo.write("o %s__%s\nusemtl %s\n" % (g, m, m))
            for fc in fl: fo.write("f " + " ".join(map(str, fc)) + "\n")
    with open(path.rsplit(".", 1)[0] + ".mtl", "w") as fm:
        for nm, kd, me, ro in MATS:
            fm.write("newmtl %s\nKd %.3f %.3f %.3f\nPm %.2f\nPr %.2f\n" % ((nm,) + kd + (me, ro)))
    return len(verts), sum(len(v) for v in faces.values())

def write_json(path):
    r = lambda x: round(float(x), 4)
    ins = []
    for it in INST:
        ident = np.allclose(it["R"], np.eye(3), atol=1e-6)
        ins.append([PNAMES.index(it["p"]), *map(r, it["loc"]), *map(r, it["scale"]), 0 if ident else [r(x) for x in it["R"].flatten()]])
    lay = dict(unit=1, up="Z", mats=[m[0] for m in MATS], matdef=[[m[0], list(m[1]), m[2], m[3]] for m in MATS],
               protos=[[n, PROTOS[n]] for n in PNAMES], inst=ins, groups=GROUPS, colliders=COLLIDERS,
               params=PAR, profile_half=PAR["profile_half"], part=1)
    s = json.dumps(lay, separators=(",", ":")); open(path, "w").write(s); return len(s)

def tri_count():
    t = 0
    for it in INST:
        for pr in PROTOS[it["p"]]:
            t += len(prim_geo(pr)[1]) if pr[0] == PRISM else 12
            if pr[0] == PRISM: t += 0
    return t

if __name__ == "__main__":
    os.chdir(HERE)
    build_protos(); build_hangar_part1(); build_colliders()
    nv, nf = write_obj("hangar.obj"); nj = write_json("hangar_layout.json")
    print("Prototypen:", len(PNAMES), "| Instanzen:", len(INST), "| OBJ-Vertices:", nv, "| Faces:", nf, "| JSON-Bytes:", nj)
    print("Gruppen:", {k: len(v) for k, v in GROUPS.items()})

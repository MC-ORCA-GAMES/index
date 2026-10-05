"""
TRIVAR IV-4 — ZENTRALER HANDELSKNOTEN: modulare Station nach Dreiansichten-Referenz (referenz.png)
=================================================================================================
Nutzung (ohne Blender):  python3 trivar_hub_build.py
   -> trivar_hub.obj + trivar_hub.mtl   (in Blender: File > Import > Wavefront; je Material ein Objekt-Teil)
   -> trivar_hub_layout.json            (Prototypen + Instanzen; das Spiel baut daraus InstancedMeshes,
                                         game.html: const HUB_LAYOUT = <Inhalt dieser Datei>)
Vorschau:               python3 render_preview.py trivar_hub.obj vorschau.png

Einheit: 1 = 100 m.  Z = oben (Hauptachse), X = rechts, Y = Tiefe.  Front = Blick +Y, Seite = Blick -X, Oben = Blick -Z.
Das Referenzblatt ist nicht streng orthografisch: FRONT ist Master fuer X/Z, SEITE legt die Y-Tiefe fest,
OBEN liefert die XY-Anordnung (Eck-Plattformen, zwei Frachtstapel je Seite), Y dort gestaucht.
Alle Teile sind Instanzen von 16 wiederverwendbaren Prototypen (Primitive: Box, Zylinder, Kugel).
"""
import json, math, sys
import numpy as np

HULL, HULL2, ACCENT, CYAN, AD, DARK, LIGHT, WINDOW = range(8)
MAT_NAMES = ["hull", "hull2", "accent", "cyan", "ad", "dark", "light", "window"]
MAT_KD = [(.20, .21, .23), (.08, .08, .09), (.85, .45, .08), (.2, .7, 1.0), (.95, .95, 1.0), (0, 0, 0), (1.0, .95, .8), (1.0, .7, .3)]
BOX, CYL, SPH = 0, 1, 2
AX = {"X": 0, "Y": 1, "Z": 2}

# ---------------------------------------------------------------- Prototypen (Einheitsmasse)
PROTOS = {}
def proto(name):
    def deco(fn):
        P = []
        fn(P); PROTOS[name] = P
        return fn
    return deco
def box(P, c, s, m=HULL, rz=0): P.append([BOX, *c, *s, rz, m, 0])   # rz: Drehung um Z (rad), nur fuer Boxen
def cyl(P, c, r, h, ax="Z", m=HULL, seg=16): P.append([CYL, *c, r, h, 0, AX[ax], m, seg])
def sph(P, c, r, m=HULL, seg=12): P.append([SPH, *c, r, 0, 0, 0, m, seg])

@proto("truss")                       # 2 Strukturfachwerk, Laenge 1 entlang X, Querschnitt 1x1
def _(P):
    for sy in (-.5, .5):
        for sz in (-.5, .5): box(P, (0, sy, sz), (1, .07, .07), HULL2)
    for i in range(9):
        x = -.5 + i * .125
        box(P, (x, 0, .5), (.025, 1, .05)); box(P, (x, 0, -.5), (.025, 1, .05))
        box(P, (x, .5, 0), (.025, .05, 1)); box(P, (x, -.5, 0), (.025, .05, 1))
@proto("corridor")                    # 3 Dockingkorridor
def _(P):
    box(P, (0, 0, 0), (1, 1, 1))
    for i in range(6): box(P, (-.45 + i * .18, 0, 0), (.04, 1.06, 1.06), HULL2)
    box(P, (0, 0, .51), (.9, .12, .02), CYAN)
@proto("hangar")                      # 4 Hangareinflug, Oeffnung nach +X
def _(P):
    box(P, (0, 0, 0), (1, 1, 1)); box(P, (.5, 0, 0), (.04, .72, .58), DARK)
    for sy in (-.4, .4):
        for sz in (-.34, .34): box(P, (.51, sy, sz), (.04, .05, .05), LIGHT)
    box(P, (.5, 0, .38), (.03, .8, .04), ACCENT); box(P, (.5, 0, -.38), (.03, .8, .04), ACCENT)
@proto("container")                   # 6 Frachtcontainer
def _(P):
    box(P, (0, 0, 0), (1, 1, 1))
    for i in range(5): box(P, (-.4 + i * .2, 0, 0), (.04, 1.03, 1.03), HULL2)
    box(P, (0, 0, .28), (.9, 1.02, .1), ACCENT)
@proto("pipe")                        # 8 Industrierohr (X)
def _(P):
    cyl(P, (0, 0, 0), .5, 1, "X", HULL2, 12)
    for x in (-.5, .5): cyl(P, (x, 0, 0), .6, .03, "X", HULL, 12)
@proto("conduit")                     # 9 Stromleitung (X)
def _(P):
    cyl(P, (0, 0, 0), .5, 1, "X", HULL, 10)
    for i in range(5): cyl(P, (-.4 + i * .2, 0, 0), .56, .05, "X", ACCENT, 10)
@proto("cooling")                     # 10 Kuehlmodul
def _(P):
    box(P, (0, 0, -.45), (1, 1, .1), HULL2)
    for i in range(8): box(P, (0, -.44 + i * .125, .05), (1, .03, .9))
    box(P, (0, 0, .5), (1, .12, .02), ACCENT)
@proto("hab")                         # 11 Wohnmodul
def _(P):
    box(P, (0, 0, 0), (1, 1, 1))
    for i in range(7):
        z = -.42 + i * .14
        box(P, (0, 0, z), (.9, 1.02, .05), WINDOW); box(P, (0, 0, z), (1.02, .9, .05), WINDOW)
    for z in (-.5, .5): box(P, (0, 0, z), (1.04, 1.04, .04), HULL2)
@proto("commerce")                    # 12 Geschaeftsring (Zylinder Z, Radius 1, Hoehe 1)
def _(P):
    cyl(P, (0, 0, 0), 1, 1, "Z", HULL, 40); cyl(P, (0, 0, 0), 1.02, .22, "Z", WINDOW, 40)
    for z in (-.5, .5): cyl(P, (0, 0, z), 1.03, .08, "Z", HULL2, 40)
@proto("neck")                        # Verbindungshals mit Cyan-Streifen
def _(P):
    box(P, (0, 0, 0), (1, 1, 1))
    for sx in (-.5, .5): box(P, (sx, 0, 0), (.02, .16, .8), CYAN)
    for sy in (-.5, .5): box(P, (0, sy, 0), (.16, .02, .8), CYAN)
@proto("panel")                       # 13 Werbeflaeche (leer, beleuchtet), Normale +-Y
def _(P):
    box(P, (0, 0, 0), (1.06, .02, 1.06), HULL2); box(P, (0, .015, 0), (1, .02, 1), AD); box(P, (0, -.015, 0), (1, .02, 1), AD)
@proto("light")                       # 14 Dockinglicht
def _(P): sph(P, (0, 0, 0), .5, LIGHT, 6)
@proto("maint")                       # 15 Wartungsmodul
def _(P):
    box(P, (0, 0, 0), (1, 1, 1)); box(P, (.5, 0, .2), (.5, .15, .15), HULL2)
    box(P, (.75, 0, 0), (.08, .15, .6), HULL2); box(P, (0, 0, .5), (.6, .1, .04), ACCENT)
@proto("joint")                       # 16 Strukturgelenk
def _(P): sph(P, (0, 0, 0), .5, HULL, 10); cyl(P, (0, 0, 0), .55, .35, "Z", HULL2, 12)
@proto("mast")                        # Antennenmast (Z, Laenge 1)
def _(P): cyl(P, (0, 0, 0), .5, 1, "Z", HULL2, 6); sph(P, (0, 0, .5), .9, LIGHT, 6)
@proto("core")                        # 1 Zentraler Kern (Unikat)
def _(P):
    sph(P, (0, 0, 0), 12.5, HULL, 32)
    for z in (-4.5, 4.5): cyl(P, (0, 0, z), 12.55, .5, "Z", HULL2, 48)
    cyl(P, (0, 0, 0), 12.7, .9, "Z", ACCENT, 48)
    for k in range(16):
        a = k * math.pi / 8
        # Rippe tangential: zwei Quader je Meridian ersetzen durch eine Rippe, Normale radial
        box(P, (12.2 * math.cos(a), 12.2 * math.sin(a), 0), (1.6, .5, 19.6), HULL2)
    for z in (-12.4, 12.4):
        cyl(P, (0, 0, z), 3.2, 1.2, "Z", HULL2, 24); cyl(P, (0, 0, z), 2.2, 1.3, "Z", CYAN, 24)
PNAMES = list(PROTOS)

# ---------------------------------------------------------------- Instanzen
INST = []
def rot_euler(rx, ry, rz):
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx
def inst(p, loc, scale=(1, 1, 1), rot=(0, 0, 0), col="STRUCTURE", R=None):
    R = rot_euler(*rot) if R is None else R
    INST.append(dict(p=p, loc=loc, scale=scale, R=R, col=col))
def strut(p0, p1, w, col="STRUCTURE", p="truss"):
    a, b = np.array(p0, float), np.array(p1, float); d = b - a; L = np.linalg.norm(d); x = d / L
    z0 = np.array([0, 0, 1.0]) if abs(x[2]) < .99 else np.array([0, 1.0, 0])
    y = np.cross(z0, x); y /= np.linalg.norm(y); z = np.cross(x, y)
    inst(p, tuple((a + b) / 2), (L, w, w), R=np.stack([x, y, z], 1), col=col)

def build_station():
    pi = math.pi
    inst("core", (0, 0, 0), col="CORE")
    for k in range(8):                                                   # 8 Hangareinfluege am Aequator
        a = k * pi / 4
        inst("hangar", (12.9 * math.cos(a), 12.9 * math.sin(a), 0), (2.6, 4.2, 3.2), (0, 0, a), "HANGARS")
    inst("truss", (0, 0, 0), (92, 5, 5), (0, pi / 2, 0))                 # Z-Hauptachse
    for s in (1, -1):
        inst("commerce", (0, 0, s * 16.5), (10, 10, 3), col="COMMERCIAL")
        for k in range(8):
            a = k * pi / 4 + pi / 8
            inst("panel", (10.3 * math.cos(a), 10.3 * math.sin(a), s * 16.5), (4.2, 1, 1.6), (0, 0, a + pi / 2), "ADVERTISING")
        inst("neck", (0, 0, s * 25), (7, 6, 14), col="COMMERCIAL")
        for z in (37, 45):
            inst("hab", (0, 0, s * z), (10, 8, 8), col="HABITATION")
            for sx in (-1, 1): inst("panel", (sx * 5.1, 0, s * z), (5, 1, 4.5), (0, 0, pi / 2), "ADVERTISING")
        inst("hab", (0, 0, s * 51), (6, 5, 4), col="HABITATION")
        inst("joint", (0, 0, s * 32.6), (6.5, 6.5, 2.5))
        inst("mast", (0, 0, s * 56), (.5, .5, 8), col="INFRASTRUCTURE")
        for q in (-1, 1):
            inst("mast", (q * 3.2, 0, s * 53), (.25, .25, 5), col="INFRASTRUCTURE")
            inst("mast", (0, q * 2.6, s * 53), (.25, .25, 5), col="INFRASTRUCTURE")
        for sx in (-1, 1):
            p0, p1 = (sx * 5.0, 0, s * 22), (sx * 17.5, 0, s * 26)
            strut(p0, p1, 2.0, "DOCKING")
            inst("hangar", (sx * 18.5, 0, s * 26.2), (3.5, 3.0, 3.0), (0, 0, 0 if sx > 0 else pi), "HANGARS")
            inst("joint", p0, (3, 3, 3))
            inst("light", (sx * 18.0, 1.8, s * 27.8), (.5, .5, .5), col="LIGHTS")
            strut((sx * 9.0, 0, s * 9.0), (sx * 17.0, 0, s * 17.0), 1.4)
            inst("maint", (sx * 18.0, 0, s * 18.2), (3.0, 2.6, 2.6), (0, 0, 0 if sx > 0 else pi), "MAINTENANCE")
    for sx in (-1, 1):
        rz = 0 if sx > 0 else pi
        inst("corridor", (sx * 21, 0, 0), (18, 6, 6), col="DOCKING")
        inst("hangar", (sx * 30.4, 0, 0), (2.4, 5, 5), (0, 0, rz), "HANGARS")
        for sz in (-1, 1):
            inst("pipe", (sx * 21, 2.2, sz * 4.2), (18, 1.2, 1.2), col="INFRASTRUCTURE")
            inst("conduit", (sx * 21, -2.2, sz * 4.2), (18, .9, .9), col="INFRASTRUCTURE")
        for i in range(7):
            for sy in (-1, 1):
                for sz in (-1, 1): inst("light", (sx * (14 + i * 2.6), sy * 3.1, sz * 3.1), (.35, .35, .35), col="LIGHTS")
        inst("joint", (sx * 12.3, 0, 0), (7, 7, 7))
        cx = sx * 33.5
        inst("truss", (sx * 31.0, 0, 0), (2, 15, 3), col="CARGO_MODULES")
        for sy in (-1, 1):
            inst("truss", (cx, sy * 5.2, 0), (7.4, 5.4, 5.4), (0, pi / 2, 0), "CARGO_MODULES")
            for cxo in (-1.75, 1.75):
                for row in range(6): inst("container", (cx + cxo, sy * 5.2, -11.25 + row * 4.5), (3.2, 4.8, 4.2), col="CARGO")
            inst("maint", (cx, sy * 5.2, 14.2), (6.5, 4.6, 1.6), col="CARGO_HANDLING")
            inst("maint", (cx, sy * 5.2, -14.2), (6.5, 4.6, 1.6), col="CARGO_HANDLING")
        for sz in (-1, 1): inst("light", (cx, 0, sz * 14.4), (.5, .5, .5), col="LIGHTS")
        for sz in (-1, 1):
            inst("hab", (sx * 22, 0, sz * 10.0), (2.6, 3.4, 5.0), col="HABITATION")
            strut((sx * 22, 0, sz * 7.5), (sx * 22, 0, sz * 3.0), 1.0)
        for sy in (-1, 1):                                               # TOP: X-Ausleger zu den Eckplattformen
            p0, p1 = (sx * 9.5, sy * 8.0, 0), (sx * 23.0, sy * 17.0, 0)
            strut(p0, p1, 1.8, "DOCKING"); inst("joint", p0, (3, 3, 3)); inst("joint", p1, (3.4, 3.4, 3.4))
            inst("maint", (sx * 24.5, sy * 18.3, 0), (4.0, 3.6, 3.0), (0, 0, math.atan2(sy * 17.0, sx * 23.0)), "MAINTENANCE")
            inst("hangar", (sx * 26.0, sy * 19.4, 0), (2.2, 3.0, 2.6), (0, 0, math.atan2(sy, sx)), "HANGARS")
            for sz in (-1, 1): inst("light", (sx * 23.5, sy * 18.3, sz * 1.9), (.4, .4, .4), col="LIGHTS")
    inst("joint", (0, 13.6, 0), (6, 4, 6), (pi / 2, 0, 0))              # +Y Frachtkomplex (Seite: rechts)
    inst("truss", (0, 17.5, 0), (8, 8, 11), (0, 0, pi / 2), "CARGO_MODULES")
    for cxo in (-3.0, 0.0, 3.0):
        for cy in (15.5, 19.5):
            for row in range(3): inst("container", (cxo, cy, -3.9 + row * 3.9), (2.8, 3.8, 3.7), col="CARGO")
    inst("maint", (0, 22.8, 0), (9, 1.8, 12), col="CARGO_HANDLING")
    inst("joint", (0, -13.6, 0), (6, 4, 6), (pi / 2, 0, 0))             # -Y Heck mit Kuehlung
    inst("hab", (0, -17.6, 0), (9, 7.5, 8), col="HABITATION")
    for sx in (-1, 1):
        for sz in (-1, 1): inst("cooling", (sx * 6.5, -19.5, sz * 5.5), (5.5, 7.0, 6.0), col="COOLING")
        inst("pipe", (sx * 3.0, -13.9, 0), (4, 1.4, 1.4), col="INFRASTRUCTURE")
        inst("panel", (sx * 4.6, -17.6, 0), (6, 1, 5), (0, 0, pi / 2), "ADVERTISING")
    inst("mast", (0, -22.5, 0), (.4, .4, 3), (pi / 2, 0, 0), "INFRASTRUCTURE")

# ---------------------------------------------------------------- OBJ-Ausgabe
RAX = {0: np.array([[0, -1, 0], [1, 0, 0], [0, 0, 1.0]]),   # Y -> X
       1: np.eye(3),
       2: np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0.0]])}   # Y -> Z
def unit_geo(kind, seg):
    if kind == BOX:
        v = np.array([[x, y, z] for x in (-.5, .5) for y in (-.5, .5) for z in (-.5, .5)])
        f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        return v, f
    if kind == CYL:
        a = np.linspace(0, 2 * math.pi, seg, endpoint=False)
        v = np.array([[math.cos(t), -.5, math.sin(t)] for t in a] + [[math.cos(t), .5, math.sin(t)] for t in a])
        f = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
        f += [tuple(range(seg - 1, -1, -1)), tuple(range(seg, 2 * seg))]
        return v, f
    n, m = seg, max(3, seg // 2); v = [[0, 0, 1]]; f = []
    for j in range(1, m):
        ph = math.pi * j / m
        for i in range(n): v.append([math.sin(ph) * math.cos(2 * math.pi * i / n), math.sin(ph) * math.sin(2 * math.pi * i / n), math.cos(ph)])
    v.append([0, 0, -1])
    for i in range(n): f.append((0, 1 + i, 1 + (i + 1) % n))
    for j in range(m - 2):
        for i in range(n):
            a, b = 1 + j * n + i, 1 + j * n + (i + 1) % n; f.append((a, a + n, b + n, b))
    last = len(v) - 1
    for i in range(n): f.append((last, 1 + (m - 2) * n + (i + 1) % n, 1 + (m - 2) * n + i))
    return np.array(v), f

def prim_matrix(pr):
    k, cx, cy, cz, sx, sy, sz, ax, m, seg = pr
    if k == BOX: S = np.diag([sx, sy, sz])
    elif k == CYL: S = np.diag([sx, sy, sx])
    else: S = np.eye(3) * sx
    if k == CYL: R3 = RAX[ax]
    elif k == BOX and ax: R3 = np.array([[math.cos(ax), -math.sin(ax), 0], [math.sin(ax), math.cos(ax), 0], [0, 0, 1.0]])
    else: R3 = np.eye(3)
    M = np.eye(4); M[:3, :3] = R3 @ S; M[:3, 3] = (cx, cy, cz)
    return M
def inst_matrix(it):
    M = np.eye(4); M[:3, :3] = it["R"] @ np.diag(it["scale"]); M[:3, 3] = it["loc"]; return M

def write_obj(path, emit=(ACCENT, CYAN, AD, LIGHT, WINDOW)):
    geo = {}; out = {m: [] for m in range(len(MAT_NAMES))}; nv = 1
    lines = {m: [] for m in range(len(MAT_NAMES))}; verts = []
    for it in INST:
        Mi = inst_matrix(it)
        for pr in PROTOS[it["p"]]:
            key = (pr[0], pr[9])
            if key not in geo: geo[key] = unit_geo(*key)
            v, f = geo[key]; M = Mi @ prim_matrix(pr)
            w = (M[:3, :3] @ v.T).T + M[:3, 3]
            verts.extend(w.tolist())
            lines[pr[8]].append([tuple(i + nv for i in fc) for fc in f]); nv += len(v)
    with open(path, "w") as fo:
        fo.write("mtllib %s.mtl\n" % path.replace("\\", "/").split("/")[-1].rsplit(".", 1)[0])
        for v in verts: fo.write("v %.3f %.3f %.3f\n" % tuple(v))
        for m in range(len(MAT_NAMES)):
            fo.write("o %s\nusemtl %s\n" % (MAT_NAMES[m], MAT_NAMES[m]))
            for grp in lines[m]:
                for fc in grp: fo.write("f " + " ".join(map(str, fc)) + "\n")
    with open(path.rsplit(".", 1)[0] + ".mtl", "w") as fm:
        for m in range(len(MAT_NAMES)):
            fm.write("newmtl %s\nKd %.3f %.3f %.3f\n" % ((MAT_NAMES[m],) + MAT_KD[m]))
            if m in emit: fm.write("Ke %.3f %.3f %.3f\n" % MAT_KD[m])
    return len(verts)

def write_json(path):
    r = lambda x: round(float(x), 4)
    ins = []
    for it in INST:
        R = it["R"]; ident = np.allclose(R, np.eye(3), atol=1e-6)
        ins.append([PNAMES.index(it["p"]), *map(r, it["loc"]), *map(r, it["scale"]), 0 if ident else [r(x) for x in R.flatten()]])
    lay = dict(unit=100, mats=MAT_NAMES, protos=[[n, PROTOS[n]] for n in PNAMES], inst=ins)
    open(path, "w").write(json.dumps(lay, separators=(",", ":")))
    return len(json.dumps(lay, separators=(",", ":")))

if __name__ == "__main__":
    build_station()
    prims = sum(len(PROTOS[i["p"]]) for i in INST)
    nv = write_obj("trivar_hub.obj"); nj = write_json("trivar_hub_layout.json")
    print("Instanzen:", len(INST), "| Primitive:", prims, "| OBJ-Vertices:", nv, "| JSON-Bytes:", nj)

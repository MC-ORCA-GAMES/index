"""
NPC-HANDELSSTATIONEN (4 eigenstaendige Entwuerfe) nach referenz.png
===================================================================
Nutzung (ohne Blender):  python3 npc_stationen_build.py
   -> station1_posten.obj/.mtl  station2_standard.obj  station3_industrie.obj  station4_hub.obj  (Blender: File > Import > Wavefront)
   -> npc_stationen_layout.json  (gemeinsame Prototypen + Instanzen je Station; game.html: const NPC_LAYOUT = <Inhalt>)
Vorschau je Station:    python3 render_preview.py station1_posten.obj station1_vorschau.png   (usw.)

Einheit: 1 = 10 m.  Z = oben (Hauptachse), X = rechts, Y = Tiefe.  Front = Blick +Y, Seite = Blick -X, Oben = Blick -Z.
Vier voellig getrennte Entwuerfe, gemeinsam nur die Bauteil-Bibliothek (Prototypen des Handelsknotens + Rad/Kuppel).
Wie beim Handelsknoten ist das Blatt nicht streng orthografisch: FRONT = Master fuer X/Z, SEITE legt die Tiefe fest,
OBEN liefert die Anordnung in der Ebene. Keine Schrift, keine Logos, keine Namen.
"""
import sys, os, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "trivar_hub"))
import numpy as np
import trivar_hub_build as H
from trivar_hub_build import (HULL, HULL2, ACCENT, CYAN, AD, DARK, LIGHT, WINDOW, BOX, CYL, SPH,
                              box, cyl, sph, strut)
pi = math.pi

# ---------------------------------------------------------------- zusaetzliche Prototypen
@H.proto("dome")                       # Kuppelkern, Radius 1
def _(P):
    sph(P, (0, 0, 0), 1, HULL, 20)
    cyl(P, (0, 0, 0), 1.03, .10, "Z", ACCENT, 32)
    for z in (-.55, .55): cyl(P, (0, 0, z), .86, .06, "Z", HULL2, 32)
    for z in (-1.0, 1.0): cyl(P, (0, 0, z * .98), .28, .08, "Z", CYAN, 16)
@H.proto("wheel")                      # Ring in der XY-Ebene, Radius 1, Hoehe 1 (40 Segmente)
def _(P):
    n = 40
    for i in range(n):
        a = 2 * pi * i / n
        box(P, (math.cos(a), math.sin(a), 0), (2 * pi / n * 1.03, .06, 1.0), HULL, a + pi / 2)
        if i % 4 == 0: box(P, (math.cos(a), math.sin(a), 0), (2 * pi / n * .7, .066, .45), WINDOW, a + pi / 2)
        if i % 8 == 4:
            box(P, (math.cos(a) * 1.0, math.sin(a) * 1.0, .51), (.04, .075, .03), ACCENT, a + pi / 2)
            box(P, (math.cos(a) * 1.0, math.sin(a) * 1.0, -.51), (.04, .075, .03), ACCENT, a + pi / 2)
H.PNAMES[:] = list(H.PROTOS)

inst = H.inst
def core(r): inst("dome", (0, 0, 0), (r, r, r), col="CORE")
def eq_hangars(r, n, sc, off=0):
    for k in range(n):
        a = 2 * pi * k / n + off
        inst("hangar", (r * math.cos(a), r * math.sin(a), 0), sc, (0, 0, a), "HANGARS")
def spine(L, w): inst("truss", (0, 0, 0), (2 * L, w, w), (0, pi / 2, 0))
def tower(s, z0, mods, w_panel=True):
    z = z0
    for i, (sx, sy, h) in enumerate(mods):
        inst("hab", (0, 0, s * (z + h / 2)), (sx, sy, h), col="HABITATION")
        if w_panel and i % 2 == 0:
            for q in (-1, 1): inst("panel", (q * (sx / 2 + .06), 0, s * (z + h / 2)), (sy * .55, 1, h * .6), (0, 0, pi / 2), "ADVERTISING")
        z += h
    return z
def mast(s, z0, L, w=.4): inst("mast", (0, 0, s * (z0 + L / 2)), (w, w, L), (0 if s > 0 else pi, 0, 0), "INFRASTRUCTURE")
def lights_x(x0, x1, n, y, z, sc=.35):
    for i in range(n):
        inst("light", (x0 + (x1 - x0) * i / max(1, n - 1), y, z), (sc, sc, sc), col="LIGHTS")
def cargo_block(c, a, cols, rows, size, pitch_t, pitch_z):
    """Containerblock um Mittelpunkt c; a = Drehung um Z (x radial, y tangential)"""
    tx, ty = -math.sin(a), math.cos(a)
    for i in range(cols):
        for j in range(rows):
            t = (i - (cols - 1) / 2) * pitch_t; z = (j - (rows - 1) / 2) * pitch_z
            inst("container", (c[0] + tx * t, c[1] + ty * t, z), size, (0, 0, a), "CARGO")

# ---------------------------------------------------------------- 1: kleiner lokaler Handelsposten (~900 m)
def st1():
    core(13); inst("wheel", (0, 0, 0), (17.5, 17.5, 1.4), (pi / 2, 0, 0))
    for k in range(8):
        a = k * pi / 4 + pi / 8; strut((13 * math.cos(a), 0, 13 * math.sin(a)), (17 * math.cos(a), 0, 17 * math.sin(a)), .8)
    eq_hangars(13.2, 4, (2.6, 5, 4), pi / 4)
    spine(49, 3)
    for s in (1, -1):
        inst("neck", (0, 0, s * 19), (7, 6, 10), col="COMMERCIAL")
        tower(s, 24, [(11, 9, 12), (8, 7, 5)]); mast(s, 41, 10, .35)
        inst("joint", (0, 0, s * 23.5), (5, 5, 2))
        for sx in (-1, 1):
            strut((sx * 9, 0, s * 9), (sx * 15, 0, s * 20), 1.2)
            inst("maint", (sx * 15.8, 0, s * 21.5), (3, 2.6, 2.6), (0, 0, 0 if sx > 0 else pi), "MAINTENANCE")
    for sx in (-1, 1):
        rz = 0 if sx > 0 else pi
        inst("corridor", (sx * 21, 0, 0), (16, 6, 6.5), col="DOCKING")
        inst("hangar", (sx * 29.5, 0, 0), (2.4, 5, 5), (0, 0, rz), "HANGARS")
        for sz in (-1, 1): inst("pipe", (sx * 21, 2.0, sz * 3.9), (16, 1, 1), col="INFRASTRUCTURE")
        lights_x(sx * 15, sx * 27, 5, 3.1, 3.3); lights_x(sx * 15, sx * 27, 5, -3.1, -3.3)
        inst("truss", (sx * 32.5, 0, 0), (20, 9.4, 7.6), (0, pi / 2, 0), "CARGO_MODULES")
        for z in (-6, 0, 6): inst("container", (sx * 32.5, 0, z), (6, 8, 6), col="CARGO")
        inst("maint", (sx * 32.5, 0, 10.8), (5, 5, 1.2), col="CARGO_HANDLING")
    for k in range(4):                                   # TOP: schraege Ausleger (Windrad-Anordnung)
        a = k * pi / 2 + pi / 4
        strut((8 * math.cos(a), 8 * math.sin(a), 0), (18 * math.cos(a + .12), 18 * math.sin(a + .12), 0), 1.2, "DOCKING")
        inst("hangar", (19.8 * math.cos(a + .12), 19.8 * math.sin(a + .12), 0), (2.6, 3, 3), (0, 0, a + .12), "HANGARS")
        inst("light", (17 * math.cos(a + .12), 17 * math.sin(a + .12), 1.6), (.4, .4, .4), col="LIGHTS")

# ---------------------------------------------------------------- 2: Standard-Handelsstation (~1,3 km): Horizontalring + Querbalken
def st2():
    core(9); eq_hangars(9.2, 4, (2.2, 4, 3.4), pi / 4)
    inst("wheel", (0, 0, 0), (46, 46, 3.2)); inst("wheel", (0, 0, 0), (40, 40, 1.6))
    for k in range(4):
        a = k * pi / 2
        strut((9 * math.cos(a), 9 * math.sin(a), 0), (46 * math.cos(a), 46 * math.sin(a), 0), 2.2)
        c = (50 * math.cos(a), 50 * math.sin(a), 0)
        cargo_block(c, a, 2, 2, (5, 8, 7.2), 8.4, 7.4)
        inst("truss", c, (16.4, 18, 5.4), (0, 0, a) if False else (0, pi / 2, 0), "CARGO_MODULES")
        inst("hangar", (54.6 * math.cos(a), 54.6 * math.sin(a), 0), (2.4, 5, 5), (0, 0, a), "HANGARS")
        inst("joint", (46 * math.cos(a), 46 * math.sin(a), 0), (4, 4, 4))
    spine(62, 4)
    for s in (1, -1):
        inst("neck", (0, 0, s * 19.5), (6, 6, 21), col="COMMERCIAL")
        inst("commerce", (0, 0, s * 22), (8, 8, 2.5), col="COMMERCIAL")
        tower(s, 36, [(13, 10, 9), (11, 9, 9), (8, 8, 8)]); mast(s, 62, 9, .45)
        inst("joint", (0, 0, s * 35), (6, 6, 2))
        inst("truss", (0, 0, s * 33), (80, 3, 3), col="DOCKING")                  # Querbalken X
        for sx in (-1, 1):
            rz = 0 if sx > 0 else pi
            inst("hangar", (sx * 41.8, 0, s * 33), (3.2, 4, 4), (0, 0, rz), "HANGARS")
            inst("pipe", (sx * 22, 1.8, s * 31.2), (30, 1, 1), col="INFRASTRUCTURE")
            inst("maint", (sx * 26, 0, s * 29.8), (3.4, 3, 3), (0, 0, rz), "MAINTENANCE")
            lights_x(sx * 8, sx * 38, 6, 1.7, s * 34.7, .3)
        inst("truss", (0, 0, s * 48), (36, 2.4, 2.4), (0, 0, pi / 2), "DOCKING")  # Querbalken Y
        for sy in (-1, 1): inst("hangar", (0, sy * 18.8, s * 48), (2.6, 3.4, 3.4), (0, 0, sy * pi / 2), "HANGARS")

# ---------------------------------------------------------------- 3: grosser Industrieposten (~2,2 km): Frachtgitter + Tuerme + Beine
def st3():
    core(20); inst("hab", (0, 0, 0), (100, 32, 26), col="HABITATION"); spine(105, 10)
    for sx in (-1, 1):
        for sy in (-1, 1):
            inst("hangar", (sx * 20, sy * 16.4, 0), (5, 6, 8), (0, 0, sy * pi / 2), "HANGARS")
    for s in (1, -1):
        top = tower(s, 13, [(34, 28, 18), (26, 24, 20), (18, 18, 22), (12, 12, 18)]); mast(s, 91, 22, .6)
        inst("joint", (0, 0, s * 13), (16, 16, 3))
        inst("maint", (0, 0, s * 52), (30, 5, 3), col="MAINTENANCE")
    for sx in (-1, 1):
        rz = 0 if sx > 0 else pi
        for sy in (-1, 1):
            for ci in range(4):
                for sz in (-1, 1):
                    inst("container", (sx * (52 + ci * 13.5), sy * 26, sz * 6.6), (13.2, 24, 12.6), col="CARGO")
            for z in (-13.8, 13.8): inst("truss", (sx * 75.5, sy * 26, z), (56, 25, 1.6), col="CARGO_MODULES")
            for ci in (0, 3): inst("truss", (sx * (52 + ci * 13.5), sy * 26, 0), (27, 25, 1.4), (0, pi / 2, 0), "CARGO_MODULES")
            inst("maint", (sx * 75, sy * 26, 15.6), (30, 8, 3), col="CARGO_HANDLING")
            inst("light", (sx * 98, sy * 26, 12), (.8, .8, .8), col="LIGHTS")
        for xx in (56, 80):                                           # untere Beine
            inst("neck", (sx * xx, 0, -52), (10, 10, 76), col="MAINTENANCE")
            inst("hangar", (sx * (xx + 5.2), 0, -80), (2.6, 7, 6), (0, 0, rz), "HANGARS")
            for z in (-30, -50, -70): inst("light", (sx * xx, 5.2, z), (.6, .6, .6), col="LIGHTS")
        inst("neck", (sx * 84, 0, 37), (8, 8, 46), col="MAINTENANCE")   # obere Pylone
        inst("light", (sx * 84, 0, 61), (.9, .9, .9), col="LIGHTS")
        inst("pipe", (sx * 70, 0, 14.8), (60, 2, 2), col="INFRASTRUCTURE"); inst("conduit", (sx * 70, 0, -14.8), (60, 1.6, 1.6), col="INFRASTRUCTURE")
        for q in (-1, 1): inst("cooling", (sx * 40, q * 19.5, 16.5), (14, 5, 4), col="COOLING")

# ---------------------------------------------------------------- 4: regionaler Handelsknoten (~3,5 km): senkrechtes Speichenrad + 8 Dockingsektoren
def st4():
    core(30); eq_hangars(30.4, 8, (4, 8, 7))
    inst("wheel", (0, 0, 0), (122, 122, 8), (pi / 2, 0, 0)); inst("wheel", (0, 0, 0), (88, 88, 5), (pi / 2, 0, 0))
    inst("wheel", (0, 0, 0), (60, 60, 6))                                         # horizontaler Wohnring
    for k in range(8):
        a = k * pi / 4; c, sn = math.cos(a), math.sin(a)
        strut((30 * c, 0, 30 * sn), (88 * c, 0, 88 * sn), 4.2)
        strut((88 * c, 0, 88 * sn), (122 * c, 0, 122 * sn), 3.2)
        inst("joint", (88 * c, 0, 88 * sn), (8, 8, 8)); inst("joint", (122 * c, 0, 122 * sn), (9, 9, 9))
        R = (0, -a, 0)
        if k % 2 == 0:                                                               # Frachtsektor
            for r in (131, 145): inst("container", (r * c, 0, r * sn), (13, 16, 13), R, "CARGO")
            inst("truss", (138 * c, 0, 138 * sn), (30, 19, 16), R, "CARGO_MODULES")
        else:                                                                        # Wohn-/Handelssektor
            inst("hab", (136 * c, 0, 136 * sn), (22, 14, 14), R, "HABITATION")
            inst("panel", (136 * c, 7.1, 136 * sn), (14, 1, 8), R, "ADVERTISING")
            inst("panel", (136 * c, -7.1, 136 * sn), (14, 1, 8), R, "ADVERTISING")
        inst("hangar", (156 * c, 0, 156 * sn), (4, 12, 10), R, "HANGARS")
        inst("maint", (122 * c, 9, 122 * sn), (6, 5, 5), R, "MAINTENANCE")
    for k in range(24):                                                              # Positionslichter am Aussenring
        a = k * pi / 12
        for y in (-4.6, 4.6): inst("light", (126.5 * math.cos(a), y, 126.5 * math.sin(a)), (.9, .9, .9), col="LIGHTS")
    spine(172, 9)
    for s in (1, -1):
        inst("neck", (0, 0, s * 45), (14, 12, 30), col="COMMERCIAL")
        inst("commerce", (0, 0, s * 40), (26, 26, 5), col="COMMERCIAL")
        for k in range(8):
            a = k * pi / 4 + pi / 8
            inst("panel", (26.4 * math.cos(a), 26.4 * math.sin(a), s * 40), (11, 1, 3.4), (0, 0, a + pi / 2), "ADVERTISING")
        tower(s, 60, [(40, 34, 22), (32, 28, 24), (24, 22, 26), (16, 16, 20)]); mast(s, 152, 26, .9)
        inst("joint", (0, 0, s * 60), (30, 30, 5))
        inst("truss", (0, 0, s * 105), (64, 4, 4), col="DOCKING")
        for sx in (-1, 1): inst("hangar", (sx * 33, 0, s * 105), (5, 7, 7), (0, 0, 0 if sx > 0 else pi), "HANGARS")
        for q in (-1, 1): inst("cooling", (q * 12, 18, s * 78), (10, 8, 8), col="COOLING")

STATIONS = [("station1_posten", "Posten", st1), ("station2_standard", "Standard", st2),
            ("station3_industrie", "Industrie", st3), ("station4_hub", "Knoten", st4)]

if __name__ == "__main__":
    r = lambda x: round(float(x), 4)
    out = dict(mats=H.MAT_NAMES, protos=[[n, H.PROTOS[n]] for n in H.PNAMES], st=[])
    for fn, nm, build in STATIONS:
        H.INST = []; build()
        ext = np.array([it["loc"] for it in H.INST])
        prims = sum(len(H.PROTOS[i["p"]]) for i in H.INST)
        nv = H.write_obj(os.path.join(HERE, fn + ".obj"))
        ins = []
        for it in H.INST:
            R = it["R"]; ident = np.allclose(R, np.eye(3), atol=1e-6)
            ins.append([H.PNAMES.index(it["p"]), *map(r, it["loc"]), *map(r, it["scale"]), 0 if ident else [r(x) for x in R.flatten()]])
        out["st"].append(dict(name=nm, unit=10, inst=ins))
        print(f"{fn}: {len(H.INST)} Instanzen, {prims} Primitive, {nv} Vertices, Mittelpunkte x[{ext[:,0].min():.0f},{ext[:,0].max():.0f}] z[{ext[:,2].min():.0f},{ext[:,2].max():.0f}]")
    s = json.dumps(out, separators=(",", ":")); open(os.path.join(HERE, "npc_stationen_layout.json"), "w").write(s)
    print("JSON-Bytes:", len(s))

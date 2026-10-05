"""
ACCELERATION GATE – parametrischer Aufbau nach Referenzbild (Front / Seite / Oben)
=================================================================================
Nutzung in Blender:   Scripting-Tab -> Open -> acceleration_gate_build.py -> Run Script
Nutzung ohne Blender: python3 acceleration_gate_build.py  (schreibt acceleration_gate.obj + .mtl)

Einheiten: Meter. X = Breite (3500), Y = Länge/Flugrichtung (12000), Z = Höhe (3000).
Collections: AG_Corridor, AG_Rails, AG_Modules (16 Module), AG_Frames (4 Rahmen),
             AG_EndBlocks (Endblöcke + 8 Feldgeneratoren), AG_Utilities (Kühl-/Stromleitungen)
Das Skript ist eigenständig (braucht kein stargate_build.py).
"""
import math

# ----------------------------------------------------------------- Materialien
MATS = {
    "gunmetal":  dict(color=(0.20, 0.21, 0.23), metal=0.9, rough=0.45),
    "gunmetal_l": dict(color=(0.33, 0.34, 0.37), metal=0.85, rough=0.5),
    "dark":      dict(color=(0.07, 0.07, 0.08), metal=0.8, rough=0.6),
    "amber":     dict(color=(0.85, 0.55, 0.08), metal=0.5, rough=0.4, emit=(1.0, 0.55, 0.05), strength=1.5),
    "glow":      dict(color=(0.75, 0.9, 1.0), metal=0.2, rough=0.3, emit=(0.6, 0.85, 1.0), strength=4.0),
}

# ----------------------------------------------------------------- Mesh-Kern
class Mesh:
    def __init__(self, name, mat):
        self.name, self.mat = name, mat
        self.v, self.f = [], []

    def add(self, verts, faces):
        o = len(self.v)
        self.v.extend(verts)
        self.f.extend([tuple(i + o for i in fc) for fc in faces])
        return self

    def merge(self, other):
        return self.add(other.v, other.f)

def _rotz(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2])

def box_data(cx, cy, cz, sx, sy, sz):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [(cx + x, cy + y, cz + z) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    # index = x*4 + y*2 + z
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return v, f

def radial_box(m, ang, r0, r1, width, z0, z1, off=0.0):
    """Quader entlang Radius `ang` (rad): r0..r1 radial, `width` tangential, z0..z1 axial."""
    v, f = box_data((r0 + r1) / 2, off, (z0 + z1) / 2, r1 - r0, width, z1 - z0)
    m.add([_rotz(p, ang) for p in v], f)

def sector_data(r0, r1, z0, z1, a0, a1, n=None, bevel=0.0):
    """Ringsektor (Annulus-Ausschnitt) mit optionaler Fase; Profil im r/z-Schnitt."""
    n = n or max(2, int(abs(a1 - a0) / math.radians(5)) + 1)
    b = min(bevel, (r1 - r0) / 3, (z1 - z0) / 3)
    prof = [(r0 + b, z0), (r1 - b, z0), (r1, z0 + b), (r1, z1 - b),
            (r1 - b, z1), (r0 + b, z1), (r0, z1 - b), (r0, z0 + b)] if b > 0 else \
           [(r0, z0), (r1, z0), (r1, z1), (r0, z1)]
    k = len(prof)
    v, f = [], []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        for (r, z) in prof:
            v.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(n):
        for j in range(k):
            f.append((i * k + j, (i + 1) * k + j, (i + 1) * k + (j + 1) % k, i * k + (j + 1) % k))
    f.append(tuple(range(k)))                                   # Endkappe 0
    f.append(tuple(n * k + j for j in range(k - 1, -1, -1)))   # Endkappe 1
    return v, f

def sector(m, r0, r1, z0, z1, a0, a1, bevel=0.0, n=None):
    m.add(*sector_data(r0, r1, z0, z1, a0, a1, n, bevel))

def torus(m, R, r, z=0.0, nmaj=96, nmin=8):
    v, f = [], []
    for i in range(nmaj):
        a = 2 * math.pi * i / nmaj
        for j in range(nmin):
            t = 2 * math.pi * j / nmin
            rr = R + r * math.cos(t)
            v.append((rr * math.cos(a), rr * math.sin(a), z + r * math.sin(t)))
    for i in range(nmaj):
        for j in range(nmin):
            f.append((i * nmin + j, ((i + 1) % nmaj) * nmin + j,
                      ((i + 1) % nmaj) * nmin + (j + 1) % nmin, i * nmin + (j + 1) % nmin))
    m.add(v, f)

def cylinder_radial(m, ang, r0, r1, rad, z, rim_off=0.0, n=10):
    """Zylinder entlang Radialrichtung (Hydraulik/Leitung)."""
    v, f = [], []
    for e, r in enumerate((r0, r1)):
        for j in range(n):
            t = 2 * math.pi * j / n
            p = (r, rim_off + rad * math.cos(t), z + rad * math.sin(t))
            v.append(_rotz(p, ang))
    for j in range(n):
        f.append((j, (j + 1) % n, n + (j + 1) % n, n + j))
    f.append(tuple(range(n - 1, -1, -1)))
    f.append(tuple(n + j for j in range(n)))
    m.add(v, f)

def cylinder_axial(m, ang, r, rad, z0, z1, off=0.0, n=12):
    """Zylinder parallel zur Torachse (Z) an Radius r / Winkel ang."""
    z0, z1 = min(z0, z1), max(z0, z1)
    v, f = [], []
    for z in (z0, z1):
        for j in range(n):
            t = 2 * math.pi * j / n
            p = (r + rad * math.cos(t), off + rad * math.sin(t), z)
            v.append(_rotz(p, ang))
    for j in range(n):
        f.append((j, (j + 1) % n, n + (j + 1) % n, n + j))
    f.append(tuple(range(n - 1, -1, -1)))
    f.append(tuple(n + j for j in range(n)))
    m.add(v, f)

# ----------------------------------------------------------------- Parameter (Meter)
# Koordinaten: X = Breite, Y = Länge (Flugrichtung), Z = Höhe. Ursprung = Mittelpunkt.
HW, HH, HL = 1750.0, 1500.0, 6000.0      # Halbbreite/-höhe/-länge -> 3500 x 3000 x 12000
COR_IN, COR_OUT = 900.0, 1000.0          # Flugkorridor 1800 x 1800 (Achtkant, Apothem), Wandstärke 100
PITCH, MOD_LEN, N_MOD = 1300.0, 800.0, 8 # 8 Module je Schiene -> 16 gesamt
RAIL_Y = 5000.0                          # Schienenkern reicht bis +-5000
FRAME_Y = (-3900.0, -1300.0, 1300.0, 3900.0)   # 4 Tragrahmen
FRAME_T = 420.0

# ----------------------------------------------------------------- Zusatz-Primitive
def bx(m, cx, cy, cz, sx, sy, sz):
    m.add(*box_data(cx, cy, cz, sx, sy, sz))

def box_rot_y(m, cx, cy, cz, sx, sy, sz, phi):
    v, f = box_data(0, 0, 0, sx, sy, sz)
    c, s = math.cos(phi), math.sin(phi)
    m.add([(cx + x * c + z * s, cy + y, cz - x * s + z * c) for x, y, z in v], f)

def prism_ring(m, a_in, a_out, y0, y1, n=8):
    """Regelmäßiger n-Eck-Ring entlang Y; Flächen liegen achsparallel (Apothem a)."""
    def loop(a, y):
        R = a / math.cos(math.pi / n)
        return [(R * math.cos(math.pi / n + 2 * math.pi * j / n), y,
                 R * math.sin(math.pi / n + 2 * math.pi * j / n)) for j in range(n)]
    O0, O1, I0, I1 = loop(a_out, y0), loop(a_out, y1), loop(a_in, y0), loop(a_in, y1)
    v = O0 + O1 + I0 + I1
    o0, o1, i0, i1 = 0, n, 2 * n, 3 * n
    f = []
    for j in range(n):
        k = (j + 1) % n
        f.append((o0 + j, o1 + j, o1 + k, o0 + k))      # Außenwand
        f.append((i0 + j, i0 + k, i1 + k, i1 + j))      # Innenwand
        f.append((o0 + j, o0 + k, i0 + k, i0 + j))      # Kappe y0
        f.append((o1 + j, i1 + j, i1 + k, o1 + k))      # Kappe y1
    m.add(v, f)

def cylinder_y(m, cx, cz, rad, y0, y1, n=14):
    v, f = [], []
    for y in (y0, y1):
        for j in range(n):
            t = 2 * math.pi * j / n
            v.append((cx + rad * math.cos(t), y, cz + rad * math.sin(t)))
    for j in range(n):
        f.append((j, n + j, n + (j + 1) % n, (j + 1) % n))
    f.append(tuple(range(n)))
    f.append(tuple(n + j for j in range(n - 1, -1, -1)))
    m.add(v, f)

def torus_y(m, cx, y, cz, R, r, nmaj=48, nmin=6):
    t = Mesh("tmp", "x")
    torus(t, R, r, 0.0, nmaj, nmin)           # Achse Z -> Rotation um X: (x,y,z)->(x,-z,y)
    m.add([(cx + p[0], y - p[2], cz + p[1]) for p in t.v], t.f)

# ----------------------------------------------------------------- Bauteile
def build():
    P = {"AG_Corridor": [], "AG_Rails": [], "AG_Modules": [], "AG_Frames": [],
         "AG_EndBlocks": [], "AG_Utilities": []}
    sgn = (-1, 1)

    # ---- Flugkorridor 1800 x 1800 (Achtkant-Liner, Rippen, Leuchtstreifen, Endringe)
    liner = Mesh("Corridor_Liner", "gunmetal")
    prism_ring(liner, COR_IN, COR_OUT, -5500, 5500)
    P["AG_Corridor"].append(liner)
    ribs = Mesh("Corridor_Ribs", "gunmetal_l")
    for s in sgn:
        for i in range(N_MOD // 2):
            yc = s * (PITCH / 2 + i * PITCH)
            prism_ring(ribs, COR_OUT, COR_OUT + 70, yc - 300, yc + 300)
    P["AG_Corridor"].append(ribs)
    gl = Mesh("Corridor_LightStrips", "glow")
    for s in sgn:
        bx(gl, s * (COR_IN - 6), 0, 0, 12, 10000, 220)
        bx(gl, 0, 0, s * (COR_IN - 6), 220, 10000, 12)
    P["AG_Corridor"].append(gl)
    er = Mesh("Corridor_EndRings", "dark")
    am = Mesh("Corridor_EndRings_Amber", "amber")
    for s in sgn:
        prism_ring(er, COR_IN, COR_OUT + 160, s * 5500 - 100, s * 5500 + 100)
        prism_ring(am, COR_IN + 20, COR_IN + 50, s * 5600 - 20, s * 5600 + 20)
    P["AG_Corridor"] += [er, am]

    # ---- 2 parallele Beschleunigerschienen (Kernbalken)
    for s in sgn:
        r = Mesh("Rail_%s" % ("R" if s > 0 else "L"), "dark")
        bx(r, s * 1400, 0, 0, 500, 2 * RAIL_Y, 1800)
        P["AG_Rails"].append(r)

    # ---- 16 elektromagnetische Beschleunigermodule (8 je Schiene)
    n = 0
    for s in sgn:
        for i in range(N_MOD):
            n += 1
            yc = (i - (N_MOD - 1) / 2) * PITCH
            body = Mesh("Module_%02d_Body" % n, "gunmetal")
            bx(body, s * 1400, yc, 0, 600, MOD_LEN, 1800)
            units = Mesh("Module_%02d_Units" % n, "gunmetal_l")
            coils = Mesh("Module_%02d_Coils" % n, "amber")
            for z in (-1, 1):
                bx(units, s * 1400, yc, z * 1075, 700, MOD_LEN, 350)
                for dy in (-200, 200):
                    z0, z1 = (1250, 1305) if z > 0 else (-1305, -1250)
                    cylinder_axial(coils, 0, s * 1400, 150, z0, z1, off=yc + dy, n=16)
            bx(coils, s * 1090, yc, 0, 20, 600, 600)            # Spulenfenster zum Korridor
            armor = Mesh("Module_%02d_Armor" % n, "gunmetal_l")
            bx(armor, s * 1705, yc, 0, 10, 700, 1600)
            P["AG_Modules"] += [body, units, coils, armor]

    # ---- 4 Tragrahmen (verbinden beide Schienen)
    for k, yf in enumerate(FRAME_Y):
        fr = Mesh("Frame_%d_Beams" % (k + 1), "gunmetal")
        for z in (-1, 1):
            bx(fr, 0, yf, z * 1375, 2 * HW, FRAME_T, 250)       # Ober-/Unterträger
        for s in sgn:
            bx(fr, s * 1675, yf, 0, 150, FRAME_T, 2500)         # Pfosten
        P["AG_Frames"].append(fr)
        st = Mesh("Frame_%d_Struts" % (k + 1), "dark")
        for z in (-1, 1):
            bx(st, 0, yf, z * 1125, 300, FRAME_T - 80, 250)
            for s in sgn:
                bx(st, s * 600, yf, z * 1125, 150, FRAME_T - 120, 250)
        for s in sgn:
            bx(st, s * 1075, yf, 0, 150, FRAME_T - 80, 300)
            for z in (-1, 1):
                box_rot_y(st, s * 1450, yf, z * 1130, 380, FRAME_T - 100, 90, -s * z * math.pi / 4)
        P["AG_Frames"].append(st)
        ft = Mesh("Frame_%d_Feet" % (k + 1), "dark")
        for s in sgn:
            bx(ft, s * 1350, yf, -1470, 800, 1200, 60)
        P["AG_Frames"].append(ft)
        sp = Mesh("Frame_%d_Stripes" % (k + 1), "amber")
        for z in (-1, 1):
            for e in (-1, 1):
                bx(sp, 0, yf + e * (FRAME_T / 2 + 4), z * 1375, 3000, 8, 40)
        P["AG_Frames"].append(sp)

    # ---- Endblöcke mit 4 Feldgenerator-Scheiben je Ende
    for e in sgn:
        cb = Mesh("EndBlock_%s_Crossbeams" % ("N" if e > 0 else "S"), "gunmetal")
        for z in (-1, 1):
            bx(cb, 0, e * 5450, z * 1375, 2 * 1050, 900, 250)
        P["AG_EndBlocks"].append(cb)
        for s in sgn:
            tag = "%s%s" % ("N" if e > 0 else "S", "R" if s > 0 else "L")
            blk = Mesh("EndBlock_%s" % tag, "gunmetal")
            bx(blk, s * 1400, e * 5450, 0, 700, 900, 3000)
            hx = Mesh("EndBlock_%s_HeatExchanger" % tag, "gunmetal_l")
            bx(hx, s * 1400, e * 5950, 0, 500, 100, 500)
            P["AG_EndBlocks"] += [blk, hx]
            for z in (-1, 1):
                d = Mesh("Generator_%s_%s" % (tag, "T" if z > 0 else "B"), "gunmetal_l")
                cylinder_y(d, s * 1400, z * 820, 330, min(e * 5900, e * 6000), max(e * 5900, e * 6000), 20)
                ring = Mesh("Generator_%s_%s_Ring" % (tag, "T" if z > 0 else "B"), "amber")
                torus_y(ring, s * 1400, e * 5978, z * 820, 250, 22)
                core = Mesh("Generator_%s_%s_Core" % (tag, "T" if z > 0 else "B"), "glow")
                cylinder_y(core, s * 1400, z * 820, 130, min(e * 6000, e * 6010), max(e * 6000, e * 6010), 16)
                P["AG_EndBlocks"] += [d, ring, core]

    # ---- Kühl- und Stromleitungen
    cool = Mesh("Cooling_Pipes", "dark")
    for z in (-1, 1):
        for s in sgn:
            for x in (1230, 1570):
                cylinder_y(cool, s * x, z * 1380, 45, -RAIL_Y, RAIL_Y, 10)
    P["AG_Utilities"].append(cool)
    pw = Mesh("Power_Conduits", "dark")
    for s in sgn:
        for z in (-450, 450):
            cylinder_y(pw, s * 1720, z, 30, -RAIL_Y, RAIL_Y, 8)
    P["AG_Utilities"].append(pw)
    return P


# ----------------------------------------------------------------- Ausgabe
def to_blender_xyz(p):
    """Modell ist bereits in Blender-Koordinaten (X Breite, Y Länge, Z Höhe)."""
    return p

def export_obj(parts, path="stargate.obj"):
    mtl = path.rsplit(".", 1)[0] + ".mtl"
    with open(mtl, "w") as fm:
        for n, d in MATS.items():
            c = d["color"]
            fm.write("newmtl %s\nKd %.3f %.3f %.3f\nKs 0.5 0.5 0.5\nNs 60\n" % (n, *c))
            if "emit" in d:
                fm.write("Ke %.3f %.3f %.3f\n" % d["emit"])
            fm.write("\n")
    off = 1
    with open(path, "w") as fo:
        fo.write("mtllib %s\n" % mtl.split("/")[-1])
        for coll, meshes in parts.items():
            for m in meshes:
                fo.write("o %s__%s\nusemtl %s\n" % (coll, m.name, m.mat))
                for p in m.v:
                    q = to_blender_xyz(p)
                    fo.write("v %.3f %.3f %.3f\n" % q)
                for fc in m.f:
                    # Winding nach Achsentausch beibehalten (Rotation, keine Spiegelung)
                    fo.write("f " + " ".join(str(i + off) for i in fc) + "\n")
                off += len(m.v)
    return path

def build_in_blender(parts):
    import bpy
    # alte Tor-Objekte entfernen
    for c in list(bpy.data.collections):
        if c.name.startswith("AG_"):
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    mats = {}
    for n, d in MATS.items():
        mt = bpy.data.materials.new("AG_" + n)
        mt.use_nodes = True
        b = mt.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*d["color"], 1)
        b.inputs["Metallic"].default_value = d["metal"]
        b.inputs["Roughness"].default_value = d["rough"]
        if "emit" in d:
            for key in ("Emission Color", "Emission"):
                if key in b.inputs:
                    b.inputs[key].default_value = (*d["emit"], 1)
                    break
            if "Emission Strength" in b.inputs:
                b.inputs["Emission Strength"].default_value = d["strength"]
        mats[n] = mt
    root = bpy.data.objects.new("ACCELERATION_GATE", None)
    bpy.context.scene.collection.objects.link(root)
    for coll_name, meshes in parts.items():
        coll = bpy.data.collections.new(coll_name)
        bpy.context.scene.collection.children.link(coll)
        for m in meshes:
            me = bpy.data.meshes.new(m.name)
            me.from_pydata([to_blender_xyz(p) for p in m.v], [], m.f)
            me.update()
            ob = bpy.data.objects.new(m.name, me)
            ob.data.materials.append(mats[m.mat])
            ob.parent = root
            coll.objects.link(ob)
            for p in me.polygons:
                p.use_smooth = False
    return root

if __name__ == "__main__":
    P = build()
    try:
        import bpy  # noqa
        build_in_blender(P)
        print("ACCELERATION GATE in Blender aufgebaut:", sum(len(v) for v in P.values()), "Objekte")
    except ImportError:
        import os
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "acceleration_gate.obj")
        export_obj(P, out)
        print("OBJ geschrieben:", out)

"""
STARGATE – parametrischer Aufbau nach Referenzbild (Front / Seite / Oben)
=========================================================================
Nutzung in Blender:   Scripting-Tab -> Open -> stargate_build.py -> Run Script
Nutzung ohne Blender: python3 stargate_build.py   (schreibt stargate.obj + stargate.mtl)

Einheiten: Meter. Torachse = Blender-Y (Tor steht aufrecht, Frontansicht [Numpad 1] = Ringfläche).
Aufbau (alles getrennte, benannte Objekte in Collections):
  SG_OuterRing   : 12 Segmente + Kernring + Gelenkklammern + Leitungen
  SG_InnerRing   : drehbarer Innenring + 16 Beschleunigermodule
  SG_Spokes      : 12 Speichen zwischen Innen- und Außenring
  SG_Arms        : 4 identische Tragarme (0/90/180/270 Grad)
"""
import math

# ----------------------------------------------------------------- Parameter
R_APERTURE   = 700.0     # Radius Transitöffnung (Ø 1400 m)
R_INNER_OUT  = 880.0     # Außenradius Innenring
R_OUTER_IN   = 1090.0    # Innenradius Außenring-Segmente
R_OUTER_OUT  = 1400.0    # Außenradius Außenring-Segmente
R_ARM_TIP    = 1500.0    # Armspitze -> Gesamt-Ø 3000 m
DEPTH_RING   = 400.0     # Tiefe Außenring (z = +-200)
DEPTH_INNER  = 300.0     # Tiefe Innenring (z = +-150)
DEPTH_ARM    = 600.0     # Tiefe Arme -> Gesamttiefe 600 m
N_SEG        = 12
N_MODULES    = 16
N_SPOKES     = 12
GAP_DEG      = 1.6

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

# ----------------------------------------------------------------- Bauteile
def build():
    parts = {"SG_OuterRing": [], "SG_InnerRing": [], "SG_Spokes": [], "SG_Arms": []}
    TAU = 2 * math.pi
    zr = DEPTH_RING / 2
    zi = DEPTH_INNER / 2
    za = DEPTH_ARM / 2

    # ---- Außenring: Kernring (durchgehend, dunkel) -------------------------
    core = Mesh("OuterRing_Core", "dark")
    sector(core, R_OUTER_IN - 30, R_OUTER_OUT - 40, -zr * 0.7, zr * 0.7, 0, TAU, bevel=8, n=96)
    parts["SG_OuterRing"].append(core)

    # ---- 12 identische Außenring-Segmente ---------------------------------
    gap = math.radians(GAP_DEG)
    for i in range(N_SEG):
        a0 = TAU * i / N_SEG + gap / 2 + math.radians(15)   # Fugen bei 15 deg + k*30 -> Arme liegen mittig auf Segmenten
        a1 = TAU * (i + 1) / N_SEG - gap / 2 + math.radians(15)
        seg = Mesh("OuterRing_Segment_%02d" % (i + 1), "gunmetal")
        sector(seg, R_OUTER_IN, R_OUTER_OUT, -zr, zr, a0, a1, bevel=14, n=8)
        parts["SG_OuterRing"].append(seg)

        # Wartungspaneele vorn/hinten (leicht erhaben)
        pan = Mesh("OuterRing_Panels_%02d" % (i + 1), "gunmetal_l")
        pa0, pa1 = a0 + math.radians(2.5), a1 - math.radians(2.5)
        for sgn in (1, -1):
            zz0, zz1 = (zr, zr + 6) if sgn > 0 else (-zr - 6, -zr)
            sector(pan, R_OUTER_IN + 40, R_OUTER_OUT - 40, zz0, zz1, pa0, pa1, n=6)
            # Einschubfeld (Wartungsluke)
            am = (a0 + a1) / 2
            ca, sa = math.cos(am), math.sin(am)
            v, f = box_data(0, 0, 0, 90, 60, 10)
            hz = zz1 + 5 if sgn > 0 else zz0 - 5
            pan.add([_rotz((x + (R_OUTER_IN + R_OUTER_OUT) / 2, y, z + hz), am) for x, y, z in v], f)
        parts["SG_OuterRing"].append(pan)

        # Gelenkklammer zwischen Segmenten
        aj = a1 + gap / 2
        cl = Mesh("OuterRing_Joint_%02d" % (i + 1), "dark")
        radial_box(cl, aj, R_OUTER_IN - 20, R_OUTER_OUT + 10, 36, -zr - 14, zr + 14)
        parts["SG_OuterRing"].append(cl)

    # ---- Leitungen / Power-Systeme (Tori) ----------------------------------
    cond = Mesh("OuterRing_Conduits", "dark")
    am_ = Mesh("OuterRing_AmberStripes", "amber")
    for sgn in (1, -1):
        zc = sgn * (zr + 18)
        torus(cond, R_OUTER_IN + 70, 9, zc, 120, 8)
        torus(cond, R_OUTER_OUT - 70, 9, zc, 120, 8)
        torus(am_, (R_OUTER_IN + R_OUTER_OUT) / 2, 4, sgn * (zr + 10), 120, 6)
    parts["SG_OuterRing"] += [cond, am_]

    # ---- Innenring (drehbar) -----------------------------------------------
    ir = Mesh("InnerRing_Body", "gunmetal")
    sector(ir, R_APERTURE, R_INNER_OUT, -zi, zi, 0, TAU, bevel=16, n=96)
    flg = Mesh("InnerRing_Flanges", "gunmetal_l")
    for sgn in (1, -1):
        z0, z1 = (zi, zi + 26) if sgn > 0 else (-zi - 26, -zi)
        sector(flg, R_APERTURE - 12, R_APERTURE + 40, z0, z1, 0, TAU, n=96)
        sector(flg, R_INNER_OUT - 40, R_INNER_OUT + 12, z0, z1, 0, TAU, n=96)
    iamb = Mesh("InnerRing_AmberStripe", "amber")
    for sgn in (1, -1):
        torus(iamb, (R_APERTURE + R_INNER_OUT) / 2, 5, sgn * (zi + 27), 96, 6)
    parts["SG_InnerRing"] += [ir, flg, iamb]

    # ---- 16 Beschleunigermodule -------------------------------------------
    for i in range(N_MODULES):
        a = TAU * i / N_MODULES
        mod = Mesh("Accelerator_%02d" % (i + 1), "gunmetal_l")
        rm = (R_APERTURE + R_INNER_OUT) / 2 + 6
        radial_box(mod, a, rm - 62, rm + 62, 96, -zi - 70, zi + 70)
        parts["SG_InnerRing"].append(mod)
        lens = Mesh("Accelerator_Lens_%02d" % (i + 1), "glow")
        for sgn in (1, -1):
            z0, z1 = (zi + 70, zi + 80) if sgn > 0 else (-zi - 80, -zi - 70)
            radial_box(lens, a, rm - 30, rm + 30, 52, z0, z1)
        parts["SG_InnerRing"].append(lens)
        for k, sgn in enumerate((1, -1)):
            c = Mesh("Accelerator_Coil_%02d_%d" % (i + 1, k), "dark")
            cylinder_axial(c, a, rm, 20, sgn * (zi + 70), sgn * (zi + 120), n=10)
            parts["SG_InnerRing"].append(c)

    # ---- 12 Speichen (Innen- <-> Außenring), je zwei Streben + Querstrebe --
    for i in range(N_SPOKES):
        a = TAU * i / N_SPOKES + math.radians(15)
        sp = Mesh("Spoke_%02d" % (i + 1), "dark")
        for sgn in (1, -1):
            radial_box(sp, a, R_INNER_OUT - 10, R_OUTER_IN + 20, 22, sgn * (zi - 20) - 11, sgn * (zi - 20) + 11)
        radial_box(sp, a, R_INNER_OUT + 70, R_INNER_OUT + 110, 22, -zi + 10, zi - 10)
        radial_box(sp, a, R_OUTER_IN - 100, R_OUTER_IN - 60, 22, -zi + 10, zi - 10)
        parts["SG_Spokes"].append(sp)

    # ---- 4 identische Tragarme --------------------------------------------
    for k in range(4):
        a = TAU * k / 4 + math.pi / 2   # 90 deg (oben), 180, 270, 0
        arm = Mesh("Arm_%d_Body" % (k + 1), "gunmetal")
        radial_box(arm, a, R_INNER_OUT - 20, 1280, 300, -za, za)           # Hauptblock
        radial_box(arm, a, 1280, R_ARM_TIP, 250, -za * 0.9, za * 0.9)      # Spitze
        radial_box(arm, a, R_INNER_OUT - 60, R_INNER_OUT - 20, 220, -za * 0.8, za * 0.8)   # Fuß zum Innenring
        parts["SG_Arms"].append(arm)

        det = Mesh("Arm_%d_Detail" % (k + 1), "dark")
        # Klammer um den Außenring (vorn/hinten), Seitenkufen
        for sgn in (1, -1):
            radial_box(det, a, R_OUTER_IN - 60, R_OUTER_OUT + 40, 330, sgn * (zr + 24) , sgn * (zr + 24) + sgn * 50)
            radial_box(det, a, 1120, 1480, 60, sgn * za * 0.62 - 25, sgn * za * 0.62 + 25, off=190)
            radial_box(det, a, 1120, 1480, 60, sgn * za * 0.62 - 25, sgn * za * 0.62 + 25, off=-190)
        # Hydraulik-Zylinder seitlich
        for off in (-165, 165):
            cylinder_radial(det, a, R_INNER_OUT + 30, 1250, 18, 0, off, n=10)
        # Spitzen-Kappe & Lüftungsblock
        radial_box(det, a, R_ARM_TIP - 30, R_ARM_TIP + 10, 280, -za * 0.6, za * 0.6)
        parts["SG_Arms"].append(det)

        # Platten + Glasschlitz + Gelbstreifen
        pl = Mesh("Arm_%d_Panels" % (k + 1), "gunmetal_l")
        for sgn in (1, -1):
            z0, z1 = (za, za + 8) if sgn > 0 else (-za - 8, -za)
            radial_box(pl, a, 930, 1240, 230, z0, z1)
            radial_box(pl, a, 1300, 1460, 190, z0, z1)
        parts["SG_Arms"].append(pl)

        sl = Mesh("Arm_%d_LightSlit" % (k + 1), "glow")
        for sgn in (1, -1):
            z0, z1 = (za + 8, za + 14) if sgn > 0 else (-za - 14, -za - 8)
            radial_box(sl, a, 1010, 1180, 22, z0, z1)
        parts["SG_Arms"].append(sl)

        am2 = Mesh("Arm_%d_AmberStripes" % (k + 1), "amber")
        for sgn in (1, -1):
            z0, z1 = (za + 8, za + 12) if sgn > 0 else (-za - 12, -za - 8)
            for off in (-100, 100):
                radial_box(am2, a, 1300, 1450, 10, z0, z1, off=off)
        parts["SG_Arms"].append(am2)

    return parts


# ----------------------------------------------------------------- Ausgabe
def to_blender_xyz(p):
    """Torachse Z -> Blender Y (Ring steht aufrecht, Front = Numpad 1)."""
    x, y, z = p
    return (x, -z, y)

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
        if c.name.startswith("SG_"):
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    mats = {}
    for n, d in MATS.items():
        mt = bpy.data.materials.new("SG_" + n)
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
    root = bpy.data.objects.new("STARGATE", None)
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
        print("STARGATE in Blender aufgebaut:", sum(len(v) for v in P.values()), "Objekte")
    except ImportError:
        import os
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stargate.obj")
        export_obj(P, out)
        print("OBJ geschrieben:", out)

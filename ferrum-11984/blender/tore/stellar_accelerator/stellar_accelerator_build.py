"""
STELLAR ACCELERATOR – parametrischer Aufbau nach Referenzbild (Front / Seite / Oben)
===================================================================================
Nutzung in Blender:   Scripting-Tab -> Open -> stellar_accelerator_build.py -> Run Script
Nutzung ohne Blender: python3 stellar_accelerator_build.py  (schreibt stellar_accelerator.obj + .mtl)

Einheiten: Meter. Das Tor steht aufrecht (Front = Numpad 1, Arm 1 zeigt nach oben, Tiefe = Blender-Y).
Collections: SA_Hub (statisch, 12 Platten), SA_InnerRings (drehbar, 24 Blöcke), SA_Arms (3 identische Arme),
             SA_Modules (228 Beschleunigermodule), SA_Trusses (3 Fachwerkfelder)
Das Skript ist eigenständig (braucht kein anderes Skript).
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
# Koordinaten (Modell): Ebene = XY (Front), Tiefe = Z, Torachse = Z. Beim Export wird wie beim Stargate
# nach Blender gedreht (Front = Numpad 1, Arm 1 zeigt nach oben).
D2R = math.pi / 180.0
TAU = 2 * math.pi
R_AP = 1250.0                  # Apertur-Radius -> Ø 2,5 km
ARM_W, ARM_R0, ARM_R1, ARM_Z = 5200.0, 3000.0, 13500.0, 1600.0   # Armbreite, Start/Ende radial, halbe Armtiefe
ARM_HW = ARM_W / 2            # halbe Armbreite (Rahmenholme bei ARM_HW-100)
SPINE_W = 2400.0              # Mittelholm
MOD_OFF = 1900.0              # Modulreihen seitlich der Mittelachse
HUB_R, Z_HUB, Z_COL, Z_EMIT = 4800.0, 1100.0, 2200.0, 2500.0     # Hubradius, halbe Plattentiefe, Kragen, Emitter -> Tiefe 5 km
ARM_ANG = (90 * D2R, 210 * D2R, 330 * D2R)                         # 3-fache Radialsymmetrie
MOD_R0, MOD_PITCH, MOD_N = 4200.0, 450.0, 19                       # Beschleunigermodule je Reihe
COOL_R = (5000.0, 8200.0, 11400.0)

# ----------------------------------------------------------------- Zusatz-Primitive
def box_rot_z(m, cx, cy, cz, sx, sy, sz, phi):
    v, f = box_data(0, 0, 0, sx, sy, sz)
    c, s = math.cos(phi), math.sin(phi)
    m.add([(cx + x * c - y * s, cy + x * s + y * c, cz + z) for x, y, z in v], f)

def strut(m, p, q, t, zc, zt):
    """Balken zwischen zwei Punkten in der XY-Ebene (Fachwerk)."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    box_rot_z(m, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, zc, math.hypot(dx, dy), t, zt, math.atan2(dy, dx))

def cylinder_dir(m, cx, cy, cz, phi, rad, length, n=12):
    """Zylinder, Achse liegt in der XY-Ebene mit Richtung phi (Module quer zum Arm)."""
    ax = (math.cos(phi), math.sin(phi))
    w = (-math.sin(phi), math.cos(phi))
    v, f = [], []
    for e in (-1, 1):
        for j in range(n):
            t = TAU * j / n
            v.append((cx + e * length / 2 * ax[0] + rad * math.cos(t) * w[0],
                      cy + e * length / 2 * ax[1] + rad * math.cos(t) * w[1],
                      cz + rad * math.sin(t)))
    for j in range(n):
        f.append((j, (j + 1) % n, n + (j + 1) % n, n + j))
    f.append(tuple(range(n - 1, -1, -1)))
    f.append(tuple(n + j for j in range(n)))
    m.add(v, f)

# ----------------------------------------------------------------- Bauteile
def build():
    P = {"SA_Hub": [], "SA_InnerRings": [], "SA_Arms": [], "SA_Modules": [], "SA_Trusses": []}
    sg = (-1, 1)

    # ---- Hub (statisch): Apertur-Liner, Emitter, Kragen, Hubplatte (12 Segmente), Rippen, Randring
    liner = Mesh("Hub_ApertureLiner", "dark")
    sector(liner, R_AP, R_AP + 250, -Z_COL, Z_COL, 0, TAU, bevel=30, n=72)
    emit = Mesh("Hub_Emitters", "amber")
    glow = Mesh("Hub_ApertureGlow", "glow")
    for s in sg:
        z0, z1 = (Z_COL, Z_EMIT) if s > 0 else (-Z_EMIT, -Z_COL)
        sector(emit, R_AP, R_AP + 450, z0, z1, 0, TAU, n=72)
        torus(glow, R_AP + 20, 45, s * (Z_EMIT + 20), 96, 6)
    collar = Mesh("Hub_Collar", "dark")
    sector(collar, 2900, 3400, -Z_COL, Z_COL, 0, TAU, bevel=60, n=72)
    rim = Mesh("Hub_RimRing", "dark")
    sector(rim, HUB_R - 100, HUB_R + 100, -1300, 1300, 0, TAU, bevel=40, n=96)
    P["SA_Hub"] += [liner, emit, glow, collar, rim]
    gap = 1.2 * D2R
    for i in range(12):
        a0, a1 = TAU * i / 12 + gap / 2, TAU * (i + 1) / 12 - gap / 2
        pl = Mesh("Hub_Plate_%02d" % (i + 1), "gunmetal")
        sector(pl, 3400, HUB_R - 100, -Z_HUB, Z_HUB, a0, a1, bevel=40, n=6)
        pn = Mesh("Hub_Panel_%02d" % (i + 1), "gunmetal_l")
        for s in sg:
            z0, z1 = (Z_HUB, Z_HUB + 18) if s > 0 else (-Z_HUB - 18, -Z_HUB)
            sector(pn, 3550, HUB_R - 250, z0, z1, a0 + 4 * D2R, a1 - 4 * D2R, n=5)
        rb_ = Mesh("Hub_Rib_%02d" % (i + 1), "dark")
        radial_box(rb_, TAU * i / 12, 3400, HUB_R - 100, 120, -Z_HUB - 150, Z_HUB + 150)
        P["SA_Hub"] += [pl, pn, rb_]

    # ---- Innenringe (drehbar): 2 Ringe + 24 Beschleunigerblöcke
    ra = Mesh("InnerRing_A", "gunmetal")
    sector(ra, 1550, 2050, -1500, 1500, 0, TAU, bevel=60, n=72)
    rbm = Mesh("InnerRing_B", "dark")
    sector(rbm, 2150, 2800, -900, 900, 0, TAU, bevel=40, n=72)
    stripe = Mesh("InnerRing_AmberStripes", "amber")
    for s in sg:
        torus(stripe, 1800, 14, s * 1515, 96, 6)
        torus(stripe, 2475, 14, s * 915, 96, 6)
    P["SA_InnerRings"] += [ra, rbm, stripe]
    for i in range(24):
        a = TAU * i / 24
        bl = Mesh("InnerRing_Module_%02d" % (i + 1), "gunmetal_l")
        radial_box(bl, a, 2200, 2750, 260, -1300, 1300)
        P["SA_InnerRings"].append(bl)

    # ---- 3 identische Hauptarme
    mod_n = 0
    for k, a in enumerate(ARM_ANG):
        tag = "Arm%d" % (k + 1)
        spine = Mesh(tag + "_Spine", "gunmetal")
        radial_box(spine, a, 3400, 13000, SPINE_W, -ARM_Z, ARM_Z)
        cap = Mesh(tag + "_EndCap", "gunmetal")
        radial_box(cap, a, 13000, ARM_R1, ARM_W - 200, -1300, 1300)
        P["SA_Arms"] += [spine, cap]
        pan = Mesh(tag + "_Panels", "gunmetal_l")
        for s in sg:
            z0, z1 = (ARM_Z, ARM_Z + 20) if s > 0 else (-ARM_Z - 20, -ARM_Z)
            radial_box(pan, a, 4000, 7600, SPINE_W - 200, z0, z1)
            radial_box(pan, a, 7900, 12400, SPINE_W - 200, z0, z1)
        for s in sg:
            radial_box(pan, a, 12600, 13300, 1400, -1450, 1450, off=s * 1800)      # Spitzen-Panzerung
        P["SA_Arms"].append(pan)
        fr = Mesh(tag + "_Frame", "dark")
        for s in sg:
            radial_box(fr, a, 3200, 13300, 100, -1550, 1550, off=s * (ARM_HW - 100))       # Seitenholme
        for i in range(7):
            r = 3600 + 1500 * i
            for z in sg:
                radial_box(fr, a, r - 70, r + 70, ARM_W, z * 1500, z * 1600)      # Querträger
            for s in sg:
                radial_box(fr, a, r - 70, r + 70, 100, -1600, 1600, off=s * (ARM_HW - 100))
        P["SA_Arms"].append(fr)
        am = Mesh(tag + "_AmberStripes", "amber")
        for s in sg:
            for z in sg:
                z0, z1 = (1550, 1562) if z > 0 else (-1562, -1550)
                radial_box(am, a, 3600, 13000, 24, z0, z1, off=s * (ARM_HW - 100))
        radial_box(am, a, ARM_R1, ARM_R1 + 20, ARM_W - 600, -80, 80)                    # Leuchtschlitz Armspitze
        P["SA_Arms"].append(am)
        pipes = Mesh(tag + "_PowerConduits", "dark")
        for s in sg:
            for z in sg:
                cylinder_radial(pipes, a, 3300, 12800, 70, z * 1700, s * 1100, n=10)
        P["SA_Arms"].append(pipes)
        cool = Mesh(tag + "_CoolingTanks", "gunmetal_l")
        bands = Mesh(tag + "_CoolingBands", "amber")
        for rc in COOL_R:
            for s in sg:
                cylinder_radial(cool, a, rc - 1200, rc + 1200, 380, 0, s * MOD_OFF, n=16)
                cylinder_radial(bands, a, rc - 30, rc + 30, 386, 0, s * MOD_OFF, n=16)
        P["SA_Arms"] += [cool, bands]
        # Beschleunigermodule: 19 je Reihe x 2 Seiten x 2 Ebenen = 76 je Arm (228 gesamt)
        caps = Mesh(tag + "_ModuleCaps", "amber")
        ca, sa = math.cos(a), math.sin(a)
        for s in sg:
            for z in sg:
                for i in range(MOD_N):
                    r = MOD_R0 + MOD_PITCH * i
                    cx = ca * r - sa * s * MOD_OFF
                    cy = sa * r + ca * s * MOD_OFF
                    mod_n += 1
                    mm = Mesh("%s_Module_%s%s_%02d" % (tag, "L" if s < 0 else "R", "T" if z > 0 else "B", i + 1), "gunmetal_l")
                    cylinder_dir(mm, cx, cy, z * 1000, a + math.pi / 2, 200, 900, 12)
                    P["SA_Modules"].append(mm)
                    for e in sg:
                        cylinder_dir(caps, cx - sa * e * 455, cy + ca * e * 455, z * 1000, a + math.pi / 2, 206, 20, 12)
        P["SA_Modules"].append(caps)

    # ---- 3 Fachwerk-Felder zwischen den Armen (Hub-Rand <-> Armflanken)
    for k, b in enumerate((150 * D2R, 270 * D2R, 30 * D2R)):
        u = (math.cos(b), math.sin(b)); v = (-math.sin(b), math.cos(b))
        def pt(R, th, f):
            q = th * f
            return (R * (math.cos(q) * u[0] + math.sin(q) * v[0]), R * (math.cos(q) * u[1] + math.sin(q) * v[1]))
        fr_ = (-1, -0.5, 0, 0.5, 1)
        thB = math.pi / 3 - math.asin(ARM_HW / HUB_R)      # Halbwinkel Fachwerk-Fuss (Armflanke am Hubrand)
        thT = math.pi / 3 - math.asin(ARM_HW / 6800.0)
        Bp = [pt(HUB_R, thB, f) for f in fr_]
        Tp = [pt(6800.0, thT, f) for f in fr_]
        ch = Mesh("Truss_%d_Chords" % (k + 1), "gunmetal")
        dg = Mesh("Truss_%d_Diagonals" % (k + 1), "dark")
        for z in (-1000, 1000):
            for i in range(4):
                strut(ch, Bp[i], Bp[i + 1], 300, z, 300)
                strut(ch, Tp[i], Tp[i + 1], 300, z, 300)
                strut(dg, Bp[i], Tp[i + 1], 220, z, 220)
            for i in range(5):
                strut(dg, Bp[i], Tp[i], 220, z, 220)
        for p in Bp + Tp:
            bx_, bz_ = box_data(p[0], p[1], 0, 240, 240, 2000)
            dg.add(bx_, bz_)
        P["SA_Trusses"] += [ch, dg]
    return P


# ----------------------------------------------------------------- Ausgabe
def to_blender_xyz(p):
    """Torachse Z -> Blender Y (Ring steht aufrecht, Front = Numpad 1)."""
    x, y, z = p
    return (x, -z, y)

def export_obj(parts, path="stellar_accelerator.obj"):
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
        if c.name.startswith("SA_"):
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    mats = {}
    for n, d in MATS.items():
        mt = bpy.data.materials.new("SA_" + n)
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
    root = bpy.data.objects.new("STELLAR_ACCELERATOR", None)
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
        print("STELLAR ACCELERATOR in Blender aufgebaut:", sum(len(v) for v in P.values()), "Objekte")
    except ImportError:
        import os
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stellar_accelerator.obj")
        export_obj(P, out)
        print("OBJ geschrieben:", out)

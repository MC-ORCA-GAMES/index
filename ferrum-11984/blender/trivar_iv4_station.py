"""
TRIVAR IV-4 — ZENTRALER HANDELSKNOTEN
Modulare Hard-Surface-Rekonstruktion für Blender (nur bpy + bmesh, keine Add-ons).

Start:  Blender -> Scripting -> Datei öffnen -> Run Script
        oder: blender --background --python trivar_iv4_station.py -- --export station.glb

KOORDINATENSYSTEM (1 Blender-Einheit = 100 m, Szene-Einheiten werden entsprechend gesetzt)
  +Z = oben  -> in der FRONT-Ansicht senkrecht, in der SIDE-Ansicht senkrecht
  +X = rechts -> in der FRONT-Ansicht und in der TOP-Ansicht waagerecht
  +Y = Tiefe  -> in der SIDE-Ansicht waagerecht, in der TOP-Ansicht senkrecht
  Front = Blick entlang +Y, Side = Blick entlang -X, Top = Blick entlang -Z

AUFLÖSUNG DER WIDERSPRÜCHE IM REFERENZBLATT (siehe Antwort): FRONT ist Master für X/Z,
SIDE bestimmt die Y-Ausdehnung (ca. -21 .. +22), TOP liefert die XY-Anordnung
(Eck-Dockplattformen, zwei Frachtstapel je Seite) und wird in Y auf die SIDE-Tiefe gestaucht.
"""
import sys
import math
import bpy
import bmesh
from mathutils import Matrix, Vector

# ----------------------------------------------------------------------------------
# Materialien
# ----------------------------------------------------------------------------------
M_HULL, M_HULL2, M_ACCENT, M_CYAN, M_AD, M_DARK, M_LIGHT, M_WINDOW = range(8)


def mk_mat(name, color, emit=0.0, metal=0.6, rough=0.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        for key in ("Emission Color", "Emission"):
            if key in b.inputs:
                b.inputs[key].default_value = (*color, 1)
                break
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = emit
    return m


def make_materials():
    return [
        mk_mat("HULL_GREY", (0.12, 0.125, 0.135)),
        mk_mat("HULL_DARK", (0.05, 0.052, 0.058), rough=0.6),
        mk_mat("ACCENT_ORANGE", (0.9, 0.38, 0.05), emit=1.5, metal=0.2),
        mk_mat("LIGHT_CYAN", (0.2, 0.7, 1.0), emit=6.0, metal=0.0, rough=0.2),
        mk_mat("AD_PANEL_BLANK", (0.85, 0.9, 1.0), emit=3.0, metal=0.0, rough=0.3),
        mk_mat("OPENING_DARK", (0.0, 0.0, 0.0), metal=0.0, rough=1.0),
        mk_mat("NAV_LIGHT", (1.0, 0.95, 0.8), emit=10.0, metal=0.0, rough=0.2),
        mk_mat("WINDOW_WARM", (1.0, 0.7, 0.3), emit=2.5, metal=0.0, rough=0.3),
    ]


# ----------------------------------------------------------------------------------
# bmesh-Primitive (alle mit Material-Index)
# ----------------------------------------------------------------------------------
AXROT = {
    "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
    "Y": Matrix.Rotation(-math.pi / 2, 4, "X"),
    "Z": Matrix.Identity(4),
}


def _tag(verts, m):
    for v in verts:
        for f in v.link_faces:
            f.material_index = m


def box(bm, c, s, m=M_HULL):
    r = bmesh.ops.create_cube(
        bm, size=1.0,
        matrix=Matrix.Translation(c) @ Matrix.Diagonal((s[0], s[1], s[2], 1.0)))
    _tag(r["verts"], m)


def cyl(bm, c, rad, h, axis="Z", m=M_HULL, seg=24, rad2=None):
    r = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=seg,
        radius1=rad, radius2=rad if rad2 is None else rad2, depth=h,
        matrix=Matrix.Translation(c) @ AXROT[axis])
    _tag(r["verts"], m)


def sph(bm, c, rad, m=M_HULL, seg=24):
    r = bmesh.ops.create_uvsphere(
        bm, u_segments=seg, v_segments=seg // 2, radius=rad,
        matrix=Matrix.Translation(c))
    _tag(r["verts"], m)


# ----------------------------------------------------------------------------------
# Prototypen (Einheitsmaße, werden per Objekt-Skalierung instanziert; Mesh-Daten geteilt)
# ----------------------------------------------------------------------------------
def build_protos(mats):
    P = {}

    def proto(name, fn):
        bm = bmesh.new()
        fn(bm)
        me = bpy.data.meshes.new("MOD_" + name)
        bm.to_mesh(me)
        bm.free()
        for m in mats:
            me.materials.append(m)
        P[name] = me

    # 2. STRUKTURFACHWERK: Länge 1 entlang X, Querschnitt 1x1
    def truss(bm):
        for sy in (-.5, .5):
            for sz in (-.5, .5):
                box(bm, (0, sy, sz), (1, .07, .07), M_HULL2)
        for i in range(9):
            x = -.5 + i * .125
            box(bm, (x, 0, .5), (.025, 1, .05), M_HULL)
            box(bm, (x, 0, -.5), (.025, 1, .05), M_HULL)
            box(bm, (x, .5, 0), (.025, .05, 1), M_HULL)
            box(bm, (x, -.5, 0), (.025, .05, 1), M_HULL)
    proto("truss", truss)

    # 3. DOCKINGKORRIDOR (Rohr mit Rippen), Länge 1 entlang X
    def corridor(bm):
        box(bm, (0, 0, 0), (1, 1, 1), M_HULL)
        for i in range(6):
            x = -.45 + i * .18
            box(bm, (x, 0, 0), (.04, 1.06, 1.06), M_HULL2)
        box(bm, (0, 0, .51), (.9, .12, .02), M_CYAN)
    proto("corridor", corridor)

    # 4. HANGAREINFLUG, Öffnung zeigt nach +X
    def hangar(bm):
        box(bm, (0, 0, 0), (1, 1, 1), M_HULL)
        box(bm, (.5, 0, 0), (.04, .72, .58), M_DARK)
        for sy in (-.4, .4):
            for sz in (-.34, .34):
                box(bm, (.51, sy, sz), (.04, .05, .05), M_LIGHT)
        box(bm, (.5, 0, .38), (.03, .8, .04), M_ACCENT)
        box(bm, (.5, 0, -.38), (.03, .8, .04), M_ACCENT)
    proto("hangar", hangar)

    # 5/6. FRACHTCONTAINER
    def container(bm):
        box(bm, (0, 0, 0), (1, 1, 1), M_HULL)
        for i in range(5):
            box(bm, (-.4 + i * .2, 0, 0), (.04, 1.03, 1.03), M_HULL2)
        box(bm, (0, 0, .28), (.9, 1.02, .1), M_ACCENT)
    proto("container", container)

    # 8. INDUSTRIEROHR (X-Achse, Radius 0.5, Länge 1) und 9. STROMLEITUNG
    def pipe(bm):
        cyl(bm, (0, 0, 0), .5, 1, "X", M_HULL2, 16)
        for x in (-.5, .5):
            cyl(bm, (x, 0, 0), .6, .03, "X", M_HULL, 16)
    proto("pipe", pipe)

    def conduit(bm):
        cyl(bm, (0, 0, 0), .5, 1, "X", M_HULL, 12)
        for i in range(5):
            cyl(bm, (-.4 + i * .2, 0, 0), .56, .05, "X", M_ACCENT, 12)
    proto("conduit", conduit)

    # 10. KÜHLMODUL (Radiatorlamellen, Fläche in XZ, Lamellen entlang Y gestapelt)
    def cooling(bm):
        box(bm, (0, 0, -.45), (1, 1, .1), M_HULL2)
        for i in range(8):
            box(bm, (0, -.44 + i * .125, .05), (1, .03, .9), M_HULL)
        box(bm, (0, 0, .5), (1, 1, .02), M_ACCENT)
    proto("cooling", cooling)

    # 11. WOHNMODUL (Fensterbänder)
    def hab(bm):
        box(bm, (0, 0, 0), (1, 1, 1), M_HULL)
        for i in range(7):
            z = -.42 + i * .14
            box(bm, (0, 0, z), (.9, 1.02, .05), M_WINDOW)
            box(bm, (0, 0, z), (1.02, .9, .05), M_WINDOW)
        for z in (-.5, .5):
            box(bm, (0, 0, z), (1.04, 1.04, .04), M_HULL2)
    proto("hab", hab)

    # 12. GESCHÄFTSMODUL / Handelsring (Zylinder Z, Radius 1, Höhe 1)
    def commerce(bm):
        cyl(bm, (0, 0, 0), 1, 1, "Z", M_HULL, 48)
        cyl(bm, (0, 0, 0), 1.02, .22, "Z", M_WINDOW, 48)
        for z in (-.5, .5):
            cyl(bm, (0, 0, z), 1.03, .08, "Z", M_HULL2, 48)
    proto("commerce", commerce)

    # Hals-/Verbindungsmodul mit Cyan-Streifen
    def neck(bm):
        box(bm, (0, 0, 0), (1, 1, 1), M_HULL)
        for sx in (-.5, .5):
            box(bm, (sx, 0, 0), (.02, .16, .8), M_CYAN)
        for sy in (-.5, .5):
            box(bm, (0, sy, 0), (.16, .02, .8), M_CYAN)
    proto("neck", neck)

    # 13. WERBEFLÄCHE (leer, Normale = +-Y, dünn)
    def panel(bm):
        box(bm, (0, 0, 0), (1.06, .02, 1.06), M_HULL2)
        box(bm, (0, .015, 0), (1, .02, 1), M_AD)
        box(bm, (0, -.015, 0), (1, .02, 1), M_AD)
    proto("panel", panel)

    # 14. DOCKINGLICHT
    def light(bm):
        sph(bm, (0, 0, 0), .5, M_LIGHT, 8)
    proto("light", light)

    # 15. WARTUNGSMODUL (Kasten + Portalarm)
    def maint(bm):
        box(bm, (0, 0, 0), (1, 1, 1), M_HULL)
        box(bm, (.5, 0, .2), (.5, .15, .15), M_HULL2)
        box(bm, (.75, 0, 0), (.08, .15, .6), M_HULL2)
        box(bm, (0, 0, .5), (.6, .6, .06), M_ACCENT)
    proto("maint", maint)

    # 16. STRUKTURGELENK
    def joint(bm):
        sph(bm, (0, 0, 0), .5, M_HULL, 16)
        cyl(bm, (0, 0, 0), .55, .35, "Z", M_HULL2, 16)
    proto("joint", joint)

    # Antennenmast (Z, Länge 1)
    def mast(bm):
        cyl(bm, (0, 0, 0), .5, 1, "Z", M_HULL2, 8)
        sph(bm, (0, 0, .5), .9, M_LIGHT, 8)
    proto("mast", mast)

    # Kernstruktur ist ein Unikat (der zentrale Kern, 1x vorhanden)
    def core(bm):
        sph(bm, (0, 0, 0), 12.5, M_HULL, 48)
        for z in (-4.5, 4.5):
            cyl(bm, (0, 0, z), 12.55, .5, "Z", M_HULL2, 64)
        cyl(bm, (0, 0, 0), 12.7, .9, "Z", M_ACCENT, 64)
        for k in range(16):
            a = k * math.pi / 8
            box(bm, (12.2 * math.cos(a), 12.2 * math.sin(a), 0), (1.6, .5, 24.5 * .8), M_HULL2)
        for z in (-12.4, 12.4):
            cyl(bm, (0, 0, z), 3.2, 1.2, "Z", M_HULL2, 32)
            cyl(bm, (0, 0, z), 2.2, 1.3, "Z", M_CYAN, 32)
    proto("core", core)
    return P


# ----------------------------------------------------------------------------------
# Montage
# ----------------------------------------------------------------------------------
class Builder:
    def __init__(self, P):
        self.P = P
        self.cols = {}
        self.n = {}
        root = bpy.data.collections.new("TRIVAR_IV-4")
        bpy.context.scene.collection.children.link(root)
        self.root = root

    def col(self, name):
        if name not in self.cols:
            c = bpy.data.collections.new(name)
            self.root.children.link(c)
            self.cols[name] = c
        return self.cols[name]

    def inst(self, proto, loc, scale=(1, 1, 1), rot=(0, 0, 0), col="STRUCTURE"):
        o = bpy.data.objects.new(f"{proto}_{self.n.get(proto, 0):04d}", self.P[proto])
        self.n[proto] = self.n.get(proto, 0) + 1
        o.location = loc
        o.scale = scale
        o.rotation_euler = rot
        self.col(col).objects.link(o)
        return o

    def strut(self, p0, p1, w, col="STRUCTURE", proto="truss"):
        a, b = Vector(p0), Vector(p1)
        d = b - a
        o = self.inst(proto, (a + b) / 2, (d.length, w, w), col=col)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = d.to_track_quat("X", "Z")
        return o


def build_station(B):
    S = (1, 1, 1)

    # 1. ZENTRALER KERN (Ø 2.5 km) + 8 Hangareinflüge äquatorial
    B.inst("core", (0, 0, 0), col="CORE")
    for k in range(8):
        a = k * math.pi / 4
        r = 12.9
        B.inst("hangar", (r * math.cos(a), r * math.sin(a), 0), (2.6, 4.2, 3.2),
               (0, 0, a), "HANGARS")

    # Z-Hauptachse: Fachwerk durch den Kern (±46)
    B.inst("truss", (0, 0, 0), (92, 5, 5), (0, math.pi / 2, 0), "STRUCTURE")

    for s in (1, -1):
        # Handelsringe (Geschäftsviertel), z = ±16.5, Ø 2 km
        B.inst("commerce", (0, 0, s * 16.5), (10, 10, 3), col="COMMERCIAL")
        # Werbeflächen am Ring (leer), tangential ausgerichtet
        for k in range(8):
            a = k * math.pi / 4 + math.pi / 8
            B.inst("panel", (10.3 * math.cos(a), 10.3 * math.sin(a), s * 16.5),
                   (4.2, 1, 1.6), (0, 0, a + math.pi / 2), "ADVERTISING")
        # Hals (Cyan-Beleuchtung) z 18..32
        B.inst("neck", (0, 0, s * 25), (7, 6, 14), col="COMMERCIAL")
        # Wohnmodule z 33..49 + Bug
        for i, z in enumerate((37, 45)):
            B.inst("hab", (0, 0, s * z), (10, 8, 8), col="HABITATION")
            for sx in (-1, 1):  # Werbeflächen an den Stirnseiten
                B.inst("panel", (sx * 5.1, 0, s * z), (5, 1, 4.5),
                       (0, 0, math.pi / 2), "ADVERTISING")
        B.inst("hab", (0, 0, s * 51), (6, 5, 4), col="HABITATION")
        B.inst("joint", (0, 0, s * 32.6), (6.5, 6.5, 2.5), col="STRUCTURE")
        # Antennenmast bis ±60
        B.inst("mast", (0, 0, s * 56), (.5, .5, 8), col="INFRASTRUCTURE")
        for sx in (-1, 1):
            B.inst("mast", (sx * 3.2, 0, s * 53), (.25, .25, 5), col="INFRASTRUCTURE")
            B.inst("mast", (0, sx * 2.6, s * 53), (.25, .25, 5), col="INFRASTRUCTURE")

        # Schräge Dockingausleger an der Hauptachse (Front: seitlich der Handelsringe)
        for sx in (-1, 1):
            p0 = (sx * 5.0, 0, s * 22)
            p1 = (sx * 17.5, 0, s * 26)
            B.strut(p0, p1, 2.0, "DOCKING")
            B.inst("hangar", (sx * 18.5, 0, s * 26.2), (3.5, 3.0, 3.0),
                   (0, 0, 0 if sx > 0 else math.pi), "HANGARS")
            B.inst("joint", p0, (3, 3, 3), col="STRUCTURE")
            B.inst("light", (sx * 18.0, 1.8, s * 27.8), (.5, .5, .5), col="LIGHTS")
            # 45°-Streben vom Kern zu Wartungsmodulen
            q0 = (sx * 9.0, 0, s * 9.0)
            q1 = (sx * 17.0, 0, s * 17.0)
            B.strut(q0, q1, 1.4, "STRUCTURE")
            B.inst("maint", (sx * 18.0, 0, s * 18.2), (3.0, 2.6, 2.6),
                   (0, 0, 0 if sx > 0 else math.pi), "MAINTENANCE")

    # 3. DOCKINGKORRIDORE entlang ±X, Ø ~600 m, 12..30
    for sx in (-1, 1):
        rz = 0 if sx > 0 else math.pi
        B.inst("corridor", (sx * 21, 0, 0), (18, 6, 6), (0, 0, 0), "DOCKING")
        B.inst("hangar", (sx * 30.4, 0, 0), (2.4, 5, 5), (0, 0, rz), "HANGARS")
        # 8/9. Rohre und Stromleitungen oberhalb/unterhalb
        for sz in (-1, 1):
            B.inst("pipe", (sx * 21, 2.2, sz * 4.2), (18, 1.2, 1.2), col="INFRASTRUCTURE")
            B.inst("conduit", (sx * 21, -2.2, sz * 4.2), (18, .9, .9), col="INFRASTRUCTURE")
        # 14. Dockinglichter an den Korridorkanten
        for i in range(7):
            x = sx * (14 + i * 2.6)
            for sy in (-1, 1):
                for sz in (-1, 1):
                    B.inst("light", (x, sy * 3.1, sz * 3.1), (.35, .35, .35), col="LIGHTS")
        B.inst("joint", (sx * 12.3, 0, 0), (7, 7, 7), col="STRUCTURE")

        # 5/6/7. FRACHTKOMPLEX: Rahmen + 2 Stapel (y = ±5.2) x 2 Spalten x 6 Reihen
        cx = sx * 33.5
        B.inst("truss", (sx * 31.0, 0, 0), (2, 15, 3), (0, 0, 0), "CARGO_MODULES")  # Aufnahme
        for sy in (-1, 1):
            B.inst("truss", (cx, sy * 5.2, 0), (7.4, 5.4, 5.4), (0, math.pi / 2, 0), "CARGO_MODULES")
            for cxo in (-1.75, 1.75):
                for row in range(6):
                    z = -11.25 + row * 4.5
                    B.inst("container", (cx + cxo, sy * 5.2, z), (3.2, 4.8, 4.2), col="CARGO")
            # 7. Verladeportale auf den Stapeln
            B.inst("maint", (cx, sy * 5.2, 14.2), (6.5, 4.6, 1.6), col="CARGO_HANDLING")
            B.inst("maint", (cx, sy * 5.2, -14.2), (6.5, 4.6, 1.6), (0, 0, 0), "CARGO_HANDLING")
        for sz in (-1, 1):
            B.inst("light", (cx, 0, sz * 14.4), (.5, .5, .5), col="LIGHTS")

        # Kleine Dockingpods (Front: x ±22, z ±8..10)
        for sz in (-1, 1):
            B.inst("hab", (sx * 22, 0, sz * 10.0), (2.6, 3.4, 5.0), col="HABITATION")
            B.strut((sx * 22, 0, sz * 7.5), (sx * 22, 0, sz * 3.0), 1.0, "STRUCTURE")

    # TOP-Ansicht: X-Ausleger in der XY-Ebene zu Eck-Dockplattformen
    for sx in (-1, 1):
        for sy in (-1, 1):
            p0 = (sx * 9.5, sy * 8.0, 0)
            p1 = (sx * 23.0, sy * 17.0, 0)
            B.strut(p0, p1, 1.8, "DOCKING")
            B.inst("joint", p0, (3, 3, 3), col="STRUCTURE")
            B.inst("joint", p1, (3.4, 3.4, 3.4), col="STRUCTURE")
            # Plattform mit Hangar + Wartungskasten + Rahmen
            B.inst("maint", (sx * 24.5, sy * 18.3, 0), (4.0, 3.6, 3.0),
                   (0, 0, math.atan2(sy * 17.0, sx * 23.0)), "MAINTENANCE")
            B.inst("hangar", (sx * 26.0, sy * 19.4, 0), (2.2, 3.0, 2.6),
                   (0, 0, math.atan2(sy, sx)), "HANGARS")
            for sz in (-1, 1):
                B.inst("light", (sx * 23.5, sy * 18.3, sz * 1.9), (.4, .4, .4), col="LIGHTS")

    # +Y: Frachtkomplex der Rückseite (SIDE: rechts); -Y: Heck mit Kühlung & Antrieb
    B.inst("joint", (0, 13.6, 0), (6, 4, 6), (math.pi / 2, 0, 0), "STRUCTURE")
    B.inst("truss", (0, 17.5, 0), (8, 8, 11), (0, 0, math.pi / 2), "CARGO_MODULES")
    for cxo in (-3.0, 0.0, 3.0):
        for cy in (15.5, 19.5):
            for row in range(3):
                B.inst("container", (cxo, cy, -3.9 + row * 3.9), (2.8, 3.8, 3.7), col="CARGO")
    B.inst("maint", (0, 22.8, 0), (9, 1.8, 12), (0, 0, 0), "CARGO_HANDLING")

    B.inst("joint", (0, -13.6, 0), (6, 4, 6), (math.pi / 2, 0, 0), "STRUCTURE")
    B.inst("hab", (0, -17.6, 0), (9, 7.5, 8), col="HABITATION")
    for sx in (-1, 1):
        for sz in (-1, 1):
            B.inst("cooling", (sx * 6.5, -19.5, sz * 5.5), (5.5, 7.0, 6.0),
                   (0, 0, 0), "COOLING")
        B.inst("pipe", (sx * 3.0, -13.9, 0), (4, 1.4, 1.4), col="INFRASTRUCTURE")
    for sx in (-1, 1):
        B.inst("panel", (sx * 4.6, -17.6, 0), (6, 1, 5), (0, 0, math.pi / 2), "ADVERTISING")
    B.inst("mast", (0, -22.5, 0), (.4, .4, 3), (math.pi / 2, 0, 0), "INFRASTRUCTURE")


def main():
    for c in list(bpy.data.collections):
        if c.name.startswith(("TRIVAR", "STRUCTURE", "CORE")):
            bpy.data.collections.remove(c)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 100.0       # 1 BU = 100 m
    mats = make_materials()
    P = build_protos(mats)
    B = Builder(P)
    build_station(B)
    total = sum(B.n.values())
    print(f"[TRIVAR IV-4] {total} Instanzen, {len(P)} Prototyp-Meshes, "
          f"{len(B.cols)} Collections")
    for k, v in sorted(B.n.items()):
        print(f"   {k:10s} x{v}")
    if "--export" in sys.argv:
        path = sys.argv[sys.argv.index("--export") + 1]
        bpy.ops.export_scene.gltf(filepath=path)


if __name__ == "__main__":
    main()

"""
HALCYON — verlassene Forschungsstation (Unikat) nach referenz.png (unterer Teil: FRONT / SEITE / OBEN)
=====================================================================================================
Nutzung (ohne Blender):  python3 halcyon_build.py
   -> halcyon.obj / halcyon.mtl   (Blender: File > Import > Wavefront; Materialien tot/matt, KEINE Emission)
   -> halcyon_layout.json         (Prototypen + Instanzen; game.html: const HALCYON_LAYOUT = <Inhalt>)
Vorschau:               python3 render_preview.py halcyon.obj vorschau.png

Einheit: 1 = 10 m.  Z = oben (Turmachse), X = rechts (Rumpf quer), Y = Tiefe (Bug = -Y).
Wie bei den Handelsstationen ist das Blatt nicht streng orthografisch: FRONT = Master fuer X/Z, SEITE legt die
Tiefe (Y) fest, OBEN liefert die Anordnung in der Ebene (Ring mit Speichen, Aussenmodule, Kuppel auf dem Heckblock).

Aufbau (Forschungsstation, kein Handelsposten):
  Kern + Nabenscheibe | Rumpfachse X: Wohn-/Labormodule, Tankpaare, Hangar-Enden | Bug -Y: Druckzylinder + Mast
  Heck +Y: Laborblock + Radom (Geodaet-Kuppel) + Mast | Turm oben: 3 Stufen, Antennen, 3 Schuesseln |
  Turm unten: Maschinenraum, Querausleger, Reaktortank, Kuehler, Mast | Beobachtungsring (Z=+27) mit 8 Speichen, 4 Aussenlabore.
Zustand: planmaessig verlassen, keine Energie. Schaeden als eigene Instanzen (leicht aenderbar): Ringsektor eingestuerzt,
Labor am Ring abgesackt, Wartungsplattform gekippt, Antennen/Schuessel abgeknickt, 3 Huellenoeffnungen mit freiliegenden Streben,
Trümmer in der Naehe. Eis nur als Auflage (Kappen, Zapfen), die Konstruktion bleibt sichtbar.
Keine Schrift, keine Logos, keine Lichter (keine Emission, keine Positionslichter).
"""
import sys, os, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "trivar_hub"))
sys.path.insert(0, os.path.join(HERE, "..", "npc_stationen"))
import numpy as np
import trivar_hub_build as H
import npc_stationen_build as N            # registriert 'dome' und 'wheel' (und setzt PNAMES)
from trivar_hub_build import HULL, HULL2, ACCENT, CYAN, AD, DARK, LIGHT, WINDOW, box, cyl, sph, strut
pi = math.pi

# ---------------------------------------------------------------- Materialien: kalt, matt, tot
ICE, PALE = 8, 9
H.MAT_NAMES += ["ice", "pale"]
H.MAT_KD[:] = [(.30, .31, .34), (.13, .13, .15), (.48, .33, .16), (.05, .08, .10), (.40, .41, .43),
               (0, 0, 0), (.07, .07, .08), (.03, .04, .05), (.80, .88, .93), (.52, .54, .58)]

# ---------------------------------------------------------------- zusaetzliche Prototypen (Einheitsmasse)
@H.proto("tank")                         # stehender Tank, Achse Z, r=.5, h=1
def _(P):
    cyl(P, (0, 0, 0), .5, 1, "Z", HULL, 16)
    for z in (-.34, 0.0, .34): cyl(P, (0, 0, z), .53, .06, "Z", HULL2, 16)
    for z in (-.5, .5): cyl(P, (0, 0, z), .46, .05, "Z", PALE, 16)
@H.proto("lab")                          # Labormodul, Laenge entlang X
def _(P):
    box(P, (0, 0, 0), (1, 1, 1), HULL)
    for y in (-.5, .5): box(P, (0, y, .08), (.82, .03, .34), WINDOW)
    box(P, (0, 0, .5), (.9, .78, .04), PALE)
    for x in (-.5, .5): box(P, (x, 0, 0), (.06, 1.05, 1.05), HULL2)
    box(P, (0, 0, -.5), (.7, .6, .04), ACCENT)
@H.proto("dish")                         # Parabolschuessel, zeigt entlang +Z
def _(P):
    cyl(P, (0, 0, 0), 1, .07, "Z", PALE, 24); cyl(P, (0, 0, .05), 1.04, .05, "Z", HULL2, 24)
    cyl(P, (0, 0, -.3), .07, .55, "Z", HULL, 8); cyl(P, (0, 0, .25), .05, .45, "Z", HULL2, 6); sph(P, (0, 0, .5), .1, ACCENT, 6)
@H.proto("ringseg")                      # Ringsegment, tangential entlang X
def _(P):
    box(P, (0, 0, 0), (1, 1, 1), HULL); box(P, (0, 0, 0), (1.02, .45, 1.06), HULL2); box(P, (0, 0, .5), (.8, .6, .05), PALE)
@H.proto("radome")                       # Geodaet-Kuppel, r=1
def _(P):
    sph(P, (0, 0, 0), 1, PALE, 18)
    for ax in "XYZ": cyl(P, (0, 0, 0), 1.012, .035, ax, HULL2, 28)
@H.proto("disc")                         # Nabenscheibe mit konzentrischen Ringen
def _(P):
    cyl(P, (0, 0, 0), 1, 1, "Z", HULL, 40)
    for z in (-.52, .52): cyl(P, (0, 0, z), .72, .06, "Z", PALE, 40)
    cyl(P, (0, 0, .56), .4, .04, "Z", HULL2, 32)
@H.proto("hole")                         # Huellenoeffnung (innen dunkel)
def _(P):
    box(P, (0, 0, 0), (1, 1, 1), DARK); box(P, (0, 0, .5), (1.12, 1.12, .06), HULL2)
@H.proto("icecap")                       # Eisauflage (flach skalieren)
def _(P):
    sph(P, (0, 0, 0), .5, ICE, 8); sph(P, (.3, .1, -.05), .32, ICE, 7); sph(P, (-.28, -.12, -.02), .28, ICE, 7)
@H.proto("icicles")                      # Eiszapfen, haengen nach -Z (Z-Skala = Laenge)
def _(P):
    for x, y, L in ((-.4, .05, .5), (-.2, -.1, .85), (0, .1, .35), (.2, -.05, .65), (.4, .08, .45)):
        cyl(P, (x, y, -L / 2), .035, L, "Z", ICE, 5)
@H.proto("debris")                       # Truemmer
def _(P):
    box(P, (0, 0, 0), (1, .4, .6), HULL2, .3); box(P, (.5, .1, .2), (.5, .3, .3), HULL, -.5); cyl(P, (-.2, .3, .1), .08, 1, "X", HULL, 6)
H.PNAMES[:] = list(H.PROTOS)

I = H.inst
RNG = np.random.default_rng(11)
def mast(x, y, z0, L, w=.5, rot=(0, 0, 0), col="SENSORS"):
    I("mast", (x, y, z0 + L / 2), (w, w, L), rot, col)
def ice(x, y, z, sx, sy, sz, rz=0): I("icecap", (x, y, z), (sx, sy, sz), (0, 0, rz), "ICE")
def icicles(x, y, z, w, L): I("icicles", (x, y, z), (w, w, L), col="ICE")

def halcyon():
    # ------------------------------------------------ Kern + Nabenscheibe
    N.core(15)
    I("disc", (0, 0, 12), (26, 26, 3), col="CORE")
    # ------------------------------------------------ Rumpfachse X (Wohn- und Labormodule, Tankpaare, Hangar-Enden)
    for s in (1, -1):
        I("hab", (s * 30, 0, 0), (18, 22, 26), (0, pi / 2, 0), "HABITATION")
        I("lab", (s * 53, 0, -1), (20, 17, 14), col="RESEARCH")
        I("corridor", (s * 68, 0, 0), (10, 6, 6), col="DOCKING")
        I("hangar", (s * 75, 0, 0), (2.6, 10, 10), (0, 0, 0 if s > 0 else pi), "HANGARS")
        for y in (-9, 9):
            I("tank", (s * 66, y, -4), (9, 9, 34), col="ENGINEERING")
            I("tank", (s * 64, y * .6, -30), (6, 6, 18), col="ENGINEERING")
        I("pipe", (s * 40, -11.5, -5), (46, 1.2, 1.2), col="INFRASTRUCTURE")
        if s > 0: I("pipe", (s * 40, 11.5, -5), (46, 1.2, 1.2), col="INFRASTRUCTURE")
        I("conduit", (s * 40, 0, 10.5), (44, 1.0, 1.0), col="INFRASTRUCTURE")
        I("cooling", (s * 36, 0, -11), (10, 12, 4), col="COOLING")
    # Schaden: -X-Seite hat nur noch ein Rohr (Rest als Truemmer, siehe unten)
    I("pipe", (-52, 11.5, -5), (14, 1.2, 1.2), (0, 0, .35), "INFRASTRUCTURE")
    # ------------------------------------------------ Bug (-Y): Druckzylinder, Hangar, Mast
    I("hab", (0, -34, 0), (16, 16, 36), (pi / 2, 0, 0), "HABITATION")
    I("hangar", (0, -54, 0), (2.6, 10, 10), (0, 0, -pi / 2), "HANGARS")
    I("lab", (0, -30, 10), (8, 14, 4), (0, 0, pi / 2), "RESEARCH")
    mast(0, -56, 0, 26, .5, (pi / 2, 0, 0))
    for sx in (-1, 1): strut((sx * 8, -22, 4), (sx * 14, -40, 8), .8, "STRUCTURE")
    # ------------------------------------------------ Heck (+Y): Laborblock, Radom, Mast
    I("hab", (0, 30, 0), (18, 20, 28), (pi / 2, 0, 0), "HABITATION")
    I("lab", (0, 56, 0), (22, 16, 18), (0, 0, pi / 2), "RESEARCH")
    I("hangar", (0, 69, 0), (2.6, 10, 10), (0, 0, pi / 2), "HANGARS")
    I("radome", (0, 52, 19), (10, 10, 10), col="SENSORS")
    I("hole", (6.0, 52, 26.6), (3.4, 3.0, .6), (0, .6435, 0), "DAMAGE")                      # aufgerissene Kuppelplatte
    mast(0, 71, 0, 14, .5, (-pi / 2, 0, 0))                                               # Heckmast: unten ganz, oben abgeknickt
    I("mast", (1.2, 87.8, 0.6), (.5, .5, 9), (-pi / 2 + .26, 0, 0), "SENSORS")
    # ------------------------------------------------ Turm oben: 3 Stufen + Antennen + Schuesseln
    I("hab", (0, 0, 22), (16, 16, 18), col="HABITATION")
    I("hab", (0, 0, 41), (13, 13, 20), col="HABITATION")
    I("hab", (0, 0, 59), (10, 10, 16), col="HABITATION")
    I("hab", (0, 0, 70), (7, 7, 6), col="HABITATION")
    I("tank", (-10, 0, 41), (7, 7, 18), col="RESEARCH")
    I("tank", (10, 0, 36), (7, 7, 10), col="RESEARCH")                                    # rechter Tank: Kopf abgerissen
    I("debris", (11.5, 1, 47), (3, 3, 3), (.4, .8, .2), "DAMAGE")
    mast(0, 0, 70, 18, .9)
    for x, y, L, tilt in ((4.5, 4.5, 16, 0), (-4.5, 4.5, 12, 0), (-4.5, -4.5, 8, 0), (4.5, -4.5, 9, .27)):
        I("mast", (x, y, 67 + L / 2), (.5, .5, L), (tilt, tilt * .6, 0), "SENSORS")      # eine Antenne abgeknickt
    I("dish", (0, -9, 52), (5.5, 5.5, 5.5), (pi / 3, 0, 0), "SENSORS")
    I("dish", (0, 9, 56), (5.5, 5.5, 5.5), (-pi / 3, 0, 0), "SENSORS")
    I("dish", (-9, 0, 59), (4.5, 4.5, 4.5), (0, 2.3, .4), "DAMAGE")                        # Schuessel haengt abgekippt
    for z in (31, 51): I("maint", (0, -9.3, z), (6, 4, 3), col="MAINTENANCE")
    I("maint", (9.4, 0, 51.5), (6, 4, 3), (0, .55, 0), "DAMAGE")                          # Plattform gekippt, halb abgebrochen
    # ------------------------------------------------ Turm unten: Maschinenraum, Querausleger, Reaktortank, Kuehler
    I("hab", (0, 0, -22), (16, 16, 18), col="HABITATION")
    I("hab", (0, 0, -40), (12, 12, 18), col="HABITATION")
    I("truss", (0, 0, -36), (36, 2.2, 2.2), col="STRUCTURE")
    for sx in (-1, 1):
        I("lab", (sx * 19, 0, -36), (5, 5, 5), col="RESEARCH")
        I("cooling", (sx * 12, 0, -24), (8, 8, 10), col="COOLING")
        I("maint", (sx * 9, 7.5, -42), (4, 3, 3), col="MAINTENANCE")
    I("tank", (0, 0, -57), (10, 10, 14), col="ENGINEERING")
    mast(0, 0, -64, 12, .7, (pi, 0, 0))
    I("mast", (.8, 0, -80.6), (.4, .4, 8), (pi + .3, 0, 0), "SENSORS")
    # ------------------------------------------------ Beobachtungsring (Z=+27, R=40) mit Speichen; Sektor eingestuerzt
    NS, R, ZR = 48, 40.0, 27.0
    for i in range(NS):
        if 14 <= i < 20: continue                                                          # eingestuerzter Sektor ~105-150 Grad
        a = 2 * pi * i / NS
        I("ringseg", (R * math.cos(a), R * math.sin(a), ZR), (2 * pi * R / NS * 1.03, 1.6, 1.1), (0, 0, a + pi / 2), "RING")
    for k, a in enumerate([2 * pi * j / 8 for j in range(8)]):
        if k == 2: strut((9 * math.cos(a), 9 * math.sin(a), ZR), (22 * math.cos(a), 22 * math.sin(a), ZR), 1.1, "RING")  # Speiche abgerissen
        else: strut((9 * math.cos(a), 9 * math.sin(a), ZR), (R * math.cos(a), R * math.sin(a), ZR), 1.1, "RING")
    for i, (da, dz, tl) in zip((13, 20, 21), ((.0, -2.4, .5), (.1, -5.0, 1.0), (.05, -9.5, 1.5))):   # abgesackte / losgerissene Segmente
        a = 2 * pi * (i + da) / NS
        I("ringseg", (R * math.cos(a) * (1 + .02 * dz), R * math.sin(a) * (1 + .02 * dz), ZR + dz), (5.4, 1.6, 1.1), (0, tl * .5, a + pi / 2 + tl * .3), "DAMAGE")
    # ------------------------------------------------ Aussenlabore am Ring (4 Stueck), eines abgesackt
    for k, deg in enumerate((40, 152, 214, -45)):
        a = math.radians(deg); c, s_ = math.cos(a), math.sin(a)
        if k == 2:                                                                          # abgesackt: nur halbe Strebe, Labor gekippt
            strut((40 * c, 40 * s_, ZR), (47 * c, 47 * s_, ZR - .5), 1.4, "DAMAGE")
            I("lab", (64.5 * c, 64.5 * s_, ZR - 3), (16, 9, 9), (0, .14, a + .17), "DAMAGE")
            I("hangar", (72.9 * c, 72.9 * s_, ZR - 4), (2.4, 6, 6), (0, .14, a + .17), "HANGARS")
        else:
            strut((40 * c, 40 * s_, ZR), (54 * c, 54 * s_, ZR), 1.4, "DOCKING")
            I("lab", (62 * c, 62 * s_, ZR), (16, 9, 9), (0, 0, a), "RESEARCH")
            I("hangar", (71.2 * c, 71.2 * s_, ZR), (2.4, 6, 6), (0, 0, a), "HANGARS")
            I("maint", (62 * c, 62 * s_ - 0, ZR + 6.5), (4, 3, 2.5), (0, 0, a), "MAINTENANCE")
    # ------------------------------------------------ Huellenoeffnungen mit freiliegenden Streben
    I("hole", (-30, 3, 9.05), (8, 6, .5), col="DAMAGE"); strut((-32, 3, 9), (-35, 5.5, 14), .6, "DAMAGE"); strut((-27, 4, 9), (-24, 8, 12.5), .5, "DAMAGE")
    I("hole", (0, 60, 9.05), (6, 7, .5), col="DAMAGE"); strut((1, 58, 9), (3, 55, 14.5), .6, "DAMAGE")
    I("hole", (8.05, 0, 24), (.5, 6, 5), col="DAMAGE"); strut((8.5, 1, 22), (13, 3.5, 25), .5, "DAMAGE")
    # ------------------------------------------------ Eis: nur Auflagen (Oberseiten, Kanten, Zapfen)
    for x, y, z, sx, sy, sz in ((30, -3, 9.4, 12, 6, 1.3), (-52, 4, 7.4, 9, 4, 1.0), (52, -2, 7.4, 8, 5, 1.0), (0, -34, 8.4, 6, 8, 1.1),
                                (0, 30, 9.4, 7, 9, 1.2), (0, 0, 31.5, 11, 7, 1.2), (3, 0, 51.4, 8, 6, 1.1), (-10, 0, 50.3, 5, 5, 1.0),
                                (0, 0, -31.4, 9, 8, 1.1), (0, 0, -66.5, 4, 4, 1.0), (-67, -9, 13.5, 4, 4, 1.4), (67, 9, 13.5, 4, 4, 1.4),
                                (0, 52, 29.2, 7, 6, 1.6)):
        ice(x, y, z, sx, sy, sz, .3 * (x % 3))
    for k in (3, 9, 22, 28, 37, 44):                                                        # Eis auf Ringsegmenten
        a = 2 * pi * k / NS; ice(R * math.cos(a), R * math.sin(a), ZR + .9, 6, 2.6, .9, a + pi / 2)
    for deg in (40, 214, -45): a = math.radians(deg); ice(62 * math.cos(a), 62 * math.sin(a), ZR + 4.9, 9, 4, 1.0, a)
    for x, y, z, w, L in ((-62, -12, -9.5, 2.0, 6), (-70, 10, -21, 1.8, 7), (66, -10, -21, 1.8, 6), (-8, -9.4, -11, 2.2, 5), (14, 6, -9, 2.4, 6),
                          (0, 0, -66.5, 2.4, 6), (20, 30, 18, 2.4, 5), (-30, -20, 22, 2.0, 5), (40 * math.cos(1.0), 40 * math.sin(1.0), ZR - .6, 3.4, 4),
                          (0, 60, -9.5, 2.4, 5), (-18, 0, -37.5, 2.0, 4), (8, 0, -48, 2.0, 5)):
        icicles(x, y, z, w, L)
    # ------------------------------------------------ Truemmer und losgerissene Ausruestung in der Naehe
    I("dish", (-70, -45, -50), (4.5, 4.5, 4.5), (1.9, .4, .2), "DAMAGE")
    I("tank", (78, 40, -60), (5, 5, 12), (1.2, .5, 0), "DAMAGE")
    I("pipe", (-80, 12, 30), (24, 1.2, 1.2), (.4, .9, .2), "DAMAGE")
    for i in range(16):
        d = RNG.uniform(60, 105); u = RNG.uniform(-1, 1); th = RNG.uniform(0, 2 * pi); rr = d * math.sqrt(1 - u * u)
        I("debris", (rr * math.cos(th), rr * math.sin(th), d * u * .8), tuple(RNG.uniform(1.2, 3.2, 3)), tuple(RNG.uniform(0, 2 * pi, 3)), "DAMAGE")

if __name__ == "__main__":
    r = lambda x: round(float(x), 4)
    H.INST = []; halcyon()
    used = sorted({it["p"] for it in H.INST}, key=H.PNAMES.index)
    nv = H.write_obj(os.path.join(HERE, "halcyon.obj"), emit=())
    ext = np.array([it["loc"] for it in H.INST])
    ins = []
    for it in H.INST:
        R = it["R"]; ident = np.allclose(R, np.eye(3), atol=1e-6)
        ins.append([used.index(it["p"]), *map(r, it["loc"]), *map(r, it["scale"]), 0 if ident else [r(x) for x in R.flatten()]])
    out = dict(unit=10, mats=H.MAT_NAMES, protos=[[n, H.PROTOS[n]] for n in used], inst=ins)
    s = json.dumps(out, separators=(",", ":")); open(os.path.join(HERE, "halcyon_layout.json"), "w").write(s)
    print(f"HALCYON: {len(H.INST)} Instanzen, {len(used)} Prototypen, {nv} Vertices, JSON {len(s)} Byte, "
          f"x[{ext[:,0].min():.0f},{ext[:,0].max():.0f}] y[{ext[:,1].min():.0f},{ext[:,1].max():.0f}] z[{ext[:,2].min():.0f},{ext[:,2].max():.0f}]")

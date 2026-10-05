"""
VIER VERLASSENE ANLAGEN (Weltraum-Ruinen) nach referenz.png — FERRUM-11984
==========================================================================
Nutzung (ohne Blender):  python3 ruinen_build.py
   -> relais_posten.obj / raffinerie.obj / bergbau_station.obj / navigationsboje.obj  (Variante 0, Blender: File > Import > Wavefront)
   -> ruinen_layout.json   (gemeinsame Prototypen + je Anlage Basis + 3 Schadens-/Eis-Varianten;
                            game.html: const RUIN_LAYOUT = <Inhalt>)

Einheit: 1 = 10 m.  Z = oben, X = rechts, Y = Tiefe.  Wie bei Halcyon ist das Blatt nicht streng orthografisch:
FRONT = Master fuer X/Z, SEITE legt Y fest, OBEN die Anordnung in der Ebene.
HALCYON wird hier weder gebaut noch veraendert (nur dessen Prototypen/Materialien werden wiederverwendet).

Aufbau pro Anlage:  BASIS (intakte Architektur, immer gleich)  +  VARIANTE v (Schaeden + Eis, modular):
  Slots mit Zustand:  Antenne  ok / frozen / bent / broken / missing
                      Rohr/Foerderband/Traeger  ok / frozen / damaged / disconnected / missing
                      Solarpanel  ok / frozen / broken / missing
                      Modul  ok / frozen / tilt / drift (losgerissen, nacktes Gerueststueck bleibt zurueck)
                      Huellenoeffnung (fehlendes / aufgebogenes Panel), Truemmer
  Eis: eigene Instanzen (icecap / icicles) auf ALLEN Flaechenrichtungen (kein oben/unten im Weltraum), Konstruktion bleibt sichtbar.
Alles tot: keine Emission, keine Lichter, keine Fenster-Glut. Keine Schrift, keine Logos.
"""
import sys, os, math, json, zlib
HERE = os.path.dirname(os.path.abspath(__file__))
for sub in ("halcyon", "trivar_hub", "npc_stationen"):
    sys.path.insert(0, os.path.join(HERE, "..", "stationen", sub))
import numpy as np
import halcyon_build as HB                      # registriert die Halcyon-Prototypen und die toten Materialien (inkl. ice, pale)
import trivar_hub_build as H
from trivar_hub_build import HULL, HULL2, ACCENT, CYAN, AD, DARK, LIGHT, WINDOW, box, cyl, sph
pi = math.pi
ICE, PALE, SOLAR = 8, 9, 10
H.MAT_NAMES.append("solar"); H.MAT_KD.append((.10, .15, .27))

# ---------------------------------------------------------------- neue Prototypen (Einheitsmasse)
@H.proto("solar")                        # Solarpanel in XY, Normale +Z, 1x1
def _(P):
    box(P, (0, 0, 0), (1, 1, .03), SOLAR)
    for s in (-.5, .5): box(P, (s, 0, 0), (.03, 1.03, .05), HULL2); box(P, (0, s, 0), (1.03, .03, .05), HULL2)
    for x in (-.25, 0, .25): box(P, (x, 0, .02), (.012, .98, .02), HULL2)
    box(P, (0, 0, .02), (.98, .012, .02), HULL2)
@H.proto("sensor")                       # Kugelmodul (gleichmaessig skalieren), Aequatorband + Stutzen
def _(P):
    sph(P, (0, 0, 0), .5, PALE, 14); cyl(P, (0, 0, 0), .52, .07, "Z", HULL2, 20)
    cyl(P, (0, 0, .46), .12, .12, "Z", HULL, 8); cyl(P, (0, 0, -.5), .1, .1, "Z", HULL, 8)
@H.proto("silo")                         # Erzsilo, Achse Z, r=.5, h=1
def _(P):
    cyl(P, (0, 0, 0), .5, 1, "Z", HULL, 18)
    for z in (-.36, 0, .36): cyl(P, (0, 0, z), .53, .04, "Z", HULL2, 18)
    cyl(P, (0, 0, .51), .38, .03, "Z", HULL2, 18); cyl(P, (0, 0, .535), .18, .03, "Z", PALE, 12)
@H.proto("hopper")                       # Silo-Trichter (gestuft), Achse Z
def _(P):
    cyl(P, (0, 0, .3), .5, .4, "Z", HULL, 18); cyl(P, (0, 0, -.05), .38, .3, "Z", HULL2, 18)
    cyl(P, (0, 0, -.3), .22, .2, "Z", HULL, 14); cyl(P, (0, 0, -.45), .14, .1, "Z", PALE, 10)
@H.proto("column")                       # Prozessturm, Achse Z, r=.5, h=1, Leitern + Ringe
def _(P):
    cyl(P, (0, 0, 0), .5, 1, "Z", HULL, 16)
    for z in (-.4, -.15, .1, .35): cyl(P, (0, 0, z), .56, .03, "Z", HULL2, 16)
    cyl(P, (0, 0, .5), .45, .04, "Z", PALE, 16)
    for x in (-.53, .53): box(P, (x, 0, 0), (.03, .06, .98), HULL2)
@H.proto("psphere")                      # Kugeldruckbehaelter auf Stuetzen (gleichmaessig skalieren)
def _(P):
    sph(P, (0, 0, 0), .5, HULL, 16); cyl(P, (0, 0, 0), .52, .05, "Z", HULL2, 20); cyl(P, (0, 0, .52), .08, .1, "Z", PALE, 8)
    for sx in (-.3, .3):
        for sy in (-.3, .3): box(P, (sx, sy, -.5), (.04, .04, .34), HULL2)
    cyl(P, (0, 0, -.66), .42, .04, "Z", HULL2, 16)
@H.proto("platform")                     # Gitterplattform mit Gelaender
def _(P):
    box(P, (0, 0, 0), (1, 1, .05), HULL2)
    for s in (-.5, .5): box(P, (s, 0, .1), (.02, 1, .02), HULL); box(P, (0, s, .1), (1, .02, .02), HULL)
@H.proto("dframe")                       # offener Andock-/Ladungsrahmen (12 Kanten)
def _(P):
    for sy in (-.5, .5):
        for sz in (-.5, .5): box(P, (0, sy, sz), (1, .06, .06), HULL2)
    for sx in (-.5, .5):
        for sz in (-.5, .5): box(P, (sx, 0, sz), (.06, 1, .06), HULL2)
        for sy in (-.5, .5): box(P, (sx, sy, 0), (.06, .06, 1), HULL2)
@H.proto("conveyor")                     # Foerderband (X): Rahmen, Band, Stuetzen
def _(P):
    box(P, (0, 0, 0), (1, 1, .3), HULL2); box(P, (0, 0, .18), (1, .7, .06), DARK)
    for s in (-.45, .45): box(P, (0, s, .22), (1, .05, .16), HULL)
    for x in (-.4, -.2, 0, .2, .4): box(P, (x, 0, -.3), (.04, .9, .3), HULL2)
@H.proto("cable")                        # Seil / duenne Leitung (Z)
def _(P): cyl(P, (0, 0, 0), .5, 1, "Z", HULL2, 5)
@H.proto("plate")                        # abgerissene Huellenplatte
def _(P): box(P, (0, 0, 0), (1, 1, .04), HULL2); box(P, (0, 0, .03), (.9, .08, .03), HULL); box(P, (0, .3, .03), (.9, .08, .03), HULL)
H.PNAMES[:] = list(H.PROTOS)

# ---------------------------------------------------------------- Werkzeuge
K = 1.0                                   # Massstab der gerade gebauten Anlage (Entwurfsmass -> Layout-Einheit)
def put(p, loc, scale=(1, 1, 1), rot=(0, 0, 0), col="STRUCTURE", R=None):
    H.inst(p, tuple(float(c) * K for c in loc), tuple(float(s) * K for s in scale), rot, col, R)
def fput(p, loc, scale, rot=(0, 0, 0), col="ICE", R=None):                 # direkt in Layout-Einheiten (kein K)
    H.inst(p, tuple(float(c) for c in loc), tuple(float(s) for s in scale), rot, col, R)
def rod(p0, p1, w, col="STRUCTURE", p="truss"):
    H.strut(tuple(np.array(p0, float) * K), tuple(np.array(p1, float) * K), w * K, col, p)
def unit(v): v = np.array(v, float); return v / np.linalg.norm(v)
def basis_z(z):
    z = unit(z); t = np.array([1., 0, 0]) if abs(z[0]) < .9 else np.array([0, 1., 0])
    y = unit(np.cross(z, t)); x = np.cross(y, z); return np.stack([x, y, z], 1)
def basis_x(x):
    x = unit(x); t = np.array([0, 0, 1.]) if abs(x[2]) < .9 else np.array([0, 1., 0])
    y = unit(np.cross(t, x)); z = np.cross(x, y); return np.stack([x, y, z], 1)
def zrod(p, base, d, L, w, col="SENSORS"):                                 # Proto entlang Z, ab base in Richtung d
    d = unit(d); put(p, np.array(base, float) + d * L / 2, (w, w, L), col=col, R=basis_z(d))
def pick(rng, table):
    n, w = zip(*table); return str(rng.choice(n, p=np.array(w) / sum(w)))
ANT = [("ok", .55), ("frozen", .12), ("bent", .16), ("broken", .11), ("missing", .06)]
PIPE = [("ok", .58), ("frozen", .14), ("damaged", .14), ("disconnected", .09), ("missing", .05)]
PANEL = [("ok", .5), ("frozen", .1), ("broken", .3), ("missing", .1)]
MOD = [("ok", .45), ("frozen", .1), ("tilt", .3), ("drift", .15)]

# ---------------------------------------------------------------- Schadens-Slots
def antenna(base, L, w, rng, d=(0, 0, 1), col="SENSORS", state=None):
    state = state or pick(rng, ANT); base = np.array(base, float); d = unit(d)
    perp = unit(np.cross(d, [0, 1, 0] if abs(d[1]) < .9 else [1, 0, 0])); a = rng.uniform(0, 2 * pi)
    side = perp * math.cos(a) + np.cross(d, perp) * math.sin(a)
    if state in ("ok", "frozen"):
        zrod("mast", base, d, L, w, col)
        if state == "frozen": fput("icecap", (base + d * L * .5) * K, (w * 2.6 * K, w * 2.6 * K, L * .3 * K), R=basis_z(d))
    elif state == "bent":
        L1 = L * rng.uniform(.45, .65); zrod("mast", base, d, L1, w, col); zrod("mast", base + d * L1, d * .55 + side * .85, L - L1, w * .9, "DAMAGE")
    elif state == "broken":
        L1 = L * rng.uniform(.3, .45); zrod("mast", base, d, L1, w, col)
        zrod("mast", base + d * (L1 + L * .15) + side * L * .5, rng.normal(size=3), L * .35, w * .9, "DAMAGE")
    else: zrod("mast", base, d, max(L * .12, .6), w * 1.3, "DAMAGE")
    return state
def link(p0, p1, w, rng, proto="pipe", col="INFRASTRUCTURE", bend=None, state=None):
    state = state or pick(rng, PIPE); p0 = np.array(p0, float); p1 = np.array(p1, float); d = p1 - p0; L = np.linalg.norm(d); u = d / L
    if bend is None: bend = unit(np.cross(u, [0, 0, 1] if abs(u[2]) < .9 else [1, 0, 0])) * rng.choice((-1, 1))
    bend = np.array(bend, float)
    if state in ("ok", "frozen"):
        rod(p0, p1, w, col, proto)
        if state == "frozen": fput("icecap", (p0 + d * rng.uniform(.3, .7)) * K, (min(L * .3, 4) * K, w * 2.4 * K, w * 2.4 * K), R=basis_x(u))
    elif state == "damaged":
        m = p0 + d * .55; rod(p0, m, w, col, proto); rod(m, m + (p1 - m) * .9 + bend * L * .16, w * .95, "DAMAGE", proto)
    elif state == "disconnected":
        rod(p0, p0 + d * .45, w, col, proto); rod(p0 + d * .6 + bend * L * .22, p1 + bend * L * .22, w, "DAMAGE", proto)
    else: rod(p0, p0 + d * .18, w, "DAMAGE", proto)
    return state
def solar(loc, size, rotz, rng, state=None):
    state = state or pick(rng, PANEL); w, l = size; loc = np.array(loc, float); Rb = H.rot_euler(0, 0, rotz)
    if state in ("ok", "frozen"):
        put("solar", loc, (w, l, 1), R=Rb, col="SOLAR")
        if state == "frozen": fput("icecap", (loc + Rb @ (rng.uniform(-.25, .25) * w, rng.uniform(-.3, .3) * l, .1)) * K, (w * .5 * K, l * .35 * K, .12 * K), R=Rb)
    elif state == "broken":
        put("solar", loc + Rb @ (0, -l * .25, 0), (w, l * .5, 1), R=Rb, col="SOLAR")
        R2 = Rb @ H.rot_euler(rng.uniform(.8, 1.3), 0, 0); put("solar", loc + R2 @ (0, l * .25, 0), (w, l * .5, 1), R=R2, col="DAMAGE")
    else: put("solar", loc + Rb @ (0, -l * .46, 0), (w, l * .08, 1), R=Rb, col="DAMAGE")
    return state
def module(p, loc, scale, rng, col, rot=(0, 0, 0), state=None):
    state = state or pick(rng, MOD); loc = np.array(loc, float); m = max(scale)
    if state in ("ok", "frozen"): put(p, loc, scale, rot, col)
    elif state == "tilt": put(p, loc + (0, 0, -m * .06), scale, (rot[0] + .1, rot[1] + rng.uniform(.08, .18), rot[2] + rng.uniform(-.1, .1)), "DAMAGE")
    else:                                                                                   # losgerissen: Geruest bleibt stehen
        put("dframe", loc, tuple(s * .98 for s in scale), rot, "DAMAGE")
        put(p, loc + unit(rng.normal(size=3)) * m * 1.25, scale, tuple(rng.uniform(0, 2 * pi, 3)), "DAMAGE")
    return state

# ---------------------------------------------------------------- Oberflaechen (Huellenoeffnungen, Eis, Truemmer)
ROUND = {"tank", "silo", "column", "psphere", "hopper", "sensor", "radome", "mast", "dish", "disc"}
THIN = {"truss", "pipe", "conveyor", "dframe", "cable"}
ICEABLE = {"hab", "lab", "tank", "silo", "column", "psphere", "maint", "container", "cooling", "corridor", "platform", "disc", "truss",
           "pipe", "radome", "sensor", "conveyor", "hopper", "solar", "dframe", "hangar", "mast"}
def aligned(R): return bool(np.all((np.abs(R) < .02) | (np.abs(R) > .98)))
def half_ext(it): return .5 * np.abs(it["R"]) @ np.array(it["scale"], float)
def rot_about(a, t): r = [0, 0, 0]; r[a] = t; return tuple(r)
def surface_point(rng, it, lat=.6):
    h = half_ext(it); a = int(rng.integers(3)); sg = int(rng.choice((-1, 1))); off = np.zeros(3)
    lim = .3 if it["p"] in ROUND else lat
    for b in range(3):
        if b != a: off[b] = rng.uniform(-lim, lim) * h[b]
    pos = np.array(it["loc"], float) + off; pos[a] += sg * h[a]; n = np.zeros(3); n[a] = sg
    return pos, n, a, sg, h
def hull_holes(rng, n):
    cand = [it for it in H.INST if it["p"] in ("hab", "lab", "maint", "cooling", "container", "hangar") and aligned(it["R"])]
    for _ in range(n):
        it = cand[int(rng.integers(len(cand)))]; pos, nrm, a, sg, h = surface_point(rng, it, .45)
        w = rng.uniform(.9, 1.7) * K * 1.4; d = .25 * K; R = basis_z(nrm)
        fput("hole", pos + nrm * d * .1, (w, w * rng.uniform(.7, 1.2), d), R=R, col="DAMAGE")
        if rng.random() < .55:                                                                # Panel aufgebogen
            R2 = R @ H.rot_euler(rng.uniform(.7, 1.2), 0, rng.uniform(0, pi))
            fput("plate", pos + nrm * d * .5, (w * .9, w * .8, 1), R=R2, col="DAMAGE")
        if rng.random() < .5:                                                                 # freiliegende Strebe
            fput("truss", pos + nrm * d * 1.2, (w * 1.1, .12 * K * 2, .12 * K * 2), R=basis_x(unit(rng.normal(size=3))), col="DAMAGE")
def debris(rng, n, r0, r1):
    for _ in range(n):
        d = rng.uniform(r0, r1) * K; u = unit(rng.normal(size=3)); pos = u * d; kind = rng.random()
        if kind < .5: fput("debris", pos, tuple(rng.uniform(.5, 1.5, 3) * K), tuple(rng.uniform(0, 2 * pi, 3)), "DAMAGE")
        elif kind < .8: fput("truss", pos, (rng.uniform(1.5, 4) * K, .28 * K, .28 * K), tuple(rng.uniform(0, 2 * pi, 3)), "DAMAGE")
        else: fput("solar", pos, (rng.uniform(.9, 1.8) * K, rng.uniform(1.2, 2.4) * K, 1), tuple(rng.uniform(0, 2 * pi, 3)), "DAMAGE")
def ice_layer(rng, ncap, nspike):
    cand = [it for it in H.INST if it["p"] in ICEABLE and aligned(it["R"])]
    for _ in range(ncap):                                                                     # Eisauflagen auf allen Seiten
        it = cand[int(rng.integers(len(cand)))]; pos, nrm, a, sg, h = surface_point(rng, it, .6); thin = it["p"] in THIN
        lat = [b for b in range(3) if b != a]; cap = 1.5 if thin else 2.4; s = [0, 0, 0]
        for b in lat: s[b] = float(np.clip(2 * h[b] * rng.uniform(.5, .95), .35, cap))
        t = rng.uniform(.18, .5) * (.6 + .4 * max(s)); s[a] = t; pos = pos - nrm * t * .3
        fput("icecap", pos, tuple(s), rot_about(a, rng.uniform(0, 2 * pi)), "ICE")
    for _ in range(nspike):                                                                   # Zapfen in beliebige Richtung
        it = cand[int(rng.integers(len(cand)))]; pos, nrm, a, sg, h = surface_point(rng, it, .7)
        L = rng.uniform(1.2, 3.0) * K * 1.3; w = rng.uniform(.5, 1.0) * K * 1.3
        fput("icicles", pos + nrm * L / 2, (w, w, L), R=basis_z(-nrm), col="ICE")
        # icicles zeigen lokal nach -Z (Basis bei z=0): -Z -> +nrm, Basis sitzt dann an der Oberflaeche

# ================================================================ 1  RELAIS- & FORSCHUNGSPOSTEN (kompakt, vertikal)
ANT_O = [((1.7, 1.7, 8.6), 8.2, .4, (0, 0, 1)), ((-1.7, 1.7, 8.6), 6, .4, (0, 0, 1)), ((1.7, -1.7, 8.6), 5, .4, (0, 0, 1)),
         ((-1.7, -1.7, 8.6), 9, .4, (0, 0, 1)), ((0, 0, 16.5), 4.5, .45, (0, 0, 1)), ((0, 0, -19), 5, .5, (0, 0, -1)),
         ((14.4, 0, -1.2), 4.5, .35, (1, 0, 0)), ((-14.4, 0, -1.2), 3.5, .35, (-1, 0, 0))]
def outpost_base():
    put("hab", (0, 0, 0), (5, 5, 6), col="HABITATION"); put("hab", (0, 0, 5.8), (4, 4, 5.6), col="HABITATION")
    put("hab", (0, 0, -6.2), (4, 4, 6.4), col="HABITATION"); put("tank", (0, 0, -11.6), (3.2, 3.2, 4.4), col="ENGINEERING")
    put("maint", (0, -3.0, -2.5), (3, 1.8, 2.2), col="MAINTENANCE")
    put("lab", (-6.6, 0, -1.2), (7, 4.6, 3.4), col="RESEARCH")
    put("hab", (-12.2, 0, -1.2), (4.4, 4.2, 3.6), col="HABITATION"); put("hab", (12.2, 0, -1.2), (4.4, 4.2, 3.6), col="HABITATION")
    put("container", (4.2, -3.6, -4.5), (2.8, 2.0, 2.0), col="STORAGE"); put("container", (-3.4, 3.4, -4.8), (2.8, 2.0, 2.0), col="STORAGE")
    put("lab", (3.4, 3.4, 2.0), (3.0, 2.0, 2.2), col="RESEARCH")                              # Datenspeicher
    put("disc", (-6.6, 0, .9), (5.6, 5.6, .6), col="SENSORS"); put("radome", (-6.6, 0, 3.0), (3.0, 3.0, 3.0), col="SENSORS")   # Forschungskuppel
    rod((0, 0, 8.6), (0, 0, 16.5), 1.0, "SENSORS"); rod((-3.2, 0, 13.5), (3.2, 0, 13.5), .3, "SENSORS"); rod((0, -2.6, 11), (0, 2.6, 11), .3, "SENSORS")
    put("dish", (0, 2.6, 10.2), (2.8, 2.8, 2.8), (-pi / 3, 0, 0), "SENSORS"); put("dish", (2.4, -1.4, 14), (2.1, 2.1, 2.1), (pi / 2.7, 0, .5), "SENSORS")
    put("maint", (2.6, 0, 9.0), (2.2, 1.6, 1.4), col="SENSORS"); put("sensor", (-2.2, -1.5, 9.5), (1.3, 1.3, 1.3), col="SENSORS")
    rod((0, 2.5, 3.2), (0, 15, 3.2), .5); rod((0, -2.5, -3.5), (0, -13, -3.5), .5)
    rod((0, 0, -14), (0, 0, -19), 1.0)
    put("tank", (3.6, -3.4, -8.5), (2.0, 2.0, 3.2), col="ENGINEERING"); put("cooling", (-3.4, -2.8, -8.6), (2.6, 2.6, 1.6), (0, 0, .6), "COOLING")
    rod((-9, -3.4, -4.0), (9, -3.4, -4.0), .35, "MAINTENANCE"); put("corridor", (0, 3.2, -1.2), (2.2, 2.0, 2.0), col="DOCKING")
def outpost_dmg(v, rng):
    for b, L, w, d in ANT_O: antenna(b, L, w, rng, d)
    link((2.2, -2.2, -6), (2.2, -2.2, -11), .4, rng); link((-2.2, 2.2, -6), (-2.2, 2.2, -10.5), .4, rng); link((2.4, -3.0, -10.3), (5.0, -3.0, -10.3), .4, rng)
    for sx in (-1, 1): solar((sx * 2.5, 9.2, 3.2), (4.6, 7.4), 0, rng); solar((sx * 2.5, -8.5, -3.5), (4.6, 7.0), 0, rng)
    module("lab", (6.6, 0, -1.2), (7, 4.6, 3.4), rng, "RESEARCH")
    hull_holes(rng, 2 + v); debris(rng, 8 + 2 * v, 16, 26); ice_layer(rng, 46, 22)

# ================================================================ 2  RAFFINERIE-PLATTFORM (dicht, turmlastig, Rohrnetz)
RACK_Y = (-4, 0, 4); RACK_X = ((-13, -4.3), (-4.3, 4.3), (4.3, 13)); RISERS = ((-8, -4), (0, -4), (8, -4), (-8, 4), (0, 4), (8, 4))
def refinery_base():
    put("platform", (0, 0, -4.0), (28, 17, 1.2), col="DECK"); put("platform", (0, 0, 1), (28, 17, 1), col="DECK")  # untere/obere Ebene (unten dick = Deck)
    for y in (-8, 0, 8): rod((-14, y, -5.2), (14, y, -5.2), 1.0)
    for x in (-13, -6.5, 0, 6.5, 13): rod((x, -8, -5.2), (x, 8, -5.2), 1.0)
    for x in (-13, 13):
        for y in (-8, 8): rod((x, y, -5.2), (x * .75, y * .8, -9.5), .7)
    put("column", (0, 0, 6), (6.5, 6.5, 18), col="PROCESS"); put("platform", (0, 0, 3), (9, 9, 1), col="MAINTENANCE"); put("platform", (0, 0, 9.5), (8.4, 8.4, 1), col="MAINTENANCE")
    put("column", (-7, 3, 4), (3.8, 3.8, 14), col="PROCESS"); put("column", (7, -3, 3), (4, 4, 12), col="PROCESS"); put("column", (4.5, 6, 2), (3, 3, 9), col="PROCESS")
    put("platform", (-7, 3, 7), (6, 6, 1), col="MAINTENANCE"); put("platform", (7, -3, 6), (6.2, 6.2, 1), col="MAINTENANCE")
    put("tank", (-12, -4, 0), (4.2, 4.2, 8), col="STORAGE"); put("tank", (-12.5, 3.5, .3), (4.2, 4.2, 8.6), col="STORAGE"); put("tank", (-8, -7.5, -.6), (3.4, 3.4, 6), col="STORAGE")
    put("psphere", (10.5, 6, 1.4), (5.2, 5.2, 5.2), col="PRESSURE"); put("psphere", (10.5, -6, 1.4), (5.2, 5.2, 5.2), col="PRESSURE"); put("psphere", (-4, 7.5, .6), (4.4, 4.4, 4.4), col="PRESSURE")
    for x, y in ((-7, -3.6), (-7, 3.6), (6, -3.6), (6, 3.6)): put("tank", (x, y, -8.8), (3.6, 3.6, 9), (0, pi / 2, 0), "STORAGE")      # liegende Lagertanks
    put("cooling", (15.5, 0, -.5), (4.4, 8, 5), col="COOLING"); put("cooling", (-16.4, 0, -4.5), (3.2, 7, 4), col="COOLING")
    put("hab", (0, 0, -9.5), (5, 5, 5), col="MAINTENANCE"); rod((0, 0, -12), (0, 0, -19), 1.4); put("tank", (0, 0, -21.5), (3.8, 3.8, 5), col="PROCESS")
    put("maint", (5, -6.5, 3.6), (3, 2, 2), col="MAINTENANCE"); put("maint", (-5, 6.5, 5.0), (3, 2, 2), col="MAINTENANCE")
    rod((-13, -1.5, -1.5), (13, -1.5, -1.5), 1.1, "INFRASTRUCTURE", "pipe"); rod((-13, 1.5, -1.5), (13, 1.5, -1.5), 1.1, "INFRASTRUCTURE", "pipe")   # Hauptsammler
    for x in (-8, 0, 8): rod((x, -1.5, -1.5), (x, -1.5, -4.5), .7, "INFRASTRUCTURE", "pipe")
    for x in (-4.3, 4.3):
        for y in RACK_Y: put("joint", (x, y, -6.5), (1.0, 1.0, 1.0), col="INFRASTRUCTURE")
def refinery_dmg(v, rng):
    for y in RACK_Y:
        for x0, x1 in RACK_X: link((x0, y, -6.5), (x1, y, -6.5), .8, rng)
    for x, y in RISERS: link((x, y, -6.5), (x, y, -3.5), .6, rng)
    link((0, 0, 10.5), (-7, 3, 10.5), .7, rng); link((0, 0, 12.5), (7, -3, 12.5), .7, rng)
    link((2.5, 0, 2.5), (10.5, 6, 2.5), .8, rng); link((2.5, 0, 1.8), (10.5, -6, 1.8), .8, rng); link((-2.5, 2, 1.5), (-4, 7, 1.5), .7, rng); link((-3, 3, 1.5), (-10, 3.5, 1.5), .8, rng)
    antenna((-15.5, 6, -3), 17, .5, rng); antenna((0, 0, 15), 7, .6, rng); antenna((-7, 3, 11), 5, .45, rng); antenna((7, -3, 9), 5, .45, rng)
    module("cooling", (15.5, 0, -.5), (4.4, 8, 5), rng, "COOLING"); module("hab", (0, 0, -9.5), (5, 5, 5), rng, "MAINTENANCE")
    hull_holes(rng, 3 + v); debris(rng, 12 + 3 * v, 20, 34); ice_layer(rng, 70, 36)

# ================================================================ 3  BERGBAU- / FRACHTVERLADESTATION (breites Geruest, schwere Verladetechnik)
CELLS = [(x, -3, z) for x in (10.1, 13.9) for z in (-8.8, -6.6, -4.4, -2.2)]
def mining_base():
    for sx in (-3, 3):
        for sy in (-3, 3): rod((sx, sy, -14), (sx, sy, 14), 1.0)
    zs = (-14, -10, -5, 0, 5, 10, 14)
    for z in zs:
        rod((-3, -3, z), (3, -3, z), .7); rod((-3, 3, z), (3, 3, z), .7); rod((-3, -3, z), (-3, 3, z), .7); rod((3, -3, z), (3, 3, z), .7)
    for z0, z1 in zip(zs, zs[1:]):
        rod((3, -3, z0), (3, 3, z1), .45); rod((-3, 3, z0), (-3, -3, z1), .45); rod((-3, -3, z0), (3, -3, z1), .45); rod((3, 3, z0), (-3, 3, z1), .45)
    put("hab", (0, 0, 2), (4.2, 4.2, 5), col="HABITATION"); put("container", (0, 0, -7.5), (3.6, 3.6, 3), col="STORAGE"); put("lab", (0, 0, 9.2), (3.4, 3.4, 1.8), col="MAINTENANCE")
    rod((-22, 0, 11.2), (16, 0, 11.2), 2.6, "STRUCTURE")                                         # Verladearm (Hauptbalken)
    rod((0, 0, 7.5), (-16, 0, 11.2), .6); rod((0, 0, 7.5), (14, 0, 11.2), .6); rod((0, -18, 6), (0, -3, 6), 2.0); rod((0, -9, 6), (0, -9, 1), .5)
    put("maint", (10, 0, 9.0), (3, 3.2, 1.6), col="LOADING"); put("maint", (-12, 0, 9.0), (3, 3.2, 1.6), col="LOADING")
    zrod("mast", (-21, 0, 11.2), (0, 0, 1), 8, .8, "LOADING")
    rod((-21, 0, 19), (-8, 0, 12.4), .25, "STRUCTURE", "cable"); rod((-21, 0, 19), (-21, 0, 12.4), .25, "STRUCTURE", "cable")
    for x, y in ((-14, -5), (-14, 2)): put("silo", (x, y, -1 if y < 0 else -.5), (5.2, 5.2, 11 if y < 0 else 12), col="ORE"); put("hopper", (x, y, -8.5), (5.2, 5.2, 4), col="ORE")
    put("silo", (-9, -8, -3), (4, 4, 8), col="ORE"); put("hopper", (-9, -8, -8.6), (4, 4, 3.2), col="ORE")
    put("dframe", (12, -3, -5.5), (8.8, 2.6, 9.6), col="DOCKING"); put("dframe", (11.5, 4.5, -2.5), (8, 2.8, 6), col="DOCKING")
    put("dframe", (-6, -11, -9), (6, 4, 5), col="DOCKING")
    rod((3, 0, -5), (8.2, 0, -5), .9, "STRUCTURE"); rod((3, 0, -8), (8.2, 0, -8), .9, "STRUCTURE")
    rod((0, 0, 14), (0, 0, 19), .9); rod((-2, 0, 18.4), (8, 0, 18.4), .7); put("maint", (-3.2, 0, 18.0), (2, 2, 1.6), col="LOADING")
    put("disc", (0, 0, -15), (8, 8, 1.4), col="STRUCTURE"); rod((0, 0, -15.7), (0, 0, -22), 1.8); put("tank", (0, 0, -24), (3.4, 3.4, 4), col="ENGINEERING")
    put("hab", (0, -9, -3), (5, 5, 4), col="STORAGE"); rod((0, -3, -3), (0, -6.5, -3), 1.2)
def mining_dmg(v, rng):
    link((16, 0, 11.2), (24, 0, 11.2), 2.4, rng, "truss", "STRUCTURE", bend=(0, 0, -1))              # Armspitze
    for x in (12, 15.5, 19):                                                                    # haengende Container (Slots)
        s = pick(rng, [("ok", .6), ("tilt", .25), ("gone", .15)])
        if s == "gone": rod((x, 0, 10), (x, 0, 7.5), .18, "STRUCTURE", "cable"); continue
        if s == "ok": put("container", (x, 0, 4.8), (2.6, 2.6, 2.6), col="STORAGE"); rod((x, 0, 10), (x, 0, 6.1), .18, "STRUCTURE", "cable")
        else: put("container", (x + 1.2, 0, 4.3), (2.6, 2.6, 2.6), (0, .45, .15), "DAMAGE"); rod((x - .8, 0, 10), (x - .2, 0, 6.2), .18, "STRUCTURE", "cable")
    for i, (x, y, z) in enumerate(CELLS):                                                       # Container im Andockrahmen
        s = pick(rng, [("ok", .72), ("tilt", .13), ("missing", .15)])
        if s == "ok": put("container", (x, y, z), (3.8, 2.2, 2.0), col="STORAGE")
        elif s == "tilt": put("container", (x + .3, y, z - .1), (3.8, 2.2, 2.0), (0, .12, .07), "DAMAGE")
    for x, z in ((10.5, -1.5), (13, -1.5), (11.5, .5)):
        if rng.random() < .7: put("container", (x, 4.5, z), (3.4, 2.4, 2.0), col="STORAGE")
    link((-12, -5, -10.3), (-3.5, -3.2, -2.5), 1.3, rng, "conveyor", "TRANSFER", bend=(0, 0, 1)); link((-12, 2, -10.3), (-3.5, 2.2, -.5), 1.3, rng, "conveyor", "TRANSFER", bend=(0, 0, 1))
    link((-9.5, -8, -10.5), (-3, -3.2, -12), 1.1, rng, "conveyor", "TRANSFER", bend=(0, 0, 1)); link((3, 3, 12), (14, 3, 12), .6, rng, "truss", "STRUCTURE", bend=(0, 0, -1))
    antenna((0, 0, 19), 4, .5, rng); antenna((3, 3, 14), 5, .4, rng); antenna((-3, -3, 14), 6, .4, rng); antenna((0, 0, -26), 5, .5, rng, (0, 0, -1))
    module("hab", (0, -9, -3), (5, 5, 4), rng, "STORAGE")
    hull_holes(rng, 2 + v); debris(rng, 12 + 3 * v, 24, 40); ice_layer(rng, 76, 40)

# ================================================================ 4  BEOBACHTUNGS- & NAVIGATIONSBOJE (leicht, hoch, antennendominiert)
NR = 36; RR = 8.0; ZR = 9.5
def buoy_base():
    rod((0, 0, -9), (0, 0, 13), 1.1, "SENSORS"); put("hab", (0, 0, -4.5), (3, 3, 4.5), col="MAINTENANCE"); put("maint", (1.9, 0, -3.5), (2.6, 1.8, 2), col="MAINTENANCE")
    put("lab", (0, -2.4, -6), (3.2, 2.2, 2.4), col="RESEARCH"); put("tank", (0, 0, -10.5), (2.2, 2.2, 3.5), col="ENGINEERING"); rod((0, 0, -12.3), (0, 0, -14), .8)
    for i in range(NR):                                                                          # innerer Ring (Basis)
        a = 2 * pi * i / NR; put("pipe", (5.6 * math.cos(a), 5.6 * math.sin(a), ZR), (2 * pi * 5.6 / NR * 1.04, .35, .35), (0, 0, a + pi / 2), "SENSORS")
    for sx, sy, z, s in ((-5, -1, 2, 3.2), (4.6, 2.4, 5.6, 2.8), (-3.4, 3, -1, 2.4)):
        put("sensor", (sx, sy, z), (s, s, s), col="SENSORS"); rod((0, 0, z), (sx * .6, sy * .6, z), .4, "STRUCTURE")
    put("dish", (2.5, -1.5, 10), (2.2, 2.2, 2.2), (pi / 2.5, 0, .4), "SENSORS"); put("dish", (-2.2, -2, -.5), (1.8, 1.8, 1.8), (-pi / 2.4, 0, .9), "SENSORS")
    rod((-4, 0, 7), (4, 0, 7), .25, "SENSORS"); put("maint", (-1.6, 1.8, 1.5), (1.4, 1.2, 1.2), col="SENSORS"); put("maint", (1.5, -1.8, 4.2), (1.3, 1.1, 1.1), col="SENSORS")
    put("sensor", (-1.2, 1.6, 4.2), (.9, .9, .9), col="SENSORS"); put("container", (-1.7, -2.4, -2.2), (1.6, 1.2, 1.2), col="SCIENCE")
    for deg in (45, 135, 225, 315):
        a = math.radians(deg); rod((0, 0, -3.2), (9 * math.cos(a), 9 * math.sin(a), -3.8), .35, "STRUCTURE")
def buoy_dmg(v, rng):
    for i in range(NR):                                                                          # aeusserer Ring: Segment-Slots
        a = 2 * pi * i / NR; s = pick(rng, [("ok", .84), ("bent", .08), ("missing", .08)]); c, sn = math.cos(a), math.sin(a)
        if s == "missing": continue
        z = ZR + (rng.uniform(.5, 1.0) if s == "bent" else 0); rt = (0, rng.uniform(.15, .3) if s == "bent" else 0, a + pi / 2)
        put("pipe", (RR * c, RR * sn, z), (2 * pi * RR / NR * 1.04, .55, .55), rt, "DAMAGE" if s == "bent" else "SENSORS")
    for k in range(8):                                                                           # Speichen: Slots
        a = 2 * pi * k / 8; c, sn = math.cos(a), math.sin(a); s = pick(rng, [("ok", .72), ("broken", .2), ("missing", .08)])
        if s == "ok": rod((.8 * c, .8 * sn, ZR), (RR * c, RR * sn, ZR), .3, "SENSORS")
        elif s == "broken": rod((.8 * c, .8 * sn, ZR), (RR * .55 * c, RR * .55 * sn, ZR - .4), .3, "DAMAGE")
    for b, L, w, d in (((0, 0, 13), 6, .35, (0, 0, 1)), ((1.2, .8, 13), 3.5, .25, (0, 0, 1)), ((-4, 0, 7), 4, .25, (-1, 0, 0)), ((4, 0, 7), 4.5, .25, (1, 0, 0)),
                       ((0, 0, -14), 4, .4, (0, 0, -1)), ((.8, -.6, 12), 5, .22, (0.2, -0.2, 1)), ((-1, .6, 12), 4, .22, (-.15, .15, 1))):
        antenna(b, L, w, rng, d)
    for deg in (45, 135, 225, 315):
        a = math.radians(deg); solar((6.6 * math.cos(a), 6.6 * math.sin(a), -3.8), (3.4, 7), a - pi / 2, rng)
    module("lab", (0, -2.4, -6), (3.2, 2.2, 2.4), rng, "RESEARCH")
    link((1.5, 0, -2), (4.5, 0, -2.5), .3, rng); link((-1.5, 0, -1), (-3.6, 0, -1), .3, rng)
    hull_holes(rng, 1 + v); debris(rng, 6 + 2 * v, 12, 20); ice_layer(rng, 38, 20)

# ================================================================ Erzeugung
FACILITIES = [("relais_posten", "RELAIS- & FORSCHUNGSPOSTEN", .50, outpost_base, outpost_dmg),
              ("raffinerie", "RAFFINERIE-PLATTFORM", .75, refinery_base, refinery_dmg),
              ("bergbau_station", "BERGBAU- & FRACHTVERLADESTATION", .90, mining_base, mining_dmg),
              ("navigationsboje", "BEOBACHTUNGS- & NAVIGATIONSBOJE", .85, buoy_base, buoy_dmg)]
NV = 3
def build(slug, kk, base_fn, dmg_fn):
    global K
    K = kk; H.INST = []; base_fn(); base = list(H.INST); nb = len(base); vs = []
    for v in range(NV):
        H.INST = list(base); rng = np.random.default_rng(zlib.crc32(slug.encode()) * 7 + v * 101)
        dmg_fn(v, rng); vs.append(H.INST[nb:])
    return base, vs
if __name__ == "__main__":
    r = lambda x: round(float(x), 3); built = []
    for slug, name, kk, bf, df in FACILITIES: built.append((slug, name) + build(slug, kk, bf, df))
    used = sorted({it["p"] for _, _, b, vs in built for it in b + [i for v in vs for i in v]}, key=H.PNAMES.index)
    def enc(it):
        R = it["R"]; ident = np.allclose(R, np.eye(3), atol=1e-6)
        return [used.index(it["p"]), *map(r, it["loc"]), *map(r, it["scale"]), 0 if ident else [r(x) for x in R.flatten()]]
    out = dict(unit=10, mats=H.MAT_NAMES, protos=[[n, H.PROTOS[n]] for n in used], ruins=[])
    for slug, name, base, vs in built:
        H.INST = base + vs[0]; nv = H.write_obj(os.path.join(HERE, slug + ".obj"), emit=())
        ext = np.array([it["loc"] for it in H.INST]); span = (ext.max(0) - ext.min(0)) * 10
        out["ruins"].append(dict(slug=slug, name=name, base=[enc(i) for i in base], var=[[enc(i) for i in v] for v in vs]))
        print(f"{name}: Basis {len(base)} + Varianten {[len(v) for v in vs]} Instanzen, {nv} Vertices (V0), Ausdehnung ca. X{span[0]:.0f} Y{span[1]:.0f} Z{span[2]:.0f} m")
    s = json.dumps(out, separators=(",", ":")); open(os.path.join(HERE, "ruinen_layout.json"), "w").write(s)
    print(f"{len(used)} Prototypen, JSON {len(s)} Byte")

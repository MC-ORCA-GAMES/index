import numpy as np, trimesh, math, sys, json
from oregen import *

ICO_FACES = {}
def ico_faces(sub):
    if sub not in ICO_FACES:
        ICO_FACES[sub] = trimesh.creation.icosphere(subdivisions=sub).faces
    return ICO_FACES[sub]

BODY = {'A': (body_A, 4, 11), 'B': (body_B, 4, 21), 'C': (body_C, 5, 31)}
ORE_SEED = {'IRON': 100, 'NICKEL': 200, 'COPPER': 300, 'TITANIUM': 400, 'SILICON': 500, 'ICE': 600}
GAME_ID = {'IRON': 'iron', 'NICKEL': 'nickel', 'COPPER': 'copper', 'TITANIUM': 'titan', 'SILICON': 'silicon', 'ICE': 'ice'}
PHASES = {1: ('IRON', 'NICKEL'), 2: ('COPPER', 'TITANIUM'), 3: ('SILICON', 'ICE')}
PHASE_FILE = {1: 'ore_asteroids_phase_01_iron_nickel', 2: 'ore_asteroids_phase_02_copper_titanium', 3: 'ore_asteroids_phase_03_silicon_ice'}
TARGET_SIZE = {'A': 2.3, 'B': 3.9, 'C': 2.5}   # longest bbox edge (scene units)

class Parts:
    def __init__(s):
        s.rock = None
        s.clusters = []   # (tag, geom, M)
        s.plates = []
        s.veins = []
        s.fracture = []
        s.surface = []    # crusts / patches / blobs
    # each entry: (name, geom_key, geom (or None if shared), M)

def surface_masks(S, seed, variant, axis):
    """mask value per face used to select mineral zones"""
    fc = S.fc
    f = FBM(seed, 3, 0.9)
    if variant == 'B':
        ax = axis / np.linalg.norm(axis)
        ang = np.arctan2(fc[:, 2], fc[:, 1])
        stripes = -np.abs(np.sin(2.5 * ang + 1.7 * fc[:, 0] * 0.5 + 0.8))
        return 0.9 * stripes + 0.5 * f(fc * np.array([0.35, 1.2, 1.2]))
    return f(fc / max(S.R, 1e-6) * 1.3)

def build(ore, variant, lod=0):
    CFG['lod'] = lod
    seed = ORE_SEED[ore] + {'A': 0, 'B': 10, 'C': 20}[variant]
    r = np.random.default_rng(seed)
    fn, sub, bseed = BODY[variant]
    sub = sub - lod * (2 if variant == 'C' else 1)
    P, meta = fn(bseed + {'IRON': 0, 'NICKEL': 7, 'COPPER': 13, 'TITANIUM': 19, 'SILICON': 23, 'ICE': 29}[ore], sub)
    # normalise size
    ext = (P.max(0) - P.min(0)).max()
    k = TARGET_SIZE[variant] / ext
    P = (P - (P.max(0) + P.min(0)) / 2) * k
    F = ico_faces(sub)
    S = Surface(P, F)
    axis = meta.get('axis', np.array([1.0, 0, 0]))
    parts = Parts()
    name = f'{ore}_{variant}'
    parts.rock = flat_mesh(P[F], 'ROCK_DARK', f'{name}_ROCK_BODY')
    mask = surface_masks(S, seed + 3, variant, axis)
    hnoise = FBM(seed + 4, 3, 3.0)
    sc = math.sqrt(S.area.sum() / 17.0)  # size factor for components (1.0 ~ 2.3 unit asteroid)
    area_fac = (4 * math.pi * S.R ** 2) / (4 * math.pi * 1.6 ** 2)
    nf = lambda base: max(2, int(round(base * (S.area.sum() / 17.0))))

    hint_axis = axis if variant == 'B' else rdir(r)

    # fracture zone info (C)
    crack_pts = []
    if variant == 'C':
        g = meta['crack_g'][F].mean(1)
        crack_faces = g > 0.45
    else:
        crack_faces = np.zeros(len(F), bool)

    def vh(base, amp, f=hnoise):
        return base + amp * (0.5 + 0.5 * np.clip(f(P / S.R * 1.5), -1.5, 1.5) / 1.5)

    tris_crust = []   # (matname, tris, tag)

    if ore == 'IRON':
        covA, covB = (0.16, 0.08) if variant != 'B' else (0.15, 0.08)
        selB = rank_select(mask, 0.0, covA + covB)
        selA = rank_select(mask, 0.0, covA)
        hB = vh(0.035, 0.040) * sc
        topB = P + S.vn * hB[:, None]
        tris_crust.append(('IRON_DEEP_REDBROWN', crust(S, selB, hB), 'redbrown_layer'))
        hA = vh(0.040, 0.050, FBM(seed + 8, 3, 3.5)) * sc
        tris_crust.append(('IRON_CRUST_ORANGE', crust(S, selA, hA + hB, base=P, embed=0.045), 'orange_layer'))
        # secondary metallic gray exposed patch
        mask2 = FBM(seed + 9, 3, 1.1)(S.fc / S.R * 1.4)
        selG = rank_select(mask2, 0.0, 0.08) & ~selA
        hG = vh(0.02, 0.03) * sc
        tris_crust.append(('IRON_METAL_GRAY', crust(S, selG, hG), 'metal_patch'))
        # plates
        for i, (p, n) in enumerate(S.pick(nf(7), r, weight=np.where(selB & ~selA, 3.0, 1.0), min_d=0.45 * sc)):
            asp = r.uniform(1.0, 1.4) if variant != 'B' else r.uniform(1.5, 2.0)
            mat = 'IRON_METAL_GRAY' if i % 2 == 0 else 'IRON_DEEP_REDBROWN'
            g = plate_tris(r, r.uniform(0.14, 0.24) * sc, r.uniform(0.035, 0.06) * sc, npts=int(r.integers(6, 9)), aspect=asp)
            M = TRS(p, n, hint_axis, r.uniform(0, TAU) if variant != 'B' else r.normal() * 0.25, (1, 1, 1))
            parts.plates.append((f'PLATE_{i+1:02d}', mat, g, M))
        # chunky ore nodules (blocky rust crystals)
        for i, (p, n) in enumerate(S.pick(nf(6), r, weight=np.where(selA, 2.5, 0.6), min_d=0.28 * sc)):
            sz = r.uniform(0.12, 0.22) * sc
            g = crystal_cluster(r, sz, sides=4, lean=0.5, tip=0.18, taper=0.78, slim=0.30)
            M = TRS(p, n, hint_axis, r.uniform(0, TAU), (1, 1, 1))
            parts.clusters.append((f'NODULE_{i+1:02d}', 'IRON_CRUST_ORANGE' if i % 3 else 'IRON_DEEP_REDBROWN', g, M))
        # veins
        nv = 6 if variant != 'B' else 7
        for i in range(nv):
            idx = int(r.integers(0, len(P)))
            hint = hint_axis if variant == 'B' else rdir(r)
            steps = int(r.integers(14, 26)) if variant != 'B' else int(r.integers(26, 44))
            mat = 'IRON_CRUST_ORANGE' if i < nv - 2 else 'IRON_METAL_GRAY'
            g = vein_tris(S, r, idx, steps, hint, rad=0.020 * sc, wander=0.3 if variant == 'B' else 0.45)
            parts.veins.append((f'VEIN_{i+1:02d}', mat, g, np.eye(4)))
        # fracture deposits (C)
        if variant == 'C':
            idxs = np.where(meta['crack_g'] > 0.55)[0]
            r.shuffle(idxs); chosen = []
            for ii in idxs:
                if all(np.linalg.norm(P[ii] - P[j]) > 0.22 for j in chosen): chosen.append(ii)
                if len(chosen) >= 9: break
            for i, ii in enumerate(chosen):
                nn = unit(S.vn[ii] * 0.6 + unit(P[ii]) * 0.6)
                sz = r.uniform(0.16, 0.30)
                g = crystal_cluster(r, sz, sides=4, lean=0.6, tip=0.18, taper=0.78, slim=0.28)
                M = TRS(P[ii], nn, rdir(r), r.uniform(0, TAU), (1, 1, 1))
                parts.fracture.append((f'FRACTURE_DEPOSIT_{i+1:02d}', 'IRON_CRUST_ORANGE' if i % 2 == 0 else 'IRON_DEEP_REDBROWN', g, M))
            selF = crack_faces
            hF = np.full(len(P), 0.05)
            tris_crust.append(('IRON_CRUST_ORANGE', crust(S, selF, hF), 'fracture_lining'))

    if ore == 'NICKEL':
        covG = 0.09
        selG = rank_select(mask, 0.0, covG)
        hG = vh(0.025, 0.035) * sc
        tris_crust.append(('NICKEL_GRAYGREEN', crust(S, selG, hG), 'graygreen_deposit'))
        mask2 = FBM(seed + 9, 3, 1.1)(S.fc / S.R * 1.4)
        selV = rank_select(mask2, 0.0, 0.17) & ~selG
        hV = vh(0.03, 0.04, FBM(seed + 12, 3, 3.0)) * sc
        tris_crust.append(('NICKEL_GREEN', crust(S, selV, hV), 'green_deposit'))
        # large + medium + small mint crystal clusters
        lean = 0.75 if variant == 'B' else 0.5
        specs = [(nf(5), (0.36, 0.52)), (nf(8), (0.22, 0.32)), (nf(11), (0.10, 0.16))]
        w = np.where(selG | selV, 2.4, 1.0)
        k = 0
        for cnt, (lo, hi) in specs:
            for p, n in S.pick(cnt, r, weight=w, min_d=0.26 * sc * (hi / 0.4 + 0.5)):
                k += 1
                sz = r.uniform(lo, hi) * sc
                g = crystal_cluster(r, sz, sides=6, lean=lean, tip=0.30, taper=0.82, slim=0.21)
                hint = hint_axis if variant == 'B' else rdir(r)
                n2 = n
                if variant == 'B':  # crystals lean along the long axis
                    n2 = unit(n + 0.6 * hint_axis * np.sign(r.choice([-1, 1, 1])))
                M = TRS(p, n2, rdir(r), r.uniform(0, TAU), (r.uniform(0.9, 1.15), r.uniform(0.9, 1.15), r.uniform(0.9, 1.2)))
                mat = 'NICKEL_MINT' if k % 4 else 'NICKEL_GREEN'
                parts.clusters.append((f'CLUSTER_{k:02d}', mat, g, M))
        # rounded mineral formations
        for i, (p, n) in enumerate(S.pick(nf(5), r, weight=w, min_d=0.35 * sc)):
            g = blob_tris(r, r.uniform(0.18, 0.32) * sc, seed + 40 + i)
            M = TRS(p, n, rdir(r), r.uniform(0, TAU), (1, 1, 1))
            parts.surface.append((f'BLOB_{i+1:02d}', 'NICKEL_MINT' if i % 2 == 0 else 'NICKEL_GRAYGREEN', g, M))
        # polished plates
        for i, (p, n) in enumerate(S.pick(nf(5), r, weight=np.where(selG, 2.0, 1.0), min_d=0.45 * sc)):
            asp = r.uniform(1.0, 1.3) if variant != 'B' else r.uniform(1.5, 2.0)
            g = plate_tris(r, r.uniform(0.13, 0.22) * sc, r.uniform(0.03, 0.05) * sc, npts=int(r.integers(6, 8)), aspect=asp)
            M = TRS(p, n, hint_axis, r.uniform(0, TAU) if variant != 'B' else r.normal() * 0.25, (1, 1, 1))
            parts.plates.append((f'PLATE_{i+1:02d}', 'NICKEL_GRAYGREEN', g, M))
        # veins
        nv = 4 if variant != 'B' else 6
        for i in range(nv):
            idx = int(r.integers(0, len(P)))
            hint = hint_axis if variant == 'B' else rdir(r)
            steps = int(r.integers(14, 24)) if variant != 'B' else int(r.integers(26, 40))
            g = vein_tris(S, r, idx, steps, hint, rad=0.018 * sc, wander=0.3 if variant == 'B' else 0.45)
            parts.veins.append((f'VEIN_{i+1:02d}', 'NICKEL_GREEN', g, np.eye(4)))
        if variant == 'C':
            idxs = np.where(meta['crack_g'] > 0.55)[0]
            r.shuffle(idxs); chosen = []
            for ii in idxs:
                if all(np.linalg.norm(P[ii] - P[j]) > 0.20 for j in chosen): chosen.append(ii)
                if len(chosen) >= 10: break
            for i, ii in enumerate(chosen):
                nn = unit(S.vn[ii] * 0.6 + unit(P[ii]) * 0.6)
                sz = r.uniform(0.18, 0.36)
                g = crystal_cluster(r, sz, sides=6, lean=0.65, tip=0.30, taper=0.82, slim=0.16)
                M = TRS(P[ii], nn, rdir(r), r.uniform(0, TAU), (1, 1, 1))
                parts.fracture.append((f'FRACTURE_DEPOSIT_{i+1:02d}', 'NICKEL_MINT' if i % 3 else 'NICKEL_GREEN', g, M))
            hF = np.full(len(P), 0.04)
            tris_crust.append(('NICKEL_GRAYGREEN', crust(S, crack_faces, hF), 'fracture_lining'))

    if ore == 'COPPER':
        selB = rank_select(mask, 0.0, 0.25 if variant != 'B' else 0.23)
        selA = rank_select(mask, 0.0, 0.13 if variant != 'B' else 0.12)
        hB = vh(0.030, 0.035) * sc
        tris_crust.append(('COPPER_DARKTURQ', crust(S, selB, hB), 'darkturq_layer'))
        hA = vh(0.040, 0.050, FBM(seed + 8, 3, 3.5)) * sc
        tris_crust.append(('COPPER_ORANGE', crust(S, selA, hA + hB, base=P, embed=0.045), 'copper_layer'))
        mask2 = FBM(seed + 9, 3, 1.1)(S.fc / S.R * 1.4)
        selT = rank_select(mask2, 0.0, 0.11) & ~selA
        hT = vh(0.03, 0.04, FBM(seed + 12, 3, 3.0)) * sc
        tris_crust.append(('COPPER_TURQUOISE', crust(S, selT, hT), 'patina_deposit'))
        # layered copper plates (stacked)
        for i, (p, n) in enumerate(S.pick(nf(6), r, weight=np.where(selA, 2.5, 1.0), min_d=0.45 * sc)):
            asp = r.uniform(1.0, 1.4) if variant != 'B' else r.uniform(1.5, 2.0)
            rad = r.uniform(0.14, 0.24) * sc; th = r.uniform(0.035, 0.06) * sc
            g = plate_tris(r, rad, th, npts=int(r.integers(6, 9)), aspect=asp)
            spin = r.uniform(0, TAU) if variant != 'B' else r.normal() * 0.25
            parts.plates.append((f'PLATE_{i+1:02d}', 'COPPER_METAL', g, TRS(p, n, hint_axis, spin, (1, 1, 1))))
            g2 = plate_tris(r, rad * 0.7, th * 0.9, npts=int(r.integers(6, 8)), aspect=asp)
            parts.plates.append((f'PLATE_{i+1:02d}_TOP', 'COPPER_ORANGE', g2, TRS(p + n * th * 1.5, n, hint_axis, spin + 0.4, (1, 1, 1))))
        # turquoise crystal clusters (oxidation crystals)
        lean = 0.75 if variant == 'B' else 0.55
        k = 0
        for cnt, (lo, hi) in [(nf(5), (0.20, 0.30)), (nf(9), (0.10, 0.17))]:
            for p, n in S.pick(cnt, r, weight=np.where(selB | selT, 2.4, 0.8), min_d=0.24 * sc):
                k += 1
                g = crystal_cluster(r, r.uniform(lo, hi) * sc, sides=5, lean=lean, tip=0.25, taper=0.80, slim=0.22)
                n2 = unit(n + 0.6 * hint_axis * np.sign(r.choice([-1, 1, 1]))) if variant == 'B' else n
                parts.clusters.append((f'CLUSTER_{k:02d}', 'COPPER_TURQUOISE' if k % 3 else 'COPPER_DARKTURQ', g, TRS(p, n2, rdir(r), r.uniform(0, TAU), (1, 1, 1))))
        # copper nuggets (blocky)
        for i, (p, n) in enumerate(S.pick(nf(5), r, weight=np.where(selA, 2.5, 0.6), min_d=0.28 * sc)):
            g = crystal_cluster(r, r.uniform(0.12, 0.2) * sc, sides=4, lean=0.5, tip=0.18, taper=0.78, slim=0.30)
            parts.surface.append((f'NUGGET_{i+1:02d}', 'COPPER_ORANGE', g, TRS(p, n, hint_axis, r.uniform(0, TAU), (1, 1, 1))))
        nv = 7 if variant != 'B' else 8
        for i in range(nv):
            idx = int(r.integers(0, len(P)))
            hint = hint_axis if variant == 'B' else rdir(r)
            steps = int(r.integers(14, 26)) if variant != 'B' else int(r.integers(26, 44))
            g = vein_tris(S, r, idx, steps, hint, rad=0.020 * sc, wander=0.3 if variant == 'B' else 0.45)
            parts.veins.append((f'VEIN_{i+1:02d}', 'COPPER_METAL' if i < nv - 3 else 'COPPER_TURQUOISE', g, np.eye(4)))
        if variant == 'C':
            idxs = np.where(meta['crack_g'] > 0.55)[0]
            r.shuffle(idxs); chosen = []
            for ii in idxs:
                if all(np.linalg.norm(P[ii] - P[j]) > 0.20 for j in chosen): chosen.append(ii)
                if len(chosen) >= 10: break
            for i, ii in enumerate(chosen):
                nn = unit(S.vn[ii] * 0.6 + unit(P[ii]) * 0.6)
                g = crystal_cluster(r, r.uniform(0.16, 0.32), sides=5, lean=0.65, tip=0.25, taper=0.80, slim=0.22)
                parts.fracture.append((f'FRACTURE_DEPOSIT_{i+1:02d}', 'COPPER_TURQUOISE' if i % 3 else 'COPPER_ORANGE', g, TRS(P[ii], nn, rdir(r), r.uniform(0, TAU), (1, 1, 1))))
            tris_crust.append(('COPPER_TURQUOISE', crust(S, crack_faces, np.full(len(P), 0.045)), 'fracture_lining'))

    if ore == 'TITANIUM':
        selG = rank_select(mask, 0.0, 0.27)
        selS = rank_select(mask, 0.0, 0.13)
        hG = vh(0.030, 0.040) * sc
        tris_crust.append(('TITAN_BLUEGRAY', crust(S, selG, hG), 'bluegray_deposit'))
        hS = vh(0.035, 0.040, FBM(seed + 8, 3, 3.5)) * sc
        tris_crust.append(('TITAN_SILVER', crust(S, selS, hS + hG, base=P, embed=0.04), 'silver_fracture_layer'))
        # large silver-white plates
        for i, (p, n) in enumerate(S.pick(nf(9), r, weight=np.where(selG, 2.2, 1.0), min_d=0.42 * sc)):
            asp = r.uniform(1.0, 1.35) if variant != 'B' else r.uniform(1.6, 2.2)
            g = plate_tris(r, r.uniform(0.20, 0.34) * sc, r.uniform(0.03, 0.05) * sc, npts=int(r.integers(5, 8)), aspect=asp, irr=0.18)
            spin = r.uniform(0, TAU) if variant != 'B' else r.normal() * 0.25
            parts.plates.append((f'PLATE_{i+1:02d}', 'TITAN_SILVER' if i % 3 else 'TITAN_BLUEGRAY', g, TRS(p, n, hint_axis, spin, (1, 1, 1))))
        # sharp metallic shards (angular, narrow, long tips)
        lean = 0.8 if variant == 'B' else 0.6
        specs = [(nf(6), (0.36, 0.54)), (nf(10), (0.20, 0.30)), (nf(12), (0.10, 0.16))]
        k = 0
        for cnt, (lo, hi) in specs:
            for p, n in S.pick(cnt, r, weight=np.where(selG | selS, 2.2, 1.0), min_d=0.26 * sc * (hi / 0.4 + 0.5)):
                k += 1
                g = crystal_cluster(r, r.uniform(lo, hi) * sc, sides=4, lean=lean, tip=0.42, taper=0.62, slim=0.25)
                n2 = unit(n + 0.6 * hint_axis * np.sign(r.choice([-1, 1, 1]))) if variant == 'B' else n
                mat = ['TITAN_SILVER', 'TITAN_ICEBLUE', 'TITAN_SILVER', 'TITAN_BLUEGRAY'][k % 4]
                parts.clusters.append((f'CLUSTER_{k:02d}', mat, g, TRS(p, n2, rdir(r), r.uniform(0, TAU), (r.uniform(0.9, 1.15), r.uniform(0.9, 1.15), r.uniform(0.9, 1.2)))))
        for i in range(3 if variant != 'B' else 5):
            idx = int(r.integers(0, len(P)))
            hint = hint_axis if variant == 'B' else rdir(r)
            steps = int(r.integers(14, 24)) if variant != 'B' else int(r.integers(26, 40))
            g = vein_tris(S, r, idx, steps, hint, rad=0.016 * sc, wander=0.3 if variant == 'B' else 0.45)
            parts.veins.append((f'VEIN_{i+1:02d}', 'TITAN_SILVER', g, np.eye(4)))
        if variant == 'C':
            idxs = np.where(meta['crack_g'] > 0.55)[0]
            r.shuffle(idxs); chosen = []
            for ii in idxs:
                if all(np.linalg.norm(P[ii] - P[j]) > 0.20 for j in chosen): chosen.append(ii)
                if len(chosen) >= 10: break
            for i, ii in enumerate(chosen):
                nn = unit(S.vn[ii] * 0.6 + unit(P[ii]) * 0.6)
                g = crystal_cluster(r, r.uniform(0.18, 0.36), sides=4, lean=0.65, tip=0.45, taper=0.55, slim=0.17)
                parts.fracture.append((f'FRACTURE_DEPOSIT_{i+1:02d}', 'TITAN_SILVER' if i % 2 else 'TITAN_ICEBLUE', g, TRS(P[ii], nn, rdir(r), r.uniform(0, TAU), (1, 1, 1))))
            tris_crust.append(('TITAN_BLUEGRAY', crust(S, crack_faces, np.full(len(P), 0.04)), 'fracture_lining'))

    def fracture_deposits(mats, sides, tip, taper, slim, lean, lo, hi, count=10, min_d=0.20):
        idxs = np.where(meta['crack_g'] > 0.55)[0]
        r.shuffle(idxs); chosen = []
        for ii in idxs:
            if all(np.linalg.norm(P[ii] - P[j]) > min_d for j in chosen): chosen.append(ii)
            if len(chosen) >= count: break
        for i, ii in enumerate(chosen):
            nn = unit(S.vn[ii] * 0.6 + unit(P[ii]) * 0.6)
            g = crystal_cluster(r, r.uniform(lo, hi), sides=sides, lean=lean, tip=tip, taper=taper, slim=slim)
            parts.fracture.append((f'FRACTURE_DEPOSIT_{i+1:02d}', mats[i % len(mats)], g, TRS(P[ii], nn, rdir(r), r.uniform(0, TAU), (1, 1, 1))))

    if ore == 'SILICON':
        # glassy violet: deep-purple layered deposit under a violet crust, big faceted crystal clusters
        selB = rank_select(mask, 0.0, 0.20)
        selA = rank_select(mask, 0.0, 0.09)
        hB = vh(0.030, 0.035) * sc
        tris_crust.append(('SILICON_DEEP', crust(S, selB, hB), 'deeppurple_layer'))
        hA = vh(0.040, 0.050, FBM(seed + 8, 3, 3.5)) * sc
        tris_crust.append(('SILICON_VIOLET', crust(S, selA, hA + hB, base=P, embed=0.045), 'violet_crust'))
        # a few fractured-glass plates (flat, sharp-edged)
        for i, (p, n) in enumerate(S.pick(nf(4), r, weight=np.where(selB, 2.2, 1.0), min_d=0.5 * sc)):
            asp = r.uniform(1.0, 1.3) if variant != 'B' else r.uniform(1.6, 2.1)
            g = plate_tris(r, r.uniform(0.14, 0.24) * sc, r.uniform(0.025, 0.045) * sc, npts=int(r.integers(5, 7)), aspect=asp, irr=0.2)
            spin = r.uniform(0, TAU) if variant != 'B' else r.normal() * 0.25
            parts.plates.append((f'PLATE_{i+1:02d}', 'SILICON_DEEP' if i % 2 else 'SILICON_VIOLET', g, TRS(p, n, hint_axis, spin, (1, 1, 1))))
        # large + medium + small crystal clusters (hexagonal, sharp tips, pink-lilac accent facets)
        lean = 0.8 if variant == 'B' else 0.55
        specs = [(nf(5), (0.42, 0.62)), (nf(8), (0.24, 0.34)), (nf(10), (0.11, 0.17))]
        k = 0
        for cnt, (lo, hi) in specs:
            for p, n in S.pick(cnt, r, weight=np.where(selA | selB, 2.4, 1.0), min_d=0.28 * sc * (hi / 0.4 + 0.5)):
                k += 1
                g = crystal_cluster(r, r.uniform(lo, hi) * sc, sides=6, lean=lean, tip=0.38, taper=0.74, slim=0.19)
                n2 = unit(n + 0.6 * hint_axis * np.sign(r.choice([-1, 1, 1]))) if variant == 'B' else n
                mat = ['SILICON_VIOLET', 'SILICON_DEEP', 'SILICON_VIOLET', 'SILICON_LILAC'][k % 4]
                parts.clusters.append((f'CLUSTER_{k:02d}', mat, g, TRS(p, n2, rdir(r), r.uniform(0, TAU), (r.uniform(0.9, 1.15), r.uniform(0.9, 1.15), r.uniform(0.9, 1.25)))))
        # embedded raw-crystal masses (blocky)
        for i, (p, n) in enumerate(S.pick(nf(4), r, weight=np.where(selA, 2.5, 0.6), min_d=0.3 * sc)):
            g = crystal_cluster(r, r.uniform(0.12, 0.2) * sc, sides=5, lean=0.4, tip=0.2, taper=0.8, slim=0.30)
            parts.surface.append((f'EMBEDDED_MASS_{i+1:02d}', 'SILICON_DEEP', g, TRS(p, n, hint_axis, r.uniform(0, TAU), (1, 1, 1))))
        for i in range(4 if variant != 'B' else 6):
            idx = int(r.integers(0, len(P)))
            hint = hint_axis if variant == 'B' else rdir(r)
            steps = int(r.integers(14, 24)) if variant != 'B' else int(r.integers(26, 40))
            g = vein_tris(S, r, idx, steps, hint, rad=0.017 * sc, wander=0.3 if variant == 'B' else 0.45)
            parts.veins.append((f'VEIN_{i+1:02d}', 'SILICON_LILAC' if i % 2 else 'SILICON_VIOLET', g, np.eye(4)))
        if variant == 'C':
            fracture_deposits(['SILICON_VIOLET', 'SILICON_LILAC', 'SILICON_DEEP'], 6, 0.40, 0.72, 0.17, 0.65, 0.20, 0.40, 11)
            tris_crust.append(('SILICON_DEEP', crust(S, crack_faces, np.full(len(P), 0.045)), 'fracture_lining'))

    if ore == 'ICE':
        # frozen crust (pale) over layered blue-white ice; cyan only deep in cracks. Rock stays dominant.
        selB = rank_select(mask, 0.0, 0.17)
        selA = rank_select(mask, 0.0, 0.08)
        hB = vh(0.030, 0.035) * sc
        tris_crust.append(('ICE_BLUEWHITE', crust(S, selB, hB), 'layered_ice'))
        hA = vh(0.040, 0.050, FBM(seed + 8, 3, 3.5)) * sc
        tris_crust.append(('ICE_PALE', crust(S, selA, hA + hB, base=P, embed=0.045), 'frozen_crust'))
        # layered ice slabs (stacked: blue base + pale top)
        for i, (p, n) in enumerate(S.pick(nf(5), r, weight=np.where(selB, 2.4, 1.0), min_d=0.5 * sc)):
            asp = r.uniform(1.0, 1.35) if variant != 'B' else r.uniform(1.6, 2.1)
            rad = r.uniform(0.15, 0.26) * sc; th = r.uniform(0.03, 0.05) * sc
            g = plate_tris(r, rad, th, npts=int(r.integers(6, 8)), aspect=asp, irr=0.22)
            spin = r.uniform(0, TAU) if variant != 'B' else r.normal() * 0.25
            parts.plates.append((f'PLATE_{i+1:02d}', 'ICE_BLUEWHITE', g, TRS(p, n, hint_axis, spin, (1, 1, 1))))
            g2 = plate_tris(r, rad * 0.68, th * 0.9, npts=int(r.integers(5, 7)), aspect=asp)
            parts.plates.append((f'PLATE_{i+1:02d}_TOP', 'ICE_PALE', g2, TRS(p + n * th * 1.5, n, hint_axis, spin + 0.4, (1, 1, 1))))
        # large ice formations + sharp frozen shards
        lean = 0.8 if variant == 'B' else 0.6
        specs = [(nf(4), (0.38, 0.56)), (nf(7), (0.22, 0.32)), (nf(10), (0.10, 0.16))]
        k = 0
        for cnt, (lo, hi) in specs:
            for p, n in S.pick(cnt, r, weight=np.where(selA | selB, 2.4, 0.9), min_d=0.28 * sc * (hi / 0.4 + 0.5)):
                k += 1
                shard = (k % 3 == 0)
                g = crystal_cluster(r, r.uniform(lo, hi) * sc, sides=5 if shard else 6, lean=lean, tip=0.45 if shard else 0.30,
                                    taper=0.62 if shard else 0.80, slim=0.17 if shard else 0.22)
                n2 = unit(n + 0.6 * hint_axis * np.sign(r.choice([-1, 1, 1]))) if variant == 'B' else n
                mat = ['ICE_BLUEWHITE', 'ICE_PALE', 'ICE_BLUEWHITE', 'ICE_CYAN'][k % 4]
                parts.clusters.append((f'CLUSTER_{k:02d}', mat, g, TRS(p, n2, rdir(r), r.uniform(0, TAU), (r.uniform(0.9, 1.15), r.uniform(0.9, 1.15), r.uniform(0.9, 1.25)))))
        # frozen blobs (rounded rime lumps)
        for i, (p, n) in enumerate(S.pick(nf(4), r, weight=np.where(selB, 2.0, 0.7), min_d=0.35 * sc)):
            g = blob_tris(r, r.uniform(0.16, 0.28) * sc, seed + 40 + i)
            parts.surface.append((f'RIME_BLOB_{i+1:02d}', 'ICE_PALE', g, TRS(p, n, rdir(r), r.uniform(0, TAU), (1, 1, 1))))
        for i in range(3 if variant != 'B' else 5):
            idx = int(r.integers(0, len(P)))
            hint = hint_axis if variant == 'B' else rdir(r)
            steps = int(r.integers(14, 24)) if variant != 'B' else int(r.integers(26, 40))
            g = vein_tris(S, r, idx, steps, hint, rad=0.017 * sc, wander=0.3 if variant == 'B' else 0.45)
            parts.veins.append((f'VEIN_{i+1:02d}', 'ICE_CYAN', g, np.eye(4)))
        if variant == 'C':
            fracture_deposits(['ICE_CYAN', 'ICE_BLUEWHITE', 'ICE_PALE'], 6, 0.38, 0.76, 0.18, 0.65, 0.18, 0.38, 10)
            tris_crust.append(('ICE_CYAN', crust(S, crack_faces, np.full(len(P), 0.04)), 'fracture_lining'))

    for matn, tr, tag in tris_crust:
        if len(tr):
            parts.surface.append((f'CRUST_{tag.upper()}', matn, tr, np.eye(4)))
    return name, parts

def assemble(scene, name, parts, offset):
    root = name
    T = np.eye(4); T[:3, 3] = offset
    scene.graph.update(frame_to=root, frame_from='world', matrix=T)
    groups = {'ROCK_BODY': None, 'MINERAL_CLUSTERS': parts.clusters, 'MINERAL_PLATES': parts.plates,
              'MINERAL_VEINS': parts.veins, 'FRACTURE_DETAILS': parts.fracture, 'OPTIONAL_SURFACE_DETAILS': parts.surface}
    gk = f'{name}_ROCK_BODY_mesh'
    scene.geometry[gk] = parts.rock
    scene.graph.update(frame_to=f'{name}_ROCK_BODY', frame_from=root, matrix=np.eye(4), geometry=gk)
    for gname, items in groups.items():
        if gname == 'ROCK_BODY' or not items: continue
        node = f'{name}_{gname}'
        scene.graph.update(frame_to=node, frame_from=root, matrix=np.eye(4))
        for (iname, mat, g, M) in items:
            m = flat_mesh(g, mat, f'{name}_{iname}')
            key = f'{name}_{gname}_{iname}_mesh'
            scene.geometry[key] = m
            scene.graph.update(frame_to=f'{name}_{iname}', frame_from=node, matrix=M, geometry=key)

def build_scene(ores=('IRON', 'NICKEL'), lod=0):
    scene = trimesh.Scene()
    stats = {}
    for ri, ore in enumerate(ores):
        for ci, v in enumerate('ABC'):
            name, parts = build(ore, v, lod)
            assemble(scene, name, parts, np.array([(ci - 1) * 6.0, 0, ri * 6.0]))
            stats[name] = parts
    return scene, stats


# ------------------------------------------------------------------ Spiel-Export (kompakt, Vertexfarben)
import base64, hashlib

def tri_colors(tris, matname, rng):
    base = hexrgb(MAT_DEF[matname][0])
    j = 1 + (rng.random(len(tris)) - 0.5) * (0.30 if matname == 'ROCK_DARK' else 0.16)
    return np.clip(base[None, :] * j[:, None], 0, 1)

def game_record(name, parts):
    rng = np.random.default_rng(abs(hash(name)) % (2 ** 31)) if False else np.random.default_rng(sum(map(ord, name)))
    T, C = [], []
    rock = parts.rock.vertices[parts.rock.faces]
    T.append(rock); C.append(tri_colors(rock, 'ROCK_DARK', rng))
    for items in (parts.clusters, parts.plates, parts.veins, parts.fracture, parts.surface):
        for (iname, mat, g, M) in items:
            t = apply(g, M) if len(g) else np.zeros((0, 3, 3))
            if len(t): T.append(t); C.append(tri_colors(t, mat, rng))
    T = np.concatenate(T); C = np.concatenate(C)
    a = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); T = T[np.linalg.norm(a, axis=1) > 1e-9]; C = C[np.linalg.norm(a, axis=1) > 1e-9]
    ctr = (T.reshape(-1, 3).max(0) + T.reshape(-1, 3).min(0)) / 2
    T = T - ctr
    rms = math.sqrt((np.linalg.norm(parts.rock.vertices - ctr, axis=1) ** 2).mean())
    T = T / rms
    ext = float(np.abs(T).max())
    q = np.round(T.reshape(-1, 3) / ext * 32767).astype('<i2')
    c = np.round(C * 255).astype(np.uint8)
    return {'name': name, 'tris': int(len(T)), 'ext': round(ext, 4),
            'pos': base64.b64encode(q.tobytes()).decode(), 'col': base64.b64encode(c.tobytes()).decode()}

def export_game(phase_ores, path_json):
    import os
    data = {'v': 1, 'ores': {}}
    if os.path.exists(path_json):
        data = json.load(open(path_json))
    for ore in phase_ores:
        recs = []
        for v in 'ABC':
            name, parts = build(ore, v, lod=1)
            recs.append(game_record(name, parts))
        data['ores'][GAME_ID[ore]] = recs
    json.dump(data, open(path_json, 'w'), separators=(',', ':'))
    return data

if __name__ == '__main__':
    phase = int(sys.argv[1])
    ores = PHASES[phase]
    if any(o not in ORE_SEED for o in ores):
        sys.exit('Phase %d noch nicht gebaut.' % phase)
    scene, stats = build_scene(ores, 0)
    out = sys.argv[2] if len(sys.argv) > 2 else '.'
    scene.export(f'{out}/{PHASE_FILE[phase]}.glb')
    print('GLB ok')
    d = export_game(ores, sys.argv[3] if len(sys.argv) > 3 else f'{out}/ore_asteroids.json')
    for o in ores:
        print(o, [r['tris'] for r in d['ores'][GAME_ID[o]]])

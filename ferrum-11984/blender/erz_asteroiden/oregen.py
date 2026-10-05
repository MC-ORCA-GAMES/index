import numpy as np, trimesh, math
from scipy.spatial import cKDTree
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals

TAU = 2 * math.pi
CFG = {'lod': 0}   # 0 = hohe Detailstufe (GLB), 1 = Spielversion (schlanker)

# ---------------------------------------------------------------- materials
def srgb2lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0

# name: (hex, metallic, roughness)   -- NO emissive anywhere
MAT_DEF = {
    'ROCK_DARK':          ('#2B2D30', 0.05, 0.93),
    'IRON_CRUST_ORANGE':  ('#FF6A28', 0.45, 0.62),
    'IRON_DEEP_REDBROWN': ('#B4532A', 0.35, 0.78),
    'IRON_METAL_GRAY':    ('#8B8F93', 0.92, 0.34),
    'NICKEL_MINT':        ('#A7F3C4', 0.20, 0.10),
    'NICKEL_GREEN':       ('#68BF7A', 0.30, 0.18),
    'NICKEL_GRAYGREEN':   ('#7B8C80', 0.75, 0.26),
    'COPPER_ORANGE':      ('#F58A30', 0.85, 0.38),
    'COPPER_METAL':       ('#F58A30', 0.95, 0.24),
    'COPPER_TURQUOISE':   ('#2ECAC7', 0.10, 0.52),
    'COPPER_DARKTURQ':    ('#168A6A', 0.08, 0.62),
    'TITAN_SILVER':       ('#E6F2FF', 0.95, 0.16),
    'TITAN_ICEBLUE':      ('#7FB6E6', 0.85, 0.20),
    'TITAN_BLUEGRAY':     ('#80C0EB', 0.80, 0.28),
    'SILICON_VIOLET':     ('#C084FC', 0.05, 0.08),
    'SILICON_DEEP':       ('#6D28D9', 0.05, 0.12),
    'SILICON_LILAC':      ('#E0A8FF', 0.10, 0.06),
    'ICE_BLUEWHITE':      ('#7FD3FF', 0.00, 0.06),
    'ICE_CYAN':           ('#4EC5F8', 0.00, 0.10),
    'ICE_PALE':           ('#CFEFFF', 0.00, 0.22),
}

def make_mat(name):
    hx, met, rough = MAT_DEF[name]
    lin = srgb2lin(hexrgb(hx))
    m = PBRMaterial(name=name, baseColorFactor=[*lin, 1.0], metallicFactor=met,
                    roughnessFactor=rough, alphaMode='OPAQUE', doubleSided=False)
    return m

# ---------------------------------------------------------------- helpers
def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

class FBM:
    def __init__(s, seed, octaves=3, base=1.0, gain=0.5, n=7):
        r = np.random.default_rng(seed)
        s.L = []
        for o in range(octaves):
            k = r.normal(size=(n, 3)); k /= np.linalg.norm(k, axis=1, keepdims=True)
            k *= base * 2 ** o * TAU
            s.L.append((k, r.uniform(0, TAU, n), gain ** o))
        s.norm = math.sqrt(sum(a * a for _, _, a in s.L)) * 0.7071
    def __call__(s, P):
        tot = 0
        for k, ph, a in s.L:
            tot = tot + a * np.sin(P @ k.T + ph).sum(1) / math.sqrt(len(ph))
        return tot / s.norm

def rdir(r):
    v = r.normal(size=3); return v / np.linalg.norm(v)

def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v)
    return v / n if n > 1e-12 else np.array([0.0, 0.0, 1.0])

def frame_R(n, hint, spin=0.0):
    n = unit(n); t = np.asarray(hint, float) - n * (np.asarray(hint, float) @ n)
    if np.linalg.norm(t) < 1e-6:
        t = np.cross(n, [0.3, 0.9, 0.1])
    t = unit(t); b = np.cross(n, t)
    R = np.eye(4); R[:3, 0] = t; R[:3, 1] = b; R[:3, 2] = n
    c, s_ = math.cos(spin), math.sin(spin)
    Rz = np.eye(4); Rz[:2, :2] = [[c, -s_], [s_, c]]
    return R @ Rz

def TRS(p, n, hint, spin, scl):
    T = np.eye(4); T[:3, 3] = p
    S = np.diag([scl[0], scl[1], scl[2], 1.0])
    return T @ frame_R(n, hint, spin) @ S

def flat_mesh(tris, mat_name, name):
    """tris: (m,3,3) triangle soup -> non-indexed (flat-shaded) Trimesh with PBR material"""
    tris = np.asarray(tris, float).reshape(-1, 3, 3)
    # drop degenerate triangles
    a = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    tris = tris[np.linalg.norm(a, axis=1) > 1e-9]
    V = tris.reshape(-1, 3)
    F = np.arange(len(V)).reshape(-1, 3)
    m = trimesh.Trimesh(V, F, process=False)
    m.visual = TextureVisuals(uv=np.zeros((len(V), 2)), material=make_mat(mat_name))
    m.metadata['name'] = name
    return m

def quad(a, b, c, d):
    return [[a, b, c], [a, c, d]]

# ---------------------------------------------------------------- rock bodies
def plane_cut(P, planes, k=0.9):
    P = P.copy()
    for n, d in planes:
        s = P @ n
        over = np.maximum(s - d, 0)
        P -= np.outer(over * k, n)
    return P

def lumps(d, r, n_up, n_dn, amp_up, amp_dn, s_up=0.18, s_dn=0.10):
    out = np.zeros(len(d))
    for _ in range(n_up):
        c = rdir(r); out += amp_up * r.uniform(0.6, 1.2) * np.exp(-(1 - d @ c) / s_up)
    for _ in range(n_dn):
        c = rdir(r); out -= amp_dn * r.uniform(0.6, 1.2) * np.exp(-(1 - d @ c) / s_dn)
    return out

def body_A(seed, sub=4):
    r = np.random.default_rng(seed)
    d = trimesh.creation.icosphere(subdivisions=sub).vertices.copy()
    f1, f2 = FBM(seed + 1, 3, 0.65), FBM(seed + 2, 3, 2.0, 0.55)
    rad = 1 + 0.17 * f1(d) + 0.05 * f2(d) + lumps(d, r, 4, 3, 0.20, 0.22)
    P = d * rad[:, None] * np.array([1.0, 0.86, 0.94])
    planes = [(rdir(r), 0.80), (rdir(r), 0.84), (rdir(r), 0.78)]
    P = plane_cut(P, planes)
    P += d * (0.025 * f2(d))[:, None]
    return P, {}

def body_B(seed, sub=4):
    r = np.random.default_rng(seed)
    d = trimesh.creation.icosphere(subdivisions=sub).vertices.copy()
    f1 = FBM(seed + 1, 3, 0.8)
    f2 = FBM(seed + 2, 3, 2.2, 0.5)
    ds = d * np.array([0.45, 1.0, 1.0])
    rad = 1 + 0.10 * f1(ds) + 0.035 * f2(ds)
    ang = np.arctan2(d[:, 2], d[:, 1])
    rad *= 1 + 0.085 * np.sin(4 * ang + 2.4 * d[:, 0] + r.uniform(0, TAU))
    # long grooves running along the length
    for _ in range(2):
        a0 = r.uniform(-math.pi, math.pi); x0 = r.uniform(-0.3, 0.3)
        da = np.angle(np.exp(1j * (ang - a0)))
        rad -= 0.20 * np.exp(-da ** 2 / 0.06) * np.exp(-(d[:, 0] - x0) ** 2 / 0.35)
    L = 1.9
    P = d * rad[:, None] * np.array([L, 0.64, 0.74])
    t = P[:, 0] / L
    P[:, 1:] *= (1 - 0.32 * t)[:, None]          # taper
    P[:, 1] += 0.24 * t ** 2                     # slight bend
    # prismatic cleavage planes around the long axis
    planes = []
    for a in r.uniform(0, TAU, 4):
        n = unit([r.uniform(-0.2, 0.2), math.cos(a), math.sin(a)])
        planes.append((n, 0.48 * r.uniform(0.9, 1.05)))
    P = plane_cut(P, planes)
    P += d * (0.02 * f2(ds))[:, None]
    return P, {'axis': np.array([1.0, 0, 0])}

def body_C(seed, sub=5):
    r = np.random.default_rng(seed)
    d = trimesh.creation.icosphere(subdivisions=sub).vertices.copy()
    f1, f2 = FBM(seed + 1, 3, 0.65), FBM(seed + 2, 3, 2.0, 0.55)
    rad = 1 + 0.14 * f1(d) + 0.045 * f2(d) + lumps(d, r, 3, 1, 0.16, 0.16)
    P = d * rad[:, None] * np.array([1.05, 0.92, 1.0])
    # missing chunk (flat-ish fracture face) + secondary break
    P = plane_cut(P, [(unit([0.7, -0.55, 0.3]), 0.70), (unit([-0.4, 0.8, -0.3]), 0.82)], 0.92)
    # major crack: jagged, widening, running over top/front, intact toward back/bottom
    n = unit([0.20, 0.06, 0.98]); n = unit([n[2], n[1], -n[0]])  # normal ~ along X
    fj = FBM(seed + 5, 3, 1.4, 0.6)
    q = unit([0, 0.35, 0.94])
    m = smoothstep(-0.75, 0.15, P @ q)
    dist = P @ n - 0.09 * fj(P) - 0.05 * P[:, 1]
    w = 0.25 + 0.06 * fj(P * 1.7)
    g = np.clip(1 - np.abs(dist) / w, 0, 1) ** 0.6 * m
    P = P * (1 - 0.68 * g)[:, None]
    P += np.outer(0.11 * smoothstep(-0.10, 0.10, dist) * m, n)    # one side slightly displaced
    P += d * (0.012 * f2(d))[:, None]
    return P, {'crack_g': g, 'crack_n': n}

# ---------------------------------------------------------------- surface info
class Surface:
    def __init__(s, V, F):
        s.V, s.F = V, F
        tm = trimesh.Trimesh(V, F, process=False)
        s.vn = tm.vertex_normals.copy()
        s.fn = tm.face_normals.copy()
        s.fc = tm.triangles_center.copy()
        s.area = tm.area_faces.copy()
        s.tree = cKDTree(V)
        s.ftree = cKDTree(s.fc)
        s.R = np.linalg.norm(V, axis=1).max()
    def pick(s, n, r, weight=None, min_d=0.2, tries=400, mask=None):
        w = s.area.copy()
        if weight is not None: w = w * weight
        if mask is not None: w = w * mask
        w = w / w.sum()
        pts = []
        for _ in range(tries):
            if len(pts) >= n: break
            i = r.choice(len(w), p=w)
            p = s.fc[i]
            if all(np.linalg.norm(p - q[0]) > min_d for q in pts):
                nn = unit(s.fn[i] + s.vn[F_first(s, i)] * 0.6)
                pts.append((p, nn))
        return pts

def F_first(s, i):
    return s.F[i][0]

def boundary_skirt(Vtop, Vlow, sel_faces):
    ed = np.concatenate([sel_faces[:, [0, 1]], sel_faces[:, [1, 2]], sel_faces[:, [2, 0]]])
    key = np.sort(ed, axis=1)
    _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    bnd = ed[cnt[inv.ravel()] == 1]
    tris = []
    for a, b in bnd:
        tris += quad(Vtop[a], Vlow[a], Vlow[b], Vtop[b])
    return tris

def crust(S, face_sel, h_v, base=None, embed=0.03):
    """Surface-conforming raised crust patch (real geometry, extruded out of the rock)."""
    base = S.V if base is None else base
    sel = S.F[face_sel]
    if len(sel) == 0: return np.zeros((0, 3, 3))
    top = base + S.vn * h_v[:, None]
    low = base - S.vn * embed
    tris = list(top[sel])
    tris += boundary_skirt(top, low, sel)
    return np.array(tris)

def rank_select(mask_vals, frac_lo, frac_hi):
    """faces whose mask rank lies in [frac_lo, frac_hi] from the top"""
    order = np.argsort(-mask_vals)
    N = len(order)
    sel = np.zeros(N, bool)
    sel[order[int(frac_lo * N):int(frac_hi * N)]] = True
    return sel

# ---------------------------------------------------------------- mineral components (local space, z = growth axis)
def crystal_tris(r, length, rad, sides=6, taper=0.82, tip=0.30, irr=0.14, embed=0.35, apex_off=0.25):
    ang = np.linspace(0, TAU, sides, endpoint=False) + r.uniform(0, 0.6)
    rr = rad * (1 + r.uniform(-irr, irr, sides))
    z0, z1, z2 = -embed * length, length * (1 - tip), length
    B = np.stack([rr * np.cos(ang), rr * np.sin(ang), np.full(sides, z0)], 1)
    T = np.stack([rr * taper * np.cos(ang), rr * taper * np.sin(ang), np.full(sides, z1) + r.uniform(-0.03, 0.03, sides) * length], 1)
    ap = np.array([r.uniform(-1, 1) * rad * apex_off, r.uniform(-1, 1) * rad * apex_off, z2])
    tris = []
    for i in range(sides):
        j = (i + 1) % sides
        tris += quad(B[i], B[j], T[j], T[i])
        tris.append([T[i], T[j], ap])
        if CFG['lod'] == 0: tris.append([np.array([0, 0, z0]), B[j], B[i]])
    return tris

def apply(tris, M):
    t = np.asarray(tris, float).reshape(-1, 3)
    return (t @ M[:3, :3].T + M[:3, 3]).reshape(-1, 3, 3)

def tilt_M(az, tilt, off):
    c, s = math.cos(tilt), math.sin(tilt)
    Rt = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    ca, sa = math.cos(az), math.sin(az)
    Rz = np.array([[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]])
    M = np.eye(4); M[:3, :3] = Rz @ Rt; M[:3, 3] = off
    return M

def crystal_cluster(r, size, sides=6, lean=0.55, tip=0.30, taper=0.82, slim=0.17, embed=0.35):
    """size = height of the dominant crystal"""
    tris = []
    n = r.integers(4, 8) if size > 0.3 else r.integers(3, 5)
    tris += crystal_tris(r, size, size * slim, sides, taper, tip, embed=embed)
    keep = [len(tris)]
    for i in range(n):
        az = r.uniform(0, TAU)
        ln = size * r.uniform(0.35, 0.85)
        tl = r.uniform(0.15, lean)
        off = np.array([math.cos(az), math.sin(az), 0]) * size * r.uniform(0.12, 0.30)
        c = crystal_tris(r, ln, ln * slim * r.uniform(0.9, 1.3), int(r.choice([5, 6, 6, 7])) if sides >= 5 else sides, taper, tip, embed=embed)
        tris += list(apply(c, tilt_M(az, tl, off)))
        keep.append(len(tris))
    if CFG['lod'] >= 1 and n > 3:
        tris = tris[:keep[3]]          # Spielversion: Hauptkristall + 3 Nebenkristalle
    return np.array(tris)

def plate_tris(r, rad, thick, npts=9, aspect=1.0, irr=0.25):
    ang = np.sort(np.linspace(0, TAU, npts, endpoint=False) + r.uniform(-0.25, 0.25, npts))
    rr = rad * (1 + r.uniform(-irr, irr, npts))
    ring = lambda sc, z: np.stack([rr * sc * np.cos(ang) * aspect, rr * sc * np.sin(ang), z], 1)
    sink = thick + 0.10 * rad
    B = ring(1.0, np.full(npts, -sink))
    M1 = ring(1.0, np.full(npts, thick * 0.35))
    T = ring(0.80, thick * (0.9 + 0.25 * r.uniform(-1, 1, npts)))
    cen = np.array([0, 0, thick * 1.15])
    tris = []
    for i in range(npts):
        j = (i + 1) % npts
        tris += quad(B[i], B[j], M1[j], M1[i])
        tris += quad(M1[i], M1[j], T[j], T[i])
        tris.append([T[i], T[j], cen])
    return np.array(tris)

def blob_tris(r, rad, seed):
    ico = trimesh.creation.icosphere(subdivisions=2)
    d = ico.vertices
    f = FBM(seed, 2, 1.3)
    P = d * (rad * (1 + 0.16 * f(d)))[:, None] * np.array([1, 1, 0.8])
    P[:, 2] -= rad * 0.35
    return P[ico.faces]

def vein_tris(S, r, start_idx, length_steps, hint, step=0.055, rad=0.022, sides=5, lift=0.006, wander=0.35):
    p = S.V[start_idx].copy(); h = unit(np.asarray(hint, float) + rdir(r) * wander)
    pts = [p]; i = start_idx
    for _ in range(length_steps):
        nn = S.vn[i]
        h = h - nn * (h @ nn); h = unit(h + rdir(r) * wander * 0.5)
        q = pts[-1] + h * step
        _, i = S.tree.query(q)
        pts.append(S.V[i].copy())
    pts = np.array(pts)
    # smooth
    ker = np.ones(5) / 5
    sm = np.stack([np.convolve(np.pad(pts[:, k], 2, mode='edge'), ker, mode='valid') for k in range(3)], 1)
    if CFG['lod'] >= 1:
        sm = sm[::2]; sides = 3
    # lift along local normal
    _, ids = S.tree.query(sm)
    sm = sm + S.vn[ids] * lift
    N = len(sm)
    rings = []
    taper = np.sin(np.linspace(0.15, math.pi - 0.15, N)) ** 0.6
    rn = rad * (0.75 + 0.5 * r.random(N)) * taper
    for k in range(N):
        t = sm[min(k + 1, N - 1)] - sm[max(k - 1, 0)]
        t = unit(t); nn = S.vn[ids[k]]
        b1 = unit(np.cross(t, nn)); b2 = unit(np.cross(t, b1))
        ring = [sm[k] + (b1 * math.cos(a) + b2 * math.sin(a)) * rn[k] for a in np.linspace(0, TAU, sides, endpoint=False)]
        rings.append(np.array(ring))
    tris = []
    for k in range(N - 1):
        for i in range(sides):
            j = (i + 1) % sides
            tris += quad(rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i])
    return np.array(tris)

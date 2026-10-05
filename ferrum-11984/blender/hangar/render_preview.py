"""Vorschau des Hangars (Painter-Algorithmus, ohne Blender). Nutzung: python3 render_preview.py hangar.obj vorschau.png
Zeigt: OBEN, ISO (vom Tor), PAD-Nahansicht, KLAMMER-AUSSPARUNG und das Querschnittsprofil (nur als Linie)."""
import sys, json, os, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

def load(path):
    mtl, cur = {}, None
    for l in open(path.rsplit(".", 1)[0] + ".mtl"):
        p = l.split()
        if p and p[0] == "newmtl": cur = p[1]
        elif p and p[0] == "Kd": mtl[cur] = tuple(map(float, p[1:4]))
    V, F, C = [], [], []; cm = (.5, .5, .5)
    for l in open(path):
        p = l.split()
        if not p: continue
        if p[0] == "v": V.append(tuple(map(float, p[1:4])))
        elif p[0] == "usemtl": cm = mtl.get(p[1], cm)
        elif p[0] == "f": F.append([int(x.split("/")[0]) - 1 for x in p[1:]]); C.append(cm)
    return np.array(V), F, C

def rotm(az, tilt):
    """az um Z, tilt = Kippung der Kamera aus der Draufsicht (0 = von oben, 90 = waagrecht, Blick von -Y ins Tor hinein).
    Rueckgabe: Weltkoordinate -> (rechts, oben, Tiefe zur Kamera)"""
    a, t = np.radians(az), np.radians(tilt)
    Rz = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    Rx = np.array([[1, 0, 0], [0, np.cos(t), np.sin(t)], [0, -np.sin(t), np.cos(t)]])
    return Rx @ Rz

def view(ax, V, F, C, R, title, box=None):
    W = V @ R.T
    L = np.array([0.35, 0.45, 0.82]); L /= np.linalg.norm(L); Lw = L
    polys, cols, dep = [], [], []
    for f, c in zip(F, C):
        P = W[f]
        if box is not None:
            m = P[:, :2].mean(0)
            if not (box[0] <= m[0] <= box[1] and box[2] <= m[1] <= box[3]): continue
        n = np.cross(P[1] - P[0], P[2] - P[0]); ln = np.linalg.norm(n)
        if ln < 1e-9: continue
        n /= ln
        if n[2] < 0: continue
        sh = 0.40 + 0.60 * max(0, n @ Lw)
        polys.append(P[:, :2]); cols.append(np.clip(np.array(c) * sh * 1.6 + 0.02, 0, 1)); dep.append(-1e6 if max(c) < 0.06 and c != (0.03, 0.03, 0.035) else P[:, 2].mean())
    o = np.argsort(dep)
    ax.add_collection(PolyCollection([polys[i] for i in o], facecolors=[cols[i] for i in o], edgecolors="none", linewidths=0, antialiaseds=False))
    if box: ax.set_xlim(box[0], box[1]); ax.set_ylim(box[2], box[3])
    else:
        allp = np.concatenate(polys); ax.set_xlim(allp[:, 0].min() * 1.03, allp[:, 0].max() * 1.03); ax.set_ylim(allp[:, 1].min() * 1.03, allp[:, 1].max() * 1.03)
    ax.set_aspect("equal"); ax.axis("off"); ax.set_facecolor("#0b1424"); ax.set_title(title, color="#6fb6ff", fontsize=10)

def profile(ax, par):
    pr = np.array(par["profile_half"], float); half = np.concatenate([pr, pr[::-1] * [-1, 1]])
    bay = par["bay_width"]; ax.plot(half[:, 0], half[:, 1], color="#c9a24a", lw=2)
    ax.plot([-pr[0, 0] - bay, pr[0, 0] + bay], [0, 0], color="#8b8f93", lw=2)
    ax.plot([-pr[0, 0], pr[0, 0]], [0, 0], color="#c9a24a", lw=2)
    r = par["pad_diameter"] / 2; ax.plot([-r, r], [0.15, 0.15], color="#ff9a3a", lw=3)
    for a in par["clamp_angles_deg"][:2]:
        ax.plot([par["clamp_radius"] * np.cos(np.radians(a))] * 2, [0, par["clamp_max_height"]], color="#4fa6ff", lw=3)
    ax.set_aspect("equal"); ax.set_title("QUERSCHNITT (Profil, Pad, Klammerhoehe)", color="#6fb6ff", fontsize=10); ax.set_facecolor("#0b1424")
    ax.tick_params(colors="#6fb6ff"); [s.set_color("#335") for s in ax.spines.values()]

if __name__ == "__main__":
    V, F, C = load(sys.argv[1]); par = json.load(open(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "hangar_params.json")))
    print("Verts", len(V), "Faces", len(F), "BBox", V.min(0).round(1), V.max(0).round(1))
    fig, axs = plt.subplots(2, 3, figsize=(24, 15), facecolor="#0b1424")
    view(axs[0, 0], V, F, C, rotm(0, 0), "OBEN (Gate unten)")
    view(axs[0, 1], V, F, C, rotm(0, 55), "VOM TOR, 3/4 von oben")
    view(axs[0, 2], V, F, C, rotm(0, 78), "VOM TOR, flach (Blick ueber den Boden)")
    # Pad-Nahansicht und Klammer-Aussparung (Zoom ueber Ausschnitt)
    view(axs[1, 0], V, F, C, rotm(0, 0), "LANDEPLATZ (Draufsicht)", box=(-20, 20, -20, 20))
    R = rotm(-35, 50); c = R @ np.array([9 * np.cos(np.pi / 4), 9 * np.sin(np.pi / 4), 0])
    view(axs[1, 1], V, F, C, R, "KLAMMER-AUSSPARUNG (Nahansicht)", box=(c[0] - 5, c[0] + 5, c[1] - 4, c[1] + 4))
    profile(axs[1, 2], par)
    plt.tight_layout(); plt.savefig(sys.argv[2], dpi=60, facecolor=fig.get_facecolor())

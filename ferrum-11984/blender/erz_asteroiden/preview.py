import numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from oregen import MAT_DEF, hexrgb

def collect(scene, prefix):
    tris, cols, isore = [], [], []
    for node in scene.graph.nodes_geometry:
        if not node.startswith(prefix + '_'): continue
        T, gk = scene.graph[node]
        g = scene.geometry[gk]
        V = g.vertices @ T[:3, :3].T + T[:3, 3]
        t = V[g.faces]
        # undo asteroid offset so views are centred
        mat = g.visual.material.name
        tris.append(t)
        cols.append(np.tile(hexrgb(MAT_DEF[mat][0]), (len(t), 1)) * 1.0)
        isore.append(np.full(len(t), mat != 'ROCK_DARK'))
        # metallic flag
        cols[-1] = np.hstack([cols[-1], np.full((len(t), 1), MAT_DEF[mat][1]), np.full((len(t), 1), MAT_DEF[mat][2])])
    return np.concatenate(tris), np.concatenate(cols), np.concatenate(isore)

VIEWS = {  # name: (right axis, up axis, view dir toward camera)
    'FRONT': (np.array([1, 0, 0]), np.array([0, 1, 0]), np.array([0, 0, 1])),
    'SIDE':  (np.array([0, 0, -1]), np.array([0, 1, 0]), np.array([1, 0, 0])),
    'TOP':   (np.array([1, 0, 0]), np.array([0, 0, -1]), np.array([0, 1, 0])),
}

def render(ax, tris, cols, isore, view, ratio_out=None, lim=2.6):
    right, up, toc = VIEWS[view]
    c = tris.reshape(-1, 3).mean(0)
    t = tris - c
    x = t @ right; y = t @ up; z = t @ toc
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]); nl = np.linalg.norm(n, axis=1) + 1e-12
    n = n / nl[:, None]
    facing = (n @ toc) > -0.05
    depth = z.mean(1)
    order = np.argsort(depth)
    order = order[facing[order]]
    light = np.array([0.45, 0.75, 0.55]); light = light / np.linalg.norm(light)
    diff = np.clip(n @ light, 0, 1)
    base = cols[:, :3]; met = cols[:, 3:4]; rough = cols[:, 4:5]
    h = (light + toc); h = h / np.linalg.norm(h)
    spec = np.clip(n @ h, 0, 1) ** (6 + 60 * (1 - rough[:, 0]))
    shade = (0.28 + 0.85 * diff)[:, None] * base * (1 - 0.22 * met) + (0.22 * (1 - rough) * spec[:, None]) * (0.3 + 0.7 * met) + 0.05
    shade = np.clip(shade, 0, 1)
    polys = np.stack([x, y], axis=2)
    pc = PolyCollection(polys[order], facecolors=shade[order], edgecolors='none', linewidths=0)
    ax.add_collection(pc)
    ax.set_xlim(-lim, lim); ax.set_ylim(-lim, lim); ax.set_aspect('equal'); ax.axis('off')
    ax.set_facecolor('#0a1424')
    return polys[order], isore[order]

def ratio_for(tris, cols, isore, view, res=300, lim=2.6):
    """painter-order rasterisation -> ore fraction of visible pixels"""
    fig = plt.figure(figsize=(3, 3), dpi=res // 3)
    ax = fig.add_axes([0, 0, 1, 1])
    right, up, toc = VIEWS[view]
    c = tris.reshape(-1, 3).mean(0); t = tris - c
    x = t @ right; y = t @ up; z = t @ toc
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]); n = n / (np.linalg.norm(n, axis=1)[:, None] + 1e-12)
    facing = (n @ toc) > -0.05
    order = np.argsort(z.mean(1)); order = order[facing[order]]
    polys = np.stack([x, y], axis=2)[order]
    fc = np.where(isore[order][:, None], [[1, 1, 1]], [[0.0, 0, 0]])
    ax.add_collection(PolyCollection(polys, facecolors=fc, edgecolors='none', linewidths=0, antialiaseds=False))
    ax.set_xlim(-lim, lim); ax.set_ylim(-lim, lim); ax.axis('off'); fig.patch.set_facecolor('#808080')
    fig.canvas.draw()
    img = np.asarray(fig.canvas.buffer_rgba())[:, :, :3].astype(float)
    plt.close(fig)
    ore = (img[:, :, 0] > 200).sum(); rock = (img[:, :, 0] < 50).sum()
    return ore / max(ore + rock, 1)

def sheet(scene, names, out, ratios=None):
    fig, axes = plt.subplots(len(names), 3, figsize=(10.5, 3.5 * len(names)), facecolor='#0a1424')
    axes = np.atleast_2d(axes)
    res = {}
    for i, nm in enumerate(names):
        tris, cols, isore = collect(scene, nm)
        rr = []
        for j, v in enumerate(['FRONT', 'SIDE', 'TOP']):
            lim = 1.8 if not nm.endswith('_B') else 2.8
            render(axes[i, j], tris, cols, isore, v, lim=lim)
            axes[i, j].set_title(f'{nm} {v}', color='#6fb6ff', fontsize=9)
            rr.append(ratio_for(tris, cols, isore, v, lim=lim))
        res[nm] = rr
    fig.tight_layout()
    fig.savefig(out, dpi=110, facecolor='#0a1424')
    plt.close(fig)
    return res

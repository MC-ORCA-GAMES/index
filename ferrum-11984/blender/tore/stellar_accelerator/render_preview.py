"""Orthografische Vorschau (Front/Seite/Oben/Iso) der OBJ per Painter-Algorithmus. Nutzung: python3 render_preview.py in.obj out.png"""
import sys, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

def load(path):
    mtl = {}
    cur = None
    for l in open(path.rsplit(".",1)[0]+".mtl"):
        p = l.split()
        if p and p[0]=="newmtl": cur=p[1]
        elif p and p[0]=="Kd": mtl[cur]=tuple(map(float,p[1:4]))
    V=[]; F=[]; C=[]; cm=(.5,.5,.5)
    for l in open(path):
        p=l.split()
        if not p: continue
        if p[0]=="v": V.append(tuple(map(float,p[1:4])))
        elif p[0]=="usemtl": cm=mtl.get(p[1],cm)
        elif p[0]=="f": F.append([int(x.split("/")[0])-1 for x in p[1:]]); C.append(cm)
    return np.array(V),F,C

def view(ax,V,F,C,R,title):
    W=V@R.T                      # x,y = Bildebene, z = Tiefe (groesser = naeher)
    L=np.array([0.35,0.5,0.8]); L/=np.linalg.norm(L)
    polys=[];cols=[];dep=[]
    for f,c in zip(F,C):
        P=W[f]
        n=np.cross(P[1]-P[0],P[2]-P[0]); ln=np.linalg.norm(n)
        if ln<1e-9: continue
        n/=ln
        if n[2]<0: continue      # Rueckseiten weg
        sh=0.35+0.65*max(0,n@L)
        emissive = c[0]>0.8 and c[1]>0.5 and c[2]<0.2 or c[2]>0.95
        col=np.array(c)*(1.0 if emissive else sh)
        polys.append(P[:,:2]); cols.append(np.clip(col,0,1)); dep.append(P[:,2].mean())
    o=np.argsort(dep)
    ax.add_collection(PolyCollection([polys[i] for i in o],facecolors=[cols[i] for i in o],edgecolors="none",linewidths=0))
    ax.set_xlim(W[:,0].min()*1.05,W[:,0].max()*1.05); ax.set_ylim(W[:,1].min()*1.05,W[:,1].max()*1.05)
    ax.set_aspect("equal"); ax.axis("off"); ax.set_title(title,color="w",fontsize=10)

def rot(rx=0,rz=0):
    cz,sz=np.cos(rz),np.sin(rz); cx,sx=np.cos(rx),np.sin(rx)
    Rz=np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]]); Rx=np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])
    return Rx@Rz

if __name__=="__main__":
    V,F,C=load(sys.argv[1])
    print("Verts",len(V),"Faces",len(F),"BBox",V.min(0),V.max(0))
    fig,axs=plt.subplots(1,4,figsize=(26,7),facecolor="#333537")
    # Blender: X rechts, Y Tiefe, Z oben. Front = Blick entlang +Y (Kamera bei -Y)
    FRONT=np.array([[1,0,0],[0,0,1],[0,-1,0]])
    SIDE =np.array([[0,1,0],[0,0,1],[1,0,0]])   # Blick von +X
    TOP  =np.array([[1,0,0],[0,1,0],[0,0,1]])
    views=[(FRONT,"FRONT"),(SIDE,"SEITE"),(TOP,"OBEN"),(np.array([[1,0,0],[0,0,1],[0,-1,0]])@rot(0,0),"")]
    # Iso
    a=np.radians(35); b=np.radians(-35)
    Rz=np.array([[np.cos(b),-np.sin(b),0],[np.sin(b),np.cos(b),0],[0,0,1]])
    Rx=np.array([[1,0,0],[0,np.cos(a),-np.sin(a)],[0,np.sin(a),np.cos(a)]])
    ISO=np.array([[1,0,0],[0,0,1],[0,-1,0]])  # placeholder
    # Kamera-Iso: erst um Z drehen, dann nach vorne kippen
    Rtilt=np.array([[1,0,0],[0,np.sin(a),np.cos(a)],[0,-np.cos(a),np.sin(a)]])
    ISO=Rtilt@Rz
    for ax,(R,t) in zip(axs,[(FRONT,"FRONT"),(SIDE,"SEITE"),(TOP,"OBEN"),(ISO,"ISO")]):
        view(ax,V,F,C,R,t)
    plt.tight_layout(); plt.savefig(sys.argv[2],dpi=90,facecolor=fig.get_facecolor())

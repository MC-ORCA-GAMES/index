function shuffleArr(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

function carveMaze(size, blockedIdx, cw){
  // 0=Flur, 1=Wand. Klassischer Recursive-Backtracker, jetzt auf Block-Basis:
  // jede "logische" Zelle belegt ein cw×cw-Feld physischer Gitterzellen
  // (Korridorbreite), die Wand dazwischen bleibt immer exakt 1 Zelle dünn.
  // cw=1 (Default) ist exakt das alte Verhalten (1 Zelle Flur, 1 Zelle Wand).
  // blockedIdx (optional): Set von g-Indizes, die der Backtracker nie betritt
  // (Wert 3 = reserviert) — die Maze waechst organisch drumherum. Wird
  // benutzt, um vorab Platz fuer einen Vorraum freizuhalten.
  cw=Math.max(1,cw|0)||1;
  const step=cw+1;
  const g=new Uint8Array(size*size).fill(1);
  const idx=(x,y)=>y*size+x;
  if(blockedIdx) for(const gi of blockedIdx) g[gi]=3;
  const n=Math.max(1,Math.floor((size-2)/step)); // logische Zellen pro Achse
  const anchor=(i,j)=>[1+i*step,1+j*step];
  function blockFree(ax,ay){
    for(let dy=0;dy<cw;dy++) for(let dx=0;dx<cw;dx++){
      const x=ax+dx,y=ay+dy;
      if(x<0||y<0||x>=size||y>=size) return false;
      if(g[idx(x,y)]===3) return false;
    }
    return true;
  }
  function carveBlock(ax,ay){ for(let dy=0;dy<cw;dy++) for(let dx=0;dx<cw;dx++) g[idx(ax+dx,ay+dy)]=0; }
  function carveLink(ai,aj,di,dj){
    const [ax,ay]=anchor(ai,aj);
    if(di===1){ for(let k=0;k<cw;k++) g[idx(ax+cw,ay+k)]=0; }
    else if(di===-1){ for(let k=0;k<cw;k++) g[idx(ax-1,ay+k)]=0; }
    else if(dj===1){ for(let k=0;k<cw;k++) g[idx(ax+k,ay+cw)]=0; }
    else { for(let k=0;k<cw;k++) g[idx(ax+k,ay-1)]=0; }
  }
  const [a0x,a0y]=anchor(0,0);
  carveBlock(a0x,a0y);
  const visited=new Uint8Array(n*n);
  const vidx=(i,j)=>j*n+i;
  visited[vidx(0,0)]=1;
  const stack=[[0,0]];
  while(stack.length){
    const [ci,cj]=stack[stack.length-1];
    const dirs=shuffleArr([[1,0],[-1,0],[0,1],[0,-1]]);
    let carved=false;
    for(const [di,dj] of dirs){
      const ni=ci+di, nj=cj+dj;
      if(ni<0||nj<0||ni>=n||nj>=n||visited[vidx(ni,nj)]) continue;
      const [nax,nay]=anchor(ni,nj);
      if(!blockFree(nax,nay)) continue;
      carveBlock(nax,nay); carveLink(ci,cj,di,dj);
      visited[vidx(ni,nj)]=1; stack.push([ni,nj]); carved=true; break;
    }
    if(!carved) stack.pop();
  }
  // ein paar Extra-Durchbrüche zwischen bereits benachbarten, verbundenen
  // Zellen, damit nicht alles reine Sackgassen sind
  const extra=Math.floor(n*n*0.02);
  for(let k=0;k<extra;k++){
    const ci=(Math.random()*n)|0, cj=(Math.random()*n)|0;
    if(!visited[vidx(ci,cj)]) continue;
    for(const [di,dj] of shuffleArr([[1,0],[0,1]])){
      const ni=ci+di, nj=cj+dj;
      if(ni<0||nj<0||ni>=n||nj>=n||!visited[vidx(ni,nj)]) continue;
      carveLink(ci,cj,di,dj); break;
    }
  }
  return g;
}
function bfsAll(g,size,sx,sy){
  const idx=(x,y)=>y*size+x;
  const dist=new Int32Array(size*size).fill(-1);
  dist[idx(sx,sy)]=0;
  const q=[[sx,sy]]; let qi=0;
  while(qi<q.length){
    const [x,y]=q[qi++]; const d=dist[idx(x,y)];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy;
      if(nx<0||ny<0||nx>=size||ny>=size) continue;
      if(g[idx(nx,ny)]!==0||dist[idx(nx,ny)]!==-1) continue;
      dist[idx(nx,ny)]=d+1; q.push([nx,ny]);
    }
  }
  return dist;
}
function reachableCount(dist){ let c=0; for(let i=0;i<dist.length;i++) if(dist[i]>=0) c++; return c; }
const DOOR_SIDES={N:[0,-1],S:[0,1],W:[-1,0],E:[1,0]};
// Findet die Ausgangs-Innenzelle: immer am Kartenrand, bevorzugt mit nur einem
// Zugang (echter Flaschenhals statt Durchgangsraum von zwei Seiten begehbar).
function findDoorCell(g,size,dist){
  const idx=(x,y)=>y*size+x;
  let best=null;
  for(const side of ['N','S','E','W']){
    const [ox,oy]=DOOR_SIDES[side];
    for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++){
      if(g[idx(x,y)]!==0) continue;
      const onEdge = side==='N'?y===1 : side==='S'?y===size-2 : side==='W'?x===1 : x===size-2;
      if(!onEdge) continue;
      const d=dist[idx(x,y)]; if(d<0) continue;
      let deg=0;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        if(dx===ox&&dy===oy) continue;
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=size||ny>=size) continue;
        if(g[idx(nx,ny)]===0) deg++;
      }
      const cand={side,x,y,deg,d};
      if(!best || cand.deg<best.deg || (cand.deg===best.deg && cand.d>best.d)) best=cand;
    }
  }
  return best;
}
// Versiegelt überzählige Zugänge zur Türzelle — aber nur, wenn dadurch nachweislich
// (per Erreichbarkeits-Check) kein anderer Kartenteil vom Spawn abgeschnitten wird.
function sealExtraApproaches(g,size,cand){
  const idx=(x,y)=>y*size+x;
  const [ox,oy]=DOOR_SIDES[cand.side];
  const before=reachableCount(bfsAll(g,size,1,1));
  const neighbors=[];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(dx===ox&&dy===oy) continue;
    const nx=cand.x+dx, ny=cand.y+dy;
    if(nx<0||ny<0||nx>=size||ny>=size) continue;
    if(g[idx(nx,ny)]===0) neighbors.push(idx(nx,ny));
  }
  let remaining=neighbors.length;
  for(const gi of neighbors){
    if(remaining<=1) break;
    const save=g[gi]; g[gi]=1;
    const after=reachableCount(bfsAll(g,size,1,1));
    if(after>=before-1){ remaining--; } else { g[gi]=save; }
  }
}
/* ---- Vorraum mit Säulen vor dem Ausgang ("Reservieren, dann drumherum wachsen") ----
   Statt hinterher Löcher in eine fertige Maze zu stanzen (riskiert immer,
   irgendwo einen für den Rest der Karte nötigen Gang zu kappen), wird die
   Fläche des Vorraums (Innenraum + 1 Zelle Pufferring) VOR dem Carven als
   Sperrzone reserviert. carveMaze() betritt reservierte Zellen nie und wächst
   organisch drumherum — der Rest der Maze ist dadurch nie auf eine später
   versiegelte Zelle angewiesen. Danach wird der Innenraum als begehbarer
   Flur (+ Säulen zum Verstecken) eingetragen; der Pufferring bleibt Wand bis
   auf genau eine Stelle — der eine echte Zugang, den der Kern-Wächter bewacht. */
function planAntechamber(size,doorCand,cw){
  cw=Math.max(1,cw|0)||1;
  const idx=(x,y)=>y*size+x;
  const side=doorCand.side;
  const [ox,oy]=DOOR_SIDES[side];
  const depthDir=[-ox,-oy]; // von der Kante ins Karteninnere
  const perp=(side==='N'||side==='S')?[1,0]:[0,1]; // Breitenachse des Raums

  // Schwellenwerte mitskaliert mit der Korridorbreite (step), damit dieselbe
  // Raumgröße (3/5/7/9) bei gleicher Maze-Komplexität wie bisher gewählt wird
  // — die physische Kartengröße wächst ja mit der Korridorbreite mit, ohne
  // dass die Maze an sich komplexer würde. Bei cw=1 identisch zum alten Verhalten.
  const step=cw+1;
  let roomSpan = size<=Math.round(15*step/2)?3 : size<=Math.round(25*step/2)?5 : size<=Math.round(41*step/2)?7 : 9;
  function cell(d,w){ return { x: doorCand.x+perp[0]*w+depthDir[0]*d, y: doorCand.y+perp[1]*w+depthDir[1]*d }; }
  function fits(span){
    const half=(span-1)/2;
    for(let d=0; d<=span; d++) for(let w=-half-1; w<=half+1; w++){
      const c=cell(d,w);
      if(c.x<1||c.y<1||c.x>size-2||c.y>size-2) return false;
    }
    return true;
  }
  while(roomSpan>=3 && !fits(roomSpan)) roomSpan-=2;
  if(roomSpan<3) return null; // kein Platz -> normale Einzelzellen-Tür (Fallback)

  const half=(roomSpan-1)/2;
  const interior=new Set(), ring=new Set();
  for(let d=0; d<roomSpan; d++) for(let w=-half; w<=half; w++) interior.add(idx(cell(d,w).x,cell(d,w).y));
  for(let d=0; d<=roomSpan; d++) for(let w=-half-1; w<=half+1; w++){
    const gi=idx(cell(d,w).x,cell(d,w).y);
    if(!interior.has(gi)) ring.add(gi);
  }
  // Sperrzone für den Carve-Durchlauf: bei cw=1 (altes, bewährtes Verhalten)
  // wird wie bisher Innenraum + kompletter Pufferring vorab reserviert. Bei
  // breiteren Korridoren (cw>1) simulativ geprüft: die volle Ring-Reservierung
  // lässt der block-basierten Maze am Kartenrand kaum noch Platz zum Umrouten
  // (Vorraum-Erfolgsquote fiel in 3000 Testläufen von ~75% auf unter 9%) —
  // nur den Innenraum vorab zu sperren und den Ring dem Sicherheitsnetz
  // (Erreichbarkeits-Check unten) zu überlassen bringt sie auf ~60%, ohne die
  // Fallback-Garantie zu verlieren.
  const blocked = cw>1 ? new Set([...interior]) : new Set([...interior,...ring]);
  return {roomSpan,half,side,depthDir,perp,cell,interior,ring,blocked,doorCand};
}
function finishAntechamber(g,size,plan){
  const idx=(x,y)=>y*size+x;
  const {roomSpan,half,cell,interior,ring,doorCand}=plan;
  function ringDW(gi){
    const x=gi%size,y=(gi/size)|0, rx=x-doorCand.x, ry=y-doorCand.y;
    return {d:rx*plan.depthDir[0]+ry*plan.depthDir[1], w:rx*plan.perp[0]+ry*plan.perp[1]};
  }
  // Zugang suchen: Ringzelle mit Aussennachbar, der bereits (um die Sperrzone
  // herum gewachsener) Flur ist — bevorzugt an der hintersten, zentrierten Stelle.
  const candidates=[];
  for(const gi of ring){
    const x=gi%size,y=(gi/size)|0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx, ny=y+dy;
      if(nx<0||ny<0||nx>=size||ny>=size) continue;
      const ni=idx(nx,ny);
      if(interior.has(ni)||ring.has(ni)) continue;
      if(g[ni]===0) candidates.push(gi);
    }
  }
  let entranceRingIdx=null;
  if(candidates.length){
    candidates.sort((a,b)=>{ const A=ringDW(a),B=ringDW(b); return B.d!==A.d ? B.d-A.d : Math.abs(A.w)-Math.abs(B.w); });
    entranceRingIdx=candidates[0];
  } else {
    // Extrem selten (winziger Sektor): geraden Gang von der hintersten Wand
    // aus graben, bis vorhandener Flur erreicht ist.
    const back=cell(roomSpan,0); let cx=back.x, cy=back.y, gi=idx(cx,cy);
    for(let step=0; step<10; step++){
      if(g[gi]===0){ entranceRingIdx=gi; break; }
      g[gi]=0;
      const nx=cx+plan.depthDir[0], ny=cy+plan.depthDir[1];
      if(nx<1||ny<1||nx>size-2||ny>size-2) break;
      cx=nx; cy=ny; gi=idx(cx,cy);
    }
    if(entranceRingIdx===null) entranceRingIdx=gi;
  }
  for(const gi of interior) g[gi]=0;
  for(const gi of ring) g[gi]=(gi===entranceRingIdx)?0:1;
  // Säulen im Innern (Randreihen/-spalten bleiben frei, damit man an Tür und
  // Zugang immer vorbeikommt)
  const pillars=[];
  if(roomSpan>=5){
    for(let d=2; d<=roomSpan-3; d+=2) for(let w=-half+2; w<=half-2; w+=2){
      const c=cell(d,w), gi=idx(c.x,c.y);
      if(gi===entranceRingIdx) continue;
      g[gi]=1; pillars.push(gi);
    }
  }
  const doorThreshold=cell(0,0);
  const entranceCell={x:entranceRingIdx%size,y:(entranceRingIdx/size)|0};
  const centerCell=cell(Math.floor((roomSpan-1)/2),0);
  return {
    roomSpan, side:plan.side,
    roomCells:[...interior].map(gi=>({x:gi%size,y:(gi/size)|0})),
    pillarCells: pillars.map(gi=>({x:gi%size,y:(gi/size)|0})),
    doorThreshold, entranceCell, centerCell,
  };
}
module.exports={shuffleArr,carveMaze,bfsAll,reachableCount,DOOR_SIDES,findDoorCell,sealExtraApproaches,planAntechamber,finishAntechamber};

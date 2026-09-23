const {shuffleArr,carveMaze,bfsAll,reachableCount,DOOR_SIDES,findDoorCell,sealExtraApproaches,planAntechamber,finishAntechamber}=require('./maze_core.js');
const SIZE_TIERS=[1,1.35,1.7,2.1];

function runOnce(depth, tier, CORR_W){
  let sizeRef=Math.round((11+depth*2.2)*tier); sizeRef+=(1-(sizeRef%2)); sizeRef=Math.max(11,Math.min(sizeRef,61));
  const n=Math.max(1,Math.floor((sizeRef-2)/2));
  const size=n*(CORR_W+1)+2;
  const idx=(x,y)=>y*size+x;

  const gTrial=carveMaze(size,null,CORR_W);
  const doorCand=findDoorCell(gTrial,size,bfsAll(gTrial,size,1,1));
  const plan=doorCand?planAntechamber(size,doorCand,CORR_W):null;
  let g = plan ? carveMaze(size, plan.blocked, CORR_W) : gTrial;
  let ante=null, fellBack=false;
  if(doorCand){
    if(plan){
      ante=finishAntechamber(g,size,plan);
      const distFinal=bfsAll(g,size,1,1);
      let floorCount=0, reach=0;
      for(let i=0;i<g.length;i++){ if(g[i]===0){ floorCount++; if(distFinal[i]>=0) reach++; } }
      if(floorCount!==reach){ g=gTrial; ante=null; fellBack=true; if(doorCand.deg>1) sealExtraApproaches(g,size,doorCand); }
    } else if(doorCand.deg>1) sealExtraApproaches(g,size,doorCand);
  }

  // Konnektivitäts-Check (finale Karte, wie im Spiel)
  const dist=bfsAll(g,size,1,1);
  let floorCount=0, reach=0;
  for(let i=0;i<g.length;i++){ if(g[i]===0){ floorCount++; if(dist[i]>=0) reach++; } }
  const disconnected = floorCount!==reach;

  // Tatsächliche gemessene Korridorbreite: für jede offene Zelle, wie weit
  // kann man in +x und +y laufen, ohne eine Wand zu treffen (misst die
  // Breite von geraden Passagen an vielen Stichproben).
  let widthSamples=[];
  for(let y=1;y<size-1;y+=1) for(let x=1;x<size-1;x+=1){
    if(g[idx(x,y)]!==0) continue;
    // horizontale Ausdehnung (offene Zellen in Folge in y-Richtung, an dieser Spalte)
    let h=1; while(y-h>=0 && g[idx(x,y-h)]===0) h++; let h2=0; while(g[idx(x,y+h2+1)]===0) h2++;
    widthSamples.push(h+h2);
  }
  const avgW = widthSamples.reduce((a,b)=>a+b,0)/widthSamples.length;
  const minW = Math.min(...widthSamples);

  return {size, n, disconnected, hasAnte: !!ante, fellBack, avgW, minW, pillars: ante?ante.pillarCells.length:0};
}

function sim(CORR_W, runs){
  let disc=0, anteCount=0, fellBack=0, totalAvgW=0, minWSeen=999;
  const sizes=[];
  for(let i=0;i<runs;i++){
    const depth=1+((Math.random()*30)|0);
    const tier=SIZE_TIERS[(Math.random()*SIZE_TIERS.length)|0];
    const r=runOnce(depth, tier, CORR_W);
    if(r.disconnected) disc++;
    if(r.hasAnte) anteCount++;
    if(r.fellBack) fellBack++;
    totalAvgW+=r.avgW;
    minWSeen=Math.min(minWSeen,r.minW);
    sizes.push(r.size);
  }
  console.log(`CORR_W=${CORR_W}  runs=${runs}`);
  console.log(`  abgeschnittene Karten: ${disc}`);
  console.log(`  Vorraum gebaut: ${anteCount} (${(anteCount/runs*100).toFixed(1)}%), Fallback: ${fellBack}`);
  console.log(`  gemessene Ø-Gangbreite: ${(totalAvgW/runs).toFixed(2)} Zellen, min. beobachtete Breite: ${minWSeen}`);
  console.log(`  physische Kartengröße: min ${Math.min(...sizes)}, max ${Math.max(...sizes)}`);
}

console.log('--- Vergleich: altes Verhalten (CORR_W=1) ---');
sim(1, 2000);
console.log('\n--- Neu (CORR_W=2) ---');
sim(2, 2000);

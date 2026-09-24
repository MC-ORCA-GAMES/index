const {shuffleArr,carveMaze,bfsAll,reachableCount,DOOR_SIDES,findDoorCell,sealExtraApproaches,planAntechamber,finishAntechamber}=require('./maze_core.js');
const SIZE_TIERS=[1,1.35,1.7,2.1];

function runOnce(depth, tier, CORR_W, ringReserved){
  let sizeRef=Math.round((11+depth*2.2)*tier); sizeRef+=(1-(sizeRef%2)); sizeRef=Math.max(11,Math.min(sizeRef,61));
  const n=Math.max(1,Math.floor((sizeRef-2)/2));
  const size=n*(CORR_W+1)+2;
  const gTrial=carveMaze(size,null,CORR_W);
  const doorCand=findDoorCell(gTrial,size,bfsAll(gTrial,size,1,1));
  const plan=doorCand?planAntechamber(size,doorCand,CORR_W):null;
  if(plan && !ringReserved){ plan.blocked=new Set(plan.interior); }
  let g = plan ? carveMaze(size, plan.blocked, CORR_W) : gTrial;
  let ante=null, fellBack=false;
  if(doorCand){
    if(plan){
      ante=finishAntechamber(g,size,plan);
      const distFinal=bfsAll(g,size,1,1);
      let floorCount=0, reach=0;
      for(let i=0;i<g.length;i++){ if(g[i]===0){ floorCount++; if(distFinal[i]>=0) reach++; } }
      if(floorCount!==reach){ g=gTrial; ante=null; fellBack=true; }
    }
  }
  return {hasAnte: !!ante, fellBack, hadPlan: !!plan};
}

function sim(CORR_W, ringReserved, runs){
  let anteCount=0, fellBack=0, hadPlan=0;
  for(let i=0;i<runs;i++){
    const depth=1+((Math.random()*30)|0);
    const tier=SIZE_TIERS[(Math.random()*SIZE_TIERS.length)|0];
    const r=runOnce(depth, tier, CORR_W, ringReserved);
    if(r.hasAnte) anteCount++;
    if(r.fellBack) fellBack++;
    if(r.hadPlan) hadPlan++;
  }
  console.log(`CORR_W=${CORR_W} ringReserved=${ringReserved}: Plan gefunden ${(hadPlan/runs*100).toFixed(1)}%, Vorraum gebaut ${(anteCount/runs*100).toFixed(1)}%, Fallback ${(fellBack/runs*100).toFixed(1)}%`);
}

sim(1, true, 3000);
sim(2, true, 3000);
sim(2, false, 3000);
sim(1, false, 3000);

// Phase 6: KI-Stresstest — tiefe prozedurale Ebenen, viele Gegner, Spieler mit Zufalls-Input (unverwundbar), Zustands-/Performance-Statistik
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const depths=(process.argv[2]||'3,9,15').split(',').map(Number), frames=+(process.argv[3]||1200);
  const h=boot(); const B=h.B(), P=B.P, AI=B.AI, NX=B.NX; let bad=0;
  h.frame(10); B.newRun();
  for(const d of depths){
    const lvl=B.genLevel(d); B.startLevel(lvl,true); await sleep(300); h.frame(5);
    const list=NX.enemies.list; const n0=list.filter(e=>e.alive).length;
    const S=[0,0,0,0,0], seenStates=new Set(); let maxMs=0, sumMs=0, awakeMax=0;
    for(let k=0;k<frames;k++){
      P.hp=100; P.shield=P.shieldMax;
      B.keys.KeyW=(k%200)<150; B.keys.KeyA=(k%370)<60; B.keys.KeyD=(k%370)>=200&&(k%370)<260; if(k%17===0) P.a+=(Math.random()-.5)*1.4;
      if(k%23===0){ B.setWeapon([0,1,3,4][(Math.random()*4)|0]); P.ammo=60; P.mag.forEach((v,i)=>{ if(B.WEAPONS[i].mag>0) P.mag[i]=B.WEAPONS[i].mag; }); }
      if(k%150===0){ const al=list.filter(e=>e.alive); if(al.length){ const e=al[(Math.random()*al.length)|0]; const g=NX.level.grid, W=NX.level.width; for(const [ox,oy] of [[2.5,0],[-2.5,0],[0,2.5],[0,-2.5],[1.2,0],[0,0]]){ const x=e.x+ox, y=e.y+oy; if(x>1&&y>1&&g[(y|0)*W+(x|0)]===0){ P.x=x; P.y=y; P.a=Math.atan2(e.y-y,e.x-x); break; } } } }   // Kampf provozieren
      if(k%5===0) B.tryFire();
      const t0=process.hrtime.bigint(); h.frame(1,1/60); const ms=Number(process.hrtime.bigint()-t0)/1e6; sumMs+=ms; if(ms>maxMs) maxMs=ms;
      if(k%10===0){ let aw=0; for(const e of list){ if(!e.alive) continue; S[e.ai]++; seenStates.add(e.ai); if(e.awake) aw++; if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.y<0||e.x>=NX.level.width||e.y>=NX.level.height) bad++; if(e.awake!==(e.ai>=2)&&e.type!=='K') bad++; } awakeMax=Math.max(awakeMax,aw); }
    }
    console.log('Tiefe',d,'Gegner',n0,'->',list.filter(e=>e.alive).length,'| Zustandsproben idle/invest/combat/search/flee =',S.join('/'),'| stats',JSON.stringify(AI.stats),'| ms/Frame Ø',(sumMs/frames).toFixed(2),'max',maxMs.toFixed(1),'| max wach',awakeMax,'| cache',AI.cache.size);
  }
  console.log('bad',bad,'errors',h.errors.length,'warns',h.warns.length, JSON.stringify(h.errors.concat(h.warns).slice(0,2)));
  process.exit(bad||h.errors.length||h.warns.length?1:0);
})();

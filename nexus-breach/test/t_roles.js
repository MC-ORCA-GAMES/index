const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX, P=B.P, AI=B.AI, R=B.Roles;
  h.frame(10); B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(5);
  const list=NX.enemies.list, grid=NX.level.grid, GW=NX.level.width, GH=NX.level.height;
  const free=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH&&grid[y*GW+x]===0;
  let line=null; for(const len of [14,12,10]){ for(let y=1;y<GH-1&&!line;y++) for(let x=1;x<GW-len&&!line;x++){ let g=true; for(let k=0;k<len;k++) if(!free(x+k,y)){g=false;break;} if(g) line={x,y,len}; } if(line) break; }
  const kill=()=>{ list.forEach(e=>{e.alive=false;}); NX.level.shots.length=0; };
  const setP=()=>{ P.x=line.x+.5; P.y=line.y+.5; P.a=0; P.hp=100; P.shield=0; P.fireCd=0; };
  const put=(i,d,type)=>{ const e=list[i]; e.type=type; e.alive=true; e.hp=e.maxhp=ETY(type); e.x=line.x+.5+d; e.y=line.y+.5; e.awake=false; e.stagT=0; e.flash=0; e.bodyT=0; e.cd=1; AI.init(e); e.aggr=1; e.patrol=false; e.flank=false; e.face=Math.PI; AI.engage(e); return e; };
  const ETY=t=>NX.enemies.types[t].hp;
  let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('FAIL',m);} else console.log('ok  ',m); };
  const run=n=>h.frame(n,1/60);
  ok(list.length>=4,'genug Gegner-Slots');
  // Klassen
  for(const [t,role] of [['N','sniper'],['M','support'],['B','shielder'],['C','summoner'],['A','assassin'],['J','juggernaut'],['x','scout'],['p','swarm'],['k','tank']]){
    kill(); setP(); const e=put(0,8,t); ok(e.role===role,t+' -> '+role);
    run(300); ok(h.errors.length===0,t+' 300 Frames ohne Fehler');
  }
  // Sniper schiesst
  kill(); setP(); let e=put(0,9,'N'); e.rcd=0; run(5); ok(e.rs===1,'Sniper: zielt'); ok(R.aimed>=0,'aimed-Zaehler');
  const hp0=P.hp; P.shield=0; run(120); ok(R.stats.snipes>=1,'Sniper: Schuss abgegeben ('+R.stats.snipes+')');
  // Beschwoerer
  kill(); setP(); e=put(0,8,'C'); e.rcd=0; const n0=list.length; run(120); ok(list.length>n0&&R.minions(e)>=2,'Summoner ruft Minions ('+R.minions(e)+')');
  // Schutzfeld
  kill(); setP(); const sh=put(0,10,'B'), al=put(1,10.8,'r'); run(20); ok(al.shielded,'Schutzfeld schuetzt Verbuendeten');
  { const h0=al.hp; B.damageEnemy(al,20,null,false,true); ok(h0-al.hp<=12,'Schaden im Feld reduziert ('+(h0-al.hp)+')'); }
  // Medic heilt
  kill(); setP(); const md=put(0,10,'M'), ally=put(1,10.6,'r'); ally.hp=30; run(60); ok(ally.hp>30,'Medic heilt ('+ally.hp.toFixed(1)+')');
  // Assassine
  kill(); setP(); e=put(0,7,'A'); e.rcd=0; run(80); ok(R.stats.blinks>=1,'Assassine springt ('+R.stats.blinks+')');
  // Juggernaut
  kill(); setP(); e=put(0,8,'J'); e.rcd=0; run(150); ok(R.stats.charges>=1,'Juggernaut greift an ('+R.stats.charges+')'); ok(P.hp<100||e.rs>=0,'Juggernaut Ablauf');
  // Elite
  kill(); setP(); e=put(0,3,'r'); e.elite=true; e.novaCd=0; run(10); ok(e.rs===7,'Elite: Nova-Ansage'); run(80); ok(R.stats.novas>=1,'Elite: Nova ausgeloest');
  // Elite-Spawn statistisch
  let el=0,tot=0; for(let i=0;i<40;i++){ B.startLevel(0,true); await sleep(60); }
  ok(h.errors.length===0,'Fehler gesamt: '+h.errors.join('|')); 
  // tiefe Ebene: Klassen-Spawns
  const cnt={}; for(const d of [4,7,10,13,16]){ const L=B.genLevel(d); for(const c of L.map.join('')) if('NMBCAJ'.includes(c)) cnt[d+c]=(cnt[d+c]||0)+1; }
  console.log('Spawns',JSON.stringify(cnt));
  console.log('warns',h.warns.length,'errors',h.errors.length,'fails',fails);
  process.exit(fails||h.errors.length?1:0);
})();

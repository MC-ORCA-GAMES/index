const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX; const S=NX.save;
  const seen=[]; NX.onState((n,p)=>seen.push(p+'>'+n));
  h.frame(10);
  // Story-Sektor 1 starten
  B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(30);
  console.log('after start:',B.state,'depth/lvIdx',B.lvIdx,'runs',S.data.stats.runs);
  // Kill: Spieler neben lebenden Gegner teleportieren, zielen, feuern
  const e=NX.enemies.list.find(x=>x.alive);
  B.P.x=e.x-1.2; B.P.y=e.y; B.P.a=0; B.P.hp=100; B.P.weapon=0; B.P.ammo=99;
  const k0=S.data.stats.kills, kl=B.stats.kills;
  B.keys.Space=true; for(let i=0;i<400 && B.stats.kills===kl;i++){ B.P.a=Math.atan2(e.y-B.P.y,e.x-B.P.x); h.frame(1,1/30); if(B.state!=='play') break; }
  B.keys.Space=false;
  console.log('kill: level kills',B.stats.kills-kl,'save kills',S.data.stats.kills-k0, 'state',B.state);
  // Tod provozieren: Spieler HP runter durch Feind-Angriffe (Gegner wach, Spieler daneben)
  B.P.hp=3; for(const x of NX.enemies.list){ x.awake=true; x.x=B.P.x+.8; x.y=B.P.y; }
  for(let i=0;i<600 && B.state==='play';i++) h.frame(1,1/30);
  console.log('death state',B.state,'deaths',S.data.stats.deaths,'dirty',S.dirty,'stored',!!h.store.nexus_breach_save);
  // Level-Win simulieren: auf Ausgangsfeld laufen (Boss/Lock ignorieren nicht möglich in Sektor 1 -> Zellposition)
  B.startLevel(0,true); await sleep(400); h.frame(20);
  console.log('restarted',B.state);
  const ex=NX.level.exit; if(ex){ NX.enemies.list.forEach(x=>{x.alive=false;}); B.P.x=ex.x+.5-.9; B.P.y=ex.y+.5; h.frame(5,1/30); }
  console.log('after exit:',B.state,'sectorsCleared',S.data.stats.sectorsCleared);
  S.flush();
  console.log('transitions',seen.join(' '));
  console.log('warns',h.warns,'errors',h.errors);
  const saved=JSON.parse(h.store.nexus_breach_save); console.log('saved stats',JSON.stringify(saved.stats),'v',saved.version);
  process.exit(h.errors.length?1:0);
})();

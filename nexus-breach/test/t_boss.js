const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX, P=B.P, st=h.elements.stage, cls=x=>st._c.has(x);
  B.newRun(); let idx=-1;
  for(let i=0;i<8;i++){ B.startLevel(i,true); await sleep(400); h.frame(5); if(NX.enemies.list.some(e=>e.type==='K')){ idx=i; break; } }
  ok(idx>=0,'Boss-Sektor gefunden (Index '+idx+')');
  const boss=NX.enemies.list.find(e=>e.type==='K');
  ok(/Kern-Wächter besiegen/.test(h.elements.top.innerHTML),'Ziel: Boss besiegen');
  ok(!cls('boss'),'Boss-Leiste aus, solange Boss schläft');
  boss.awake=true; h.frame(4); ok(cls('boss'),'Boss-Leiste an, sobald Boss wach');
  ok(h.elements.bossFill.style.width==='100%','Bossleiste 100%');
  ok(h.elements.bossLv.textContent==='LV '+(idx+1),'Boss-Level: '+h.elements.bossLv.textContent);
  boss.hp=boss.maxhp*.5; h.frame(2); ok(h.elements.bossFill.style.width==='50%','Bossleiste 50%');
  ok(parseFloat(h.elements.bossGhost.style.width)>50,'Ghost-Leiste hinkt hinterher');
  h.frame(90,1/30); ok(parseFloat(h.elements.bossGhost.style.width)<=50.1,'Ghost holt nach');
  ok(NX.hud.threat>=3,'Threat mit wachem Boss hoch: '+NX.hud.threat);
  boss.alive=false; h.frame(4); ok(!cls('boss'),'Boss-Leiste aus nach Boss-Tod');
  ok(h.errors.length===0,'keine Fehler'); console.log(fails?('FEHLER '+fails):'ALLE OK'); process.exit(fails?1:0);
})();

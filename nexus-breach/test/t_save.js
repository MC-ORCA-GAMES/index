const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
(async()=>{
  // 1) Korrupter JSON -> Defaults, kein Crash
  let h=boot({store:{nexus_breach_save:'{kaputt'}}); ok(h.B().NX.save.data.version===1 && h.errors.length===0,'korrupter Save -> Defaults');
  // 2) Müll-Werte werden bereinigt / geklemmt
  h=boot({store:{nexus_breach_save:JSON.stringify({version:1,highestDepth:-5,credits:'abc',stats:{kills:'x',deaths:7},settings:{masterVol:9,fov:1,reducedMotion:1,evil:'x'},unlockedWeapons:[1,'a'],perks:[]})}});
  let d=h.B().NX.save.data;
  ok(d.highestDepth===0&&d.credits===0&&d.stats.kills===0&&d.stats.deaths===7,'Zahlen bereinigt');
  ok(d.settings.masterVol===1&&d.settings.fov===50&&d.settings.reducedMotion===true&&!('evil' in d.settings),'Settings geklemmt, Fremdschlüssel entfernt');
  ok(JSON.stringify(d.unlockedWeapons)==='["a"]'&&JSON.stringify(d.perks)==='{}','Arrays/Objekte validiert');
  // 3) Neuere Version -> readOnly, wird nie überschrieben
  const future=JSON.stringify({version:99,highestDepth:42});
  h=boot({store:{nexus_breach_save:future}}); const S=h.B().NX.save; S.markDirty(); S.flush();
  ok(S.readOnly&&h.store.nexus_breach_save===future,'Save neuerer Version bleibt unangetastet');
  // 4) Legacy-Werte werden übernommen
  h=boot({store:{orca_breach_best:'321',orca_breach_bestdepth:'8'}}); d=h.B().NX.save.data;
  ok(d.bestTime===321&&d.highestDepth===8,'Legacy-Bestwerte importiert');
  // 5) Kein localStorage (Privatmodus) -> läuft weiter
  h=boot({noStorage:true}); h.frame(30); h.B().NX.save.markDirty(); h.B().NX.save.flush();
  ok(h.errors.length===0&&h.B().NX.save.ok===false,'ohne Storage kein Crash');
  // 6) Migration: Version-0/1-Kette
  h=boot(); const S2=h.B().NX.save; const mig=S2.migrate({version:1,x:1}); ok(mig.version===1,'Migration bei aktueller Version = No-Op');
  // 7) Persistenz Roundtrip + Pause/Resume/Titel
  h=boot(); const B=h.B(), NX=B.NX; const seen=[]; NX.onState((n,p)=>seen.push(p+'>'+n));
  B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(20);
  h.win.__breach.keys.KeyP=true; // Pause geht über keydown-Listener; direkt: visibilitychange
  const vis=h.listeners['d:visibilitychange']||[]; h.win.document.hidden=true; vis.forEach(f=>f()); h.win.document.hidden=false;
  ok(B.state==='pause','Tab-Wechsel pausiert (play>pause)');
  ok(h.store.nexus_breach_save!==undefined,'Save wird beim Verlassen von play geschrieben');
  h.frame(10); ok(h.errors.length===0,'Frames in Pause fehlerfrei');
  const rt=boot({store:h.store}); ok(rt.B().NX.save.data.stats.runs===1,'Roundtrip: neuer Boot liest Save');
  // 8) Touch-Boot
  const th=(()=>{ const x=boot(); return x; })();
  console.log(seen.join(' '), h.warns);
  console.log(fails?('FEHLER: '+fails):'ALLE OK');
  process.exit(fails?1:0);
})();

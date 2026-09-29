// Story Mode Phase 1: Save v4, Migration, Sanitize, Story-Fluss, Persistenz, Freischaltungen, Aktionen/Events, Freies Spiel.
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
(async()=>{
  // 1) Frischer Save
  let h=boot(), B=h.B(), NX=B.NX, S=NX.save, ST=B.Story;
  ok(NX.SAVE_VERSION===4&&S.data.version===4,'SAVE_VERSION 4');
  ok(S.data.story&&S.data.story.started===false&&S.data.story.act===0&&S.data.story.cp===null,'Story-Defaults im frischen Save');
  ok(ST.sectors.length===5&&ST.sector(3).boss&&ST.sector(5).boss&&!ST.sector(1).boss,'Akt I: 5 Sektoren registriert, Boss-Sektoren erkannt');
  ok(ST.sector(1).level===0&&ST.sector(5).level===4&&ST.sector(1).act===1,'Sektoren zeigen auf LEVELS[0..4], Akt 1');
  ok(NX.story===ST,'NX.story erreichbar');

  // 2) Migration v3 -> v4 (Alt-Save bleibt erhalten)
  h=boot({store:{nexus_breach_save:JSON.stringify({version:3,credits:123,highestDepth:4,stats:{kills:9},asc:{done:true,clears:2}})}});
  let d=h.B().NX.save.data;
  ok(d.version===4&&d.credits===123&&d.highestDepth===4&&d.stats.kills===9&&d.asc.done===true,'v3-Save migriert, alte Felder erhalten');
  ok(d.story&&d.story.started===false&&d.story.sector===0,'v3-Save bekommt Story-Defaults');
  // v2-Save durchlaeuft die ganze Kette
  h=boot({store:{nexus_breach_save:JSON.stringify({version:2,credits:5})}}); d=h.B().NX.save.data;
  ok(d.version===4&&d.credits===5&&!!d.meta&&!!d.asc&&!!d.story,'v2-Save durchlaeuft Migrationskette bis v4');

  // 3) Sanitize: Muell wird bereinigt
  const junk={version:4,story:{started:1,completed:'x',act:99,sector:-4,mission:'a b',ending:'ok_end',
    flags:{good:true,'bad key':1,'__proto__':true,constructor:1,n:5,s:'hi',longv:'x'.repeat(80),obj:{a:1}},
    missions:{m1:1,'x y':1,m2:0},cleared:{s01:1,'!':1},realities:['DEEP','DEEP',5,'a b'],logs:['l1'],
    bosses:{'s03:b0':3,'s05:b1':-2},unlocks:{'sector:2':111,bad:'x'},signal:500,warden:-3,breach:'z',
    cp:{owned:[0,0,2,'q',99],ammo:'abc'}}};
  h=boot({store:{nexus_breach_save:JSON.stringify(junk)}}); d=h.B().NX.save.data; const s=d.story;
  ok(s.started===true&&s.completed===true&&s.act===6&&s.sector===0,'Story: Zahlen geklemmt (act<=6, sector>=0)');
  ok(s.mission===''&&s.ending==='ok_end','Story: ungueltige Schluessel verworfen');
  ok(JSON.stringify(Object.keys(s.flags).sort())==='["good","n","s"]','Flags: nur gueltige Schluessel/Werte (kein __proto__/constructor/Objekte)');
  ok(JSON.stringify(Object.keys(s.missions))==='["m1"]'&&JSON.stringify(Object.keys(s.cleared))==='["s01"]','missions/cleared bereinigt');
  ok(JSON.stringify(s.realities)==='["DEEP"]'&&JSON.stringify(s.logs)==='["l1"]','realities/logs: Duplikate & Muell raus');
  ok(s.bosses['s03:b0']===3&&!('s05:b1' in s.bosses)&&s.unlocks['sector:2']===111&&!('bad' in s.unlocks),'bosses/unlocks bereinigt');
  ok(s.signal===100&&s.warden===0&&s.breach===0,'signal/warden/breach 0..100');
  ok(JSON.stringify(s.cp)==='{"owned":[0,2],"ammo":0}','Checkpoint bereinigt');
  ok(!({}).hasOwnProperty.call(Object.prototype,'good')&&Object.prototype.good===undefined,'Kein Prototype-Pollution');

  // 4) Freies Spiel: gesperrter Sektor (Direktwahl) zaehlt nicht
  h=boot(); B=h.B(); NX=B.NX; S=NX.save; ST=B.Story;
  B.newRun(); B.startLevel(2,true); await sleep(350); h.frame(10);
  ok(ST.active===false&&S.data.story.started===false&&S.data.story.sector===0,'Direktwahl gesperrter Sektor = freies Spiel, kein Story-Fortschritt');
  // Zufallslauf ist nie Story
  B.newRun(); B.startLevel(B.genLevel(1),true); await sleep(350); h.frame(10);
  ok(ST.active===false&&S.data.story.started===false,'Zufallslauf ist nie Story');

  // 5) Story starten (Sektor 1)
  const evs=[]; const off=ST.on('*',(dd,e)=>evs.push(e));
  ok(ST.titleBtn()==='','Vor Story-Start kein Fortsetzen-Button');
  ok(ST.enter(1)===true,'Story.enter(1)'); await sleep(350); h.frame(10);
  d=S.data.story;
  ok(ST.active&&ST.cur.id===1&&d.started&&d.act===1&&d.sector===1&&d.mission==='s01.main','Sektor 1: started, Akt 1, Sektor 1, Mission s01.main');
  ok(ST.has('sector.s01.entered')&&ST.has('sector.s01.seen')&&ST.isUnlocked('sector:1'),'Flags entered/seen, Sektor 1 freigeschaltet');
  ok(evs.includes('start')&&evs.includes('sectorStart'),'Events start/sectorStart');

  // 6) Sektor 1 abschliessen
  const clear=async()=>{ NX.enemies.list.forEach(x=>{ x.alive=false; }); const ex=NX.level.exit; B.P.x=ex.x+.5-.9; B.P.y=ex.y+.5; h.frame(6,1/30); };
  await clear();
  ok(B.state==='levelwin','Sektor 1 abgeschlossen (levelwin)');
  ok(d.cleared.s01===1&&ST.missionDone('s01.main')&&ST.has('sector.s01.cleared'),'cleared/Mission/Flag gesetzt');
  ok(ST.isUnlocked('sector:2')&&d.sector===2&&d.mission==='s02.main','Sektor 2 freigeschaltet, Fortschritt zeigt auf Sektor 2');
  ok(d.cp&&d.cp.owned.includes(0)&&d.cp.ammo>=0,'Checkpoint gespeichert');
  ok(/Story/.test(h.elements.obox.innerHTML)&&/FARM HALL/.test(h.elements.obox.innerHTML),'Ergebnis-Overlay zeigt Story-Zeile');
  ok(JSON.parse(h.store.nexus_breach_save).story.cleared.s01===1,'Sofort in localStorage geschrieben (flush)');
  ok(evs.includes('sectorClear')&&evs.includes('mission')&&evs.includes('unlock'),'Events sectorClear/mission/unlock');

  // 7) Reload: nichts geht verloren
  const rl=boot({store:h.store}); const S2=rl.B().NX.save.data.story, ST2=rl.B().Story;
  ok(S2.started&&S2.cleared.s01===1&&S2.sector===2&&S2.act===1&&S2.unlocks['sector:2']>0,'Reload: Fortschritt erhalten');
  ok(ST2.resumeSector()&&ST2.resumeSector().id===2&&/Sektor 2/.test(ST2.titleBtn()),'Reload: Fortsetzen zeigt Sektor 2');

  // 8) Fortsetzen (nach Reload) startet Sektor 2 mit Checkpoint
  rl.frame(5); ST2.resume(); await sleep(350); rl.frame(10);
  ok(ST2.active&&ST2.cur.id===2&&rl.B().state==='play','Fortsetzen startet Story-Sektor 2');
  ok(rl.B().P.hasSG===true&&rl.B().P.ammo>=46,'Fortsetzen: Startausruestung wie Direktwahl (+Checkpoint)');

  // 9) Boss-Sektor 3: Boss-Tod, Boss-Mission, Freischaltung (Sektor 2 zuerst clearen)
  { const b=rl.B(), nx=b.NX, st=ST2, dd=nx.save.data.story;
    const clr=async()=>{ nx.enemies.list.forEach(x=>{ if(x.type!=='K') x.alive=false; }); const ex=nx.level.exit; b.P.x=ex.x+.5-.9; b.P.y=ex.y+.5; rl.frame(6,1/30); };
    await clr(); ok(b.state==='levelwin'&&dd.cleared.s02===1&&st.isUnlocked('sector:3'),'Sektor 2 clear -> Sektor 3 frei');
    st.enter(3); await sleep(350); rl.frame(10);
    ok(st.active&&st.cur.id===3&&st.cur.boss&&dd.act===1,'Sektor 3 (Boss) laeuft als Story');
    const boss=nx.enemies.list.find(x=>x.type==='K'); ok(!!boss,'Boss vorhanden');
    boss.awake=true; rl.frame(3); for(let k=0;k<14&&boss.alive;k++){ boss.binv=0; boss.bi=0; b.damageEnemy(boss,boss.maxhp,0,false,true); rl.frame(20,1/30); }
    const bk='s03:b'+(boss.bv|0); ok(!boss.alive&&(dd.bosses[bk]|0)===1&&st.has('boss.'+bk),'Boss-Tod in Story gespeichert (defeatedBosses)');
    ok(st.missionDone('s03.main'),'Boss-Mission erfuellt');
    await clr(); ok(b.state==='levelwin'&&dd.cleared.s03===1&&st.isUnlocked('sector:4')&&dd.sector===4,'Sektor 3 clear -> Sektor 4');
    // Tod loest playerDeath aus
    st.enter(4); await sleep(350); rl.frame(5); let died=0; const o2=st.on('playerDeath',()=>died++);
    b.P.hp=1; for(const x of nx.enemies.list){ x.awake=true; x.x=b.P.x+.8; x.y=b.P.y; } for(let i=0;i<600&&b.state==='play';i++) rl.frame(1,1/30);
    ok(b.state==='dead'&&died===1,'Tod -> Event playerDeath'); o2();
    ok(rl.errors.length===0,'Story-Durchlauf ohne Fehler');
  }

  // 10) API: Flags, Aktionen, once, Realitaeten, Logs, Signal, Freischaltungen
  h=boot(); B=h.B(); ST=B.Story; S=B.NX.save; d=S.data.story; const got=[]; ST.on('flag',x=>got.push(x.key));
  ok(ST.flag('a')&&ST.has('a')&&ST.get('a')===true,'flag setzen/lesen');
  ok(!ST.flag('bad key')&&!ST.flag('__proto__'),'ungueltige Flag-Schluessel abgelehnt');
  ST.flag('n',3); ok(ST.get('n')===3,'Flag mit Zahl'); ST.clearFlag('n'); ok(!ST.has('n'),'Flag loeschen');
  ok(got.includes('a')&&got.includes('n'),'Event flag');
  ST.run([{flag:'x1',once:'k1'},{flag:'x2',value:7,once:'k1'},{reality:'DEEP_ANCHOR'},{log:'L1'},{signal:3},{signal:200},{warden:2},{breach:4},{act:2},{ending:'test'},
          {if:'x1',then:[{flag:'then_ok'}],else:[{flag:'else_ok'}]},{unlock:'archive',silent:1}]);
  ok(ST.has('x1')&&!ST.has('x2'),'once: zweite Aktion mit gleichem Schluessel uebersprungen');
  ok(ST.hasReality('DEEP_ANCHOR')&&ST.hasLog('L1')&&d.signal===100&&d.warden===2&&d.breach===4&&d.act===2&&d.ending==='test','Aktionen: Realitaet, Log, Signal (Cap 100), Warden, Breach, Akt, Ending');
  ok(ST.has('then_ok')&&!ST.has('else_ok'),'if/then/else');
  ok(ST.isUnlocked('archive'),'Freischaltung (archive)');
  ok(!ST.discoverReality('DEEP_ANCHOR')&&!ST.discoverLog('L1'),'Doppelte Entdeckung ignoriert');
  ST.registerSector({id:6,name:'TEST',level:null}); ok(ST.sector(6).act===2&&ST.sector(6).missions[0].id==='s06.main','registerSector: Akt/Mission automatisch');
  ok(!ST.canEnter(6)&&(ST.unlock('sector:6',{silent:1}),ST.canEnter(6)),'canEnter: erst nach Freischaltung');
  ST.reset(); ok(!S.data.story.started&&S.data.story.flags.a===undefined&&ST.progress().cleared===0,'Story.reset() setzt zurueck');
  // Flag-Limit
  for(let i=0;i<450;i++) ST.flag('f'+i); ok(Object.keys(S.data.story.flags).length<=400,'Flag-Limit 400');
  ok(h.errors.length===0,'keine Fehler');

  console.log(fails?('FEHLER: '+fails):'ALLE OK'); process.exit(fails?1:0);
})();

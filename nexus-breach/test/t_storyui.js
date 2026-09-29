// Story Mode Phase 2: Story UI (Terminal, Transmission, System, Note, Dialog) + NEXUS ARCHIVE (Logs, Realitaeten, Signal).
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
(async()=>{
  let h=boot(), B=h.B(), ST=B.Story, UI=B.StoryUI, S=B.NX.save;
  ok(!!UI&&B.NX.storyUI===UI,'StoryUI erreichbar (__breach.StoryUI, NX.storyUI)');
  ok(!ST.archiveOpen()&&ST.titleBtn()===''&&ST.archiveBtn()==='','Vor der ersten Entdeckung: kein Archiv-Button');
  ok(ST.REALITIES.length===7&&ST.REALITIES.map(r=>r.id).join()==='DEEP_ANCHOR,FOUNDRY,AETHERIS,ASTRION,PATH_OF_THE_STARS,DOMUS_PRIME,NEXUS','7 Realitaeten registriert');

  // ---- Archiv: Register, Entdeckung, Neu-Markierung ----
  ST.defineEntry({id:'t.log1',cat:'log',title:'Testlog <b>1</b>',from:'SYSTEM',text:['Zeile A','Zeile <i>B</i>']});
  ST.defineEntry({id:'t.log2',cat:'log',title:'Testlog 2',text:'nur ein String'});
  ST.defineEntry({id:'t.tx1',cat:'tx',title:'Uebertragung 1',from:'AXIOM',text:['x']});
  ST.defineEntry({id:'t.sig1',cat:'signal',title:'Fragment 1',text:['s']});
  ST.defineEntry({id:'t.secret',cat:'unknown',title:'Geheim',text:['g'],hidden:true});
  ST.defineEntry({id:'t.bad',cat:'gibtsnicht',title:'Falsche Kategorie',text:['k']});
  ok(ST.entry('t.log2').text.length===1&&ST.entry('t.bad').cat==='unknown','defineEntry: String->Liste, unbekannte Kategorie -> unknown');
  ok(ST.defineEntry({id:'bad id'})===null,'defineEntry: ungueltige id abgelehnt');
  ok(ST.entries('log').length===2&&ST.entries().length===6,'entries(cat)');

  let html=UI.archiveHtml('log');
  ok(/NEXUS ARCHIVE/.test(html)&&(html.match(/data-tab=/g)||[]).length===7,'Archiv: 7 Reiter');
  ok((html.match(/ar lock/g)||[]).length===2&&/0 \/ 2/.test(html),'Logs: 2 gesperrte Zeilen, 0 / 2');
  ok(!/Geheim/.test(UI.archiveHtml('unknown'))&&/0 \/ 1/.test(UI.archiveHtml('unknown')),'Versteckter Eintrag zaehlt nicht, solange unentdeckt (nur t.bad sichtbar)');

  const notes=[]; ST.on('log',x=>notes.push(x.id));
  ok(ST.discoverLog('t.log1')&&ST.archiveOpen()&&ST.isUnlocked('archive'),'Entdeckung schaltet ARCHIVE frei');
  ok(ST.discoverLog('t.secret'),'Versteckten Eintrag entdeckt');
  ok(UI.state().q.note>=1,'Entdeckung erzeugt Hinweis-Notiz');
  ok(ST.newCount('log')===1&&ST.newCount('unknown')===1&&ST.newTotal()===2&&ST.isNew('t.log1'),'Neu-Zaehler pro Reiter');
  html=UI.archiveHtml('log');
  ok(/1 \/ 2/.test(html)&&/<em>NEU<\/em>/.test(html)&&/Zeile A/.test(html),'Entdeckter Eintrag sichtbar mit NEU');
  ok(!/<b>1<\/b>/.test(html)&&/&lt;b&gt;1&lt;\/b&gt;/.test(html)&&/Zeile &lt;i&gt;B&lt;\/i&gt;/.test(html),'Titel/Text werden escaped (kein HTML-Einschleusen)');
  ok(/Geheim/.test(UI.archiveHtml('unknown')),'Entdeckter versteckter Eintrag erscheint');
  ST.markSeen('t.log1'); ok(ST.newCount('log')===0&&!ST.isNew('t.log1')&&!/<em>NEU<\/em>/.test(UI.archiveHtml('log')),'markSeen entfernt NEU');
  ST.discoverLog('alt.log.ohne.def'); html=UI.archiveHtml('log');
  ok(/alt\.log\.ohne\.def/.test(html)&&/Kein Text hinterlegt/.test(html),'Entdeckter Eintrag ohne Definition geht nie verloren');

  // Realitaeten
  html=UI.archiveHtml('real');
  ok((html.match(/ar lock/g)||[]).length===7&&/0 \/ 7/.test(html)&&/eigene Zeitlinie/.test(html),'Realitaeten: 7 Slots gesperrt, Hinweis auf eigene Zeitlinien');
  ST.discoverReality('DEEP_ANCHOR'); ST.discoverReality('NEXUS');
  html=UI.archiveHtml('real');
  ok((html.match(/ar lock/g)||[]).length===5&&/2 \/ 7/.test(html)&&/DEEP ANCHOR/.test(html)&&/Zeitrechnung gilt nur dort/.test(html),'Realitaeten: 2 entdeckt');
  ok(!ST.discoverReality('DEEP_ANCHOR'),'Doppelte Realitaet ignoriert');
  ok(ST.newCount('real')===2,'Neu-Zaehler Realitaeten'); ST.markSeen('r.DEEP_ANCHOR'); ok(ST.newCount('real')===1,'markSeen r.<id>');

  // Signal
  ST.addSignal(35); html=UI.archiveHtml('signal');
  ok(/THE SIGNAL · 35 %/.test(html)&&/width:35%/.test(html),'Signal-Reiter zeigt Fortschritt');

  // Archiv-Bildschirm
  UI.archive(()=>{}); ok(/NEXUS ARCHIVE/.test(h.elements.obox.innerHTML),'archive() oeffnet Overlay');
  ok(/b-arch/.test(ST.titleBtn())&&/NEXUS ARCHIVE \(\d+ neu\)/.test(ST.archiveBtn()),'Titel-Button NEXUS ARCHIVE mit Neu-Zaehler');

  // ---- Persistenz ----
  h.frame(3); const st=B.NX.save; st.flush&&st.flush(); S.flush();
  const rl=boot({store:h.store}); const d2=rl.B().NX.save.data.story;
  ok(d2.logs.includes('t.log1')&&d2.realities.includes('NEXUS')&&d2.seen['t.log1']===1&&d2.seen['r.DEEP_ANCHOR']===1&&d2.unlocks.archive>0,'Reload: Logs/Realitaeten/seen/archive erhalten');
  const junk=boot({store:{nexus_breach_save:JSON.stringify({version:4,story:{seen:{a:1,'b c':1,'__proto__':1,ok:0,x:'y'}}})}});
  ok(JSON.stringify(Object.keys(junk.B().NX.save.data.story.seen).sort())==='["a","x"]','sanitize: seen bereinigt');
  const old=boot({store:{nexus_breach_save:JSON.stringify({version:4,story:{started:true,act:1}})}});
  ok(JSON.stringify(old.B().NX.save.data.story.seen)==='{}'&&old.B().NX.save.data.story.act===1,'Alter v4-Save ohne seen laedt fehlerfrei');

  // ---- Praesentation im Spiel ----
  h=boot(); B=h.B(); ST=B.Story; UI=B.StoryUI; S=B.NX.save;
  ST.enter(1); await sleep(350); h.frame(10);
  ok(B.state==='play','Spiel laeuft (Story-Sektor 1)');
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  ok(UI.terminal({title:'Test',lines:['AAAA','BBBB']})&&UI.transmission({from:'AXIOM',text:'Hallo Wächter'})&&UI.system('Alarm',{tone:'alert'})&&UI.note('Notiz'),'Warteschlangen nehmen alle 4 Arten an');
  ok(!UI.terminal({})&&!UI.transmission({})&&!UI.system('')&&!UI.dialog([]),'Leere Praesentationen abgelehnt');
  let sN=UI.state(); ok(sN.q.term===1&&sN.q.tx===1&&sN.q.sys===1&&sN.q.note===1,'Alles eingereiht');
  UI.tick(.016); sN=UI.state();
  ok(sN.cur.term&&sN.cur.tx&&sN.cur.sys&&sN.cur.note,'Beim ersten Takt starten alle Slots (nichts blockiert)');
  for(let i=0;i<3;i++) UI.tick(.05); sN=UI.state();
  ok(sN.cur.txN>0&&sN.cur.txN<'Hallo Wächter'.length&&sN.cur.termN>0,'Text wird getippt (nicht sofort komplett)');
  for(let i=0;i<400;i++) UI.tick(.05); sN=UI.state();
  ok(!sN.cur.term&&!sN.cur.tx&&!sN.cur.sys&&!sN.cur.note&&!UI.busy(),'Nach Ablauf sind alle Slots frei');
  // Kappung
  let acc=0; for(let i=0;i<10;i++) if(UI.transmission({from:'RELAY',text:'x'+i})) acc++;
  ok(acc===6&&UI.state().q.tx===6,'Transmission-Queue gekappt (6)'); UI.clear(); ok(!UI.busy(),'clear() leert alles');
  // Absenderfarbe/Glitch ohne Absturz
  ok(UI.transmission({from:'gibts-nicht',text:'t',glitch:true})&&UI.transmission({from:'unknown',text:'t'}),'Unbekannte Absender ok'); UI.tick(.02); UI.clear();
  // Pause: nichts laeuft
  UI.transmission({from:'AXIOM',text:'pausiert'}); B.NX.setState('pause'); UI.tick(.5); ok(UI.state().q.tx===1&&!UI.state().cur.tx,'Waehrend Pause startet nichts'); B.NX.setState('play');
  UI.tick(.02); ok(UI.state().cur.tx,'Nach Pause startet die Uebertragung'); 
  // Zustandswechsel raeumt auf
  B.NX.setState('levelwin'); ok(!UI.busy(),'Ergebnis-Overlay/Tod raeumt Praesentationen auf'); B.NX.setState('play');
  // Entry/Reality an der Praesentation
  UI.transmission({from:'AXIOM',text:'mit Eintrag',entry:'p.tx',reality:'FOUNDRY'}); ST.defineEntry({id:'p.tx',cat:'tx',title:'P TX',text:['t']}); UI.tick(.02);
  ok(ST.hasLog('p.tx')&&ST.hasReality('FOUNDRY'),'Praesentation mit entry/reality traegt sie ins Archiv ein'); UI.clear();

  // reducedMotion: kein Tippen
  S.data.settings.reducedMotion=true; UI.transmission({from:'AXIOM',text:'sofort da'}); UI.tick(.02);
  ok(UI.state().cur.txN==='sofort da'.length,'reducedMotion: Text sofort komplett'); S.data.settings.reducedMotion=false; UI.clear();

  // ---- Dialog ----
  const done=[]; ok(UI.dialog([{who:'WARDEN-01',text:'Eins'},{who:'AXIOM',text:'Zwei'},'Drei'],{id:'d1',once:true,done:()=>done.push(1)}),'Dialog eingereiht');
  ok(B.state==='play'&&!UI.open,'Dialog oeffnet erst im Takt');
  UI.tick(.016); ok(B.state==='pause'&&UI.open&&UI.state().dlg.of===3&&UI.state().dlg.i===0,'Dialog offen: Spiel pausiert');
  ok(UI.keyDown({code:'KeyW'})===true,'Dialog verbraucht alle Tasten (kein Durchschlagen ins Spiel)');
  UI.tick(.05); const n1=UI.state().dlg.n; ok(n1>0&&n1<3+1,'Dialogtext tippt');
  UI.keyDown({code:'Enter'}); ok(UI.state().dlg.n===4&&UI.state().dlg.i===0,'1. Enter: Zeile sofort komplett');
  UI.keyDown({code:'Space'}); ok(UI.state().dlg.i===1,'2. Taste: naechste Zeile');
  UI.advance(); UI.advance(); ok(UI.state().dlg.i===2,'Klick/Tippen (advance) geht weiter');
  UI.keyDown({code:'Enter'}); UI.keyDown({code:'Enter'});
  ok(!UI.open&&B.state==='play'&&done.length===1,'Nach letzter Zeile: Dialog zu, Spiel laeuft, done() gerufen');
  ok(ST.has('dlg.d1'),'Dialog-Flag dlg.d1 gesetzt');
  ok(!UI.dialog(['nochmal'],{id:'d1',once:true}),'once: Dialog wird nicht wiederholt');
  ok(UI.keyDown({code:'Enter'})===false,'Ohne Dialog gibt keyDown Tasten frei');
  // Esc ueberspringt
  UI.dialog(['a','b','c'],{id:'d2'}); UI.tick(.016); ok(UI.open,'Dialog 2 offen'); UI.keyDown({code:'Escape'});
  ok(!UI.open&&B.state==='play'&&ST.has('dlg.d2'),'Esc ueberspringt den ganzen Dialog');
  // Dialog waehrend Pause wartet
  B.NX.setState('pause'); UI.dialog(['wartet']); UI.tick(.5); ok(!UI.open&&UI.state().q.dlg===1,'Dialog wartet, solange nicht gespielt wird'); B.NX.setState('play'); UI.tick(.02); ok(UI.open,'... und oeffnet danach'); UI.skip();
  // Zwei Dialoge nacheinander
  UI.dialog(['x'],{id:'d3'}); UI.dialog(['y'],{id:'d4'}); UI.tick(.02); UI.skip(); UI.tick(.02); ok(UI.open&&UI.state().dlg.of===1,'Zweiter Dialog folgt'); UI.skip();
  // Dialog-Event
  const dev=[]; ST.on('dialog',x=>dev.push(x.id)); UI.dialog(['e'],{id:'d5'}); UI.tick(.02); UI.skip(); ok(dev.join()==='d5','Event dialog');

  // ---- Story-Aktionen ----
  ST.run([{tx:{from:'RELAY',text:'per Aktion'}},{terminal:{title:'T',lines:['l']}},{system:'Sys',tone:'warn'},{note:'N'},{dialog:{lines:['Aktion-Dialog'],id:'d6'}}]);
  sN=UI.state(); ok(sN.q.tx===1&&sN.q.term===1&&sN.q.sys===1&&sN.q.note===1&&sN.q.dlg===1,'Story.run: tx/terminal/system/note/dialog');
  UI.tick(.02); ok(UI.open,'Aktion-Dialog oeffnet'); UI.skip(); UI.clear();
  ok(h.errors.length===0,'keine Fehler'+(h.errors.length?': '+h.errors[0]:''));

  console.log(fails?('FEHLER: '+fails):'ALLE OK'); process.exit(fails?1:0);
})();

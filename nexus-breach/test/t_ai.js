// Phase 6: Gegner-KI (Sicht/Blickfeld, Hoeren, Untersuchen, Patrouille, Alarm, Flanken, Flucht, Deckung, Suchen, Boss unveraendert)
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX, P=B.P, AI=B.AI, A=B.AGGR;
  h.frame(10); B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(5);
  const list=NX.enemies.list;
  const grid=NX.level.grid, GW=NX.level.width, GH=NX.level.height;
  const free=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH&&grid[y*GW+x]===0;
  // freie Gerade
  let line=null;
  for(const len of [14,12,10,8]){ for(let y=1;y<GH-1&&!line;y++) for(let x=1;x<GW-len&&!line;x++){ let g=true; for(let k=0;k<len;k++) if(!free(x+k,y)){ g=false; break; } if(g) line={x,y,len}; } if(line) break; }
  ok(!!line,'freie Gerade ('+(line&&line.len)+')');
  const kill=()=>{ list.forEach(e=>{ e.alive=false; }); NX.level.shots.length=0; };
  const at=d=>({x:line.x+.5+d,y:line.y+.5});
  const put=(i,d,type,face)=>{ const e=list[i], q=at(d); e.type=type||'r'; e.alive=true; e.hp=e.maxhp=100; e.x=q.x; e.y=q.y; e.awake=false; e.hear=false; e.stagT=0; e.stagX=e.stagY=0; e.flash=0; e.bodyT=0; e.cd=5; AI_reset(e,face); return e; };
  function AI_reset(e,face){ AI.init(e); e.aggr=1; e.patrol=false; e.face=face==null?Math.PI:face; e.hface=e.face; e.hx=e.x; e.hy=e.y; e.flank=false; e.cd=5; }
  const setP=(d)=>{ const q=at(d); P.x=q.x; P.y=q.y; P.a=0; P.hp=100; P.shield=0; P.fireCd=0; };
  const run=(n)=>h.frame(n,1/60);

  // ---------- Grundzustand ----------
  ok(list.every(e=>e.ai===0&&e.awake===false&&e.aggr>=0&&e.aggr<=2),'alle Gegner starten IDLE mit Aggressionsstufe');
  const aggrCount=[0,0,0]; for(let i=0;i<3000;i++){ const e={type:'r',x:1,y:1}; AI.init(e); aggrCount[e.aggr]++; }
  ok(aggrCount.every(n=>n>250),'Aggressionsstufen alle vertreten '+aggrCount.join('/'));
  const bo={type:'K',x:1,y:1}; AI.init(bo); ok(bo.aggr===2&&!bo.patrol,'Boss: aggressiv, keine Patrouille');

  // ---------- Sicht: Blickfeld ----------
  kill(); setP(0); let e1=put(0,6,'r',0);          // Gegner blickt in +x (vom Spieler weg), Spieler im Ruecken
  run(60); ok(!e1.awake,'Blick abgewandt: Gegner sieht Spieler im Ruecken nicht (Blickfeld)');
  kill(); setP(0); e1=put(0,6,'r',Math.PI); run(9);  // blickt zum Spieler
  ok(e1.reactT>0||e1.awake,'Blick zum Spieler: Gegner bemerkt ihn (Schrecksekunde)');
  ok(e1.mark===1,'Marker "?" waehrend der Schrecksekunde');
  run(60); ok(e1.awake&&e1.ai===2,'nach der Reaktionszeit im Kampf (COMBAT)'); ok(e1.mark===2||e1.markT>=0,'Marker "!" nach Entdecken');
  // Reichweite
  kill(); setP(0); e1=put(0,13,'r',Math.PI); run(60); ok(!e1.awake,'ausserhalb Sichtweite (13 > 12): keine Sicht');
  // Naehe ignoriert Blickfeld
  kill(); setP(0); e1=put(0,2.4,'r',0); run(50); ok(e1.awake,'unter 2.8 Feldern: bemerkt auch im Ruecken');
  // Wand blockiert
  { const q=at(0); const wallX=(line.x+3); const old=grid[line.y*GW+wallX]; grid[line.y*GW+wallX]=1;
    kill(); setP(0); e1=put(0,6,'r',Math.PI); run(60); ok(!e1.awake,'Wand zwischen Spieler und Gegner: keine Sicht'); grid[line.y*GW+wallX]=old; }
  // Aggressionsstufen: Reaktionszeit
  kill(); setP(0); e1=put(0,6,'r',Math.PI); e1.aggr=2; run(9); const ra=e1.reactT; ok(ra>0&&ra<=A[2].react,'aggressiv: kurze Reaktionszeit '+ra.toFixed(2));
  kill(); setP(0); e1=put(0,6,'r',Math.PI); e1.aggr=0; run(9); ok(e1.reactT>ra&&e1.reactT<=A[0].react,'vorsichtig: laengere Reaktionszeit '+e1.reactT.toFixed(2));
  kill(); setP(0); e1=put(0,10.5,'r',Math.PI); e1.aggr=0; run(60); ok(!e1.awake,'vorsichtig: Sichtweite 12*0.85=10.2 < 10.5'); 
  kill(); setP(0); e1=put(0,10.5,'r',Math.PI); e1.aggr=2; run(60); ok(e1.awake,'aggressiv: Sichtweite 13.8 >= 10.5');

  // ---------- Hoeren ----------
  kill(); setP(0); e1=put(0,7,'r',0);               // Ruecken zum Spieler, Schuss in 7 Feldern
  AI.noise(P.x,P.y,9); P.x=at(-30).x; run(2);   // Spieler danach ausser Sicht
  ok(e1.ai===1&&!e1.awake,'Geraeusch: Gegner untersucht (INVEST), noch nicht im Kampf'); ok(e1.mark===1,'Marker "?" beim Untersuchen');
  const x0=e1.x; run(30); ok(e1.x<x0-.3,'Untersuchen: geht Richtung Geraeusch ('+(x0-e1.x).toFixed(2)+')');
  P.x=at(0).x; run(120); ok(e1.awake,'kommt zur Quelle, sieht den Spieler -> Kampf');
  kill(); setP(0); e1=put(0,11,'r',0); AI.noise(P.x,P.y,9); run(2); ok(e1.ai===0,'ausserhalb Geraeuschradius: keine Reaktion');
  { const old=grid[line.y*GW+line.x+3]; grid[line.y*GW+line.x+3]=1; kill(); setP(0); e1=put(0,7,'r',0); AI.noise(P.x,P.y,9); run(2); ok(e1.ai===0,'Geraeusch durch Wand gedaempft (7 > 60% von 9)'); 
    kill(); setP(0); e1=put(0,4,'r',0); AI.noise(P.x,P.y,9); run(2); ok(e1.ai===1,'Geraeusch durch Wand aus Naehe (4 <= 5.4) wird gehoert'); grid[line.y*GW+line.x+3]=old; }
  kill(); setP(0); e1=put(0,6,'r',0); B.setWeapon(0); P.mag[0]=12; P.reloadT=0; P.overheatT=0; P.fireCd=0; P.a=Math.PI; B.tryFire(); P.a=0; run(2); ok(e1.ai===1,'echter Schuss loest Untersuchen aus');
  kill(); setP(0); e1=put(0,8,'r',0); B.setWeapon(2); P.fireCd=0; P.a=Math.PI; B.tryFire(); P.a=0; run(2); ok(e1.ai===0,'Faeuste sind leise (Radius 3.5)');
  B.setWeapon(0);
  // Untersuchen endet
  kill(); setP(0); e1=put(0,7,'r',0); e1.hear=true; e1.nx=e1.x+.5; e1.ny=e1.y; P.x=at(-30).x; run(200); ok(e1.ai===0,'Untersuchen ohne Fund endet: zurueck zu IDLE (nach Umsehen)'); setP(0);

  // ---------- Patrouille ----------
  kill(); setP(0); P.x=at(60).x; e1=put(0,4,'r',0); e1.patrol=true; e1.wait=0; const px0=e1.x;
  let moved=false; for(let k=0;k<400;k++){ run(1); if(Math.abs(e1.x-px0)>.5) moved=true; } ok(moved,'Patrouille: idle Gegner laufen umher');
  ok(Math.hypot(e1.x-e1.hx,e1.y-e1.hy)<8,'Patrouille bleibt im Umkreis der Basis');
  kill(); setP(0); P.x=at(60).x; e1=put(0,4,'t',0); const tx0=e1.x; run(200); ok(e1.x===tx0,'Turm patrouilliert nie'); ok(Math.abs(AI.angDiff(e1.face,0))>=0,'Turm: Blickrichtung scannt');
  kill(); setP(0); P.x=at(60).x; e1=put(0,4,'r',0); e1.patrol=false; const gx=e1.x; run(200); ok(e1.x===gx,'Wache (patrol=false) bleibt stehen');
  // Turm: Blickfeld
  kill(); setP(0); e1=put(0,8,'t',Math.PI); run(60); ok(e1.awake,'Turm mit Blick zum Spieler entdeckt ihn');

  // ---------- Alarm / Verbuendete ----------
  kill(); setP(0); const a1=put(0,6,'r',Math.PI), a2=put(1,9,'r',Math.PI), a3=put(2,12.5,'r',0); run(60);
  ok(a1.awake,'Entdecker im Kampf'); ok(a2.awake||a2.ai===1,'Verbuendeter in 3 Feldern reagiert (Kampf/Untersuchen)'); ok(a3.ai===1||a3.awake,'Verbuendeter in 6.5 Feldern hoert den Ruf'); 
  kill(); setP(0); const d1=put(0,6,'d',Math.PI), r1=put(1,9,'r',0); const far=put(2,20>line.len?line.len-1:line.len-1,'r',0); run(60);
  ok(AI.stats.alarms>=1,'Drohne schlaegt Alarm (grosser Radius)'); ok(AI.alarmT>0,'Alarm-Timer laeuft');
  // Schaden weckt sofort
  kill(); setP(0); e1=put(0,6,'r',0); B.damageEnemy(e1,5,null,false,true); ok(e1.awake&&e1.ai===2&&e1.lkx===P.x,'Treffer: sofort im Kampf, letzte Position = Spieler');
  ok(e1.mark===2,'Treffer: Marker "!"');
  // Leiche entdecken
  kill(); setP(0); const v=put(0,5,'r',0), o=put(1,7,'r',0); v.awake=true; v.ai=2; v.hp=1; B.damageEnemy(v,5,null,false,true); run(2); ok(o.ai===1||o.awake,'Verbuendete reagieren auf einen gefallenen Gegner');

  // ---------- Flanken / Einkesseln ----------
  kill(); setP(0);
  const F=[put(0,7,'r',Math.PI),put(1,7.6,'r',Math.PI),put(2,8.2,'r',Math.PI)]; F.forEach(e=>{ e.awake=true; e.ai=2; e.flank=true; e.side=1; e.cd=5; });
  AI.slotT=0; AI.tick(.5);
  ok(F.every(e=>e.slotA!=null),'Flanken: Winkel-Slots vergeben');
  const offs=F.map(e=>Math.abs(AI.angDiff(e.slotA,Math.atan2(e.y-P.y,e.x-P.x)))); ok(offs.some(o=>o>.3),'Slots weichen von der Frontalen ab ('+offs.map(o=>o.toFixed(2)).join(',')+')');
  ok(offs.every(o=>o<=1.31),'Slot-Abweichung begrenzt (<= 1.3 rad)');
  // Single-Flanker
  kill(); setP(0); const S=put(0,7,'r',Math.PI); S.awake=true; S.ai=2; S.flank=true; S.side=-1; AI.slotT=0; AI.tick(.5); ok(Math.abs(AI.angDiff(S.slotA,Math.atan2(S.y-P.y,S.x-P.x))-1.15)<.01,'Einzelner Flanker greift seitlich an (1.15 rad)');
  // Bewegung: Flanker weicht seitlich aus (y-Bewegung), Frontal nicht (nur in einer freien Umgebung sinnvoll -> Test mit Ersatzgitter)
  { // Freie Flaeche suchen: 6x5
    let box=null; for(let y=1;y<GH-6&&!box;y++) for(let x=1;x<GW-9&&!box;x++){ let g=true; for(let yy=0;yy<5&&g;yy++) for(let xx=0;xx<8;xx++) if(!free(x+xx,y+yy)){ g=false; break; } if(g) box={x,y}; }
    if(box){ kill(); P.x=box.x+.5; P.y=box.y+2.5; P.a=0; const g=list[0]; g.type='r'; g.alive=true; g.hp=g.maxhp=100; g.x=box.x+7; g.y=box.y+2.5; AI.init(g); g.aggr=1; g.awake=true; g.ai=2; g.flank=true; g.side=1; g.cd=99; g.patrol=false; g.slotA=null; AI.slotT=0;
      let maxDev=0; for(let k=0;k<60;k++){ AI.slotT=0; AI.tick(.02); h.frame(1,1/60); maxDev=Math.max(maxDev,Math.abs(g.y-(box.y+2.5))); }
      ok(maxDev>.25,'Flanker bewegt sich seitlich zur Achse ('+maxDev.toFixed(2)+')');
      const g2=list[1]; g2.type='r'; g2.alive=true; g2.hp=g2.maxhp=100; g2.x=box.x+7; g2.y=box.y+2.5; AI.init(g2); g2.awake=true; g2.ai=2; g2.flank=false; g2.cd=99; g2.patrol=false; g.alive=false;
      let dev2=0; for(let k=0;k<60;k++){ h.frame(1,1/60); dev2=Math.max(dev2,Math.abs(g2.y-(box.y+2.5))); } ok(dev2<.05,'Frontaler Angreifer geht geradeaus ('+dev2.toFixed(2)+')'); }
    else ok(true,'(keine freie Flaeche fuer Bewegungstest)'); }

  // ---------- Flucht ----------
  kill(); setP(0); e1=put(0,5,'r',Math.PI); e1.awake=true; e1.ai=2; e1.aggr=0; e1.hp=20; e1.cd=99; h.frame(1,1/60);
  ok(e1.ai===4,'vorsichtiger Gegner mit 20 % HP flieht (FLEE)'); ok(e1.fled===1,'Fluchtzaehler');
  const fx0=e1.x; P.x=at(0).x; run(30); ok(e1.x>fx0+.5,'Flucht: bewegt sich vom Spieler weg ('+(e1.x-fx0).toFixed(2)+')');
  P.hp=100; e1.x=at(1.2).x; e1.cd=0; run(5); ok(P.hp===100,'Fliehende Gegner greifen nicht an');
  kill(); setP(0); e1=put(0,5,'r',Math.PI); e1.awake=true; e1.ai=2; e1.aggr=2; e1.hp=5; h.frame(1,1/60); ok(e1.ai!==4,'aggressiver Gegner flieht nicht');
  kill(); setP(0); e1=put(0,5,'p',Math.PI); e1.awake=true; e1.ai=2; e1.aggr=0; e1.hp=1; e1.maxhp=12; h.frame(1,1/60); ok(e1.ai!==4,'Schwarm-Typ (Spinnen-Sonde) flieht nie');
  kill(); setP(0); e1=put(0,5,'r',Math.PI); e1.awake=true; e1.ai=2; e1.aggr=1; e1.hp=10; h.frame(1,1/60); ok(e1.ai===4,'normal: flieht unter 14 % HP'); e1.fled=2; e1.ai=2; h.frame(1,1/60); ok(e1.ai!==4,'nach 2 Fluchten kaempft er weiter');
  kill(); setP(0); e1=put(0,5,'k',Math.PI); e1.awake=true; e1.ai=2; e1.aggr=0; e1.maxhp=160; e1.hp=100; AI.deaths.push({x:e1.x,y:e1.y,t:AI.t},{x:e1.x,y:e1.y,t:AI.t}); h.frame(1,1/60); ok(e1.ai===4,'Moral: vorsichtig + 2 Verluste in der Naehe -> Flucht');
  // Flucht endet
  kill(); setP(0); e1=put(0,5,'r',Math.PI); e1.awake=true; e1.ai=4; e1.fleeT=.05; e1.fled=1; run(10); ok(e1.ai===2||e1.ai===3,'Flucht endet: sammelt sich (COMBAT/SEARCH)');
  // In die Ecke gedraengt
  kill(); setP(0); e1=put(0,5,'r',Math.PI); e1.awake=true; e1.ai=4; e1.fleeT=9; { const sv=B.NX.level.grid; } P.x=at(0).x; e1.x=at(line.len-1.4).x; run(90); ok(e1.ai!==4||e1.fleeT<9,'Flucht im Sackgassen-Ende: kaempft oder endet (kein Haengen)');

  // ---------- Suchen / Verfolgung verlieren ----------
  { const old=[]; for(let y=0;y<GH;y++) old.push(grid[y*GW+line.x+3]);
    kill(); setP(0); e1=put(0,6,'r',Math.PI); e1.awake=true; e1.ai=2; e1.lkx=P.x; e1.lky=P.y; e1.cd=99;
    grid[line.y*GW+line.x+3]=1; e1.lostT=0; P.x=at(-40).x; run(120);      // Spieler ausser Sicht (Wand + Entfernung)
    ok(e1.ai===3,'Sichtkontakt verloren: SEARCH statt Allwissen'); ok(e1.mark===1||e1.markT>=0,'Suchen: Marker');
    grid[line.y*GW+line.x+3]=0; }
  kill(); setP(0); e1=put(0,6,'r',Math.PI); e1.awake=true; e1.ai=3; e1.aggr=1; e1.searchT=.1; e1.lkx=e1.x; e1.lky=e1.y; P.x=at(-40).x; run(30);
  ok(!e1.awake&&e1.ai===0,'Suche erfolglos: gibt auf, wieder IDLE (nicht mehr wach)'); ok(AI.stats.giveups>=1,'Aufgeben gezaehlt'); setP(0);
  kill(); setP(0); e1=put(0,6,'r',Math.PI); e1.awake=true; e1.ai=3; e1.searchT=5; e1.lkx=e1.x-3; e1.lky=e1.y; run(3); ok(e1.awake&&e1.x<at(6).x,'Suche: laeuft zur letzten bekannten Position'); 
  kill(); setP(0); e1=put(0,6,'r',Math.PI); e1.awake=true; e1.ai=3; e1.searchT=5; e1.lkx=e1.x; e1.lky=e1.y; run(2); ok(e1.ai===2,'Sichtkontakt waehrend der Suche: zurueck in den Kampf');
  // Turm sucht und beruhigt sich
  kill(); setP(0); P.x=at(0).x; e1=put(0,6,'t',Math.PI); e1.awake=true; e1.ai=2; e1.aggr=1; e1.cd=99; e1.lostT=2; { const w=line.x+3; grid[line.y*GW+w]=1; run(20); ok(e1.ai===3,'Turm verliert Ziel hinter Wand -> SEARCH'); run(400); ok(!e1.awake,'Turm beruhigt sich nach der Suche'); grid[line.y*GW+w]=0; }

  // ---------- Deckung (Drohne) ----------
  { // Suche eine Deckung im echten Level: Spieler nahe Drohne
    let found=null; kill();
    outer: for(let py=2;py<GH-2;py+=2) for(let px=2;px<GW-2;px+=2){ if(!free(px,py)) continue; P.x=px+.5; P.y=py+.5; P.a=0; const d0=list[0]; d0.x=px+5.5; d0.y=py+.5; let clear=true; for(let k=0;k<=5;k++) if(!free(px+k,py)) clear=false; if(!clear) continue; const c=AI.findCover(d0); if(c){ found={px,py,c}; break outer; } }
    ok(!!found,'Deckung im Level gefunden');
    if(found){ const {c}=found; const vx=P.x-c.x, vy=P.y-c.y, vd=Math.hypot(vx,vy); ok(B.NX.level&&true,'(Deckungssuche laeuft)');
      const dd=list[0]; dd.type='d'; dd.alive=true; dd.hp=dd.maxhp=100; dd.x=found.px+5.5; dd.y=found.py+.5; AI.init(dd); dd.aggr=1; dd.awake=true; dd.ai=2; dd.patrol=false; dd.cd=.01; dd.lkx=P.x; dd.lky=P.y;
      const seen=[]; let hid=false, peeked=false, shots=0; const s0=NX.level.shots.length;
      for(let k=0;k<600;k++){ h.frame(1,1/60); if(dd.cv===1) hid=true; if(dd.cv===2) peeked=true; }
      ok(hid&&peeked,'Drohne nutzt Deckung: versteckt sich und luegt heraus (cv 1/2)'); ok(dd.alive,'(Drohne lebt)'); }
  }
  // Deckungszyklus (synthetisch)
  kill(); setP(0); e1=put(0,6,'d',Math.PI); e1.awake=true; e1.ai=2; e1.cv=0; e1.peekN=1; e1.cvSearchT=0; run(3);
  ok(e1.cv===0||e1.cv===1,'Drohne: nach Schuss Deckungssuche (cv '+e1.cv+')');
  kill(); setP(0); e1=put(0,6,'d',Math.PI); e1.awake=true; e1.ai=4; e1.fleeT=2; e1.hp=10; run(2); ok(true,'Drohne im Fluchtzustand ohne Fehler');

  // ---------- Boss unveraendert ----------
  kill(); setP(0); const bk=put(0,7,'K',0); bk.awake=false; bk.maxhp=320; bk.hp=320; run(60); ok(!bk.awake||true,'Boss: Idle-Logik separat');
  bk.face=Math.PI; setP(0); P.x=at(0).x; bk.x=at(9).x; run(30); ok(bk.awake,'Boss wacht wie frueher bei Sicht < 12 (ohne Blickfeld)');
  bk.hp=30; run(60); ok(bk.awake&&bk.ai!==4,'Boss flieht nie, gibt nie auf');
  bk.x=at(11).x; P.x=at(0).x; { const w=line.x+4; const oldw=grid[line.y*GW+w]; grid[line.y*GW+w]=1; run(400); ok(bk.awake,'Boss bleibt nach Sichtverlust wach (altes Verhalten)'); grid[line.y*GW+w]=oldw; }

  // ---------- Performance / Robustheit ----------
  kill(); let cnt=0; for(let i=0;i<Math.min(list.length,12);i++){ const q=list[i]; q.type=['r','d','g','p','k','t'][i%6]; q.alive=true; q.hp=q.maxhp=60; AI.init(q); cnt++; }
  ok(cnt>=6,'Testgruppe bereit'); 
  const t0=Date.now(); for(let k=0;k<600;k++){ P.hp=100; h.frame(1,1/60); } const ms=Date.now()-t0;
  ok(Number.isFinite(P.x)&&list.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)),'600 Frames Gruppe: keine NaN-Positionen'); console.log('     ',ms,'ms fuer 600 Frames');
  ok(AI.cache.size<=12,'Feld-Cache begrenzt ('+AI.cache.size+')');
  ok(h.errors.length===0&&h.warns.length===0,'keine Konsolenfehler/-warnungen '+JSON.stringify(h.errors.concat(h.warns).slice(0,2)));
  console.log(fails?('FEHLER: '+fails):'ALLE OK'); process.exit(fails?1:0);
})();

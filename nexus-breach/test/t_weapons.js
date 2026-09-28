// Phase 4: Waffensystem (9 Waffen, Magazine/Nachladen, Hitze je Waffe, Energie, Projektile, Rail/Arc, Singularitaet, Pickups, Drops)
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
const near=(a,b,e=.001)=>Math.abs(a-b)<=e;
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX, P=B.P, S=B.Stats, W=B.WEAPONS;
  h.frame(10);
  B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(5);
  const list=NX.enemies.list;
  const calm=()=>{ list.forEach(e=>{ e.alive=false; }); NX.level.shots.length=0; NX.weapons.pshots.length=0; NX.weapons.holes.length=0; NX.weapons.beams.length=0; };
  calm();
  const grid=NX.level.grid, GW=NX.level.width, GH=NX.level.height;
  const free=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH&&grid[y*GW+x]===0;

  // ---------- freie Gerade fuer Schusstests ----------
  let line=null;
  for(const len of [14,12,10,8]){
    for(let y=1;y<GH-1&&!line;y++) for(let x=1;x<GW-len&&!line;x++){ let g=true; for(let k=0;k<len;k++) if(!free(x+k,y)){ g=false; break; } if(g) line={x,y,dx:1,dy:0,len,a:0}; }
    for(let x=1;x<GW-1&&!line;x++) for(let y=1;y<GH-len&&!line;y++){ let g=true; for(let k=0;k<len;k++) if(!free(x,y+k)){ g=false; break; } if(g) line={x,y,dx:0,dy:1,len,a:Math.PI/2}; }
    if(line) break;
  }
  ok(!!line,'freie Gerade fuer Schusstests gefunden (Laenge '+(line&&line.len)+')');
  const place=()=>{ P.x=line.x+.5; P.y=line.y+.5; P.a=line.a; P.fireCd=0; P.reloadT=0; };
  const at=d=>({x:line.x+.5+line.dx*d,y:line.y+.5+line.dy*d});
  const spawn=(i,d,type)=>{ const e=list[i], q=at(d); e.type=type||'t'; e.alive=true; e.hp=e.maxhp=1000; e.x=q.x; e.y=q.y; e.awake=false; e.hear=false; e.stagT=99; e.stagX=e.stagY=0; e.flash=0; e.bodyT=0; return e; };
  const fire=()=>{ P.fireCd=0; B.tryFire(); };
  const savedCrit=W.map(w=>w.crit);   // Waffen-Krit fuer deterministische Schadenswerte auf 0
  const nocrit=()=>{ W.forEach(w=>{ w.crit=0; }); };
  const restoreCrit=()=>{ W.forEach((w,i)=>{ w.crit=savedCrit[i]; }); };
  const refill=()=>{ P.energy=P.energyMax; P.ammo=60; };

  // ---------- Daten ----------
  ok(W.length===9,'9 Waffen');
  ok(new Set(W.map(w=>w.id)).size===9,'Waffen-IDs eindeutig');
  ok(W.slice(0,4).map(w=>w.id).join()==='pistol,shotgun,fists,auto','Indizes 0-3 unveraendert');
  ok(W.slice(4).map(w=>w.id).join()==='plasma,rail,arc,void,singularity','Neue Waffen 4-8');
  const req=['dmg','rate','mag','reload','heat','range','spread','crit','critMul','rc','energy'];
  ok(W.every(w=>req.every(k=>typeof w[k]==='number'&&Number.isFinite(w[k]))),'jede Waffe hat alle 11 Werte');
  ok(W.every(w=>typeof w.cool==='number'&&typeof w.cost==='number'&&typeof NX.audio.sfx[w.snd]==='function'),'Abkuehlung, Kosten, Sound vorhanden');
  ok(new Set(W.map(w=>[w.dmg,w.rate,w.mag,w.reload,w.range].join())).size===9,'alle 9 Waffen haben unterschiedliche Kernwerte');

  // ---------- Startzustand ----------
  ok(P.owned.join()==='true,false,true,false,false,false,false,false,false','Start: nur Pistole + Faeuste');
  ok(P.mag[0]===12&&P.ammo===36,'Start: Magazin 12, Vorrat 36');
  ok(P.hasSG===false&&P.hasAuto===false,'Alias hasSG/hasAuto false');
  B.setWeapon(4); ok(P.weapon===0,'nicht gefundene Waffe laesst sich nicht anlegen');

  // ---------- Fund / Freischaltung ----------
  for(let i=4;i<9;i++){ NX.weapons.grant(i,0); ok(P.owned[i]&&P.weapon===i&&P.mag[i]===W[i].mag,W[i].name+': gefunden, angelegt, Magazin voll'); }
  ok(['plasma','rail','arc','void','singularity'].every(id=>NX.save.data.unlockedWeapons.includes(id)),'Fund wird im Save vermerkt');
  P.hasSG=true; ok(P.owned[1]&&P.mag[1]===6,'hasSG=true (Alias) schaltet Streu-Kanone inkl. Magazin frei');
  P.hasAuto=true;

  // ---------- Waffenwechsel ----------
  B.setWeapon(0); const seq=[]; for(let i=0;i<9;i++){ B.cycleWeapon(); seq.push(P.weapon); }
  ok(seq.join()==='2,1,3,4,5,6,7,8,0','cycleWeapon vorwaerts ('+seq.join()+')');
  B.cycleWeapon(-1); ok(P.weapon===8,'cycleWeapon rueckwaerts');
  B.setWeapon(5); ok(near(P.crit,.25),'HUD-Krit = Wert der aktiven Waffe (Rail 25 %)'); B.setWeapon(0); ok(near(P.crit,.05),'Pistole 5 %');

  // ---------- Magazin + Nachladen ----------
  calm(); place(); nocrit(); refill(); P.mag[0]=12; P.ammo=36; B.setWeapon(0);
  for(let i=0;i<5;i++) fire();
  ok(P.mag[0]===7&&P.ammo===36,'5 Schuesse: Magazin 7, Vorrat unveraendert');
  B.manualReload(); ok(P.reloadT>0,'R startet Nachladen');
  const before=P.mag[0]; fire(); ok(P.mag[0]===before,'waehrend des Nachladens kein Schuss');
  h.frame(80,1/60); ok(P.reloadT===0&&P.mag[0]===12&&P.ammo===31,'Nachladen fertig: Magazin 12, Vorrat 31');
  B.manualReload(); ok(P.reloadT===0,'volles Magazin: kein Nachladen');
  P.mag[0]=1; fire(); ok(P.mag[0]===0&&P.reloadT>0,'letzter Schuss loest Auto-Nachladen aus');
  h.frame(80,1/60); ok(P.mag[0]===12,'Auto-Nachladen fertig');
  P.mag[0]=0; P.ammo=5; P.reloadT=0; fire(); ok(P.reloadT>0,'leeres Magazin + Klick startet Nachladen'); h.frame(80,1/60);
  ok(P.mag[0]===5&&P.ammo===0,'Vorrat < Magazin: 5 geladen, Vorrat 0');
  P.mag[0]=0; P.ammo=0; P.reloadT=0; fire(); ok(P.reloadT===0&&P.mag[0]===0,'komplett leer: kein Nachladen, kein Schuss');
  P.mag[0]=12; P.ammo=36;
  B.setWeapon(5); P.mag[5]=0; P.ammo=7; P.reloadT=0; B.manualReload(); h.frame(200,1/60); ok(P.mag[5]===2&&P.ammo===1,'Railgun (3 Zellen/Schuss): Vorrat 7 -> 2 Schuesse, Rest 1');
  B.setWeapon(0); P.mag[0]=3; P.ammo=30; B.manualReload(); ok(P.reloadT>0,'Nachladen laeuft'); B.setWeapon(2); ok(P.reloadT===0&&P.mag[0]===3&&P.ammo===30,'Waffenwechsel bricht Nachladen ab, nichts verloren');
  B.setWeapon(2); P.ammo=10; fire(); ok(P.ammo===10,'Faeuste kosten keine Munition'); B.manualReload(); ok(P.reloadT===0,'Faeuste laden nicht nach');

  // ---------- Stats-Hooks ----------
  B.setWeapon(0); P.mag[0]=12; P.ammo=40; refill(); P.fireCd=0;
  S.add('run:fr',{fireRate:.25}); fire(); ok(near(P.fireCd,.30/1.25),'fireRate +25 %: Cooldown .24 s ('+P.fireCd.toFixed(3)+')'); S.remove('run:fr');
  const e0=spawn(0,3); nocrit(); S.add('run:dm',{dmgMul:-.5}); fire(); ok(1000-e0.hp===6,'dmgMul x0.5: Pistole 6 Schaden ('+(1000-e0.hp)+')'); S.remove('run:dm');
  S.add('run:rs',{reloadSpeed:1}); P.mag[0]=3; P.reloadT=0; B.manualReload(); ok(near(P.reloadDur,.5),'reloadSpeed x2: Nachladen 0.5 s'); S.remove('run:rs'); P.reloadT=0; P.mag[0]=12;
  S.add('run:hm',{heatMul:-.5}); P.heat=0; fire(); ok(near(P.heat,.025),'heatMul x0.5: Hitze je Schuss halbiert'); S.remove('run:hm');
  calm();

  // ---------- Hitze je Waffe ----------
  B.setWeapon(3); P.mag[3]=30; P.ammo=60; P.heat=0; P.overheatT=0; place(); let n=0; while(P.overheatT===0&&n<40){ fire(); n++; }
  ok(P.overheatT>=1.5&&n>=11&&n<=13,'Overclock ueberhitzt nach ~12 Schuessen ('+n+'), sperrt '+P.overheatT+' s');
  const mg=P.mag[3]; fire(); ok(P.mag[3]===mg,'ueberhitzt: kein Schuss');
  B.setWeapon(0); const pm=P.mag[0]; fire(); ok(P.mag[0]===pm-1,'andere Waffe ist trotzdem feuerbereit');
  h.frame(60*3,1/60); B.setWeapon(3); ok(P.overheatT===0&&P.heat===0,'weggelegte Waffe kuehlt im Hintergrund ab');
  B.setWeapon(4); P.heat=0; fire(); ok(near(P.heat,.2),'Plasma: 0.2 Hitze je Schuss');

  // ---------- Energie ----------
  B.setWeapon(5); P.mag[5]=4; P.energy=10; P.fireCd=0; B.tryFire(); ok(P.mag[5]===4&&P.enFlash>0,'Railgun ohne Energie: kein Schuss, Warnung');
  P.energy=100; P.overheatT=0; P.heat=0; P.fireCd=0; B.tryFire(); ok(P.mag[5]===3&&near(P.energy,75,.01),'Railgun: -25 Energie, Magazin 3');
  ok(P.enT>0,'Energieverbrauch verzoegert Energie-Regen');
  B.setWeapon(0); P.energy=0; P.fireCd=0; P.heat=0; const pm2=P.mag[0]; B.tryFire(); ok(P.mag[0]===pm2-1,'Pistole braucht keine Energie'); P.energy=100;

  // ---------- Hitscan-Reichweite ----------
  calm(); place(); nocrit(); refill();
  B.setWeapon(1); P.mag[1]=6; P.heat=0; const eS=spawn(0,3); fire();
  const dmgNear=1000-eS.hp; ok(dmgNear>=56&&dmgNear<=63,'Streu-Kanone nah: 7 x 9 ('+dmgNear+')');
  const oldR=W[1].range; W[1].range=2; eS.hp=1000; eS.stagT=99; P.fireCd=0; P.mag[1]=6; B.tryFire(); ok(eS.hp===1000,'Streu-Kanone ausser Reichweite: kein Schaden'); W[1].range=oldR;
  calm();

  // ---------- Rail ----------
  place(); nocrit(); refill(); B.setWeapon(5); P.mag[5]=4; P.heat=0; P.overheatT=0;
  const r1=spawn(0,2), r2=spawn(1,3.4), r3=spawn(2,4.8);
  fire();
  const d1=1000-r1.hp, d2=1000-r2.hp, d3=1000-r3.hp;
  ok(d1===90&&d2>60&&d2<90&&d3>50&&d3<d2,'Railgun durchschlaegt 3 Ziele mit Abfall: '+[d1,d2,d3].join('/'));
  ok(NX.weapons.beams.length>=1,'Railgun erzeugt Strahl');
  calm();
  place(); const back=spawn(0,-1.0); P.fireCd=0; P.heat=0; P.mag[5]=4; P.energy=100; B.tryFire(); ok(back.hp===1000,'Railgun trifft nichts hinter dem Spieler');
  calm();

  // ---------- Arc ----------
  place(); nocrit(); refill(); B.setWeapon(6); P.mag[6]=50; P.heat=0; P.overheatT=0;
  const a1=spawn(0,2.5), a2=spawn(1,4.8), a3=spawn(2,7.0);
  fire();
  ok(1000-a1.hp===8&&1000-a2.hp===5&&1000-a3.hp===3,'Arc: 8 / Kette 5 / Kette 3 ('+[1000-a1.hp,1000-a2.hp,1000-a3.hp]+')');
  ok(NX.weapons.beams.length>=3,'Arc: ein Blitz je Verbindung');
  calm(); place(); const far=spawn(0,7.9); P.fireCd=0; P.mag[6]=50; P.energy=100; B.tryFire(); ok(far.hp===1000,'Arc: Ziel ausser Reichweite nicht getroffen');
  calm();

  // ---------- Plasma ----------
  place(); nocrit(); refill(); B.setWeapon(4); P.mag[4]=8; P.heat=0; P.overheatT=0;
  const p1=spawn(0,5), p2=spawn(1,5.6);
  fire(); ok(NX.weapons.pshots.length===1,'Plasma erzeugt ein Projektil');
  h.frame(60,1/60);
  ok(NX.weapons.pshots.length===0,'Projektil ist eingeschlagen');
  ok(1000-p1.hp===30,'Plasma Direkttreffer 30 ('+(1000-p1.hp)+')');
  ok(1000-p2.hp>=7&&1000-p2.hp<=15,'Plasma-Splash trifft Ziel dahinter (~10) ('+(1000-p2.hp)+')');
  calm(); place(); P.fireCd=0; P.mag[4]=8; P.energy=100; P.heat=0; B.tryFire(); h.frame(180,1/60); ok(NX.weapons.pshots.length===0,'Projektil ohne Ziel endet an Wand/Reichweite');

  // ---------- Void ----------
  calm(); place(); nocrit(); refill(); B.setWeapon(7); P.mag[7]=4; P.heat=0; P.overheatT=0;
  const v1=spawn(0,5), v2=spawn(1,6.2);
  fire(); let pulled=false; for(let i=0;i<120;i++){ h.frame(1,1/60); if(Math.hypot(v2.stagX,v2.stagY)>0.1) pulled=true; if(!NX.weapons.pshots.length) break; }
  ok(1000-v1.hp===55,'Void Direkttreffer 55 ('+(1000-v1.hp)+')');
  ok(1000-v2.hp>=20&&1000-v2.hp<=39,'Void Splash auf Nachbar ('+(1000-v2.hp)+')');
  ok(pulled||Math.hypot(v2.stagX,v2.stagY)>0.1,'Void zieht Gegner zum Zentrum');
  calm();

  // ---------- Singularitaet ----------
  place(); nocrit(); refill(); B.setWeapon(8); P.mag[8]=2; P.heat=0; P.overheatT=0;
  const s1=spawn(0,4.5), s2=spawn(1,6.0);
  fire(); for(let i=0;i<200&&!NX.weapons.holes.length;i++) h.frame(1,1/60);
  ok(NX.weapons.holes.length===1,'Singularitaet oeffnet nach Einschlag');
  const hole=NX.weapons.holes[0], startD=Math.hypot(s2.x-hole.x,s2.y-hole.y);
  NX.level.shots.push({x:hole.x+.5,y:hole.y,dx:1,dy:0,dmg:9,life:4}); const sh0=NX.level.shots.length;
  h.frame(30,1/60);
  ok(NX.level.shots.length<sh0,'Loch verschluckt gegnerische Geschosse');
  h.frame(60,1/60);
  ok(Math.hypot(s2.x-hole.x,s2.y-hole.y)<startD||startD<.4,'Loch zieht Gegner heran ('+startD.toFixed(2)+' -> '+Math.hypot(s2.x-hole.x,s2.y-hole.y).toFixed(2)+')');
  ok(1000-s2.hp>=20,'Dauerschaden im Loch ('+(1000-s2.hp)+')');
  const hpBefore=s2.hp; h.frame(60*3,1/60);
  ok(NX.weapons.holes.length===0,'Loch kollabiert nach ~2.6 s');
  ok(hpBefore-s2.hp>=60,'Kollaps-Explosion verursacht hohen Schaden ('+(hpBefore-s2.hp)+')');
  calm();

  // ---------- Krit je Waffe ----------
  restoreCrit();
  ok(near(S.weaponCrit(W[5]),.25)&&near(S.weaponCritMul(W[5]),2.5),'Rail: 25 % / 2.5x');
  S.add('run:c1',{crit:.1,critDmg:.5}); ok(near(S.weaponCrit(W[5]),.35)&&near(S.weaponCritMul(W[5]),3),'Spielerbonus wirkt additiv (35 % / 3x)');
  ok(near(S.weaponCrit(W[0]),.15),'Pistole 5 % + 10 % = 15 %'); S.remove('run:c1');
  S.add('run:cx',{crit:5}); ok(S.weaponCrit(W[8])===1,'Krit-Chance auf 100 % gedeckelt'); S.remove('run:cx');

  // ---------- Pickups ----------
  calm(); B.newRun(); place(); ok(!P.owned[4],'newRun: Arsenal zurueckgesetzt'); ok(P.ammo===36&&P.weapon===0&&P.mag[0]===12,'newRun: Vorrat 36, Pistole, Magazin voll');
  NX.level.pickups.push({kind:'c',x:P.x,y:P.y,taken:false,ph:0}); P.ammo=20; h.frame(2,1/60);
  ok(P.owned[4]&&P.weapon===4&&P.ammo===30,'Plasma-Pickup: Waffe, angelegt, +10 Vorrat ('+P.ammo+')');
  NX.level.pickups.push({kind:'s',x:P.x,y:P.y,taken:false,ph:0}); h.frame(2,1/60); ok(P.hasSG&&P.weapon===1,'altes Streu-Kanonen-Pickup funktioniert weiter');
  NX.level.pickups.push({kind:'w',x:P.x,y:P.y,taken:false,ph:0}); h.frame(2,1/60); ok(P.hasAuto&&P.weapon===3,'altes Overclock-Pickup funktioniert weiter');
  for(const k of ['j','l','V','S']){ NX.level.pickups.push({kind:k,x:P.x,y:P.y,taken:false,ph:0}); } h.frame(3,1/60);
  ok(P.owned.every(Boolean),'alle Waffen-Pickups (c j l V S s w) einsammelbar');

  // ---------- Level-Drops ----------
  B.newRun();
  const count=(m,ch)=>m.join('').split(ch).length-1;
  let a=0,b=0,c=0,d12=0,v12=0;
  for(let i=0;i<30;i++){
    a+=count(B.genLevel(2).map,'c'); b+=count(B.genLevel(3).map,'c'); c+=count(B.genLevel(4).map,'l');
    const m12=B.genLevel(12).map; d12+=count(m12,'S'); v12+=count(m12,'V');
  }
  ok(a===0,'Tiefe 2: noch keine Plasma-Kanone'); ok(b===30,'Tiefe 3: Plasma-Kanone 1x je Sektor'); ok(c===30,'Tiefe 4: Arc-Blaster 1x je Sektor');
  ok(d12===30,'Tiefe 12: Singularitaets-Kanone garantiert'); ok(v12>=5&&v12<=25,'Tiefe 12: Void-Werfer ~50 % ('+v12+'/30)');
  P.owned[4]=true; let b2=0; for(let i=0;i<10;i++) b2+=count(B.genLevel(3).map,'c'); ok(b2===0,'gefundene Waffe wird nicht erneut ausgelegt');
  B.newRun();

  // ---------- HUD ----------
  B.startLevel(0,true); await sleep(400); h.frame(5); calm(); B.setWeapon(0); P.mag[0]=9; P.ammo=24; h.frame(3,1/60);
  ok(h.elements.ammo.innerHTML==='9<small>/24</small>','Munitionsanzeige Magazin/Vorrat ('+h.elements.ammo.innerHTML+')');
  B.setWeapon(2); h.frame(3,1/60); ok(h.elements.ammo.innerHTML==='∞','Faeuste: Unendlich-Anzeige');
  B.setWeapon(0); P.mag[0]=6; P.reloadT=0; P.ammo=24; B.manualReload(); h.frame(2,1/60);
  ok(h.elements.rld._c.has('show')&&h.elements.rldtxt._c.has('on'),'HUD zeigt Nachlade-Balken + Text'); h.frame(120,1/60); ok(!h.elements.rld._c.has('show'),'Nachlade-Balken aus');
  B.setWeapon(2); NX.weapons.grant(5,0); B.setWeapon(5); P.mag[5]=0; P.ammo=8; h.frame(3,1/60);
  ok(h.elements.stage._c.has('lowammo'),'Low-Ammo je Waffe (Railgun: 8 Zellen)'); P.ammo=2; h.frame(3,1/60); ok(h.elements.stage._c.has('ammo0'),'Ammo0: Vorrat < Kosten pro Schuss');
  B.setWeapon(2); h.frame(3,1/60); ok(!h.elements.stage._c.has('lowammo')&&!h.elements.stage._c.has('ammo0'),'Faeuste: nie Low-Ammo');

  // ---------- Sektorstart behaelt Arsenal ----------
  B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(5); calm(); NX.weapons.grant(4,10); P.mag[4]=3;
  B.startLevel(0,true); await sleep(400); h.frame(5);
  ok(P.owned[4]&&P.weapon===4,'Sektorstart behaelt Arsenal + zuletzt benutzte Waffe');

  ok(h.errors.length===0&&h.warns.length===0,'keine Konsolenfehler/-warnungen '+JSON.stringify(h.errors.concat(h.warns).slice(0,2)));
  console.log(fails?('FEHLER: '+fails):'ALLE OK');
  process.exit(fails?1:0);
})();

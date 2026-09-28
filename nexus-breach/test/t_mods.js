// Phase 5: Waffen-Mods (Katalog, Inventar/Einbau, Wirkung jedes Effekts, Drops, Reset, Save, Loadout-Screen, Zufalls-Soak)
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
const near=(a,b,e=.001)=>Math.abs(a-b)<=e;
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX, P=B.P, W=B.WEAPONS, M=B.Mods, MODS=B.MODS;
  h.frame(10);
  B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(5);
  const list=NX.enemies.list;
  const calm=()=>{ list.forEach(e=>{ e.alive=false; }); NX.level.shots.length=0; NX.weapons.pshots.length=0; NX.weapons.holes.length=0; NX.weapons.beams.length=0; };
  calm();
  const grid=NX.level.grid, GW=NX.level.width, GH=NX.level.height;
  const free=(x,y)=>x>=0&&y>=0&&x<GW&&y<GH&&grid[y*GW+x]===0;
  let line=null;
  for(const len of [14,12,10,8]){
    for(let y=1;y<GH-1&&!line;y++) for(let x=1;x<GW-len&&!line;x++){ let g=true; for(let k=0;k<len;k++) if(!free(x+k,y)){ g=false; break; } if(g) line={x,y,dx:1,dy:0,len,a:0}; }
    for(let x=1;x<GW-1&&!line;x++) for(let y=1;y<GH-len&&!line;y++){ let g=true; for(let k=0;k<len;k++) if(!free(x,y+k)){ g=false; break; } if(g) line={x,y,dx:0,dy:1,len,a:Math.PI/2}; }
    if(line) break;
  }
  ok(!!line,'freie Gerade gefunden ('+(line&&line.len)+')');
  const place=()=>{ P.x=line.x+.5; P.y=line.y+.5; P.a=line.a; P.fireCd=0; P.reloadT=0; P.heat=0; P.overheatT=0; };
  const at=d=>({x:line.x+.5+line.dx*d,y:line.y+.5+line.dy*d});
  const spawn=(i,d,type)=>{ const e=list[i], q=at(d); e.type=type||'t'; e.alive=true; e.hp=e.maxhp=1000; e.x=q.x; e.y=q.y; e.awake=false; e.hear=false; e.stagT=99; e.stagX=e.stagY=0; e.flash=0; e.bodyT=0; return e; };
  const fire=()=>{ P.fireCd=0; B.tryFire(); };
  const savedCrit=W.map(w=>w.crit); const nocrit=()=>W.forEach(w=>{ w.crit=0; });
  const refill=()=>{ P.energy=P.energyMax; P.ammo=60; };
  const withRandom=(v,fn)=>{ const r=Math.random; Math.random=()=>v; try{ fn(); } finally{ Math.random=r; } };
  const clearMods=()=>{ for(let i=0;i<W.length;i++) for(const s of ['barrel','core','mag','system','special']) M.unequip(i,s); };
  const give=(...ids)=>ids.forEach(id=>M.add(id,true));
  nocrit();

  // ---------- Katalog ----------
  ok(MODS.length===51,'51 Mods (17 Grundtypen x 3 Stufen)');
  ok(new Set(MODS.map(m=>m.id)).size===51,'Mod-IDs eindeutig');
  ok(['barrel','core','mag','system','special'].every(s=>MODS.some(m=>m.slot===s)),'alle 5 Slots belegt');
  ok(['barrel','core','mag','system','special'].map(s=>new Set(MODS.filter(m=>m.slot===s).map(m=>m.base)).size).join()==='3,3,3,3,5','Grundtypen je Slot 3/3/3/3/5');
  ok(MODS.every(m=>m.name&&m.txt&&m.tier>=1&&m.tier<=3),'jeder Mod hat Name, Beschreibung, Stufe');
  ok(MODS.filter(m=>m.base==='b_dmg').map(m=>m.x.dmg).join()==='0.1,0.17,0.25','Stufen skalieren');

  // ---------- Neutral ----------
  const N=M.eff(0);
  ok(N.dmg===1&&N.range===1&&N.spread===1&&N.energy===1&&N.heat===1&&N.cool===1&&N.rc===1&&N.magAdd===0&&N.n===0,'ohne Mods: Werte-Paket neutral');
  ok(M.eff(undefined)===M.NEUTRAL&&M.eff(-1)===M.NEUTRAL,'unbekannte Waffe/undefined = neutral (Titel-Demo)');
  ok(P.wLv.every(v=>v===1),'Waffenlevel 1 ohne Mods');
  ok(M.magSize(0)===12&&M.magSize(2)===0,'Magazingroesse ohne Mods = Waffenwert, Faeuste 0');

  // ---------- Inventar / Einbau ----------
  ok(M.equip(0,'b_dmg3')===false,'ohne Besitz kein Einbau');
  give('b_dmg3'); ok(M.count('b_dmg3')===1&&M.free('b_dmg3')===1,'add: Inventar 1, frei 1');
  ok(M.equip(0,'b_dmg3')===true&&M.eq[0].barrel==='b_dmg3'&&M.free('b_dmg3')===0,'equip: eingebaut, frei 0');
  ok(P.wLv[0]===2,'Waffenlevel = 1 + Anzahl Mods');
  NX.weapons.grant(1,0); B.setWeapon(0); ok(M.equip(1,'b_dmg3')===false,'derselbe Mod (1x) nicht auf zwei Waffen');
  give('b_dmg3'); ok(M.equip(1,'b_dmg3')===true&&M.free('b_dmg3')===0,'zweites Exemplar: auf zweiter Waffe');
  ok(M.equip(2,'b_dmg3')===false,'Faeuste: keine Slots');
  ok(M.equip(4,'b_dmg1')===false,'nicht gefundene Waffe: kein Einbau');
  ok(M.equip(0,'nix')===false,'unbekannte ID abgelehnt');
  ok(M.unequip(1,'barrel')===true&&M.free('b_dmg3')===1,'unequip gibt Mod frei');
  ok(M.unequip(1,'barrel')===false,'leerer Slot: unequip false');
  give('b_rng1'); ok(M.equip(0,'b_rng1')&&M.eq[0].barrel==='b_rng1'&&M.free('b_dmg3')===2,'Slot ersetzt: alter Mod wieder frei');
  clearMods(); ok(P.wLv[0]===1&&P.wLv[1]===1,'alle abgelegt: LV1');
  M.reset(); ok(M.count('b_dmg3')===0&&Object.keys(M.eq[0]).length===0,'reset leert Inventar und Einbauten');

  // ---------- Kernwerte ----------
  give('b_acc3','s_st3'); M.equip(0,'b_acc3'); M.equip(0,'s_st3');
  ok(near(M.eff(0).spread,.25),'Streuung: Praezisionsdrall III + Stabilisator III = 0.25 ('+M.eff(0).spread+')');
  ok(near(M.eff(0).rc,.3),'Rueckstoss -70 %'); clearMods();
  give('s_oc3'); M.equip(0,'s_oc3'); place(); B.setWeapon(0); P.mag[0]=12; P.heat=0; fire(); ok(near(P.fireCd,.3/1.3,.0005),'Feuerrate +30 %: Cooldown '+P.fireCd.toFixed(4)); clearMods();
  give('s_hs3'); M.equip(0,'s_hs3'); place(); P.heat=0; P.overheatT=0; fire(); ok(near(P.heat,.05*.45,.0005),'Kuehlkoerper III: Hitze je Schuss 0.0225 ('+P.heat.toFixed(4)+')'); clearMods();
  give('c_en3'); NX.weapons.grant(4,0); M.equip(4,'c_en3'); B.setWeapon(4); place(); refill(); P.mag[4]=8; P.heat=0; P.overheatT=0; fire();
  ok(near(P.energy,100-5*.65,.001),'Energie-Kern III: Plasma kostet 3.25 Energie ('+P.energy+')'); clearMods(); B.setWeapon(0);
  give('c_cr3'); M.equip(0,'c_cr3'); ok(near(B.Stats.weaponCrit(W[0]),.15,.0001),'Krit-Kern III: Chance 0+0.15'); ok(near(B.Stats.weaponCritMul(W[0]),1.5+.6,.0001),'Krit-Multiplikator +0.6'); ok(near(P.crit,.15,.0001),'HUD-Krit folgt der Waffe'); clearMods();
  ok(near(P.crit,0,.0001),'nach Ablegen wieder Basis');

  // ---------- Magazin ----------
  B.setWeapon(0); P.mag[0]=12; P.ammo=60; give('m_ext2'); M.equip(0,'m_ext2'); ok(M.magSize(0)===19,'Erweitertes Magazin II: 12 -> 19'); ok(P.mag[0]===12,'aktuelles Magazin bleibt bis zum Nachladen');
  B.setWeapon(0); P.ammo=60; P.reloadT=0; B.manualReload(); ok(P.reloadT>0,'Nachladen moeglich (12 < 19)'); h.frame(90,1/60); ok(P.mag[0]===19&&P.ammo===53,'Nachladen fuellt auf 19 (Vorrat 53) ('+P.mag[0]+'/'+P.ammo+')');
  M.unequip(0,'mag'); ok(P.mag[0]===12&&P.ammo===60,'Ablegen: Magazin auf 12, 7 ueberzaehlige Schuesse als Zellen zurueck ('+P.mag[0]+'/'+P.ammo+')');
  give('m_qk3'); M.equip(0,'m_qk3'); P.mag[0]=3; P.reloadT=0; B.manualReload(); ok(near(P.reloadDur,1/1.75,.001),'Schnelllader III: Nachladezeit 0.571 s ('+P.reloadDur.toFixed(3)+')'); h.frame(60,1/60); clearMods();
  give('m_sv3'); M.equip(0,'m_sv3'); place(); P.mag[0]=12; withRandom(0,()=>fire()); ok(P.mag[0]===12,'Zellen-Sparer: Freischuss kostet kein Magazin'); withRandom(.99,()=>fire()); ok(P.mag[0]===11,'ohne Glueck: Schuss kostet normal'); clearMods();
  give('m_ext3'); NX.weapons.grant(8,0); M.equip(8,'m_ext3'); ok(M.magSize(8)===4,'Singularitaet: Magazin 2 +1(gerundet 1.8->2) = 4 ('+M.magSize(8)+')'); clearMods(); B.setWeapon(0);

  // ---------- Schaden / Reichweite ----------
  calm(); place(); refill(); B.setWeapon(0); P.mag[0]=12; give('b_dmg3'); M.equip(0,'b_dmg3');
  let e1=spawn(0,4); fire(); ok(1000-e1.hp===15,'Verstaerkter Lauf III: Pistole 12 -> 15 ('+(1000-e1.hp)+')'); clearMods();
  give('c_en3'); M.equip(0,'c_en3'); e1.hp=1000; place(); fire(); ok(1000-e1.hp===14,'Energie-Kern III: +20 % -> 14 ('+(1000-e1.hp)+')'); clearMods();
  const oldR=W[1].range; W[1].range=2; calm(); place(); B.setWeapon(1); P.mag[1]=6; refill();
  e1=spawn(0,2.6); withRandom(.5,()=>fire()); ok(e1.hp===1000,'Streu-Kanone Reichweite 2: Ziel bei 2.6 nicht getroffen');
  give('b_rng3'); M.equip(1,'b_rng3'); e1.hp=1000; place(); P.mag[1]=6; withRandom(.5,()=>fire()); ok(e1.hp<1000,'Langlauf III (Reichweite x1.5): Ziel bei 2.6 getroffen ('+(1000-e1.hp)+')');
  clearMods(); W[1].range=oldR; B.setWeapon(0);

  // ---------- Panzerbrecher ----------
  calm(); place(); refill(); B.setWeapon(0); P.mag[0]=12; give('x_ap3'); M.equip(0,'x_ap3');
  const soft=spawn(0,4,'t'); fire(); const dSoft=1000-soft.hp; calm(); place(); const hard=spawn(0,4,'k'); fire(); const dHard=1000-hard.hp;
  ok(dSoft===12,'Panzerbrecher: normales Ziel unveraendert 12 ('+dSoft+')'); ok(dHard===21,'Panzerbrecher III: schweres Ziel +75 % = 21 ('+dHard+')');
  ok(M.armored({type:'p',armor:5})&&!M.armored({type:'p'}),'gepanzert: e.armor>0 (Phase-8-Hook) oder schwerer Typ'); clearMods();

  // ---------- Area: Plasma-Kern / Explosiv / Kettenblitz ----------
  calm(); place(); refill(); P.mag[0]=12; give('c_pl3'); M.equip(0,'c_pl3');
  let a=spawn(0,4), b=spawn(1,5); fire();
  ok(1000-a.hp===12,'Plasma-Kern: Direkttreffer normal'); ok(1000-b.hp>=2&&1000-b.hp<=4,'Plasma-Kern III: Nachbar (1.0 dahinter) bekommt ~3 ('+(1000-b.hp)+')'); clearMods();
  calm(); place(); P.mag[0]=12; give('x_ex3'); M.equip(0,'x_ex3'); a=spawn(0,4); b=spawn(1,5); const b2=spawn(2,8.5); fire();
  ok(1000-b.hp>=4&&1000-b.hp<=6,'Explosivgeschosse III: Nachbar ~5 ('+(1000-b.hp)+')'); ok(b2.hp===1000,'ausserhalb des Radius: kein Schaden'); clearMods();
  calm(); place(); P.mag[0]=12; give('x_ch3'); M.equip(0,'x_ch3'); a=spawn(0,4); b=spawn(1,5.5); const c3=spawn(2,7);
  withRandom(0,()=>fire());
  ok(1000-a.hp===12&&1000-b.hp===7&&1000-c3.hp===7,'Kettenblitz III: 2 Folgeziele je 7 ('+(1000-b.hp)+','+(1000-c3.hp)+')');
  ok(NX.weapons.beams.length>=2,'Kettenblitz zeichnet Blitze');
  calm(); place(); P.mag[0]=12; a=spawn(0,4); b=spawn(1,5.5); withRandom(.99,()=>fire()); ok(b.hp===1000,'Kettenblitz: ohne Glueck kein Blitz'); clearMods();
  // je Schuss nur einmal: Streu-Kanone (7 Kugeln) loest hoechstens EINEN Blitz aus
  calm(); place(); B.setWeapon(1); P.mag[1]=6; refill(); give('x_ch1'); M.equip(1,'x_ch1'); a=spawn(0,3); b=spawn(1,4.4);
  const bh=b.hp; withRandom(0,()=>{ P.fireCd=0; B.tryFire(); }); const chained=bh-b.hp;   // b liegt hinter a: nur Blitz-Schaden (Kugeln treffen a)
  ok(chained===Math.round(9*.4)||chained===0,'Streu-Kanone + Kettenblitz: nur ein Blitz je Schuss ('+chained+')'); clearMods(); B.setWeapon(0);

  // ---------- Lebensraub / Schild-Entzug ----------
  calm(); place(); refill(); B.setWeapon(0); P.mag[0]=12; give('x_ls3','x_sd3'); M.equip(0,'x_ls3'); P.hp=50; spawn(0,4);
  for(let i=0;i<10;i++){ P.mag[0]=12; fire(); }
  ok(P.hp===59&&Number.isInteger(P.hp),'Lebensraub III: 120 Schaden x 8 % = +9 HP, ganzzahlig ('+P.hp+')');
  P.hp=100; for(let i=0;i<3;i++){ P.mag[0]=12; fire(); } ok(P.hp===100,'Lebensraub: nie ueber 100'); clearMods();
  M.equip(0,'x_sd3'); P.shield=0; list[0].hp=1000; P.mag[0]=12; fire(); ok(near(P.shield,12*.28,.01),'Schild-Entzug III: +3.36 Schild ('+P.shield.toFixed(2)+')');
  P.shield=P.shieldMax; fire(); ok(P.shield===P.shieldMax,'Schild-Entzug: nie ueber Maximum'); clearMods();
  calm(); place(); P.mag[0]=12; give('x_ls1'); M.equip(0,'x_ls1'); P.hp=50; const weak=spawn(0,4); weak.hp=2; fire(); ok(P.hp===50,'Lebensraub zaehlt nur echten Schaden (Ueberschuss ignoriert: 2*3%<1)'); clearMods();

  // ---------- Projektile / Strahlen ----------
  calm(); place(); nocrit(); refill(); B.setWeapon(4); P.mag[4]=8; P.heat=0; P.overheatT=0; give('x_ex3'); M.equip(4,'x_ex3');
  let p1=spawn(0,5), p2=spawn(1,6); fire(); h.frame(60,1/60);
  ok(1000-p1.hp===30,'Plasma + Explosiv: Direkttreffer 30'); ok(1000-p2.hp>=13&&1000-p2.hp<=17,'Plasma + Explosiv III: Splash groesser (~15 statt ~9) ('+(1000-p2.hp)+')'); clearMods();
  calm(); place(); refill(); P.mag[4]=8; P.heat=0; P.overheatT=0; give('b_rng3'); M.equip(4,'b_rng3'); fire(); ok(NX.weapons.pshots[0]&&NX.weapons.pshots[0].rng===45,'Projektil merkt sich Reichweite x1.5 (45)'); calm(); clearMods();
  calm(); place(); refill(); NX.weapons.grant(5,0); B.setWeapon(5); P.mag[5]=4; P.heat=0; P.overheatT=0; give('b_dmg3'); M.equip(5,'b_dmg3'); p1=spawn(0,4); fire(); ok(1000-p1.hp===Math.round(90*1.25),'Railgun + Lauf III: 90 -> 113 ('+(1000-p1.hp)+')'); clearMods();
  calm(); place(); refill(); NX.weapons.grant(6,0); B.setWeapon(6); P.mag[6]=40; P.heat=0; give('b_dmg3'); M.equip(6,'b_dmg3'); p1=spawn(0,4); fire(); ok(1000-p1.hp===10,'Arc-Blaster + Lauf III: 8 -> 10 ('+(1000-p1.hp)+')'); clearMods();
  calm(); place(); refill(); NX.weapons.grant(8,0); B.setWeapon(8); P.mag[8]=2; P.heat=0; give('b_dmg3'); M.equip(8,'b_dmg3'); fire(); ok(NX.weapons.pshots.length===1,'Singularitaet feuert'); for(let k=0;k<200&&!NX.weapons.holes.length;k++) h.frame(1,1/60); ok(NX.weapons.holes.length===1&&near(NX.weapons.holes[0].dm,1.25),'Loch merkt sich Schadensfaktor 1.25'); calm(); clearMods(); B.setWeapon(0);

  // ---------- Drops ----------
  let rollOk=true; for(let i=0;i<300;i++){ const id=M.roll((i%20)+1,i%7===0); if(!MODS.some(m=>m.id===id)) rollOk=false; } ok(rollOk,'roll liefert immer gueltige IDs'); let t1=0,t3=0; for(let i=0;i<400;i++){ const id=M.roll(1); if(id.endsWith('3')) t3++; if(id.endsWith('1')) t1++; } ok(t3===0&&t1>200,'Tiefe 1: nur Stufe I/II (III '+t3+', I '+t1+')');
  let hi=0; for(let i=0;i<400;i++) if(M.roll(14).endsWith('3')) hi++; ok(hi>40,'Tiefe 14: Stufe III kommt vor ('+hi+'/400)');
  let bs=0; for(let i=0;i<200;i++) if(M.roll(1,true).endsWith('1')) bs++; ok(bs===0,'Boss-Drops mindestens Stufe II');
  M.reset(); const cnt=()=>Object.values(M.inv).reduce((s,v)=>s+v,0);
  M.onKill({type:'K'},3); ok(cnt()===2,'Boss: 2 Mods garantiert');
  M.reset(); let got=0; for(let i=0;i<2000;i++){ const b0=cnt(); M.onKill({type:'p'},3); got+=cnt()-b0; } ok(got>=50&&got<=200,'2000 Kills: ~100 Mod-Drops ('+got+')');
  M.reset(); const rw=M.sectorReward(3); ok(rw&&cnt()===1&&M.count(rw.id)===1,'Sektor-Belohnung: 1 Mod');
  ok(NX.save.data.weaponUpgrades.discovered.includes(rw.id),'Fund im Save (weaponUpgrades.discovered)');

  // echter Kill im Spiel loest Drop-Pfad aus (kein Fehler)
  calm(); place(); B.setWeapon(0); P.mag[0]=12; refill(); const k1=spawn(0,3,'p'); k1.hp=1; k1.maxhp=1; fire(); ok(!k1.alive,'Kill im Spiel');

  // ---------- Neuer Lauf ----------
  give('b_dmg3'); M.equip(0,'b_dmg3'); B.newRun(); ok(cnt()===0&&M.eq[0].barrel===undefined&&P.wLv[0]===1&&M.magSize(0)===12,'newRun: Mods weg, Waffenlevel 1');

  // ---------- Save ----------
  const S=NX.save; const d=S.sanitize({version:1,weaponUpgrades:{discovered:['b_dmg1',5,{}],x:1}}); ok(JSON.stringify(d.weaponUpgrades.discovered)==='["b_dmg1"]','Save: discovered gefiltert');
  ok(S.sanitize({version:1,weaponUpgrades:{discovered:'kaputt'}}).weaponUpgrades.discovered===undefined,'Save: kaputtes discovered verworfen');
  ok(S.sanitize({version:1}).weaponUpgrades.discovered===undefined,'Save ohne Feld ok');

  // ---------- Loadout / Pause ----------
  calm(); B.startLevel(0,true); await sleep(400); h.frame(5); B.setWeapon(0); give('b_dmg2'); 
  B.openLoadout(()=>{}); const html=h.elements.obox.innerHTML; ok(/Loadout/.test(html)&&/LAUF/.test(html)&&/Verstärkter Lauf II/.test(html)&&/Puls-Pistole/.test(html),'Loadout-Screen zeigt Waffe, Slots und verfuegbare Mods');
  ok(/Schaden/.test(html)&&/Feuerrate/.test(html)&&/Krit/.test(html),'Loadout-Screen zeigt Kennwerte');
  ok(!/Faeuste|Fäuste/.test(html),'Faeuste nicht im Loadout');
  M.equip(0,'b_dmg2'); B.openLoadout(()=>{}); ok(/<s>12<\/s>/.test(h.elements.obox.innerHTML),'Kennwert-Vergleich (alt durchgestrichen) nach Einbau'); clearMods();
  h.frame(2); const kd=h.listeners['w:keydown']||[]; kd.forEach(f=>f({code:'KeyL',repeat:false,preventDefault(){}}));
  ok(B.state==='pause'&&/Loadout/.test(h.elements.obox.innerHTML),'Taste L: pausiert und oeffnet Loadout');

  // ---------- Zufalls-Soak: alle Waffen mit Zufalls-Mods ----------
  B.newRun(); B.startLevel(1,true); await sleep(400); h.frame(5); calm();
  for(let i=0;i<W.length;i++) if(i!==2) NX.weapons.grant(i,0);
  for(const m of MODS) M.add(m.id,true);
  let bad=0;
  for(let round=0;round<300;round++){
    const wi=[0,1,3,4,5,6,7,8][(Math.random()*8)|0]; B.setWeapon(wi);
    for(const s of ['barrel','core','mag','system','special']){ const c=MODS.filter(m=>m.slot===s); const m=c[(Math.random()*c.length)|0]; if(Math.random()<.3) M.unequip(wi,s); else M.equip(wi,m.id); }
    place(); refill(); P.mag[wi]=M.magSize(wi); P.heat=0; P.overheatT=0; P.hp=60; P.shield=5;
    calm(); spawn(0,3+Math.random()*4); spawn(1,4+Math.random()*4); spawn(2,5+Math.random()*3,'k');
    for(let k=0;k<6;k++){ P.fireCd=0; P.overheatT=0; P.energy=P.energyMax; B.tryFire(); h.frame(3,1/60); }
    if(!Number.isFinite(P.hp)||!Number.isFinite(P.shield)||P.hp<0||P.hp>100||list.some(e=>!Number.isFinite(e.hp))) bad++;
    if(P.hp<=0){ P.hp=60; }
  }
  ok(bad===0,'300 Zufalls-Loadouts: keine NaN/ungueltigen Werte');
  ok(h.errors.length===0&&h.warns.length===0,'keine Konsolenfehler/-warnungen '+JSON.stringify(h.errors.concat(h.warns).slice(0,2)));
  W.forEach((w,i)=>{ w.crit=savedCrit[i]; });
  console.log(fails?('FEHLER: '+fails):'ALLE OK');
  process.exit(fails?1:0);
})();

// Phase 3: Spieler-System (Schild/Panzerung/Energie/Sprint/Dash/Krit/Regen/Resistenz/Bonusquellen)
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
const near=(a,b,e=.01)=>Math.abs(a-b)<=e;
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX, P=B.P, S=B.Stats, V=S.val, K=B.keys;
  h.frame(10);
  B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(5);
  const calm=()=>{ NX.enemies.list.forEach(e=>{ e.alive=false; }); NX.level.shots.length=0; };
  calm();

  // --- Startwerte ---
  ok(NX.phase===5,'NX.phase = 5');
  ok(P.shieldMax===25&&near(P.shield,25,.5),'Schild voll am Sektorstart ('+P.shield+'/'+P.shieldMax+')');
  ok(P.armorMax===50&&P.armor===15,'Panzerung Grundfüllung 15/50 (Sektorstart 30 %)');
  ok(P.energyMax===100&&P.energy>=99,'Energie voll');
  ok(P.dashN===1&&V.dashCharges===1,'1 Dash-Ladung');
  ok(near(P.crit,.05),'Krit-Chance 5 % (HUD-Feld P.crit)');
  ok(V.hpRegen===0&&V.resist===0&&V.speed===1,'Basis: kein HP-Regen, keine Resistenz, Tempo 1');

  // --- Schadenspipeline: Schild -> Panzerung -> HP ---
  P.hp=100; P.shield=25; P.armor=15; P.shieldT=0;
  B.hurtPlayer(10);
  ok(near(P.shield,15)&&P.hp===100&&P.armor===15,'10 Schaden: nur Schild (15/25), HP 100, Panzerung unverändert');
  B.hurtPlayer(40);   // 15 Schild, Rest 25 -> Panzerung nimmt 12.5, HP 12.5 -> aufgerundet 13
  ok(P.shield===0&&near(P.armor,2.5)&&P.hp===87,'40 Schaden: Schild 0, Panzerung 2.5, HP 87 (ist '+P.hp+')');
  ok(Number.isInteger(P.hp),'HP bleibt ganzzahlig');
  P.hp=100; P.shield=0; P.armor=0; B.hurtPlayer(7); ok(P.hp===93,'ohne Schild/Panzerung wie früher: 7 Schaden -> 93');
  P.hp=100; P.shield=0; P.armor=0; B.hurtPlayer(.2); ok(P.hp===99,'Rest-Schaden wird auf mind. 1 aufgerundet');

  // --- Schadensresistenz ---
  S.add('run:test',{resist:.5}); P.hp=100; P.shield=0; P.armor=0; B.hurtPlayer(20);
  ok(P.hp===90,'Resistenz 50 %: 20 -> 10 Schaden');
  S.add('run:test',{resist:5}); ok(V.resist===.75,'Resistenz gedeckelt bei 75 %'); S.remove('run:test');
  ok(V.resist===0,'Bonusquelle entfernt');

  // --- Schild-Regen mit Verzögerung ---
  P.hp=100; P.shield=0; P.armor=0; P.shieldT=0; B.hurtPlayer(1);
  ok(near(P.shieldT,3.5),'Treffer startet Regen-Verzögerung 3.5 s');
  calm(); const s0=P.shield; h.frame(60*3,1/60);   // 3 s
  ok(P.shield===s0,'in den 3 s nach dem Treffer kein Schild-Regen');
  h.frame(60*2,1/60); ok(P.shield>5,'danach regeneriert das Schild ('+P.shield.toFixed(1)+')');
  h.frame(60*6,1/60); ok(P.shield===P.shieldMax,'Schild wieder voll');

  // --- Sprint kostet Energie, Sperre bei 0, Freigabe ab 20 % ---
  calm(); P.energy=100; P.enT=0; P.a=0;
  K.KeyW=true; K.ShiftLeft=true;
  let x0=P.x,y0=P.y; h.frame(30,1/60);
  ok(P.sprinting||P.energy<100,'Sprint aktiv, Energie sinkt ('+P.energy.toFixed(1)+')');
  ok(near(100-P.energy,15*.5,1.5),'Sprint-Kosten ≈ 15/s (7.5 in 0.5 s)');
  { const hx=P.x,hy=P.y; for(let i=0;i<420;i++){ h.frame(1,1/60); P.x=hx; P.y=hy; } }   // 7 s sprinten, Figur bleibt stehen (kein Portal-Treffer)
  ok(B.state==='play','Zustand weiter play');
  ok(P.energy<10&&P.sprintLock,'nach ~7 s leer + Sprint gesperrt ('+P.energy.toFixed(1)+')');
  ok(!P.sprinting,'kein Sprint bei Sperre (Laufen geht weiter)');
  ok(h.elements.mEnergy._c.has('lock'),'HUD: Energie-Balken blinkt (lock)');
  h.frame(60*4,1/60); ok(P.energy>=20&&P.sprintLock&&!P.sprinting,'Shift gehalten: Sperre bleibt trotz ≥ 20 % Energie (kein Dauer-Sprint)');
  K.KeyW=false; K.ShiftLeft=false; h.frame(60*1,1/60);
  ok(P.energy>=20||P.sprintLock,'Energie lädt nach Verzögerung');
  h.frame(60*3,1/60); ok(!P.sprintLock&&P.energy>=20,'Sperre nach ≥ 20 % Energie aufgehoben ('+P.energy.toFixed(0)+')');
  h.frame(60*6,1/60); ok(near(P.energy,100,.5),'Energie wieder voll');
  // Tempo-Vergleich Walk/Sprint (Freifläche suchen)
  function speedTest(sprint){
    P.energy=100; P.enT=0; P.sprintLock=false; K.KeyW=true; K.ShiftLeft=sprint;
    const ax=P.x, ay=P.y; h.frame(20,1/60); const d=Math.hypot(P.x-ax,P.y-ay); K.KeyW=false; K.ShiftLeft=false; return d;
  }
  // in Kreis ums Spielerfeld: Richtung mit freier Strecke nehmen
  let dirOk=false; for(let a=0;a<6.28&&!dirOk;a+=.5){ P.a=a; const ax=P.x,ay=P.y; const d=speedTest(false); P.x=ax; P.y=ay; if(d>.9*3.2*20/60) dirOk=true; }
  ok(dirOk,'freie Richtung für Tempo-Test gefunden');
  const px=P.x,py=P.y; const dw=speedTest(false); P.x=px; P.y=py; const ds=speedTest(true);
  ok(ds>dw*1.35,'Sprint schneller als Gehen ('+ds.toFixed(2)+' vs '+dw.toFixed(2)+')');
  S.add('meta:speed',{speed:.25}); P.x=px; P.y=py; const df=speedTest(false); ok(df>dw*1.2,'Tempo-Bonus +25 % wirkt ('+df.toFixed(2)+')'); S.remove('meta:speed');

  // --- Dash ---
  calm(); P.energy=100; P.enT=0; P.dashN=1; P.dashCd=0; P.dashT=0;
  // freie Ecke: irgendwo mit 3 Feldern Platz in Blickrichtung
  const G=NX.level.grid, MW=NX.level.width;
  const solid=(x,y)=>x<0||y<0||x>=MW||y>=NX.level.height||G[(y|0)*MW+(x|0)]>0;
  let placed=false; for(let a=0;a<6.28&&!placed;a+=.4){ P.a=a; let clear=true; for(let d=.2;d<=3.2;d+=.2) if(solid(P.x+Math.cos(a)*d,P.y+Math.sin(a)*d)) clear=false; if(clear) placed=true; }
  ok(placed,'Dash-Strecke frei gefunden');
  const dx0=P.x, dy0=P.y;
  ok(B.tryDash()===true,'Dash ausgelöst (ohne Eingabe: nach vorn)');
  ok(P.dashN===0&&near(P.energy,80,.5),'Dash verbraucht Ladung + 20 Energie');
  ok(B.tryDash()===false,'zweiter Dash sofort: verweigert (Cooldown/aktiv)');
  h.frame(12,1/60);
  const dd=Math.hypot(P.x-dx0,P.y-dy0);
  ok(near(dd,2.6,.35),'Dash-Weite ≈ 2.6 ('+dd.toFixed(2)+')');
  ok(P.dashT===0,'Dash vorbei nach ~0.17 s');
  ok(h.elements.mDash._c.has('ready')===false,'HUD: Dash nicht bereit während Cooldown');
  h.frame(60*1.4,1/60);
  ok(P.dashN===1,'Cooldown 1.2 s -> Ladung wieder da');
  h.frame(2,1/60); ok(h.elements.mDash._c.has('ready'),'HUD: Dash bereit');

  // i-Frames
  P.dashN=1; P.energy=100; P.hp=100; P.shield=0; P.armor=0; B.tryDash(); B.hurtPlayer(30); ok(P.hp===100,'Treffer während des Dashs wird ignoriert (i-Frames)');
  h.frame(30,1/60); P.shield=0; P.shieldT=99; B.hurtPlayer(5); ok(P.hp===95,'nach dem Dash wieder verwundbar');

  // zu wenig Energie
  P.dashN=1; P.energy=10; P.enT=0; ok(B.tryDash()===false&&P.dashN===1,'Dash ohne genug Energie: verweigert, Ladung bleibt');
  ok(P.enFlash>0,'Energie-Mangel wird signalisiert (Blinken)');

  // Double Dash
  S.add('meta:doubledash',{dashCharges:1}); ok(V.dashCharges===2,'Double-Dash-Upgrade: 2 Ladungen');
  P.dashN=2; P.energy=100; P.hp=100; calm();
  ok(B.tryDash(),'Dash 1/2'); h.frame(15,1/60); ok(P.dashN===1,'1 Ladung übrig');
  ok(B.tryDash(),'Dash 2/2 direkt hinterher'); h.frame(15,1/60); ok(P.dashN===0,'0 Ladungen');
  ok(!B.tryDash(),'3. Dash verweigert');
  h.frame(60*1.4,1/60); ok(P.dashN===1,'erste Ladung nach 1.2 s'); h.frame(60*1.3,1/60); ok(P.dashN===2,'zweite Ladung nach weiteren 1.2 s');
  ok(h.elements.mDash._c.has('two'),'HUD: Zwei-Ladungen-Anzeige');
  S.remove('meta:doubledash'); ok(V.dashCharges===1&&P.dashN===1,'Upgrade entfernt: Ladungen begrenzt');

  // Wand-Sicherheit: 400 zufällige Dashes dürfen nie in Wänden landen
  let inWall=0, dashes=0; const ex=NX.level.exit;
  for(let i=0;i<400;i++){
    calm(); P.energy=100; P.dashN=1; P.dashT=0; P.dashCd=0; P.hp=100;
    for(let n=0;n<300;n++){ const cx=1+((Math.random()*(NX.level.width-2))|0), cy=1+((Math.random()*(NX.level.height-2))|0);
      if(!G[cy*MW+cx]&&(!ex||Math.hypot(cx-ex.x,cy-ex.y)>6)){ P.x=cx+.5; P.y=cy+.5; break; } }
    P.a=Math.random()*6.28; K.KeyW=Math.random()<.5; K.KeyA=Math.random()<.3; K.KeyD=Math.random()<.3; K.KeyS=Math.random()<.2;
    if(B.tryDash()){ dashes++; h.frame(14,1/30); }   // grobe Schritte (dt .033) wie bei Frame-Einbrüchen
    K.KeyW=K.KeyA=K.KeyD=K.KeyS=false;
    if(solid(P.x,P.y)) inWall++;
  }
  ok(B.state==='play','Zustand nach Dash-Serie weiter play');
  ok(dashes>350&&inWall===0,'Dash tunnelt nie in Wände ('+dashes+' Dashes, '+inWall+' in Wand)');

  // --- Krit ---
  S.add('run:crit',{crit:.95}); ok(near(P.crit,1),'Krit-Chance gedeckelt bei 100 %'); ok(V.critDmg===1.5,'Krit-Multiplikator 1.5×');
  ok(S.critMul()===1.5,'critMul liefert 1.5 im Spiel');
  S.add('run:crit',{crit:.95,critDmg:1}); ok(S.critMul()===2.5,'Krit-Schaden-Bonus wirkt (2.5×)');
  S.remove('run:crit');
  // Treffer-Feedback
  const e=NX.enemies.list[0]; e.alive=true; e.hp=1000; e.maxhp=1000; NX.enemies.list.forEach(o=>{ if(o!==e) o.alive=false; });
  const before=e.hp; S.add('run:crit-force',{crit:.95}); P.x=e.x-1.2; P.y=e.y; P.a=0;   // Krit = Waffenwert + Bonus (seit Phase 4)
    // Sichtlinie egal: direkter Aufruf über NX
  NX.fx.crit=0; B.NX.weapons.defs; // (kein direkter damageEnemy-Export: Feedback über Hitscan prüfen, sofern frei)
  // Hitscan: Gegner frontal, Wand-frei?
  const wallBetween=(()=>{ for(let d=.2;d<1.2;d+=.1) if(solid(P.x+d,P.y)) return true; return false; })();
  if(!wallBetween){
    P.ammo=50; P.weapon=0; P.fireCd=0; K.Space=true; h.frame(1,1/60); K.Space=false;
    ok(before-e.hp===18,'Pistolentreffer mit Krit: 12 -> 18 Schaden ('+(before-e.hp)+')');
    ok(NX.fx.crit>0,'Krit-Effekt gesetzt');
    S.remove('run:crit-force');
  } else console.log('skip Hitscan-Krit (Wand im Weg)');
  S.recalc();

  // --- HP-Regen ---
  calm(); P.hp=50; S.add('run:regen',{hpRegen:2}); P.hpT=0; h.frame(60*3,1/60);
  ok(P.hp>=55&&Number.isInteger(P.hp),'HP-Regen 2/s: HP '+P.hp);
  B.hurtPlayer(1); const hh=P.hp; h.frame(60*3,1/60); ok(P.hp===hh,'Regen pausiert 4 s nach Treffer');
  h.frame(60*3,1/60); ok(P.hp>hh,'danach weiter Regen'); S.remove('run:regen');

  // --- Quellen / Lauf-Reset ---
  S.add('run:a',{armorMax:50}); S.add('meta:b',{energyMax:50}); ok(P.armorMax===100&&P.energyMax===150,'Boni addieren sich (Panzerung 100, Energie 150)');
  B.newRun(); ok(P.armorMax===50&&P.energyMax===150,'newRun entfernt run:-Boni, meta:-Boni bleiben');
  ok(S.sources().join()==='meta:b','Quellenliste: '+S.sources().join());
  S.remove('meta:b');

  // --- Sektor-Neustart nach Tod füllt auf ---
  B.startLevel(0,true); await sleep(400); h.frame(5); calm();
  P.shield=0; P.energy=0; P.armor=0; P.dashN=0; B.startLevel(0,true); await sleep(400); h.frame(5);
  ok(P.shield===P.shieldMax&&P.energy===P.energyMax&&P.armor===15&&P.dashN===1,'Sektorstart: Schild/Energie voll, Panzerung 15, Dash bereit');

  // --- HUD-Werte ---
  P.shield=12.5; P.shieldT=99; P.armor=25; P.energy=50; P.enT=99; h.frame(3);
  ok(h.elements.mShield._u.style.width==='50%'&&h.elements.mArmor._u.style.width==='50%'&&h.elements.mEnergy._u.style.width==='50%','HUD: SH/AR/EN-Balken 50 %');
  ok(h.elements.mShield._c.has('off')===false,'HUD: Schild-Slot aktiv');

  // --- Kein Effekt in Pause/Titel: Schaden nur im Spiel ---
  P.hp=100; P.shield=0; P.armor=0; B.NX.setState('pause'); B.hurtPlayer(50); ok(P.hp===100,'kein Schaden im Pausenzustand'); B.NX.setState('play');

  console.log('errors',h.errors,'warns',h.warns);
  ok(h.errors.length===0&&h.warns.length===0,'keine Konsolenfehler/-warnungen');
  console.log(fails?('FEHLER: '+fails):'ALLE OK'); process.exit(fails?1:0);
})();

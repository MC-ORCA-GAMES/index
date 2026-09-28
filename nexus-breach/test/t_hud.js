const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };
(async()=>{
  const h=boot(); const B=h.B(), NX=B.NX, P=B.P, st=h.elements.stage, cls=x=>st._c.has(x);
  h.frame(20);
  ok(!cls('hud-on'),'Titel: neues HUD versteckt');
  B.newRun(); B.startLevel(0,true); await sleep(400); h.frame(30);
  ok(cls('hud-on'),'Spiel: neues HUD sichtbar');
  ok(/Sektor 1/.test(h.elements.top.innerHTML)&&/obj/.test(h.elements.top.innerHTML),'Sektor + Ziel im HUD: '+h.elements.top.innerHTML.replace(/<[^>]+>/g,' | '));
  // Slots aus (Max=0), aktiv sobald Max>0
  ok(!h.elements.mShield._c.has('off')&&P.shieldMax>0,'Shield-Slot ab Phase 3 standardmäßig aktiv (Max '+P.shieldMax+')');
  P.shieldMax=0; P.shield=0; h.frame(3);
  ok(h.elements.mShield._c.has('off'),'Shield-Slot gedimmt (Max 0)');
  P.shieldMax=50; P.shield=25; P.shieldT=99; P.armorMax=20; P.armor=20; P.energyMax=100; P.energy=100; h.frame(3);
  ok(!h.elements.mShield._c.has('off')&&h.elements.mShield._u.style.width==='50%','Shield-Slot aktiv, 50%');
  ok(h.elements.mEnergy._u.style.width==='100%'&&h.elements.mArmor._u.style.width==='100%','Armor/Energy-Balken');
  NX.player.shieldMax=NX.player.armorMax=NX.player.energyMax=0;
  // Low HP
  P.hp=25; h.frame(3); ok(cls('lowhp')&&!cls('lowhp2'),'Low-HP-Warnung bei 25');
  P.hp=10; h.frame(3); ok(cls('lowhp2'),'Low-HP kritisch bei 10');
  P.hp=100; h.frame(3); ok(!cls('lowhp')&&!cls('lowhp2'),'Low-HP aus bei 100');
  // Low Ammo
  P.mag[0]=0; P.ammo=8; h.frame(3); ok(cls('lowammo')&&!cls('ammo0'),'Low-Ammo bei 8');
  P.mag[0]=0; P.ammo=0; h.frame(3); ok(cls('ammo0'),'Ammo 0');
  P.mag[0]=12; P.ammo=50; h.frame(3); ok(!cls('lowammo'),'Low-Ammo aus');
  // Overheat
  P.heat=.8; P.overheatT=0; h.frame(3); ok(cls('hot')&&!cls('overheat'),'Heat-Warnung (hot)');
  P.overheatT=1.2; h.frame(3); ok(cls('overheat')&&!cls('hot'),'Overheat aktiv');
  P.overheatT=0; P.heat=0; h.frame(3);
  // Waffe-Level/Krit
  ok(h.elements.wlv.textContent==='LV1','Waffenlevel LV1'); P.crit=.15; P.wLv[0]=3; h.frame(3);
  ok(h.elements.critv.textContent==='15%'&&h.elements.wlv.textContent==='LV3','Krit 15% / LV3');
  // Threat
  ok(NX.hud.threat===0,'Threat 0 ohne wache Gegner');
  const foes=NX.enemies.list.filter(e=>e.alive).slice(0,6); foes.forEach(e=>{ e.awake=true; e.x=P.x+2; e.y=P.y; }); h.frame(12);
  ok(NX.hud.threat>=2,'Threat steigt mit wachen Gegnern: '+NX.hud.threat);
  NX.enemies.list.forEach(e=>{ e.alive=false; }); h.frame(12); ok(NX.hud.threat===0,'Threat fällt wieder');
  // Combo / Streak
  NX.level.shots.length=0;   // Gegnerschuesse in der Luft wuerden die Streak zufaellig zuruecksetzen
  const S=NX.combat; S.reset(); S.kill(); S.kill(); S.kill(); h.frame(3);
  ok(cls('hud-on')&&h.elements.combo._c.has('on')&&S.chain===3&&S.streak===3,'Combo/Streak sichtbar (3/3)');
  h.frame(4*30+10,1/30); ok(S.chain===0&&S.streak===3,'Combo-Kette läuft nach 4s aus, Streak bleibt');
  S.kill(); NX.player.hp=100; 
  // Schaden setzt Streak zurück (hurtPlayer über Gegnerangriff simulieren)
  S.hurt(); ok(S.streak===0&&S.chain===0,'Schaden setzt Streak+Kette zurück');
  // Boss-Sektor (Tiefe 3)
  B.NX.save.data; B.newRun(); B.startLevel(0,true); await sleep(400);
  const gen=null;
  console.log('errors',h.errors,'warns',h.warns);
  ok(h.errors.length===0,'keine Konsolenfehler');
  console.log(fails?('FEHLER: '+fails):'ALLE OK'); process.exit(fails?1:0);
})();

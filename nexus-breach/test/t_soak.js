const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  for(const touch of (process.argv[2]==='touch'?[true]:[false])){
    const h=boot({touch}); const B=h.B(), NX=B.NX;
    h.frame(30);
    B.startEndless();   // Endlos-Einsatz direkt starten (Titel-Button öffnet jetzt die Menüseite)
    await sleep(450); h.frame(10);
    for(let w=1;w<9;w++) NX.weapons.grant(w,15);   // Phase 4: alle Waffen im Zufallslauf
    let deaths=0, maxE=0, t0=Date.now(), transitions=[]; NX.onState((n,p)=>transitions.push(p+'>'+n));
    const K=['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'];
    let frames=0;
    for(let i=0;i<(+process.argv[3]||6000);i++){
      if(i%25===0){ for(const k of K) B.keys[k]=Math.random()<.5; B.keys.KeyW=true; B.P.a+=Math.random()*1.2-.6; }
      if(i%53===0&&B.state==='play') B.setWeapon((Math.random()*9)|0);           // Waffenwechsel
      if(i%71===0) B.manualReload();
      if(i%97===0){ const ms=B.MODS[(Math.random()*B.MODS.length)|0]; B.Mods.add(ms.id,true); const wi=(Math.random()*9)|0; if(Math.random()<.2) B.Mods.unequip(wi,ms.slot); else B.Mods.equip(wi,ms.id); }   // Phase 5: Zufalls-Mods
      if(i%211===0){ B.P.ammo=Math.min(99,B.P.ammo+40); for(let w=0;w<9;w++) B.P.owned[w]=true; }
      if(i%37===0&&B.state==='play'&&Math.random()<.7) B.tryDash();          // Dash (F / Rechtsklick / Touch-Button rufen alle tryDash)
      if(i%500===0) B.Stats.add('run:soak',{dashCharges:1,hpRegen:1,speed:.1});   // Bonusquellen zwischendurch an/aus
      if(i%500===250) B.Stats.remove('run:soak');
      if(B.state==='play'){ h.frame(1,1/30); frames++; if(B.P.hp<=0) deaths++; }
      else if(B.state==='dead'){ await sleep(1000); h.elements.obox.querySelector('button')&&0; B.startLevel(B.lvIdx>=0?B.lvIdx:B.NX.level.def,true); await sleep(400); h.frame(5); }
      else { h.frame(1,1/30); }
      maxE=Math.max(maxE,NX.enemies.list.length);
      if(h.errors.length) break;
    }
    console.log('touch',touch,'state',B.state,'playFrames',frames,'depth',B.depth,'maxEnemies',maxE,'errors',h.errors.length,h.errors.slice(0,2),'warns',h.warns,'dashN',B.P.dashN,'weapon',B.P.weapon,'holes',NX.weapons.holes.length,'pshots',NX.weapons.pshots.length,'shield',B.P.shield.toFixed(0),'energy',B.P.energy.toFixed(0),'transitions',[...new Set(transitions)].join(' '),'ms',Date.now()-t0);
    if(h.errors.length) process.exit(1);
  }
  process.exit(0);
})();

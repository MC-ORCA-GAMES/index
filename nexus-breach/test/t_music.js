// Phase 21: Musik-Dateien-Schicht (art/musik/*.ogg) mit Mock-AudioContext / Mock-Audio. Kein echter Browser.
const {boot}=require('./harness');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL',m); } else console.log('ok  ',m); };

function mocks(existing){
  const created=[];
  const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
  const node=()=>({gain:param(),frequency:param(),Q:param(),detune:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),
    type:'',buffer:null,connect(){},disconnect(){},start(){},stop(){}});
  class AC{ constructor(){ this._t=0; this.sampleRate=8000; this.state='running'; this.destination=node(); }
    get currentTime(){ return this._t+=1/60; }
    resume(){} createGain(){return node();} createBiquadFilter(){return node();} createDynamicsCompressor(){return node();} createConvolver(){return node();}
    createOscillator(){return node();} createBufferSource(){return node();}
    createBuffer(c,n){ return {getChannelData:()=>new Float32Array(n)}; }
    createMediaElementSource(el){ return {el,connect(){},disconnect(){}}; } }
  class Audio{ constructor(){ this.paused=true; this.ended=false; this.currentTime=0; this.loop=false; this._l={}; this._src=''; created.push(this); }
    get src(){ return this._src; }
    set src(v){ this._src=v; const f=String(v).split('/').pop(); setTimeout(()=>this._emit(existing.has(f)?'canplay':'error'),0); }
    removeAttribute(){ this._src=''; } load(){}
    addEventListener(t,f){ (this._l[t]=this._l[t]||[]).push(f); } _emit(t){ for(const f of (this._l[t]||[])) f(); }
    play(){ this.paused=false; return Promise.resolve(); } pause(){ this.paused=true; } }
  return {AudioContext:AC,webkitAudioContext:AC,Audio,created};
}
const ALL=['title','explore_facility','explore_canyon','explore_desert','explore_jungle','combat','elite','boss_a','boss_b','archive','collision','null','boss_story','boss_null_a','boss_null_b','epilogue','ascension'].map(k=>'nb_'+k+'.ogg');

(async()=>{
  // ---------- 1) alle Dateien vorhanden ----------
  { const m=mocks(new Set(ALL)); const h=boot({extra:m,touch:true}); const B=h.B(), S=B.Snd, MF=S.files;
    B.initAudio(); h.frame(30); await sleep(20); h.frame(30);
    ok(MF.state().cur==='title','Titel: Song title ('+MF.state().cur+')');
    ok(MF.state().active===true,'Titel: Datei aktiv (Synth pausiert)');
    B.startEndless(); await sleep(450); h.frame(60); await sleep(20); h.frame(120);
    ok(B.NX.state==="play","Level gestartet (state "+B.NX.state+")");
    ok(MF.state().cur==='explore_facility','Erkunden: explore_facility ('+MF.state().cur+')');
    ok(m.created.some(a=>/nb_combat/.test(a.src))&&m.created.some(a=>/nb_elite/.test(a.src)),'Combat/Elite vorgeladen');
    S.force('kampf',60); h.frame(90,1/30); await sleep(20); h.frame(60,1/30);
    ok(MF.state().cur==='combat','Kampf sofort: combat ('+MF.state().cur+')');
    S.force('erkunden',60); h.frame(60,1/30);   // 2 s
    ok(MF.state().cur==='combat','Abstieg verzoegert: combat noch aktiv nach 2 s');
    h.frame(240,1/30);                            // +8 s
    ok(MF.state().cur==='explore_facility','Abstieg nach HOLD: explore_facility ('+MF.state().cur+')');
    S.force('elite',60); h.frame(90,1/30); await sleep(20); h.frame(60,1/30);
    ok(MF.state().cur==='elite','Elite: elite ('+MF.state().cur+')');
    S.force('boss',60); h.frame(90,1/30); await sleep(20); h.frame(60,1/30);
    ok(MF.state().cur==='boss_a','Boss: boss_a ('+MF.state().cur+')');
    ok(MF.pick&&MF.pick().k==='boss_a','pick() liefert boss_a');
    const t=MF.state().tracks; ok(Object.values(t).filter(x=>x.playing).length>=1,'mind. 1 Track spielt');
    // Epilog
    B.Epilogue.on=true; h.frame(30,1/30); await sleep(20); h.frame(60,1/30);
    ok(MF.state().cur==='epilogue','Epilog: nb_epilogue ('+MF.state().cur+')');
    B.Epilogue.on=false; h.frame(30,1/30);
    // Console: aus / an
    MF.enable(false); h.frame(10); ok(MF.state().active===false&&MF.state().cur===null,'enable(false): Datei-Schicht aus');
    MF.enable(true);
    ok(h.errors.length===0,'keine Fehler (Fehler: '+h.errors.join('|').slice(0,200)+')');
  }
  // ---------- 2) keine Dateien: Synth-Fallback ----------
  { const m=mocks(new Set()); const h=boot({extra:m,touch:true}); const B=h.B(), S=B.Snd, MF=S.files;
    B.initAudio(); h.frame(30); await sleep(20); h.frame(30);
    B.startEndless(); await sleep(450); h.frame(120); await sleep(20); h.frame(120);
    S.force('kampf',60); h.frame(120,1/30); await sleep(20); h.frame(30,1/30);
    const st=MF.state();
    ok(st.active===false,'ohne Dateien: MF nicht aktiv (Synth spielt)');
    ok(st.missing.length>=1,'fehlende Dateien vermerkt: '+st.missing.join(','));
    const steps0=S.state().steps; h.frame(120,1/30); ok(S.state().steps>steps0,'Synth-Sequenzer laeuft weiter');
    ok(h.errors.length===0,'keine Fehler (Fehler: '+h.errors.join('|').slice(0,200)+')');
  }
  // ---------- 3) nur eine Datei: gemischt ----------
  { const m=mocks(new Set(['nb_combat.ogg'])); const h=boot({extra:m,touch:true}); const B=h.B(), S=B.Snd, MF=S.files;
    B.initAudio(); B.startEndless(); await sleep(450); h.frame(120); await sleep(20); h.frame(60);
    ok(MF.state().active===false,'nur combat vorhanden: Erkunden = Synth');
    S.force('kampf',60); h.frame(120,1/30); await sleep(20); h.frame(60,1/30);
    ok(MF.state().cur==='combat'&&MF.state().active===true,'Kampf = Datei, Synth pausiert');
  }
  console.log(fails?('FEHLER '+fails):'ALLE OK'); process.exit(fails?1:0);
})();

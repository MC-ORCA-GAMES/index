// Node-Harness: führt das <script> aus game.html gegen eine Stub-DOM/Canvas-Umgebung aus.
// Kein echter Browser — prüft Boot, Frame-Loop, State-Übergänge und Save-Logik.
const fs=require('fs'), vm=require('vm'), path=require('path');

function makeGfx(){
  const base={ getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
               createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
               measureText:()=>({width:0}),
               createLinearGradient:()=>({addColorStop(){}}), createRadialGradient:()=>({addColorStop(){}}) };
  return new Proxy(base,{ get:(t,k)=>(k in t?t[k]:()=>{}), set:(t,k,v)=>{ t[k]=v; return true; } });
}
function makeEl(){
  const el={ offsetWidth:0, className:'', style:{}, dataset:{}, children:[], _c:new Set(), get classList(){ const c=this._c; return { add:x=>c.add(x), remove:x=>c.delete(x), toggle:(x,f)=>{ const on=f===undefined?!c.has(x):!!f; on?c.add(x):c.delete(x); return on; }, contains:x=>c.has(x) }; },
    width:0,height:0, textContent:'', innerHTML:'', onclick:null,
    getContext:()=>makeGfx(), _q:{}, querySelector(sel){ return this._q[sel]||(this._q[sel]=makeEl()); }, querySelectorAll:()=>[],
    addEventListener(){}, removeEventListener(){}, appendChild(c){return c;}, setAttribute(){}, focus(){},
    getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}) };
  return el;
}
function boot(opts={}){
  const html=fs.readFileSync(path.join(__dirname,'..','game.html'),'utf8');
  const m=html.match(/<script>\n([\s\S]*?)<\/script>/); if(!m) throw new Error('kein Script gefunden');
  const store=opts.store||{}; const errors=[]; const warns=[];
  const localStorage=opts.noStorage?{getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}}
    :{ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{ store[k]=String(v); } };
  const elements={};
  const listeners={};
  const document={ getElementById:id=>elements[id]||(elements[id]=makeEl()), createElement:()=>makeEl(),
    addEventListener:(t,f)=>{ (listeners['d:'+t]=listeners['d:'+t]||[]).push(f); }, body:makeEl(), hidden:false, pointerLockElement:null,
    exitPointerLock(){}, documentElement:makeEl() };
  let rafQ=[];
  const win={ localStorage, document, innerWidth:1280, innerHeight:720, devicePixelRatio:1,
    addEventListener:(t,f)=>{ (listeners['w:'+t]=listeners['w:'+t]||[]).push(f); },
    matchMedia:()=>({matches:!!opts.touch}), requestAnimationFrame:cb=>{ rafQ.push(cb); return 1; },
    performance:{ now:()=>0 }, setTimeout, clearTimeout, console:{ log(){}, warn:(...a)=>warns.push(a.join(' ')), error:(...a)=>errors.push(a.join(' ')) },
    Math, Date, JSON, Uint32Array, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array, Array, Object, Number, Set, Map, Promise, Error };
  win.window=win; win.self=win; win.globalThis=win;
  const ctx=vm.createContext(win);
  vm.runInContext(m[1],ctx,{filename:'game.html'});
  let t=0;
  return { win, store, errors, warns, listeners, elements,
    frame(n=1,dt=1/60){ for(let i=0;i<n;i++){ t+=dt*1000; const q=rafQ; rafQ=[]; for(const cb of q) cb(t); } },
    B:()=>win.__breach };
}
module.exports={boot};

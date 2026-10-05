// ================= Zufallsgenerator (baut nach der Klassenlogik des Spiels) =================
function classOf(c,n){const g=k=>c[k]||0,w=g('weapon')+g('launcher'),rc=g('reactorS')+g('reactorL'),cargo=g('cargo')*100;
 if(w>=8||(w>=5&&g('armor')>=5))return'DESTROYER';if(w>=5)return'FRIGATE';if(w>=3)return'CORVETTE';
 if(cargo>=200&&rc>=2&&n>=24)return'INDUSTRIAL';if(cargo>=250)return'FREIGHTER';if(cargo>=100)return'MINER';
 if(g('tank')>=2&&g('sensor')>=1)return'EXPLORER';if(w>=1)return'FIGHTER';return'SCOUT';}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const GEN_ORDER=['SCOUT','MINER','FIGHTER','FREIGHTER','EXPLORER','CORVETTE','INDUSTRIAL','FRIGATE','DESTROYER'];
const GEN_LABEL={SCOUT:'Scout · Aufklärer',MINER:'Miner · Mining klein/mittel',FIGHTER:'Fighter · Kampf klein',FREIGHTER:'Frachter · Transport',EXPLORER:'Explorer · Forscher',
CORVETTE:'Korvette · Kampf mittel',INDUSTRIAL:'Industrial · Mining groß',FRIGATE:'Fregatte · Kampf groß',DESTROYER:'Zerstörer · Kampf sehr groß'};
const GEN_NAMES={SCOUT:['Falke','Kolibri','Späher','Funke','Wiesel'],MINER:['Maulwurf','Bohrer','Schürfer','Pickel','Käfer'],FIGHTER:['Hornisse','Dorn','Klinge','Wespe','Blitz'],
FREIGHTER:['Lastesel','Koloss','Karawane','Packer','Schlepper'],EXPLORER:['Kompass','Pionier','Nomade','Horizont','Wanderer'],CORVETTE:['Wächter','Lanze','Stahlhai','Falkner','Patrouille'],
INDUSTRIAL:['Titan','Bergwerk','Schmelze','Mammut','Erzfresser'],FRIGATE:['Bastion','Aegis','Eisenfaust','Wolf','Trutz'],DESTROYER:['Leviathan','Vernichter','Zorn','Ragnarök','Dreadnought']};
// Palette: [Hauptfarbe, Akzent]
const GEN_PAL={scout:[['#c9a24a','#7a1414'],['#cfd4dc','#3a6fae'],['#4fa6c9','#2b2c30'],['#2b2c30','#ff6a1a']],
miner:[['#d9a21b','#2b2c30'],['#7fae6a','#2b2c30'],['#d06a2e','#2b2c30'],['#c9a24a','#3a3d44']],
fight:[['#3a3d44','#b31a1a'],['#b31a1a','#2b2c30'],['#3a6fae','#cfd4dc'],['#cfd4dc','#b31a1a'],['#2b2c30','#ff6a1a']],
freight:[['#c9a24a','#2b2c30'],['#8a94a0','#d06a2e'],['#5a6b7a','#c9a24a']],
explore:[['#4fa6c9','#cfd4dc'],['#cfd4dc','#4fa6c9'],['#7fae6a','#cfd4dc']]};
// Bereiche [min,max] pro Klasse. w = Waffen+Raketenwerfer zusammen, lc = davon Raketenwerfer, armorP/legP = Paare
const spec=o=>Object.assign({cargo:[0,0],w:[0,0],lc:[0,0],eng:[2,3],gyro:[1,2],tank:[0,0],battery:[0,0],reactorS:[0,0],reactorL:[0,0],solar:[0,0],shield:[0,0],armorP:[0,0],sensor:[0,0],antenna:[0,0],legP:[0,0],struct:[0,0],W:[1,2],ck:['top']},o);
const SPEC={
SCOUT:spec({eng:[2,3],gyro:[1,2],tank:[0,1],battery:[0,1],solar:[0,2],sensor:[0,1],antenna:[0,1],legP:[0,2],struct:[1,4],W:[1,2],ck:['nose','nose','top'],wing:1,pal:'scout'}),
MINER:spec({cargo:[1,2],w:[1,2],eng:[2,3],gyro:[1,1],tank:[1,2],battery:[1,2],reactorS:[0,1],solar:[0,2],armorP:[0,1],sensor:[0,1],antenna:[0,1],legP:[1,2],struct:[2,6],W:[2,2],ck:['top','nose'],boom:1,pal:'miner'}),
FIGHTER:spec({w:[1,2],lc:[0,1],eng:[3,4],gyro:[2,3],tank:[1,1],battery:[1,2],reactorS:[0,1],solar:[0,1],shield:[0,1],armorP:[0,1],sensor:[0,1],antenna:[0,1],legP:[0,2],struct:[0,4],W:[1,2],ck:['nose'],wing:1,pal:'fight'}),
FREIGHTER:spec({cargo:[3,6],w:[0,2],eng:[3,5],gyro:[1,2],tank:[2,3],battery:[1,2],reactorS:[0,1],solar:[0,3],shield:[0,1],armorP:[0,1],sensor:[0,1],antenna:[0,1],legP:[1,2],struct:[3,8],W:[2,3],ck:['top','nose'],pal:'freight'}),
EXPLORER:spec({eng:[2,3],gyro:[1,2],tank:[2,4],battery:[1,3],reactorS:[0,1],solar:[1,4],shield:[0,1],sensor:[1,3],antenna:[1,2],legP:[1,2],struct:[2,5],W:[1,2],ck:['nose','top'],pal:'explore'}),
CORVETTE:spec({cargo:[0,1],w:[3,4],lc:[0,2],eng:[3,5],gyro:[2,3],tank:[1,2],battery:[2,3],reactorS:[0,1],solar:[0,2],shield:[1,2],armorP:[0,1],sensor:[0,1],antenna:[0,1],legP:[1,2],struct:[3,8],W:[2,2],ck:['top','nose'],pal:'fight'}),
INDUSTRIAL:spec({cargo:[6,12],w:[0,2],eng:[5,8],gyro:[2,3],tank:[3,5],battery:[3,5],reactorS:[1,2],reactorL:[1,2],solar:[2,6],shield:[1,2],armorP:[1,2],sensor:[1,2],antenna:[1,2],legP:[2,3],struct:[8,16],W:[3,4],ck:['top'],boom:2,pal:'miner'}),
FRIGATE:spec({cargo:[0,1],w:[5,7],lc:[1,3],eng:[5,7],gyro:[2,4],tank:[2,3],battery:[3,4],reactorS:[1,1],reactorL:[0,1],solar:[0,3],shield:[2,3],armorP:[1,2],sensor:[1,2],antenna:[1,2],legP:[1,2],struct:[6,12],W:[2,3],ck:['top'],pal:'fight'}),
DESTROYER:spec({cargo:[0,2],w:[8,12],lc:[2,4],eng:[6,9],gyro:[3,4],tank:[3,4],battery:[4,6],reactorS:[1,2],reactorL:[1,2],solar:[0,3],shield:[3,5],armorP:[2,4],sensor:[1,2],antenna:[1,3],legP:[2,3],struct:[10,20],W:[3,4],ck:['top'],pal:'fight'})};
// Standard-Farbschema der ersten Schiffe: Schwarz (Hülle), Rot, Gold, Neon-Orange
const GEN_STD={hull:'#16161b',red:'#b31a1a',gold:'#c9a24a',neon:'#ff6a00'};
// opt: {decks:0=Auto|1..4 Ebenen, pal:'std'|'old', hull:false=ohne Außenhülle}
const NPC_FAC={traders:['Händler','#c9a24a','#2b2c30','#ff6a00'],miners:['Miner','#7fae6a','#2b2c30','#d9a21b'],researchers:['Forscher','#4fa6c9','#cfd4dc','#7fe0ff'],security:['Sicherheit','#3a6fae','#cfd4dc','#7fb0ff'],pirates:['Pirat','#b31a1a','#2b2c30','#ff2a2a'],kardox:['Kardox','#cfd4dc','#3a3d44','#ff9a3a'],salvagers:['Berger','#d06a2e','#2b2c30','#ffd23f']};
function genOnce(cls,rnd,att,opt){
 opt=opt||{};
 const sp=SPEC[cls],lim=CL[cls][9],D=2.1,T=.14;
 const ri=(a,b)=>a+Math.floor(rnd()*(b-a+1)),pick=a=>a[Math.floor(rnd()*a.length)],R=k=>ri(sp[k][0],sp[k][1]);
 // 1) Stückliste würfeln
 const wT=R('w'),lc=Math.min(R('lc'),wT>>1);
 const c={cockpit:1,engine:R('eng'),gyro:R('gyro'),tank:R('tank'),battery:R('battery'),cargo:R('cargo'),weapon:wT-lc,launcher:lc,sensor:R('sensor'),antenna:R('antenna'),
  solar:R('solar'),reactorS:R('reactorS'),reactorL:R('reactorL'),shield:R('shield'),armor:R('armorP')*2,leg:R('legP')*2,struct:R('struct')};
 const tot=()=>Object.values(c).reduce((a,b)=>a+b,0);
 const mn={struct:sp.struct[0],leg:sp.legP[0]*2,antenna:sp.antenna[0],solar:sp.solar[0],sensor:sp.sensor[0],armor:sp.armorP[0]*2,battery:sp.battery[0],shield:sp.shield[0],tank:sp.tank[0],gyro:sp.gyro[0],engine:sp.eng[0]};
 for(const k of['struct','leg','antenna','solar','sensor','armor','battery','shield','tank','gyro','engine']){const st=(k==='leg'||k==='armor')?2:1;while(tot()>lim&&c[k]-st>=mn[k])c[k]-=st;}
 if(tot()>lim||classOf(c,tot())!==cls)return null;
 let hullC,railC,stripeC,neonC,accC;
 if(opt.pal&&opt.pal.startsWith('npc_')){const F=NPC_FAC[opt.pal.slice(4)];hullC=F[1];railC=stripeC=accC=F[2];neonC=F[3];}
 else if(opt.pal==='old'){const [m,a]=pick(GEN_PAL[sp.pal]);hullC=m;railC=stripeC=neonC=accC=a;}
 else{const S=GEN_STD,two=rnd()<.5;hullC=S.hull;railC=two?S.gold:S.red;stripeC=two?S.red:S.gold;neonC=S.neon;accC=pick([S.red,S.gold]);}
 // 2) Kern: Raster aus Blöcken, vorne eine schmalere Reihe (= spitzer Bug)
 const ord=['battery','tank','cargo','struct'];for(let i=3;i>0;i--){const j=Math.floor(rnd()*(i+1));[ord[i],ord[j]]=[ord[j],ord[i]];}
 const items=[],add=(k,n)=>{for(let i=0;i<n;i++)items.push(k);};
 add('gyro',c.gyro);ord.forEach(k=>add(k,c[k]));add('reactorS',c.reactorS);add('reactorL',c.reactorL);
 // Ebenen (Decks): 1-4 Stockwerke übereinander, Auto = nach Teilezahl
 const nItems=items.length;
 let L=opt.decks>0?Math.min(4,opt.decks|0):Math.min(4,Math.max(1,Math.ceil(nItems/10)));L=Math.min(L,nItems);
 const per=Math.ceil(nItems/L);
 let Wc=ri(sp.W[0],sp.W[1])+(att>>3);while(Math.ceil(per/Wc)>Wc*3+2)Wc++;Wc=Math.min(Wc,per);
 const nR=Math.ceil(per/Wc),sizes=[per%Wc||Wc];for(let i=1;i<nR;i++)sizes.push(Wc);
 const topY=(L-1)/2*D,yL=l=>(l-(L-1)/2)*D,HH=L*D;
 const out=[],place=(k,p,r)=>{const q=Q(k,p);if(r)q.r=r;out.push(q);};
 const rows=[];
 sizes.forEach((sz,r)=>{const z=(r-(nR-1)/2)*D,xs=[];for(let i=0;i<sz;i++)xs.push((i-(sz-1)/2)*D);rows.push({z,xs,hw:sz*D/2});});
 // Teile reihum auf die Ebenen verteilen, pro Ebene von hinten nach vorn füllen
 for(let l=0;l<L;l++){const li=items.filter((_,i)=>i%L===l);let ii=0;
  for(let r=nR-1;r>=0&&ii<li.length;r--)for(const x of rows[r].xs){if(ii>=li.length)break;const k=li[ii++];place(k,[x,yL(l),rows[r].z],k==='tank'?[90,0,0]:null);}}
 const halfW=rows.reduce((a,r)=>Math.max(a,r.hw),0),zFace=rows[0].z-D/2,zBack=rows[nR-1].z+D/2;
 // 3) Cockpit + Bug (Cockpit überlappt die Hülle, damit es sicher verbunden ist)
 const ck=pick(sp.ck);
 if(ck==='top'){place('cockpit',[0,topY+1.55,rows[0].z]);out.push(P('sphere',[0,0,zFace-.2],[0,0,0],[(rows[0].hw+T)*2.9,(HH+2*T)*1.45,3.4],hullC,'deko',20));out.push(P('cone',[0,0,zFace-2.6],[0,0,0],[(rows[0].hw+T)*1.1,(HH+2*T)*.7,2.6],hullC,'deko',16));}
 else place('cockpit',[0,0,zFace-.75]);
 // 4) Triebwerke hinten (mehrere Reihen bei großen Schiffen)
 {const ec=c.engine,cols=Math.min(ec,Math.ceil(Wc*D/1.7)),rE=Math.ceil(ec/cols);let k=0;
  for(let r=0;r<rE;r++){const n=Math.min(cols,ec-k);for(let i=0;i<n;i++)place('engine',[(i-(n-1)/2)*1.7,(r-(rE-1)/2)*1.7,zBack+.9]);k+=n;}}
 // 5) Panzerung an den Seiten (mittlere Reihen zuerst, über alle Ebenen), Landebeine ganz unten
 const mid=rows.map((_,i)=>i).sort((a,b)=>Math.abs(a-(nR-1)/2)-Math.abs(b-(nR-1)/2));
 {const ac=[];for(const i of mid)for(let l=0;l<L;l++)ac.push([i,l]);
  for(let i=0;i<c.armor/2&&i<ac.length;i++){const r=rows[ac[i][0]],y=yL(ac[i][1]);[-1,1].forEach(sg=>place('armor',[sg*(r.hw+.3),y,r.z],[0,90,0]));}}
 {const lp=c.leg/2,li=lp===1?[nR>>1]:lp===2?[0,nR-1]:[0,nR>>1,nR-1];
  [...new Set(li)].slice(0,lp).forEach(i=>{const r=rows[i];[-1,1].forEach(sg=>place('leg',[sg*(r.hw-.35),-topY-1.3,r.z],sg<0?[0,180,0]:null));});}
 // 6) Oben/unten Anbauplätze: Gruppen = Paar (±x) oder Mitte
 const mkPool=()=>rows.map(r=>{const px=[...new Set(r.xs.filter(x=>x>.01))].sort((a,b)=>b-a),g=px.map(x=>({xs:[-x,x],u:0,v:0}));
  g.push({xs:[0],u:0,v:r.xs.some(x=>Math.abs(x)<.01)?0:1});return{z:r.z,g};});
 const top=mkPool(),bot=mkPool(),fwd=rows.map((_,i)=>i),rev=[...fwd].reverse();
 if(ck==='top')top[0].g.forEach(g=>g.u=1);
 const take=(pool,order,cnt,onlyC,fn)=>{for(const i of order){if(cnt<=0)break;const row=pool[i];
   for(const g of row.g){if(cnt<=0)break;if(g.u||g.xs.length>cnt||(onlyC&&g.xs.length>1))continue;
    if(g.v&&row.g.some(h=>h!==g&&h.u))continue;if(!g.v&&g.xs.length>1&&row.g.some(h=>h.v&&h.u))continue;
    g.u=1;cnt-=g.xs.length;g.xs.forEach(x=>fn(x,row.z));}}return cnt;};
 let left=take(top,fwd,c.weapon,0,(x,z)=>place('weapon',[x,topY+1.25,z]));
 if(left>0)take(bot,fwd,left,0,(x,z)=>place('weapon',[x,-topY-1.25,z],[0,0,180]));
 left=take(bot,fwd,c.launcher,0,(x,z)=>place('launcher',[x,-topY-1.35,z]));
 if(left>0)take(top,fwd,left,0,(x,z)=>place('launcher',[x,topY+1.35,z]));
 take(top,rev,c.shield,0,(x,z)=>place('shield',[x,topY+1.35,z]));
 take(top,mid,c.sensor,1,(x,z)=>place('sensor',[x,topY+1.2,z]));
 take(top,rev,c.antenna,1,(x,z)=>place('antenna',[x,topY+2.2,z]));
 take(top,rev,c.solar,0,(x,z)=>place('solar',[x,topY+1.2,z]));
 // 7) Deko: Flügel (leichte Schiffe), Bohrarme (Mining)
 if(sp.wing){const sw=ri(15,30),ao=c.armor?.6:0,zc=rows[nR-1].z-.2;
  [-1,1].forEach(sg=>out.push(P('box',[sg*(halfW+1.4+ao),-.5,zc],[0,-sg*sw,0],[3.2,.15,2.4],accC)));}
 if(sp.boom){const len=cls==='INDUSTRIAL'?4.5:3,xs=sp.boom===1?[0]:[-1,1].map(s=>s*halfW*.55);
  xs.forEach(x=>{out.push(P('cyl',[x,-topY-1.15,zFace-len/2],[0,0,0],[.3,.3,len],accC,'deko',8));out.push(P('cone',[x,-topY-1.15,zFace-len-.6],[0,0,0],[.8,.8,1.2],opt.pal==='old'?'#ffd23f':neonC,'deko',6));});}
 // 7b) Außenhülle (rund): Ellipsoid pro Rumpfabschnitt, Ringe an den Übergängen, runder Bug und Heckkegel
 if(opt.hull!==false){
  const segs=[];rows.forEach(r=>{const g=segs[segs.length-1];if(g&&Math.abs(g.hw-r.hw)<1e-6)g.z1=r.z+D/2;else segs.push({z0:r.z-D/2,z1:r.z+D/2,hw:r.hw});});
  const b0=[0,0,0],HY=HH+2*T;
  segs.forEach((g,si)=>{const dz=g.z1-g.z0,cz=(g.z0+g.z1)/2,W2=(g.hw+T)*2;
   const bulge=1+.12*Math.sin(si*1.7+rnd()*2);
   out.push(P('sphere',[0,0,cz],b0,[W2*1.42*bulge,HY*1.42,dz*1.3+.6],hullC,'deko',20));
   if(si>0)out.push(P('torus',[0,0,g.z0],b0,[W2*1.28,HY*1.2,.9],railC,'deko',16));
   [-1,1].forEach(sg=>{if(dz>D*1.5)out.push(P('sphere',[sg*(g.hw+T+.15),0,cz],b0,[.7,HY*.55,dz*.6],neonC,'deko',10));});
   out.push(P('sphere',[0,HY/2*1.05,cz],b0,[Math.min(1.4,g.hw),.22,dz*.8],stripeC,'deko',10));});
  const lg=segs[segs.length-1],WB=(lg.hw+T)*2;
  out.push(P('cone',[0,0,zBack+.35],[0,0,180],[WB*.95,HY*.95,1.3],hullC,'deko',20));
  out.push(P('torus',[0,0,zBack+.05],b0,[WB*.95,HY*.95,.8],neonC,'deko',20));}
 // 8) Kontrolle: Klasse und Teilelimit müssen mit der Spielformel stimmen
 const cc={};let n=0;out.forEach(d=>{if(d.role!=='deko'){cc[d.role]=(cc[d.role]||0)+1;n++;}});
 if(n>lim||classOf(cc,n)!==cls||!cc.engine||!cc.cockpit)return null;
 const fin=d=>({k:d.k,p:d.p.map(r3),r:d.r.map(r3),s:d.s.map(r3),c:d.k.startsWith('g:')?undefined:d.c,role:d.role,seg:SEGK.includes(d.k)?d.seg:undefined});
 const nf=opt.pal&&opt.pal.startsWith('npc_')?opt.pal.slice(4):'';return{name:(nf?NPC_FAC[nf][0]+' ':'')+pick(GEN_NAMES[cls])+' '+ri(10,99),cls,npc:nf||undefined,n,decks:L,parts:JSON.parse(JSON.stringify(out.map(fin)))};}
function genShip(cls,seed,opt){for(let at=0;at<60;at++){const s=genOnce(cls,mulberry32(seed+at*7919),at,opt);if(s){s.seed=seed;return s;}}return null;}

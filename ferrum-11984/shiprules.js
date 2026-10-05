/* Gemeinsame Schiffsregeln für game.html UND schiffsbauer/schiffsbauer.html.
   Nur HIER ändern: Spiel und Schiffsbauer lesen dieselben Werte, damit für Spieler und Entwickler immer dasselbe gilt. */
(function(g){
  // Maximale Schiffslänge (längste Kante der Optik) je Klasse
  var MAX_LEN={SCOUT:17,MINER:24,FIGHTER:20,FREIGHTER:40,EXPLORER:28,CORVETTE:34,INDUSTRIAL:60,FRIGATE:50,DESTROYER:70};
  // Rollen, die im Spiel ein echter Baublock sind (bezahlen ihr Material schon über den Block)
  var BLOCK_ROLES=['struct','cockpit','engine','gyro','tank','battery','cargo','orehold','weapon','sensor','antenna','leg','solar','reactorS','reactorL','shield','armor','launcher'];
  var DEKO_K=0.05;     // Metallplatten je Volumeneinheit Optik
  var DEKO_MIN=0.5;    // Mindestkosten je Deko-Teil
  var BLOCK_VOL=8;     // Volumen eines Standardblocks (2×2×2): nur was darüber liegt, kostet bei Block-Rollen extra
  function roleOf(d){ return (typeof d.k==='string'&&d.k.indexOf('g:')===0)?d.k.slice(2):d.role; }
  function isBlockRole(r){ return BLOCK_ROLES.indexOf(r)>=0; }
  // Metallplatten, die die Optik kostet (Spielteile "g:" sind über den Block schon bezahlt)
  function dekoPlates(parts){
    var t=0;
    (parts||[]).forEach(function(d){
      if(!d||typeof d.k!=='string'||d.k.indexOf('g:')===0||!d.s) return;
      var V=Math.abs(d.s[0]*d.s[1]*d.s[2]);
      t+=isBlockRole(roleOf(d))?Math.max(0,V-BLOCK_VOL)*DEKO_K:Math.max(DEKO_MIN,V*DEKO_K);
    });
    return Math.ceil(t);
  }
  // Längste Kante der Optik (gedrehte Teile zählen mit ihrem größten Maß in alle Richtungen)
  function visualLen(parts){
    var mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9], any=false;
    (parts||[]).forEach(function(d){
      if(!d||!d.p||!d.s) return; any=true;
      var rot=(d.r||[0,0,0]).some(function(v){ return Math.abs(v%180)>1e-6; }), m=Math.max(Math.abs(d.s[0]),Math.abs(d.s[1]),Math.abs(d.s[2]))/2;
      for(var a=0;a<3;a++){ var h=rot?m:Math.abs(d.s[a])/2; mn[a]=Math.min(mn[a],d.p[a]-h); mx[a]=Math.max(mx[a],d.p[a]+h); }
    });
    return any?Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]):0;
  }
  function sizeError(parts,cls){
    var max=MAX_LEN[cls], len=visualLen(parts);
    return len>max+1e-6?('OPTIK ZU GROSS FÜR '+cls+': '+len.toFixed(1)+' M, ERLAUBT SIND '+max+' M'):null;
  }
  g.FerrumRules={maxLen:MAX_LEN,blockRoles:BLOCK_ROLES,dekoPlates:dekoPlates,visualLen:visualLen,sizeError:sizeError};
})(typeof window!=='undefined'?window:globalThis);

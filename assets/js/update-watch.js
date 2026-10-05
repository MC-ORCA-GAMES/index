/* update-watch.js — automatischer Update-Hinweis für einzelne Spielseiten (auch wenn sie direkt geöffnet werden).
   Einbinden: <script src="/assets/js/update-watch.js" defer></script>  (kurz vor </body> oder im <head>)
   Prüft ohne Cache per HEAD-Request (ETag/Last-Modified), ob die Seite seit dem Laden neu hochgeladen wurde. */
(function(){
  if (window.__updWatch) return; window.__updWatch = true;
  var URL_ = location.pathname, INTERVAL = 60000, base = null, shownFor = null;
  var NAME = (document.title || 'diesem Spiel').split(/[|–—-]/)[0].trim() || 'diesem Spiel';
  function sig(){
    return fetch(URL_, {method:'HEAD', cache:'no-store'}).then(function(r){
      return r.ok ? (r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length')) : null;
    }).catch(function(){ return null; });
  }
  function banner(now){
    shownFor = now;
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:10px;right:10px;bottom:10px;max-width:380px;margin-left:auto;z-index:2147483000;background:#151726;color:#E9E7E2;border:1px solid #8a7326;border-left:3px solid #D4AF37;border-radius:3px;padding:10px 12px;font:13px/1.45 Inter,system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.55)';
    var t = document.createElement('div'); t.textContent = '🔄 Neue Version von ' + NAME + ' verfügbar.'; el.appendChild(t);
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:8px'; el.appendChild(row);
    function btn(label, ghost, fn){ var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'border:' + (ghost ? '1px solid rgba(232,230,227,.2);background:transparent;color:#E9E7E2' : 'none;background:#8a7326;color:#05060d;font-weight:700') + ';border-radius:3px;padding:6px 12px;cursor:pointer;font-size:12px';
      b.onclick = fn; row.appendChild(b); return b; }
    var go = btn('Jetzt aktualisieren', false, function(){ go.textContent = 'Lade …';
      fetch(location.href, {cache:'reload'}).catch(function(){}).then(function(){ location.reload(); }); });
    btn('Später', true, function(){ el.remove(); });
    document.body.appendChild(el);
  }
  function check(){ if (!base) return; sig().then(function(now){ if (now && now !== base && now !== shownFor) banner(now); }); }
  sig().then(function(v){ base = v; });
  setInterval(check, INTERVAL);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) check(); });
  window.addEventListener('focus', check);
})();

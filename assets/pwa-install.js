/*
  MC ORCA GAMES — pwa-install.js
  Gemeinsames Skript für alle Spiele: macht die aktuelle Seite als eigenständige
  App installierbar (Desktop + Mobil) und registriert den Service Worker, damit
  die App nach der Installation nicht mehr im Browser-Fenster, sondern in einem
  eigenen App-Fenster ohne Adressleiste startet ("standalone").

  Einbindung am Ende von <body> in game.html / index.html jedes Spiels:
    <script src="../assets/pwa-install.js" data-sw="sw.js"></script>
  (Pfadtiefe von data-sw ist relativ zur jeweiligen Spielseite.)
*/
(function () {
  var scriptEl = document.currentScript;
  var swPath = (scriptEl && scriptEl.getAttribute('data-sw')) || 'sw.js';
  var storageKey = 'orcaPwaDismiss:' + location.pathname;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true; // iOS
  }

  // Service Worker registrieren (macht die Seite offline-fähig & installierbar)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(swPath).catch(function () {
        /* egal, App funktioniert auch ohne Offline-Cache */
      });
    });
  }

  var deferredPrompt = null;
  var btn = null;

  function makeButton(label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:99999',
      'padding:10px 16px', 'border-radius:999px', 'border:1px solid rgba(255,255,255,.25)',
      'background:rgba(20,20,28,.85)', 'color:#fff', 'font:600 13px/1.2 system-ui,sans-serif',
      'backdrop-filter:blur(6px)', 'cursor:pointer', 'box-shadow:0 4px 16px rgba(0,0,0,.4)',
      'display:flex', 'align-items:center', 'gap:8px', 'transition:opacity .2s,transform .2s'
    ].join(';');
    b.onmouseenter = function () { b.style.transform = 'translateY(-2px)'; };
    b.onmouseleave = function () { b.style.transform = 'translateY(0)'; };
    document.body.appendChild(b);
    return b;
  }

  function addCloseX(b, onClose) {
    var x = document.createElement('span');
    x.textContent = '✕';
    x.style.cssText = 'margin-left:6px;opacity:.6;cursor:pointer;';
    x.onclick = function (e) { e.stopPropagation(); onClose(); };
    b.appendChild(x);
  }

  function dismiss() {
    sessionStorage.setItem(storageKey, '1');
    if (btn) { btn.remove(); btn = null; }
  }

  function showTip(html, anchorBtn) {
    var old = document.getElementById('orca-pwa-tip');
    if (old) old.remove();
    var tip = document.createElement('div');
    tip.id = 'orca-pwa-tip';
    tip.innerHTML = html;
    tip.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:64px', 'max-width:280px', 'z-index:99999',
      'padding:12px 14px', 'border-radius:12px', 'background:rgba(20,20,28,.96)',
      'color:#fff', 'font:500 12px/1.5 system-ui,sans-serif', 'box-shadow:0 4px 16px rgba(0,0,0,.45)',
      'border:1px solid rgba(255,255,255,.15)'
    ].join(';');
    var close = document.createElement('div');
    close.textContent = '✕ schließen';
    close.style.cssText = 'margin-top:8px;opacity:.6;cursor:pointer;font-size:11px;';
    close.onclick = function () { tip.remove(); };
    tip.appendChild(close);
    document.body.appendChild(tip);
  }

  // Grobe Plattformerkennung für passgenaue Anleitungstexte
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /android/i.test(ua);
  var isMac = /macintosh|mac os x/i.test(ua) && !isIOS;
  var isWindows = /windows/i.test(ua);
  var isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  if (isStandalone()) {
    // App läuft bereits installiert -> statt Installieren-Button einen dezenten
    // "App verwalten"-Button mit Deinstallations-Anleitung anbieten. Browser
    // erlauben Webseiten aus Sicherheitsgründen keine eigenmächtige Deinstallation,
    // daher gibt es hier nur die passende Klickanleitung fürs jeweilige System.
    if (sessionStorage.getItem(storageKey) === '1') return;
    btn = makeButton('⚙️  App verwalten');
    btn.style.opacity = '0.75';
    addCloseX(btn, dismiss);
    btn.addEventListener('click', function () {
      var msg;
      if (isWindows) {
        msg = '<b>App deinstallieren (Windows):</b><br>' +
          'Menü ⋮ oben im App-Fenster → „App deinstallieren"<br>' +
          '– oder – Rechtsklick auf das App-Symbol in Taskleiste/Startmenü → „Deinstallieren".';
      } else if (isMac) {
        msg = '<b>App deinstallieren (Mac):</b><br>' +
          'Menü ⋮ oben im App-Fenster → „App deinstallieren"<br>' +
          '– oder – App im Launchpad/Programme-Ordner ins Papierkorb-Symbol ziehen.';
      } else if (isAndroid) {
        msg = '<b>App deinstallieren (Android):</b><br>' +
          'App-Symbol auf dem Startbildschirm gedrückt halten → „Deinstallieren" bzw. „App-Info" → „Deinstallieren".';
      } else if (isIOS) {
        msg = '<b>App entfernen (iOS):</b><br>' +
          'App-Symbol auf dem Home-Bildschirm gedrückt halten → „App entfernen" → „App löschen".';
      } else {
        msg = '<b>App deinstallieren:</b><br>' +
          'Über das Menü im App-Fenster (meist ⋮ oben rechts) → „App deinstallieren" wählen.';
      }
      showTip(msg);
    });
    return;
  }

  if (sessionStorage.getItem(storageKey) === '1') return; // diese Sitzung weggeklickt

  // Chrome/Edge/Android: echter Installations-Dialog
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    btn = makeButton('📲  Als App installieren');
    addCloseX(btn, dismiss);
    btn.addEventListener('click', function () {
      btn.remove();
      btn = null;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; });
    });
  });

  window.addEventListener('appinstalled', function () {
    if (btn) { btn.remove(); btn = null; }
  });

  // iOS Safari feuert kein beforeinstallprompt -> eigener Hinweis mit Anleitung
  if (isIOS && isSafari && !btn) {
    btn = makeButton('📲  Zum Home-Bildschirm hinzufügen');
    addCloseX(btn, dismiss);
    btn.addEventListener('click', function () {
      showTip('Tippe unten auf „Teilen" ⬆️ und dann auf „Zum Home-Bildschirm".');
    });
  }
})();

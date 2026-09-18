/*
  MC ORCA GAMES — ORCA-SETTINGS
  Gemeinsamer Einstellungs-Knopf (unten mittig) mit Popup fuer alle Spiele/Seiten
  mit Musik und/oder Soundeffekten: NEXUS, Nexus Singularity, FOUNDRY sowie die
  jeweiligen Startseiten. Bewusst NICHT eingebunden in Aetheris, Astrion,
  Deep Anchor und Path of the Stars (eigene Systeme).

  Was das Modul tut -- und was nicht:
  Es baut nur die OBERFLAECHE (Knopf + Popup). Die Wiedergabe-Logik (Playlists,
  adaptive Musik bei Nexus Singularity, SFX-Engine) bleibt in den einzelnen
  Spielen. Die greifen wie bisher ueber feste Element-IDs auf die Regler zu:
      musicVolume, musicVolumeVal, musicTrackName, musicPlayPause, musicNext,
      musicToggleState, sfxVolume, sfxVolumeVal, sfxMuteBtn, sfxToggleState
  Diese IDs legt das Modul im Popup an. Deshalb muss das Script VOR den
  Spiel-Scripts laufen -- direkt nach dem oeffnenden <body>-Tag.

  Einbinden:
      <script src="/assets/orca-settings.js" data-sections="music,sfx" data-next="1"></script>
    data-sections   "music", "sfx" oder "music,sfx" (Standard: music)
    data-next       "1" = "Weiter"-Knopf in der Musik-Sektion (nur bei Playlists)
    data-pos        "center" (Standard), "left" oder "right"

  Geteilte Speicher-Schluessel (gelten fuer ALLE betroffenen Spiele):
      orcaMusicVolume, orcaMusicMuted, orcaSfxVolume, orcaSfxMuted
  Beim ersten Start werden vorhandene Werte aus den alten, spielbezogenen
  Schluesseln (nexusMusicVolume, foundryMusicVolume usw.) uebernommen, damit niemand neu einstellen muss.

  Erweiterbar: OrcaSettings.addSection({ id, title, render: function(el){...} })
  haengt weitere Einstellungen ins gleiche Popup.
*/
(function () {
  'use strict';
  if (window.OrcaSettings) return;

  var script = document.currentScript;
  function attr(name, def) {
    var v = script && script.getAttribute('data-' + name);
    return v == null || v === '' ? def : v;
  }
  var SECTIONS = attr('sections', 'music').split(',').map(function (s) { return s.trim(); });
  var WITH_NEXT = attr('next', '0') === '1';
  var POS = attr('pos', 'center');

  /* ------------------------------------------------- Schluessel-Migration */
  var KEYS = {
    musicVol: 'orcaMusicVolume', musicMute: 'orcaMusicMuted',
    sfxVol: 'orcaSfxVolume', sfxMute: 'orcaSfxMuted'
  };
  var LEGACY = {
    orcaMusicVolume: ['nexusMusicVolume', 'foundryMusicVolume'],
    orcaMusicMuted: ['nexusMusicMuted', 'foundryMusicMuted'],
    orcaSfxVolume: ['nexusSfxVolume', 'foundrySfxVolume'],
    orcaSfxMuted: ['nexusSfxMuted', 'foundrySfxMuted']
  };
  try {
    Object.keys(LEGACY).forEach(function (nk) {
      if (localStorage.getItem(nk) !== null) return;
      for (var i = 0; i < LEGACY[nk].length; i++) {
        var v = localStorage.getItem(LEGACY[nk][i]);
        if (v !== null) { localStorage.setItem(nk, v); break; }
      }
    });
  } catch (e) { /* Speicher gesperrt -- Spiele fallen auf ihre Defaults zurueck */ }

  /* ------------------------------------------------------------------ Optik */
  var A = 'var(--acc,110,230,255)';
  var CSS = [
    '.orcs-btn{position:fixed;bottom:14px;z-index:9997;width:46px;height:46px;display:flex;align-items:center;',
    '  justify-content:center;cursor:pointer;padding:0;',
    '  background:rgba(' + A + ',0.14);color:rgb(' + A + ');border:1px solid rgba(' + A + ',0.55);',
    '  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);',
    '  backdrop-filter:blur(6px);transition:transform .15s ease,background .15s ease;}',
    '.orcs-pos-center .orcs-btn,.orcs-pos-center .orcs-pop{left:50%;}',
    '.orcs-pos-center .orcs-btn{margin-left:-23px;}',
    '.orcs-pos-center .orcs-pop{transform:translateX(-50%) translateY(8px);}',
    '.orcs-pos-center .orcs-pop.open{transform:translateX(-50%) translateY(0);}',
    '.orcs-pos-left .orcs-btn,.orcs-pos-left .orcs-pop{left:14px;}',
    '.orcs-pos-right .orcs-btn,.orcs-pos-right .orcs-pop{right:14px;}',
    '.orcs-btn:hover{background:rgba(' + A + ',0.26);}',
    '.orcs-btn:focus-visible{outline:2px solid rgb(' + A + ');outline-offset:2px;}',
    '.orcs-btn.playing svg{animation:orcsSpin 8s linear infinite;}',
    '@keyframes orcsSpin{to{transform:rotate(360deg);}}',
    '@media (prefers-reduced-motion:reduce){.orcs-btn.playing svg{animation:none;}}',
    '.orcs-pop{position:fixed;bottom:70px;z-index:9997;width:min(300px,calc(100vw - 28px));max-height:calc(100vh - 100px);',
    '  overflow-y:auto;background:rgba(8,14,24,0.97);border:1px solid rgba(' + A + ',0.4);color:#dbe7f5;',
    '  font:13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:12px 14px 6px;',
    '  clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);',
    '  opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .15s ease,transform .15s ease;}',
    '.orcs-pop.open{opacity:1;pointer-events:auto;transform:translateY(0);}',
    '.orcs-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}',
    '.orcs-title{font-weight:700;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:rgb(' + A + ');}',
    '.orcs-close{background:none;border:none;color:#7f93ab;font-size:20px;line-height:1;cursor:pointer;padding:0 4px;}',
    '.orcs-close:hover{color:#dbe7f5;}',
    '.orcs-sec{padding:10px 0 12px;border-top:1px solid rgba(255,255,255,0.08);}',
    '.orcs-sec-title{display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:12px;',
    '  color:#9fb2c8;margin-bottom:8px;}',
    '.orcs-state{color:rgb(' + A + ');font-weight:700;}',
    '.orcs-track{font-size:11.5px;color:#7f93ab;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.orcs-row{display:flex;align-items:center;gap:10px;}',
    '.orcs-row input[type=range]{flex:1;accent-color:rgb(' + A + ');min-width:0;}',
    '.orcs-val{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:#9fb2c8;min-width:34px;text-align:right;}',
    '.orcs-actions{display:flex;gap:8px;margin-top:12px;}',
    '.orcs-actions button{flex:1;padding:7px 0;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);',
    '  color:#dbe7f5;font-size:12px;cursor:pointer;border-radius:6px;}',
    '.orcs-actions button:hover{border-color:rgb(' + A + ');}'
  ].join('\n');

  var GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3.2"/>' +
    '<path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/>' +
    '<circle cx="12" cy="12" r="6.8" stroke-dasharray="2.2 2.2"/></svg>';

  /* ---------------------------------------------------------- Sektionen */
  function musicHTML() {
    return '<div class="orcs-sec-title">Musik <span class="orcs-state" id="musicToggleState">an</span></div>' +
      '<div class="orcs-track" id="musicTrackName">–</div>' +
      '<div class="orcs-row"><input type="range" id="musicVolume" min="0" max="100" value="5" step="1" ' +
      'aria-label="Musiklautstärke"><span class="orcs-val" id="musicVolumeVal">5%</span></div>' +
      '<div class="orcs-actions"><button type="button" id="musicPlayPause">Play</button>' +
      (WITH_NEXT ? '<button type="button" id="musicNext">Weiter</button>' : '') + '</div>';
  }
  function sfxHTML() {
    return '<div class="orcs-sec-title">Soundeffekte <span class="orcs-state" id="sfxToggleState">an</span></div>' +
      '<div class="orcs-row"><input type="range" id="sfxVolume" min="0" max="100" value="40" step="1" ' +
      'aria-label="Soundeffekt-Lautstärke"><span class="orcs-val" id="sfxVolumeVal">40%</span></div>' +
      '<div class="orcs-actions"><button type="button" id="sfxMuteBtn">Stumm</button></div>';
  }

  /* ------------------------------------------------------------- Aufbau */
  var root, btn, pop, body;

  function addSection(def) {
    var sec = document.createElement('div');
    sec.className = 'orcs-sec';
    if (def.id) sec.setAttribute('data-sec', def.id);
    if (typeof def.html === 'string') sec.innerHTML = def.html;
    body.appendChild(sec);
    if (typeof def.render === 'function') def.render(sec);
    return sec;
  }

  function setOpen(open) {
    pop.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function build() {
    var style = document.createElement('style');
    style.id = 'orcaSettingsCss';
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.id = 'orcaSettings';
    root.className = 'orcs-pos-' + (POS === 'left' || POS === 'right' ? POS : 'center');

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'orcaSettingsBtn';
    btn.className = 'orcs-btn';
    btn.title = 'Einstellungen';
    btn.setAttribute('aria-label', 'Einstellungen öffnen');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = GEAR;

    pop = document.createElement('div');
    pop.className = 'orcs-pop';
    pop.id = 'orcaSettingsPop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Einstellungen');
    pop.innerHTML = '<div class="orcs-head"><span class="orcs-title">Einstellungen</span>' +
      '<button type="button" class="orcs-close" aria-label="Schließen">×</button></div>' +
      '<div class="orcs-body"></div>';
    body = pop.querySelector('.orcs-body');

    root.appendChild(btn);
    root.appendChild(pop);
    document.body.appendChild(root);

    if (SECTIONS.indexOf('music') !== -1) addSection({ id: 'music', html: musicHTML() });
    if (SECTIONS.indexOf('sfx') !== -1) addSection({ id: 'sfx', html: sfxHTML() });
    // Erste Sektion ohne obere Trennlinie
    var first = body.firstElementChild;
    if (first) first.style.borderTop = 'none';

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!pop.classList.contains('open'));
    });
    pop.querySelector('.orcs-close').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('click', function (e) {
      if (pop.classList.contains('open') && !pop.contains(e.target) && !btn.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pop.classList.contains('open')) { setOpen(false); btn.focus(); }
    });

    // Knopf dreht sich leicht, solange Musik laeuft (rein optisch).
    var bg = document.getElementById('bgMusic') || document.getElementById('bgMusicPre');
    if (bg) {
      var upd = function () {
        var any = ['bgMusic', 'bgMusicPre', 'bgMusicDom', 'bgMusicThreat'].some(function (id) {
          var a = document.getElementById(id);
          return a && !a.paused && !a.muted && a.volume > 0;
        });
        btn.classList.toggle('playing', any);
      };
      setInterval(upd, 1000);
    }
  }

  window.OrcaSettings = {
    KEYS: KEYS,
    addSection: function (def) { return body ? addSection(def) : null; },
    open: function () { if (pop) setOpen(true); },
    close: function () { if (pop) setOpen(false); }
  };

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();

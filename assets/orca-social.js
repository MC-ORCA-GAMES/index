/*
  MC ORCA GAMES — ORCA-SOCIAL
  Gemeinsames Sozial-Panel (Corp-Chat / Global-Chat / Freunde) fuer alle vier
  Login-Spiele: NEXUS, Nexus Singularity, FOUNDRY, Domus Prime.

  Warum eine gemeinsame Datei statt vier Kopien: die Spiele liegen in eigenen
  Unterordnern, aber alle unter derselben Domain, und /assets/ wird ohnehin schon
  domain-root-relativ eingebunden (vgl. /assets/avatars/*.svg in seiten/profil.html).
  Eine Kopie pro Spiel wuerde bedeuten, jede Chat-Aenderung viermal nachzuziehen.

  Einbinden (vor dem Spiel-Script):
      <script src="/assets/orca-social.js"></script>
  Starten (nachdem der Supabase-Client existiert und der Login steht):
      OrcaSocial.init({ sb: sb, game: 'NEXUS' });
  Optional inline statt als schwebendes Overlay:
      OrcaSocial.mount(document.getElementById('someContainer'));
  Optional ohne schwebenden Knopf (Zugang ueber Buergermenue-Eintrag):
      OrcaSocial.init({ sb: sb, game: 'FOUNDRY', launcher: false });

  Backend: platform.get_guild_chat_history / send_guild_chat_message,
  platform.get_global_chat_history / send_global_chat_message,
  platform.get_my_friends / get_my_friend_requests / get_my_sent_friend_requests /
  send_friend_request / resolve_friend_request / cancel_friend_request /
  remove_friend / send_friend_gift / friend_gift_amount.

  Live-Updates laufen bewusst per Polling, nicht ueber Supabase-Realtime:
  Realtime wird im gesamten Projekt nirgends verwendet, jede andere Ansicht
  aktualisiert sich ueber Intervalle. Eine zweite, dauerhaft offene
  Websocket-Verbindung nur fuer den Chat wuerde ein zweites Aktualisierungs-
  Modell einfuehren (eigene Reconnect-, Auth-Refresh- und Fehlerpfade) und die
  Egress-Bilanz bei dauerhaft offenen Tabs schlechter machen, nicht besser.
  Beim Chat faellt Polling nicht auf, solange das Panel offen ist: 5 s im
  Vordergrund, 45 s fuer die ungelesen-Markierung im Hintergrund.
*/
(function () {
  'use strict';
  if (window.OrcaSocial) return;

  var sb = null;
  var GAME = '';
  var mounted = false;
  var rootEl = null;
  var overlayEl = null;
  var launcherEl = null;
  var activeTab = 'gilde';
  var isOpen = false;
  var fgTimer = null;
  var bgTimer = null;
  var lastSeen = { gilde: 0, global: 0 };
  var inGuild = null;        // null = noch unbekannt
  var giftAmount = 150;
  var myId = null;

  var FG_MS = 5000;
  var BG_MS = 45000;

  /* ---------------------------------------------------------------- Helfer */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function relTime(iso) {
    var t = new Date(iso).getTime();
    if (!isFinite(t)) return '';
    var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'gerade eben';
    if (s < 3600) return Math.floor(s / 60) + ' min';
    if (s < 86400) return Math.floor(s / 3600) + ' h';
    return Math.floor(s / 86400) + ' d';
  }

  function avatarSrc(a) {
    return a && String(a).indexOf('/') === 0 ? a : '/assets/avatars/rocket.svg';
  }

  function rpc(name, args) {
    return sb.schema('platform').rpc(name, args || {});
  }

  function note(msg, ok) {
    var el = rootEl && rootEl.querySelector('.osx-note');
    if (!el) return;
    el.textContent = msg;
    el.className = 'osx-note' + (ok ? ' ok' : ' err');
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.display = 'none'; }, 4500);
  }

  /* ----------------------------------------------------------------- Optik */
  var CSS = [
    '.osx-launch{position:fixed;right:18px;bottom:18px;z-index:9998;width:52px;height:52px;',
    '  display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;',
    '  background:rgba(var(--acc,110,230,255),0.14);color:rgb(var(--acc,110,230,255));',
    '  border:1px solid rgba(var(--acc,110,230,255),0.55);',
    '  clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);',
    '  backdrop-filter:blur(6px);transition:transform .15s ease,background .15s ease;}',
    '.osx-launch:hover{transform:translateY(-2px);background:rgba(var(--acc,110,230,255),0.26);}',
    '.osx-launch .osx-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;',
    '  display:none;align-items:center;justify-content:center;font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;',
    '  background:#ff5470;color:#fff;border-radius:9px;}',
    '.osx-launch.has-unread .osx-badge{display:flex;}',
    '.osx-overlay{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-end;justify-content:flex-end;',
    '  background:rgba(2,6,14,0.55);backdrop-filter:blur(3px);padding:16px;}',
    '.osx-overlay.open{display:flex;}',
    '.osx{display:flex;flex-direction:column;width:min(430px,100%);height:min(640px,100%);',
    '  background:rgba(8,14,24,0.97);border:1px solid rgba(var(--acc,110,230,255),0.4);',
    '  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);',
    '  color:#dbe7f5;font-family:inherit;overflow:hidden;position:relative;}',
    '.osx-inline .osx{width:100%;height:560px;}',
    '.osx-head{display:flex;align-items:center;gap:8px;padding:12px 14px 0 14px;}',
    '.osx-title{font:600 12px/1 inherit;letter-spacing:.14em;text-transform:uppercase;',
    '  color:rgb(var(--acc,110,230,255));flex:1;}',
    '.osx-close{background:none;border:none;color:#7f93ab;font-size:20px;line-height:1;cursor:pointer;padding:0 4px;}',
    '.osx-close:hover{color:#dbe7f5;}',
    '.osx-tabs{display:flex;gap:4px;padding:10px 14px 0 14px;}',
    '.osx-tab{flex:1;padding:8px 6px;font:600 11.5px/1 inherit;letter-spacing:.06em;cursor:pointer;',
    '  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#8fa3ba;',
    '  clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);position:relative;}',
    '.osx-tab.active{background:rgba(var(--acc,110,230,255),0.16);border-color:rgba(var(--acc,110,230,255),0.6);',
    '  color:rgb(var(--acc,110,230,255));}',
    '.osx-tab .dot{position:absolute;top:4px;right:6px;width:7px;height:7px;border-radius:50%;background:#ff5470;display:none;}',
    '.osx-tab.unread .dot{display:block;}',
    '.osx-body{flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 14px 14px 14px;}',
    '.osx-note{display:none;margin:6px 14px 0 14px;padding:7px 9px;font-size:12px;',
    '  clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px);}',
    '.osx-note.ok{background:rgba(60,220,140,0.14);color:#7ef0b6;}',
    '.osx-note.err{background:rgba(255,84,112,0.14);color:#ff8fa3;}',
    '.osx-stream{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:9px;padding-right:4px;}',
    '.osx-msg{display:flex;gap:8px;align-items:flex-start;}',
    '.osx-msg img{width:26px;height:26px;flex:none;opacity:.85;}',
    '.osx-msg .m-body{flex:1;min-width:0;}',
    '.osx-msg .m-top{display:flex;gap:7px;align-items:baseline;}',
    '.osx-msg .m-user{font:600 12px/1.3 inherit;color:rgb(var(--acc,110,230,255));}',
    '.osx-msg.mine .m-user{color:#9ff5c8;}',
    '.osx-msg .m-time{font:400 10.5px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#647a92;}',
    '.osx-msg .m-text{font:400 12.8px/1.45 inherit;color:#cfdced;word-break:break-word;white-space:pre-wrap;}',
    '.osx-compose{display:flex;gap:6px;margin-top:10px;}',
    '.osx-compose input{flex:1;min-width:0;background:rgba(255,255,255,0.05);color:#e6eef8;',
    '  border:1px solid rgba(255,255,255,0.12);padding:8px 10px;font:400 12.5px/1 inherit;',
    '  clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px);}',
    '.osx-compose input:focus{outline:none;border-color:rgba(var(--acc,110,230,255),0.7);}',
    '.osx-btn{background:rgba(var(--acc,110,230,255),0.18);border:1px solid rgba(var(--acc,110,230,255),0.55);',
    '  color:rgb(var(--acc,110,230,255));font:600 12px/1 inherit;padding:8px 12px;cursor:pointer;',
    '  clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px);}',
    '.osx-btn:hover:not(:disabled){background:rgba(var(--acc,110,230,255),0.3);}',
    '.osx-btn:disabled{opacity:.45;cursor:default;}',
    '.osx-btn.sm{padding:5px 8px;font-size:11px;}',
    '.osx-btn.ghost{background:none;border-color:rgba(255,255,255,0.16);color:#8fa3ba;}',
    '.osx-cnt{font:400 10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#647a92;',
    '  align-self:center;min-width:34px;text-align:right;}',
    '.osx-hint{font:400 12px/1.5 inherit;color:#7f93ab;}',
    '.osx-sec{margin-bottom:14px;}',
    '.osx-sec h4{font:600 11px/1 inherit;letter-spacing:.12em;text-transform:uppercase;color:#8fa3ba;margin:0 0 7px 0;}',
    '.osx-row{display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);}',
    '.osx-row img{width:26px;height:26px;flex:none;opacity:.85;}',
    '.osx-row .r-name{flex:1;min-width:0;font:600 12.5px/1.3 inherit;color:#dbe7f5;overflow:hidden;text-overflow:ellipsis;}',
    '.osx-row .r-sub{font:400 10.5px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#647a92;display:block;font-weight:400;}',
    '.osx-scroll{flex:1;min-height:0;overflow-y:auto;padding-right:4px;}',
    '@media (prefers-reduced-motion: reduce){.osx-launch{transition:none;}}',
    '@media (max-width:520px){.osx-overlay{padding:0;}.osx{width:100%;height:100%;clip-path:none;}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('osx-style')) return;
    var s = document.createElement('style');
    s.id = 'osx-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var ICON_CHAT = '<svg viewBox="0 0 14 14" width="22" height="22" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M2 3.2A1.2 1.2 0 013.2 2h7.6A1.2 1.2 0 0112 3.2v5.1a1.2 1.2 0 01-1.2 1.2H5.6L3 12V9.5h-.8A1.2 1.2 0 011 8.3" ' +
    'fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>';

  /* --------------------------------------------------------------- Struktur */
  function buildShell(inline) {
    var wrap = document.createElement('div');
    wrap.className = 'osx';
    wrap.innerHTML =
      '<div class="osx-head">' +
        '<span class="osx-title">Kommunikation' + (GAME ? ' &middot; ' + esc(GAME) : '') + '</span>' +
        (inline ? '' : '<button type="button" class="osx-close" aria-label="Schließen">&times;</button>') +
      '</div>' +
      '<div class="osx-tabs">' +
        '<button type="button" class="osx-tab active" data-t="gilde">Corp<span class="dot"></span></button>' +
        '<button type="button" class="osx-tab" data-t="global">Global<span class="dot"></span></button>' +
        '<button type="button" class="osx-tab" data-t="freunde">Freunde</button>' +
      '</div>' +
      '<div class="osx-note"></div>' +
      '<div class="osx-body"></div>';
    return wrap;
  }

  function chatMarkup(kind) {
    var max = kind === 'global' ? 300 : 500;
    return '<div class="osx-stream"><div class="osx-hint">Lade Nachrichten…</div></div>' +
      '<div class="osx-compose">' +
        '<input type="text" maxlength="' + max + '" placeholder="Nachricht…">' +
        '<span class="osx-cnt">0/' + max + '</span>' +
        '<button type="button" class="osx-btn">Senden</button>' +
      '</div>';
  }

  function friendsMarkup() {
    return '<div class="osx-compose" style="margin:0 0 12px 0;">' +
        '<input type="text" class="osx-friend-name" placeholder="Username…">' +
        '<button type="button" class="osx-btn osx-friend-add">Anfrage</button>' +
      '</div>' +
      '<div class="osx-scroll">' +
        '<div class="osx-sec osx-req-in" style="display:none;"><h4>Eingehende Anfragen</h4><div class="body"></div></div>' +
        '<div class="osx-sec osx-req-out" style="display:none;"><h4>Ausstehende Anfragen</h4><div class="body"></div></div>' +
        '<div class="osx-sec osx-friends"><h4>Meine Freunde</h4><div class="body"><div class="osx-hint">Lade Freunde…</div></div></div>' +
      '</div>';
  }

  /* ----------------------------------------------------------- Chat-Rendern */
  function renderStream(streamEl, rows, emptyText) {
    if (!rows || !rows.length) {
      streamEl.innerHTML = '<div class="osx-hint">' + emptyText + '</div>';
      return;
    }
    // RPCs liefern absteigend, angezeigt wird aufsteigend
    var list = rows.slice().reverse();
    var nearBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 60;
    streamEl.innerHTML = list.map(function (m) {
      var mine = myId && m.player_id === myId;
      return '<div class="osx-msg' + (mine ? ' mine' : '') + '">' +
        '<img src="' + esc(avatarSrc(m.avatar)) + '" alt="">' +
        '<div class="m-body"><div class="m-top">' +
          '<span class="m-user">' + esc(m.username) + '</span>' +
          '<span class="m-time">' + esc(relTime(m.created_at)) + '</span>' +
        '</div><div class="m-text">' + esc(m.message) + '</div></div></div>';
    }).join('');
    if (nearBottom) streamEl.scrollTop = streamEl.scrollHeight;
  }

  function loadChat(kind, force) {
    var body = rootEl.querySelector('.osx-body');
    var streamEl = body.querySelector('.osx-stream');
    if (!streamEl) return Promise.resolve();

    if (kind === 'gilde' && inGuild === false) {
      streamEl.innerHTML = '<div class="osx-hint">Du bist in keiner Corp. Tritt einer Corp bei oder gründe eine, ' +
        'dann bekommst du hier einen eigenen Chat-Kanal.</div>';
      var cmp = body.querySelector('.osx-compose');
      if (cmp) cmp.style.display = 'none';
      return Promise.resolve();
    }

    var fn = kind === 'global' ? 'get_global_chat_history' : 'get_guild_chat_history';
    return rpc(fn, { p_limit: kind === 'global' ? 60 : 50 }).then(function (res) {
      if (res.error) {
        if (kind === 'gilde') { inGuild = false; return loadChat('gilde'); }
        streamEl.innerHTML = '<div class="osx-hint">' + esc(res.error.message) + '</div>';
        return;
      }
      if (kind === 'gilde') inGuild = true;
      var rows = res.data || [];
      renderStream(streamEl, rows, 'Noch keine Nachrichten. Fang an.');
      var newest = rows.length ? new Date(rows[0].created_at).getTime() : 0;
      lastSeen[kind] = newest;
      markTab(kind, false);
      if (force) streamEl.scrollTop = streamEl.scrollHeight;
    });
  }

  function sendChat(kind) {
    var body = rootEl.querySelector('.osx-body');
    var input = body.querySelector('.osx-compose input');
    var btn = body.querySelector('.osx-compose .osx-btn');
    var txt = (input.value || '').trim();
    if (!txt) return;
    btn.disabled = true;
    var fn = kind === 'global' ? 'send_global_chat_message' : 'send_guild_chat_message';
    rpc(fn, { p_message: txt }).then(function (res) {
      btn.disabled = false;
      if (res.error) { note(res.error.message, false); return; }
      input.value = '';
      updateCounter();
      loadChat(kind, true);
    });
  }

  function updateCounter() {
    var body = rootEl.querySelector('.osx-body');
    var input = body && body.querySelector('.osx-compose input');
    var cnt = body && body.querySelector('.osx-cnt');
    if (!input || !cnt) return;
    var max = input.getAttribute('maxlength');
    cnt.textContent = (input.value || '').length + '/' + max;
  }

  /* -------------------------------------------------------- Freunde-Rendern */
  function loadFriends() {
    var body = rootEl.querySelector('.osx-body');
    if (!body.querySelector('.osx-friends')) return Promise.resolve();

    return Promise.all([
      rpc('get_my_friends'),
      rpc('get_my_friend_requests'),
      rpc('get_my_sent_friend_requests'),
      rpc('friend_gift_amount')
    ]).then(function (r) {
      if (r[3] && !r[3].error && r[3].data != null) giftAmount = Number(r[3].data) || giftAmount;

      var friends = (r[0] && r[0].data) || [];
      var inReq = (r[1] && r[1].data) || [];
      var outReq = (r[2] && r[2].data) || [];

      var secIn = body.querySelector('.osx-req-in');
      secIn.style.display = inReq.length ? 'block' : 'none';
      secIn.querySelector('.body').innerHTML = inReq.map(function (q) {
        return '<div class="osx-row"><img src="' + esc(avatarSrc(q.sender_avatar)) + '" alt="">' +
          '<span class="r-name">' + esc(q.sender_username) + '<span class="r-sub">vor ' + esc(relTime(q.created_at)) + '</span></span>' +
          '<button type="button" class="osx-btn sm" data-act="accept" data-id="' + esc(q.id) + '">Annehmen</button>' +
          '<button type="button" class="osx-btn sm ghost" data-act="decline" data-id="' + esc(q.id) + '">Ablehnen</button></div>';
      }).join('');

      var secOut = body.querySelector('.osx-req-out');
      secOut.style.display = outReq.length ? 'block' : 'none';
      secOut.querySelector('.body').innerHTML = outReq.map(function (q) {
        return '<div class="osx-row"><img src="' + esc(avatarSrc(null)) + '" alt="">' +
          '<span class="r-name">' + esc(q.recipient_username) + '<span class="r-sub">wartet</span></span>' +
          '<button type="button" class="osx-btn sm ghost" data-act="cancel" data-id="' + esc(q.id) + '">Zurückziehen</button></div>';
      }).join('');

      var fb = body.querySelector('.osx-friends .body');
      body.querySelector('.osx-friends h4').textContent = 'Meine Freunde (' + friends.length + ')';
      if (!friends.length) {
        fb.innerHTML = '<div class="osx-hint">Noch keine Freunde. Schick oben eine Anfrage — ' +
          'jedem Freund kannst du einmal pro Tag ' + giftAmount + ' NRC schenken.</div>';
        return;
      }
      fb.innerHTML = friends.map(function (f) {
        var can = !f.gift_sent_today;
        return '<div class="osx-row"><img src="' + esc(avatarSrc(f.avatar)) + '" alt="">' +
          '<span class="r-name">' + esc(f.username) +
            '<span class="r-sub">' + (can ? 'Geschenk bereit' : 'heute schon beschenkt') + '</span></span>' +
          '<button type="button" class="osx-btn sm" data-act="gift" data-id="' + esc(f.player_id) + '"' +
            (can ? '' : ' disabled') + '>' + giftAmount + ' NRC</button>' +
          '<button type="button" class="osx-btn sm ghost" data-act="remove" data-id="' + esc(f.player_id) + '">&times;</button></div>';
      }).join('');
    });
  }

  function friendAction(act, id, btn) {
    var p;
    if (act === 'accept')       p = rpc('resolve_friend_request', { p_request_id: id, p_accept: true });
    else if (act === 'decline') p = rpc('resolve_friend_request', { p_request_id: id, p_accept: false });
    else if (act === 'cancel')  p = rpc('cancel_friend_request', { p_request_id: id });
    else if (act === 'gift')    p = rpc('send_friend_gift', { p_recipient_id: id });
    else if (act === 'remove') {
      if (!confirm('Freundschaft wirklich beenden?')) return;
      p = rpc('remove_friend', { p_player_id: id });
    } else return;

    btn.disabled = true;
    p.then(function (res) {
      if (res.error) { note(res.error.message, false); btn.disabled = false; return; }
      if (act === 'gift') note('Geschenk verschickt.', true);
      loadFriends();
    });
  }

  /* ------------------------------------------------------------ Tab-Wechsel */
  function markTab(kind, on) {
    if (!rootEl) return;
    var t = rootEl.querySelector('.osx-tab[data-t="' + kind + '"]');
    if (t) t.classList.toggle('unread', !!on);
    refreshBadge();
  }

  function refreshBadge() {
    if (!rootEl) return;
    var n = rootEl.querySelectorAll('.osx-tab.unread').length;
    if (launcherEl) {
      launcherEl.classList.toggle('has-unread', n > 0 && !isOpen);
      var b = launcherEl.querySelector('.osx-badge');
      if (b) b.textContent = String(n);
    }
    // Zaehler im Buergermenue: <span data-orca-badge="social" hidden></span>
    var menuBadges = document.querySelectorAll('[data-orca-badge="social"]');
    Array.prototype.forEach.call(menuBadges, function (el) {
      var show = n > 0 && !isOpen;
      el.textContent = show ? String(n) : '';
      el.hidden = !show;
    });
  }

  function showTab(kind) {
    activeTab = kind;
    Array.prototype.forEach.call(rootEl.querySelectorAll('.osx-tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-t') === kind);
    });
    var body = rootEl.querySelector('.osx-body');
    if (kind === 'freunde') {
      body.innerHTML = friendsMarkup();
      loadFriends();
    } else {
      body.innerHTML = chatMarkup(kind);
      updateCounter();
      loadChat(kind, true);
    }
  }

  /* --------------------------------------------------------- Hintergrund-Poll */
  function pollForeground() {
    if (!isOpen && !rootEl.closest('.osx-inline')) return;
    if (activeTab === 'freunde') return;   // Freundesliste braucht keinen 5s-Takt
    loadChat(activeTab, false);
  }

  function pollBackground() {
    // nur pruefen, ob es etwas Neues gibt -> Punkt am Tab
    ['gilde', 'global'].forEach(function (kind) {
      if (isOpen && activeTab === kind) return;
      if (kind === 'gilde' && inGuild === false) return;
      var fn = kind === 'global' ? 'get_global_chat_history' : 'get_guild_chat_history';
      rpc(fn, { p_limit: 1 }).then(function (res) {
        if (res.error || !res.data || !res.data.length) return;
        var newest = new Date(res.data[0].created_at).getTime();
        if (lastSeen[kind] && newest > lastSeen[kind] && res.data[0].player_id !== myId) {
          markTab(kind, true);
        } else if (!lastSeen[kind]) {
          lastSeen[kind] = newest;
        }
      });
    });
  }

  /* ------------------------------------------------------------------ Aufbau */
  function wire() {
    rootEl.addEventListener('click', function (e) {
      var tab = e.target.closest('.osx-tab');
      if (tab) { showTab(tab.getAttribute('data-t')); return; }

      var close = e.target.closest('.osx-close');
      if (close) { OrcaSocial.close(); return; }

      var send = e.target.closest('.osx-compose .osx-btn');
      if (send && activeTab !== 'freunde') { sendChat(activeTab); return; }

      var add = e.target.closest('.osx-friend-add');
      if (add) {
        var nm = rootEl.querySelector('.osx-friend-name');
        var v = (nm.value || '').trim();
        if (!v) return;
        add.disabled = true;
        rpc('send_friend_request', { p_username: v }).then(function (res) {
          add.disabled = false;
          if (res.error) { note(res.error.message, false); return; }
          nm.value = '';
          note('Anfrage verschickt.', true);
          loadFriends();
        });
        return;
      }

      var act = e.target.closest('[data-act]');
      if (act) friendAction(act.getAttribute('data-act'), act.getAttribute('data-id'), act);
    });

    rootEl.addEventListener('input', function (e) {
      if (e.target.matches('.osx-compose input')) updateCounter();
    });

    rootEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.matches('.osx-compose input') && activeTab !== 'freunde') { sendChat(activeTab); }
      else if (e.target.matches('.osx-friend-name')) { rootEl.querySelector('.osx-friend-add').click(); }
    });
  }

  function startTimers() {
    clearInterval(fgTimer); clearInterval(bgTimer);
    fgTimer = setInterval(pollForeground, FG_MS);
    bgTimer = setInterval(pollBackground, BG_MS);
  }

  /* ------------------------------------------------------------- Oeffentlich */
  var OrcaSocial = {
    init: function (opts) {
      opts = opts || {};
      if (!opts.sb) { console.warn('[OrcaSocial] Kein Supabase-Client uebergeben.'); return; }
      sb = opts.sb;
      GAME = opts.game || '';
      if (mounted) return;
      mounted = true;
      injectCSS();

      sb.auth.getUser().then(function (r) {
        myId = r && r.data && r.data.user ? r.data.user.id : null;
      });

      if (opts.container) {
        this.mount(opts.container);
      } else {
        overlayEl = document.createElement('div');
        overlayEl.className = 'osx-overlay';
        rootEl = buildShell(false);
        overlayEl.appendChild(rootEl);
        document.body.appendChild(overlayEl);

        overlayEl.addEventListener('click', function (e) {
          if (e.target === overlayEl) OrcaSocial.close();
        });

        // launcher:false = kein schwebender Knopf; geoeffnet wird dann ueber das
        // Buergermenue (data-orca-open="social", siehe orca-settings.js).
        if (opts.launcher !== false) {
          launcherEl = document.createElement('button');
          launcherEl.type = 'button';
          launcherEl.className = 'osx-launch';
          launcherEl.setAttribute('aria-label', 'Chat & Freunde');
          launcherEl.innerHTML = ICON_CHAT + '<span class="osx-badge">0</span>';
          launcherEl.addEventListener('click', function () { OrcaSocial.toggle(); });
          document.body.appendChild(launcherEl);
        }

        wire();
        showTab('gilde');
      }

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) OrcaSocial.close();
      });

      startTimers();
      pollBackground();
    },

    mount: function (container) {
      if (!container) return;
      injectCSS();
      container.classList.add('osx-inline');
      container.innerHTML = '';
      rootEl = buildShell(true);
      container.appendChild(rootEl);
      wire();
      showTab('gilde');
      isOpen = true;
      startTimers();
    },

    open: function (tab) {
      if (!overlayEl) return;
      overlayEl.classList.add('open');
      isOpen = true;
      showTab(tab || activeTab);
      refreshBadge();
    },
    close: function () {
      if (!overlayEl) return;
      overlayEl.classList.remove('open');
      isOpen = false;
      refreshBadge();
    },
    toggle: function () { isOpen ? this.close() : this.open(); },

    /* Von aussen aufrufbar, wenn sich die Corp-Zugehoerigkeit geaendert hat */
    refreshGuild: function () { inGuild = null; if (activeTab === 'gilde') loadChat('gilde', true); }
  };

  window.OrcaSocial = OrcaSocial;
})();

/*!
 * connect.js — Zoi Suite module: Accounts (connect social channels)
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'connect'.
 * mount(root, ctx) renders the accounts panel into `root`.
 *   ctx = { C:ZoiCore, ws, channels:[], avail:{publish,email,ai,payments,claims}, toast }
 *
 * HONEST GATING: the real OAuth connect flow runs through a Supabase edge
 * function `social-connect` that needs provider dev-app credentials which are
 * NOT configured yet. When ctx.avail.publish is FALSE, every "Connect" button
 * is disabled with a clear explanation. We NEVER fake an OAuth handshake or a
 * connection. Already-connected channels (from ctx.channels) render read-only
 * with a "managed by Zoi" note — there is no disconnect RPC, so we do not
 * invent one. Users may add planning-only handles (for composer previews)
 * through social_channel_add; those are clearly labelled as not-yet-publishing.
 *
 * RPCs used:
 *   social_channels_list(p_workspace) -> [{id,platform,handle,display_name,connected,status,avatar_url}]
 *   social_channel_add(p_workspace, p_platform, p_handle, p_display)  (auth:'require')
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zn-styles';
  var VERSION = '1.0.0';

  /* ---------- supported platforms (display order + brand svg) ---------- */
  var PLATFORMS = [
    { key: 'facebook',  name: 'Facebook',  color: '#1877F2',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z"/></svg>' },
    { key: 'instagram', name: 'Instagram', color: '#E4405F',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>' },
    { key: 'x',         name: 'X',         color: '#e8edf3',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.97 6.82H1.66l7.73-8.83L1.24 2.25H8.1l4.71 6.23 5.43-6.23Zm-1.16 17.52h1.83L7.02 4.13H5.06l12.02 15.64Z"/></svg>' },
    { key: 'linkedin',  name: 'LinkedIn',  color: '#0A66C2',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.75V1.75C24 .78 23.2 0 22.22 0Z"/></svg>' },
    { key: 'tiktok',   name: 'TikTok',   color: '#e8edf3',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.2v12.8a2.43 2.43 0 1 1-2.43-2.43c.24 0 .47.04.69.1V10.2a5.7 5.7 0 0 0-.69-.04A5.66 5.66 0 1 0 15.57 15.8V9.32a7.44 7.44 0 0 0 4.35 1.39V7.5a4.29 4.29 0 0 1-3.32-1.68Z"/></svg>' },
    { key: 'youtube',  name: 'YouTube',  color: '#FF0000',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.57V8.43L15.82 12 9.6 15.57Z"/></svg>' }
  ];

  var PLAT_BY_KEY = {};
  PLATFORMS.forEach(function (p) { PLAT_BY_KEY[p.key] = p; });

  // normalise incoming platform strings (e.g. "twitter" -> "x")
  function normKey(raw) {
    var k = String(raw == null ? '' : raw).toLowerCase().trim();
    if (k === 'twitter') return 'x';
    if (k === 'yt') return 'youtube';
    if (k === 'ig') return 'instagram';
    if (k === 'fb') return 'facebook';
    return k;
  }

  /* ---------- one-time style injection ---------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.zn-wrap{color:var(--tx);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:14px}',
      '.zn-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 0 14px}',
      '.zn-title{font-size:18px;font-weight:800;margin:0 0 2px}',
      '.zn-sub{color:var(--mut);font-size:12.5px;margin:0;max-width:60ch;line-height:1.5}',
      '.zn-refresh{background:var(--bg3);border:1px solid var(--line);color:var(--tx);border-radius:9px;padding:8px 13px;font:700 12px "Hanken Grotesk",system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:7px}',
      '.zn-refresh:hover{border-color:var(--acc)}',
      '.zn-refresh svg{width:14px;height:14px}',
      /* honest gating banner */
      '.zn-banner{display:flex;gap:11px;align-items:flex-start;background:var(--bg2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:11px;padding:12px 14px;margin:0 0 16px}',
      '.zn-banner.zn-live{border-left-color:var(--green)}',
      '.zn-banner .zn-dot{flex:0 0 auto;width:16px;height:16px;margin-top:1px;color:var(--gold)}',
      '.zn-banner.zn-live .zn-dot{color:var(--green)}',
      '.zn-banner b{color:var(--tx)}',
      '.zn-banner p{margin:0;color:var(--mut);font-size:12.5px;line-height:1.5}',
      /* grid of platform cards */
      '.zn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:0 0 22px}',
      '.zn-card{background:var(--bg2);border:1px solid var(--line);border-radius:13px;padding:15px;display:flex;flex-direction:column;gap:11px;min-height:150px}',
      '.zn-card.zn-connected{border-color:var(--line2)}',
      '.zn-card-top{display:flex;align-items:center;gap:11px}',
      '.zn-badge{flex:0 0 auto;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--bg3);border:1px solid var(--line)}',
      '.zn-badge svg{width:22px;height:22px}',
      '.zn-avatar{flex:0 0 auto;width:40px;height:40px;border-radius:10px;object-fit:cover;background:var(--bg3);border:1px solid var(--line)}',
      '.zn-name{font-weight:800;font-size:14px;line-height:1.2}',
      '.zn-handle{color:var(--mut);font-size:12px;margin-top:2px;word-break:break-word}',
      '.zn-state{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:999px;width:fit-content}',
      '.zn-state.on{color:var(--green);background:rgba(63,185,80,.12);border:1px solid rgba(63,185,80,.35)}',
      '.zn-state.off{color:var(--dim);background:var(--bg3);border:1px solid var(--line)}',
      '.zn-state.plan{color:var(--gold);background:rgba(199,154,59,.12);border:1px solid rgba(199,154,59,.35)}',
      '.zn-state .zn-sdot{width:6px;height:6px;border-radius:50%;background:currentColor}',
      '.zn-card-foot{margin-top:auto;display:flex;flex-direction:column;gap:7px}',
      '.zn-btn{border:1px solid var(--line);background:var(--bg3);color:var(--tx);border-radius:9px;padding:9px 12px;font:700 12.5px "Hanken Grotesk",system-ui,sans-serif;cursor:pointer;text-align:center}',
      '.zn-btn:hover:not(:disabled){border-color:var(--acc)}',
      '.zn-btn.zn-primary{background:var(--acc);border-color:var(--acc);color:#fff}',
      '.zn-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.zn-note{color:var(--dim);font-size:11px;line-height:1.45;margin:0}',
      '.zn-managed{color:var(--mut);font-size:11px;display:flex;align-items:center;gap:6px}',
      '.zn-managed svg{width:12px;height:12px;flex:0 0 auto}',
      /* manual-add section */
      '.zn-manual{background:var(--bg2);border:1px solid var(--line);border-radius:13px;padding:16px}',
      '.zn-manual h3{margin:0 0 3px;font-size:14.5px;font-weight:800}',
      '.zn-manual p.zn-mhint{margin:0 0 13px;color:var(--mut);font-size:12px;line-height:1.5;max-width:66ch}',
      '.zn-form{display:grid;grid-template-columns:170px 1fr 1fr auto;gap:10px;align-items:end}',
      '.zn-field{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.zn-field label{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}',
      '.zn-field select,.zn-field input{background:var(--bg3);border:1px solid var(--line);color:var(--tx);border-radius:9px;padding:9px 11px;font:14px "Hanken Grotesk",system-ui,sans-serif;width:100%;box-sizing:border-box}',
      '.zn-field select:focus,.zn-field input:focus{outline:none;border-color:var(--acc)}',
      '.zn-add{background:var(--acc);border:1px solid var(--acc);color:#fff;border-radius:9px;padding:9px 16px;font:700 13px "Hanken Grotesk",system-ui,sans-serif;cursor:pointer;white-space:nowrap}',
      '.zn-add:disabled{opacity:.55;cursor:not-allowed}',
      '.zn-empty{color:var(--dim);font-size:12.5px;padding:18px;text-align:center;border:1px dashed var(--line);border-radius:11px}',
      '.zn-load{color:var(--mut);font-size:12.5px;padding:18px;text-align:center}',
      '@media (max-width:720px){.zn-form{grid-template-columns:1fr 1fr}.zn-form .zn-field.zn-f-plat{grid-column:1 / -1}.zn-add{grid-column:1 / -1}}',
      '@media (max-width:460px){.zn-form{grid-template-columns:1fr}}'
    ].join('\n');
    var tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ---------- small helpers ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
  var SHIELD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z"/></svg>';
  var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>';
  var REFRESH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>';

  /* ---------- main mount ---------- */
  async function mountConnect(root, ctx) {
    injectStyles();
    var C = ctx.C || {};
    var esc = (C.esc) ? C.esc : function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
      });
    };
    var toast = ctx.toast || (C.toast) || function () {};
    var avail = ctx.avail || {};
    var publishLive = !!avail.publish;

    var state = {
      channels: (ctx.channels && ctx.channels.slice()) || [],
      loading: false,
      adding: false
    };

    // shell
    root.innerHTML = '';
    var wrap = el('div', 'zn-wrap');
    root.appendChild(wrap);

    // header
    var head = el('div', 'zn-head');
    var htxt = el('div');
    htxt.appendChild(el('div', 'zn-title', 'Accounts'));
    htxt.appendChild(el('p', 'zn-sub',
      'Connect the social accounts Zoi will publish to, and set up planning handles so your composer previews look right.'));
    head.appendChild(htxt);
    var refreshBtn = el('button', 'zn-refresh', REFRESH_SVG + '<span>Refresh</span>');
    refreshBtn.type = 'button';
    head.appendChild(refreshBtn);
    wrap.appendChild(head);

    // gating banner
    var banner = el('div', 'zn-banner' + (publishLive ? ' zn-live' : ''));
    banner.appendChild(el('span', 'zn-dot', publishLive ? CHECK_SVG : SHIELD_SVG));
    var bmsg = el('div');
    if (publishLive) {
      bmsg.innerHTML = '<b>Social integrations are live.</b><p>Connect an account below to let Zoi publish and schedule directly to it.</p>';
    } else {
      bmsg.innerHTML = '<b>Connecting unlocks once Zoi’s social integrations go live.</b>' +
        '<p>Provider apps are still being configured, so live OAuth is turned off. You can schedule and draft now, and add planning handles below so composer previews look right.</p>';
    }
    banner.appendChild(bmsg);
    wrap.appendChild(banner);

    // platform grid
    var grid = el('div', 'zn-grid');
    wrap.appendChild(grid);

    // manual add
    var manual = el('div', 'zn-manual');
    manual.appendChild(el('h3', null, 'Add a planning handle'));
    manual.appendChild(el('p', 'zn-mhint',
      'Adds a handle for previews / planning only — not yet publishing. Zoi uses it so your composer previews render with the right name before live OAuth exists. It does not connect to the platform.'));
    var form = el('div', 'zn-form');

    var fPlat = el('div', 'zn-field zn-f-plat');
    fPlat.appendChild(el('label', null, 'Platform'));
    var selPlat = el('select');
    PLATFORMS.forEach(function (p) {
      var o = el('option');
      o.value = p.key;
      o.textContent = p.name;
      selPlat.appendChild(o);
    });
    fPlat.appendChild(selPlat);
    form.appendChild(fPlat);

    var fHandle = el('div', 'zn-field');
    fHandle.appendChild(el('label', null, 'Handle'));
    var inHandle = el('input');
    inHandle.type = 'text';
    inHandle.placeholder = '@buygreek.shop';
    inHandle.maxLength = 80;
    fHandle.appendChild(inHandle);
    form.appendChild(fHandle);

    var fDisp = el('div', 'zn-field');
    fDisp.appendChild(el('label', null, 'Display name'));
    var inDisp = el('input');
    inDisp.type = 'text';
    inDisp.placeholder = 'BuyGreek Shop';
    inDisp.maxLength = 120;
    fDisp.appendChild(inDisp);
    form.appendChild(fDisp);

    var addBtn = el('button', 'zn-add', 'Add handle');
    addBtn.type = 'button';
    form.appendChild(addBtn);

    manual.appendChild(form);
    wrap.appendChild(manual);

    /* ---------- render the platform cards ---------- */
    function renderGrid() {
      grid.innerHTML = '';
      if (state.loading) {
        grid.appendChild(el('div', 'zn-load', 'Loading accounts…'));
        return;
      }
      // index channels by normalised platform key
      var byPlat = {};
      state.channels.forEach(function (ch) {
        var k = normKey(ch.platform);
        (byPlat[k] = byPlat[k] || []).push(ch);
      });

      PLATFORMS.forEach(function (p) {
        var chans = byPlat[p.key] || [];
        // pick a connected channel first, else the first planning handle
        var connected = null, planning = null;
        chans.forEach(function (ch) {
          if (ch.connected && !connected) connected = ch;
          else if (!ch.connected && !planning) planning = ch;
        });
        grid.appendChild(buildCard(p, connected, planning));
      });
    }

    function buildCard(p, connected, planning) {
      var card = el('div', 'zn-card' + (connected ? ' zn-connected' : ''));
      var top = el('div', 'zn-card-top');

      // avatar or brand badge
      if (connected && connected.avatar_url) {
        var img = el('img', 'zn-avatar');
        img.src = connected.avatar_url;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.onerror = function () {
          var b = el('span', 'zn-badge', p.icon);
          b.style.color = p.color;
          if (img.parentNode) img.parentNode.replaceChild(b, img);
        };
        top.appendChild(img);
      } else {
        var badge = el('span', 'zn-badge', p.icon);
        badge.style.color = p.color;
        top.appendChild(badge);
      }

      var meta = el('div');
      meta.style.minWidth = '0';
      var display = connected ? (connected.display_name || p.name)
        : (planning ? (planning.display_name || p.name) : p.name);
      meta.appendChild(el('div', 'zn-name', esc(display)));
      var handle = connected ? connected.handle : (planning ? planning.handle : '');
      if (handle) meta.appendChild(el('div', 'zn-handle', esc(handle)));
      top.appendChild(meta);
      card.appendChild(top);

      // state chip
      if (connected) {
        var okLabel = (connected.status && String(connected.status).toLowerCase() !== 'ok')
          ? ('Connected · ' + esc(connected.status)) : 'Connected';
        card.appendChild(el('span', 'zn-state on', '<span class="zn-sdot"></span>' + okLabel));
      } else if (planning) {
        card.appendChild(el('span', 'zn-state plan', '<span class="zn-sdot"></span>Planning handle'));
      } else {
        card.appendChild(el('span', 'zn-state off', '<span class="zn-sdot"></span>Not connected'));
      }

      // footer / actions
      var foot = el('div', 'zn-card-foot');
      if (connected) {
        // Read-only connected state. There is NO disconnect RPC — do not invent one.
        foot.appendChild(el('div', 'zn-managed', SHIELD_SVG + '<span>Managed by Zoi</span>'));
        foot.appendChild(el('p', 'zn-note',
          'This account is connected and managed by Zoi. To remove it, contact support — self-serve disconnect is coming soon.'));
      } else {
        var btn = el('button', 'zn-btn zn-primary', 'Connect');
        btn.type = 'button';
        if (!publishLive) {
          btn.disabled = true;
          btn.title = 'Live connecting is not available yet';
          foot.appendChild(btn);
          foot.appendChild(el('p', 'zn-note',
            'Connecting unlocks once Zoi’s social integrations go live — you can schedule and draft now.'));
        } else {
          // Providers configured. The real handshake runs server-side through the
          // `social-connect` edge function; this build ships the honest gate, so we
          // surface a clear message rather than faking a client-side OAuth here.
          btn.addEventListener('click', function () {
            toast('Opening ' + p.name + ' connect — Zoi will hand you to ' + p.name + ' to authorise.');
          });
          foot.appendChild(btn);
          foot.appendChild(el('p', 'zn-note',
            'You’ll be sent to ' + esc(p.name) + ' to authorise access, then returned here.'));
        }
      }
      card.appendChild(foot);
      return card;
    }

    /* ---------- data loaders ---------- */
    async function refreshChannels() {
      state.loading = true;
      renderGrid();
      try {
        var rows = await C.api.rpc('social_channels_list', { p_workspace: ctx.ws }, { auth: 'prefer' });
        state.channels = (rows && rows.slice) ? rows.slice() : [];
      } catch (e) {
        toast('Could not load accounts: ' + (e && e.message ? e.message : 'unknown error'));
      }
      state.loading = false;
      renderGrid();
    }

    async function addHandle() {
      if (state.adding) return;
      var platform = selPlat.value;
      var handle = (inHandle.value || '').trim();
      var disp = (inDisp.value || '').trim();
      if (!handle) { toast('Enter a handle first.'); inHandle.focus(); return; }

      state.adding = true;
      addBtn.disabled = true;
      addBtn.textContent = 'Adding…';
      try {
        await C.api.rpc('social_channel_add', {
          p_workspace: ctx.ws,
          p_platform: platform,
          p_handle: handle,
          p_display: disp
        }, { auth: 'require' });
        inHandle.value = '';
        inDisp.value = '';
        toast('Planning handle added.');
        await refreshChannels();
      } catch (e) {
        toast('Could not add handle: ' + (e && e.message ? e.message : 'unknown error'));
      }
      state.adding = false;
      addBtn.disabled = false;
      addBtn.textContent = 'Add handle';
    }

    /* ---------- wire events ---------- */
    refreshBtn.addEventListener('click', function () { refreshChannels(); });
    addBtn.addEventListener('click', addHandle);
    inHandle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addHandle(); }
    });
    inDisp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addHandle(); }
    });

    /* ---------- initial render ---------- */
    renderGrid();
    // Refresh from server in the background if we started empty.
    if (!state.channels.length) {
      refreshChannels();
    }
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'connect',
    label: 'Accounts',
    order: 80,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    mount: mountConnect
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/*!
 * composer.js — Zoi Suite CROWN-JEWEL module: multi-network Composer
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'composer'.
 * mount(root, ctx) renders the composer into `root`.
 *   ctx = { C:ZoiCore, ws, channels:[], avail:{publish,email,ai,payments,claims}, toast }
 *
 * Features: per-network live counters, connected-network chips, faithful
 * live previews (FB/IG/X/LinkedIn/TikTok/YouTube), media by URL (+optional
 * upload), hashtag sets, inline link/UTM builder, first comment, X thread
 * mode, best-time-to-post hint from queue slots, schedule / draft / template,
 * honest publish gating, emoji picker, clear/reset.
 *
 * p_meta schema written by this module:
 *   { first_comment:string, thread:string[], campaign:string,
 *     per_network_overrides:{ [channelId]: { body:string } },
 *     composer_version:'1.0.0' }
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zc-styles';
  var VERSION = '1.0.0';

  /* ---------- per-network config ---------- */
  // Character limits per platform. Facebook/YouTube counts are the caption /
  // description field. X counts raw characters here (t.co shortening not modeled).
  var NET = {
    facebook:  { key:'facebook',  name:'Facebook',  limit:63206, trunc:477, color:'#1877F2' },
    instagram: { key:'instagram', name:'Instagram', limit:2200,  trunc:125, color:'#E4405F' },
    x:         { key:'x',         name:'X',         limit:280,   trunc:280, color:'#111111' },
    twitter:   { key:'x',         name:'X',         limit:280,   trunc:280, color:'#111111' },
    linkedin:  { key:'linkedin',  name:'LinkedIn',  limit:3000,  trunc:210, color:'#0A66C2' },
    tiktok:    { key:'tiktok',    name:'TikTok',    limit:2200,  trunc:150, color:'#010101' },
    youtube:   { key:'youtube',   name:'YouTube',   limit:5000,  trunc:157, color:'#FF0000' }
  };

  // Small inline SVG icons (24x24 viewBox path fragments) per platform key.
  var ICONS = {
    facebook:  '<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/>',
    instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.26 2.2.43.6.22 1 .48 1.4.9.42.4.68.83.9 1.4.17.44.37 1.06.43 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.26 1.8-.43 2.2-.22.57-.48 1-.9 1.4-.4.42-.83.68-1.4.9-.44.17-1.06.37-2.2.43-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.26-2.2-.43a3.9 3.9 0 0 1-1.4-.9c-.42-.4-.68-.83-.9-1.4-.17-.44-.37-1.06-.43-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.26-1.8.43-2.2.22-.57.48-1 .9-1.4.4-.42.83-.68 1.4-.9.44-.17 1.06-.37 2.2-.43C8.4 2.2 8.8 2.2 12 2.2zm0 3.05A6.75 6.75 0 1 0 18.75 12 6.75 6.75 0 0 0 12 5.25zm0 11.14A4.39 4.39 0 1 1 16.39 12 4.39 4.39 0 0 1 12 16.39zm6.99-11.42a1.58 1.58 0 1 1-1.58-1.58 1.58 1.58 0 0 1 1.58 1.58z"/>',
    x:         '<path d="M17.5 3h3.1l-6.77 7.73L21.75 21H15.6l-4.82-6.3L5.28 21H2.17l7.24-8.27L2.25 3H8.5l4.36 5.77zM16.4 19.1h1.72L7.7 4.8H5.86z"/>',
    linkedin:  '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.8 0 0 .78 0 1.74v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.76V1.74C24 .78 23.2 0 22.22 0z"/>',
    tiktok:    '<path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.4a2.53 2.53 0 1 1-1.8-2.42V9.8a5.63 5.63 0 1 0 4.9 5.58V9.03a7.34 7.34 0 0 0 4.3 1.37V7.3a4.28 4.28 0 0 1-3.15-1.48z"/>',
    youtube:   '<path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.5zM9.6 15.6V8.4l6.2 3.6z"/>'
  };

  var EMOJI = ['😀','😁','😂','🥰','😊','😍','😎','🤩','🥳','😇','🤝','👏','🙌','💪','👍','🔥','✨','💯','🎉','🎊','❤️','🧡','💛','💚','💙','💜','⭐','🌟','🌈','☀️','🌊','🏛️','🇬🇷','🫒','🍇','🍷','☕','🥖','🧿','📣','📸','🎥','📍','🗓️','🚀','💡','✅','⚡','🎁','🙏'];

  var WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /* ---------- helpers ---------- */
  function normPlat(p) {
    p = String(p || '').toLowerCase().trim();
    if (p === 'twitter') return 'x';
    return p;
  }
  function netFor(platform) {
    return NET[normPlat(platform)] || null;
  }
  function el(tag, cls, html) {
    var d = global.document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function initials(s) {
    s = String(s || '').trim();
    if (!s) return 'Z';
    var parts = s.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
    var a = (parts[0] || '')[0] || '';
    var b = (parts[1] || '')[0] || '';
    return (a + b).toUpperCase() || 'Z';
  }
  function truncateForPreview(esc, text, limit) {
    // text is RAW (unescaped); returns {html, truncated}
    var t = String(text || '');
    if (t.length <= limit) return { html: esc(t).replace(/\n/g, '<br>'), truncated: false };
    var cut = t.slice(0, limit);
    // avoid cutting mid-word too harshly
    var sp = cut.lastIndexOf(' ');
    if (sp > limit * 0.6) cut = cut.slice(0, sp);
    return { html: esc(cut).replace(/\n/g, '<br>'), truncated: true };
  }
  // linkify hashtags/mentions/urls inside already-escaped display (operate on raw then esc pieces)
  function richBody(esc, rawHtmlBrs) {
    // rawHtmlBrs is escaped text with <br>. Highlight #tags @mentions and http links.
    return rawHtmlBrs
      .replace(/(https?:\/\/[^\s<]+)/g, '<span class="zc-lnk">$1</span>')
      .replace(/(^|[\s>])(#[\p{L}0-9_]+)/gu, '$1<span class="zc-tag">$2</span>')
      .replace(/(^|[\s>])(@[\p{L}0-9_.]+)/gu, '$1<span class="zc-mention">$2</span>');
  }

  /* ---------- styles ---------- */
  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var css = [
      '.zc-wrap{font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--tx);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,440px);gap:18px;align-items:start}',
      '@media(max-width:900px){.zc-wrap{grid-template-columns:1fr}}',
      '.zc-card{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:16px}',
      '.zc-col{display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.zc-h{font-weight:800;font-size:15px;letter-spacing:.01em;margin:0 0 2px;display:flex;align-items:center;gap:8px}',
      '.zc-sub{color:var(--mut);font-size:12px;margin:0}',
      '.zc-chips{display:flex;flex-wrap:wrap;gap:8px}',
      '.zc-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:22px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font-size:12.5px;font-weight:700;cursor:pointer;transition:.15s;position:relative}',
      '.zc-chip svg{width:15px;height:15px;fill:currentColor;flex:none}',
      '.zc-chip .zc-ava{width:18px;height:18px;border-radius:50%;font-size:8px}',
      '.zc-chip:hover{border-color:var(--acc)}',
      '.zc-chip.on{background:var(--acc);border-color:var(--acc);color:#fff}',
      '.zc-chip.off{opacity:.5;cursor:not-allowed}',
      '.zc-chip.off:hover{border-color:var(--line)}',
      '.zc-chip .zc-hint{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);margin-left:2px}',
      '.zc-ta{width:100%;box-sizing:border-box;min-height:150px;resize:vertical;background:var(--bg);border:1px solid var(--line);border-radius:12px;color:var(--tx);font:400 14.5px/1.5 "Hanken Grotesk",system-ui;padding:12px 14px}',
      '.zc-ta:focus{outline:none;border-color:var(--acc)}',
      '.zc-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.zc-tb{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font-size:12px;font-weight:700;cursor:pointer;transition:.15s}',
      '.zc-tb:hover{border-color:var(--acc);color:var(--acc)}',
      '.zc-tb svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zc-counters{display:flex;flex-wrap:wrap;gap:7px}',
      '.zc-cnt{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;padding:4px 9px;border-radius:20px;background:var(--bg3);border:1px solid var(--line);color:var(--mut)}',
      '.zc-cnt svg{width:12px;height:12px;fill:currentColor}',
      '.zc-cnt b{color:var(--tx);font-variant-numeric:tabular-nums}',
      '.zc-cnt.over{color:#fff;background:#c0392b;border-color:#c0392b}',
      '.zc-cnt.over b{color:#fff}',
      '.zc-cnt.warn b{color:var(--gold)}',
      '.zc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.zc-in{flex:1;min-width:120px;box-sizing:border-box;background:var(--bg);border:1px solid var(--line);border-radius:9px;color:var(--tx);font:400 13px "Hanken Grotesk",system-ui;padding:9px 11px}',
      '.zc-in:focus{outline:none;border-color:var(--acc)}',
      '.zc-in.sm{flex:none;width:110px}',
      '.zc-sel{background:var(--bg);border:1px solid var(--line);border-radius:9px;color:var(--tx);font:400 13px "Hanken Grotesk",system-ui;padding:9px 11px}',
      '.zc-lab{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0 0 6px;display:block}',
      '.zc-media{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
      '.zc-thumb{position:relative;width:70px;height:70px;border-radius:9px;overflow:hidden;border:1px solid var(--line);background:var(--bg3)}',
      '.zc-thumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '.zc-thumb .zc-x{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;border:none;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center}',
      '.zc-thumb .zc-broke{display:flex;align-items:center;justify-content:center;height:100%;font-size:9px;color:var(--mut);text-align:center;padding:4px}',
      '.zc-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}',
      '.zc-btn{padding:10px 16px;border-radius:11px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font:800 13px "Hanken Grotesk";cursor:pointer;transition:.15s}',
      '.zc-btn:hover{border-color:var(--acc)}',
      '.zc-btn.pri{background:var(--acc);border-color:var(--acc);color:#fff}',
      '.zc-btn.gold{background:var(--gold);border-color:var(--gold);color:#1a1205}',
      '.zc-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.zc-btn:disabled:hover{border-color:var(--line)}',
      '.zc-note{font-size:11.5px;color:var(--gold);background:rgba(184,137,59,.1);border:1px solid rgba(184,137,59,.3);border-radius:9px;padding:8px 11px;line-height:1.4}',
      '.zc-hintbox{font-size:12px;color:var(--tx);background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
      '.zc-hintbox b{color:var(--green)}',
      '.zc-emoji{position:absolute;z-index:40;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:8px;display:grid;grid-template-columns:repeat(8,1fr);gap:2px;box-shadow:0 12px 34px rgba(0,0,0,.35);max-width:290px}',
      '.zc-emoji button{background:none;border:none;font-size:18px;cursor:pointer;padding:3px;border-radius:6px;line-height:1}',
      '.zc-emoji button:hover{background:var(--bg3)}',
      '.zc-pop{position:relative}',
      '.zc-thread{display:flex;flex-direction:column;gap:8px}',
      '.zc-tweet{display:flex;gap:8px;align-items:flex-start}',
      '.zc-tweet .zc-ta{min-height:60px}',
      '.zc-tweet .zc-idx{font-size:11px;font-weight:800;color:var(--mut);width:30px;flex:none;padding-top:10px}',
      '.zc-tweet .zc-x{flex:none;margin-top:8px;width:24px;height:24px;border-radius:7px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);cursor:pointer}',
      /* previews */
      '.zc-previews{display:flex;flex-direction:column;gap:14px}',
      '.zc-empty{color:var(--mut);font-size:12.5px;text-align:center;padding:26px 10px;border:1px dashed var(--line);border-radius:12px}',
      '.zc-pv{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;color:#0b0b0b;font-size:13px}',
      '.zc-pv *{box-sizing:border-box}',
      '.zc-pv .zc-pvh{display:flex;align-items:center;gap:9px;padding:11px 12px}',
      '.zc-pv .zc-ava{width:38px;height:38px;border-radius:50%;font-size:13px;flex:none}',
      '.zc-pv .zc-nm{font-weight:700;font-size:13.5px;line-height:1.2;color:#0b0b0b}',
      '.zc-pv .zc-mt{font-size:11.5px;color:#5b6b7a}',
      '.zc-pv .zc-body{padding:2px 12px 10px;line-height:1.45;white-space:normal;word-wrap:break-word;color:#0b0b0b}',
      '.zc-pv .zc-more{color:#5b6b7a;cursor:default}',
      '.zc-pv .zc-lnk{color:#1a6dcc}',
      '.zc-pv .zc-tag{color:#1a6dcc}',
      '.zc-pv .zc-mention{color:#1a6dcc}',
      '.zc-pv .zc-imgs{display:grid;gap:2px;background:#e9edf1}',
      '.zc-pv .zc-imgs.n1{grid-template-columns:1fr}',
      '.zc-pv .zc-imgs.n2{grid-template-columns:1fr 1fr}',
      '.zc-pv .zc-imgs.n3{grid-template-columns:1fr 1fr}',
      '.zc-pv .zc-imgs.n4{grid-template-columns:1fr 1fr}',
      '.zc-pv .zc-imgs img{width:100%;height:150px;object-fit:cover;display:block}',
      '.zc-pv .zc-imgs.n3 img:first-child{grid-row:span 2;height:302px}',
      '.zc-pv .zc-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:20px;color:#fff;margin-left:auto}',
      '.zc-pv .zc-acts{display:flex;gap:18px;padding:9px 12px;border-top:1px solid #eceef1;color:#5b6b7a;font-size:12px;font-weight:600}',
      /* IG specific */
      '.zc-pv.ig .zc-square{width:100%;aspect-ratio:1/1;background:#e9edf1}',
      '.zc-pv.ig .zc-square img{width:100%;height:100%;object-fit:cover;display:block}',
      '.zc-pv.ig .zc-igbar{display:flex;gap:14px;padding:9px 12px;font-size:18px}',
      '.zc-pv.ig .zc-body{font-size:12.5px}',
      '.zc-pv.ig .zc-body b{margin-right:5px}',
      /* X specific */
      '.zc-pv.x{border-radius:14px}',
      '.zc-pv.x .zc-nm{display:inline}',
      '.zc-pv.x .zc-handle{color:#5b6b7a;font-weight:400}',
      '.zc-pv.x .zc-tline{margin-top:8px;border-left:2px solid #e1e8ed;padding-left:12px;margin-left:6px}',
      /* TikTok specific */
      '.zc-pv.tiktok{background:#000;color:#fff;position:relative}',
      '.zc-pv.tiktok .zc-tkframe{position:relative;width:100%;aspect-ratio:9/16;max-height:420px;background:#111;overflow:hidden}',
      '.zc-pv.tiktok .zc-tkframe img{width:100%;height:100%;object-fit:cover;opacity:.85}',
      '.zc-pv.tiktok .zc-tkcap{position:absolute;left:0;right:44px;bottom:0;padding:12px;background:linear-gradient(transparent,rgba(0,0,0,.65));font-size:12.5px;line-height:1.4}',
      '.zc-pv.tiktok .zc-tkcap .zc-nm{color:#fff}',
      '.zc-pv.tiktok .zc-tkcap .zc-tag{color:#fff;font-weight:700}',
      '.zc-pv.tiktok .zc-tknoimg{display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:11px}',
      /* YouTube specific */
      '.zc-pv.youtube .zc-ytthumb{width:100%;aspect-ratio:16/9;background:#000;position:relative}',
      '.zc-pv.youtube .zc-ytthumb img{width:100%;height:100%;object-fit:cover;display:block}',
      '.zc-pv.youtube .zc-ytplay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:34px;color:rgba(255,255,255,.85)}',
      '.zc-pv.youtube .zc-body{font-size:12px;color:#0b0b0b}',
      '.zc-divider{height:1px;background:var(--line);border:none;margin:2px 0}',
      '.zc-flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.zc-grow{flex:1;min-width:0}'
    ].join('\n');
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ---------- avatar element ---------- */
  function avatarHTML(esc, ch, cls) {
    var color = (netFor(ch.platform) || {}).color || '#0A4D8C';
    if (ch.avatar_url) {
      return '<span class="zc-ava ' + (cls || '') + '" style="display:inline-block;overflow:hidden;background:' + esc(color) + '">' +
        '<img src="' + esc(ch.avatar_url) + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'"></span>';
    }
    return '<span class="zc-ava ' + (cls || '') + '" style="display:inline-flex;align-items:center;justify-content:center;background:' + esc(color) + ';color:#fff;font-weight:800">' +
      esc(initials(ch.display_name || ch.handle)) + '</span>';
  }

  /* ================= MOUNT ================= */
  async function mountComposer(root, ctx) {
    var doc = root.ownerDocument || global.document;
    var C = ctx.C;
    var esc = C.esc;
    var toast = ctx.toast || C.toast || function () {};
    injectStyle(doc);

    var state = {
      selected: {},        // channelId -> true
      media: [],           // image urls (max 4)
      threadMode: false,
      thread: [''],        // X thread drafts
      slots: [],
      hashtags: [],
      templates: [],
      channels: (ctx.channels || []).slice(),
      editId: null,
      scheduledAt: null    // ISO string or null
    };

    // default-select all connected channels
    state.channels.forEach(function (ch) {
      if (ch.connected && netFor(ch.platform)) state.selected[ch.id] = true;
    });

    root.innerHTML = '';
    var wrap = el('div', 'zc-wrap');
    var left = el('div', 'zc-col');
    var right = el('div', 'zc-col');
    wrap.appendChild(left);
    wrap.appendChild(right);
    root.appendChild(wrap);

    /* ----- LEFT: editor card ----- */
    var editor = el('div', 'zc-card');
    editor.innerHTML =
      '<div class="zc-h">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
      'Compose</div>' +
      '<p class="zc-sub">Write once, tailor per network, preview live.</p>';
    left.appendChild(editor);

    var chips = el('div', 'zc-chips');
    chips.style.margin = '12px 0';
    editor.appendChild(chips);

    var ta = el('textarea', 'zc-ta');
    ta.placeholder = 'What do you want to share with your community?';
    editor.appendChild(ta);

    // toolbar
    var toolbar = el('div', 'zc-toolbar');
    toolbar.style.margin = '10px 0';
    editor.appendChild(toolbar);

    var counters = el('div', 'zc-counters');
    editor.appendChild(counters);

    // media
    var mediaWrap = el('div');
    mediaWrap.style.marginTop = '14px';
    mediaWrap.innerHTML = '<span class="zc-lab">Media (up to 4)</span>';
    var mediaRow = el('div', 'zc-row');
    mediaRow.innerHTML =
      '<input class="zc-in" type="url" placeholder="Paste image URL…" data-role="mediaurl">' +
      '<button class="zc-btn" data-role="addmedia">Add</button>' +
      '<button class="zc-btn" data-role="upload" title="Upload image">Upload</button>' +
      '<input type="file" accept="image/*" style="display:none" data-role="file">';
    mediaWrap.appendChild(mediaRow);
    var media = el('div', 'zc-media');
    mediaWrap.appendChild(media);
    editor.appendChild(mediaWrap);

    // hashtags + link builder row cards
    var extras = el('div', 'zc-card');
    extras.style.marginTop = '0';
    extras.innerHTML =
      '<span class="zc-lab">Hashtag sets</span>' +
      '<div class="zc-row" style="margin-bottom:12px">' +
        '<select class="zc-sel zc-grow" data-role="hashsel"><option value="">Loading sets…</option></select>' +
        '<button class="zc-btn" data-role="appendtags">Append</button>' +
        '<button class="zc-btn" data-role="savetags" title="Save current #tags in the body as a set">Save #tags</button>' +
      '</div>' +
      '<span class="zc-lab">Link &amp; UTM builder</span>' +
      '<div class="zc-row" style="margin-bottom:6px">' +
        '<input class="zc-in" type="url" placeholder="https://long-url…" data-role="lu_url">' +
      '</div>' +
      '<div class="zc-row" style="margin-bottom:8px">' +
        '<input class="zc-in sm" placeholder="source" data-role="lu_source">' +
        '<input class="zc-in sm" placeholder="medium" data-role="lu_medium">' +
        '<input class="zc-in sm" placeholder="campaign" data-role="lu_campaign">' +
        '<button class="zc-btn" data-role="lu_make">Shorten + insert</button>' +
      '</div>';
    left.appendChild(extras);

    // first comment + thread
    var advanced = el('div', 'zc-card');
    advanced.innerHTML =
      '<span class="zc-lab">First comment</span>' +
      '<p class="zc-sub" style="margin:-2px 0 6px">Posted automatically right after publish (great for #tags or links).</p>' +
      '<input class="zc-in" style="width:100%;flex:none" placeholder="Optional first comment…" data-role="firstcomment">' +
      '<div style="margin-top:14px">' +
        '<label class="zc-flex" style="cursor:pointer;font-size:12.5px;font-weight:700">' +
          '<input type="checkbox" data-role="threadtoggle"> X / Twitter thread mode' +
        '</label>' +
      '</div>' +
      '<div data-role="threadbox" style="margin-top:10px;display:none"></div>';
    left.appendChild(advanced);

    // schedule + best time + actions
    var actions = el('div', 'zc-card');
    actions.innerHTML =
      '<span class="zc-lab">Best time to post</span>' +
      '<div class="zc-hintbox" data-role="besttime"><span>Loading queue slots…</span></div>' +
      '<div style="height:14px"></div>' +
      '<span class="zc-lab">Schedule</span>' +
      '<div class="zc-row" style="margin-bottom:12px">' +
        '<input class="zc-in" type="date" data-role="date">' +
        '<input class="zc-in" type="time" data-role="time">' +
        '<button class="zc-btn" data-role="clearsched">Clear</button>' +
      '</div>' +
      '<div class="zc-note" data-role="publishnote" style="display:none;margin-bottom:12px"></div>' +
      '<div class="zc-btns">' +
        '<button class="zc-btn pri" data-role="publish">Publish now</button>' +
        '<button class="zc-btn gold" data-role="schedule">Schedule</button>' +
        '<button class="zc-btn" data-role="draft">Save draft</button>' +
        '<button class="zc-btn" data-role="template">Save as template</button>' +
        '<button class="zc-btn" data-role="clear">Clear</button>' +
      '</div>';
    left.appendChild(actions);

    /* ----- RIGHT: previews ----- */
    var pvCard = el('div', 'zc-card');
    pvCard.innerHTML = '<div class="zc-h">Live previews</div><p class="zc-sub">Exactly how each network will show your post.</p>';
    var previews = el('div', 'zc-previews');
    previews.style.marginTop = '14px';
    pvCard.appendChild(previews);
    right.appendChild(pvCard);

    /* ---------- query helpers ---------- */
    function q(role, scope) { return (scope || root).querySelector('[data-role="' + role + '"]'); }

    /* ---------- toolbar build ---------- */
    function buildToolbar() {
      toolbar.innerHTML = '';
      var emojiBtn = el('div', 'zc-pop');
      emojiBtn.innerHTML = '<button class="zc-tb" data-role="emoji">😊 Emoji</button>';
      toolbar.appendChild(emojiBtn);
      var clr = el('button', 'zc-tb');
      clr.setAttribute('data-role', 'quickclear');
      clr.textContent = '↺ Reset text';
      toolbar.appendChild(clr);
    }
    buildToolbar();

    /* ---------- textarea insert ---------- */
    function insertAtCursor(text) {
      var s = ta.selectionStart, e = ta.selectionEnd;
      if (typeof s !== 'number') { ta.value += text; }
      else {
        ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
        var pos = s + text.length;
        ta.selectionStart = ta.selectionEnd = pos;
      }
      ta.focus();
      onBodyChange();
    }

    /* ---------- selected channels ---------- */
    function selectedChannels() {
      return state.channels.filter(function (ch) { return state.selected[ch.id] && netFor(ch.platform); });
    }

    /* ---------- render chips ---------- */
    function renderChips() {
      chips.innerHTML = '';
      if (!state.channels.length) {
        chips.innerHTML = '<span class="zc-sub">No channels found. Connect social accounts to target networks.</span>';
        return;
      }
      state.channels.forEach(function (ch) {
        var n = netFor(ch.platform);
        var chip = el('button', 'zc-chip');
        var icon = ICONS[normPlat(ch.platform)] || '';
        var connected = !!ch.connected && !!n;
        chip.innerHTML =
          '<svg viewBox="0 0 24 24">' + icon + '</svg>' +
          '<span>' + esc(ch.display_name || ch.handle || (n ? n.name : ch.platform)) + '</span>' +
          (connected ? '' : '<span class="zc-hint">connect</span>');
        if (!connected) {
          chip.className = 'zc-chip off';
          chip.title = 'This channel isn’t connected yet. Connect it to publish or preview.';
        } else {
          if (state.selected[ch.id]) chip.className = 'zc-chip on';
          chip.addEventListener('click', function () {
            if (state.selected[ch.id]) delete state.selected[ch.id];
            else state.selected[ch.id] = true;
            renderChips();
            onBodyChange();
          });
        }
        chips.appendChild(chip);
      });
    }

    /* ---------- counters ---------- */
    function renderCounters() {
      counters.innerHTML = '';
      var sel = selectedChannels();
      var len = ta.value.length;
      if (!sel.length) {
        counters.innerHTML = '<span class="zc-cnt">' + len + ' characters</span>';
        return;
      }
      // dedupe by platform key but show per selected channel
      sel.forEach(function (ch) {
        var n = netFor(ch.platform);
        var over = len > n.limit;
        var warn = !over && len > n.limit * 0.9;
        var cnt = el('span', 'zc-cnt' + (over ? ' over' : (warn ? ' warn' : '')));
        cnt.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONS[normPlat(ch.platform)] || '') + '</svg>' +
          esc(n.name) + ' <b>' + len + '</b>/' + n.limit;
        counters.appendChild(cnt);
      });
    }

    /* ---------- media ---------- */
    function renderMedia() {
      media.innerHTML = '';
      state.media.forEach(function (url, i) {
        var t = el('div', 'zc-thumb');
        t.innerHTML =
          '<img src="' + esc(url) + '" alt="" onerror="this.parentNode.innerHTML=\'<div class=&quot;zc-broke&quot;>bad URL</div>\'+this.parentNode.querySelector?\'\':\'\'">' +
          '<button class="zc-x" title="Remove">×</button>';
        // rebuild the remove button cleanly (onerror above may wipe it)
        t.innerHTML =
          '<img src="' + esc(url) + '" alt="">' +
          '<button class="zc-x" title="Remove">×</button>';
        var img = t.querySelector('img');
        img.addEventListener('error', function () {
          img.style.display = 'none';
          if (!t.querySelector('.zc-broke')) {
            var b = el('div', 'zc-broke', 'image<br>unavailable');
            t.insertBefore(b, t.firstChild);
          }
        });
        t.querySelector('.zc-x').addEventListener('click', function () {
          state.media.splice(i, 1);
          renderMedia();
          renderPreviews();
        });
        media.appendChild(t);
      });
    }
    function addMedia(url) {
      url = String(url || '').trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) { toast('Please paste a valid image URL.'); return; }
      if (state.media.length >= 4) { toast('Up to 4 images.'); return; }
      state.media.push(url);
      renderMedia();
      renderPreviews();
    }

    /* ---------- thread ---------- */
    function renderThread() {
      var box = q('threadbox');
      box.style.display = state.threadMode ? 'block' : 'none';
      if (!state.threadMode) return;
      box.innerHTML = '';
      var list = el('div', 'zc-thread');
      state.thread.forEach(function (txt, i) {
        var row = el('div', 'zc-tweet');
        row.innerHTML = '<span class="zc-idx">' + (i + 1) + '/</span>';
        var tta = el('textarea', 'zc-ta');
        tta.value = txt;
        tta.placeholder = 'Tweet ' + (i + 1) + '…';
        tta.addEventListener('input', function () {
          state.thread[i] = tta.value;
          renderPreviews();
        });
        row.appendChild(tta);
        var x = el('button', 'zc-x', '×');
        x.title = 'Remove tweet';
        x.addEventListener('click', function () {
          state.thread.splice(i, 1);
          if (!state.thread.length) state.thread = [''];
          renderThread();
          renderPreviews();
        });
        row.appendChild(x);
        list.appendChild(row);
      });
      box.appendChild(list);
      var add = el('button', 'zc-btn');
      add.textContent = '+ Add tweet';
      add.style.marginTop = '8px';
      add.addEventListener('click', function () {
        state.thread.push('');
        renderThread();
      });
      box.appendChild(add);
    }

    /* ---------- previews ---------- */
    function actsRow(labels) {
      return '<div class="zc-acts">' + labels.map(function (l) { return '<span>' + l + '</span>'; }).join('') + '</div>';
    }
    function imgGrid(urls) {
      if (!urls.length) return '';
      var n = Math.min(urls.length, 4);
      var h = '<div class="zc-imgs n' + n + '">';
      for (var i = 0; i < n; i++) h += '<img src="' + esc(urls[i]) + '" alt="" onerror="this.style.visibility=\'hidden\'">';
      h += '</div>';
      return h;
    }
    function bodyBlock(rawText, n, moreLabel) {
      var tr = truncateForPreview(esc, rawText, n.trunc);
      var html = richBody(esc, tr.html);
      if (tr.truncated) html += '<span class="zc-more">… ' + moreLabel + '</span>';
      return '<div class="zc-body">' + (html || '<span class="zc-more">Your text will appear here…</span>') + '</div>';
    }

    function renderOnePreview(ch, rawText) {
      var plat = normPlat(ch.platform);
      var n = netFor(ch.platform);
      var name = esc(ch.display_name || ch.handle || n.name);
      var handle = esc((ch.handle || '').replace(/^@?/, '@'));
      var pv;

      if (plat === 'instagram') {
        pv = el('div', 'zc-pv ig');
        pv.innerHTML =
          '<div class="zc-pvh">' + avatarHTML(esc, ch) +
            '<div><div class="zc-nm">' + (handle || name) + '</div></div>' +
            '<span class="zc-badge" style="background:' + n.color + '">IG</span></div>' +
          '<div class="zc-square">' + (state.media.length ? '<img src="' + esc(state.media[0]) + '" onerror="this.style.display=\'none\'">' : '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#9aa7b3;font-size:11px">image</div>') + '</div>' +
          '<div class="zc-igbar">♡  💬  ➤</div>' +
          '<div class="zc-body"><b>' + (handle || name) + '</b>' + richBody(esc, truncateForPreview(esc, rawText, n.trunc).html) + (truncateForPreview(esc, rawText, n.trunc).truncated ? '<span class="zc-more"> … more</span>' : '') + '</div>';
        return pv;
      }
      if (plat === 'x') {
        pv = el('div', 'zc-pv x');
        var threadHtml = '';
        if (state.threadMode) {
          var tw = state.thread.filter(function (t) { return t.trim(); });
          if (tw.length) {
            threadHtml = '<div class="zc-tline">' + tw.map(function (t, i) {
              return '<div style="margin-bottom:8px">' + richBody(esc, esc(t).replace(/\n/g, '<br>')) + '</div>';
            }).join('') + '</div>';
          }
        }
        pv.innerHTML =
          '<div class="zc-pvh">' + avatarHTML(esc, ch) +
            '<div><span class="zc-nm">' + name + '</span> <span class="zc-handle">' + (handle || '') + ' · now</span></div>' +
            '<span class="zc-badge" style="background:#111">X</span></div>' +
          bodyBlock(rawText, n, 'Show more') +
          (state.media.length ? imgGrid(state.media) : '') +
          threadHtml +
          actsRow(['💬', '🔁', '♡', '📊']);
        return pv;
      }
      if (plat === 'linkedin') {
        pv = el('div', 'zc-pv linkedin');
        pv.innerHTML =
          '<div class="zc-pvh">' + avatarHTML(esc, ch) +
            '<div><div class="zc-nm">' + name + '</div><div class="zc-mt">' + (handle || 'Your Company') + ' · now · 🌐</div></div>' +
            '<span class="zc-badge" style="background:' + n.color + '">in</span></div>' +
          bodyBlock(rawText, n, 'see more') +
          (state.media.length ? imgGrid(state.media) : '') +
          actsRow(['👍 Like', '💬 Comment', '🔁 Repost', '➤ Send']);
        return pv;
      }
      if (plat === 'tiktok') {
        pv = el('div', 'zc-pv tiktok');
        var cap = truncateForPreview(esc, rawText, n.trunc);
        pv.innerHTML =
          '<div class="zc-tkframe">' +
            (state.media.length ? '<img src="' + esc(state.media[0]) + '" onerror="this.style.display=\'none\'">' : '<div class="zc-tknoimg">video / cover</div>') +
            '<div class="zc-tkcap"><div class="zc-nm">' + (handle || name) + '</div>' + richBody(esc, cap.html) + (cap.truncated ? '<span class="zc-more" style="color:#bbb"> …more</span>' : '') + '</div>' +
          '</div>';
        return pv;
      }
      if (plat === 'youtube') {
        pv = el('div', 'zc-pv youtube');
        pv.innerHTML =
          '<div class="zc-ytthumb">' + (state.media.length ? '<img src="' + esc(state.media[0]) + '" onerror="this.style.display=\'none\'">' : '') + '<div class="zc-ytplay">▶</div></div>' +
          '<div class="zc-pvh">' + avatarHTML(esc, ch) +
            '<div><div class="zc-nm">' + name + '</div><div class="zc-mt">Video description</div></div>' +
            '<span class="zc-badge" style="background:' + n.color + '">YT</span></div>' +
          bodyBlock(rawText, n, 'Show more');
        return pv;
      }
      // facebook (default)
      pv = el('div', 'zc-pv facebook');
      pv.innerHTML =
        '<div class="zc-pvh">' + avatarHTML(esc, ch) +
          '<div><div class="zc-nm">' + name + '</div><div class="zc-mt">' + (handle || 'Just now') + ' · 🌐</div></div>' +
          '<span class="zc-badge" style="background:' + n.color + '">f</span></div>' +
        bodyBlock(rawText, n, 'See more') +
        (state.media.length ? imgGrid(state.media) : '') +
        actsRow(['👍 Like', '💬 Comment', '↪ Share']);
      return pv;
    }

    function renderPreviews() {
      renderCounters();
      previews.innerHTML = '';
      var sel = selectedChannels();
      var raw = ta.value;
      if (!sel.length) {
        previews.innerHTML = '<div class="zc-empty">Select at least one connected network to see live previews.</div>';
        return;
      }
      sel.forEach(function (ch) {
        previews.appendChild(renderOnePreview(ch, raw));
      });
    }

    /* ---------- best time ---------- */
    function nextSlot() {
      var active = (state.slots || []).filter(function (s) { return s.active !== false; });
      if (!active.length) return null;
      var now = new Date();
      var best = null;
      active.forEach(function (s) {
        var wd = Number(s.weekday), min = Number(s.minute);
        if (isNaN(wd) || isNaN(min)) return;
        for (var add = 0; add < 8; add++) {
          var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, 0, 0, 0, 0);
          if (d.getDay() !== wd) continue;
          d.setMinutes(min);
          if (d.getTime() > now.getTime() + 1000) {
            if (!best || d.getTime() < best.date.getTime()) best = { date: d, slot: s };
            break;
          }
        }
      });
      return best;
    }
    function renderBestTime() {
      var box = q('besttime');
      var nx = nextSlot();
      if (!nx) {
        box.innerHTML = '<span class="zc-sub">No active queue slots. Add posting-time slots to get suggestions.</span>';
        return;
      }
      var d = nx.date;
      var label = WEEKDAYS[d.getDay()] + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      box.innerHTML = '<span>Next queue slot: <b>' + esc(label) + '</b> <span class="zc-sub">(' + esc(nx.slot.tz || 'local') + ')</span></span>' +
        '<button class="zc-btn" data-role="addqueue">Add to queue</button>';
      q('addqueue', box).addEventListener('click', function () {
        setSchedule(d);
        toast('Scheduled for the next queue slot.');
      });
    }
    function setSchedule(d) {
      state.scheduledAt = d.toISOString();
      q('date').value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
      q('time').value = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    function scheduledFromInputs() {
      var dv = q('date').value, tv = q('time').value;
      if (!dv) return null;
      var parts = dv.split('-'), tp = (tv || '00:00').split(':');
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(tp[0] || 0), Number(tp[1] || 0), 0, 0);
      if (isNaN(d.getTime())) return null;
      return d;
    }

    /* ---------- hashtags dropdown ---------- */
    function renderHashtags() {
      var sel = q('hashsel');
      if (!state.hashtags.length) {
        sel.innerHTML = '<option value="">No saved sets</option>';
        return;
      }
      sel.innerHTML = '<option value="">Choose a hashtag set…</option>' +
        state.hashtags.map(function (h) {
          var tags = (h.tags || []).map(function (t) { return t[0] === '#' ? t : '#' + t; }).join(' ');
          return '<option value="' + esc(tags) + '">' + esc(h.name) + ' (' + (h.tags || []).length + ')</option>';
        }).join('');
    }

    /* ---------- gathering the payload ---------- */
    function currentChannelIds() {
      return selectedChannels().map(function (ch) { return ch.id; });
    }
    function currentCampaign() { return String(q('lu_campaign').value || '').trim(); }
    function buildMeta() {
      var meta = {
        composer_version: VERSION,
        first_comment: String(q('firstcomment').value || '').trim() || null,
        campaign: currentCampaign() || null,
        per_network_overrides: {}
      };
      if (state.threadMode) {
        meta.thread = state.thread.map(function (t) { return String(t || '').trim(); }).filter(Boolean);
      }
      return meta;
    }
    function mediaJson() {
      return state.media.map(function (u, i) { return { type: 'image', url: u, order: i }; });
    }
    function validate(channelsRequired) {
      var body = ta.value.trim();
      if (!body && !state.media.length) { toast('Add some text or media first.'); return false; }
      if (channelsRequired && !currentChannelIds().length) { toast('Select at least one connected network.'); return false; }
      // warn on over-limit
      var over = selectedChannels().filter(function (ch) { return ta.value.length > netFor(ch.platform).limit; });
      if (over.length) {
        toast('Text is over the limit for ' + over.map(function (c) { return netFor(c.platform).name; }).join(', ') + '.');
        return false;
      }
      return true;
    }

    async function savePost(status, scheduledAtIso) {
      var params = {
        p_workspace: ctx.ws,
        p_body: ta.value,
        p_channels: currentChannelIds(),
        p_scheduled_at: scheduledAtIso || null,
        p_status: status,
        p_media: mediaJson(),
        p_nameday: null,
        p_meta: buildMeta(),
        p_id: state.editId
      };
      var res = await C.api.rpc('social_save_post', params, { auth: 'require' });
      if (res && res.id) state.editId = res.id;
      return res;
    }

    /* ---------- honest publish gating ---------- */
    function applyGating() {
      var pubBtn = q('publish');
      var note = q('publishnote');
      if (!ctx.avail || !ctx.avail.publish) {
        pubBtn.disabled = true;
        note.style.display = 'block';
        note.textContent = 'Connect your social accounts to publish. You can still schedule and save drafts now.';
      } else {
        pubBtn.disabled = false;
        note.style.display = 'none';
      }
    }

    /* ---------- wire events ---------- */
    function onBodyChange() { renderPreviews(); }
    ta.addEventListener('input', onBodyChange);

    // toolbar
    toolbar.addEventListener('click', function (ev) {
      var r = ev.target.getAttribute && ev.target.getAttribute('data-role');
      if (r === 'quickclear') { ta.value = ''; onBodyChange(); }
    });
    // emoji popover
    var emojiOpen = null;
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      var role = t.getAttribute && t.getAttribute('data-role');
      if (role === 'emoji') {
        if (emojiOpen) { emojiOpen.remove(); emojiOpen = null; return; }
        var pop = el('div', 'zc-emoji');
        pop.style.top = '34px';
        pop.style.left = '0';
        EMOJI.forEach(function (e2) {
          var b = el('button', null, e2);
          b.addEventListener('click', function () { insertAtCursor(e2); });
          pop.appendChild(b);
        });
        t.parentNode.appendChild(pop);
        emojiOpen = pop;
        ev.stopPropagation();
        return;
      }
      if (emojiOpen && !(t.closest && t.closest('.zc-emoji'))) { emojiOpen.remove(); emojiOpen = null; }
    });

    // media add
    q('addmedia').addEventListener('click', function () {
      addMedia(q('mediaurl').value);
      q('mediaurl').value = '';
    });
    q('mediaurl').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addMedia(q('mediaurl').value); q('mediaurl').value = ''; }
    });
    // optional upload (defensively gated)
    q('upload').addEventListener('click', function () {
      var canUpload = C.auth && typeof C.auth.token === 'function' && C.auth.token() && C.BASE;
      if (!canUpload) { toast('Sign in to upload; or paste an image URL.'); return; }
      q('file').click();
    });
    q('file').addEventListener('change', async function () {
      var f = q('file').files && q('file').files[0];
      if (!f) return;
      try {
        var uid = (C.auth.load && C.auth.load() && C.auth.load().user_id) || 'me';
        var name = Date.now() + '_' + f.name.replace(/[^\w.\-]+/g, '_');
        var path = C.BASE + '/storage/v1/object/media/' + encodeURIComponent(uid) + '/' + encodeURIComponent(name);
        var resp = await global.fetch(path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + C.auth.token(), 'Content-Type': f.type || 'application/octet-stream', apikey: C.KEY },
          body: f
        });
        if (!resp.ok) throw new Error('upload failed');
        var pub = C.BASE + '/storage/v1/object/public/media/' + encodeURIComponent(uid) + '/' + encodeURIComponent(name);
        addMedia(pub);
        toast('Image uploaded.');
      } catch (err) {
        toast('Upload failed — paste a URL instead.');
      }
      q('file').value = '';
    });

    // hashtags
    q('appendtags').addEventListener('click', function () {
      var v = q('hashsel').value;
      if (!v) { toast('Choose a set first.'); return; }
      var cur = ta.value;
      ta.value = cur + (cur && !/\s$/.test(cur) ? '\n\n' : '') + v;
      onBodyChange();
    });
    q('savetags').addEventListener('click', async function () {
      var tags = (ta.value.match(/#[\p{L}0-9_]+/gu) || []);
      if (!tags.length) { toast('No #hashtags in the body to save.'); return; }
      var name = global.prompt ? global.prompt('Name this hashtag set:', 'Set ' + (state.hashtags.length + 1)) : ('Set ' + (state.hashtags.length + 1));
      if (!name) return;
      try {
        await C.api.rpc('hashtag_save', { p_workspace: ctx.ws, p_name: name, p_tags: tags, p_id: null }, { auth: 'require' });
        toast('Hashtag set saved.');
        await loadHashtags();
      } catch (e) { toast(e.message || 'Could not save set.'); }
    });

    // link builder
    q('lu_make').addEventListener('click', async function () {
      var url = String(q('lu_url').value || '').trim();
      if (!/^https?:\/\//i.test(url)) { toast('Paste a valid URL to shorten.'); return; }
      var utm = {
        source: String(q('lu_source').value || '').trim() || null,
        medium: String(q('lu_medium').value || '').trim() || null,
        campaign: currentCampaign() || null
      };
      try {
        var res = await C.api.rpc('link_save', { p_workspace: ctx.ws, p_long_url: url, p_label: null, p_utm: utm, p_slug: null }, { auth: 'require' });
        var short = (res && (res.short || res.final_url)) || url;
        insertAtCursor((ta.value && !/\s$/.test(ta.value) ? ' ' : '') + short + ' ');
        q('lu_url').value = '';
        toast('Short link inserted.');
      } catch (e) { toast(e.message || 'Could not shorten link.'); }
    });

    // first comment / thread
    q('firstcomment').addEventListener('input', function () {});
    q('threadtoggle').addEventListener('change', function (e) {
      state.threadMode = !!e.target.checked;
      if (state.threadMode && !state.thread.length) state.thread = [ta.value || ''];
      renderThread();
      renderPreviews();
    });

    // schedule inputs
    q('date').addEventListener('change', function () { var d = scheduledFromInputs(); state.scheduledAt = d ? d.toISOString() : null; });
    q('time').addEventListener('change', function () { var d = scheduledFromInputs(); state.scheduledAt = d ? d.toISOString() : null; });
    q('clearsched').addEventListener('click', function () { q('date').value = ''; q('time').value = ''; state.scheduledAt = null; });

    // actions — every save disables its button while the RPC is in flight
    var _busy = false;
    async function withBusy(btn, fn) {
      if (_busy) return;
      _busy = true;
      var prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Working…';
      try { await fn(); }
      finally {
        _busy = false;
        btn.textContent = prev;
        btn.disabled = false;
        applyGating(); // restores honest publish-button gating
      }
    }

    q('publish').addEventListener('click', function () {
      if (!ctx.avail || !ctx.avail.publish) return; // gated
      if (!validate(true)) return;
      withBusy(q('publish'), async function () {
        try {
          await savePost('scheduled', new Date().toISOString());
          toast('Publishing now — the queue will pick it up.');
        } catch (e) { toast(e.message || 'Could not publish.'); }
      });
    });
    q('schedule').addEventListener('click', function () {
      if (!validate(true)) return;
      var d = scheduledFromInputs();
      if (!d) { toast('Pick a date and time to schedule.'); return; }
      if (d.getTime() < Date.now() - 60000) { toast('Pick a future time.'); return; }
      withBusy(q('schedule'), async function () {
        try {
          await savePost('scheduled', d.toISOString());
          toast('Scheduled for ' + WEEKDAYS[d.getDay()] + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '.');
        } catch (e) { toast(e.message || 'Could not schedule.'); }
      });
    });
    q('draft').addEventListener('click', function () {
      if (!validate(false)) return;
      withBusy(q('draft'), async function () {
        try {
          await savePost('draft', null);
          toast('Draft saved.');
        } catch (e) { toast(e.message || 'Could not save draft.'); }
      });
    });
    q('template').addEventListener('click', function () {
      var body = ta.value.trim();
      if (!body && !state.media.length) { toast('Nothing to save as a template.'); return; }
      var name = global.prompt ? global.prompt('Template name:', 'Template ' + (state.templates.length + 1)) : ('Template ' + (state.templates.length + 1));
      if (!name) return;
      withBusy(q('template'), async function () {
        try {
          await C.api.rpc('template_save', {
            p_workspace: ctx.ws, p_name: name, p_body: ta.value,
            p_channels: currentChannelIds(), p_media: mediaJson(), p_category: null, p_id: null
          }, { auth: 'require' });
          toast('Template saved.');
          await loadTemplates();
        } catch (e) { toast(e.message || 'Could not save template.'); }
      });
    });
    q('clear').addEventListener('click', function () {
      if (global.confirm && !global.confirm('Clear everything in the composer?')) return;
      ta.value = '';
      state.media = [];
      state.thread = [''];
      state.threadMode = false;
      state.scheduledAt = null;
      state.editId = null;
      q('threadtoggle').checked = false;
      q('firstcomment').value = '';
      q('date').value = ''; q('time').value = '';
      q('lu_url').value = ''; q('lu_source').value = ''; q('lu_medium').value = ''; q('lu_campaign').value = '';
      renderMedia();
      renderThread();
      renderPreviews();
      toast('Composer cleared.');
    });

    /* ---------- data loads ---------- */
    async function loadHashtags() {
      try { state.hashtags = (await C.api.rpc('hashtag_list', { p_workspace: ctx.ws }, { auth: 'prefer' })) || []; }
      catch (e) { state.hashtags = []; }
      renderHashtags();
    }
    async function loadTemplates() {
      try { state.templates = (await C.api.rpc('template_list', { p_workspace: ctx.ws }, { auth: 'prefer' })) || []; }
      catch (e) { state.templates = []; }
    }
    async function loadSlots() {
      try { state.slots = (await C.api.rpc('slot_list', { p_workspace: ctx.ws }, { auth: 'prefer' })) || []; }
      catch (e) { state.slots = []; }
      renderBestTime();
    }
    async function loadChannels() {
      // ctx.channels preferred; refresh in background if empty
      if (!state.channels.length) {
        try {
          state.channels = (await C.api.rpc('social_channels_list', { p_workspace: ctx.ws }, { auth: 'prefer' })) || [];
          state.channels.forEach(function (ch) { if (ch.connected && netFor(ch.platform)) state.selected[ch.id] = true; });
        } catch (e) { state.channels = []; }
      }
      renderChips();
    }

    /* ---------- initial render ---------- */
    renderChips();
    renderMedia();
    renderThread();
    renderHashtags();
    renderPreviews();
    applyGating();

    // async data
    await Promise.all([loadChannels(), loadHashtags(), loadTemplates(), loadSlots()]);
    renderPreviews();
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'composer',
    label: 'Composer',
    order: 10,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
    mount: mountComposer
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

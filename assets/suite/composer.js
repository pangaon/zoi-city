/*!
 * composer.js — Zoi Suite CROWN-JEWEL module: multi-network Composer
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'composer'.
 * mount(root, ctx) renders the composer into `root`.
 *   ctx = { C:ZoiCore, ws, channels:[], avail:{publish,email,ai,payments,claims}, toast }
 *
 * Features: per-network live counters that count the way a HUMAN counts
 * (grapheme-aware, t.co-aware for X), connected-network chips, faithful live
 * previews (FB/IG/X/LinkedIn/TikTok/YouTube), per-network body overrides,
 * media by URL (+optional upload) with alt-text enforcement, hashtag sets,
 * inline link/UTM builder, first comment, X thread mode, queue-aware
 * next-open-slot scheduling, pre-flight checks (channel collisions, network
 * limits, missing alt text), localStorage draft autosave, templates library,
 * keyboard shortcuts, honest publish gating, emoji picker, clear/reset.
 *
 * THE ORTHODOX LAYER — the part no other scheduler has:
 *   - the liturgical context of whatever day you are scheduling into: feast,
 *     name day, fasting season and how strict the fast is;
 *   - a warning when the post's own words clash with that fast (a bakery
 *     promoting tyropita on Clean Monday is a real, repeated mistake);
 *   - today's name-day celebrants from zoi_namedays_today, with a one-click
 *     "Χρόνια πολλά" greeting draft;
 *   - "opportunities": the next fortnight's feasts and name days, each with a
 *     drafted post you can put straight in the box.
 * All of it comes from assets/suite/_orthocal.js (computed, never typed).
 *
 * p_meta schema written by this module:
 *   { first_comment:string, thread:string[], campaign:string,
 *     per_network_overrides:{ [channelId]: { body:string } },
 *     alt_text:{ [imageUrl]: string },
 *     liturgical:{ date, feasts:string[], namedays:string[], fast:string },
 *     composer_version:'1.1.0' }
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zc-styles';
  var VERSION = '1.1.0';

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
    youtube:   { key:'youtube',   name:'YouTube',   limit:5000,  trunc:157, color:'#FF0000' },
    /* Zoi's own feed. Every external network here reports available:false —
       none has a registered developer app — so this is currently the only
       channel the composer can actually deliver to. It needs no OAuth: the
       person is already signed in to Zoi. */
    zoi:       { key:'zoi',       name:'Zoi Community', limit:5000, trunc:280, color:'#4f9be8', own:true }
  };

  // Small inline SVG icons (24x24 viewBox path fragments) per platform key.
  var ICONS = {
    zoi:       '<path d="M4 5h16v11a3 3 0 0 1-3 3H9l-5 4V5Z"/><path d="M8 10h8M8 13.5h5"/>',
    facebook:  '<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/>',
    instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.26 2.2.43.6.22 1 .48 1.4.9.42.4.68.83.9 1.4.17.44.37 1.06.43 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.26 1.8-.43 2.2-.22.57-.48 1-.9 1.4-.4.42-.83.68-1.4.9-.44.17-1.06.37-2.2.43-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.26-2.2-.43a3.9 3.9 0 0 1-1.4-.9c-.42-.4-.68-.83-.9-1.4-.17-.44-.37-1.06-.43-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.26-1.8.43-2.2.22-.57.48-1 .9-1.4.4-.42.83-.68 1.4-.9.44-.17 1.06-.37 2.2-.43C8.4 2.2 8.8 2.2 12 2.2zm0 3.05A6.75 6.75 0 1 0 18.75 12 6.75 6.75 0 0 0 12 5.25zm0 11.14A4.39 4.39 0 1 1 16.39 12 4.39 4.39 0 0 1 12 16.39zm6.99-11.42a1.58 1.58 0 1 1-1.58-1.58 1.58 1.58 0 0 1 1.58 1.58z"/>',
    x:         '<path d="M17.5 3h3.1l-6.77 7.73L21.75 21H15.6l-4.82-6.3L5.28 21H2.17l7.24-8.27L2.25 3H8.5l4.36 5.77zM16.4 19.1h1.72L7.7 4.8H5.86z"/>',
    linkedin:  '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.8 0 0 .78 0 1.74v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.76V1.74C24 .78 23.2 0 22.22 0z"/>',
    tiktok:    '<path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.4a2.53 2.53 0 1 1-1.8-2.42V9.8a5.63 5.63 0 1 0 4.9 5.58V9.03a7.34 7.34 0 0 0 4.3 1.37V7.3a4.28 4.28 0 0 1-3.15-1.48z"/>',
    youtube:   '<path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.5zM9.6 15.6V8.4l6.2 3.6z"/>'
  };

  var EMOJI = ['😀','😁','😂','🥰','😊','😍','😎','🤩','🥳','😇','🤝','👏','🙌','💪','👍','🔥','✨','💯','🎉','🎊','❤️','🧡','💛','💚','💙','💜','⭐','🌟','🌈','☀️','🌊','🏛️','🇬🇷','🫒','🍇','🍷','☕','🥖','🧿','📣','📸','🎥','📍','🗓️','🚀','💡','✅','⚡','🎁','🙏'];

  var WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var DRAFT_SAVE_MS = 900;      // debounce for the localStorage autosave
  var CONFLICT_WINDOW_MIN = 30; // two posts to one channel inside this = a collision

  /* ---------- shared libraries, without a build step ----------
   * _orthocal.js (the liturgical calendar) and _schedule.js (the scheduling
   * arithmetic) are classic scripts sitting next to this one. The suite shell
   * does not know about them, and this module has no business editing a page it
   * does not own, so it loads its own siblings on first mount and caches the
   * promise. The path is resolved from THIS script's own URL, so it works on any
   * origin — production, a local server, or a test harness. If a library fails
   * to load, the module still renders: every feature that needs one checks for
   * it first and says plainly that it is unavailable.
   */
  var SELF_DIR = (function () {
    try {
      var cs = global.document && global.document.currentScript;
      if (cs && cs.src) return String(cs.src).replace(/[^/]+$/, '');
    } catch (e) { /* no document (unit test) — fall through */ }
    return '/assets/suite/';
  })();
  var LIB_PROMISES = {};
  function loadLib(doc, file, globalName) {
    if (global[globalName]) return Promise.resolve(global[globalName]);
    if (LIB_PROMISES[file]) return LIB_PROMISES[file];
    LIB_PROMISES[file] = new Promise(function (resolve) {
      var id = 'zoi-lib-' + file;
      if (!doc.getElementById(id)) {
        var tag = doc.createElement('script');
        tag.id = id;
        tag.src = SELF_DIR + file + '.js';
        tag.async = false;
        (doc.head || doc.documentElement).appendChild(tag);
      }
      var tries = 0;
      (function poll() {
        if (global[globalName]) return resolve(global[globalName]);
        if (tries++ > 120) return resolve(null);       // ~3s, then degrade
        global.setTimeout(poll, 25);
      })();
    });
    return LIB_PROMISES[file];
  }
  function loadDeps(doc) {
    return Promise.all([
      loadLib(doc, '_orthocal', 'ZoiOrthocal'),
      loadLib(doc, '_schedule', 'ZoiSchedule')
    ]).then(function (r) { return { O: r[0], S: r[1] }; });
  }

  /* Local (not UTC) ISO day key — the composer schedules in the user's own day. */
  function isoLocal(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

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
      '.zc-grow{flex:1;min-width:0}',
      /* ---- draft-restore banner ---- */
      '.zc-banner{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--tx);background:color-mix(in srgb,var(--acc) 10%,transparent);border:1px solid color-mix(in srgb,var(--acc) 40%,transparent);border-radius:12px;padding:10px 13px}',
      '.zc-banner b{color:var(--acc)}',
      /* ---- pre-flight checks ---- */
      '.zc-checks{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}',
      '.zc-check{display:flex;gap:9px;align-items:flex-start;font-size:12px;line-height:1.45;border-radius:10px;padding:9px 12px;border:1px solid var(--line)}',
      '.zc-check .zc-cico{flex:none;width:16px;height:16px;margin-top:1px}',
      '.zc-check .zc-cico svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zc-check b{display:block;font-weight:800}',
      '.zc-check.stop{color:var(--red);background:color-mix(in srgb,var(--red) 12%,transparent);border-color:color-mix(in srgb,var(--red) 42%,transparent)}',
      '.zc-check.warn{color:var(--gold);background:color-mix(in srgb,var(--gold) 12%,transparent);border-color:color-mix(in srgb,var(--gold) 42%,transparent)}',
      '.zc-check.ok{color:var(--green);background:color-mix(in srgb,var(--green) 10%,transparent);border-color:color-mix(in srgb,var(--green) 34%,transparent)}',
      '.zc-check span.zc-ctx{color:var(--tx);font-weight:500}',
      /* ---- liturgical context ---- */
      '.zc-lit{display:flex;flex-direction:column;gap:10px}',
      '.zc-litrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.zc-fast{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:800;padding:5px 11px;border-radius:20px;border:1px solid var(--line);background:var(--bg3);color:var(--mut)}',
      '.zc-fast .zc-fdot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}',
      '.zc-fast.f-none{color:var(--green);border-color:color-mix(in srgb,var(--green) 40%,transparent);background:color-mix(in srgb,var(--green) 10%,transparent)}',
      '.zc-fast.f-dairy{color:var(--acc);border-color:color-mix(in srgb,var(--acc) 40%,transparent);background:color-mix(in srgb,var(--acc) 10%,transparent)}',
      '.zc-fast.f-fast{color:var(--gold);border-color:color-mix(in srgb,var(--gold) 42%,transparent);background:color-mix(in srgb,var(--gold) 10%,transparent)}',
      '.zc-fast.f-strict{color:var(--red);border-color:color-mix(in srgb,var(--red) 46%,transparent);background:color-mix(in srgb,var(--red) 12%,transparent)}',
      '.zc-feast{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 11px;border-radius:20px;background:var(--bg3);border:1px solid var(--line);color:var(--tx)}',
      '.zc-feast.great{color:var(--gold);border-color:color-mix(in srgb,var(--gold) 45%,transparent)}',
      '.zc-litwhy{font-size:11.5px;color:var(--mut);line-height:1.5;margin:0}',
      '.zc-nameday{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12.5px;color:var(--tx)}',
      '.zc-nameday .zc-nm2{font-weight:800;color:var(--gold)}',
      '.zc-src{font-size:10.5px;color:var(--dim);letter-spacing:.02em}',
      /* ---- opportunities ---- */
      '.zc-opps{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto}',
      '.zc-opp{display:flex;gap:11px;align-items:flex-start;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--bg3);transition:border-color .18s var(--ease)}',
      '.zc-opp:hover{border-color:var(--acc)}',
      '.zc-opp .zc-od{flex:none;width:44px;text-align:center}',
      '.zc-opp .zc-od i{display:block;font-style:normal;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}',
      '.zc-opp .zc-od b{display:block;font-size:18px;font-weight:800;line-height:1.1}',
      '.zc-opp.great .zc-od b{color:var(--gold)}',
      '.zc-opp .zc-ob{flex:1;min-width:0}',
      '.zc-opp .zc-ot{font-size:12.5px;font-weight:700;line-height:1.35}',
      '.zc-opp .zc-os{font-size:11px;color:var(--mut);margin-top:2px}',
      '.zc-opp .zc-oa{flex:none;display:flex;flex-direction:column;gap:5px}',
      /* ---- per-network overrides ---- */
      '.zc-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
      '.zc-tab{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg3);color:var(--mut);font-size:12px;font-weight:700;cursor:pointer;transition:.15s}',
      '.zc-tab svg{width:13px;height:13px;fill:currentColor}',
      '.zc-tab:hover{color:var(--tx);border-color:var(--acc)}',
      '.zc-tab.on{color:var(--tx);border-color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,transparent)}',
      '.zc-tab .zc-tdot{width:6px;height:6px;border-radius:50%;background:var(--gold);flex:none}',
      /* ---- alt text ---- */
      '.zc-alt{position:absolute;bottom:2px;left:2px;font-size:8.5px;font-weight:800;letter-spacing:.04em;padding:1px 5px;border-radius:5px;border:none;cursor:pointer;background:rgba(0,0,0,.68);color:#fff}',
      '.zc-alt.set{background:var(--gold);color:#1a1205}',
      '.zc-altrow{display:flex;gap:8px;align-items:center;margin-top:8px}',
      /* ---- modal (templates, shortcuts) ---- */
      '.zc-ov{position:fixed;inset:0;background:rgba(4,6,10,.66);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;z-index:9000;overflow:auto}',
      '.zc-modal{background:var(--bg2);border:1px solid var(--line);border-radius:16px;width:100%;max-width:560px;box-shadow:0 24px 70px rgba(0,0,0,.5)}',
      '.zc-mh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 18px;border-bottom:1px solid var(--line)}',
      '.zc-mh h3{margin:0;font-size:15.5px;font-weight:800}',
      '.zc-mx{width:30px;height:30px;border-radius:9px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center}',
      '.zc-mx:hover{border-color:var(--acc);color:var(--acc)}',
      '.zc-mb{padding:16px 18px;display:flex;flex-direction:column;gap:12px;max-height:66vh;overflow:auto}',
      '.zc-tpl{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:11px;padding:10px 12px;background:var(--bg3);text-align:left;cursor:pointer;color:var(--tx);font:inherit}',
      '.zc-tpl:hover{border-color:var(--acc)}',
      '.zc-tpl .zc-tn{font-weight:800;font-size:13px}',
      '.zc-tpl .zc-tb2{font-size:11.5px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.zc-keys{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;align-items:center;font-size:12.5px}',
      '.zc-kbd{font:700 11px "JetBrains Mono",monospace;background:var(--bg3);border:1px solid var(--line2);border-bottom-width:2px;border-radius:6px;padding:3px 7px;white-space:nowrap;color:var(--tx)}',
      /* focus states: keyboard users must always see where they are */
      '.zc-wrap button:focus-visible,.zc-wrap [tabindex]:focus-visible,.zc-wrap input:focus-visible,.zc-wrap textarea:focus-visible,.zc-wrap select:focus-visible{outline:2px solid var(--acc);outline-offset:2px}',
      '@media(prefers-reduced-motion:reduce){.zc-wrap *{transition:none!important}}'
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
      alts: {},            // image url -> alt text (accessibility, enforced below)
      overrides: {},       // channelId -> tailored body (base body when absent)
      overrideTab: null,   // channelId whose override is open in the editor
      threadMode: false,
      thread: [''],        // X thread drafts
      slots: [],
      hashtags: [],
      templates: [],
      posts: [],           // this workspace's scheduled posts, for collision checks
      channels: (ctx.channels || []).slice(),
      editId: null,
      scheduledAt: null,   // ISO string or null
      // the Orthodox layer
      O: null,             // ZoiOrthocal once loaded (null = unavailable, say so)
      S: null,             // ZoiSchedule once loaded
      nameday: null,       // { names:[], feast:'', source:'service'|'table' }
      oppDays: 14,
      acknowledged: {}     // warning key -> true, so a confirmed warning stays confirmed
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

    /* ----- LEFT: draft-restore banner (filled only if there is a draft) ----- */
    var bannerBox = el('div');
    left.appendChild(bannerBox);

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
    var altBox = el('div');
    mediaWrap.appendChild(altBox);
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

    /* ----- LEFT: per-network tailoring -----
     * One message rarely fits six networks. An override is stored per channel
     * and travels in p_meta.per_network_overrides, which is exactly the shape
     * the publisher already expects. */
    var overrideCard = el('div', 'zc-card');
    overrideCard.innerHTML =
      '<div class="zc-h">Tailor per network</div>' +
      '<p class="zc-sub">Optional. Pick a network to write it a version of its own — everything else keeps the shared text.</p>' +
      '<div class="zc-tabs" data-role="ovtabs" style="margin-top:12px"></div>' +
      '<div data-role="ovbody"></div>';
    left.appendChild(overrideCard);

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
      '<span class="zc-lab">Next open slots in your queue</span>' +
      '<div class="zc-hintbox" data-role="besttime"><span>Loading queue slots…</span></div>' +
      '<div style="height:14px"></div>' +
      '<span class="zc-lab">Schedule <span class="zc-src" data-role="tzlab"></span></span>' +
      '<div class="zc-row" style="margin-bottom:12px">' +
        '<input class="zc-in" type="date" data-role="date" aria-label="Scheduled date">' +
        '<input class="zc-in" type="time" data-role="time" aria-label="Scheduled time">' +
        '<button class="zc-btn" data-role="clearsched">Clear</button>' +
      '</div>' +
      '<div class="zc-checks" data-role="checks" aria-live="polite"></div>' +
      '<div class="zc-note" data-role="publishnote" style="display:none;margin-bottom:12px"></div>' +
      '<div class="zc-btns">' +
        '<button class="zc-btn pri" data-role="publish">Publish now</button>' +
        '<button class="zc-btn gold" data-role="schedule">Schedule</button>' +
        '<button class="zc-btn" data-role="draft">Save draft</button>' +
        '<button class="zc-btn" data-role="templates">Templates…</button>' +
        '<button class="zc-btn" data-role="template">Save as template</button>' +
        '<button class="zc-btn" data-role="clear">Clear</button>' +
        '<button class="zc-btn" data-role="keys" title="Keyboard shortcuts" aria-label="Keyboard shortcuts">⌘ Shortcuts</button>' +
      '</div>';
    left.appendChild(actions);

    /* ----- LEFT: the Orthodox layer ----- */
    var litCard = el('div', 'zc-card');
    litCard.innerHTML =
      '<div class="zc-h">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M7 7h10M9 21h6"/></svg>' +
      'Liturgical context</div>' +
      '<p class="zc-sub" data-role="litsub">The day you are posting into — feast, name day and fast.</p>' +
      '<div class="zc-lit" data-role="lit" style="margin-top:12px"></div>';
    left.insertBefore(litCard, actions);

    /* ----- RIGHT: previews ----- */
    var pvCard = el('div', 'zc-card');
    pvCard.innerHTML = '<div class="zc-h">Live previews</div><p class="zc-sub">Exactly how each network will show your post.</p>';
    var previews = el('div', 'zc-previews');
    previews.style.marginTop = '14px';
    pvCard.appendChild(previews);
    right.appendChild(pvCard);

    /* ----- RIGHT: this fortnight's opportunities ----- */
    var oppCard = el('div', 'zc-card');
    oppCard.innerHTML =
      '<div class="zc-h">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 6.9H22l-6 4.4 2.3 7-6.3-4.6L5.7 20 8 13.3 2 8.9h7.6z"/></svg>' +
      'Opportunities</div>' +
      '<p class="zc-sub">Feasts and name days in the next fortnight, computed — not typed. One click puts a draft in the box.</p>' +
      '<div class="zc-opps" data-role="opps" style="margin-top:12px"></div>';
    right.appendChild(oppCard);

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

    /* ---------- the text a given channel will actually publish ---------- */
    function bodyFor(ch) {
      if (!ch) return ta.value;
      var o = state.overrides[ch.id];
      return (o != null && String(o).length) ? String(o) : ta.value;
    }

    /* ---------- counters ----------
     * Counting is delegated to _schedule.js so the composer, the calendar and
     * the tests all agree: graphemes rather than UTF-16 units (an emoji family
     * is one character, not eleven) and t.co arithmetic for X (a link costs 23
     * whatever its real length). If the library did not load we fall back to a
     * plain code-point count, which is still better than String.length. */
    function countOf(platform, text) {
      if (state.S) return state.S.countFor(platform, text);
      var n = netFor(platform) || {};
      var len = Array.from(String(text == null ? '' : text)).length;
      return {
        name: n.name || normPlat(platform), chars: len, limit: n.limit || null,
        over: n.limit ? len > n.limit : false,
        warn: n.limit ? (len > n.limit * 0.9 && len <= n.limit) : false,
        remaining: n.limit ? n.limit - len : null, urls: 0, urlCost: 0
      };
    }
    function renderCounters() {
      counters.innerHTML = '';
      var sel = selectedChannels();
      if (!sel.length) {
        counters.innerHTML = '<span class="zc-cnt"><b>' + countOf('facebook', ta.value).chars + '</b> characters</span>';
        return;
      }
      sel.forEach(function (ch) {
        var c = countOf(ch.platform, bodyFor(ch));
        var cnt = el('span', 'zc-cnt' + (c.over ? ' over' : (c.warn ? ' warn' : '')));
        var linkNote = (c.urls && c.urlCost)
          ? ' · <span title="X shortens every link to ' + c.urlCost + ' characters">' + c.urls + ' link' + (c.urls > 1 ? 's' : '') + ' @' + c.urlCost + '</span>'
          : '';
        var tailored = state.overrides[ch.id] ? ' · <span title="This network has its own text">tailored</span>' : '';
        cnt.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONS[normPlat(ch.platform)] || '') + '</svg>' +
          esc(c.name) + ' <b>' + c.chars + '</b>' + (c.limit ? '/' + c.limit : '') + linkNote + tailored;
        cnt.setAttribute('title', esc(c.name) + ': ' + c.chars + (c.limit ? ' of ' + c.limit + ' characters' : ' characters'));
        counters.appendChild(cnt);
      });
    }

    /* ---------- media + alt text ----------
     * Alt text is not decoration: without it an image is invisible to a screen
     * reader, and on Instagram and LinkedIn it is also what the platform reads
     * for search. The composer therefore asks for it per image, shows at a
     * glance which images still lack it, and warns (but never silently blocks)
     * before scheduling. */
    var altEditing = null;
    function renderMedia() {
      media.innerHTML = '';
      state.media.forEach(function (url, i) {
        var t = el('div', 'zc-thumb');
        var hasAlt = !!(state.alts[url] && String(state.alts[url]).trim());
        t.innerHTML =
          '<img src="' + esc(url) + '" alt="' + esc(state.alts[url] || '') + '">' +
          '<button class="zc-x" title="Remove image" aria-label="Remove image">×</button>' +
          '<button class="zc-alt' + (hasAlt ? ' set' : '') + '" data-altfor="' + esc(url) + '" ' +
            'title="' + (hasAlt ? 'Alt text: ' + esc(state.alts[url]) : 'No alt text yet — add a description') + '" ' +
            'aria-label="' + (hasAlt ? 'Edit alt text' : 'Add alt text') + '">ALT</button>';
        var img = t.querySelector('img');
        img.addEventListener('error', function () {
          img.style.display = 'none';
          if (!t.querySelector('.zc-broke')) {
            var b = el('div', 'zc-broke', 'image<br>unavailable');
            t.insertBefore(b, t.firstChild);
          }
        });
        t.querySelector('.zc-x').addEventListener('click', function () {
          var gone = state.media.splice(i, 1)[0];
          if (gone) delete state.alts[gone];
          if (altEditing === gone) altEditing = null;
          renderMedia();
          renderPreviews();
        });
        t.querySelector('.zc-alt').addEventListener('click', function () {
          altEditing = (altEditing === url) ? null : url;
          renderAltEditor();
        });
        media.appendChild(t);
      });
      renderAltEditor();
    }
    function renderAltEditor() {
      altBox.innerHTML = '';
      if (!state.media.length) return;
      var missing = state.media.filter(function (u) { return !(state.alts[u] && String(state.alts[u]).trim()); });
      if (altEditing && state.media.indexOf(altEditing) !== -1) {
        var row = el('div', 'zc-altrow');
        var url = altEditing;
        row.innerHTML =
          '<input class="zc-in" data-role="altin" maxlength="420" ' +
            'placeholder="Describe this image for someone who cannot see it…" ' +
            'aria-label="Alt text for image ' + (state.media.indexOf(url) + 1) + '">' +
          '<button class="zc-btn" data-role="altsave">Save</button>';
        var input = row.querySelector('[data-role="altin"]');
        input.value = state.alts[url] || '';
        function commit() {
          var v = String(input.value || '').trim();
          if (v) state.alts[url] = v; else delete state.alts[url];
          altEditing = null;
          renderMedia();
          renderPreviews();
        }
        row.querySelector('[data-role="altsave"]').addEventListener('click', commit);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { altEditing = null; renderAltEditor(); }
        });
        altBox.appendChild(row);
        input.focus();
      } else if (missing.length) {
        var note = el('p', 'zc-sub');
        note.style.marginTop = '8px';
        note.textContent = missing.length + ' of ' + state.media.length +
          ' image' + (state.media.length === 1 ? '' : 's') + ' still needs alt text — tap ALT on the thumbnail.';
        altBox.appendChild(note);
      } else {
        var ok = el('p', 'zc-sub');
        ok.style.marginTop = '8px';
        ok.textContent = 'Every image has alt text.';
        altBox.appendChild(ok);
      }
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
      if (!sel.length) {
        previews.innerHTML = '<div class="zc-empty">Select at least one connected network to see live previews.</div>';
        renderChecks();
        return;
      }
      sel.forEach(function (ch) {
        previews.appendChild(renderOnePreview(ch, bodyFor(ch)));
      });
      renderOverrideTabs();
      renderChecks();
    }

    /* ---------- next OPEN queue slots ----------
     * The original version suggested the next slot on the clock and ignored the
     * posts already sitting in it, so clicking twice put two posts on the same
     * channel at the same minute. _schedule.js now filters out slots that are
     * already occupied, and the three next free ones are offered as buttons —
     * "optimal time" derived from the user's own queue, not from a made-up
     * industry benchmark. */
    function nextOpenSlots(n) {
      if (state.S) return state.S.nextOpenSlotTimes(state.slots, state.posts, new Date(), n || 3);
      // library unavailable: fall back to the plain next occurrences
      var out = [];
      var act = (state.slots || []).filter(function (x) { return x && x.active !== false; });
      if (!act.length) return out;
      var now = new Date();
      for (var d = 0; d <= 21 && out.length < (n || 3); d++) {
        var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
        act.filter(function (x) { return Number(x.weekday) === day.getDay(); })
          .sort(function (a, b) { return Number(a.minute) - Number(b.minute); })
          .forEach(function (x) {
            if (out.length >= (n || 3)) return;
            var mins = Number(x.minute) || 0;
            var when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(mins / 60), mins % 60);
            if (when.getTime() > now.getTime()) out.push({ when: when, slot: x });
          });
      }
      return out;
    }
    function renderBestTime() {
      var box = q('besttime');
      var slots = nextOpenSlots(3);
      if (!(state.slots || []).length) {
        box.innerHTML = '<span class="zc-sub">No posting-time slots yet. Add them in Calendar → Posting queue and they will be offered here.</span>';
        return;
      }
      if (!slots.length) {
        box.innerHTML = '<span class="zc-sub">Every slot in the next few weeks already has a post in it. Nice problem to have.</span>';
        return;
      }
      box.innerHTML = '<span>Next free:</span>';
      var row = el('div', 'zc-row');
      box.appendChild(row);
      slots.forEach(function (sl, i) {
        var d = sl.when;
        var b = el('button', 'zc-btn');
        b.type = 'button';
        b.textContent = WEEKDAYS[d.getDay()] + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
        b.setAttribute('title', 'Schedule for ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
        b.addEventListener('click', function () {
          setSchedule(d);
          toast('Scheduled for ' + WEEKDAYS[d.getDay()] + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '.');
        });
        row.appendChild(b);
        if (i === 0) b.style.borderColor = 'var(--acc)';
      });
    }
    function setSchedule(d) {
      state.scheduledAt = d.toISOString();
      q('date').value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
      q('time').value = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      afterScheduleChange();
    }
    function afterScheduleChange() {
      state.acknowledged = {};   // a new time deserves a fresh look at the warnings
      renderLit();
      renderChecks();
      scheduleAutosave();
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


    /* ================= THE ORTHODOX LAYER =================
     * Everything below is computed from assets/suite/_orthocal.js. Nothing is
     * typed in, nothing is fetched, and nothing is guessed: Pascha is calculated
     * from the Julian Paschalion and every moveable feast hangs off it. If the
     * library fails to load, each panel says so rather than showing an empty box.
     */

    /** The local day this post is going out on (today, if nothing is scheduled). */
    function litDate() {
      var d = scheduledFromInputs();
      return isoLocal(d || new Date());
    }
    function litForScheduled() {
      if (!state.O) return null;
      try { return state.O.dayInfo(litDate()); } catch (e) { return null; }
    }
    function fastClass(level) { return 'zc-fast f-' + (level || 'none'); }

    function renderLit() {
      var box = q('lit');
      if (!box) return;
      if (!state.O) {
        box.innerHTML = '<p class="zc-litwhy">The liturgical calendar could not be loaded, so feast, name-day and fasting context is unavailable for this session. Everything else works.</p>';
        return;
      }
      var info = litForScheduled();
      var sched = scheduledFromInputs();
      var when = sched ? (WEEKDAYS[sched.getDay()] + ' ' + MONTHS_SHORT[sched.getMonth()] + ' ' + sched.getDate()) : 'Today';
      var sub = q('litsub');
      if (sub) sub.textContent = sched ? 'The day you are scheduling into: ' + when + '.' : 'Today. Pick a date below and this follows it.';

      var html = '<div class="zc-litrow">';
      html += '<span class="' + fastClass(info.fast.level) + '"><span class="zc-fdot"></span>' + esc(info.fast.label) + '</span>';
      info.feasts.forEach(function (f) {
        html += '<span class="zc-feast' + (f.great ? ' great' : '') + '">' + (f.great ? '✦ ' : '') + esc(f.name) + '</span>';
      });
      html += '</div>';
      if (info.fast.why) html += '<p class="zc-litwhy">' + esc(info.fast.why) + '</p>';
      if (info.namedays.length) {
        html += '<div class="zc-nameday"><span>Name day' + (info.namedays.length > 1 ? 's' : '') + ':</span>' +
          '<span class="zc-nm2">' + esc(info.namedays.join(' · ')) + '</span>' +
          '<button class="zc-btn" data-role="greet">Draft a greeting</button></div>';
      }
      if (!info.feasts.length && !info.namedays.length) {
        html += '<p class="zc-litwhy">No feast or name day ' +
          (sched ? 'on ' + esc(when) : 'today') + '. An ordinary day is a fine day to post.</p>';
      }

      // Today's celebrants, from the live service where possible.
      if (state.nameday) {
        var nd = state.nameday;
        if (nd.names && nd.names.length) {
          html += '<hr class="zc-divider"><div class="zc-nameday">' +
            '<span>Celebrating today:</span><span class="zc-nm2">' + esc(nd.names.slice(0, 6).join(' · ')) + '</span>' +
            '<button class="zc-btn" data-role="greettoday">Greet them</button></div>' +
            '<p class="zc-src">' + (nd.source === 'service'
              ? 'from zoi.city&rsquo;s name-day service' + (nd.feast ? ' · ' + esc(nd.feast) : '')
              : 'from the built-in feast table — the name-day service did not answer') + '</p>';
        } else if (nd.source === 'service') {
          html += '<hr class="zc-divider"><p class="zc-src">No name days recorded for today by the name-day service.</p>';
        }
      }
      box.innerHTML = html;

      var greet = q('greet', box);
      if (greet) greet.addEventListener('click', function () {
        applyDraftText(state.O.suggestDraft(info, wsName()), sched || null);
        toast('Greeting drafted — edit it to sound like you.');
      });
      var greetToday = q('greettoday', box);
      if (greetToday) greetToday.addEventListener('click', function () {
        var names = state.nameday.names.slice(0, 4);
        var info2 = { namedays: names, feasts: state.O.feastsOn(isoLocal(new Date())), fast: state.O.fastInfo(isoLocal(new Date())) };
        applyDraftText(state.O.suggestDraft(info2, wsName()), null);
        toast('Name-day greeting drafted.');
      });
    }

    function wsName() {
      // The workspace name is the natural sign-off. It is not always in ctx, so
      // fall back to nothing rather than inventing a business name.
      try {
        var n = ctx.wsName || (ctx.workspace && ctx.workspace.name);
        if (n) return String(n);
        var el2 = doc.querySelector('.wsname');
        return el2 ? String(el2.textContent || '').trim() : '';
      } catch (e) { return ''; }
    }

    /** Put a drafted body in the box without destroying work already there. */
    function applyDraftText(text, when) {
      if (!text) return;
      var cur = ta.value.trim();
      if (cur && global.confirm && !global.confirm('Replace what is in the composer with this draft?')) return;
      ta.value = text;
      if (when) setSchedule(when);
      state.acknowledged = {};
      onBodyChange();
      renderLit();
      ta.focus();
    }

    function renderOpps() {
      var box = q('opps');
      if (!box) return;
      if (!state.O) {
        box.innerHTML = '<div class="zc-empty">The liturgical calendar could not be loaded, so opportunities are unavailable for this session.</div>';
        return;
      }
      var ops = state.O.opportunities(isoLocal(new Date()), state.oppDays, { business: wsName() });
      if (!ops.length) {
        box.innerHTML = '<div class="zc-empty">No feasts or name days in the next ' + state.oppDays + ' days. Quiet fortnight — a good time for evergreen posts.</div>';
        return;
      }
      box.innerHTML = '';
      ops.forEach(function (op) {
        var d = op.date.split('-');
        var row = el('div', 'zc-opp' + (op.kind === 'great_feast' ? ' great' : ''));
        var away = op.daysAway === 0 ? 'today' : op.daysAway === 1 ? 'tomorrow' : 'in ' + op.daysAway + 'd';
        row.innerHTML =
          '<div class="zc-od"><i>' + esc(MONTHS_SHORT[Number(d[1]) - 1]) + '</i><b>' + esc(String(Number(d[2]))) + '</b></div>' +
          '<div class="zc-ob">' +
            '<div class="zc-ot">' + (op.kind === 'great_feast' ? '✦ ' : '') + esc(op.headline) + '</div>' +
            '<div class="zc-os">' + esc(away) +
              (op.namedays.length ? ' · name day: ' + esc(op.namedays.slice(0, 3).join(', ')) : '') +
              (op.fast.level !== 'none' ? ' · ' + esc(op.fast.label) : '') +
            '</div>' +
          '</div>' +
          '<div class="zc-oa"><button class="zc-btn" data-role="opdraft">Draft</button></div>';
        row.querySelector('[data-role="opdraft"]').addEventListener('click', function () {
          // 10:00 on the day is a sane default; the user can move it.
          var when = new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), 10, 0, 0, 0);
          applyDraftText(op.draft, when);
        });
        box.appendChild(row);
      });
    }

    /* ================= per-network overrides =================
     * The tab STRIP is cheap and redrawn with the previews. The tab BODY holds a
     * textarea, so it is only redrawn when the open tab changes — rebuilding it
     * on every keystroke stole the caret out from under whoever was typing in it.
     */
    function renderOverrideTabs() {
      var tabs = q('ovtabs'), body = q('ovbody');
      if (!tabs || !body) return;
      var sel = selectedChannels();
      tabs.innerHTML = '';
      if (!sel.length) {
        state.overrideTab = null;
        body.innerHTML = '<p class="zc-sub">Select a network above first.</p>';
        return;
      }
      sel.forEach(function (ch) {
        var b = el('button', 'zc-tab' + (state.overrideTab === ch.id ? ' on' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', state.overrideTab === ch.id ? 'true' : 'false');
        b.innerHTML = '<svg viewBox="0 0 24 24">' + (ICONS[normPlat(ch.platform)] || '') + '</svg>' +
          esc(ch.display_name || ch.handle || (netFor(ch.platform) || {}).name || ch.platform) +
          (state.overrides[ch.id] ? '<span class="zc-tdot" title="Has its own text"></span>' : '');
        b.addEventListener('click', function () {
          state.overrideTab = (state.overrideTab === ch.id) ? null : ch.id;
          renderOverrideTabs();
          renderOverrideBody(true);
        });
        tabs.appendChild(b);
      });
      if (!body.getAttribute('data-open') || body.getAttribute('data-open') !== String(state.overrideTab)) {
        renderOverrideBody(false);
      }
    }
    function renderOverrideBody(focusIt) {
      var body = q('ovbody');
      if (!body) return;
      var sel = selectedChannels();
      body.setAttribute('data-open', String(state.overrideTab));
      if (!sel.length) { body.innerHTML = '<p class="zc-sub">Select a network above first.</p>'; return; }
      if (!state.overrideTab) {
        var n = Object.keys(state.overrides).length;
        body.innerHTML = '<p class="zc-sub">' + (n ? n + ' network' + (n === 1 ? '' : 's') + ' currently tailored.' : 'All networks share the same text.') + '</p>';
        return;
      }
      var ch2 = null;
      sel.forEach(function (c) { if (c.id === state.overrideTab) ch2 = c; });
      if (!ch2) { state.overrideTab = null; body.innerHTML = ''; return; }
      body.innerHTML = '';
      var tta = el('textarea', 'zc-ta');
      tta.style.minHeight = '110px';
      tta.setAttribute('aria-label', 'Text for ' + (ch2.display_name || ch2.platform));
      tta.value = state.overrides[ch2.id] != null ? state.overrides[ch2.id] : ta.value;
      tta.addEventListener('input', function () {
        if (String(tta.value) === ta.value) delete state.overrides[ch2.id];
        else state.overrides[ch2.id] = tta.value;
        renderCounters();
        renderPreviews();
        scheduleAutosave();
      });
      body.appendChild(tta);
      var row = el('div', 'zc-row');
      row.style.marginTop = '8px';
      var reset = el('button', 'zc-btn');
      reset.type = 'button';
      reset.textContent = 'Use the shared text';
      reset.addEventListener('click', function () {
        delete state.overrides[ch2.id];
        renderOverrideTabs();
        renderCounters();
        renderPreviews();
        scheduleAutosave();
      });
      row.appendChild(reset);
      body.appendChild(row);
      if (focusIt) tta.focus();
    }

    /* ================= modal (templates, shortcuts) ================= */
    function openModal(title) {
      var ov = el('div', 'zc-ov');
      var m = el('div', 'zc-modal');
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');
      m.setAttribute('aria-label', title);
      m.innerHTML =
        '<div class="zc-mh"><h3></h3><button class="zc-mx" data-role="close" aria-label="Close">×</button></div>' +
        '<div class="zc-mb" data-role="body"></div>';
      m.querySelector('h3').textContent = title;
      ov.appendChild(m);
      (doc.body || doc.documentElement).appendChild(ov);
      var restoreFocus = doc.activeElement;
      function close() {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        doc.removeEventListener('keydown', onKey, true);
        try { if (restoreFocus && restoreFocus.focus) restoreFocus.focus(); } catch (e) {}
      }
      function focusables() {
        return Array.prototype.slice.call(m.querySelectorAll('button,input,textarea,select,[href]'))
          .filter(function (n) { return !n.disabled; });
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (e.key !== 'Tab') return;
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      doc.addEventListener('keydown', onKey, true);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      m.querySelector('[data-role="close"]').addEventListener('click', close);
      global.setTimeout(function () {
        var f = focusables();
        if (f.length) f[f.length > 1 ? 1 : 0].focus();
      }, 0);
      return { body: m.querySelector('[data-role="body"]'), close: close };
    }

    function openTemplates() {
      var m = openModal('Templates');
      function draw(filter) {
        m.body.innerHTML = '';
        var search = el('input', 'zc-in');
        search.setAttribute('placeholder', 'Search templates…');
        search.setAttribute('aria-label', 'Search templates');
        search.value = filter || '';
        search.addEventListener('input', function () { draw(search.value); });
        m.body.appendChild(search);
        var list = (state.templates || []).filter(function (t) {
          if (!filter) return true;
          var f = String(filter).toLowerCase();
          return String(t.name || '').toLowerCase().indexOf(f) !== -1 ||
            String(t.body || '').toLowerCase().indexOf(f) !== -1;
        });
        if (!(state.templates || []).length) {
          m.body.appendChild(el('div', 'zc-empty', 'No templates saved yet. Write a post and press “Save as template”.'));
          global.setTimeout(function () { search.focus(); }, 0);
          return;
        }
        if (!list.length) {
          m.body.appendChild(el('div', 'zc-empty', 'No template matches “' + esc(filter) + '”.'));
        }
        list.forEach(function (t) {
          var b = el('button', 'zc-tpl');
          b.type = 'button';
          b.innerHTML = '<span class="zc-grow"><span class="zc-tn">' + esc(t.name || 'Untitled') + '</span>' +
            '<span class="zc-tb2">' + esc(String(t.body || '').replace(/\s+/g, ' ').slice(0, 90)) + '</span></span>';
          b.addEventListener('click', function () {
            applyTemplate(t);
            m.close();
          });
          m.body.appendChild(b);
        });
        global.setTimeout(function () { search.focus(); }, 0);
      }
      draw('');
    }
    function applyTemplate(t) {
      var cur = ta.value.trim();
      if (cur && global.confirm && !global.confirm('Replace what is in the composer with this template?')) return;
      ta.value = String(t.body || '');
      if (Array.isArray(t.media)) {
        state.media = t.media.map(function (m2) { return typeof m2 === 'string' ? m2 : (m2 && m2.url); }).filter(Boolean).slice(0, 4);
        state.alts = {};
        (Array.isArray(t.media) ? t.media : []).forEach(function (m2) {
          if (m2 && m2.url && m2.alt) state.alts[m2.url] = m2.alt;
        });
      }
      if (Array.isArray(t.channels) && t.channels.length) {
        var wanted = t.channels.map(String);
        var matched = false;
        state.channels.forEach(function (ch) {
          if (wanted.indexOf(String(ch.id)) !== -1 || wanted.indexOf(normPlat(ch.platform)) !== -1) {
            if (ch.connected) { state.selected[ch.id] = true; matched = true; }
          }
        });
        if (matched) renderChips();
      }
      state.acknowledged = {};
      renderMedia();
      onBodyChange();
      renderLit();
      toast('Template applied.');
    }

    var SHORTCUTS = [
      ['Ctrl / ⌘ + Enter', 'Schedule (or publish, when publishing is available)'],
      ['Ctrl / ⌘ + S', 'Save as draft'],
      ['Alt + 1…9', 'Toggle a network on or off'],
      ['Alt + T', 'Open the templates library'],
      ['Esc', 'Close a popover or dialog'],
      ['?', 'This list']
    ];
    function openShortcuts() {
      var m = openModal('Keyboard shortcuts');
      var grid = el('div', 'zc-keys');
      SHORTCUTS.forEach(function (s2) {
        grid.appendChild(el('span', null, '<span class="zc-kbd">' + esc(s2[0]) + '</span>'));
        grid.appendChild(el('span', null, esc(s2[1])));
      });
      m.body.appendChild(grid);
      m.body.appendChild(el('p', 'zc-sub', 'Shortcuts work while the composer has focus.'));
    }

    /* ================= draft autosave ================= */
    /* The composer is the one place where losing typing really hurts, so it is
     * mirrored to localStorage. It is never restored silently: a body you did not
     * write appearing in the box is worse than losing it. */
    var saveTimer = null;
    function snapshotDraft() {
      return {
        body: ta.value,
        media: state.media.slice(),
        alts: state.alts,
        overrides: state.overrides,
        firstComment: q('firstcomment') ? q('firstcomment').value : '',
        campaign: q('lu_campaign') ? q('lu_campaign').value : '',
        date: q('date') ? q('date').value : '',
        time: q('time') ? q('time').value : '',
        threadMode: state.threadMode,
        thread: state.thread.slice()
      };
    }
    function scheduleAutosave() {
      if (!state.S) return;
      if (saveTimer) global.clearTimeout(saveTimer);
      saveTimer = global.setTimeout(function () {
        var d = snapshotDraft();
        if (state.S.draftIsMeaningful(d)) state.S.saveDraft(ctx.ws, d);
        else state.S.clearDraft(ctx.ws);
      }, DRAFT_SAVE_MS);
    }
    function applyStoredDraft(d) {
      ta.value = String(d.body || '');
      state.media = Array.isArray(d.media) ? d.media.slice(0, 4) : [];
      state.alts = d.alts && typeof d.alts === 'object' ? d.alts : {};
      state.overrides = d.overrides && typeof d.overrides === 'object' ? d.overrides : {};
      if (q('firstcomment')) q('firstcomment').value = d.firstComment || '';
      if (q('lu_campaign')) q('lu_campaign').value = d.campaign || '';
      if (q('date')) q('date').value = d.date || '';
      if (q('time')) q('time').value = d.time || '';
      state.threadMode = !!d.threadMode;
      state.thread = Array.isArray(d.thread) && d.thread.length ? d.thread.slice() : [''];
      if (q('threadtoggle')) q('threadtoggle').checked = state.threadMode;
      var when = scheduledFromInputs();
      state.scheduledAt = when ? when.toISOString() : null;
      renderMedia();
      renderThread();
      renderChips();
      onBodyChange();
      renderLit();
    }
    /* When the Calendar hands over a post to EDIT (rather than a fresh draft),
     * the composer must say so: the same buttons now update a row instead of
     * creating one, and that is not something to leave implicit. */
    function renderEditBanner(post) {
      bannerBox.innerHTML = '';
      if (!state.editId) return;
      var b = el('div', 'zc-banner');
      var when = scheduledFromInputs();
      b.innerHTML = '<span>Editing an existing post' +
        (when ? ' scheduled for <b>' + esc(WEEKDAYS[when.getDay()] + ' ' + MONTHS_SHORT[when.getMonth()] + ' ' + when.getDate() + ' ' + pad2(when.getHours()) + ':' + pad2(when.getMinutes())) + '</b>' : '') +
        '. Saving updates that post rather than creating a new one.</span>';
      var stop = el('button', 'zc-btn');
      stop.type = 'button';
      stop.textContent = 'Make it a new post';
      stop.addEventListener('click', function () {
        state.editId = null;
        bannerBox.innerHTML = '';
        toast('This will now be saved as a new post.');
      });
      b.appendChild(stop);
      bannerBox.appendChild(b);
      if (post && post.status) applyGating();
    }

    /* Apply a whole post (from the Calendar) into the composer. */
    function applyIncomingPost(h) {
      state.editId = h.id || null;
      ta.value = String(h.body || '');
      var media = Array.isArray(h.media) ? h.media : [];
      state.media = media.map(function (m) { return typeof m === 'string' ? m : (m && m.url); }).filter(Boolean).slice(0, 4);
      state.alts = {};
      media.forEach(function (m) { if (m && m.url && m.alt) state.alts[m.url] = m.alt; });
      var meta = h.meta && typeof h.meta === 'object' ? h.meta : {};
      if (meta.alt_text && typeof meta.alt_text === 'object') {
        Object.keys(meta.alt_text).forEach(function (k) { if (!state.alts[k]) state.alts[k] = meta.alt_text[k]; });
      }
      state.overrides = {};
      if (meta.per_network_overrides && typeof meta.per_network_overrides === 'object') {
        Object.keys(meta.per_network_overrides).forEach(function (k) {
          var v = meta.per_network_overrides[k];
          if (v && v.body) state.overrides[k] = String(v.body);
        });
      }
      if (q('firstcomment')) q('firstcomment').value = meta.first_comment || '';
      if (q('lu_campaign')) q('lu_campaign').value = meta.campaign || '';
      // only select the channels this post actually targets, when we can match them
      var want = (Array.isArray(h.channels) ? h.channels : []).map(String);
      if (want.length) {
        var matched = false;
        state.channels.forEach(function (ch) {
          var hit = want.indexOf(String(ch.id)) !== -1 || want.indexOf(normPlat(ch.platform)) !== -1;
          if (hit && ch.connected) { state.selected[ch.id] = true; matched = true; }
          else if (!hit) delete state.selected[ch.id];
        });
        if (!matched) {
          // nothing matched — keep the defaults rather than leaving no target
          state.channels.forEach(function (ch) { if (ch.connected && netFor(ch.platform)) state.selected[ch.id] = true; });
        }
      }
      if (h.scheduledAt) {
        var d = (state.S && state.S.fromLocalInput(h.scheduledAt)) || new Date(h.scheduledAt);
        if (d && !isNaN(d.getTime())) setSchedule(d);
      }
      renderChips();
      renderMedia();
      onBodyChange();
      renderLit();
      renderEditBanner(h);
    }

    function renderRestoreBanner() {
      bannerBox.innerHTML = '';
      if (!state.S) return;
      var saved = state.S.loadDraft(ctx.ws);
      if (!saved || !state.S.draftIsMeaningful(saved.draft)) return;
      if (ta.value.trim()) return;                    // already working on something
      var age = C.relTime ? C.relTime(new Date(saved.at).toISOString()) : '';
      var b = el('div', 'zc-banner');
      b.innerHTML = '<span>You have an unsent draft from <b>' + esc(age || 'earlier') + '</b>: “' +
        esc(String(saved.draft.body || '').replace(/\s+/g, ' ').slice(0, 60)) + '…”</span>';
      var acts = el('div', 'zc-row');
      var restore = el('button', 'zc-btn');
      restore.type = 'button';
      restore.textContent = 'Restore';
      restore.addEventListener('click', function () {
        applyStoredDraft(saved.draft);
        bannerBox.innerHTML = '';
        toast('Draft restored.');
      });
      var discard = el('button', 'zc-btn');
      discard.type = 'button';
      discard.textContent = 'Discard';
      discard.addEventListener('click', function () {
        state.S.clearDraft(ctx.ws);
        bannerBox.innerHTML = '';
      });
      acts.appendChild(restore);
      acts.appendChild(discard);
      b.appendChild(acts);
      bannerBox.appendChild(b);
    }

    /* ================= keyboard shortcuts =================
     * Bound to the composer's own root, not to the document: the suite swaps
     * modules in and out of one page, and a document-level listener from a module
     * that is no longer mounted is a leak that fires on someone else's screen. */
    function wireShortcuts() {
      root.addEventListener('keydown', function (e) {
        var mod = e.metaKey || e.ctrlKey;
        var tag = (e.target && e.target.tagName || '').toLowerCase();
        var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
        if (mod && e.key === 'Enter') {
          e.preventDefault();
          var btn = (ctx.avail && ctx.avail.publish && !scheduledFromInputs()) ? q('publish') : q('schedule');
          if (btn && !btn.disabled) btn.click();
          return;
        }
        if (mod && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          var d = q('draft');
          if (d && !d.disabled) d.click();
          return;
        }
        if (e.altKey && /^[1-9]$/.test(e.key)) {
          var idx = Number(e.key) - 1;
          var conn = state.channels.filter(function (ch) { return ch.connected && netFor(ch.platform); });
          if (conn[idx]) {
            e.preventDefault();
            if (state.selected[conn[idx].id]) delete state.selected[conn[idx].id];
            else state.selected[conn[idx].id] = true;
            renderChips();
            onBodyChange();
            toast((state.selected[conn[idx].id] ? 'Added ' : 'Removed ') + (conn[idx].display_name || conn[idx].platform) + '.');
          }
          return;
        }
        if (e.altKey && (e.key === 't' || e.key === 'T')) { e.preventDefault(); openTemplates(); return; }
        if (!typing && (e.key === '?' || (e.key === '/' && e.shiftKey))) { e.preventDefault(); openShortcuts(); }
      });
    }

    /* ---------- gathering the payload ---------- */
    /* The community channel is synthetic: there is no row in social_channels for
       it because there is nothing to authorise. It is prepended so it reads as
       the primary destination, which today it is. */
    function withCommunity(rows) {
      var out = (rows && rows.slice) ? rows.slice() : [];
      if (out.some(function (c) { return normPlat(c.platform) === 'zoi'; })) return out;
      out.unshift({
        id: 'zoi', platform: 'zoi', connected: true, status: 'ready',
        handle: 'zoi.city/community', display_name: 'Zoi Community', own: true
      });
      return out;
    }

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
      // only channels that are actually selected AND actually overridden
      selectedChannels().forEach(function (ch) {
        var o = state.overrides[ch.id];
        if (o != null && String(o).trim() && String(o) !== ta.value) {
          meta.per_network_overrides[ch.id] = { body: String(o) };
        }
      });
      var alts = {};
      var any = false;
      state.media.forEach(function (u) {
        var a = state.alts[u] && String(state.alts[u]).trim();
        if (a) { alts[u] = a; any = true; }
      });
      if (any) meta.alt_text = alts;
      if (state.threadMode) {
        meta.thread = state.thread.map(function (t) { return String(t || '').trim(); }).filter(Boolean);
      }
      // What day, liturgically, is this post going out on? Stored so the
      // calendar and the analytics coverage report do not have to guess.
      var lit = litForScheduled();
      if (lit) {
        meta.liturgical = {
          date: lit.date,
          feasts: lit.feasts.map(function (f) { return f.name; }),
          namedays: lit.namedays.slice(),
          fast: lit.fast.level
        };
      }
      return meta;
    }
    function mediaJson() {
      return state.media.map(function (u, i) {
        var row = { type: 'image', url: u, order: i };
        var alt = state.alts[u] && String(state.alts[u]).trim();
        if (alt) row.alt = alt;
        return row;
      });
    }
    /* ---------- pre-flight ----------
     * Everything that could be wrong with this post, in one list, rendered above
     * the buttons and re-used as the validator. Three severities:
     *   stop — the platform would reject it; the button refuses.
     *   warn — a human should look; confirm once and it stays confirmed.
     *   ok   — nothing to say.
     * A warning nobody can act on is noise, so each one names the fix. */
    function preflight(opts) {
      opts = opts || {};
      var out = [];
      var sel = selectedChannels();
      var body = ta.value.trim();

      if (!body && !state.media.length) {
        out.push({ sev: 'stop', key: 'empty', title: 'Nothing to post', text: 'Write something, or add an image.' });
      }
      if (opts.channelsRequired && !sel.length) {
        out.push({ sev: 'stop', key: 'nochannel', title: 'No network selected',
          text: 'Pick at least one connected network. Not connected yet? Connect accounts under Connect.' });
      }
      sel.forEach(function (ch) {
        var c = countOf(ch.platform, bodyFor(ch));
        if (c.over) {
          out.push({ sev: 'stop', key: 'over-' + ch.id, title: c.name + ' is over its limit',
            text: c.chars + ' characters where ' + c.limit + ' is the maximum — trim ' + (c.chars - c.limit) +
              ', or give ' + c.name + ' its own shorter version above.' });
        } else if (c.warn) {
          out.push({ sev: 'warn', key: 'near-' + ch.id, title: c.name + ' is close to its limit',
            text: c.remaining + ' characters left of ' + c.limit + '.' });
        }
        if (normPlat(ch.platform) === 'instagram' && !state.media.length) {
          out.push({ sev: 'warn', key: 'ig-nomedia', title: 'Instagram needs an image',
            text: 'Instagram will not accept a text-only post — add a photo or drop Instagram from this one.' });
        }
      });

      // alt text
      var missing = state.media.filter(function (u) { return !(state.alts[u] && String(state.alts[u]).trim()); });
      if (missing.length) {
        out.push({ sev: 'warn', key: 'alt', title: missing.length + ' image' + (missing.length === 1 ? '' : 's') + ' without alt text',
          text: 'Without it the image is invisible to anyone using a screen reader. Tap ALT on the thumbnail.' });
      }

      // channel collisions, from the workspace's real scheduled posts
      var when = scheduledFromInputs();
      if (when && state.S && state.posts.length) {
        var clash = state.S.conflicts(state.posts, when, currentChannelIds(), CONFLICT_WINDOW_MIN, state.editId);
        if (clash.length) {
          var first = state.S.postWhen(clash[0]);
          out.push({ sev: 'warn', key: 'clash-' + when.getTime(), title: 'Another post goes out on the same channel',
            text: clash.length + ' post' + (clash.length === 1 ? '' : 's') + ' within ' + CONFLICT_WINDOW_MIN +
              ' minutes' + (first ? ' (' + pad2(first.getHours()) + ':' + pad2(first.getMinutes()) + ')' : '') +
              '. Two posts minutes apart bury each other — move one.' });
        }
      }

      // the liturgical check: does the copy clash with the fast?
      var lit = litForScheduled();
      if (lit && state.O) {
        var conflict = state.O.fastConflict(ta.value + ' ' + Object.keys(state.overrides).map(function (k) { return state.overrides[k]; }).join(' '), lit.date);
        if (conflict) {
          out.push({
            sev: conflict.level === 'strict' ? 'stop' : 'warn',
            key: 'fast-' + lit.date,
            title: conflict.label + ' — this post mentions ' + conflict.words.slice(0, 3).join(', '),
            text: conflict.why + ' Consider ' + conflict.suggest + '.'
          });
        } else if (lit.fast.level === 'strict') {
          out.push({ sev: 'warn', key: 'strictday-' + lit.date, title: lit.fast.label,
            text: lit.fast.why + ' Nothing in this post clashes — just be sure the tone fits the day.' });
        }
      }
      if (!out.length) {
        out.push({ sev: 'ok', key: 'ok', title: 'Ready', text: 'Nothing to flag.' });
      }
      return out;
    }
    var CHECK_ICON = {
      stop: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
      warn: '<svg viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
      ok: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
    };
    function renderChecks() {
      var box = q('checks');
      if (!box) return;
      box.innerHTML = '';
      // An untouched composer has nothing to warn about. Red boxes on an empty
      // form are how people learn to ignore red boxes.
      if (!ta.value.trim() && !state.media.length) return;
      var list = preflight({ channelsRequired: false });
      list.forEach(function (c) {
        var row = el('div', 'zc-check ' + c.sev);
        row.innerHTML = '<span class="zc-cico">' + (CHECK_ICON[c.sev] || '') + '</span>' +
          '<span><b>' + esc(c.title) + '</b><span class="zc-ctx">' + esc(c.text) + '</span></span>';
        box.appendChild(row);
      });
    }
    /** The validator the buttons use. Stops on 'stop', asks once on 'warn'. */
    function validate(channelsRequired) {
      var list = preflight({ channelsRequired: channelsRequired });
      renderChecks();
      var stops = list.filter(function (c) { return c.sev === 'stop'; });
      if (stops.length) { toast(stops[0].title + ' — ' + stops[0].text); return false; }
      var warns = list.filter(function (c) { return c.sev === 'warn' && !state.acknowledged[c.key]; });
      if (warns.length) {
        var msg = warns.map(function (w) { return '• ' + w.title; }).join('\n');
        var ask = global.confirm
          ? global.confirm(warns.length + (warns.length === 1 ? ' thing' : ' things') + ' to check first:\n\n' + msg + '\n\nPost anyway?')
          : true;
        if (!ask) return false;
        warns.forEach(function (w) { state.acknowledged[w.key] = true; });
      }
      return true;
    }

    async function savePost(status, scheduledAtIso, opts) {
      opts = opts || {};
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

      /* Publishing to Zoi's own feed happens here and now, through feed_post,
         which posts as the signed-in person — that is the only way the feed can
         attribute a post correctly. External networks go through the scheduled
         publisher; a SCHEDULED community post is picked up by
         zoi-feed-publish, which uses the author recorded on the row.
         A failure here must not lose the post: it is already saved above, so the
         worst case is a saved post that did not appear in the feed, and we say
         so rather than claiming success. */
      var wantsCommunity = params.p_channels.indexOf('zoi') !== -1;
      if (wantsCommunity && opts.publishNow) {
        try {
          var fed = await C.api.rpc('feed_post', {
            p_body: ta.value,
            p_listing: null,
            p_nameday: null,
            p_media: mediaJson()
          }, { auth: 'require' });
          res = res || {};
          res.community = (fed && (fed.ok || fed.id)) ? 'posted' : 'rejected';
        } catch (e) {
          res = res || {};
          res.community = 'failed';
          res.communityError = (e && e.message) || 'unknown';
        }
      }
      return res;
    }

    /* ---------- honest publish gating ---------- */
    function applyGating() {
      var pubBtn = q('publish');
      var note = q('publishnote');
      /* The old gate keyed off ctx.avail.publish alone, which is about external
         networks. It disabled Publish even when the one channel that works was
         selected — the flagship tool switched off while its only live destination
         sat there unused. */
      var comm = selectedChannels().some(function (ch) { return normPlat(ch.platform) === 'zoi'; });
      var externals = selectedChannels().filter(function (ch) { return normPlat(ch.platform) !== 'zoi'; });
      if (comm) {
        pubBtn.disabled = false;
        if (externals.length && !(ctx.avail && ctx.avail.publish)) {
          note.style.display = 'block';
          note.textContent = 'Publishing to Zoi Community now. The other networks you picked are not '
            + 'connected yet, so this post will not reach them — connect them under Accounts.';
        } else {
          note.style.display = 'none';
        }
      } else if (!ctx.avail || !ctx.avail.publish) {
        pubBtn.disabled = true;
        note.style.display = 'block';
        note.textContent = 'No connected network selected. Pick Zoi Community to publish now, '
          + 'or connect a social account under Accounts. You can still schedule and save drafts.';
      } else {
        pubBtn.disabled = false;
        note.style.display = 'none';
      }
    }

    /* ---------- wire events ---------- */
    function onBodyChange() {
      renderPreviews();      // also refreshes counters, override tabs and checks
      scheduleAutosave();
    }
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
      // The tagged long URL is the fallback: if link_save is unavailable the
      // user still gets a working, correctly-tagged link instead of an error.
      var tagged = state.S ? state.S.utmUrl(url, utm) : url;
      try {
        var res = await C.api.rpc('link_save', { p_workspace: ctx.ws, p_long_url: url, p_label: null, p_utm: utm, p_slug: null }, { auth: 'require' });
        var short = (res && (res.short || res.final_url)) || tagged;
        insertAtCursor((ta.value && !/\s$/.test(ta.value) ? ' ' : '') + short + ' ');
        q('lu_url').value = '';
        toast('Short link inserted.');
      } catch (e) {
        insertAtCursor((ta.value && !/\s$/.test(ta.value) ? ' ' : '') + tagged + ' ');
        q('lu_url').value = '';
        toast('Shortener unavailable — inserted the tagged full link instead.');
      }
    });

    // thread
    q('threadtoggle').addEventListener('change', function (e) {
      state.threadMode = !!e.target.checked;
      if (state.threadMode && !state.thread.length) state.thread = [ta.value || ''];
      renderThread();
      renderPreviews();
    });

    // schedule inputs — every change re-reads the liturgical day and re-checks
    q('date').addEventListener('change', function () { var d = scheduledFromInputs(); state.scheduledAt = d ? d.toISOString() : null; afterScheduleChange(); });
    q('time').addEventListener('change', function () { var d = scheduledFromInputs(); state.scheduledAt = d ? d.toISOString() : null; afterScheduleChange(); });
    q('clearsched').addEventListener('click', function () {
      q('date').value = ''; q('time').value = ''; state.scheduledAt = null;
      afterScheduleChange();
    });
    q('templates').addEventListener('click', openTemplates);
    q('keys').addEventListener('click', openShortcuts);
    q('firstcomment').addEventListener('input', scheduleAutosave);

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
      /* This used to return early on ctx.avail.publish, which is about EXTERNAL
         networks. Combined with a button that applyGating() had enabled for the
         community channel, the result was a live-looking button that did nothing
         at all when clicked — the same failure the Connect buttons had. */
      var wantsCommunity = selectedChannels().some(function (ch) { return normPlat(ch.platform) === 'zoi'; });
      if (!wantsCommunity && (!ctx.avail || !ctx.avail.publish)) return;
      if (!validate(true)) return;
      withBusy(q('publish'), async function () {
        try {
          /* Posting to Zoi's own feed happens now, in this request, as the
             signed-in person. External networks still go through the queue, so a
             mixed post is saved as scheduled for them and delivered immediately
             to the feed. publishNow is explicit rather than inferred from the
             status, because the status has to stay 'scheduled' for the external
             publisher to pick the row up. */
          var res = await savePost('scheduled', new Date().toISOString(), { publishNow: true });
          if (res && res.community === 'posted') {
            toast(wantsCommunity && selectedChannels().length > 1
              ? 'Posted to Zoi Community. The other networks are queued.'
              : 'Posted to Zoi Community.');
          } else if (res && res.community === 'failed') {
            toast('Saved, but it did not reach the feed: ' + (res.communityError || 'unknown error'));
          } else {
            toast('Publishing now — the queue will pick it up.');
          }
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
      state.alts = {};
      state.overrides = {};
      state.overrideTab = null;
      state.acknowledged = {};
      state.thread = [''];
      state.threadMode = false;
      state.scheduledAt = null;
      state.editId = null;
      if (state.S) state.S.clearDraft(ctx.ws);
      bannerBox.innerHTML = '';   // and with it the "editing an existing post" notice
      q('threadtoggle').checked = false;
      q('firstcomment').value = '';
      q('date').value = ''; q('time').value = '';
      q('lu_url').value = ''; q('lu_source').value = ''; q('lu_medium').value = ''; q('lu_campaign').value = '';
      renderMedia();
      renderThread();
      renderPreviews();
      renderLit();
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
    /* The workspace's own scheduled posts, so "next free slot" and the collision
     * check are about reality rather than about an empty calendar. */
    async function loadPosts() {
      try {
        var rows = await C.api.rpc('social_list_posts', {
          p_workspace: ctx.ws,
          p_from: new Date(Date.now() - 7 * 86400000).toISOString(),
          p_to: new Date(Date.now() + 90 * 86400000).toISOString()
        }, { auth: 'prefer' });
        state.posts = Array.isArray(rows) ? rows : [];
      } catch (e) { state.posts = []; }
      renderBestTime();
      renderChecks();
    }
    /* Today's celebrants. zoi_namedays_today is the live service; the local
     * feast table is the fallback, and the UI says which one it is looking at.
     * We never merge them silently. */
    async function loadNamedays() {
      var names = [], feast = '', source = 'table';
      try {
        var r = await C.api.rpc('zoi_namedays_today', {}, { auth: 'prefer' });
        var row = Array.isArray(r) ? r[0] : r;
        var n = (row && (row.names || row.namedays)) || [];
        if (typeof n === 'string') n = n.split(/[,·]/).map(function (x) { return x.trim(); }).filter(Boolean);
        if (Array.isArray(n) && n.length) { names = n; source = 'service'; feast = (row && row.feast) || ''; }
      } catch (e) { /* service unavailable — fall back below */ }
      if (!names.length && state.O) names = state.O.nameDaysOn(isoLocal(new Date()));
      state.nameday = { names: names, feast: feast, source: source };
      renderLit();
    }
    async function loadChannels() {
      // ctx.channels preferred; refresh in background if empty
      if (!state.channels.length) {
        try {
          var rows = (await C.api.rpc('social_channels_list', { p_workspace: ctx.ws }, { auth: 'prefer' })) || [];
          state.channels = withCommunity(rows);
        } catch (e) {
          // Even with no network at all, the community feed is still a valid
          // destination — the composer should never present zero channels.
          state.channels = withCommunity([]);
        }
        state.channels.forEach(function (ch) {
          if (ch.connected && netFor(ch.platform)) state.selected[ch.id] = true;
        });
      } else {
        state.channels = withCommunity(state.channels);
        if (!Object.keys(state.selected).length) {
          state.channels.forEach(function (ch) {
            if (ch.connected && netFor(ch.platform)) state.selected[ch.id] = true;
          });
        }
      }
      renderChips();
      applyGating();
    }

    /* ---------- initial render ---------- */
    state.channels = withCommunity(state.channels);
    state.channels.forEach(function (ch) {
      if (ch.connected && netFor(ch.platform) && state.selected[ch.id] === undefined) {
        state.selected[ch.id] = normPlat(ch.platform) === 'zoi';
      }
    });
    wireShortcuts();
    renderChips();
    renderMedia();
    renderThread();
    renderHashtags();
    renderPreviews();
    applyGating();
    q('lit').innerHTML = '<p class="zc-litwhy">Reading the liturgical calendar…</p>';
    q('opps').innerHTML = '<div class="zc-empty">Looking at the next fortnight…</div>';

    /* Libraries first: the counters, the pre-flight checks and the whole
     * Orthodox layer depend on them, and they are two small local files. */
    var libs = await loadDeps(doc);
    state.O = libs.O;
    state.S = libs.S;
    if (state.S) {
      q('tzlab').textContent = '· ' + state.S.tzName() + ' (' + state.S.tzOffsetLabel(new Date()) + ')';
    }
    renderCounters();
    renderLit();
    renderOpps();

    /* A draft handed over from the Calendar ("draft this feast") beats an old
     * autosaved one — the user just asked for it. */
    var handoff = state.S ? state.S.takeHandoff() : null;
    if (handoff && handoff.id) {
      applyIncomingPost(handoff);
      toast('Editing the post you picked in the calendar.');
    } else if (handoff && (handoff.body || handoff.scheduledAt)) {
      if (handoff.body) ta.value = String(handoff.body);
      if (handoff.scheduledAt) {
        var hd = state.S.fromLocalInput(handoff.scheduledAt) || new Date(handoff.scheduledAt);
        if (hd && !isNaN(hd.getTime())) setSchedule(hd);
      }
      onBodyChange();
      renderLit();
      toast('Draft brought over from the calendar.');
    } else {
      renderRestoreBanner();
    }

    // async data
    await Promise.all([loadChannels(), loadHashtags(), loadTemplates(), loadSlots(), loadPosts(), loadNamedays()]);
    renderPreviews();
    renderBestTime();
    renderLit();
    renderChecks();
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

/*!
 * bio.js — Zoi Suite module: Link-in-bio Builder
 * Classic script (NO ES modules). Self-contained IIFE. Zero JS dependencies.
 * The only external asset is a QR-code <img> (api.qrserver.com) rendered after
 * a successful save — it is a plain image tag, never a script dependency, and
 * the builder renders fully without any network.
 *
 * Registers into window.ZoiSuite.modules.
 *   mountBio(root, ctx); ctx = { C, ws, channels:[], avail, toast }
 *   ctx.C provides: esc, relTime, toast, api.rpc(fn, params, {auth}) -> Promise
 *
 * LIVE RPCs consumed:
 *   bio_status(p_workspace) -> {slug,title,tagline,theme,links,photo_url,
 *                               published,views,updated_at} | null   (read)
 *   bio_save(p_workspace,p_slug,p_title,p_tagline,p_theme,p_links,p_photo,
 *            p_published) -> {ok,slug,url}                            (write, auth:'require')
 *
 * The live phone preview mirrors the public /b/<slug> page look: a centered
 * avatar (photo or initial), title, tagline, and big rounded link buttons,
 * themed to the selected theme (dark / gold / light).
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zb-styles';
  var VERSION = '1.0.0';
  var BASE_URL = 'zoi.city/b/';
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

  /* ---------- tiny helpers ---------- */
  function el(doc, tag, cls, html) {
    var d = doc.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function fallbackEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function isHttpUrl(u) {
    return /^https?:\/\/\S+/i.test(String(u == null ? '' : u).trim());
  }
  function slugify(s) {
    return String(s == null ? '' : s).toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }
  function initialOf(title, slug) {
    var src = (title && title.trim()) || (slug && slug.trim()) || '';
    var ch = src.replace(/[^A-Za-z0-9]/g, '').charAt(0);
    return (ch || 'Z').toUpperCase();
  }
  function clampLen(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) : s;
  }
  function copyText(doc, text) {
    // Best-effort clipboard copy without dependencies.
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0';
      (doc.body || doc.documentElement).appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e2) { ok = false; }
      ta.parentNode && ta.parentNode.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ---------- channel -> prefilled link mapping ---------- */
  var CHAN_META = {
    instagram: { name: 'Instagram', url: function (h) { return 'https://instagram.com/' + h; } },
    x:         { name: 'X',         url: function (h) { return 'https://x.com/' + h; } },
    twitter:   { name: 'X',         url: function (h) { return 'https://x.com/' + h; } },
    facebook:  { name: 'Facebook',  url: function (h) { return 'https://facebook.com/' + h; } },
    tiktok:    { name: 'TikTok',    url: function (h) { return 'https://tiktok.com/@' + h; } },
    linkedin:  { name: 'LinkedIn',  url: function (h) { return 'https://linkedin.com/in/' + h; } },
    youtube:   { name: 'YouTube',   url: function (h) { return 'https://youtube.com/@' + h; } }
  };
  function cleanHandle(h) {
    return String(h == null ? '' : h).trim().replace(/^@+/, '').replace(/\s+/g, '');
  }
  // Build a {label,url} block from a channel record, or null if unusable.
  function channelToLink(ch) {
    if (!ch) return null;
    var plat = String(ch.platform || ch.network || '').toLowerCase().trim();
    if (plat === 'twitter') plat = 'x';
    var meta = CHAN_META[plat];
    if (!meta) return null;
    var handle = cleanHandle(ch.handle || ch.username || ch.display_name || '');
    if (!handle) return null;
    var label = ch.display_name && String(ch.display_name).trim()
      ? String(ch.display_name).trim()
      : meta.name;
    return { label: clampLen(label, 60), url: meta.url(encodeURIComponent(handle).replace(/%40/g, '@')), platform: plat };
  }

  /* ---------- theme palettes (mirror the public /b/ page) ---------- */
  // Each palette themes the phone preview + the real published page identically.
  var THEMES = {
    dark: {
      label: 'Dark',
      bg: 'linear-gradient(180deg,#0b0f17 0%,#121826 100%)',
      page: '#0b0f17',
      text: '#f2f5fb',
      sub: '#9aa6bd',
      btnBg: '#1b2333',
      btnText: '#f2f5fb',
      btnBorder: 'rgba(255,255,255,.12)',
      avatarBg: '#232c3f',
      avatarText: '#f2f5fb',
      swatch: 'linear-gradient(135deg,#0b0f17,#232c3f)'
    },
    gold: {
      label: 'Gold',
      bg: 'linear-gradient(180deg,#1a1305 0%,#2a1e08 100%)',
      page: '#1a1305',
      text: '#f7ecd6',
      sub: '#cbb489',
      btnBg: 'linear-gradient(135deg,#b8893b,#8a6526)',
      btnText: '#1a1305',
      btnBorder: 'rgba(247,236,214,.22)',
      avatarBg: 'linear-gradient(135deg,#e0c07a,#b8893b)',
      avatarText: '#1a1305',
      swatch: 'linear-gradient(135deg,#e0c07a,#8a6526)'
    },
    light: {
      label: 'Light',
      bg: 'linear-gradient(180deg,#ffffff 0%,#eef1f7 100%)',
      page: '#ffffff',
      text: '#141a26',
      sub: '#5e6982',
      btnBg: '#ffffff',
      btnText: '#141a26',
      btnBorder: 'rgba(20,26,38,.16)',
      avatarBg: '#141a26',
      avatarText: '#ffffff',
      swatch: 'linear-gradient(135deg,#ffffff,#c9d2e2)'
    }
  };
  function themeKey(k) { return THEMES[k] ? k : 'dark'; }

  /* ---------- styles ---------- */
  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var css = [
      '.zb-wrap{font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--tx);display:flex;flex-direction:column;gap:16px}',
      '.zb-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}',
      '.zb-title{font-weight:800;font-size:17px;margin:0;display:flex;align-items:center;gap:9px}',
      '.zb-title small{font-weight:600;font-size:11.5px;color:var(--mut)}',
      '.zb-title svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zb-hstat{display:flex;gap:14px;align-items:center;flex-wrap:wrap}',
      '.zb-chip{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--mut);background:var(--bg3);border:1px solid var(--line);border-radius:20px;padding:6px 12px}',
      '.zb-chip b{color:var(--tx);font-weight:800}',
      '.zb-chip.zb-live{color:var(--green);border-color:rgba(46,139,87,.4)}',
      '.zb-chip.zb-draft{color:var(--gold);border-color:rgba(184,137,59,.4)}',
      /* layout */
      '.zb-cols{display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start}',
      '@media(max-width:900px){.zb-cols{grid-template-columns:1fr}}',
      '.zb-editor{display:flex;flex-direction:column;gap:16px;min-width:0}',
      '.zb-card{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:16px;min-width:0}',
      '.zb-card h3{margin:0 0 3px;font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}',
      '.zb-card .zb-sub{color:var(--mut);font-size:11.5px;margin:0 0 13px}',
      /* fields */
      '.zb-field{display:flex;flex-direction:column;gap:5px;margin-bottom:13px}',
      '.zb-field:last-child{margin-bottom:0}',
      '.zb-lab{font-size:12px;font-weight:700;color:var(--mut);display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.zb-lab .zb-count{font-weight:600;color:var(--dim);font-size:11px}',
      '.zb-input,.zb-ta{width:100%;background:var(--bg3);border:1px solid var(--line);border-radius:10px;color:var(--tx);font:500 13.5px "Hanken Grotesk",system-ui;padding:10px 12px;transition:.15s}',
      '.zb-input:focus,.zb-ta:focus{outline:none;border-color:var(--acc)}',
      '.zb-ta{resize:vertical;min-height:58px;line-height:1.45}',
      '.zb-input.zb-bad{border-color:#d6708a}',
      '.zb-slugrow{display:flex;align-items:stretch;gap:0}',
      '.zb-slugpre{display:inline-flex;align-items:center;padding:0 10px;background:var(--bg3);border:1px solid var(--line);border-right:none;border-radius:10px 0 0 10px;color:var(--dim);font-size:12.5px;font-weight:600;white-space:nowrap}',
      '.zb-slugrow .zb-input{border-radius:0 10px 10px 0}',
      '.zb-hint{font-size:11.5px;margin:2px 0 0}',
      '.zb-hint.zb-ok{color:var(--green)}',
      '.zb-hint.zb-err{color:#d6708a}',
      '.zb-hint.zb-mut{color:var(--dim)}',
      '.zb-hint a{color:var(--acc);text-decoration:none;font-weight:700}',
      /* theme swatches */
      '.zb-themes{display:flex;gap:10px;flex-wrap:wrap}',
      '.zb-sw{cursor:pointer;border:2px solid var(--line);border-radius:12px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--bg3);transition:.15s;min-width:74px}',
      '.zb-sw:hover{border-color:var(--mut)}',
      '.zb-sw.on{border-color:var(--acc)}',
      '.zb-sw .zb-swdot{width:100%;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.14)}',
      '.zb-sw .zb-swlab{font-size:11.5px;font-weight:700;color:var(--mut)}',
      '.zb-sw.on .zb-swlab{color:var(--tx)}',
      /* links editor */
      '.zb-links{display:flex;flex-direction:column;gap:10px}',
      '.zb-link{background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;transition:.15s}',
      '.zb-link.zb-dragging{opacity:.45;border-style:dashed}',
      '.zb-link.zb-over{border-color:var(--acc)}',
      '.zb-grip{cursor:grab;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--dim);user-select:none;touch-action:none}',
      '.zb-grip:active{cursor:grabbing}',
      '.zb-grip svg{width:16px;height:16px;fill:currentColor}',
      '.zb-link-body{display:flex;flex-direction:column;gap:7px;min-width:0}',
      '.zb-link-body .zb-input{padding:8px 10px;font-size:12.5px}',
      '.zb-link-acts{display:flex;flex-direction:column;gap:5px}',
      '.zb-mini{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--line);background:var(--bg2);color:var(--mut);cursor:pointer;transition:.15s;padding:0}',
      '.zb-mini:hover{color:var(--tx);border-color:var(--acc)}',
      '.zb-mini[disabled]{opacity:.35;cursor:not-allowed}',
      '.zb-mini svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2}',
      '.zb-mini.zb-del:hover{color:#d6708a;border-color:#d6708a}',
      '.zb-empty-links{text-align:center;color:var(--mut);font-size:12.5px;padding:20px 12px;border:1px dashed var(--line);border-radius:12px}',
      /* buttons */
      '.zb-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font:700 12.5px "Hanken Grotesk",system-ui;cursor:pointer;transition:.15s}',
      '.zb-btn:hover{border-color:var(--acc);color:var(--acc)}',
      '.zb-btn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zb-btn[disabled]{opacity:.5;cursor:not-allowed}',
      '.zb-btn.zb-primary{background:var(--acc);border-color:var(--acc);color:#fff}',
      '.zb-btn.zb-primary:hover{filter:brightness(1.08);color:#fff}',
      '.zb-btn.zb-primary[disabled]{filter:none}',
      '.zb-addrow{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '.zb-quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
      '.zb-qbtn{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--mut);background:var(--bg3);border:1px dashed var(--line);border-radius:20px;padding:6px 11px;cursor:pointer;transition:.15s}',
      '.zb-qbtn:hover{color:var(--acc);border-color:var(--acc);border-style:solid}',
      '.zb-qbtn[disabled]{opacity:.5;cursor:not-allowed}',
      /* publish toggle */
      '.zb-pubrow{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.zb-pubtxt{display:flex;flex-direction:column;gap:2px}',
      '.zb-pubtxt b{font-size:13.5px}',
      '.zb-pubtxt span{font-size:11.5px;color:var(--mut)}',
      '.zb-switch{position:relative;width:48px;height:27px;flex:none;border-radius:20px;background:var(--bg3);border:1px solid var(--line);cursor:pointer;transition:.2s}',
      '.zb-switch.on{background:var(--green);border-color:var(--green)}',
      '.zb-switch .zb-knob{position:absolute;top:2px;left:2px;width:21px;height:21px;border-radius:50%;background:#fff;transition:.2s}',
      '.zb-switch.on .zb-knob{left:23px}',
      /* save bar */
      '.zb-savebar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.zb-spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;display:inline-block;animation:zb-rot .7s linear infinite}',
      '@keyframes zb-rot{to{transform:rotate(360deg)}}',
      /* result / QR */
      '.zb-result{background:linear-gradient(135deg,rgba(46,139,87,.12),rgba(59,130,246,.07));border:1px solid rgba(46,139,87,.35);border-radius:16px;padding:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}',
      '.zb-result .zb-qr{width:120px;height:120px;border-radius:12px;background:#fff;padding:6px;flex:none}',
      '.zb-result .zb-qr img{width:100%;height:100%;display:block}',
      '.zb-result-body{flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px}',
      '.zb-result-body h4{margin:0;font-size:14px;font-weight:800;color:var(--green)}',
      '.zb-urlrow{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap}',
      '.zb-urlbox{flex:1;min-width:180px;background:var(--bg3);border:1px solid var(--line);border-radius:9px;padding:8px 11px;font:600 12.5px "Hanken Grotesk",monospace;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      /* phone preview */
      '.zb-preview{position:sticky;top:12px;display:flex;flex-direction:column;align-items:center;gap:10px}',
      '.zb-plabel{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)}',
      '.zb-phone{width:300px;max-width:100%;height:600px;border-radius:38px;background:#000;padding:11px;box-shadow:0 18px 50px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06);position:relative}',
      '.zb-notch{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:120px;height:22px;background:#000;border-radius:0 0 16px 16px;z-index:3}',
      '.zb-screen{width:100%;height:100%;border-radius:28px;overflow:hidden;position:relative}',
      '.zb-pg{width:100%;height:100%;overflow-y:auto;padding:44px 20px 30px;display:flex;flex-direction:column;align-items:center;gap:0;text-align:center}',
      '.zb-pg::-webkit-scrollbar{width:0}',
      '.zb-pav{width:82px;height:82px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:34px;flex:none;background-size:cover;background-position:center;box-shadow:0 4px 16px rgba(0,0,0,.25)}',
      '.zb-ptitle{font-weight:800;font-size:19px;margin:16px 0 0;line-height:1.2;word-break:break-word;max-width:100%}',
      '.zb-ptag{font-size:13px;margin:7px 0 0;line-height:1.45;word-break:break-word;max-width:100%;opacity:.92}',
      '.zb-plinks{width:100%;display:flex;flex-direction:column;gap:11px;margin-top:22px}',
      '.zb-plink{width:100%;padding:14px 16px;border-radius:14px;font-weight:700;font-size:13.5px;text-align:center;word-break:break-word;border:1px solid transparent;transition:.15s}',
      '.zb-pempty{margin-top:24px;font-size:12.5px;opacity:.6;line-height:1.5}',
      '.zb-pfoot{margin-top:auto;padding-top:22px;font-size:10.5px;opacity:.45;letter-spacing:.04em}',
      /* skeleton / err */
      '.zb-skel{background:linear-gradient(90deg,var(--bg3),var(--bg2),var(--bg3));background-size:200% 100%;animation:zb-sh 1.2s infinite;border-radius:12px}',
      '@keyframes zb-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}',
      '.zb-err{background:rgba(214,112,138,.08);border:1px solid rgba(214,112,138,.35);color:#e8a7b8;border-radius:14px;padding:16px;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}'
    ].join('\n');
    var st = el(doc, 'style', null, css);
    st.id = STYLE_ID;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ================= MOUNT ================= */
  async function mountBio(root, ctx) {
    ctx = ctx || {};
    var doc = root.ownerDocument || global.document;
    var C = ctx.C || global.ZoiCore || {};
    var esc = (C && C.esc) || fallbackEsc;
    var toast = ctx.toast || (C && C.toast) || function () {};
    var relTime = (C && C.relTime) || function () { return ''; };
    injectStyle(doc);

    var state = {
      slug: '',
      title: '',
      tagline: '',
      theme: 'dark',
      photo_url: '',
      links: [],           // [{label,url}]
      published: false,
      views: null,
      updated_at: null,
      existed: false,      // was there already a page?
      loading: true,
      saving: false,
      error: null,
      lastSaved: null      // {slug,url} from a successful save this session
    };

    // ---- DOM references filled during render ----
    var refs = {};
    // ---- drag state ----
    var dragFrom = null;

    root.innerHTML = '';
    var wrap = el(doc, 'div', 'zb-wrap');
    root.appendChild(wrap);

    /* -------- data load -------- */
    function safeRpc(fn, params, auth) {
      try {
        if (!C.api || typeof C.api.rpc !== 'function') return Promise.resolve(null);
        return C.api.rpc(fn, params, { auth: auth || 'prefer' });
      } catch (e) { return Promise.reject(e); }
    }

    async function loadStatus() {
      state.loading = true;
      state.error = null;
      renderLoading();
      var st = null;
      try {
        st = await safeRpc('bio_status', { p_workspace: ctx.ws }, 'prefer');
      } catch (e) {
        state.loading = false;
        state.error = (e && e.message) || 'Could not load your bio page.';
        renderError(state.error);
        return;
      }
      state.loading = false;
      if (st && typeof st === 'object') {
        state.existed = true;
        state.slug = String(st.slug || '');
        state.title = String(st.title || '');
        state.tagline = String(st.tagline || '');
        state.theme = themeKey(st.theme);
        state.photo_url = String(st.photo_url || '');
        state.links = normalizeLinks(st.links);
        state.published = !!st.published;
        state.views = (st.views == null || isNaN(+st.views)) ? null : +st.views;
        state.updated_at = st.updated_at || null;
      } else {
        // no page yet — fresh draft, seed a friendly slug from workspace if any
        state.existed = false;
        state.published = false;
        state.views = null;
        state.links = [];
      }
      render();
    }

    function normalizeLinks(raw) {
      var arr = [];
      if (Array.isArray(raw)) {
        raw.forEach(function (l) {
          if (!l) return;
          if (typeof l === 'string') { arr.push({ label: l, url: '' }); return; }
          arr.push({ label: String(l.label || l.title || ''), url: String(l.url || l.href || '') });
        });
      }
      return arr;
    }

    /* -------- validation -------- */
    function slugValid() { return SLUG_RE.test(state.slug); }
    function validLinks() {
      // rows that have both a url that is http(s) and any label; empties dropped
      return state.links
        .map(function (l) { return { label: String(l.label || '').trim(), url: String(l.url || '').trim() }; })
        .filter(function (l) { return l.url !== '' || l.label !== ''; })
        .filter(function (l) { return isHttpUrl(l.url); });
    }
    function anyBadLink() {
      return state.links.some(function (l) {
        var u = String(l.url || '').trim();
        return u !== '' && !isHttpUrl(u);
      });
    }
    function canSave() {
      return slugValid() && !anyBadLink() && !state.saving;
    }

    /* -------- live updates that avoid re-rendering inputs -------- */
    function updateSlugLine() {
      if (!refs.slugInput) return;
      var ok = slugValid();
      refs.slugInput.classList.toggle('zb-bad', state.slug.length > 0 && !ok);
      if (refs.slugHint) {
        if (!state.slug) {
          refs.slugHint.className = 'zb-hint zb-mut';
          refs.slugHint.innerHTML = 'Choose a handle — 3–40 chars, lowercase letters, numbers or hyphens.';
        } else if (ok) {
          refs.slugHint.className = 'zb-hint zb-ok';
          refs.slugHint.innerHTML = 'Your page: <a href="https://' + esc(BASE_URL + state.slug) +
            '" target="_blank" rel="noopener">' + esc(BASE_URL + state.slug) + '</a>';
        } else {
          refs.slugHint.className = 'zb-hint zb-err';
          refs.slugHint.innerHTML = esc(BASE_URL + state.slug) +
            ' — must start with a letter/number and be 3–40 chars (a–z, 0–9, hyphen).';
        }
      }
    }
    function updateSaveState() {
      if (refs.saveBtn) refs.saveBtn.disabled = !canSave();
    }
    function updatePreview() {
      // Rebuild the phone screen contents in place (cheap; no editor re-render).
      if (refs.screen) {
        refs.screen.innerHTML = '';
        refs.screen.appendChild(buildPreviewPage());
      }
    }

    /* -------- preview builder (mirrors public /b/ page) -------- */
    function buildPreviewPage() {
      var t = THEMES[themeKey(state.theme)];
      var pg = el(doc, 'div', 'zb-pg');
      refs.pg = pg;
      pg.style.background = t.bg;
      pg.style.color = t.text;

      // avatar
      var av = el(doc, 'div', 'zb-pav');
      if (state.photo_url && isHttpUrl(state.photo_url)) {
        av.style.backgroundImage = "url('" + String(state.photo_url).replace(/'/g, "%27") + "')";
        av.textContent = '';
      } else {
        av.style.background = t.avatarBg;
        av.style.color = t.avatarText;
        av.textContent = initialOf(state.title, state.slug);
      }
      pg.appendChild(av);

      // title
      var titleTxt = (state.title && state.title.trim()) || (state.slug && state.slug.trim()) || 'Your name';
      var ttl = el(doc, 'div', 'zb-ptitle');
      ttl.textContent = titleTxt;
      pg.appendChild(ttl);

      // tagline
      if (state.tagline && state.tagline.trim()) {
        var tag = el(doc, 'div', 'zb-ptag');
        tag.style.color = t.sub;
        tag.textContent = state.tagline;
        pg.appendChild(tag);
      }

      // links
      var links = validLinks();
      if (links.length) {
        var box = el(doc, 'div', 'zb-plinks');
        links.forEach(function (l) {
          var b = el(doc, 'a', 'zb-plink');
          b.style.background = t.btnBg;
          b.style.color = t.btnText;
          b.style.borderColor = t.btnBorder;
          b.setAttribute('href', l.url);
          b.setAttribute('target', '_blank');
          b.setAttribute('rel', 'noopener nofollow');
          b.textContent = l.label || l.url;
          box.appendChild(b);
        });
        pg.appendChild(box);
      } else {
        var em = el(doc, 'div', 'zb-pempty');
        em.style.color = t.sub;
        em.textContent = 'Add link blocks to see them here.';
        pg.appendChild(em);
      }

      var foot = el(doc, 'div', 'zb-pfoot');
      foot.style.color = t.sub;
      foot.textContent = 'zoi.city' + (state.slug ? ' /b/' + state.slug : '');
      pg.appendChild(foot);
      return pg;
    }
    function buildPreviewScreen() { return buildPreviewPage(); }

    function renderPreviewColumn() {
      var col = el(doc, 'div', 'zb-preview');
      col.appendChild(el(doc, 'div', 'zb-plabel', 'Live preview'));
      var phone = el(doc, 'div', 'zb-phone');
      phone.appendChild(el(doc, 'div', 'zb-notch'));
      var screen = el(doc, 'div', 'zb-screen');
      refs.screen = screen;
      screen.appendChild(buildPreviewPage());
      phone.appendChild(screen);
      col.appendChild(phone);
      return col;
    }

    /* -------- links editor -------- */
    function renderLinksList() {
      var host = refs.linksHost;
      if (!host) return;
      host.innerHTML = '';
      if (!state.links.length) {
        host.appendChild(el(doc, 'div', 'zb-empty-links', 'No link blocks yet. Add one below, or quick-add a connected social.'));
        return;
      }
      state.links.forEach(function (link, idx) {
        host.appendChild(buildLinkRow(link, idx));
      });
    }

    function buildLinkRow(link, idx) {
      var row = el(doc, 'div', 'zb-link');
      row.setAttribute('draggable', 'true');
      row.setAttribute('data-idx', String(idx));

      // grip
      var grip = el(doc, 'div', 'zb-grip');
      grip.setAttribute('title', 'Drag to reorder');
      grip.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
      row.appendChild(grip);

      // body: label + url inputs
      var body = el(doc, 'div', 'zb-link-body');
      var labIn = el(doc, 'input', 'zb-input');
      labIn.type = 'text';
      labIn.placeholder = 'Label (e.g. My shop)';
      labIn.maxLength = 60;
      labIn.value = link.label || '';
      labIn.addEventListener('input', function () {
        state.links[idx].label = labIn.value;
        updatePreview();
      });

      var urlIn = el(doc, 'input', 'zb-input');
      urlIn.type = 'url';
      urlIn.placeholder = 'https://…';
      urlIn.value = link.url || '';
      function markUrl() {
        var u = urlIn.value.trim();
        urlIn.classList.toggle('zb-bad', u !== '' && !isHttpUrl(u));
      }
      urlIn.addEventListener('input', function () {
        state.links[idx].url = urlIn.value;
        markUrl();
        updatePreview();
        updateSaveState();
      });
      markUrl();
      body.appendChild(labIn);
      body.appendChild(urlIn);
      row.appendChild(body);

      // actions: up / down / delete
      var acts = el(doc, 'div', 'zb-link-acts');
      var up = el(doc, 'button', 'zb-mini', '<svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>');
      up.title = 'Move up';
      if (idx === 0) up.disabled = true;
      up.addEventListener('click', function () { moveLink(idx, idx - 1); });

      var down = el(doc, 'button', 'zb-mini', '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>');
      down.title = 'Move down';
      if (idx === state.links.length - 1) down.disabled = true;
      down.addEventListener('click', function () { moveLink(idx, idx + 1); });

      var del = el(doc, 'button', 'zb-mini zb-del', '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>');
      del.title = 'Remove';
      del.addEventListener('click', function () { removeLink(idx); });

      acts.appendChild(up);
      acts.appendChild(down);
      acts.appendChild(del);
      row.appendChild(acts);

      /* ---- HTML5 drag & drop reorder ---- */
      row.addEventListener('dragstart', function (e) {
        dragFrom = idx;
        row.classList.add('zb-dragging');
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(idx));
        } catch (er) {}
      });
      row.addEventListener('dragend', function () {
        dragFrom = null;
        row.classList.remove('zb-dragging');
        Array.prototype.forEach.call(refs.linksHost.querySelectorAll('.zb-over'), function (n) { n.classList.remove('zb-over'); });
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'move'; } catch (er) {}
        row.classList.add('zb-over');
      });
      row.addEventListener('dragleave', function () { row.classList.remove('zb-over'); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        row.classList.remove('zb-over');
        var from = dragFrom;
        if (from == null) {
          try { from = parseInt(e.dataTransfer.getData('text/plain'), 10); } catch (er) { from = null; }
        }
        var to = parseInt(row.getAttribute('data-idx'), 10);
        if (from == null || isNaN(from) || isNaN(to) || from === to) return;
        moveLink(from, to);
      });

      return row;
    }

    function moveLink(from, to) {
      if (from < 0 || to < 0 || from >= state.links.length || to >= state.links.length) return;
      var item = state.links.splice(from, 1)[0];
      state.links.splice(to, 0, item);
      renderLinksList();
      updatePreview();
      updateSaveState();
    }
    function removeLink(idx) {
      state.links.splice(idx, 1);
      renderLinksList();
      updatePreview();
      updateSaveState();
    }
    function addLink(prefill) {
      state.links.push({ label: (prefill && prefill.label) || '', url: (prefill && prefill.url) || '' });
      renderLinksList();
      updatePreview();
      updateSaveState();
      // focus the new row's label
      try {
        var rows = refs.linksHost.querySelectorAll('.zb-link');
        var last = rows[rows.length - 1];
        if (last) { var inp = last.querySelector('input'); if (inp) inp.focus(); }
      } catch (e) {}
    }

    /* -------- save -------- */
    async function doSave() {
      if (!canSave()) {
        if (!slugValid()) toast('Pick a valid handle first (3–40 chars, a–z 0–9 -).');
        else if (anyBadLink()) toast('Some link URLs are invalid — they must start with http(s).');
        return;
      }
      state.saving = true;
      updateSaveState();
      if (refs.saveBtn) {
        refs.saveBtn.innerHTML = '<span class="zb-spin"></span> Saving…';
        refs.saveBtn.disabled = true;
      }
      var payload = {
        p_workspace: ctx.ws,
        p_slug: state.slug,
        p_title: state.title || '',
        p_tagline: state.tagline || '',
        p_theme: themeKey(state.theme),
        p_links: validLinks(),
        p_photo: (state.photo_url && isHttpUrl(state.photo_url)) ? state.photo_url : null,
        p_published: !!state.published
      };
      var res = null, errMsg = null;
      try {
        res = await safeRpc('bio_save', payload, 'require');
      } catch (e) {
        errMsg = (e && e.message) || 'Save failed. Please try again.';
      }
      state.saving = false;
      if (errMsg || !res || res.ok === false) {
        restoreSaveBtn();
        updateSaveState();
        toast(errMsg || (res && res.error) || 'Save failed. Please try again.');
        return;
      }
      // success
      state.existed = true;
      if (res.slug) state.slug = String(res.slug);
      state.updated_at = new Date().toISOString();
      state.lastSaved = {
        slug: res.slug || state.slug,
        url: res.url || ('https://' + BASE_URL + (res.slug || state.slug))
      };
      restoreSaveBtn();
      updateSaveState();
      updateSlugLine();
      renderStatusChips();
      renderResult();
      toast(state.published ? 'Saved & published.' : 'Saved as draft.');
    }
    function restoreSaveBtn() {
      if (refs.saveBtn) {
        refs.saveBtn.innerHTML = SAVE_ICON + (state.published ? 'Save &amp; publish' : 'Save draft');
      }
    }

    var SAVE_ICON = '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>';

    /* -------- result / QR card -------- */
    function renderResult() {
      if (!refs.resultHost) return;
      refs.resultHost.innerHTML = '';
      if (!state.lastSaved) return;
      var url = state.lastSaved.url;
      var card = el(doc, 'div', 'zb-result');
      var qr = el(doc, 'div', 'zb-qr');
      var img = el(doc, 'img');
      img.setAttribute('alt', 'QR code for your bio page');
      img.setAttribute('width', '220');
      img.setAttribute('height', '220');
      img.setAttribute('loading', 'lazy');
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
      qr.appendChild(img);
      card.appendChild(qr);

      var body = el(doc, 'div', 'zb-result-body');
      body.appendChild(el(doc, 'h4', null,
        (state.published ? 'Published — your page is live' : 'Saved as draft')));
      var sub = el(doc, 'p', 'zb-hint zb-mut');
      sub.style.margin = '0';
      sub.textContent = state.published
        ? 'Share this link or scan the QR code.'
        : 'Not public yet — toggle Publish and save to make it live. Link is reserved.';
      body.appendChild(sub);

      var urlrow = el(doc, 'div', 'zb-urlrow');
      var box = el(doc, 'div', 'zb-urlbox');
      box.textContent = url;
      urlrow.appendChild(box);

      var copyBtn = el(doc, 'button', 'zb-btn',
        '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy');
      copyBtn.addEventListener('click', function () {
        var ok = copyText(doc, url);
        toast(ok ? 'Link copied.' : 'Copy not supported — select the link manually.');
      });
      urlrow.appendChild(copyBtn);

      var openBtn = el(doc, 'a', 'zb-btn',
        '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>Open');
      openBtn.setAttribute('href', url);
      openBtn.setAttribute('target', '_blank');
      openBtn.setAttribute('rel', 'noopener');
      urlrow.appendChild(openBtn);

      body.appendChild(urlrow);
      card.appendChild(body);
      refs.resultHost.appendChild(card);
    }

    /* -------- status chips (header) -------- */
    function renderStatusChips() {
      if (!refs.statHost) return;
      refs.statHost.innerHTML = '';
      // published / draft
      var pub = el(doc, 'span', 'zb-chip ' + (state.published ? 'zb-live' : 'zb-draft'));
      pub.innerHTML = (state.published
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg> Published'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg> Draft');
      refs.statHost.appendChild(pub);
      // views (only if we actually have a number)
      if (state.views != null) {
        var v = el(doc, 'span', 'zb-chip');
        v.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg> <b>' +
          esc(state.views.toLocaleString()) + '</b> views';
        refs.statHost.appendChild(v);
      }
      // updated
      if (state.updated_at) {
        var u = el(doc, 'span', 'zb-chip');
        u.textContent = 'Updated ' + (relTime(state.updated_at) || '');
        refs.statHost.appendChild(u);
      }
    }

    /* -------- loading / error -------- */
    function renderLoading() {
      wrap.innerHTML = '';
      wrap.appendChild(headerNode());
      var cols = el(doc, 'div', 'zb-cols');
      var left = el(doc, 'div', 'zb-editor');
      for (var i = 0; i < 3; i++) { var s = el(doc, 'div', 'zb-skel'); s.style.height = i === 1 ? '180px' : '120px'; left.appendChild(s); }
      cols.appendChild(left);
      var ph = el(doc, 'div', 'zb-skel'); ph.style.height = '600px'; ph.style.width = '300px'; ph.style.borderRadius = '38px';
      cols.appendChild(ph);
      wrap.appendChild(cols);
    }
    function renderError(msg) {
      wrap.innerHTML = '';
      wrap.appendChild(headerNode());
      var e = el(doc, 'div', 'zb-err');
      e.innerHTML = '<span>' + esc(msg || 'Could not load your bio page.') + '</span>';
      var retry = el(doc, 'button', 'zb-btn', 'Retry');
      retry.addEventListener('click', function () { loadStatus(); });
      e.appendChild(retry);
      wrap.appendChild(e);
    }

    /* -------- header -------- */
    function headerNode() {
      var head = el(doc, 'div', 'zb-head');
      head.innerHTML =
        '<h2 class="zb-title">' +
        '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>' +
        'Link in bio <small>one page for every link</small></h2>';
      var stat = el(doc, 'div', 'zb-hstat');
      refs.statHost = stat;
      head.appendChild(stat);
      return head;
    }

    /* -------- full render -------- */
    function render() {
      wrap.innerHTML = '';
      refs = {};
      wrap.appendChild(headerNode());
      renderStatusChips();

      // first-time honest empty note
      if (!state.existed) {
        var note = el(doc, 'div', 'zb-chip zb-draft');
        note.style.marginBottom = '2px';
        note.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> Your bio page isn’t published yet — build it below and hit Save.';
        var noteWrap = el(doc, 'div');
        noteWrap.appendChild(note);
        wrap.appendChild(noteWrap);
      }

      var cols = el(doc, 'div', 'zb-cols');

      /* ---- LEFT: editor ---- */
      var left = el(doc, 'div', 'zb-editor');

      // 1) identity card
      var idCard = el(doc, 'div', 'zb-card');
      idCard.appendChild(el(doc, 'h3', null, 'Page details'));
      idCard.appendChild(el(doc, 'p', 'zb-sub', 'Your handle, name and tagline.'));

      // slug
      var slugField = el(doc, 'div', 'zb-field');
      slugField.appendChild(el(doc, 'label', 'zb-lab', 'Handle'));
      var slugRow = el(doc, 'div', 'zb-slugrow');
      slugRow.appendChild(el(doc, 'span', 'zb-slugpre', esc(BASE_URL)));
      var slugInput = el(doc, 'input', 'zb-input');
      slugInput.type = 'text';
      slugInput.placeholder = 'your-handle';
      slugInput.maxLength = 40;
      slugInput.value = state.slug;
      slugInput.setAttribute('autocapitalize', 'off');
      slugInput.setAttribute('autocomplete', 'off');
      slugInput.setAttribute('spellcheck', 'false');
      slugInput.addEventListener('input', function () {
        // sanitize toward slug rules as they type (allow hyphens)
        var v = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (v !== slugInput.value) { var p = slugInput.selectionStart; slugInput.value = v; try { slugInput.setSelectionRange(p - 1, p - 1); } catch (e) {} }
        state.slug = v;
        updateSlugLine();
        updateSaveState();
        updatePreview();
      });
      slugRow.appendChild(slugInput);
      slugField.appendChild(slugRow);
      var slugHint = el(doc, 'p', 'zb-hint zb-mut', '');
      slugField.appendChild(slugHint);
      idCard.appendChild(slugField);
      refs.slugInput = slugInput;
      refs.slugHint = slugHint;

      // title
      var titleField = el(doc, 'div', 'zb-field');
      var titleLab = el(doc, 'label', 'zb-lab', 'Display name');
      titleField.appendChild(titleLab);
      var titleInput = el(doc, 'input', 'zb-input');
      titleInput.type = 'text';
      titleInput.placeholder = 'e.g. Maria’s Bakery';
      titleInput.maxLength = 80;
      titleInput.value = state.title;
      titleInput.addEventListener('input', function () {
        state.title = titleInput.value;
        updatePreview();
        // if slug empty, gently seed from title
        if (!state.slug) {
          var s = slugify(state.title);
          if (s.length >= 3) { slugInput.value = s.slice(0, 40); state.slug = slugInput.value; updateSlugLine(); updateSaveState(); }
        }
      });
      titleField.appendChild(titleInput);
      idCard.appendChild(titleField);

      // tagline
      var tagField = el(doc, 'div', 'zb-field');
      tagField.appendChild(el(doc, 'label', 'zb-lab', 'Tagline'));
      var tagInput = el(doc, 'textarea', 'zb-ta');
      tagInput.placeholder = 'A short line about you or your business.';
      tagInput.maxLength = 160;
      tagInput.value = state.tagline;
      tagInput.addEventListener('input', function () {
        state.tagline = tagInput.value;
        updatePreview();
      });
      tagField.appendChild(tagInput);
      idCard.appendChild(tagField);

      // photo
      var photoField = el(doc, 'div', 'zb-field');
      photoField.appendChild(el(doc, 'label', 'zb-lab', 'Photo URL (optional)'));
      var photoInput = el(doc, 'input', 'zb-input');
      photoInput.type = 'url';
      photoInput.placeholder = 'https://…/avatar.jpg';
      photoInput.value = state.photo_url;
      photoInput.addEventListener('input', function () {
        state.photo_url = photoInput.value;
        photoInput.classList.toggle('zb-bad', photoInput.value.trim() !== '' && !isHttpUrl(photoInput.value));
        updatePreview();
      });
      photoField.appendChild(photoInput);
      photoField.appendChild(el(doc, 'p', 'zb-hint zb-mut', 'Leave blank to show your initial in a circle.'));
      idCard.appendChild(photoField);

      left.appendChild(idCard);

      // 2) theme card
      var themeCard = el(doc, 'div', 'zb-card');
      themeCard.appendChild(el(doc, 'h3', null, 'Theme'));
      themeCard.appendChild(el(doc, 'p', 'zb-sub', 'Sets the colours of your public page.'));
      var themes = el(doc, 'div', 'zb-themes');
      ['dark', 'gold', 'light'].forEach(function (key) {
        var t = THEMES[key];
        var sw = el(doc, 'div', 'zb-sw' + (state.theme === key ? ' on' : ''));
        sw.setAttribute('data-theme', key);
        var dot = el(doc, 'div', 'zb-swdot');
        dot.style.background = t.swatch;
        sw.appendChild(dot);
        sw.appendChild(el(doc, 'div', 'zb-swlab', esc(t.label)));
        sw.addEventListener('click', function () {
          state.theme = key;
          Array.prototype.forEach.call(themes.querySelectorAll('.zb-sw'), function (n) { n.classList.remove('on'); });
          sw.classList.add('on');
          updatePreview();
        });
        themes.appendChild(sw);
      });
      themeCard.appendChild(themes);
      left.appendChild(themeCard);

      // 3) links card
      var linksCard = el(doc, 'div', 'zb-card');
      linksCard.appendChild(el(doc, 'h3', null, 'Link blocks'));
      linksCard.appendChild(el(doc, 'p', 'zb-sub', 'Drag to reorder, or use the up/down buttons. URLs must start with http(s).'));
      var linksHost = el(doc, 'div', 'zb-links');
      refs.linksHost = linksHost;
      linksCard.appendChild(linksHost);
      renderLinksList();

      // add row
      var addRow = el(doc, 'div', 'zb-addrow');
      var addBtn = el(doc, 'button', 'zb-btn',
        '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Add link block');
      addBtn.addEventListener('click', function () { addLink(null); });
      addRow.appendChild(addBtn);
      linksCard.appendChild(addRow);

      // quick-add from channels
      var quick = channelQuickAdds();
      if (quick.length) {
        linksCard.appendChild(el(doc, 'p', 'zb-hint zb-mut', 'Quick-add a connected social:'));
        var qrow = el(doc, 'div', 'zb-quick');
        quick.forEach(function (q) {
          var qb = el(doc, 'button', 'zb-qbtn');
          qb.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' + esc(q.label);
          qb.addEventListener('click', function () {
            // avoid duplicate exact urls
            var exists = state.links.some(function (l) { return String(l.url || '').trim() === q.url; });
            if (exists) { toast(q.label + ' is already added.'); return; }
            addLink({ label: q.label, url: q.url });
          });
          qrow.appendChild(qb);
        });
        linksCard.appendChild(qrow);
      }
      left.appendChild(linksCard);

      // 4) publish + save card
      var pubCard = el(doc, 'div', 'zb-card');
      var pubRow = el(doc, 'div', 'zb-pubrow');
      var pubTxt = el(doc, 'div', 'zb-pubtxt');
      pubTxt.innerHTML = '<b>Publish page</b><span>Make it visible at your public link.</span>';
      pubRow.appendChild(pubTxt);
      var sw2 = el(doc, 'div', 'zb-switch' + (state.published ? ' on' : ''));
      sw2.setAttribute('role', 'switch');
      sw2.setAttribute('tabindex', '0');
      sw2.setAttribute('aria-checked', state.published ? 'true' : 'false');
      sw2.appendChild(el(doc, 'div', 'zb-knob'));
      function togglePub() {
        state.published = !state.published;
        sw2.classList.toggle('on', state.published);
        sw2.setAttribute('aria-checked', state.published ? 'true' : 'false');
        restoreSaveBtn();
        renderStatusChips();
      }
      sw2.addEventListener('click', togglePub);
      sw2.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePub(); } });
      pubRow.appendChild(sw2);
      pubCard.appendChild(pubRow);

      var saveBar = el(doc, 'div', 'zb-savebar');
      saveBar.style.marginTop = '14px';
      var saveBtn = el(doc, 'button', 'zb-btn zb-primary', SAVE_ICON + (state.published ? 'Save &amp; publish' : 'Save draft'));
      refs.saveBtn = saveBtn;
      saveBtn.addEventListener('click', doSave);
      saveBar.appendChild(saveBtn);
      pubCard.appendChild(saveBar);

      var resultHost = el(doc, 'div');
      resultHost.style.marginTop = '14px';
      refs.resultHost = resultHost;
      pubCard.appendChild(resultHost);

      left.appendChild(pubCard);

      cols.appendChild(left);

      /* ---- RIGHT: live phone preview ---- */
      cols.appendChild(renderPreviewColumn());

      wrap.appendChild(cols);

      // finalize live-derived UI
      updateSlugLine();
      updateSaveState();
      renderResult();
    }

    /* -------- channel quick-adds -------- */
    function channelQuickAdds() {
      var chans = ctx.channels || [];
      var out = [];
      var seen = {};
      chans.forEach(function (ch) {
        // only surface channels that look connected (if flag present) and map
        if (ch && ch.connected === false) return;
        var link = channelToLink(ch);
        if (!link) return;
        var key = link.url;
        if (seen[key]) return;
        seen[key] = true;
        out.push({ label: link.label, url: link.url });
      });
      return out;
    }

    /* -------- go -------- */
    await loadStatus();
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'bio',
    label: 'Link in bio',
    order: 40,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>',
    mount: mountBio
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

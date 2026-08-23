/*!
 * zoi-search.js — the command palette.
 * Classic script (NO ES modules). Zero dependencies.
 *
 * ⌘K / Ctrl-K anywhere on the site opens instant search over the whole
 * directory: type, arrow, enter. The header's plain GET form still works with
 * JavaScript off — this upgrades it, it does not replace it.
 *
 * HONESTY: every row is a real listing returned by explore_search. Result
 * counts are what came back, never an estimate. Nothing is pre-seeded.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) return;

  var BASE = 'https://csebihpaychdkanjjsmz.supabase.co';
  var KEY = 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
  var RECENT_KEY = 'zoi_recent_searches';
  var STYLE_ID = 'zk-styles';

  /* Jumps that are always available, so the palette is useful before you type. */
  var ACTIONS = [
    { label: 'Directory', hint: 'Browse the Greek world', href: '/explore', ic: 'pin' },
    { label: 'Community', hint: 'The agora', href: '/community', ic: 'chat' },
    { label: 'Business', hint: 'Publish, schedule, grow', href: '/social', ic: 'spark' },
    { label: 'Tickets', hint: 'Events and reservations', href: '/tickets', ic: 'ticket' },
    { label: 'Marketplace', hint: 'Coming soon', href: '/#marketplace', ic: 'cart' }
  ];

  var IC = {
    pin: '<path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/>',
    chat: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    ticket: '<path d="M4 8a2 2 0 012-2h12a2 2 0 012 2 2 2 0 000 4 2 2 0 010 4H6a2 2 0 01-2-2 2 2 0 000-4 2 2 0 010-4z"/>',
    cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.4 12h11.2L21 7H6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function svg(d, cls) {
    return '<svg class="' + (cls || 'zk-ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  /* Public URLs never carry underscores. */
  function hrefFor(r) {
    if (!r || !r.slug) return '/explore';
    var t = r.entity_type === 'travel_place' ? 'travel-place' : (r.entity_type || 'p');
    return '/' + encodeURIComponent(t) + '/' + encodeURIComponent(r.slug);
  }
  function typeLabel(t) {
    if (global.ZoiEmblem && global.ZoiEmblem.typeLabel) return global.ZoiEmblem.typeLabel(t);
    return String(t || 'Listing');
  }
  function mark(r) {
    if (global.ZoiEmblem && global.ZoiEmblem.mark) {
      return global.ZoiEmblem.mark({ name: r.name, type: r.entity_type, slug: r.slug || r.id });
    }
    return '';
  }

  function styles() {
    if (doc.getElementById(STYLE_ID)) return;
    var css = [
      '.zk-scrim{position:fixed;inset:0;z-index:9998;background:color-mix(in srgb, var(--bg) 72%, transparent);',
      '  backdrop-filter:blur(10px) saturate(120%);-webkit-backdrop-filter:blur(10px) saturate(120%);',
      '  display:flex;align-items:flex-start;justify-content:center;padding:12vh 20px 20px;opacity:0;',
      '  transition:opacity .18s var(--ease,ease)}',
      '.zk-scrim.on{opacity:1}',
      '.zk-box{width:100%;max-width:640px;background:var(--bg2);border:1px solid var(--line2);',
      '  border-radius:18px;box-shadow:0 40px 90px -40px rgba(0,0,0,.7);overflow:hidden;',
      '  transform:translateY(-10px) scale(.985);transition:transform .22s var(--ease,ease)}',
      '.zk-scrim.on .zk-box{transform:none}',
      '.zk-top{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}',
      '.zk-top .zk-ic{width:19px;height:19px;color:var(--mut);flex:none}',
      '.zk-input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--tx);',
      '  font:500 17px "Hanken Grotesk",system-ui,sans-serif}',
      '.zk-input::placeholder{color:var(--dim)}',
      '.zk-esc{font:700 10.5px "Hanken Grotesk",system-ui;letter-spacing:.06em;text-transform:uppercase;',
      '  color:var(--dim);border:1px solid var(--line2);border-radius:6px;padding:3px 7px;flex:none}',
      '.zk-list{max-height:min(56vh,440px);overflow-y:auto;padding:8px;scrollbar-width:thin}',
      '.zk-group{font:800 10px "Hanken Grotesk",system-ui;letter-spacing:.12em;text-transform:uppercase;',
      '  color:var(--dim);padding:12px 12px 6px}',
      '.zk-row{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:11px;cursor:pointer;',
      '  text-decoration:none;color:inherit}',
      '.zk-row[aria-selected="true"]{background:var(--card)}',
      '.zk-row[aria-selected="true"] .zk-go{opacity:1;transform:none}',
      '.zk-av{width:36px;height:36px;border-radius:10px;overflow:hidden;flex:none;background:var(--card2)}',
      '.zk-av svg{display:block;width:100%;height:100%}',
      '.zk-ib{width:36px;height:36px;border-radius:10px;flex:none;display:grid;place-items:center;',
      '  border:1px solid var(--line2);color:var(--gold)}',
      '.zk-ib svg{width:17px;height:17px}',
      '.zk-body{flex:1;min-width:0}',
      '.zk-name{font-size:14.5px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;',
      '  text-overflow:ellipsis}',
      '.zk-name b{color:var(--gold);font-weight:700}',
      '.zk-meta{font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.zk-go{flex:none;color:var(--mut);opacity:0;transform:translateX(-4px);transition:.18s var(--ease,ease)}',
      '.zk-go svg{width:15px;height:15px}',
      '.zk-foot{display:flex;align-items:center;gap:16px;padding:10px 18px;border-top:1px solid var(--line);',
      '  font-size:11.5px;color:var(--dim);flex-wrap:wrap}',
      '.zk-kbd{font:700 10px "Hanken Grotesk",system-ui;border:1px solid var(--line2);border-radius:5px;',
      '  padding:2px 6px;color:var(--mut)}',
      '.zk-empty{padding:34px 20px;text-align:center;color:var(--mut);font-size:13.5px;line-height:1.6}',
      '.zk-count{margin-left:auto;font-variant-numeric:tabular-nums}',
      '.zk-spin{width:15px;height:15px;border:2px solid var(--line2);border-top-color:var(--gold);',
      '  border-radius:50%;animation:zk-rot .7s linear infinite;flex:none}',
      '@keyframes zk-rot{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){.zk-scrim,.zk-box,.zk-go{transition:none}}',
      /* the header trigger gains a visible shortcut hint */
      '.zoi-search .zk-hint{flex:none;font:700 10px "Hanken Grotesk",system-ui;letter-spacing:.04em;',
      '  color:var(--dim);border:1px solid var(--line2);border-radius:6px;padding:3px 6px;margin-right:4px}',
      '@media(max-width:720px){.zoi-search .zk-hint{display:none}}'
    ].join('');
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = css;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------- recent searches ---------- */
  function recents() {
    try { return (JSON.parse(global.localStorage.getItem(RECENT_KEY) || '[]') || []).slice(0, 5); }
    catch (e) { return []; }
  }
  function remember(q) {
    q = String(q || '').trim();
    if (q.length < 2) return;
    try {
      var list = recents().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
      list.unshift(q);
      global.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
    } catch (e) {}
  }

  /* ---------- the palette ---------- */
  var scrim, box, input, list, foot, rows = [], sel = 0, seq = 0, open = false, lastQ = '';

  function build() {
    styles();
    scrim = doc.createElement('div');
    scrim.className = 'zk-scrim';
    scrim.setAttribute('role', 'dialog');
    scrim.setAttribute('aria-modal', 'true');
    scrim.setAttribute('aria-label', 'Search Zoi');
    scrim.innerHTML =
      '<div class="zk-box">' +
        '<div class="zk-top">' + svg(IC.search) +
          '<input class="zk-input" type="text" autocomplete="off" spellcheck="false" ' +
            'placeholder="Search 8,000+ Greek places, people and businesses…" aria-label="Search">' +
          '<span class="zk-esc">esc</span>' +
        '</div>' +
        '<div class="zk-list" role="listbox"></div>' +
        '<div class="zk-foot">' +
          '<span><span class="zk-kbd">↑↓</span> move</span>' +
          '<span><span class="zk-kbd">↵</span> open</span>' +
          '<span><span class="zk-kbd">esc</span> close</span>' +
          '<span class="zk-count"></span>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(scrim);
    box = scrim.querySelector('.zk-box');
    input = scrim.querySelector('.zk-input');
    list = scrim.querySelector('.zk-list');
    foot = scrim.querySelector('.zk-count');

    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim) close(); });
    scrim.querySelector('.zk-esc').addEventListener('click', close);
    input.addEventListener('input', onType);
    input.addEventListener('keydown', onKey);
  }

  function show() {
    if (!scrim) build();
    open = true;
    scrim.style.display = 'flex';
    // force a frame so the transition runs
    global.requestAnimationFrame(function () { scrim.classList.add('on'); });
    input.value = '';
    lastQ = '';
    render(idle());
    input.focus();
    doc.documentElement.style.overflow = 'hidden';
  }
  function close() {
    if (!open) return;
    open = false;
    scrim.classList.remove('on');
    doc.documentElement.style.overflow = '';
    global.setTimeout(function () { if (!open) scrim.style.display = 'none'; }, 200);
  }

  /* what the palette shows before you type */
  function idle() {
    var out = [];
    var rec = recents();
    if (rec.length) {
      out.push({ group: 'Recent' });
      rec.forEach(function (q) {
        out.push({ kind: 'query', q: q, name: q, meta: 'Search the directory', ic: IC.clock });
      });
    }
    out.push({ group: 'Jump to' });
    ACTIONS.forEach(function (a) {
      out.push({ kind: 'link', href: a.href, name: a.label, meta: a.hint, ic: IC[a.ic] });
    });
    return out;
  }

  function highlight(name, q) {
    var s = String(name == null ? '' : name);
    if (!q) return esc(s);
    var i = s.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + '<b>' + esc(s.slice(i, i + q.length)) + '</b>' + esc(s.slice(i + q.length));
  }

  function render(items, q) {
    rows = items.filter(function (r) { return !r.group; });
    sel = 0;
    var html = '';
    items.forEach(function (r) {
      if (r.group) { html += '<div class="zk-group">' + esc(r.group) + '</div>'; return; }
      var idx = rows.indexOf(r);
      var left = r.kind === 'listing'
        ? '<span class="zk-av">' + mark(r.row) + '</span>'
        : '<span class="zk-ib">' + svg(r.ic) + '</span>';
      html += '<a class="zk-row" role="option" data-i="' + idx + '"' +
        (r.href ? ' href="' + esc(r.href) + '"' : ' href="#"') + '>' + left +
        '<span class="zk-body"><span class="zk-name">' + highlight(r.name, q) + '</span>' +
        (r.meta ? '<span class="zk-meta">' + esc(r.meta) + '</span>' : '') + '</span>' +
        '<span class="zk-go">' + svg(IC.arrow) + '</span></a>';
    });
    list.innerHTML = html || '<div class="zk-empty">Nothing matched that.<br>Try a place, a name, or a category.</div>';
    paint();
    Array.prototype.forEach.call(list.querySelectorAll('.zk-row'), function (el) {
      el.addEventListener('mouseenter', function () { sel = +el.getAttribute('data-i'); paint(); });
      el.addEventListener('click', function (ev) {
        var r = rows[+el.getAttribute('data-i')];
        if (r && r.kind === 'query') { ev.preventDefault(); input.value = r.q; onType(); }
        else if (r) { remember(lastQ); }
      });
    });
  }
  function paint() {
    Array.prototype.forEach.call(list.querySelectorAll('.zk-row'), function (el) {
      var on = +el.getAttribute('data-i') === sel;
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    });
  }

  var timer = null;
  function onType() {
    var q = input.value.trim();
    lastQ = q;
    if (timer) global.clearTimeout(timer);
    if (!q) { foot.textContent = ''; render(idle()); return; }
    foot.innerHTML = '<span class="zk-spin"></span>';
    timer = global.setTimeout(function () { search(q); }, 170);
  }

  function search(q) {
    var mine = ++seq;
    global.fetch(BASE + '/rest/v1/rpc/explore_search', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_q: q, p_type: null, p_city: null, p_country: null, p_limit: 24, p_offset: 0 })
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        if (mine !== seq || !open) return;             // a newer keystroke won
        var found = Array.isArray(data) ? data : [];
        var items = [];
        if (found.length) {
          // group by category so a long list stays readable
          var groups = {};
          found.forEach(function (row) {
            var g = typeLabel(row.entity_type);
            (groups[g] = groups[g] || []).push(row);
          });
          Object.keys(groups).forEach(function (g) {
            items.push({ group: g });
            groups[g].forEach(function (row) {
              var loc = [row.city, row.country].filter(Boolean).join(', ');
              items.push({
                kind: 'listing', row: row, href: hrefFor(row), name: row.name,
                meta: [row.category, loc].filter(Boolean).join(' · ')
              });
            });
          });
        }
        items.push({ group: 'Everywhere' });
        items.push({
          kind: 'link', href: '/explore?q=' + encodeURIComponent(q), ic: IC.search,
          name: 'Search the whole directory for “' + q + '”',
          meta: 'Filters, sorting and more results'
        });
        render(items, q);
        // the count is what actually came back — never an estimate
        foot.textContent = found.length
          ? found.length + (found.length === 24 ? '+ matches' : ' match' + (found.length === 1 ? '' : 'es'))
          : 'no matches';
      })
      .catch(function () {
        if (mine !== seq || !open) return;
        foot.textContent = 'search unavailable';
        render([{ group: 'Everywhere' }, {
          kind: 'link', href: '/explore?q=' + encodeURIComponent(q), ic: IC.search,
          name: 'Open the directory', meta: 'Search there instead'
        }], q);
      });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, rows.length - 1); paint(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); return; }
    if (e.key === 'Enter') {
      var r = rows[sel];
      if (!r) return;
      e.preventDefault();
      if (r.kind === 'query') { input.value = r.q; onType(); return; }
      remember(lastQ);
      global.location.href = r.href;
    }
  }

  /* ---------- wire up ---------- */
  function init() {
    // ⌘K / Ctrl-K from anywhere, and "/" when not already typing
    doc.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); open ? close() : show(); return; }
      if (open) return;
      var t = e.target || {};
      var typing = /^(input|textarea|select)$/i.test(t.tagName || '') || t.isContentEditable;
      if (k === '/' && !typing) { e.preventDefault(); show(); }
    });

    // upgrade the header's plain GET form: clicking it opens the palette,
    // but the form still submits normally if JS is disabled.
    Array.prototype.forEach.call(doc.querySelectorAll('.zoi-search'), function (form) {
      var field = form.querySelector('input[name="q"]');
      if (!field) return;
      var mac = /Mac|iPhone|iPad/.test(global.navigator.platform || global.navigator.userAgent || '');
      var hint = doc.createElement('span');
      hint.className = 'zk-hint';
      hint.textContent = mac ? '⌘K' : 'Ctrl K';
      var btn = form.querySelector('button');
      if (btn) form.insertBefore(hint, btn); else form.appendChild(hint);
      field.setAttribute('readonly', 'readonly');   // the palette is the input now
      field.style.cursor = 'pointer';
      form.addEventListener('click', function (e) { e.preventDefault(); show(); });
      form.addEventListener('submit', function (e) { e.preventDefault(); show(); });
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

  global.ZoiSearch = { open: show, close: close };
})(typeof window !== 'undefined' ? window : this);

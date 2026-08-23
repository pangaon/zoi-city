/*!
 * analytics.js — Zoi Suite module: Analytics & Reporting
 * Classic script (NO ES modules). Self-contained IIFE.
 * Only external dependency: Chart.js 4.4.1, loaded defensively from CDN at
 * mount time (guarded; degrades to CSS bars if it fails). No network is
 * required for the module to render.
 *
 * HONESTY CONTRACT (hard requirement): this module renders ONLY numbers we
 * actually have from the backend RPCs. It NEVER fabricates engagement metrics
 * (impressions / likes / reach / views). Per-post engagement is honestly
 * gated behind a "connect your accounts" panel. Missing data renders as an
 * explicit empty/unavailable state, never as an invented value.
 *
 * Registers into window.ZoiSuite.modules.
 *   mount(root, ctx); ctx = { C:ZoiCore, ws, channels:[], avail, toast }
 *   ctx.C provides: esc, relTime, toast, api.rpc(fn, params, {auth}) -> Promise
 *
 * REAL data RPCs consumed (all reads, auth:'prefer', failures degrade to null):
 *   social_stats(p_workspace)
 *   social_list_posts(p_workspace, p_from, p_to)
 *   tickets_dashboard(p_workspace) / tickets_event_stats(p_workspace)
 *   community_stats()
 *   home_stats()
 *   suite_config()
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'za-styles';
  var CHART_ID = 'za-chartjs';
  var CHART_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  var VERSION = '1.0.0';
  var DAY = 86400000;

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
  // numeric coercion: returns a finite number or null (never NaN, never a guess)
  function num(v) {
    if (v == null || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : null;
  }
  // first defined+finite numeric arg, else null
  function firstNum() {
    for (var i = 0; i < arguments.length; i++) {
      var n = num(arguments[i]);
      if (n != null) return n;
    }
    return null;
  }
  function ms(v) {
    if (v == null || v === '') return null;
    var t = typeof v === 'number' ? v : Date.parse(v);
    return isFinite(t) ? t : null;
  }
  function fmtInt(n) {
    if (n == null) return null;
    try { return Math.round(n).toLocaleString(); } catch (e) { return String(Math.round(n)); }
  }
  function fmtMoneyCents(cents) {
    if (cents == null) return null;
    var v = cents / 100;
    try {
      return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
    } catch (e) { return '$' + v.toFixed(2); }
  }
  function shortDate(t) {
    try { return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    catch (e) { return ''; }
  }
  function isoDate(t) {
    try { return new Date(t).toISOString().slice(0, 10); } catch (e) { return ''; }
  }
  function sumKey(arr, k) {
    var s = 0, any = false;
    (arr || []).forEach(function (o) { var n = num(o && o[k]); if (n != null) { s += n; any = true; } });
    return any ? s : null;
  }

  /* ---------- network normalization ---------- */
  var NET_META = {
    facebook:  { name: 'Facebook',  color: '#1877F2' },
    instagram: { name: 'Instagram', color: '#E4405F' },
    x:         { name: 'X',         color: '#4a4a4a' },
    linkedin:  { name: 'LinkedIn',  color: '#0A66C2' },
    tiktok:    { name: 'TikTok',    color: '#00c4c4' },
    youtube:   { name: 'YouTube',   color: '#FF0000' },
    threads:   { name: 'Threads',   color: '#8a5cf6' },
    pinterest: { name: 'Pinterest', color: '#E60023' }
  };
  function normNet(p) {
    p = String(p == null ? '' : p).toLowerCase().trim();
    if (p === 'twitter') return 'x';
    return p;
  }
  function netName(key) { return (NET_META[key] && NET_META[key].name) || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Other'); }
  function netColor(key, i) {
    if (NET_META[key]) return NET_META[key].color;
    var pal = ['#B8893B', '#1F9EC9', '#B5325F', '#2e8b57', '#7b6fc0', '#d9a23b'];
    return pal[i % pal.length];
  }

  /* ---------- posts derivation ---------- */
  // Return array of normalized network keys for a post (from post.channels).
  function postNetworks(post) {
    var chs = post && (post.channels || post.networks || post.targets);
    if (!chs) return [];
    if (!Array.isArray(chs)) {
      // could be an object map { facebook:true, ... }
      if (typeof chs === 'object') {
        return Object.keys(chs).filter(function (k) { return chs[k]; }).map(normNet).filter(Boolean);
      }
      return [];
    }
    var out = [];
    chs.forEach(function (c) {
      var p = typeof c === 'string' ? c : (c && (c.platform || c.network || c.name || c.type || c.key));
      p = normNet(p);
      if (p) out.push(p);
    });
    return out;
  }
  // Classify a post -> { status, when(ms|null) }
  function classify(post) {
    var status = String((post && post.status) || '').toLowerCase();
    var pub = post && (post.published_at || post.publishedAt);
    var sch = post && (post.scheduled_at || post.scheduledAt);
    var created = post && (post.created_at || post.createdAt || post.inserted_at);
    if (status === 'published' || (pub && status !== 'draft' && status !== 'scheduled')) {
      return { status: 'published', when: ms(pub || sch || created) };
    }
    if (status === 'scheduled' || (sch && status !== 'draft')) {
      return { status: 'scheduled', when: ms(sch || created) };
    }
    if (status === 'draft') return { status: 'draft', when: ms(created || sch) };
    if (pub) return { status: 'published', when: ms(pub) };
    if (sch) return { status: 'scheduled', when: ms(sch) };
    return { status: 'other', when: ms(created) };
  }
  // Weekly buckets covering [fromMs, toMs]; counts published vs scheduled.
  function weeklyBuckets(posts, fromMs, toMs) {
    var week = 7 * DAY;
    var buckets = [];
    var guard = 0;
    for (var t = fromMs; t < toMs && guard < 60; t += week, guard++) {
      buckets.push({ start: t, end: Math.min(t + week, toMs + 1), published: 0, scheduled: 0 });
    }
    if (!buckets.length) buckets.push({ start: fromMs, end: toMs + 1, published: 0, scheduled: 0 });
    (posts || []).forEach(function (p) {
      var c = classify(p);
      if (c.when == null) return;
      for (var i = 0; i < buckets.length; i++) {
        if (c.when >= buckets[i].start && c.when < buckets[i].end) {
          if (c.status === 'published') buckets[i].published++;
          else if (c.status === 'scheduled') buckets[i].scheduled++;
          break;
        }
      }
    });
    return buckets;
  }
  function perNetworkCounts(posts) {
    var map = {};
    (posts || []).forEach(function (p) {
      postNetworks(p).forEach(function (k) { map[k] = (map[k] || 0) + 1; });
    });
    return Object.keys(map).map(function (k) { return { key: k, name: netName(k), count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }
  function statusCounts(posts) {
    var out = { published: 0, scheduled: 0, drafts: 0, total: (posts || []).length };
    (posts || []).forEach(function (p) {
      var c = classify(p);
      if (c.status === 'published') out.published++;
      else if (c.status === 'scheduled') out.scheduled++;
      else if (c.status === 'draft') out.drafts++;
    });
    return out;
  }

  /* ---------- tickets derivation ---------- */
  function deriveTickets(dash, ev) {
    var events = [];
    var seen = {};
    function ingest(src) {
      if (!src) return;
      var list = src.events || (Array.isArray(src) ? src : null);
      if (Array.isArray(list)) {
        list.forEach(function (e) {
          if (!e || typeof e !== 'object') return;
          var name = e.name || e.title || e.event_name || e.event || 'Event';
          var rev = firstNum(e.revenue_cents, e.revenueCents, e.revenue != null ? e.revenue * 100 : null);
          var paid = firstNum(e.paid, e.paid_tickets, e.tickets_sold, e.sold, e.count);
          var id = String(e.id || e.event_id || name);
          if (seen[id] != null) {
            var cur = events[seen[id]];
            if (cur.revenueCents == null) cur.revenueCents = rev;
            if (cur.paid == null) cur.paid = paid;
          } else {
            seen[id] = events.length;
            events.push({ name: name, revenueCents: rev, paid: paid });
          }
        });
      }
    }
    ingest(ev); ingest(dash);
    var revTop = firstNum(
      ev && ev.revenue_cents, ev && ev.revenueCents, dash && dash.revenue_cents, dash && dash.revenueCents
    );
    var paidTop = firstNum(
      ev && ev.paid, ev && ev.paid_tickets, ev && ev.tickets_sold,
      dash && dash.paid, dash && dash.paid_tickets, dash && dash.tickets_sold
    );
    var revenueCents = revTop != null ? revTop : sumKey(events, 'revenueCents');
    var paid = paidTop != null ? paidTop : sumKey(events, 'paid');
    var eventsCount = firstNum(ev && ev.events_count, dash && dash.events, dash && dash.events_count);
    if (eventsCount == null && events.length) eventsCount = events.length;
    return { events: events, revenueCents: revenueCents, paid: paid, eventsCount: eventsCount };
  }

  /* ---------- Chart.js loader (defensive) ---------- */
  function loadChart(doc) {
    return new Promise(function (resolve) {
      if (global.Chart) return resolve(global.Chart);
      var done = false;
      function finish() { if (done) return; done = true; resolve(global.Chart || null); }
      var existing = doc.getElementById(CHART_ID);
      if (existing) {
        existing.addEventListener('load', finish);
        existing.addEventListener('error', finish);
        if (global.Chart) finish();
        setTimeout(finish, 8000);
        return;
      }
      var s;
      try { s = doc.createElement('script'); } catch (e) { return resolve(null); }
      s.id = CHART_ID;
      s.src = CHART_SRC;
      s.async = true;
      s.onload = finish;
      s.onerror = finish;
      try { (doc.head || doc.documentElement).appendChild(s); }
      catch (e) { return resolve(null); }
      setTimeout(finish, 8000);
    });
  }

  /* ---------- styles ---------- */
  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var css = [
      '.za-wrap{font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--tx);display:flex;flex-direction:column;gap:16px}',
      '.za-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}',
      '.za-title{font-weight:800;font-size:17px;margin:0;display:flex;align-items:center;gap:9px}',
      '.za-title small{font-weight:600;font-size:11.5px;color:var(--mut)}',
      '.za-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.za-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg3)}',
      '.za-seg button{background:none;border:none;color:var(--mut);font:700 12.5px "Hanken Grotesk",system-ui;padding:7px 13px;cursor:pointer;transition:.15s}',
      '.za-seg button+button{border-left:1px solid var(--line)}',
      '.za-seg button.on{background:var(--acc);color:#fff}',
      '.za-seg button:not(.on):hover{color:var(--tx)}',
      '.za-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:10px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font:700 12.5px "Hanken Grotesk",system-ui;cursor:pointer;transition:.15s}',
      '.za-btn:hover{border-color:var(--acc);color:var(--acc)}',
      '.za-btn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}',
      '.za-btn[disabled]{opacity:.45;cursor:not-allowed}',
      '.za-note{font-size:12px;color:var(--mut);margin:0}',
      '.za-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}',
      '.za-kpi{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.za-kpi .za-k-num{font-weight:800;font-size:26px;line-height:1.05;letter-spacing:-.02em}',
      '.za-kpi .za-k-num.za-na{color:var(--mut);font-size:20px}',
      '.za-kpi .za-k-lab{font-size:12px;color:var(--mut);font-weight:600}',
      '.za-kpi .za-k-sub{font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;font-weight:700}',
      '.za-trend{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;border-radius:20px;padding:1px 7px;width:fit-content}',
      '.za-trend.up{color:var(--green);background:rgba(46,139,87,.14)}',
      '.za-trend.down{color:#d6708a;background:rgba(214,112,138,.14)}',
      '.za-trend.flat{color:var(--mut);background:var(--bg3)}',
      '.za-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
      '@media(max-width:820px){.za-grid{grid-template-columns:1fr}}',
      '.za-card{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:16px;min-width:0}',
      '.za-card.span2{grid-column:1 / -1}',
      '.za-ch{font-weight:800;font-size:14px;margin:0 0 3px;display:flex;align-items:center;gap:7px}',
      '.za-csub{color:var(--mut);font-size:11.5px;margin:0 0 12px}',
      '.za-can-box{position:relative;width:100%;height:260px}',
      '.za-can-box canvas{max-width:100%}',
      '.za-empty{color:var(--mut);font-size:12.5px;text-align:center;padding:30px 12px;border:1px dashed var(--line);border-radius:12px}',
      '.za-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}',
      '.za-legend span{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mut)}',
      '.za-dot{width:10px;height:10px;border-radius:3px;flex:none}',
      /* CSS bar fallback */
      '.za-bars{display:flex;flex-direction:column;gap:9px}',
      '.za-bar-row{display:grid;grid-template-columns:88px 1fr 46px;align-items:center;gap:9px;font-size:12px}',
      '.za-bar-lab{color:var(--mut);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.za-bar-track{height:16px;background:var(--bg3);border-radius:8px;overflow:hidden;border:1px solid var(--line)}',
      '.za-bar-fill{height:100%;border-radius:8px;min-width:2px;transition:width .4s}',
      '.za-bar-val{text-align:right;font-weight:700;color:var(--tx)}',
      '.za-bar-stack{display:flex;height:16px;background:var(--bg3);border-radius:8px;overflow:hidden;border:1px solid var(--line)}',
      '.za-bar-seg{height:100%}',
      /* gated panel */
      '.za-gate{background:linear-gradient(135deg,rgba(184,137,59,.10),rgba(31,158,201,.06));border:1px solid rgba(184,137,59,.34);border-radius:16px;padding:18px}',
      '.za-gate h3{margin:0 0 6px;font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px}',
      '.za-gate p{margin:0 0 12px;font-size:13px;color:var(--tx);line-height:1.5;max-width:640px}',
      '.za-gate .za-lock{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:rgba(184,137,59,.2);color:var(--gold)}',
      '.za-gate .za-lock svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}',
      '.za-locklist{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
      '.za-lockpill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--mut);background:var(--bg3);border:1px dashed var(--line);border-radius:20px;padding:6px 11px}',
      '.za-lockpill b{color:var(--dim);font-weight:800}',
      '.za-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:20px;border:1px solid currentColor}',
      '.za-badge.gold{color:var(--gold)}',
      '.za-badge.green{color:var(--green)}',
      '.za-badge.mut{color:var(--mut)}',
      /* skeleton / states */
      '.za-skel{background:linear-gradient(90deg,var(--bg3),var(--bg2),var(--bg3));background-size:200% 100%;animation:za-sh 1.2s infinite;border-radius:12px}',
      '@keyframes za-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}',
      '.za-err{background:rgba(214,112,138,.08);border:1px solid rgba(214,112,138,.35);color:#e8a7b8;border-radius:14px;padding:16px;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.za-spin{width:16px;height:16px;border:2px solid var(--line);border-top-color:var(--acc);border-radius:50%;display:inline-block;animation:za-rot .7s linear infinite;vertical-align:-3px}',
      '@keyframes za-rot{to{transform:rotate(360deg)}}'
    ].join('\n');
    var st = el(doc, 'style', null, css);
    st.id = STYLE_ID;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------- render pieces ---------- */
  function kpiCard(doc, esc, k) {
    var card = el(doc, 'div', 'za-kpi');
    var numHtml;
    if (k.value == null) {
      numHtml = '<div class="za-k-num za-na">—</div>';
    } else {
      numHtml = '<div class="za-k-num">' + esc(k.display != null ? k.display : k.value) + '</div>';
    }
    card.innerHTML =
      (k.sub ? '<div class="za-k-sub">' + esc(k.sub) + '</div>' : '') +
      numHtml +
      '<div class="za-k-lab">' + esc(k.label) + '</div>';
    if (k.trend) {
      var cls = k.trend.dir > 0 ? 'up' : k.trend.dir < 0 ? 'down' : 'flat';
      var arrow = k.trend.dir > 0 ? '▲' : k.trend.dir < 0 ? '▼' : '—';
      var t = el(doc, 'span', 'za-trend ' + cls, esc(arrow + ' ' + k.trend.text));
      card.appendChild(t);
    } else if (k.value == null) {
      card.appendChild(el(doc, 'span', 'za-trend flat', 'no data'));
    }
    return card;
  }

  // CSS stacked-bar fallback for the weekly line chart
  function cssWeekly(doc, esc, buckets) {
    var max = 1;
    buckets.forEach(function (b) { max = Math.max(max, b.published + b.scheduled); });
    var box = el(doc, 'div', 'za-bars');
    buckets.forEach(function (b) {
      var row = el(doc, 'div', 'za-bar-row');
      var total = b.published + b.scheduled;
      var pubW = (b.published / max) * 100;
      var schW = (b.scheduled / max) * 100;
      row.innerHTML =
        '<div class="za-bar-lab">' + esc(shortDate(b.start)) + '</div>' +
        '<div class="za-bar-stack">' +
          '<div class="za-bar-seg" style="width:' + pubW.toFixed(2) + '%;background:var(--green)"></div>' +
          '<div class="za-bar-seg" style="width:' + schW.toFixed(2) + '%;background:var(--gold)"></div>' +
        '</div>' +
        '<div class="za-bar-val">' + esc(String(total)) + '</div>';
      box.appendChild(row);
    });
    return box;
  }
  function cssNet(doc, esc, nets) {
    var max = 1;
    nets.forEach(function (n) { max = Math.max(max, n.count); });
    var box = el(doc, 'div', 'za-bars');
    nets.forEach(function (n, i) {
      var row = el(doc, 'div', 'za-bar-row');
      row.innerHTML =
        '<div class="za-bar-lab">' + esc(n.name) + '</div>' +
        '<div class="za-bar-track"><div class="za-bar-fill" style="width:' + ((n.count / max) * 100).toFixed(2) + '%;background:' + netColor(n.key, i) + '"></div></div>' +
        '<div class="za-bar-val">' + esc(String(n.count)) + '</div>';
      box.appendChild(row);
    });
    return box;
  }
  function cssRevenue(doc, esc, events) {
    var max = 1;
    events.forEach(function (e) { if (e.revenueCents != null) max = Math.max(max, e.revenueCents); });
    var box = el(doc, 'div', 'za-bars');
    events.forEach(function (e, i) {
      if (e.revenueCents == null) return;
      var row = el(doc, 'div', 'za-bar-row');
      row.innerHTML =
        '<div class="za-bar-lab">' + esc(e.name) + '</div>' +
        '<div class="za-bar-track"><div class="za-bar-fill" style="width:' + ((e.revenueCents / max) * 100).toFixed(2) + '%;background:var(--gold)"></div></div>' +
        '<div class="za-bar-val">' + esc(fmtMoneyCents(e.revenueCents)) + '</div>';
      box.appendChild(row);
    });
    return box;
  }

  /* ---------- CSV export ---------- */
  function buildCsv(d) {
    function q(v) {
      var s = String(v == null ? '' : v);
      if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lines = [];
    lines.push(q('Zoi Analytics export'));
    lines.push([q('Generated'), q(new Date().toISOString())].join(','));
    lines.push([q('Range (days)'), q(d.rangeDays)].join(','));
    lines.push('');
    lines.push(q('Posts over time (weekly)'));
    lines.push(['Week starting', 'Published', 'Scheduled'].map(q).join(','));
    (d.buckets || []).forEach(function (b) {
      lines.push([isoDate(b.start), b.published, b.scheduled].map(q).join(','));
    });
    lines.push('');
    lines.push(q('Posts per network'));
    lines.push(['Network', 'Posts'].map(q).join(','));
    (d.nets || []).forEach(function (n) { lines.push([n.name, n.count].map(q).join(',')); });
    if (d.events && d.events.length) {
      lines.push('');
      lines.push(q('Ticket revenue per event'));
      lines.push(['Event', 'Paid tickets', 'Revenue (USD)'].map(q).join(','));
      d.events.forEach(function (e) {
        lines.push([
          e.name,
          e.paid == null ? '' : e.paid,
          e.revenueCents == null ? '' : (e.revenueCents / 100).toFixed(2)
        ].map(q).join(','));
      });
    }
    return lines.join('\r\n');
  }
  function downloadCsv(doc, text, filename) {
    try {
      var blob = new global.Blob([text], { type: 'text/csv;charset=utf-8' });
      var url = (global.URL || global.webkitURL).createObjectURL(blob);
      var a = el(doc, 'a');
      a.href = url; a.download = filename;
      (doc.body || doc.documentElement).appendChild(a);
      a.click();
      setTimeout(function () {
        try { a.parentNode && a.parentNode.removeChild(a); } catch (e) {}
        try { (global.URL || global.webkitURL).revokeObjectURL(url); } catch (e) {}
      }, 100);
      return true;
    } catch (e) { return false; }
  }

  /* ================= MOUNT ================= */
  async function mountAnalytics(root, ctx) {
    ctx = ctx || {};
    var doc = root.ownerDocument || global.document;
    var C = ctx.C || global.ZoiCore || {};
    var esc = (C && C.esc) || fallbackEsc;
    var toast = ctx.toast || (C && C.toast) || function () {};
    var avail = ctx.avail || (C.suiteConfig) || {};
    injectStyle(doc);

    var state = {
      range: 30,
      loading: false,
      error: null,
      charts: [],     // live Chart.js instances to destroy on re-render
      data: null
    };

    root.innerHTML = '';
    var wrap = el(doc, 'div', 'za-wrap');
    root.appendChild(wrap);

    function destroyCharts() {
      state.charts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
      state.charts = [];
    }

    function safeRpc(fn, params) {
      try {
        if (!C.api || typeof C.api.rpc !== 'function') return Promise.resolve(null);
        return C.api.rpc(fn, params, { auth: 'prefer' }).then(function (r) { return r; }, function () { return null; });
      } catch (e) { return Promise.resolve(null); }
    }

    async function fetchAll() {
      var now = Date.now();
      var fromMs = now - state.range * DAY;
      var pFrom = new Date(fromMs).toISOString();
      var pTo = new Date(now).toISOString();
      var ws = ctx.ws;

      var results = await Promise.all([
        safeRpc('social_stats', { p_workspace: ws }),
        safeRpc('social_list_posts', { p_workspace: ws, p_from: pFrom, p_to: pTo }),
        safeRpc('tickets_dashboard', { p_workspace: ws }),
        safeRpc('tickets_event_stats', { p_workspace: ws }),
        safeRpc('community_stats', {}),
        safeRpc('home_stats', {})
      ]);

      var socialStats = results[0];
      var postsRaw = results[1];
      var posts = Array.isArray(postsRaw) ? postsRaw
        : (postsRaw && Array.isArray(postsRaw.posts)) ? postsRaw.posts
        : (postsRaw && Array.isArray(postsRaw.items)) ? postsRaw.items
        : [];
      var postsAvailable = postsRaw != null;

      var tickets = deriveTickets(results[2], results[3]);
      var community = results[4] || null;
      var home = results[5] || null;

      var buckets = weeklyBuckets(posts, fromMs, now);
      var nets = perNetworkCounts(posts);
      var derived = statusCounts(posts);

      return {
        rangeDays: state.range,
        fromMs: fromMs, toMs: now,
        socialStats: socialStats || null,
        posts: posts,
        postsAvailable: postsAvailable,
        derived: derived,
        buckets: buckets,
        nets: nets,
        tickets: tickets,
        community: community,
        home: home
      };
    }

    // ---- header (always present) ----
    function renderHeader() {
      var head = el(doc, 'div', 'za-head');
      head.innerHTML =
        '<h2 class="za-title">Analytics &amp; Reporting ' +
        '<small>real data only · last ' + esc(String(state.range)) + ' days</small></h2>';
      var tools = el(doc, 'div', 'za-tools');

      var seg = el(doc, 'div', 'za-seg');
      [[7, '7d'], [30, '30d'], [90, '90d']].forEach(function (r) {
        var b = el(doc, 'button', state.range === r[0] ? 'on' : '', esc(r[1]));
        b.addEventListener('click', function () {
          if (state.range === r[0] || state.loading) return;
          state.range = r[0];
          load();
        });
        seg.appendChild(b);
      });
      tools.appendChild(seg);

      var csvBtn = el(doc, 'button', 'za-btn',
        '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>Download CSV');
      csvBtn.addEventListener('click', function () {
        if (!state.data) { toast('Nothing to export yet.'); return; }
        var ok = downloadCsv(doc, buildCsv(state.data), 'zoi-analytics-' + isoDate(Date.now()) + '.csv');
        toast(ok ? 'CSV downloaded.' : 'Export not supported here.');
      });
      if (!state.data) csvBtn.setAttribute('disabled', 'disabled');
      tools.appendChild(csvBtn);

      var refresh = el(doc, 'button', 'za-btn',
        '<svg viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10"/><path d="M20.5 15a9 9 0 0 1-14.9 3.4L1 14"/></svg>Refresh');
      refresh.addEventListener('click', function () { if (!state.loading) load(); });
      tools.appendChild(refresh);

      head.appendChild(tools);
      return head;
    }

    // ---- loading skeleton ----
    function renderLoading() {
      wrap.innerHTML = '';
      wrap.appendChild(renderHeader());
      var kp = el(doc, 'div', 'za-kpis');
      for (var i = 0; i < 6; i++) { var s = el(doc, 'div', 'za-skel'); s.style.height = '86px'; kp.appendChild(s); }
      wrap.appendChild(kp);
      var g = el(doc, 'div', 'za-grid');
      for (var j = 0; j < 2; j++) { var c = el(doc, 'div', 'za-skel'); c.style.height = '300px'; g.appendChild(c); }
      wrap.appendChild(g);
      var note = el(doc, 'p', 'za-note', '<span class="za-spin"></span> Loading your real analytics…');
      wrap.appendChild(note);
    }

    // ---- error ----
    function renderError(msg) {
      wrap.innerHTML = '';
      wrap.appendChild(renderHeader());
      var e = el(doc, 'div', 'za-err');
      e.innerHTML = '<span>' + esc(msg || 'Could not load analytics.') + '</span>';
      var retry = el(doc, 'button', 'za-btn', 'Retry');
      retry.addEventListener('click', function () { load(); });
      e.appendChild(retry);
      wrap.appendChild(e);
    }

    // ---- KPI row ----
    function renderKpis(d) {
      var kp = el(doc, 'div', 'za-kpis');

      // Prefer range-derived post counts (honest to the selected window); fall
      // back to social_stats totals only when the posts list is unavailable.
      var usingDerived = d.postsAvailable;
      var ss = d.socialStats || {};
      var published = usingDerived ? d.derived.published : firstNum(ss.published, ss.posts_published);
      var scheduled = usingDerived ? d.derived.scheduled : firstNum(ss.scheduled);
      var drafts = usingDerived ? d.derived.drafts : firstNum(ss.drafts);
      var scope = usingDerived ? ('in ' + state.range + 'd') : 'all time';

      // real trend: compare the two most recent weekly buckets for published
      var trend = null;
      var bk = d.buckets;
      if (usingDerived && bk.length >= 2) {
        var last = bk[bk.length - 1].published;
        var prev = bk[bk.length - 2].published;
        var diff = last - prev;
        trend = { dir: diff > 0 ? 1 : diff < 0 ? -1 : 0, text: (diff > 0 ? '+' : '') + diff + ' vs prev wk' };
      }

      var kpis = [
        { label: 'Posts published', sub: scope, value: published, display: fmtInt(published), trend: trend },
        { label: 'Scheduled', sub: scope, value: scheduled, display: fmtInt(scheduled) },
        { label: 'Drafts', sub: scope, value: drafts, display: fmtInt(drafts) },
        { label: 'Tickets sold', sub: 'all time', value: d.tickets.paid, display: fmtInt(d.tickets.paid) },
        { label: 'Ticket revenue', sub: 'all time', value: d.tickets.revenueCents, display: fmtMoneyCents(d.tickets.revenueCents) }
      ];

      // Community reach — only from community_stats keys that actually exist.
      if (d.community) {
        var members = firstNum(d.community.members);
        var cposts = firstNum(d.community.posts);
        kpis.push({ label: 'Community members', sub: 'community', value: members, display: fmtInt(members) });
        if (cposts != null) kpis.push({ label: 'Community posts', sub: 'community', value: cposts, display: fmtInt(cposts) });
      } else {
        kpis.push({ label: 'Community members', sub: 'community', value: null });
      }
      // Optional marketplace context from home_stats (real if present)
      if (d.home) {
        var listings = firstNum(d.home.listings);
        if (listings != null) kpis.push({ label: 'Marketplace listings', sub: 'directory', value: listings, display: fmtInt(listings) });
      }

      kpis.forEach(function (k) { kp.appendChild(kpiCard(doc, esc, k)); });
      return kp;
    }

    // ---- charts / grid ----
    function renderCharts(d, Chart) {
      var grid = el(doc, 'div', 'za-grid');

      // (a) posts over time — line: scheduled vs published
      var c1 = el(doc, 'div', 'za-card');
      c1.appendChild(el(doc, 'h3', 'za-ch', 'Posts over time'));
      c1.appendChild(el(doc, 'p', 'za-csub', 'Published vs scheduled, bucketed by week (from your posts).'));
      var hasPosts = d.buckets.some(function (b) { return b.published + b.scheduled > 0; });
      if (!d.postsAvailable) {
        c1.appendChild(el(doc, 'div', 'za-empty', 'Posts data unavailable. Connect / sign in to load your posts.'));
      } else if (!hasPosts) {
        c1.appendChild(el(doc, 'div', 'za-empty', 'No posts in this range yet. Publish or schedule to see the trend.'));
      } else if (Chart) {
        var box1 = el(doc, 'div', 'za-can-box');
        var cv1 = el(doc, 'canvas');
        box1.appendChild(cv1); c1.appendChild(box1);
        queueChart(function () {
          state.charts.push(new Chart(cv1.getContext('2d'), {
            type: 'line',
            data: {
              labels: d.buckets.map(function (b) { return shortDate(b.start); }),
              datasets: [
                { label: 'Published', data: d.buckets.map(function (b) { return b.published; }),
                  borderColor: getVar(doc, '--green', '#2e8b57'), backgroundColor: 'rgba(46,139,87,.15)', tension: .3, fill: true },
                { label: 'Scheduled', data: d.buckets.map(function (b) { return b.scheduled; }),
                  borderColor: getVar(doc, '--gold', '#B8893B'), backgroundColor: 'rgba(184,137,59,.12)', tension: .3, fill: true }
              ]
            },
            options: baseOpts(doc, true)
          }));
        });
      } else {
        c1.appendChild(cssWeekly(doc, esc, d.buckets));
        c1.appendChild(chartFallbackNote(doc));
        c1.appendChild(legend(doc, [['Published', getVar(doc, '--green', '#2e8b57')], ['Scheduled', getVar(doc, '--gold', '#B8893B')]]));
      }
      grid.appendChild(c1);

      // (b) posts per network — doughnut
      var c2 = el(doc, 'div', 'za-card');
      c2.appendChild(el(doc, 'h3', 'za-ch', 'Posts per network'));
      c2.appendChild(el(doc, 'p', 'za-csub', 'Distribution across connected channels (from post.channels).'));
      if (!d.nets.length) {
        c2.appendChild(el(doc, 'div', 'za-empty', 'No per-network data. Posts have no channel tags yet.'));
      } else if (Chart) {
        var box2 = el(doc, 'div', 'za-can-box');
        var cv2 = el(doc, 'canvas');
        box2.appendChild(cv2); c2.appendChild(box2);
        queueChart(function () {
          state.charts.push(new Chart(cv2.getContext('2d'), {
            type: 'doughnut',
            data: {
              labels: d.nets.map(function (n) { return n.name; }),
              datasets: [{ data: d.nets.map(function (n) { return n.count; }),
                backgroundColor: d.nets.map(function (n, i) { return netColor(n.key, i); }),
                borderColor: getVar(doc, '--bg2', '#0c1018'), borderWidth: 2 }]
            },
            options: baseOpts(doc, false, true)
          }));
        });
      } else {
        c2.appendChild(cssNet(doc, esc, d.nets));
        c2.appendChild(chartFallbackNote(doc));
      }
      grid.appendChild(c2);

      // (c) ticket revenue per event — bar (only if data exists)
      var revEvents = (d.tickets.events || []).filter(function (e) { return e.revenueCents != null && e.revenueCents > 0; });
      if (revEvents.length) {
        var c3 = el(doc, 'div', 'za-card span2');
        c3.appendChild(el(doc, 'h3', 'za-ch', 'Ticket revenue per event'));
        c3.appendChild(el(doc, 'p', 'za-csub', 'Paid ticket revenue, from tickets RPC (cents → USD).'));
        if (Chart) {
          var box3 = el(doc, 'div', 'za-can-box');
          var cv3 = el(doc, 'canvas');
          box3.appendChild(cv3); c3.appendChild(box3);
          queueChart(function () {
            state.charts.push(new Chart(cv3.getContext('2d'), {
              type: 'bar',
              data: {
                labels: revEvents.map(function (e) { return e.name; }),
                datasets: [{ label: 'Revenue (USD)', data: revEvents.map(function (e) { return e.revenueCents / 100; }),
                  backgroundColor: getVar(doc, '--gold', '#B8893B'), borderRadius: 6 }]
              },
              options: baseOpts(doc, true)
            }));
          });
        } else {
          c3.appendChild(cssRevenue(doc, esc, revEvents));
          c3.appendChild(chartFallbackNote(doc));
        }
        grid.appendChild(c3);
      }

      return grid;
    }

    // ---- honest gated engagement panel ----
    function renderGate(d) {
      var connected = !!(avail && avail.publish);
      var card = el(doc, 'div', 'za-gate');
      var badge = connected
        ? '<span class="za-badge green">Accounts connected</span>'
        : '<span class="za-badge gold">Locked</span>';
      card.innerHTML =
        '<h3><span class="za-lock"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>' +
        'Engagement analytics ' + badge + '</h3>';
      var p = el(doc, 'p');
      if (connected) {
        p.textContent = 'Your accounts are connected. Per-post reach, impressions, likes and follower ' +
          'growth will appear here once the provider APIs report them for your posts. We show provider-reported ' +
          'numbers only — Zoi never estimates or fabricates engagement metrics.';
      } else {
        p.textContent = 'Per-post reach, impressions, likes and follower growth require a connected provider ' +
          '(Meta, X, LinkedIn, TikTok, YouTube). These unlock when you connect your accounts. Until then we will ' +
          'not show any number we cannot verify — nothing here is estimated or invented.';
      }
      card.appendChild(p);
      var list = el(doc, 'div', 'za-locklist');
      ['Impressions', 'Reach', 'Likes / reactions', 'Comments', 'Shares', 'Follower growth', 'Click-through'].forEach(function (m) {
        var pill = el(doc, 'span', 'za-lockpill');
        pill.innerHTML = '<b>' + esc(m) + '</b> ' + (connected ? 'awaiting provider' : 'needs connection');
        list.appendChild(pill);
      });
      card.appendChild(list);
      return card;
    }

    // ---- full render ----
    function render(d, Chart) {
      destroyCharts();
      wrap.innerHTML = '';
      wrap.appendChild(renderHeader());

      // provenance note
      var provenance = [];
      if (!d.postsAvailable && !d.socialStats) provenance.push('social');
      if (d.tickets.revenueCents == null && d.tickets.paid == null) provenance.push('tickets');
      if (!d.community) provenance.push('community');
      var note = el(doc, 'p', 'za-note',
        'Figures below are real values returned by the backend for this workspace. ' +
        'Cards showing “—” have no data source connected yet' +
        (provenance.length ? ' (' + esc(provenance.join(', ')) + ' unavailable).' : '.'));
      wrap.appendChild(note);

      wrap.appendChild(renderKpis(d));
      wrap.appendChild(renderCharts(d, Chart));
      wrap.appendChild(renderGate(d));
    }

    // ---- controller ----
    async function load() {
      state.loading = true;
      state.error = null;
      renderLoading();
      var d;
      try {
        d = await fetchAll();
      } catch (e) {
        state.loading = false;
        renderError((e && e.message) || 'Failed to load analytics.');
        return;
      }
      state.data = d;
      state.loading = false;
      // Load Chart.js (best-effort). Never blocks a full render.
      var Chart = null;
      try { Chart = await loadChart(doc); } catch (e) { Chart = null; }
      render(d, Chart || null);
    }

    await load();
  }

  /* ---------- chart utility helpers ---------- */
  function queueChart(fn) {
    // Charts need the canvas in the DOM & laid out. Defer a tick.
    if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(fn);
    else setTimeout(fn, 0);
  }
  function getVar(doc, name, dflt) {
    try {
      var v = global.getComputedStyle(doc.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || dflt;
    } catch (e) { return dflt; }
  }
  function baseOpts(doc, showAxes, isPie) {
    var mut = getVar(doc, '--mut', '#8ea3b3');
    var line = getVar(doc, '--line', 'rgba(255,255,255,.12)');
    var o = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: mut, boxWidth: 12, font: { size: 11 } }, position: isPie ? 'bottom' : 'top' }
      }
    };
    if (showAxes) {
      o.scales = {
        x: { ticks: { color: mut, font: { size: 10 } }, grid: { color: line } },
        y: { beginAtZero: true, ticks: { color: mut, font: { size: 10 }, precision: 0 }, grid: { color: line } }
      };
    }
    return o;
  }
  function chartFallbackNote(doc) {
    return el(doc, 'p', 'za-note', 'Chart library unavailable — showing a lightweight bar view.');
  }
  function legend(doc, items) {
    var lg = el(doc, 'div', 'za-legend');
    items.forEach(function (it) {
      var s = el(doc, 'span');
      s.innerHTML = '<span class="za-dot" style="background:' + it[1] + '"></span>' + fallbackEsc(it[0]);
      lg.appendChild(s);
    });
    return lg;
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'analytics',
    label: 'Analytics',
    order: 30,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 13l3-3 3 3 5-5"/></svg>',
    mount: mountAnalytics
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

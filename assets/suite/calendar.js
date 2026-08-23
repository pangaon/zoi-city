/*!
 * calendar.js — Zoi Suite module: Content Calendar + Posting Queue
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'calendar'.
 * mountCalendar(root, ctx) renders the calendar into `root`.
 *   ctx = { C:ZoiCore, ws, channels:[], avail:{publish,...}, toast }
 *
 * THE ORTHODOX LAYER — the reason this calendar is not just another grid:
 *   - every cell carries its feast, name day and fasting strictness, computed
 *     from assets/suite/_orthocal.js (the Julian Paschalion, not typed dates);
 *   - "This week's opportunities": the coming feasts and name days, each with a
 *     one-click drafted post handed straight to the Composer;
 *   - dropping or scheduling a post onto a strict fast day asks first, and says
 *     why — a bakery promoting tyropita on Clean Monday is a real mistake;
 *   - a day's detail sheet shows the liturgical day next to that day's posts.
 *
 * Features:
 *   - Four views: MONTH grid, WEEK, LIST (upcoming), AGENDA (liturgical), with
 *     prev/next/Today nav and arrow-key navigation.
 *   - Search across post bodies; filter by status, network and campaign.
 *   - Undo on delete (the post is re-created from what we still hold).
 *   - Repost: duplicate a post forward by a week or a month in one click.
 *   - Fill the queue: drop every draft into the next free slots.
 *   - Status-coloured post chips (time + snippet + platform dots).
 *   - Click a chip -> detail modal: full body, networks, status, scheduled
 *     time; edit-time (reschedule), duplicate, delete.
 *   - Drag a chip to another day in MONTH view -> reschedule (keeps time-of-day).
 *     Touch / drag failure falls back to the edit-time modal.
 *   - Posting-queue manager (weekly grid of slot_list rows; add / remove slots).
 *   - Bulk CSV import with per-row validation preview and an honest result count.
 *   - Campaign filter built from distinct post.meta.campaign values.
 *   - Legend, empty states, and an honest "not connected yet" banner.
 *
 * RESCHEDULE CONTRACT (edit-time + drag): re-send the post's OWN body,
 *   channels, media, status, nameday and meta, with the NEW p_scheduled_at
 *   and the post's own p_id, via social_save_post.
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zk-styles';
  var VERSION = '1.1.0';

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CONFLICT_WINDOW_MIN = 30;

  /* ---------- shared libraries, without a build step ----------
   * Same pattern as composer.js: _orthocal.js and _schedule.js are classic
   * scripts next to this one, loaded from THIS script's own URL so it works on
   * any origin, cached per page, and entirely optional — if a library does not
   * load, the affected panel says so instead of rendering an empty box.
   */
  var SELF_DIR = (function () {
    try {
      var cs = global.document && global.document.currentScript;
      if (cs && cs.src) return String(cs.src).replace(/[^/]+$/, '');
    } catch (e) { /* no document (unit test) */ }
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
        if (tries++ > 120) return resolve(null);
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

  /* ---------- per-network config (colour + tiny icon) ---------- */
  var NET = {
    facebook:  { key: 'facebook',  name: 'Facebook',  color: '#1877F2',
      icon: '<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/>' },
    instagram: { key: 'instagram', name: 'Instagram', color: '#E4405F',
      icon: '<path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.26 2.2.43.6.22 1 .48 1.4.9.42.4.68.83.9 1.4.17.44.37 1.06.43 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.26 1.8-.43 2.2-.22.57-.48 1-.9 1.4-.4.42-.83.68-1.4.9-.44.17-1.06.37-2.2.43-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.26-2.2-.43a3.9 3.9 0 0 1-1.4-.9c-.42-.4-.68-.83-.9-1.4-.17-.44-.37-1.06-.43-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.26-1.8.43-2.2.22-.57.48-1 .9-1.4.4-.42.83-.68 1.4-.9.44-.17 1.06-.37 2.2-.43C8.4 2.2 8.8 2.2 12 2.2zm0 3.05A6.75 6.75 0 1 0 18.75 12 6.75 6.75 0 0 0 12 5.25zm0 11.14A4.39 4.39 0 1 1 16.39 12 4.39 4.39 0 0 1 12 16.39zm6.99-11.42a1.58 1.58 0 1 1-1.58-1.58 1.58 1.58 0 0 1 1.58 1.58z"/>' },
    x:         { key: 'x',         name: 'X',         color: '#c9d1d9',
      icon: '<path d="M17.5 3h3.1l-6.77 7.73L21.75 21H15.6l-4.82-6.3L5.28 21H2.17l7.24-8.27L2.25 3H8.5l4.36 5.77zM16.4 19.1h1.72L7.7 4.8H5.86z"/>' },
    twitter:   { key: 'x',         name: 'X',         color: '#c9d1d9',
      icon: '<path d="M17.5 3h3.1l-6.77 7.73L21.75 21H15.6l-4.82-6.3L5.28 21H2.17l7.24-8.27L2.25 3H8.5l4.36 5.77zM16.4 19.1h1.72L7.7 4.8H5.86z"/>' },
    linkedin:  { key: 'linkedin',  name: 'LinkedIn',  color: '#0A66C2',
      icon: '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.8 0 0 .78 0 1.74v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.76V1.74C24 .78 23.2 0 22.22 0z"/>' },
    tiktok:    { key: 'tiktok',    name: 'TikTok',    color: '#25F4EE',
      icon: '<path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.4a2.53 2.53 0 1 1-1.8-2.42V9.8a5.63 5.63 0 1 0 4.9 5.58V9.03a7.34 7.34 0 0 0 4.3 1.37V7.3a4.28 4.28 0 0 1-3.15-1.48z"/>' },
    youtube:   { key: 'youtube',   name: 'YouTube',   color: '#FF0000',
      icon: '<path d="M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 3.9 12 3.9 12 3.9s-7.5 0-9.4.5A3 3 0 0 0 .5 6.5 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.5zM9.6 15.6V8.4l6.2 3.6z"/>' }
  };

  var STATUS = {
    draft:     { label: 'Draft',     cls: 'draft' },
    scheduled: { label: 'Scheduled', cls: 'scheduled' },
    published: { label: 'Published', cls: 'published' },
    failed:    { label: 'Failed',    cls: 'failed' },
    error:     { label: 'Error',     cls: 'failed' }
  };

  /* ---------- helpers ---------- */
  function normPlat(p) {
    p = String(p || '').toLowerCase().trim();
    if (p === 'twitter') return 'x';
    return p;
  }
  function netFor(p) { return NET[normPlat(p)] || null; }
  function el(tag, cls, html) {
    var d = global.document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function statusClass(s) {
    var st = STATUS[String(s || '').toLowerCase()];
    return st ? st.cls : 'draft';
  }
  function statusLabel(s) {
    var st = STATUS[String(s || '').toLowerCase()];
    return st ? st.label : (s ? String(s) : 'Draft');
  }
  // Local YYYY-MM-DD key for a Date.
  function dayKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function sameDay(a, b) { return dayKey(a) === dayKey(b); }
  // Date a post is placed on: scheduled_at, else published_at, else created_at.
  function postDate(p) {
    var iso = p.scheduled_at || p.published_at || p.created_at;
    var d = iso ? new Date(iso) : null;
    return (d && !isNaN(d.getTime())) ? d : null;
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), 0, 0); }
  function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // For a <input type="datetime-local"> value (no timezone suffix).
  function toLocalInput(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fromLocalInput(v) {
    if (!v) return null;
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  function localTz() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz || 'local';
    } catch (e) { return 'local'; }
  }
  function channelList(p) {
    var c = p && p.channels;
    if (!c) return [];
    if (Array.isArray(c)) return c;
    return [];
  }
  function firstWords(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return s.length > n ? s.slice(0, n).replace(/\s\S*$/, '') + '…' : s;
  }

  /* ---------- styles ---------- */
  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var css = [
      '.zk-wrap{font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--tx);display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.zk-wrap *{box-sizing:border-box}',
      '.zk-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}',
      '.zk-bl,.zk-br{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.zk-seg{display:inline-flex;background:var(--bg3);border:1px solid var(--line);border-radius:24px;padding:3px}',
      '.zk-seg button{background:none;border:none;color:var(--mut);font:700 12.5px "Hanken Grotesk",system-ui;padding:7px 14px;border-radius:20px;cursor:pointer;transition:.15s}',
      '.zk-seg button.on{background:var(--acc);color:#06101f}',
      '.zk-nav{display:inline-flex;align-items:center;gap:4px}',
      '.zk-ic{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);cursor:pointer;transition:.15s}',
      '.zk-ic:hover{border-color:var(--acc);color:var(--acc)}',
      '.zk-ic svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zk-today{padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font:700 12.5px "Hanken Grotesk";cursor:pointer;transition:.15s}',
      '.zk-today:hover{border-color:var(--acc);color:var(--acc)}',
      '.zk-range{font-weight:800;font-size:16px;letter-spacing:.01em;min-width:150px}',
      '.zk-sel{background:var(--bg3);border:1px solid var(--line);border-radius:10px;color:var(--tx);font:600 12.5px "Hanken Grotesk";padding:8px 11px;cursor:pointer;max-width:200px}',
      '.zk-sel:focus{outline:none;border-color:var(--acc)}',
      '.zk-btn{padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font:700 12.5px "Hanken Grotesk";cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:7px}',
      '.zk-btn:hover{border-color:var(--acc);color:var(--acc)}',
      '.zk-btn.pri{background:var(--acc);border-color:var(--acc);color:#06101f}',
      '.zk-btn.pri:hover{color:#06101f;filter:brightness(1.05)}',
      '.zk-btn.gold{background:var(--gold);border-color:var(--gold);color:#1a1205}',
      '.zk-btn.danger{color:#e06a5a;border-color:rgba(224,106,90,.4)}',
      '.zk-btn.danger:hover{border-color:#e06a5a;color:#e06a5a}',
      '.zk-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zk-btn:disabled{opacity:.45;cursor:not-allowed}',
      /* banner + legend */
      '.zk-banner{font-size:12.5px;color:var(--gold);background:rgba(217,178,106,.08);border:1px solid rgba(217,178,106,.3);border-radius:10px;padding:9px 13px;line-height:1.4}',
      '.zk-legend{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:11.5px;color:var(--mut)}',
      '.zk-lg{display:inline-flex;align-items:center;gap:6px}',
      '.zk-dot{width:10px;height:10px;border-radius:3px;flex:none}',
      '.zk-dot.draft{background:#6b7280}',
      '.zk-dot.scheduled{background:var(--gold)}',
      '.zk-dot.published{background:var(--green)}',
      '.zk-dot.failed{background:#c0392b}',
      /* month grid */
      '.zk-grid{background:var(--bg2);border:1px solid var(--line);border-radius:14px;overflow:hidden}',
      '.zk-dow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--line)}',
      '.zk-dow div{padding:9px 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);text-align:left}',
      /* minmax(0,1fr) not 1fr: a bare 1fr is minmax(AUTO,1fr), so one long chip
         snippet widens its whole weekday column and, on a phone, pushes the last
         three days out of a grid that clips them. */
      '.zk-cells{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}',
      '.zk-cell{min-height:112px;border-right:1px solid var(--line2);border-bottom:1px solid var(--line2);padding:6px;display:flex;flex-direction:column;gap:4px;transition:.12s}',
      '.zk-cell:nth-child(7n){border-right:none}',
      '.zk-cell.oth{background:rgba(255,255,255,.012)}',
      '.zk-cell.oth .zk-daynum{color:var(--dim)}',
      '.zk-cell.today{background:rgba(110,168,255,.06)}',
      '.zk-cell.dragover{background:rgba(110,168,255,.14);box-shadow:inset 0 0 0 2px var(--acc)}',
      '.zk-daynum{font-size:12px;font-weight:700;color:var(--mut);display:flex;align-items:center;justify-content:space-between}',
      '.zk-cell.today .zk-daynum b{background:var(--acc);color:#06101f;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:11px}',
      /* week */
      '.zk-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}',
      '@media(max-width:760px){.zk-week{grid-template-columns:repeat(2,1fr)}}',
      '.zk-wcol{background:var(--bg2);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-height:150px}',
      '.zk-wcol.today{border-color:var(--acc)}',
      '.zk-whd{padding:8px 10px;border-bottom:1px solid var(--line2);text-align:center}',
      '.zk-whd .zk-wd{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}',
      '.zk-whd .zk-wn{font-size:17px;font-weight:800}',
      '.zk-wbody{padding:7px;display:flex;flex-direction:column;gap:5px;flex:1}',
      /* list */
      '.zk-list{display:flex;flex-direction:column;gap:6px}',
      '.zk-lday{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:12px 2px 2px;display:flex;align-items:center;gap:8px}',
      '.zk-lday .zk-tag2{font-weight:700;color:var(--dim);text-transform:none;letter-spacing:0}',
      '.zk-lrow{display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--line);border-left-width:3px;border-radius:11px;padding:10px 12px;cursor:pointer;transition:.12s}',
      '.zk-lrow:hover{border-color:var(--acc);border-left-color:var(--acc)}',
      '.zk-lrow.draft{border-left-color:#6b7280}',
      '.zk-lrow.scheduled{border-left-color:var(--gold)}',
      '.zk-lrow.published{border-left-color:var(--green)}',
      '.zk-lrow.failed{border-left-color:#c0392b}',
      '.zk-ltime{font:800 12.5px "Hanken Grotesk";color:var(--tx);width:52px;flex:none;font-variant-numeric:tabular-nums}',
      '.zk-lbody{flex:1;min-width:0;font-size:13px;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      /* chip */
      '.zk-chip{display:flex;align-items:center;gap:5px;background:var(--bg3);border:1px solid var(--line2);border-left:3px solid #6b7280;border-radius:7px;padding:3px 6px;cursor:pointer;font-size:11px;transition:.12s;user-select:none}',
      '.zk-chip:hover{border-color:var(--acc)}',
      '.zk-chip.dragging{opacity:.4}',
      '.zk-chip.draft{border-left-color:#6b7280}',
      '.zk-chip.scheduled{border-left-color:var(--gold)}',
      '.zk-chip.published{border-left-color:var(--green)}',
      '.zk-chip.failed{border-left-color:#c0392b}',
      '.zk-chip{min-width:0;overflow:hidden}',
      '.zk-chip .zk-ct{font-weight:800;color:var(--mut);flex:none;font-variant-numeric:tabular-nums}',
      '.zk-chip .zk-cx{color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}',
      '.zk-cdots{display:inline-flex;gap:2px;flex:none;align-items:center}',
      '.zk-cdots svg{width:11px;height:11px}',
      '.zk-cdot{width:11px;height:11px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}',
      '.zk-cdots svg path{fill:currentColor}',
      /* empty */
      '.zk-empty{color:var(--mut);font-size:12.5px;text-align:center;padding:34px 14px;border:1px dashed var(--line);border-radius:12px;background:var(--bg2)}',
      '.zk-wempty{color:var(--dim);font-size:10.5px;text-align:center;padding:6px 2px}',
      /* modal */
      '.zk-ov{position:fixed;inset:0;background:rgba(4,6,10,.66);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;z-index:9000;overflow:auto}',
      '.zk-modal{background:var(--bg2);border:1px solid var(--line);border-radius:16px;width:100%;max-width:560px;box-shadow:0 24px 70px rgba(0,0,0,.5)}',
      '.zk-modal.wide{max-width:760px}',
      '.zk-mh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 18px;border-bottom:1px solid var(--line2)}',
      '.zk-mh h3{margin:0;font-size:15.5px;font-weight:800;display:flex;align-items:center;gap:9px}',
      '.zk-mx{width:30px;height:30px;border-radius:9px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center}',
      '.zk-mx:hover{border-color:var(--acc);color:var(--acc)}',
      '.zk-mb{padding:16px 18px;display:flex;flex-direction:column;gap:14px;max-height:70vh;overflow:auto}',
      '.zk-mf{padding:13px 18px;border-top:1px solid var(--line2);display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}',
      '.zk-lab{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0 0 6px;display:block}',
      '.zk-badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:20px}',
      '.zk-badge.draft{background:rgba(107,114,128,.18);color:#c2c8d2}',
      '.zk-badge.scheduled{background:rgba(217,178,106,.16);color:var(--gold)}',
      '.zk-badge.published{background:rgba(46,139,87,.18);color:#7fd6a2}',
      '.zk-badge.failed{background:rgba(192,57,43,.2);color:#e88}',
      '.zk-body-full{background:var(--bg);border:1px solid var(--line);border-radius:11px;padding:12px 14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;max-height:220px;overflow:auto}',
      '.zk-nets{display:flex;flex-wrap:wrap;gap:7px}',
      '.zk-net{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:20px;background:var(--bg3);border:1px solid var(--line)}',
      '.zk-net svg{width:13px;height:13px}',
      '.zk-net svg path{fill:currentColor}',
      '.zk-in{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:10px;color:var(--tx);font:400 13.5px "Hanken Grotesk";padding:10px 12px}',
      '.zk-in:focus{outline:none;border-color:var(--acc)}',
      '.zk-ta{width:100%;min-height:120px;resize:vertical;background:var(--bg);border:1px solid var(--line);border-radius:10px;color:var(--tx);font:400 13px/1.5 "Hanken Grotesk";padding:10px 12px}',
      '.zk-ta:focus{outline:none;border-color:var(--acc)}',
      '.zk-meta{font-size:12px;color:var(--mut);display:flex;flex-wrap:wrap;gap:14px}',
      '.zk-meta b{color:var(--tx)}',
      /* queue grid */
      '.zk-qgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}',
      '@media(max-width:640px){.zk-qgrid{grid-template-columns:repeat(2,1fr)}}',
      '.zk-qcol{background:var(--bg);border:1px solid var(--line);border-radius:10px;overflow:hidden;min-height:90px;display:flex;flex-direction:column}',
      '.zk-qhd{padding:6px;text-align:center;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);border-bottom:1px solid var(--line2)}',
      '.zk-qbody{padding:5px;display:flex;flex-direction:column;gap:4px;flex:1}',
      '.zk-slot{display:flex;align-items:center;justify-content:space-between;gap:4px;background:var(--bg3);border:1px solid var(--line2);border-radius:7px;padding:4px 7px;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.zk-slot button{background:none;border:none;color:var(--mut);cursor:pointer;font-size:13px;line-height:1;padding:0 2px}',
      '.zk-slot button:hover{color:#e06a5a}',
      '.zk-qempty{font-size:10px;color:var(--dim);text-align:center;padding:4px}',
      '.zk-add{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}',
      '.zk-add .zk-fld{flex:1;min-width:110px}',
      /* csv */
      '.zk-prev{border:1px solid var(--line);border-radius:10px;overflow:auto;max-height:300px}',
      '.zk-prev table{border-collapse:collapse;width:100%;font-size:12px}',
      '.zk-prev th,.zk-prev td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line2);white-space:nowrap;max-width:230px;overflow:hidden;text-overflow:ellipsis}',
      '.zk-prev th{position:sticky;top:0;background:var(--bg3);color:var(--mut);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;z-index:1}',
      '.zk-prev tr.bad td{background:rgba(192,57,43,.09)}',
      '.zk-err{color:#e88;font-size:11px}',
      '.zk-ok{color:#7fd6a2;font-size:11px}',
      '.zk-hint{font-size:11.5px;color:var(--mut);line-height:1.45}',
      '.zk-count{font-size:12px;font-weight:700;color:var(--mut);margin-right:auto}',
      /* ---- search + filters ---- */
      '.zk-search{display:inline-flex;align-items:center;gap:7px;background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:0 10px}',
      '.zk-search:focus-within{border-color:var(--acc)}',
      '.zk-search svg{width:14px;height:14px;fill:none;stroke:var(--mut);stroke-width:2;flex:none}',
      '.zk-search input{background:none;border:none;outline:none;color:var(--tx);font:600 12.5px "Hanken Grotesk";padding:8px 0;width:150px}',
      '.zk-search button{background:none;border:none;color:var(--mut);cursor:pointer;font-size:15px;line-height:1;padding:0 2px}',
      '.zk-search button:hover{color:var(--tx)}',
      '.zk-toggle{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--mut);background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:7px 11px;cursor:pointer}',
      '.zk-toggle.on{color:var(--gold);border-color:color-mix(in srgb,var(--gold) 45%,transparent)}',
      /* ---- the Orthodox layer in the grid ---- */
      '.zk-cell.fast-strict{background:color-mix(in srgb,var(--red) 7%,transparent)}',
      '.zk-cell.fast-fast{background:color-mix(in srgb,var(--gold) 5%,transparent)}',
      '.zk-cell.feast{box-shadow:inset 3px 0 0 var(--gold)}',
      '.zk-cell.today.fast-strict{background:color-mix(in srgb,var(--red) 10%,transparent)}',
      '.zk-oday{font-size:9.5px;line-height:1.25;color:var(--mut);display:flex;flex-direction:column;gap:1px;margin:-1px 0 2px}',
      '.zk-oday b{font-weight:800;color:var(--gold);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}',
      '.zk-oday i{font-style:normal;color:var(--acc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}',
      '.zk-fmark{font-size:8.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:1px 5px;border-radius:20px;border:1px solid currentColor;white-space:nowrap}',
      '.zk-fmark.strict{color:var(--red)}',
      '.zk-fmark.fast{color:var(--gold)}',
      '.zk-fmark.dairy{color:var(--acc)}',
      '.zk-fmark.none{color:var(--green)}',
      '.zk-wo{padding:5px 8px;border-bottom:1px solid var(--line2);font-size:9.5px;line-height:1.3;color:var(--mut)}',
      '.zk-wo b{display:block;color:var(--gold);font-weight:800}',
      '.zk-wo i{font-style:normal;color:var(--acc)}',
      /* ---- agenda view ---- */
      '.zk-ag{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,320px);gap:14px;align-items:start}',
      '@media(max-width:900px){.zk-ag{grid-template-columns:1fr}}',
      '.zk-agcol{display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.zk-agday{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;display:flex;flex-direction:column;gap:8px}',
      '.zk-agday.strict{border-color:color-mix(in srgb,var(--red) 40%,transparent)}',
      '.zk-agday.feast{border-color:color-mix(in srgb,var(--gold) 45%,transparent)}',
      '.zk-agh{display:flex;flex-wrap:wrap;gap:9px;align-items:baseline}',
      '.zk-agh .zk-agd{font-weight:800;font-size:14px}',
      '.zk-agh .zk-agw{font-size:11.5px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.05em}',
      '.zk-agmeta{display:flex;flex-wrap:wrap;gap:7px;align-items:center}',
      '.zk-side{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:14px}',
      '.zk-side h4{margin:0 0 4px;font-size:13.5px;font-weight:800}',
      '.zk-opp{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:11px;padding:9px 11px;background:var(--bg3);margin-top:8px}',
      '.zk-opp .zk-od{flex:none;width:40px;text-align:center}',
      '.zk-opp .zk-od i{display:block;font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--mut)}',
      '.zk-opp .zk-od b{display:block;font-size:17px;font-weight:800;line-height:1.1}',
      '.zk-opp.great .zk-od b{color:var(--gold)}',
      '.zk-opp .zk-ob{flex:1;min-width:0}',
      '.zk-opp .zk-ot{font-size:12px;font-weight:700;line-height:1.35}',
      '.zk-opp .zk-os{font-size:10.5px;color:var(--mut);margin-top:2px}',
      /* ---- undo bar ---- */
      '.zk-undo{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--tx);background:color-mix(in srgb,var(--acc) 10%,transparent);border:1px solid color-mix(in srgb,var(--acc) 40%,transparent);border-radius:11px;padding:9px 13px}',
      '.zk-warnbox{font-size:12.5px;line-height:1.5;color:var(--red);background:color-mix(in srgb,var(--red) 10%,transparent);border:1px solid color-mix(in srgb,var(--red) 40%,transparent);border-radius:11px;padding:10px 13px}',
      '.zk-fastnote{font-size:12px;line-height:1.5;color:var(--gold);background:color-mix(in srgb,var(--gold) 10%,transparent);border:1px solid color-mix(in srgb,var(--gold) 38%,transparent);border-radius:11px;padding:10px 13px}',
      '.zk-wrap button:focus-visible,.zk-wrap input:focus-visible,.zk-wrap select:focus-visible,.zk-wrap [tabindex]:focus-visible{outline:2px solid var(--acc);outline-offset:2px}',
      /* On a narrow phone a seven-column month is 50px per day: enough for the
         time and the network dots, not for a snippet or a feast name. Those move
         to the day sheet (tap the cell) rather than being clipped. */
      '@media(max-width:680px){',
      '  .zk-cell{min-height:74px;padding:4px 3px}',
      '  .zk-cell .zk-cx{display:none}',
      '  .zk-oday{display:none}',
      '  .zk-chip{padding:2px 3px;gap:3px;font-size:10px}',
      '  .zk-dow div{padding:7px 3px;font-size:9.5px}',
      '  .zk-fmark{font-size:7.5px;padding:0 3px}',
      '  .zk-daynum{font-size:11px}',
      '}',
      '@media(prefers-reduced-motion:reduce){.zk-wrap *{transition:none!important}}'
    ].join('\n');
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ---------- tiny platform dots ---------- */
  function platDotsHTML(esc, channels) {
    var seen = {};
    var out = '';
    channels.forEach(function (c) {
      var n = netFor(c);
      if (!n) {
        // unknown network -> generic grey dot with a title
        var lbl = esc(String(c));
        out += '<span class="zk-cdot" title="' + lbl + '" style="background:#4b5563"></span>';
        return;
      }
      if (seen[n.key]) return;
      seen[n.key] = true;
      out += '<svg viewBox="0 0 24 24" title="' + esc(n.name) + '" style="color:' + n.color + '">' + n.icon + '</svg>';
    });
    return '<span class="zk-cdots">' + out + '</span>';
  }

  /* ================= MOUNT ================= */
  async function mountCalendar(root, ctx) {
    var doc = root.ownerDocument || global.document;
    var C = ctx.C;
    var esc = C.esc;
    var toast = ctx.toast || (C && C.toast) || function () {};
    var relTime = (C && C.relTime) || function () { return ''; };
    injectStyle(doc);

    var state = {
      view: 'month',          // 'month' | 'week' | 'list' | 'agenda'
      cursor: startOfDay(new Date()),
      posts: [],
      slots: [],
      campaign: '',           // '' = all
      query: '',              // free-text search over bodies
      status: '',             // '' = all
      network: '',            // '' = all
      showOrthodox: true,     // the liturgical layer, on by default
      dragId: null,
      loading: false,
      error: null,
      O: null,                // ZoiOrthocal once loaded
      S: null,                // ZoiSchedule once loaded
      lastDeleted: null       // { post, at } — powers Undo
    };
    try {
      var pref = global.localStorage && global.localStorage.getItem('zoi_cal_orthodox');
      if (pref === '0') state.showOrthodox = false;
    } catch (e) { /* private mode — default stands */ }

    root.innerHTML = '';
    var wrap = el('div', 'zk-wrap');
    root.appendChild(wrap);

    // toolbar
    var bar = el('div', 'zk-bar');
    bar.innerHTML =
      '<div class="zk-bl">' +
        '<div class="zk-seg" data-role="seg" role="tablist" aria-label="Calendar view">' +
          '<button data-view="month" class="on" aria-pressed="true">Month</button>' +
          '<button data-view="week" aria-pressed="false">Week</button>' +
          '<button data-view="list" aria-pressed="false">List</button>' +
          '<button data-view="agenda" aria-pressed="false">Agenda</button>' +
        '</div>' +
        '<div class="zk-nav">' +
          '<button class="zk-ic" data-role="prev" title="Previous"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>' +
          '<button class="zk-today" data-role="today">Today</button>' +
          '<button class="zk-ic" data-role="next" title="Next"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>' +
        '</div>' +
        '<span class="zk-range" data-role="range"></span>' +
      '</div>' +
      '<div class="zk-br">' +
        '<label class="zk-search">' +
          '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
          '<input type="search" data-role="q" placeholder="Search posts…" aria-label="Search posts">' +
          '<button type="button" data-role="qclear" aria-label="Clear search" title="Clear search">×</button>' +
        '</label>' +
        '<select class="zk-sel" data-role="status" title="Filter by status" aria-label="Filter by status">' +
          '<option value="">Any status</option><option value="draft">Draft</option>' +
          '<option value="scheduled">Scheduled</option><option value="published">Published</option>' +
          '<option value="failed">Failed</option></select>' +
        '<select class="zk-sel" data-role="network" title="Filter by network" aria-label="Filter by network"></select>' +
        '<select class="zk-sel" data-role="campaign" title="Filter by campaign" aria-label="Filter by campaign"></select>' +
        '<button class="zk-toggle" data-role="orth" aria-pressed="true" title="Show feasts, name days and fasting periods">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M7 7h10M9 21h6"/></svg>Orthodox calendar</button>' +
        '<button class="zk-btn" data-role="fill" title="Put every draft into the next free queue slots"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h7"/></svg>Fill queue</button>' +
        '<button class="zk-btn" data-role="queue"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>Posting queue</button>' +
        '<button class="zk-btn" data-role="import"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>Import CSV</button>' +
      '</div>';
    wrap.appendChild(bar);

    // publish banner
    if (!ctx.avail || !ctx.avail.publish) {
      var banner = el('div', 'zk-banner',
        'Scheduling works now; posts publish once your accounts are connected.');
      wrap.appendChild(banner);
    }

    // legend
    var legend = el('div', 'zk-legend',
      '<span class="zk-lg"><span class="zk-dot draft"></span>Draft</span>' +
      '<span class="zk-lg"><span class="zk-dot scheduled"></span>Scheduled</span>' +
      '<span class="zk-lg"><span class="zk-dot published"></span>Published</span>' +
      '<span class="zk-lg"><span class="zk-dot failed"></span>Failed</span>' +
      '<span class="zk-lg"><span class="zk-fmark strict">strict fast</span></span>' +
      '<span class="zk-lg"><span class="zk-fmark fast">fast</span></span>' +
      '<span class="zk-lg" style="color:var(--gold)">✦ great feast</span>' +
      '<span class="zk-lg" style="color:var(--dim)">Drag a chip to another day to reschedule. ← → moves, T is today.</span>');
    wrap.appendChild(legend);

    // undo bar (only visible after a delete)
    var undoBox = el('div');
    wrap.appendChild(undoBox);

    // view container
    var viewBox = el('div');
    wrap.appendChild(viewBox);

    /* ---------- query helper ---------- */
    function q(role, scope) { return (scope || root).querySelector('[data-role="' + role + '"]'); }

    /* ---------- range for current view ---------- */
    function rangeForView() {
      var c = state.cursor;
      if (state.view === 'month') {
        var first = new Date(c.getFullYear(), c.getMonth(), 1);
        var gridStart = addDays(first, -first.getDay());
        var gridEnd = addDays(gridStart, 42); // exclusive
        return { from: gridStart, to: gridEnd };
      }
      if (state.view === 'week') {
        var ws = addDays(c, -c.getDay());
        return { from: startOfDay(ws), to: addDays(startOfDay(ws), 7) };
      }
      if (state.view === 'agenda') {
        // agenda reads forward from the cursor — it is a planning view
        var a = startOfDay(state.cursor);
        return { from: a, to: addDays(a, 28) };
      }
      // list: upcoming — from start of today, open-ended (fetch a broad window)
      var today = startOfDay(new Date());
      return { from: today, to: addDays(today, 120) };
    }

    function rangeLabel() {
      var c = state.cursor;
      if (state.view === 'month') return MONTHS[c.getMonth()] + ' ' + c.getFullYear();
      if (state.view === 'week') {
        var ws = addDays(c, -c.getDay());
        var we = addDays(ws, 6);
        var l = MONTHS_SHORT[ws.getMonth()] + ' ' + ws.getDate() + ' – ';
        l += (ws.getMonth() === we.getMonth() ? '' : MONTHS_SHORT[we.getMonth()] + ' ') + we.getDate() + ', ' + we.getFullYear();
        return l;
      }
      if (state.view === 'agenda') {
        var a = startOfDay(state.cursor);
        var b = addDays(a, 27);
        return MONTHS_SHORT[a.getMonth()] + ' ' + a.getDate() + ' – ' + MONTHS_SHORT[b.getMonth()] + ' ' + b.getDate();
      }
      return 'Upcoming';
    }

    /* ---------- data loads ---------- */
    async function loadPosts() {
      var r = rangeForView();
      state.loading = true;
      state.error = null;
      try {
        var rows = await C.api.rpc('social_list_posts', {
          p_workspace: ctx.ws,
          p_from: r.from ? r.from.toISOString() : null,
          p_to: r.to ? r.to.toISOString() : null
        }, { auth: 'prefer' });
        state.posts = Array.isArray(rows) ? rows : [];
      } catch (e) {
        state.posts = [];
        state.error = (e && e.message) ? e.message : 'The request failed.';
      }
      state.loading = false;
    }
    async function loadSlots() {
      try {
        var rows = await C.api.rpc('slot_list', { p_workspace: ctx.ws }, { auth: 'prefer' });
        state.slots = Array.isArray(rows) ? rows : [];
      } catch (e) { state.slots = []; }
    }

    /* ---------- campaign filter ---------- */
    function distinctCampaigns() {
      var set = {}, out = [];
      state.posts.forEach(function (p) {
        var cm = p && p.meta && p.meta.campaign;
        cm = cm == null ? '' : String(cm).trim();
        if (cm && !set[cm]) { set[cm] = true; out.push(cm); }
      });
      out.sort();
      return out;
    }
    function renderCampaignFilter() {
      var sel = q('campaign');
      var cur = state.campaign;
      var opts = '<option value="">All campaigns</option>';
      var list = distinctCampaigns();
      // keep the active filter selectable even if it scrolled out of range
      if (cur && list.indexOf(cur) === -1) list.push(cur);
      list.forEach(function (cm) {
        opts += '<option value="' + esc(cm) + '"' + (cm === cur ? ' selected' : '') + '>' + esc(cm) + '</option>';
      });
      sel.innerHTML = opts;
    }
    /* Every filter in one place. An empty filter is not a filter — a post is
     * shown unless something explicitly excludes it. */
    function filteredPosts() {
      var qy = String(state.query || '').trim().toLowerCase();
      return state.posts.filter(function (p) {
        if (!p) return false;
        if (state.campaign && String((p.meta && p.meta.campaign) || '').trim() !== state.campaign) return false;
        if (state.status && String(p.status || '').toLowerCase() !== state.status) return false;
        if (state.network) {
          var nets = channelList(p).map(function (c) { return normPlat(platformOf(c)); });
          if (nets.indexOf(state.network) === -1) return false;
        }
        if (qy) {
          var hay = (String(p.body || '') + ' ' + String((p.meta && p.meta.campaign) || '')).toLowerCase();
          if (hay.indexOf(qy) === -1) return false;
        }
        return true;
      });
    }
    /* A post's channels may be platform names or channel ids. Map an id back to
     * its platform through ctx.channels so the network filter works either way. */
    function platformOf(c) {
      var key = String(c == null ? '' : c);
      if (NET[normPlat(key)]) return key;
      var list = ctx.channels || [];
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === key) return list[i].platform;
      }
      return key;
    }
    function renderNetworkFilter() {
      var sel = q('network');
      if (!sel) return;
      var present = {};
      state.posts.forEach(function (p) {
        channelList(p).forEach(function (c) {
          var k = normPlat(platformOf(c));
          if (NET[k]) present[k] = true;
        });
      });
      var keys = Object.keys(present).sort();
      var opts = '<option value="">Any network</option>';
      keys.forEach(function (k) {
        opts += '<option value="' + esc(k) + '"' + (k === state.network ? ' selected' : '') + '>' + esc(NET[k].name) + '</option>';
      });
      sel.innerHTML = opts;
      sel.disabled = keys.length === 0;
    }

    /* ================= THE ORTHODOX LAYER ================= */
    function dayInfoFor(date) {
      if (!state.O || !state.showOrthodox) return null;
      try { return state.O.dayInfo(dayKey(date)); } catch (e) { return null; }
    }
    function fastMarkHTML(info) {
      if (!info) return '';
      var lvl = info.fast.level;
      if (lvl === 'none' && !info.feasts.length) return '';
      var cls = lvl === 'strict' ? 'strict' : lvl === 'fast' ? 'fast' : lvl === 'dairy' ? 'dairy' : 'none';
      var label = lvl === 'strict' ? 'strict' : lvl === 'fast' ? 'fast' : lvl === 'dairy' ? 'dairy' : 'free';
      return '<span class="zk-fmark ' + cls + '" title="' + esc(info.fast.label + (info.fast.why ? ' — ' + info.fast.why : '')) + '">' + label + '</span>';
    }
    function orthoLinesHTML(info) {
      if (!info) return '';
      var out = '';
      if (info.feasts.length) {
        var f = info.feasts[0];
        out += '<b title="' + esc(info.feasts.map(function (x) { return x.name; }).join(' · ')) + '">' +
          (f.great ? '✦ ' : '') + esc(f.name) + '</b>';
      }
      if (info.namedays.length) {
        out += '<i title="Name day: ' + esc(info.namedays.join(', ')) + '">' + esc(info.namedays.slice(0, 2).join(', ')) + '</i>';
      }
      return out ? '<div class="zk-oday">' + out + '</div>' : '';
    }
    /* Ask before putting a promotion on a strict fast day, and say why. Returns
     * true to proceed. Only strict days interrupt — warning on every Wednesday
     * would teach people to click through warnings. */
    function confirmFastDay(post, target) {
      if (!state.O) return true;
      var key = dayKey(target);
      var info = state.O.dayInfo(key);
      var clash = state.O.fastConflict(String(post && post.body || ''), key);
      if (clash && clash.level === 'strict') {
        return !global.confirm || global.confirm(
          clash.label + '\n\nThis post mentions ' + clash.words.slice(0, 4).join(', ') + '.\n' +
          clash.why + '\n\nConsider ' + clash.suggest + '.\n\nMove it here anyway?');
      }
      if (info.fast.level === 'strict') {
        return !global.confirm || global.confirm(
          info.fast.label + '\n\n' + info.fast.why + '\n\nSchedule here anyway?');
      }
      return true;
    }
    function postsForDay(date) {
      return filteredPosts().filter(function (p) {
        var d = postDate(p);
        return d && sameDay(d, date);
      }).sort(function (a, b) {
        var da = postDate(a), db = postDate(b);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
      });
    }

    /* ---------- chip ---------- */
    function makeChip(post) {
      var d = postDate(post);
      var chip = el('div', 'zk-chip ' + statusClass(post.status));
      chip.setAttribute('draggable', 'true');
      chip.setAttribute('data-id', String(post.id));
      var snippet = firstWords(post.body || '(no text)', 30);
      chip.innerHTML =
        '<span class="zk-ct">' + (d ? esc(hhmm(d)) : '--:--') + '</span>' +
        '<span class="zk-cx">' + esc(snippet) + '</span>' +
        platDotsHTML(esc, channelList(post));
      chip.addEventListener('click', function () { openDetail(post); });
      chip.addEventListener('dragstart', function (ev) {
        state.dragId = post.id;
        chip.classList.add('dragging');
        try {
          ev.dataTransfer.setData('text/plain', String(post.id));
          ev.dataTransfer.effectAllowed = 'move';
        } catch (e) { /* older browsers */ }
      });
      chip.addEventListener('dragend', function () {
        chip.classList.remove('dragging');
        state.dragId = null;
      });
      return chip;
    }

    /* ---------- render dispatch ---------- */
    function render() {
      q('range').textContent = rangeLabel();
      renderCampaignFilter();
      renderNetworkFilter();
      renderUndoBar();
      viewBox.innerHTML = '';
      if (state.error) {
        var err = el('div', 'zk-warnbox');
        err.innerHTML = '<b>Could not load your posts.</b> ' + esc(state.error) + ' ';
        var retry = el('button', 'zk-btn');
        retry.textContent = 'Try again';
        retry.style.marginLeft = '8px';
        retry.addEventListener('click', function () { reloadAndRender(); });
        err.appendChild(retry);
        viewBox.appendChild(err);
        return;
      }
      if (state.loading && !state.posts.length) {
        viewBox.appendChild(el('div', 'zk-empty', 'Loading your calendar…'));
        return;
      }
      if (state.view === 'month') viewBox.appendChild(renderMonth());
      else if (state.view === 'week') viewBox.appendChild(renderWeek());
      else if (state.view === 'agenda') viewBox.appendChild(renderAgenda());
      else viewBox.appendChild(renderList());
      var active = filteredPosts().length;
      if (active === 0 && state.posts.length && (state.query || state.status || state.network || state.campaign)) {
        var none = el('div', 'zk-empty', 'No post matches these filters. ');
        var clear = el('button', 'zk-btn');
        clear.textContent = 'Clear filters';
        clear.addEventListener('click', function () {
          state.query = ''; state.status = ''; state.network = ''; state.campaign = '';
          if (q('q')) q('q').value = '';
          if (q('status')) q('status').value = '';
          render();
        });
        none.appendChild(clear);
        viewBox.insertBefore(none, viewBox.firstChild);
      }
    }

    /* ---------- AGENDA: the liturgical planning view ---------- */
    function renderAgenda() {
      var box = el('div', 'zk-ag');
      var main = el('div', 'zk-agcol');
      var side = el('div', 'zk-agcol');
      var start = startOfDay(state.cursor);
      var shown = 0;
      for (var i = 0; i < 28; i++) {
        var day = addDays(start, i);
        var ps = postsForDay(day);
        var info = dayInfoFor(day);
        var interesting = ps.length || (info && (info.feasts.length || info.namedays.length || info.fast.level === 'strict'));
        if (!interesting) continue;
        shown++;
        var cls = 'zk-agday';
        if (info && info.fast.level === 'strict') cls += ' strict';
        if (info && info.feasts.some(function (f) { return f.great; })) cls += ' feast';
        var card = el('div', cls);
        var head = el('div', 'zk-agh');
        head.innerHTML = '<span class="zk-agd">' + MONTHS_SHORT[day.getMonth()] + ' ' + day.getDate() + '</span>' +
          '<span class="zk-agw">' + WEEKDAYS_FULL[day.getDay()] + '</span>' +
          (sameDay(day, startOfDay(new Date())) ? '<span class="zk-badge scheduled">Today</span>' : '');
        card.appendChild(head);
        if (info && (info.feasts.length || info.namedays.length || info.fast.level !== 'none')) {
          var meta = el('div', 'zk-agmeta');
          var h = fastMarkHTML(info);
          info.feasts.forEach(function (f) {
            h += '<span class="zk-net" style="' + (f.great ? 'color:var(--gold);' : '') + '">' + (f.great ? '✦ ' : '') + esc(f.name) + '</span>';
          });
          if (info.namedays.length) {
            h += '<span class="zk-net" style="color:var(--acc)">Name day: ' + esc(info.namedays.join(', ')) + '</span>';
          }
          meta.innerHTML = h;
          card.appendChild(meta);
        }
        if (ps.length) {
          var list = el('div', 'zk-list');
          ps.forEach(function (p2) {
            var d2 = postDate(p2);
            var row = el('div', 'zk-lrow ' + statusClass(p2.status));
            row.innerHTML =
              '<span class="zk-ltime">' + esc(d2 ? hhmm(d2) : '--:--') + '</span>' +
              '<span class="zk-lbody">' + esc(firstWords(p2.body || '(no text)', 80)) + '</span>' +
              platDotsHTML(esc, channelList(p2)) +
              '<span class="zk-badge ' + statusClass(p2.status) + '" style="flex:none">' + esc(statusLabel(p2.status)) + '</span>';
            row.addEventListener('click', function () { openDetail(p2); });
            list.appendChild(row);
          });
          card.appendChild(list);
        } else {
          var empty = el('div', 'zk-hint', 'Nothing scheduled.');
          var add = el('button', 'zk-btn');
          add.textContent = 'Draft something';
          add.style.marginTop = '6px';
          var theDay = day;
          add.addEventListener('click', function () { draftForDay(theDay); });
          card.appendChild(empty);
          card.appendChild(add);
        }
        main.appendChild(card);
      }
      if (!shown) {
        main.appendChild(el('div', 'zk-empty', 'Nothing scheduled and no feast in the next four weeks from here.'));
      }
      box.appendChild(main);
      side.appendChild(renderOppsPanel());
      side.appendChild(renderQueuePanel());
      box.appendChild(side);
      return box;
    }

    /* ---------- opportunities panel ---------- */
    function renderOppsPanel() {
      var card = el('div', 'zk-side');
      card.innerHTML = '<h4>This week&rsquo;s opportunities</h4>' +
        '<p class="zk-hint">Feasts and name days in the next seven days, computed from the Paschalion. One click drafts the post.</p>';
      if (!state.O) {
        card.appendChild(el('div', 'zk-empty', 'The liturgical calendar could not be loaded, so opportunities are unavailable for this session.'));
        return card;
      }
      var ops = state.O.opportunities(dayKey(startOfDay(new Date())), 7, { business: wsName() });
      if (!ops.length) {
        card.appendChild(el('div', 'zk-empty', 'No feast or name day in the next seven days.'));
        return card;
      }
      ops.forEach(function (op) {
        var parts = op.date.split('-');
        var row = el('div', 'zk-opp' + (op.kind === 'great_feast' ? ' great' : ''));
        var away = op.daysAway === 0 ? 'today' : op.daysAway === 1 ? 'tomorrow' : 'in ' + op.daysAway + ' days';
        row.innerHTML =
          '<div class="zk-od"><i>' + esc(MONTHS_SHORT[Number(parts[1]) - 1]) + '</i><b>' + esc(String(Number(parts[2]))) + '</b></div>' +
          '<div class="zk-ob"><div class="zk-ot">' + (op.kind === 'great_feast' ? '✦ ' : '') + esc(op.headline) + '</div>' +
          '<div class="zk-os">' + esc(away) + (op.fast.level !== 'none' ? ' · ' + esc(op.fast.label) : '') + '</div></div>';
        var b = el('button', 'zk-btn');
        b.textContent = 'Draft';
        b.addEventListener('click', function () {
          gotoComposer({ body: op.draft, scheduledAt: op.date + 'T10:00' });
        });
        row.appendChild(b);
        card.appendChild(row);
      });
      return card;
    }

    /* ---------- queue health panel: real slots, real posts ---------- */
    function renderQueuePanel() {
      var card = el('div', 'zk-side');
      card.style.marginTop = '12px';
      var act = state.S ? state.S.activeSlots(state.slots) : (state.slots || []);
      card.innerHTML = '<h4>Queue</h4>';
      if (!act.length) {
        card.innerHTML += '<p class="zk-hint">No posting-time slots yet. Slots are recurring weekly times; once they exist, the Composer offers the next free one and “Fill queue” can place your drafts.</p>';
        var b = el('button', 'zk-btn');
        b.textContent = 'Set up the queue';
        b.addEventListener('click', openQueue);
        card.appendChild(b);
        return card;
      }
      var open = state.S ? state.S.nextOpenSlotTimes(state.slots, state.posts, new Date(), 4) : [];
      var drafts = state.posts.filter(function (p) { return String(p.status || '').toLowerCase() === 'draft'; });
      card.innerHTML += '<p class="zk-hint">' + act.length + ' slot' + (act.length === 1 ? '' : 's') + ' a week · ' +
        drafts.length + ' draft' + (drafts.length === 1 ? '' : 's') + ' waiting.</p>';
      if (open.length) {
        var ul = el('div', 'zk-list');
        open.forEach(function (o) {
          var row = el('div', 'zk-lrow scheduled');
          row.innerHTML = '<span class="zk-ltime">' + esc(hhmm(o.when)) + '</span>' +
            '<span class="zk-lbody">' + esc(WEEKDAYS_FULL[o.when.getDay()] + ' ' + MONTHS_SHORT[o.when.getMonth()] + ' ' + o.when.getDate()) + '</span>' +
            '<span class="zk-badge draft" style="flex:none">free</span>';
          row.addEventListener('click', function () {
            gotoComposer({ scheduledAt: toLocalInput(o.when) });
          });
          ul.appendChild(row);
        });
        card.appendChild(ul);
      } else {
        card.appendChild(el('div', 'zk-hint', 'Every slot in the next few weeks is taken.'));
      }
      return card;
    }

    function wsName() {
      try {
        var n = ctx.wsName || (ctx.workspace && ctx.workspace.name);
        if (n) return String(n);
        var e2 = doc.querySelector('.wsname');
        return e2 ? String(e2.textContent || '').trim() : '';
      } catch (e) { return ''; }
    }

    /* ---------- hand a draft to the Composer ----------
     * The suite mounts one module at a time in one page, so the draft goes
     * through localStorage and we click the shell's own nav item. If either is
     * unavailable the user is told where the draft went — never a silent no-op. */
    function gotoComposer(payload) {
      var stored = state.S ? state.S.setHandoff(payload) : false;
      if (!stored) { toast('Storage is unavailable, so the draft could not be handed over.'); return; }
      var nav = doc.querySelector('.nitem[data-id="composer"]');
      if (nav && nav.click) { nav.click(); return; }
      toast('Draft saved — open the Composer to finish it.');
    }
    function draftForDay(day) {
      var body = '';
      if (state.O) {
        var info = state.O.dayInfo(dayKey(day));
        body = state.O.suggestDraft(info, wsName()) || '';
      }
      gotoComposer({ body: body, scheduledAt: toLocalInput(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0)) });
    }

    /* ---------- undo bar ---------- */
    function renderUndoBar() {
      undoBox.innerHTML = '';
      if (!state.lastDeleted) return;
      var p = state.lastDeleted.post;
      var bar = el('div', 'zk-undo');
      bar.innerHTML = '<span>Deleted &ldquo;' + esc(firstWords(p.body || '(no text)', 48)) + '&rdquo;.</span>';
      var acts = el('div');
      acts.style.display = 'flex';
      acts.style.gap = '8px';
      var undo = el('button', 'zk-btn pri');
      undo.textContent = 'Undo';
      undo.addEventListener('click', async function () {
        undo.disabled = true;
        try {
          await C.api.rpc('social_save_post', {
            p_workspace: ctx.ws,
            p_body: p.body || '',
            p_channels: channelList(p),
            p_scheduled_at: p.scheduled_at || null,
            p_status: p.status || 'draft',
            p_media: p.media || [],
            p_nameday: p.nameday_ref || null,
            p_meta: p.meta || {},
            p_id: null                    // a restored post is a new row
          }, { auth: 'require' });
          state.lastDeleted = null;
          toast('Post restored — it comes back with a new id.');
          await reloadAndRender();
        } catch (e) {
          undo.disabled = false;
          toast((e && e.message) || 'Could not restore the post.');
        }
      });
      var dismiss = el('button', 'zk-btn');
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', function () { state.lastDeleted = null; renderUndoBar(); });
      acts.appendChild(undo);
      acts.appendChild(dismiss);
      bar.appendChild(acts);
      undoBox.appendChild(bar);
    }

    /* ---------- day sheet: the liturgical day beside that day's posts ---------- */
    function openDay(day) {
      var key = dayKey(day);
      var info = state.O && state.showOrthodox ? state.O.dayInfo(key) : null;
      var m = openModal(WEEKDAYS_FULL[day.getDay()] + ', ' + MONTHS_SHORT[day.getMonth()] + ' ' + day.getDate() + ' ' + day.getFullYear(),
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>', false);
      var html = '';
      if (info) {
        html += '<div><span class="zk-lab">The day</span><div class="zk-agmeta">' + fastMarkHTML(info);
        info.feasts.forEach(function (f) {
          html += '<span class="zk-net" style="' + (f.great ? 'color:var(--gold);' : '') + '">' + (f.great ? '✦ ' : '') + esc(f.name) + '</span>';
        });
        if (info.namedays.length) html += '<span class="zk-net" style="color:var(--acc)">Name day: ' + esc(info.namedays.join(', ')) + '</span>';
        if (!info.feasts.length && !info.namedays.length) html += '<span class="zk-hint">No feast or name day.</span>';
        html += '</div>';
        if (info.fast.why) html += '<p class="zk-hint" style="margin-top:6px">' + esc(info.fast.why) + '</p>';
        html += '</div>';
      } else if (!state.showOrthodox) {
        html += '<p class="zk-hint">The Orthodox calendar layer is switched off.</p>';
      }
      var ps = postsForDay(day);
      html += '<div><span class="zk-lab">' + ps.length + ' post' + (ps.length === 1 ? '' : 's') + '</span><div data-role="dayposts"></div></div>';
      m.body.innerHTML = html;
      var host = m.body.querySelector('[data-role="dayposts"]');
      if (!ps.length) {
        host.appendChild(el('div', 'zk-hint', 'Nothing scheduled on this day.'));
      } else {
        var list = el('div', 'zk-list');
        ps.forEach(function (p2) {
          var d2 = postDate(p2);
          var row = el('div', 'zk-lrow ' + statusClass(p2.status));
          row.innerHTML = '<span class="zk-ltime">' + esc(d2 ? hhmm(d2) : '--:--') + '</span>' +
            '<span class="zk-lbody">' + esc(firstWords(p2.body || '(no text)', 70)) + '</span>' +
            platDotsHTML(esc, channelList(p2));
          row.addEventListener('click', function () { m.close(); openDetail(p2); });
          list.appendChild(row);
        });
        host.appendChild(list);
      }
      m.foot.innerHTML = '';
      var draft = el('button', 'zk-btn pri');
      draft.textContent = info && (info.feasts.length || info.namedays.length) ? 'Draft for this feast' : 'New post on this day';
      draft.addEventListener('click', function () { m.close(); draftForDay(day); });
      m.foot.appendChild(draft);
    }

    /* ---------- MONTH ---------- */
    function renderMonth() {
      var c = state.cursor;
      var first = new Date(c.getFullYear(), c.getMonth(), 1);
      var gridStart = addDays(first, -first.getDay());
      var today = startOfDay(new Date());
      var grid = el('div', 'zk-grid');
      var dow = el('div', 'zk-dow');
      WEEKDAYS.forEach(function (w) { dow.appendChild(el('div', null, w)); });
      grid.appendChild(dow);
      var cells = el('div', 'zk-cells');
      for (var i = 0; i < 42; i++) {
        var day = addDays(gridStart, i);
        var isOther = day.getMonth() !== c.getMonth();
        var info = dayInfoFor(day);
        var cls = 'zk-cell' + (isOther ? ' oth' : '') + (sameDay(day, today) ? ' today' : '');
        if (info) {
          if (info.fast.level === 'strict') cls += ' fast-strict';
          else if (info.fast.level === 'fast') cls += ' fast-fast';
          if (info.feasts.some(function (f) { return f.great; })) cls += ' feast';
        }
        var cell = el('div', cls);
        cell.setAttribute('data-day', dayKey(day));
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', dayAriaLabel(day, info));
        var head = el('div', 'zk-daynum');
        head.innerHTML = (sameDay(day, today) ? '<b>' + day.getDate() + '</b>' : '<span>' + day.getDate() + '</span>') +
          '<span>' + fastMarkHTML(info) + '</span>';
        cell.appendChild(head);
        if (info) {
          var lines = orthoLinesHTML(info);
          if (lines) {
            var ld = el('div');
            ld.innerHTML = lines;
            cell.appendChild(ld.firstChild);
          }
        }
        postsForDay(day).forEach(function (p) { cell.appendChild(makeChip(p)); });
        // the cell itself opens the day: liturgical context plus that day's posts
        wireCellOpen(cell, day);
        wireDrop(cell, day);
        cells.appendChild(cell);
      }
      grid.appendChild(cells);
      cells.setAttribute('role', 'grid');
      return grid;
    }
    function dayAriaLabel(day, info) {
      var n = postsForDay(day).length;
      var base = WEEKDAYS_FULL[day.getDay()] + ' ' + MONTHS_SHORT[day.getMonth()] + ' ' + day.getDate() +
        ', ' + n + ' post' + (n === 1 ? '' : 's');
      if (!info) return base;
      var extra = [];
      if (info.feasts.length) extra.push(info.feasts[0].name);
      if (info.namedays.length) extra.push('name day ' + info.namedays.join(', '));
      if (info.fast.level !== 'none') extra.push(info.fast.label);
      return extra.length ? base + '. ' + extra.join('. ') : base;
    }

    /* `day` is a PARAMETER, not a closed-over loop variable — see the note in
     * renderMonth. Every cell must own its own date. */
    function wireCellOpen(cell, day) {
      cell.addEventListener('click', function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('.zk-chip')) return;
        openDay(day);
      });
      cell.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDay(day); }
      });
    }
    function wireDrop(cell, day) {
      cell.addEventListener('dragover', function (ev) {
        if (state.dragId == null) return;
        ev.preventDefault();
        try { ev.dataTransfer.dropEffect = 'move'; } catch (e) {}
        cell.classList.add('dragover');
      });
      cell.addEventListener('dragleave', function () { cell.classList.remove('dragover'); });
      cell.addEventListener('drop', function (ev) {
        ev.preventDefault();
        cell.classList.remove('dragover');
        var id = state.dragId;
        try { id = ev.dataTransfer.getData('text/plain') || id; } catch (e) {}
        state.dragId = null;
        var post = findPost(id);
        if (!post) return;
        var orig = postDate(post) || new Date();
        var target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), orig.getHours(), orig.getMinutes(), 0, 0);
        if (sameDay(target, orig)) return; // no-op
        // A strict fast is the one drop that deserves a question first.
        if (!confirmFastDay(post, target)) return;
        reschedule(post, target, null).catch(function () {
          // drag failure -> fall back to explicit edit-time modal
          toast('Could not move the post — try editing the time.');
          openDetail(post);
        });
      });
    }
    function findPost(id) {
      id = String(id);
      for (var i = 0; i < state.posts.length; i++) {
        if (String(state.posts[i].id) === id) return state.posts[i];
      }
      return null;
    }

    /* ---------- WEEK ---------- */
    function renderWeek() {
      var c = state.cursor;
      var ws = startOfDay(addDays(c, -c.getDay()));
      var today = startOfDay(new Date());
      var box = el('div', 'zk-week');
      for (var i = 0; i < 7; i++) {
        var day = addDays(ws, i);
        var col = el('div', 'zk-wcol' + (sameDay(day, today) ? ' today' : ''));
        var winfo = dayInfoFor(day);
        col.innerHTML = '<div class="zk-whd"><div class="zk-wd">' + WEEKDAYS[day.getDay()] +
          '</div><div class="zk-wn">' + day.getDate() + '</div>' +
          (winfo ? '<div style="margin-top:3px">' + fastMarkHTML(winfo) + '</div>' : '') + '</div>' +
          (winfo && (winfo.feasts.length || winfo.namedays.length)
            ? '<div class="zk-wo">' +
              (winfo.feasts.length ? '<b>' + esc(winfo.feasts[0].name) + '</b>' : '') +
              (winfo.namedays.length ? '<i>' + esc(winfo.namedays.slice(0, 2).join(', ')) + '</i>' : '') +
              '</div>'
            : '');
        var body = el('div', 'zk-wbody');
        var ps = postsForDay(day);
        if (!ps.length) body.appendChild(el('div', 'zk-wempty', '—'));
        else ps.forEach(function (p) { body.appendChild(makeChip(p)); });
        col.appendChild(body);
        wireDrop(col, day);
        box.appendChild(col);
      }
      return box;
    }

    /* ---------- LIST (upcoming) ---------- */
    function renderList() {
      var today = startOfDay(new Date());
      var ps = filteredPosts().filter(function (p) {
        var d = postDate(p);
        return d && d.getTime() >= today.getTime();
      }).sort(function (a, b) { return postDate(a).getTime() - postDate(b).getTime(); });

      if (!ps.length) {
        return el('div', 'zk-empty',
          'No upcoming posts' + (state.campaign ? ' for this campaign' : '') +
          '. Schedule posts from the Composer, drop a CSV, or add them here.');
      }
      var box = el('div', 'zk-list');
      var curKey = null;
      ps.forEach(function (p) {
        var d = postDate(p);
        var k = dayKey(d);
        if (k !== curKey) {
          curKey = k;
          var rel = relTime ? relTime(d.toISOString()) : '';
          box.appendChild(el('div', 'zk-lday',
            WEEKDAYS_FULL[d.getDay()] + ', ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() +
            (rel ? ' <span class="zk-tag2">· ' + esc(rel) + '</span>' : '')));
        }
        var row = el('div', 'zk-lrow ' + statusClass(p.status));
        row.innerHTML =
          '<span class="zk-ltime">' + esc(hhmm(d)) + '</span>' +
          '<span class="zk-lbody">' + esc(firstWords(p.body || '(no text)', 90)) + '</span>' +
          platDotsHTML(esc, channelList(p)) +
          '<span class="zk-badge ' + statusClass(p.status) + '" style="flex:none">' + esc(statusLabel(p.status)) + '</span>';
        row.addEventListener('click', function () { openDetail(p); });
        box.appendChild(row);
      });
      return box;
    }

    /* ---------- mutations ---------- */
    // RESCHEDULE / edit-time: re-send the post's own fields + new scheduled_at + own id.
    async function reschedule(post, newDate, statusOverride) {
      await C.api.rpc('social_save_post', {
        p_workspace: ctx.ws,
        p_body: post.body || '',
        p_channels: channelList(post),
        p_scheduled_at: newDate ? newDate.toISOString() : null,
        p_status: statusOverride || post.status || 'scheduled',
        p_media: post.media || [],
        p_nameday: post.nameday_ref || null,
        p_meta: post.meta || {},
        p_id: post.id
      }, { auth: 'require' });
      toast('Post rescheduled.');
      await reloadAndRender();
    }
    async function duplicatePost(post) {
      var d = postDate(post);
      await C.api.rpc('social_save_post', {
        p_workspace: ctx.ws,
        p_body: post.body || '',
        p_channels: channelList(post),
        p_scheduled_at: d ? d.toISOString() : null,
        p_status: post.status || 'draft',
        p_media: post.media || [],
        p_nameday: post.nameday_ref || null,
        p_meta: post.meta || {},
        p_id: null
      }, { auth: 'require' });
      toast('Post duplicated.');
      await reloadAndRender();
    }
    async function deletePost(post) {
      await C.api.rpc('social_delete_post', { p_workspace: ctx.ws, p_id: post.id }, { auth: 'require' });
      // Keep everything we know about the post so Undo can re-create it. There
      // is no undelete RPC, so the restored post is a NEW row — the undo bar
      // says so rather than pretending the id survived.
      state.lastDeleted = { post: post, at: Date.now() };
      toast('Post deleted.');
      await reloadAndRender();
    }
    /* Repost: the same post again, later. Buffer calls this "re-queue"; the
     * offset is in days so "+1 week" and "+1 month" are the same code path. */
    async function repost(post, days) {
      var base = postDate(post) || new Date();
      var target = addDays(base, days);
      if (!confirmFastDay(post, target)) return;
      await C.api.rpc('social_save_post', {
        p_workspace: ctx.ws,
        p_body: post.body || '',
        p_channels: channelList(post),
        p_scheduled_at: target.toISOString(),
        p_status: 'scheduled',
        p_media: post.media || [],
        p_nameday: post.nameday_ref || null,
        p_meta: post.meta || {},
        p_id: null
      }, { auth: 'require' });
      toast('Reposted for ' + MONTHS_SHORT[target.getMonth()] + ' ' + target.getDate() + '.');
      await reloadAndRender();
    }
    async function reloadAndRender() {
      await loadPosts();
      render();
    }

    /* ---------- modal plumbing ---------- */
    function openModal(title, iconSvg, wide) {
      var ov = el('div', 'zk-ov');
      var modal = el('div', 'zk-modal' + (wide ? ' wide' : ''));
      modal.innerHTML =
        '<div class="zk-mh"><h3>' + (iconSvg || '') + esc(title) + '</h3>' +
        '<button class="zk-mx" data-role="close">×</button></div>' +
        '<div class="zk-mb" data-role="body"></div>' +
        '<div class="zk-mf" data-role="foot"></div>';
      ov.appendChild(modal);
      doc.body.appendChild(ov);
      function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); doc.removeEventListener('keydown', onKey); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      doc.addEventListener('keydown', onKey);
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      modal.querySelector('[data-role="close"]').addEventListener('click', close);
      return { ov: ov, body: modal.querySelector('[data-role="body"]'), foot: modal.querySelector('[data-role="foot"]'), close: close };
    }

    /* ---------- DETAIL modal ---------- */
    function openDetail(post) {
      var m = openModal('Post details',
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>', false);
      var d = postDate(post);
      var nets = channelList(post).map(function (c) {
        var n = netFor(c);
        if (n) return '<span class="zk-net" style="color:' + n.color + '"><svg viewBox="0 0 24 24">' + n.icon + '</svg><span style="color:var(--tx)">' + esc(n.name) + '</span></span>';
        return '<span class="zk-net">' + esc(String(c)) + '</span>';
      }).join('');
      var cm = post.meta && post.meta.campaign ? String(post.meta.campaign) : '';
      var when = d ? (WEEKDAYS_FULL[d.getDay()] + ', ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + hhmm(d)) : 'Not scheduled';
      var rel = d && relTime ? relTime(d.toISOString()) : '';

      // What day, liturgically, is this post going out on?
      var litHtml = '';
      if (d && state.O) {
        var linfo = state.O.dayInfo(dayKey(d));
        var clash = state.O.fastConflict(String(post.body || ''), dayKey(d));
        if (linfo.feasts.length || linfo.namedays.length || linfo.fast.level !== 'none') {
          litHtml = '<div><span class="zk-lab">The day it goes out</span><div class="zk-agmeta">' + fastMarkHTML(linfo);
          linfo.feasts.forEach(function (f) {
            litHtml += '<span class="zk-net" style="' + (f.great ? 'color:var(--gold);' : '') + '">' + (f.great ? '✦ ' : '') + esc(f.name) + '</span>';
          });
          if (linfo.namedays.length) litHtml += '<span class="zk-net" style="color:var(--acc)">Name day: ' + esc(linfo.namedays.join(', ')) + '</span>';
          litHtml += '</div>';
          if (clash) {
            litHtml += '<div class="zk-fastnote" style="margin-top:8px"><b>' + esc(clash.label) + '.</b> This post mentions ' +
              esc(clash.words.slice(0, 4).join(', ')) + '. ' + esc(clash.why) + ' Consider ' + esc(clash.suggest) + '.</div>';
          }
          litHtml += '</div>';
        }
      }
      m.body.innerHTML =
        litHtml +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<span class="zk-badge ' + statusClass(post.status) + '">' + esc(statusLabel(post.status)) + '</span>' +
          '<span class="zk-meta"><span><b>' + esc(when) + '</b>' + (rel ? ' · ' + esc(rel) : '') + '</span></span>' +
        '</div>' +
        '<div><span class="zk-lab">Networks</span><div class="zk-nets">' + (nets || '<span class="zk-hint">No networks set.</span>') + '</div></div>' +
        (cm ? '<div><span class="zk-lab">Campaign</span><div class="zk-hint" style="color:var(--tx)">' + esc(cm) + '</div></div>' : '') +
        '<div><span class="zk-lab">Message</span><div class="zk-body-full">' + esc(post.body || '(no text)') + '</div></div>' +
        '<div data-role="editrow" style="display:none">' +
          '<span class="zk-lab">Reschedule to</span>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
            '<input class="zk-in" style="flex:1;min-width:200px" type="datetime-local" data-role="dt">' +
            '<button class="zk-btn pri" data-role="savetime">Save time</button>' +
          '</div>' +
          '<p class="zk-hint" style="margin-top:6px">Re-sends this post with the new time; everything else stays the same.</p>' +
        '</div>';

      m.foot.innerHTML =
        '<button class="zk-btn" data-role="edit"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Edit time</button>' +
        '<button class="zk-btn" data-role="dup"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Duplicate</button>' +
        '<button class="zk-btn pri" data-role="editfull"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Edit in Composer</button>' +
        '<button class="zk-btn" data-role="rp7" title="Schedule this post again a week later">Repost +1w</button>' +
        '<button class="zk-btn" data-role="rp30" title="Schedule this post again a month later">Repost +1m</button>' +
        '<button class="zk-btn danger" data-role="del"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>Delete</button>';

      var editRow = m.body.querySelector('[data-role="editrow"]');
      var dt = m.body.querySelector('[data-role="dt"]');
      dt.value = toLocalInput(d || new Date());

      m.foot.querySelector('[data-role="edit"]').addEventListener('click', function () {
        editRow.style.display = editRow.style.display === 'none' ? 'block' : 'none';
        if (editRow.style.display !== 'none') dt.focus();
      });
      m.body.querySelector('[data-role="savetime"]').addEventListener('click', async function () {
        var nd = fromLocalInput(dt.value);
        if (!nd) { toast('Pick a valid date and time.'); return; }
        try { await reschedule(post, nd, null); m.close(); }
        catch (e) { toast(e && e.message ? e.message : 'Could not reschedule.'); }
      });
      m.foot.querySelector('[data-role="dup"]').addEventListener('click', async function () {
        try { await duplicatePost(post); m.close(); }
        catch (e) { toast(e && e.message ? e.message : 'Could not duplicate.'); }
      });
      m.foot.querySelector('[data-role="editfull"]').addEventListener('click', function () {
        // The Composer edits the whole post (body, media, networks, meta) and
        // saves it back with this same id. Editing the time alone stays here.
        m.close();
        gotoComposer({
          id: post.id,
          body: post.body || '',
          media: post.media || [],
          channels: channelList(post),
          meta: post.meta || {},
          scheduledAt: d ? toLocalInput(d) : null
        });
      });
      m.foot.querySelector('[data-role="rp7"]').addEventListener('click', async function () {
        try { await repost(post, 7); m.close(); }
        catch (e) { toast(e && e.message ? e.message : 'Could not repost.'); }
      });
      m.foot.querySelector('[data-role="rp30"]').addEventListener('click', async function () {
        try { await repost(post, 30); m.close(); }
        catch (e) { toast(e && e.message ? e.message : 'Could not repost.'); }
      });
      m.foot.querySelector('[data-role="del"]').addEventListener('click', async function () {
        if (global.confirm && !global.confirm('Delete this post? This cannot be undone.')) return;
        try { await deletePost(post); m.close(); }
        catch (e) { toast(e && e.message ? e.message : 'Could not delete.'); }
      });
    }

    /* ---------- QUEUE modal ---------- */
    function openQueue() {
      var m = openModal('Posting queue',
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>', true);
      function draw() {
        var grid = '<div class="zk-qgrid">';
        for (var wd = 0; wd < 7; wd++) {
          grid += '<div class="zk-qcol"><div class="zk-qhd">' + WEEKDAYS[wd] + '</div><div class="zk-qbody">';
          var slots = state.slots.filter(function (s) { return Number(s.weekday) === wd; })
            .sort(function (a, b) { return Number(a.minute) - Number(b.minute); });
          if (!slots.length) grid += '<div class="zk-qempty">—</div>';
          else slots.forEach(function (s) {
            var mm = Number(s.minute) || 0;
            var t = pad2(Math.floor(mm / 60)) + ':' + pad2(mm % 60);
            grid += '<div class="zk-slot" data-slot="' + esc(String(s.id)) + '"><span>' + esc(t) +
              (s.active === false ? ' <span style="color:var(--dim)">(off)</span>' : '') +
              '</span><button data-del="' + esc(String(s.id)) + '" title="Remove">×</button></div>';
          });
          grid += '</div></div>';
        }
        grid += '</div>';

        m.body.innerHTML =
          '<p class="zk-hint">A posting queue is a set of recurring time slots; scheduled posts you add to the queue fill the next open slot, so your calendar keeps a steady cadence without you picking a time each time.</p>' +
          grid +
          '<div style="border-top:1px solid var(--line2);padding-top:14px">' +
            '<span class="zk-lab">Add a slot</span>' +
            '<div class="zk-add">' +
              '<div class="zk-fld"><span class="zk-lab" style="margin-bottom:4px">Weekday</span>' +
                '<select class="zk-in" data-role="wd">' + WEEKDAYS_FULL.map(function (w, i) { return '<option value="' + i + '">' + w + '</option>'; }).join('') + '</select></div>' +
              '<div class="zk-fld"><span class="zk-lab" style="margin-bottom:4px">Time</span>' +
                '<input class="zk-in" type="time" data-role="tm" value="09:00"></div>' +
              '<button class="zk-btn pri" data-role="addslot">Add slot</button>' +
            '</div>' +
            '<p class="zk-hint" style="margin-top:6px">Times use <b style="color:var(--tx)">' + esc(localTz()) + '</b>.</p>' +
          '</div>';
        m.foot.innerHTML = '<span class="zk-count">' + state.slots.length + ' slot' + (state.slots.length === 1 ? '' : 's') + '</span><button class="zk-btn" data-role="done">Done</button>';

        m.foot.querySelector('[data-role="done"]').addEventListener('click', m.close);
        m.body.querySelector('[data-role="addslot"]').addEventListener('click', async function () {
          var wd = Number(m.body.querySelector('[data-role="wd"]').value);
          var tv = m.body.querySelector('[data-role="tm"]').value;
          var tp = String(tv || '').split(':');
          var minute = (Number(tp[0]) || 0) * 60 + (Number(tp[1]) || 0);
          try {
            await C.api.rpc('slot_save', {
              p_workspace: ctx.ws, p_weekday: wd, p_minute: minute, p_tz: localTz(), p_id: null
            }, { auth: 'require' });
            await loadSlots();
            draw();
            toast('Slot added.');
          } catch (e) { toast(e && e.message ? e.message : 'Could not add slot.'); }
        });
        Array.prototype.forEach.call(m.body.querySelectorAll('[data-del]'), function (btn) {
          btn.addEventListener('click', async function () {
            var id = btn.getAttribute('data-del');
            try {
              await C.api.rpc('slot_delete', { p_workspace: ctx.ws, p_id: id }, { auth: 'require' });
              await loadSlots();
              draw();
              toast('Slot removed.');
            } catch (e) { toast(e && e.message ? e.message : 'Could not remove slot.'); }
          });
        });
      }
      draw();
    }

    /* ---------- CSV import ---------- */
    // Minimal RFC-4180-ish parser: handles quoted fields, embedded commas & quotes.
    function parseCSV(text) {
      var rows = [], row = [], field = '', i = 0, inQ = false;
      text = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      while (i < text.length) {
        var ch = text[i];
        if (inQ) {
          if (ch === '"') {
            if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
            inQ = false; i++; continue;
          }
          field += ch; i++; continue;
        }
        if (ch === '"') { inQ = true; i++; continue; }
        if (ch === ',') { row.push(field); field = ''; i++; continue; }
        if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
        field += ch; i++;
      }
      row.push(field); rows.push(row);
      // drop fully-empty trailing rows
      return rows.filter(function (r) { return r.length && !(r.length === 1 && r[0].trim() === ''); });
    }
    function validateRow(cells) {
      var date = String(cells[0] || '').trim();
      var time = String(cells[1] || '').trim();
      var body = String(cells[2] || '').trim();
      var netsRaw = String(cells[3] || '').trim();
      var errs = [];
      var dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dm) errs.push('date must be YYYY-MM-DD');
      var tm = time.match(/^(\d{1,2}):(\d{2})$/);
      if (!tm) errs.push('time must be HH:MM');
      if (!body) errs.push('body is empty');
      var nets = netsRaw.split('|').map(function (n) { return normPlat(n); }).filter(Boolean);
      if (!nets.length) errs.push('networks required (pipe-separated)');
      var unknown = nets.filter(function (n) { return !NET[n]; });
      if (unknown.length) errs.push('unknown network: ' + unknown.join(', '));
      var when = null;
      if (dm && tm) {
        var hh = Number(tm[1]), mi = Number(tm[2]);
        if (hh > 23 || mi > 59) errs.push('time out of range');
        else {
          when = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hh, mi, 0, 0);
          if (isNaN(when.getTime())) { errs.push('invalid date'); when = null; }
        }
      }
      return { date: date, time: time, body: body, nets: nets, when: when, errs: errs, valid: errs.length === 0 };
    }
    function openImport() {
      var m = openModal('Bulk CSV import',
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>', true);
      m.body.innerHTML =
        '<p class="zk-hint">Columns, in order: <b style="color:var(--tx)">date (YYYY-MM-DD), time (HH:MM), body, networks (pipe-separated)</b>. A header row is optional. Bodies may contain commas if wrapped in "quotes". Valid rows import as <b style="color:var(--tx)">scheduled</b> posts.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<button class="zk-btn" data-role="file"><svg viewBox="0 0 24 24"><path d="M4 21h16M12 3v12m0 0l-4-4m4 4l4-4"/></svg>Choose .csv file</button>' +
          '<button class="zk-btn" data-role="sample">Load example</button>' +
          '<input type="file" accept=".csv,text/csv" style="display:none" data-role="fileinput">' +
        '</div>' +
        '<textarea class="zk-ta" data-role="csv" placeholder="date,time,body,networks&#10;2026-08-25,09:30,Kalimera from the shop!,facebook|instagram&#10;2026-08-26,18:00,&quot;New arrivals, fresh in&quot;,x|linkedin"></textarea>' +
        '<div style="display:flex;gap:8px"><button class="zk-btn pri" data-role="preview">Preview &amp; validate</button></div>' +
        '<div data-role="previewbox"></div>';
      m.foot.innerHTML = '<span class="zk-count" data-role="summary"></span><button class="zk-btn" data-role="cancel">Close</button><button class="zk-btn gold" data-role="confirm" disabled>Import valid rows</button>';

      var parsed = [];
      var ta = m.body.querySelector('[data-role="csv"]');
      var fileInput = m.body.querySelector('[data-role="fileinput"]');
      var confirmBtn = m.foot.querySelector('[data-role="confirm"]');
      var summary = m.foot.querySelector('[data-role="summary"]');

      m.body.querySelector('[data-role="sample"]').addEventListener('click', function () {
        ta.value = 'date,time,body,networks\n' +
          '2026-08-25,09:30,Kalimera from the shop!,facebook|instagram\n' +
          '2026-08-26,18:00,"New arrivals, fresh in stock",x|linkedin\n' +
          '2026-08-27,12:00,Weekend market this Saturday,facebook';
      });
      m.body.querySelector('[data-role="file"]').addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var reader = new global.FileReader();
        reader.onload = function () { ta.value = String(reader.result || ''); };
        reader.onerror = function () { toast('Could not read that file.'); };
        reader.readAsText(f);
      });

      function doPreview() {
        var rows = parseCSV(ta.value);
        if (rows.length && /^\s*date\s*$/i.test(rows[0][0] || '') && /^\s*time\s*$/i.test(rows[0][1] || '')) {
          rows = rows.slice(1); // drop header
        }
        parsed = rows.map(validateRow);
        var box = m.body.querySelector('[data-role="previewbox"]');
        if (!parsed.length) {
          box.innerHTML = '<p class="zk-hint">Nothing to preview yet — paste rows or load a file.</p>';
          confirmBtn.disabled = true; summary.textContent = '';
          return;
        }
        var okN = parsed.filter(function (r) { return r.valid; }).length;
        var badN = parsed.length - okN;
        var html = '<div class="zk-prev"><table><thead><tr><th>#</th><th>Date</th><th>Time</th><th>Body</th><th>Networks</th><th>Status</th></tr></thead><tbody>';
        parsed.forEach(function (r, i) {
          html += '<tr class="' + (r.valid ? '' : 'bad') + '">' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + esc(r.date) + '</td>' +
            '<td>' + esc(r.time) + '</td>' +
            '<td>' + esc(firstWords(r.body, 40)) + '</td>' +
            '<td>' + esc(r.nets.join(' | ')) + '</td>' +
            '<td>' + (r.valid ? '<span class="zk-ok">ready</span>' : '<span class="zk-err">' + esc(r.errs.join('; ')) + '</span>') + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';
        box.innerHTML = html;
        summary.textContent = okN + ' ready · ' + badN + ' with errors';
        confirmBtn.disabled = okN === 0;
      }
      m.body.querySelector('[data-role="preview"]').addEventListener('click', doPreview);
      m.foot.querySelector('[data-role="cancel"]').addEventListener('click', m.close);

      confirmBtn.addEventListener('click', async function () {
        var valid = parsed.filter(function (r) { return r.valid; });
        if (!valid.length) { toast('No valid rows to import.'); return; }
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Importing…';
        var ok = 0, fail = 0, firstErr = '';
        for (var i = 0; i < valid.length; i++) {
          var r = valid[i];
          try {
            await C.api.rpc('social_save_post', {
              p_workspace: ctx.ws,
              p_body: r.body,
              p_channels: r.nets,
              p_scheduled_at: r.when.toISOString(),
              p_status: 'scheduled',
              p_media: [],
              p_nameday: null,
              p_meta: { source: 'csv_import', imported_at: new Date().toISOString() },
              p_id: null
            }, { auth: 'require' });
            ok++;
          } catch (e) {
            fail++;
            if (!firstErr) firstErr = (e && e.message) ? e.message : 'save failed';
          }
        }
        toast(ok + ' imported' + (fail ? ', ' + fail + ' failed' + (firstErr ? ' (' + firstErr + ')' : '') : '') + '.');
        await reloadAndRender();
        if (fail) {
          confirmBtn.textContent = 'Retry failed';
          confirmBtn.disabled = false;
          summary.textContent = ok + ' imported · ' + fail + ' failed';
        } else {
          m.close();
        }
      });

      doPreview();
    }

    /* ---------- fill the queue from the drafts ----------
     * Buffer's "add to queue", done honestly: every draft gets the next FREE
     * slot (never one that already has a post in it), one save per post, and the
     * result is reported exactly — including how many failed. */
    async function fillQueue() {
      if (!state.S) { toast('The scheduling library did not load, so the queue cannot be filled.'); return; }
      var act = state.S.activeSlots(state.slots);
      if (!act.length) { toast('Add posting-time slots first (Posting queue).'); return; }
      var drafts = state.posts.filter(function (p) { return String(p.status || '').toLowerCase() === 'draft'; })
        .sort(function (a, b) {
          var da = new Date(a.created_at || 0).getTime(), db = new Date(b.created_at || 0).getTime();
          return da - db;
        });
      if (!drafts.length) { toast('No drafts to place. Save a draft in the Composer first.'); return; }
      var open = state.S.nextOpenSlotTimes(state.slots, state.posts, new Date(), drafts.length);
      if (!open.length) { toast('No free slots in the next few weeks.'); return; }
      var n = Math.min(drafts.length, open.length);
      if (global.confirm && !global.confirm('Schedule ' + n + ' draft' + (n === 1 ? '' : 's') +
        ' into the next ' + n + ' free slot' + (n === 1 ? '' : 's') + '?' +
        (drafts.length > open.length ? '\n\n' + (drafts.length - open.length) + ' draft(s) will stay unscheduled — not enough free slots.' : ''))) return;
      var ok = 0, fail = 0, firstErr = '';
      for (var i = 0; i < n; i++) {
        var p = drafts[i], when = open[i].when;
        try {
          await C.api.rpc('social_save_post', {
            p_workspace: ctx.ws,
            p_body: p.body || '',
            p_channels: channelList(p),
            p_scheduled_at: when.toISOString(),
            p_status: 'scheduled',
            p_media: p.media || [],
            p_nameday: p.nameday_ref || null,
            p_meta: p.meta || {},
            p_id: p.id
          }, { auth: 'require' });
          ok++;
        } catch (e) {
          fail++;
          if (!firstErr) firstErr = (e && e.message) ? e.message : 'save failed';
        }
      }
      toast(ok + ' scheduled' + (fail ? ', ' + fail + ' failed (' + firstErr + ')' : '') + '.');
      await reloadAndRender();
    }

    /* ---------- wire toolbar ---------- */
    q('seg').addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-view]');
      if (!b) return;
      var v = b.getAttribute('data-view');
      if (v === state.view) return;
      state.view = v;
      Array.prototype.forEach.call(q('seg').querySelectorAll('button'), function (x) {
        var on = x.getAttribute('data-view') === v;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      reloadAndRender();
    });
    q('prev').addEventListener('click', function () { navBy(-1); });
    q('next').addEventListener('click', function () { navBy(1); });
    q('today').addEventListener('click', function () { state.cursor = startOfDay(new Date()); reloadAndRender(); });
    q('campaign').addEventListener('change', function (e) { state.campaign = e.target.value || ''; render(); });
    q('status').addEventListener('change', function (e) { state.status = e.target.value || ''; render(); });
    q('network').addEventListener('change', function (e) { state.network = e.target.value || ''; render(); });
    q('queue').addEventListener('click', function () { openQueue(); });
    q('import').addEventListener('click', function () { openImport(); });
    q('fill').addEventListener('click', function () { fillQueue(); });

    // search — debounced, because re-rendering a 42-cell grid per keystroke is
    // visible on a phone
    var searchTimer = null;
    q('q').addEventListener('input', function (e) {
      var v = e.target.value || '';
      if (searchTimer) global.clearTimeout(searchTimer);
      searchTimer = global.setTimeout(function () { state.query = v; render(); }, 180);
    });
    q('qclear').addEventListener('click', function () {
      q('q').value = '';
      state.query = '';
      render();
      q('q').focus();
    });

    // the Orthodox layer toggle, remembered between visits
    q('orth').addEventListener('click', function () {
      state.showOrthodox = !state.showOrthodox;
      var b = q('orth');
      b.classList.toggle('on', state.showOrthodox);
      b.setAttribute('aria-pressed', state.showOrthodox ? 'true' : 'false');
      try { global.localStorage && global.localStorage.setItem('zoi_cal_orthodox', state.showOrthodox ? '1' : '0'); } catch (e) {}
      render();
    });

    /* Keyboard navigation. Bound to the calendar's own wrapper rather than the
     * document, so it dies with the module instead of firing on another screen. */
    wrap.setAttribute('tabindex', '-1');
    wrap.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.key === 'Escape' && tag === 'input') { e.target.blur(); }
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); navBy(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navBy(1); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); state.cursor = startOfDay(new Date()); reloadAndRender(); }
      else if (e.key === '/') { e.preventDefault(); q('q').focus(); }
    });

    function navBy(dir) {
      var c = state.cursor;
      if (state.view === 'month') state.cursor = new Date(c.getFullYear(), c.getMonth() + dir, 1);
      else if (state.view === 'week') state.cursor = addDays(c, dir * 7);
      else if (state.view === 'agenda') state.cursor = addDays(c, dir * 14);
      else state.cursor = addDays(c, dir * 30);
      reloadAndRender();
    }

    /* ---------- initial ---------- */
    if (!state.showOrthodox) {
      q('orth').classList.remove('on');
      q('orth').setAttribute('aria-pressed', 'false');
    } else {
      q('orth').classList.add('on');
    }
    state.loading = true;
    render(); // paint the shell immediately, with a loading state

    // The liturgical layer and the scheduling maths are two small local files.
    var libs = await loadDeps(doc);
    state.O = libs.O;
    state.S = libs.S;
    await Promise.all([loadPosts(), loadSlots()]);
    render();
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'calendar',
    label: 'Calendar',
    order: 20,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    mount: mountCalendar
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

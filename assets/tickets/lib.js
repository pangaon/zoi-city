/*!
 * lib.js — Zoi Tickets: pure logic, no DOM, no network.
 * Classic script (NO ES modules). Zero dependencies.
 *
 * Everything in here is a function of its arguments, so it can be unit-tested
 * without a browser (tests/unit/tickets-lib.test.mjs). The rules it encodes are
 * the ones that are expensive to get wrong:
 *   - capacity maths (a tier that says "3 left" when it is full turns people away)
 *   - ICS generation (a malformed line and the calendar invite silently fails)
 *   - the offline check-in queue (a queued scan must never be reported as
 *     confirmed, and must never be dropped)
 *
 * Public API: window.ZoiTicketsLib
 */
(function (global) {
  'use strict';

  /* ═══════════════════ text ═══════════════════ */

  /**
   * Codes for comparison only: no punctuation, no case. The exact printed form
   * is what the server matches, so this is for local search, never for a lookup.
   */
  function compactCode(raw) {
    return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * Turn whatever a scanner or a volunteer's thumb produced into a code.
   * QR payloads are full ticket URLs, so pull the code out of ?c= or the last
   * path segment; typed input arrives with stray spaces and lower case.
   * Returns '' when there is nothing usable — callers must treat that as
   * "no code", never as a lookup.
   */
  /** decodeURIComponent throws on a malformed escape; a bad QR must not throw. */
  function safeDecode(v) {
    try { return decodeURIComponent(v); } catch (e) { return String(v); }
  }

  function normalizeCode(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    if (/^[a-z]+:\/\//i.test(s) || /^\/\//.test(s)) {
      var qi = s.indexOf('?');
      var found = '';
      if (qi >= 0) {
        var pairs = s.slice(qi + 1).split(/[&;]/);
        for (var i = 0; i < pairs.length; i++) {
          var kv = pairs[i].split('=');
          var k = safeDecode(kv[0] || '').toLowerCase();
          if (k === 'c' || k === 'code') { found = safeDecode(kv[1] || ''); break; }
        }
      }
      if (!found) {
        // Drop scheme and host first. Without this, https://zoi.city/ turns
        // into the code "ZOICITY" and gets looked up as if it were a ticket.
        var rest = s.replace(/^[a-z]+:\/\//i, '').replace(/^\/\//, '');
        var slash = rest.indexOf('/');
        var path = (slash < 0 ? '' : rest.slice(slash + 1));
        if (qi >= 0) path = path.split('?')[0];
        path = path.replace(/\/+$/, '');
        found = path.slice(path.lastIndexOf('/') + 1);
      }
      s = found;
    }
    s = s.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    s = s.replace(/^-+|-+$/g, '');
    return s;
  }

  function fmtMoney(cents, cur) {
    var n = Number(cents || 0);
    if (n === 0) return 'Free';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: cur || 'USD'
      }).format(n / 100);
    } catch (e) { return (cur || 'USD') + ' ' + (n / 100).toFixed(2); }
  }

  function fmtWhen(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  function fmtClock(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function plural(n, one, many) { return Number(n) === 1 ? one : (many || one + 's'); }

  /* ═══════════════════ capacity ═══════════════════ */

  /**
   * Capacity maths for one ticket tier, from the fields tickets_types_list
   * actually returns: {capacity, reserved, sold_out, price_cents, currency}.
   * capacity == null means the organiser set no cap — that is "unlimited", NOT
   * zero, and must never render as "0 left".
   */
  function tierMath(t) {
    t = t || {};
    var capacity = (t.capacity == null || t.capacity === '') ? null : Number(t.capacity);
    if (capacity != null && (!isFinite(capacity) || capacity < 0)) capacity = null;
    var reserved = Math.max(0, Number(t.reserved || 0));
    var unlimited = capacity == null;
    var left = unlimited ? null : Math.max(0, capacity - reserved);
    var pct = (!unlimited && capacity > 0) ? Math.min(100, Math.round((reserved / capacity) * 100)) : null;
    // sold_out is the server's word and wins; the local sum is a fallback only.
    var soldOut = t.sold_out === true || (!unlimited && left === 0);
    var level = 'high';
    if (pct != null) level = pct >= 90 ? 'low' : (pct >= 65 ? 'med' : 'high');
    return {
      capacity: capacity, reserved: reserved, left: left, pct: pct,
      unlimited: unlimited, soldOut: soldOut, level: level,
      priceCents: Number(t.price_cents || 0),
      currency: t.currency || 'USD',
      free: Number(t.price_cents || 0) === 0
    };
  }

  /**
   * Roll several tiers into one honest summary.
   * `capacity` is null if ANY tier is uncapped — a partial total would read as
   * the event's capacity and be wrong.
   */
  function rollup(types) {
    var list = Array.isArray(types) ? types : [];
    var reserved = 0, capacity = 0, hasUnlimited = false, allSoldOut = list.length > 0;
    var free = 0, paidTiers = 0;
    for (var i = 0; i < list.length; i++) {
      var m = tierMath(list[i]);
      reserved += m.reserved;
      if (m.unlimited) hasUnlimited = true; else capacity += m.capacity;
      if (!m.soldOut) allSoldOut = false;
      if (m.free) free++; else paidTiers++;
    }
    var cap = hasUnlimited ? null : capacity;
    return {
      tiers: list.length,
      reserved: reserved,
      capacity: cap,
      left: cap == null ? null : Math.max(0, cap - reserved),
      pct: (cap != null && cap > 0) ? Math.min(100, Math.round((reserved / cap) * 100)) : null,
      hasUnlimited: hasUnlimited,
      soldOut: allSoldOut,
      freeTiers: free,
      paidTiers: paidTiers
    };
  }

  /** A warning the organiser should act on, or null. Never invents numbers. */
  function capacityWarning(r) {
    if (!r || !r.tiers) return null;
    if (r.soldOut) {
      return { level: 'full', text: 'Every tier is sold out. Add capacity or another tier to keep selling.' };
    }
    if (r.pct == null) return null;
    if (r.pct >= 95) {
      return {
        level: 'critical',
        text: r.left + ' ' + plural(r.left, 'ticket') + ' left of ' + r.capacity + ' — ' + r.pct + '% gone.'
      };
    }
    if (r.pct >= 80) {
      return { level: 'warn', text: r.pct + '% of capacity reserved — ' + r.left + ' left.' };
    }
    return null;
  }

  /* ═══════════════════ door counts ═══════════════════ */

  /**
   * Per-tier checked-in vs sold, from tickets_reservations_list rows.
   * "sold" here means reserved seats (sum of qty) — it is what the door has to
   * get through, and it is the only quantity the list can support.
   */
  function doorCounts(reservations) {
    var list = Array.isArray(reservations) ? reservations : [];
    var byTier = {};
    var order = [];
    var sold = 0, checkedIn = 0, people = 0, peopleIn = 0;
    for (var i = 0; i < list.length; i++) {
      var r = list[i] || {};
      var qty = Math.max(1, Number(r.qty || 1));
      var tier = r.type || 'Unspecified tier';
      if (!byTier[tier]) { byTier[tier] = { name: tier, sold: 0, checkedIn: 0, rows: 0, rowsIn: 0 }; order.push(tier); }
      byTier[tier].sold += qty;
      byTier[tier].rows += 1;
      sold += qty;
      people += 1;
      if (r.checked_in) {
        byTier[tier].checkedIn += qty;
        byTier[tier].rowsIn += 1;
        checkedIn += qty;
        peopleIn += 1;
      }
    }
    return {
      sold: sold, checkedIn: checkedIn, remaining: Math.max(0, sold - checkedIn),
      reservations: people, reservationsIn: peopleIn,
      pct: sold > 0 ? Math.round((checkedIn / sold) * 100) : 0,
      tiers: order.map(function (k) { return byTier[k]; })
    };
  }

  /* ═══════════════════ attendee list ═══════════════════ */

  var SORTS = {
    name: function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); },
    tier: function (a, b) {
      return String(a.type || '').localeCompare(String(b.type || ''))
        || String(a.name || '').localeCompare(String(b.name || ''));
    },
    qty: function (a, b) { return Number(b.qty || 1) - Number(a.qty || 1); },
    newest: function (a, b) { return ts(b.created_at) - ts(a.created_at); },
    oldest: function (a, b) { return ts(a.created_at) - ts(b.created_at); },
    status: function (a, b) { return (a.checked_in ? 1 : 0) - (b.checked_in ? 1 : 0); }
  };
  function ts(v) { var d = v ? new Date(v).getTime() : 0; return isNaN(d) ? 0 : d; }

  /**
   * Search + filter + sort attendees, client-side over the rows we already
   * loaded. Search matches name, email, code and tier; a bare code typed at the
   * door should find its row.
   */
  function filterSortAttendees(list, opts) {
    opts = opts || {};
    var rows = (Array.isArray(list) ? list : []).slice();
    var q = String(opts.q || '').trim().toLowerCase();
    var codeQ = compactCode(opts.q || '');
    if (q) {
      rows = rows.filter(function (r) {
        return (String(r.name || '').toLowerCase().indexOf(q) >= 0)
          || (String(r.email || '').toLowerCase().indexOf(q) >= 0)
          || (String(r.type || '').toLowerCase().indexOf(q) >= 0)
          // ZK74QX must find ZK7-4QX: nobody types the hyphen.
          || (codeQ && compactCode(r.code).indexOf(codeQ) >= 0);
      });
    }
    var status = opts.status || 'all';
    if (status === 'in') rows = rows.filter(function (r) { return !!r.checked_in; });
    else if (status === 'out') rows = rows.filter(function (r) { return !r.checked_in; });
    else if (status === 'paid') rows = rows.filter(function (r) { return !!r.paid; });
    else if (status === 'unpaid') rows = rows.filter(function (r) { return !r.paid; });
    if (opts.tier && opts.tier !== 'all') {
      rows = rows.filter(function (r) { return String(r.type || '') === opts.tier; });
    }
    var cmp = SORTS[opts.sort] || SORTS.name;
    rows.sort(cmp);
    if (opts.dir === 'desc') rows.reverse();
    return rows;
  }

  function tiersIn(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (r) {
      var t = r && r.type;
      if (t && !seen[t]) { seen[t] = 1; out.push(t); }
    });
    return out.sort();
  }

  /* ═══════════════════ CSV ═══════════════════ */

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    // A leading =, +, - or @ makes spreadsheets treat the cell as a formula.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  /** columns: [{key, label, map?}] */
  function toCsv(rows, columns) {
    var head = columns.map(function (c) { return csvCell(c.label || c.key); }).join(',');
    var body = (rows || []).map(function (r) {
      return columns.map(function (c) {
        return csvCell(c.map ? c.map(r) : r[c.key]);
      }).join(',');
    });
    // BOM so Excel opens UTF-8 names (Παπαδόπουλος) correctly. CRLF per RFC 4180.
    return '﻿' + [head].concat(body).join('\r\n') + '\r\n';
  }

  var ATTENDEE_COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'type', label: 'Ticket type' },
    { key: 'code', label: 'Confirmation code' },
    { key: 'qty', label: 'Quantity', map: function (r) { return Number(r.qty || 1); } },
    { key: 'paid', label: 'Payment', map: function (r) { return r.paid ? 'paid' : 'reserved (unpaid)'; } },
    { key: 'checked_in', label: 'Checked in', map: function (r) { return r.checked_in ? 'yes' : 'no'; } },
    { key: 'created_at', label: 'Reserved at', map: function (r) { return r.created_at || ''; } }
  ];

  /* ═══════════════════ ICS (RFC 5545) ═══════════════════ */

  function icsEscape(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }

  /**
   * Fold to 75 octets per RFC 5545 §3.1. Folding by characters is wrong for
   * anything non-ASCII, and Greek names are non-ASCII, so count UTF-8 bytes.
   */
  function icsFold(line) {
    var enc = function (ch) {
      var c = ch.codePointAt(0);
      return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    };
    var out = [];
    var cur = '';
    var bytes = 0;
    var limit = 75;
    var chars = Array.from(String(line));
    for (var i = 0; i < chars.length; i++) {
      var n = enc(chars[i]);
      if (bytes + n > limit) {
        out.push(cur);
        cur = ' ';        // continuation lines start with a single space
        bytes = 1;
        limit = 75;
      }
      cur += chars[i];
      bytes += n;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  function icsStamp(d) {
    var p = function (n, w) { return String(n).padStart(w || 2, '0'); };
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate())
      + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  }

  /**
   * Build a VCALENDAR for one event.
   * opts = {uid, name, description, start (ISO|Date), end, durationMinutes,
   *         location, url, organizer, now}
   * Throws if there is no valid start — an .ics without DTSTART is not a
   * calendar entry, and a silent broken download is worse than no button.
   */
  function buildIcs(opts) {
    opts = opts || {};
    var start = opts.start instanceof Date ? opts.start : new Date(opts.start);
    if (!opts.start || isNaN(start.getTime())) throw new Error('buildIcs: a valid start time is required');
    var end;
    if (opts.end) {
      end = opts.end instanceof Date ? opts.end : new Date(opts.end);
      if (isNaN(end.getTime())) end = null;
    }
    if (!end) {
      var mins = Number(opts.durationMinutes || 180);
      if (!isFinite(mins) || mins <= 0) mins = 180;
      end = new Date(start.getTime() + mins * 60000);
    }
    var now = opts.now instanceof Date ? opts.now : new Date(opts.now || Date.now());
    if (isNaN(now.getTime())) now = new Date(0);

    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zoi//zoi.city Tickets//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + icsEscape(opts.uid || ('zoi-' + icsStamp(start))),
      'DTSTAMP:' + icsStamp(now),
      'DTSTART:' + icsStamp(start),
      'DTEND:' + icsStamp(end),
      'SUMMARY:' + icsEscape(opts.name || 'Zoi event')
    ];
    if (opts.description) lines.push('DESCRIPTION:' + icsEscape(opts.description));
    if (opts.location) lines.push('LOCATION:' + icsEscape(opts.location));
    if (opts.url) lines.push('URL:' + icsEscape(opts.url));
    if (opts.organizer) lines.push('ORGANIZER;CN=' + icsEscape(opts.organizer) + ':MAILTO:noreply@zoi.city');
    lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }

  /* ═══════════════════ printable door manifest ═══════════════════ */

  /**
   * A self-contained printable manifest: black on white, tick boxes, no CSS
   * variables and no external assets, because it is going to a printer in a
   * church office and then onto a clipboard as the offline backup for door mode.
   * Pure string in / string out so the tests can check the escaping.
   */
  function manifestHtml(rows, meta) {
    meta = meta || {};
    var list = Array.isArray(rows) ? rows : [];
    var counts = doorCounts(list);
    var title = (meta.eventName || 'Event') + ' — door manifest';
    var when = meta.whenText ? esc(meta.whenText) : 'Date not set';
    var printedAt = new Date(meta.now || Date.now()).toLocaleString();
    var body = list.length
      ? list.map(function (r) {
        var qty = Math.max(1, Number(r.qty || 1));
        return '<tr>'
          + '<td class="bx">' + (r.checked_in ? '&#9632;' : '&#9633;') + '</td>'
          + '<td><b>' + esc(r.name || '—') + '</b><div class="sub">' + esc(r.email || '') + '</div></td>'
          + '<td>' + esc(r.type || '—') + '</td>'
          + '<td class="mono">' + esc(r.code || '—') + '</td>'
          + '<td class="num">' + qty + '</td>'
          + '<td>' + (r.paid ? 'Paid' : 'Reserved') + (r.checked_in ? ' · in' : '') + '</td>'
          + '</tr>';
      }).join('')
      : '<tr><td colspan="6" style="padding:22px;text-align:center">'
      + 'No reservations for this event yet.</td></tr>';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"/>'
      + '<meta name="viewport" content="width=device-width, initial-scale=1"/>'
      + '<title>' + esc(title) + '</title><style>'
      + '*{box-sizing:border-box}body{font:13px/1.45 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;'
      + 'color:#000;background:#fff;margin:0;padding:18px}'
      + 'h1{font-size:19px;margin:0 0 3px}.meta{font-size:12px;color:#444;margin-bottom:14px}'
      + '.sum{border:1px solid #000;padding:8px 10px;margin-bottom:14px;font-size:12.5px}'
      + 'table{width:100%;border-collapse:collapse}'
      + 'th,td{border-bottom:1px solid #bbb;padding:6px 7px;text-align:left;vertical-align:top}'
      + 'th{border-bottom:2px solid #000;font-size:11px;text-transform:uppercase;letter-spacing:.06em}'
      + '.bx{width:26px;font-size:17px;line-height:1}.num{width:38px;text-align:right}'
      + '.mono{font-family:ui-monospace,Menlo,monospace;letter-spacing:.06em;white-space:nowrap}'
      + '.sub{font-size:11px;color:#555}'
      + '.foot{margin-top:14px;font-size:11px;color:#444;border-top:1px solid #000;padding-top:8px}'
      + '@media print{body{padding:0}.noprint{display:none}tr{page-break-inside:avoid}}'
      + '</style></head><body>'
      + '<h1>' + esc(meta.eventName || 'Event') + '</h1>'
      + '<div class="meta">' + when + (meta.place ? ' · ' + esc(meta.place) : '') + '</div>'
      + '<div class="sum"><b>' + counts.reservations + '</b> reservations · <b>' + counts.sold
      + '</b> seats reserved · <b>' + counts.checkedIn + '</b> already checked in when this was printed'
      + ' · printed ' + esc(printedAt) + '</div>'
      + '<table><thead><tr><th>&nbsp;</th><th>Guest</th><th>Tier</th><th>Code</th><th class="num">Qty</th>'
      + '<th>Status</th></tr></thead><tbody>' + body + '</tbody></table>'
      + '<div class="foot">Tick the box as each guest arrives. This sheet is a snapshot: check-ins made in '
      + 'Zoi after printing will not appear here, and ticks on paper are not recorded in Zoi.</div>'
      + '<div class="noprint" style="margin-top:14px"><button onclick="window.print()">Print</button></div>'
      + '</body></html>';
  }

  /* ═══════════════════ schema.org ═══════════════════ */

  /**
   * schema.org/Event JSON-LD from the fields tickets_event_public returns.
   * Only emits offers for tiers we have real prices for; omits anything unknown
   * rather than guessing (a wrong availability claim is worse than none).
   */
  function eventJsonLd(ev, types, url) {
    ev = ev || {};
    var out = { '@context': 'https://schema.org', '@type': 'Event', name: ev.name || 'Event' };
    if (url) out.url = url;
    if (ev.event_at && !isNaN(new Date(ev.event_at).getTime())) {
      out.startDate = new Date(ev.event_at).toISOString();
    }
    if (ev.description) out.description = String(ev.description);
    out.eventStatus = 'https://schema.org/EventScheduled';
    var place = [ev.city, ev.country].filter(Boolean);
    if (ev.venue || place.length) {
      out.location = { '@type': 'Place', name: ev.venue || place.join(', ') };
      if (place.length) {
        out.location.address = { '@type': 'PostalAddress' };
        if (ev.city) out.location.address.addressLocality = ev.city;
        if (ev.country) out.location.address.addressCountry = ev.country;
      }
    }
    var list = Array.isArray(types) ? types : [];
    var offers = list.filter(function (t) {
      // No price is not a price of zero. Publishing "0.00 / InStock" for a tier
      // whose price we were not told is a lie to every search engine.
      return t && t.price_cents != null && isFinite(Number(t.price_cents));
    }).map(function (t) {
      var m = tierMath(t);
      var o = {
        '@type': 'Offer',
        name: t.name || 'Ticket',
        price: (m.priceCents / 100).toFixed(2),
        priceCurrency: m.currency,
        availability: m.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'
      };
      if (url) o.url = url;
      return o;
    });
    if (offers.length) out.offers = offers;
    return out;
  }

  /* ═══════════════════ offline check-in queue ═══════════════════ */

  var QUEUE_MAX_ATTEMPTS = 8;
  var BACKOFF_MS = [1500, 4000, 10000, 20000, 40000, 60000];

  function backoff(attempts) {
    return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
  }

  /** `now || Date.now()` is wrong: 0 is a real timestamp and it is falsy. */
  function stamp(now) {
    var n = (now == null) ? Date.now() : Number(now);
    return isFinite(n) ? n : Date.now();
  }

  var Queue = {
    MAX_ATTEMPTS: QUEUE_MAX_ATTEMPTS,

    create: function () { return { seq: 0, items: [] }; },

    /**
     * Add a scan. Returns {state, item, duplicate}. A code already waiting in
     * the queue is NOT added twice — double-scanning while offline must not
     * produce two check-in calls.
     */
    enqueue: function (state, code, now) {
      var s = Queue.normalize(state);
      var c = normalizeCode(code);
      if (!c) return { state: s, item: null, duplicate: false, empty: true };
      for (var i = 0; i < s.items.length; i++) {
        if (s.items[i].code !== c) continue;
        if (s.items[i].status === 'stuck') {
          // Already here but given up on. Re-scanning means "try again".
          var revived = Queue.revive(s, s.items[i].id, now);
          return { state: revived, item: revived.items[i], duplicate: true, revived: true };
        }
        return { state: s, item: s.items[i], duplicate: true };
      }
      var t0 = stamp(now);
      var item = {
        id: ++s.seq,
        code: c,
        queuedAt: t0,
        attempts: 0,
        nextAt: t0,
        status: 'pending',
        lastError: null
      };
      s.items.push(item);
      return { state: s, item: item, duplicate: false };
    },

    normalize: function (state) {
      var s = state && typeof state === 'object' ? state : {};
      var items = Array.isArray(s.items) ? s.items.filter(function (it) {
        return it && typeof it.code === 'string' && it.code;
      }) : [];
      var seq = Number(s.seq || 0);
      items.forEach(function (it) {
        it.id = Number(it.id || 0) || ++seq;
        it.attempts = Number(it.attempts || 0);
        it.nextAt = Number(it.nextAt || 0);
        it.queuedAt = Number(it.queuedAt || 0);
        if (it.status !== 'pending' && it.status !== 'stuck') it.status = 'pending';
        if (it.id > seq) seq = it.id;
      });
      return { seq: seq, items: items };
    },

    pending: function (state) {
      return Queue.normalize(state).items.filter(function (i) { return i.status === 'pending'; });
    },
    stuck: function (state) {
      return Queue.normalize(state).items.filter(function (i) { return i.status === 'stuck'; });
    },

    /** The next item whose retry time has arrived, or null. */
    due: function (state, now) {
      var t = stamp(now);
      var items = Queue.normalize(state).items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].status === 'pending' && items[i].nextAt <= t) return items[i];
      }
      return null;
    },

    /** The scan reached the server. Remove it. */
    done: function (state, id) {
      var s = Queue.normalize(state);
      s.items = s.items.filter(function (i) { return i.id !== id; });
      return s;
    },

    /** The request failed. Back off; give up (but keep it visible) eventually. */
    fail: function (state, id, message, now) {
      var s = Queue.normalize(state);
      var t = stamp(now);
      s.items.forEach(function (i) {
        if (i.id !== id) return;
        i.attempts += 1;
        i.lastError = message == null ? null : String(message);
        if (i.attempts >= QUEUE_MAX_ATTEMPTS) { i.status = 'stuck'; i.nextAt = t; }
        else { i.nextAt = t + backoff(i.attempts - 1); }
      });
      return s;
    },

    /** Put a stuck item back in the pending queue (volunteer taps "retry"). */
    revive: function (state, id, now) {
      var s = Queue.normalize(state);
      var t = stamp(now);
      s.items.forEach(function (i) {
        if (i.id === id) { i.status = 'pending'; i.attempts = 0; i.nextAt = t; i.lastError = null; }
      });
      return s;
    },

    counts: function (state) {
      var s = Queue.normalize(state);
      var p = 0, k = 0;
      s.items.forEach(function (i) { if (i.status === 'stuck') k++; else p++; });
      return { pending: p, stuck: k, total: s.items.length };
    },

    load: function (storage, key) {
      try {
        var raw = storage.getItem(key);
        return Queue.normalize(raw ? JSON.parse(raw) : null);
      } catch (e) { return Queue.create(); }
    },
    save: function (storage, key, state) {
      try { storage.setItem(key, JSON.stringify(Queue.normalize(state))); return true; }
      catch (e) { return false; }
    },
    backoff: backoff
  };
  /** Honest undo: only ever removes something that has NOT been sent. */
  Queue.drop = Queue.done;

  /* ═══════════════════ door decision ═══════════════════ */

  /**
   * Turn a tickets_checkin response (or a transport failure) into exactly one
   * of five outcomes. This is the single place that decides what the volunteer
   * is told, so it is also the single place that can lie. It does not.
   *
   *   accepted  — server confirmed a first check-in
   *   duplicate — server says already checked in
   *   unknown   — server does not recognise the code for these events
   *   queued    — we could not reach the server; held locally, NOT confirmed
   *   invalid   — nothing scannable
   */
  function decide(input) {
    input = input || {};
    if (input.empty) return { kind: 'invalid', title: 'No code', detail: 'Nothing to look up.' };
    var r = input.response;
    if (input.error || !r) {
      return {
        kind: 'queued',
        title: 'Saved offline',
        detail: 'No connection to the ticket server. This scan is held on this device and NOT yet confirmed.',
        error: input.error ? String(input.error) : null
      };
    }
    if (r.ok === false || (r.ok == null && r.found === false)) {
      return { kind: 'unknown', title: 'Code not recognised', detail: 'This code is not on the list for your events.' };
    }
    var who = r.name || 'Guest';
    var qty = Math.max(1, Number(r.qty || 1));
    var bits = [];
    if (r.type) bits.push(String(r.type));
    bits.push(qty + ' ' + plural(qty, 'ticket'));
    if (r.paid === true) bits.push('paid');
    else if (r.paid === false) bits.push('reserved (unpaid)');
    if (r.already) {
      var when = r.checked_in_at || r.checkedInAt || null;
      return {
        kind: 'duplicate',
        title: 'Already checked in',
        who: who, qty: qty,
        detail: bits.join(' · '),
        when: when,
        whenText: when ? fmtClock(when) : null,
        // Honest: the RPC does not always report the time. Say so rather than
        // inventing "just now".
        whenUnknown: !when
      };
    }
    return {
      kind: 'accepted', title: 'Checked in', who: who, qty: qty, detail: bits.join(' · ')
    };
  }

  global.ZoiTicketsLib = {
    esc: esc,
    normalizeCode: normalizeCode,
    compactCode: compactCode,
    fmtMoney: fmtMoney,
    fmtWhen: fmtWhen,
    fmtClock: fmtClock,
    plural: plural,
    tierMath: tierMath,
    rollup: rollup,
    capacityWarning: capacityWarning,
    doorCounts: doorCounts,
    filterSortAttendees: filterSortAttendees,
    tiersIn: tiersIn,
    toCsv: toCsv,
    csvCell: csvCell,
    ATTENDEE_COLUMNS: ATTENDEE_COLUMNS,
    icsEscape: icsEscape,
    icsFold: icsFold,
    icsStamp: icsStamp,
    buildIcs: buildIcs,
    eventJsonLd: eventJsonLd,
    manifestHtml: manifestHtml,
    Queue: Queue,
    decide: decide
  };
}(typeof window !== 'undefined' ? window : globalThis));

/*!
 * _schedule.js — shared, pure scheduling logic for the Zoi suite.
 * Classic script (NO ES modules), zero dependencies. Exposes window.ZoiSchedule.
 *
 * WHY THIS FILE EXISTS
 * Composer, Calendar and Analytics were each doing their own arithmetic on the
 * same three shapes — posts, channels and queue slots — and quietly disagreeing.
 * The composer's "next queue slot" ignored posts that already occupied the slot,
 * so two posts could be pushed into the same 09:00 on the same channel. Anything
 * that answers a question about time, limits or collisions now lives here, has
 * no DOM in it, and is unit-tested (tests/unit/schedule.test.mjs).
 *
 * Everything here is deterministic: functions that need "now" take it as an
 * argument. That is the only way to test a scheduler.
 */
(function (global) {
  'use strict';

  var DAY = 86400000;
  var MIN = 60000;

  /* ================= per-network limits ================= */
  /*
   * Character limits are the platforms' documented caption/description limits.
   * `trunc` is where each network visually cuts the text with a "more" link —
   * used by the previews, not by validation.
   */
  var NET = {
    facebook: { key: 'facebook', name: 'Facebook', limit: 63206, trunc: 477, urlCost: 0, hashtagAdvice: 3 },
    instagram: { key: 'instagram', name: 'Instagram', limit: 2200, trunc: 125, urlCost: 0, hashtagAdvice: 30 },
    x: { key: 'x', name: 'X', limit: 280, trunc: 280, urlCost: 23, hashtagAdvice: 2 },
    linkedin: { key: 'linkedin', name: 'LinkedIn', limit: 3000, trunc: 210, urlCost: 0, hashtagAdvice: 5 },
    tiktok: { key: 'tiktok', name: 'TikTok', limit: 2200, trunc: 150, urlCost: 0, hashtagAdvice: 5 },
    youtube: { key: 'youtube', name: 'YouTube', limit: 5000, trunc: 157, urlCost: 0, hashtagAdvice: 15 }
  };
  function normPlat(p) {
    p = String(p == null ? '' : p).toLowerCase().trim();
    return p === 'twitter' ? 'x' : p;
  }
  function netFor(p) { return NET[normPlat(p)] || null; }

  var URL_RE = /https?:\/\/[^\s]+/g;

  /**
   * Length as a human sees it, not as UTF-16 does.
   * "👨‍👩‍👧" is one character to a person and eleven to `String.length`; a
   * counter that says 11 makes the composer look broken. Array.from splits on
   * code points, and the ZWJ pass folds joined emoji into one unit.
   */
  function graphemes(s) {
    var t = String(s == null ? '' : s);
    if (!t) return 0;
    var arr = Array.from(t);
    var n = 0;
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (c === '\u200d') { n--; continue; }                 // ZWJ binds the next unit to the last
      if (c >= '\ufe00' && c <= '\ufe0f') continue;          // variation selectors are invisible
      if (c >= '\u{1f3fb}' && c <= '\u{1f3ff}') continue;  // skin-tone modifiers
      n++;
    }
    return n < 0 ? 0 : n;
  }

  /**
   * How a given network will count this text.
   * X replaces every link with a t.co of fixed width, so a 200-character post
   * with two long URLs may be *under* the limit even though String.length is
   * over it. Every other network counts the URL as written.
   */
  function countFor(platform, text) {
    var n = netFor(platform);
    var raw = String(text == null ? '' : text);
    if (!n) return { platform: normPlat(platform), name: normPlat(platform), chars: graphemes(raw), limit: null, over: false, remaining: null, urls: 0 };
    var urls = raw.match(URL_RE) || [];
    var counted = raw;
    if (n.urlCost) {
      counted = raw.replace(URL_RE, function () {
        var pad = '';
        for (var i = 0; i < n.urlCost; i++) pad += 'x';
        return pad;
      });
    }
    var chars = graphemes(counted);
    return {
      platform: n.key,
      name: n.name,
      chars: chars,
      limit: n.limit,
      over: chars > n.limit,
      warn: chars > n.limit * 0.9 && chars <= n.limit,
      remaining: n.limit - chars,
      urls: urls.length,
      urlCost: n.urlCost
    };
  }

  /** Hashtags and mentions actually present in a body. */
  function hashtagsIn(text) {
    var m = String(text == null ? '' : text).match(/#[\p{L}0-9_]+/gu);
    return m ? m.map(function (t) { return t.toLowerCase(); }) : [];
  }
  function mentionsIn(text) {
    var m = String(text == null ? '' : text).match(/@[\p{L}0-9_.]+/gu);
    return m || [];
  }
  function urlsIn(text) {
    var m = String(text == null ? '' : text).match(URL_RE);
    return m || [];
  }

  /* ================= queue slots ================= */
  /*
   * A slot row is { id, weekday:0-6 (0=Sun), minute: minutes-past-midnight,
   * tz, active }. slot_list returns them for the workspace.
   */
  function activeSlots(slots) {
    return (slots || []).filter(function (s) {
      return s && s.active !== false &&
        isFinite(Number(s.weekday)) && isFinite(Number(s.minute));
    });
  }

  /**
   * The next `count` slot occurrences after `from`, in chronological order.
   * Walks forward day by day rather than doing modular arithmetic, because the
   * modular version gets DST wrong twice a year and nobody notices until a post
   * goes out an hour late.
   */
  function nextSlotTimes(slots, from, count, horizonDays) {
    var act = activeSlots(slots);
    var out = [];
    if (!act.length) return out;
    var start = from ? new Date(from.getTime()) : new Date();
    var horizon = horizonDays || 28;
    for (var d = 0; d <= horizon && out.length < (count || 3); d++) {
      var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d, 0, 0, 0, 0);
      var todays = act.filter(function (s) { return Number(s.weekday) === day.getDay(); })
        .sort(function (a, b) { return Number(a.minute) - Number(b.minute); });
      for (var i = 0; i < todays.length && out.length < (count || 3); i++) {
        var mins = Number(todays[i].minute) || 0;
        var when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);
        if (when.getTime() > start.getTime()) out.push({ when: when, slot: todays[i] });
      }
    }
    return out;
  }

  /** The date a post occupies: scheduled, else published, else created. */
  function postWhen(p) {
    if (!p) return null;
    var s = p.scheduled_at || p.published_at || p.created_at;
    if (!s) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Channel ids/platforms attached to a post, normalised to an array. */
  function postChannels(p) {
    var c = p && p.channels;
    if (!c) return [];
    if (Array.isArray(c)) return c.slice();
    if (typeof c === 'string') {
      try {
        var j = JSON.parse(c);
        if (Array.isArray(j)) return j;
      } catch (e) { /* not JSON — treat as a single id */ }
      return [c];
    }
    return [];
  }

  /**
   * Slots with nothing already scheduled in them — what "add to queue" should
   * actually use. Tolerance is in minutes: a post at 09:02 counts as filling
   * the 09:00 slot.
   */
  function nextOpenSlotTimes(slots, posts, from, count, toleranceMin) {
    var tol = (toleranceMin == null ? 5 : toleranceMin) * MIN;
    var taken = (posts || []).map(postWhen).filter(Boolean).map(function (d) { return d.getTime(); });
    var candidates = nextSlotTimes(slots, from, (count || 3) + taken.length + 8, 42);
    var out = [];
    for (var i = 0; i < candidates.length && out.length < (count || 3); i++) {
      var t = candidates[i].when.getTime();
      var busy = taken.some(function (x) { return Math.abs(x - t) <= tol; });
      if (!busy) out.push(candidates[i]);
    }
    return out;
  }

  /**
   * Posts that collide with a proposed time on a shared channel.
   * Two posts to the same account minutes apart is the classic scheduling
   * mistake: both go out, the second buries the first, and the analytics for
   * both look bad.
   */
  function conflicts(posts, when, channels, windowMin, excludeId) {
    if (!when) return [];
    var w = (windowMin == null ? 30 : windowMin) * MIN;
    var mine = (channels || []).map(function (c) { return String(c); });
    var t = when.getTime();
    return (posts || []).filter(function (p) {
      if (!p) return false;
      if (excludeId != null && String(p.id) === String(excludeId)) return false;
      var st = String(p.status || '').toLowerCase();
      if (st === 'draft' || st === 'failed' || st === 'error') return false;
      var pd = postWhen(p);
      if (!pd) return false;
      if (Math.abs(pd.getTime() - t) > w) return false;
      if (!mine.length) return true;
      var theirs = postChannels(p).map(function (c) { return String(c); });
      if (!theirs.length) return false;
      return theirs.some(function (c) { return mine.indexOf(c) !== -1; });
    });
  }

  /* ================= cadence / analytics (all derived from real posts) ================= */

  /**
   * Posting rhythm over a window. Nothing here is invented: it is arithmetic on
   * the timestamps the backend returned. `gapDays` is the longest silence, which
   * is the single most useful number a small business can see.
   */
  function cadence(posts, fromMs, toMs) {
    var times = (posts || []).map(postWhen).filter(Boolean)
      .map(function (d) { return d.getTime(); })
      .filter(function (t) { return t >= fromMs && t <= toMs; })
      .sort(function (a, b) { return a - b; });
    var weeks = Math.max(1, (toMs - fromMs) / (7 * DAY));
    var longest = 0, longestFrom = null;
    for (var i = 1; i < times.length; i++) {
      var gap = times[i] - times[i - 1];
      if (gap > longest) { longest = gap; longestFrom = times[i - 1]; }
    }
    // the silence between the last post and the end of the window counts too
    if (times.length) {
      var tail = toMs - times[times.length - 1];
      if (tail > longest) { longest = tail; longestFrom = times[times.length - 1]; }
    }
    var byDow = [0, 0, 0, 0, 0, 0, 0];
    var byHour = [];
    for (var h = 0; h < 24; h++) byHour.push(0);
    times.forEach(function (t) {
      var d = new Date(t);
      byDow[d.getDay()]++;
      byHour[d.getHours()]++;
    });
    return {
      total: times.length,
      perWeek: times.length / weeks,
      longestGapDays: times.length ? longest / DAY : null,
      longestGapFrom: longestFrom,
      byDow: byDow,
      byHour: byHour,
      first: times.length ? times[0] : null,
      last: times.length ? times[times.length - 1] : null
    };
  }

  /** How well the queue is actually being used. Tolerance in minutes. */
  function slotAdherence(posts, slots, toleranceMin) {
    var act = activeSlots(slots);
    var tol = (toleranceMin == null ? 10 : toleranceMin);
    var considered = 0, onSlot = 0;
    (posts || []).forEach(function (p) {
      var d = postWhen(p);
      if (!d) return;
      considered++;
      var mins = d.getHours() * 60 + d.getMinutes();
      var hit = act.some(function (s) {
        return Number(s.weekday) === d.getDay() && Math.abs(Number(s.minute) - mins) <= tol;
      });
      if (hit) onSlot++;
    });
    return {
      slots: act.length,
      considered: considered,
      onSlot: onSlot,
      offSlot: considered - onSlot,
      pct: considered ? (onSlot / considered) * 100 : null
    };
  }

  /**
   * What the posts are actually made of. Real counts only.
   * `resolve` maps whatever sits in post.channels onto a platform. Posts store
   * channel IDs ("ch-7f3"), not platform names, so without it every chart ends
   * up labelled "Ch-7f3" — which is what shipped before this argument existed.
   */
  function contentAnatomy(posts, resolve) {
    var byNet = {};
    var totals = { posts: 0, withMedia: 0, withLink: 0, withHashtag: 0, chars: 0, hashtags: 0 };
    var tagCounts = {};
    (posts || []).forEach(function (p) {
      if (!p) return;
      var body = String(p.body || '');
      var tags = hashtagsIn(body);
      var links = urlsIn(body);
      var media = Array.isArray(p.media) ? p.media : [];
      totals.posts++;
      totals.chars += graphemes(body);
      totals.hashtags += tags.length;
      if (media.length) totals.withMedia++;
      if (links.length) totals.withLink++;
      if (tags.length) totals.withHashtag++;
      tags.forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; });
      postChannels(p).forEach(function (c) {
        var raw = typeof c === 'string' ? c : (c && (c.platform || c.id)) || '';
        if (typeof resolve === 'function' && !NET[normPlat(raw)]) raw = resolve(raw) || raw;
        var key = normPlat(raw);
        var n = NET[key];
        var bucket = byNet[key] || (byNet[key] = { key: key, name: n ? n.name : key, posts: 0, chars: 0, media: 0, links: 0, hashtags: 0 });
        bucket.posts++;
        bucket.chars += graphemes(body);
        if (media.length) bucket.media++;
        bucket.links += links.length;
        bucket.hashtags += tags.length;
      });
    });
    var nets = Object.keys(byNet).map(function (k) {
      var b = byNet[k];
      b.avgChars = b.posts ? Math.round(b.chars / b.posts) : null;
      return b;
    }).sort(function (a, b) { return b.posts - a.posts; });
    var topTags = Object.keys(tagCounts).map(function (t) { return { tag: t, count: tagCounts[t] }; })
      .sort(function (a, b) { return b.count - a.count || (a.tag < b.tag ? -1 : 1); });
    return {
      totals: totals,
      avgChars: totals.posts ? Math.round(totals.chars / totals.posts) : null,
      nets: nets,
      topTags: topTags
    };
  }

  /* ================= local time, said out loud ================= */
  function tzName() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz || 'local time';
    } catch (e) { return 'local time'; }
  }
  function tzOffsetLabel(d) {
    var mins = -(d || new Date()).getTimezoneOffset();
    var sign = mins < 0 ? '-' : '+';
    var a = Math.abs(mins);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'UTC' + sign + p(Math.floor(a / 60)) + ':' + p(a % 60);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function localInputValue(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fromLocalInput(v) {
    var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  function fromDateTimeInputs(dateStr, timeStr) {
    var dm = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dm) return null;
    var tm = String(timeStr || '00:00').match(/^(\d{1,2}):(\d{2})$/);
    if (!tm) return null;
    var d = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2], 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  /* ================= UTM / link building ================= */
  /**
   * Append UTM parameters without destroying what is already on the URL.
   * String concatenation gets this wrong the moment a URL already has a query
   * or a #fragment, so the fragment is split off and re-attached.
   */
  function utmUrl(url, utm) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var hash = '';
    var hi = raw.indexOf('#');
    if (hi !== -1) { hash = raw.slice(hi); raw = raw.slice(0, hi); }
    var pairs = [];
    ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) {
      var v = utm && utm[k] != null ? String(utm[k]).trim() : '';
      if (v) pairs.push('utm_' + k + '=' + encodeURIComponent(v));
    });
    if (!pairs.length) return raw + hash;
    var joiner = raw.indexOf('?') === -1 ? '?' : '&';
    return raw + joiner + pairs.join('&') + hash;
  }

  /* ================= CSV ================= */
  /** Minimal RFC-4180-ish parser: quoted fields, embedded commas and quotes. */
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
    return rows.filter(function (r) { return r.length && !(r.length === 1 && r[0].trim() === ''); });
  }

  /* ================= draft autosave ================= */
  /*
   * The composer is the one place in the suite where losing work hurts. Drafts
   * are mirrored to localStorage on every keystroke (debounced by the caller)
   * and offered back on the next mount. Never silently restored — a surprise
   * body in the box is worse than losing it.
   */
  function draftKey(ws) { return 'zoi_composer_draft_' + String(ws || 'default'); }
  function saveDraft(ws, draft, store) {
    var s = store || (global.localStorage);
    if (!s) return false;
    try {
      s.setItem(draftKey(ws), JSON.stringify({ at: Date.now(), draft: draft }));
      return true;
    } catch (e) { return false; }
  }
  function loadDraft(ws, store) {
    var s = store || (global.localStorage);
    if (!s) return null;
    try {
      var raw = s.getItem(draftKey(ws));
      if (!raw) return null;
      var j = JSON.parse(raw);
      if (!j || !j.draft) return null;
      return j;
    } catch (e) { return null; }
  }
  function clearDraft(ws, store) {
    var s = store || (global.localStorage);
    if (!s) return false;
    try { s.removeItem(draftKey(ws)); return true; } catch (e) { return false; }
  }

  /** Is a stored draft worth offering back? Empty shells are not. */
  function draftIsMeaningful(draft) {
    if (!draft) return false;
    var body = String(draft.body || '').trim();
    var media = Array.isArray(draft.media) ? draft.media : [];
    return body.length >= 3 || media.length > 0;
  }

  /* ================= handoff between modules ================= */
  /*
   * "Draft this feast" lives in the Calendar; the editor lives in the Composer.
   * The suite shell is a single page with one module mounted at a time, so the
   * handoff goes through localStorage and the shell's own nav item. If the nav
   * item cannot be found the draft is still saved, and the user is told where
   * to find it — never a silent no-op.
   */
  var HANDOFF_KEY = 'zoi_composer_handoff';
  function setHandoff(payload, store) {
    var s = store || global.localStorage;
    if (!s) return false;
    try { s.setItem(HANDOFF_KEY, JSON.stringify(payload || {})); return true; } catch (e) { return false; }
  }
  function takeHandoff(store) {
    var s = store || global.localStorage;
    if (!s) return null;
    try {
      var raw = s.getItem(HANDOFF_KEY);
      if (!raw) return null;
      s.removeItem(HANDOFF_KEY);
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  global.ZoiSchedule = {
    version: '1.0.0',
    NET: NET,
    normPlat: normPlat,
    netFor: netFor,
    graphemes: graphemes,
    countFor: countFor,
    hashtagsIn: hashtagsIn,
    mentionsIn: mentionsIn,
    urlsIn: urlsIn,
    activeSlots: activeSlots,
    nextSlotTimes: nextSlotTimes,
    nextOpenSlotTimes: nextOpenSlotTimes,
    postWhen: postWhen,
    postChannels: postChannels,
    conflicts: conflicts,
    cadence: cadence,
    slotAdherence: slotAdherence,
    contentAnatomy: contentAnatomy,
    tzName: tzName,
    tzOffsetLabel: tzOffsetLabel,
    localInputValue: localInputValue,
    fromLocalInput: fromLocalInput,
    fromDateTimeInputs: fromDateTimeInputs,
    utmUrl: utmUrl,
    parseCSV: parseCSV,
    draftKey: draftKey,
    saveDraft: saveDraft,
    loadDraft: loadDraft,
    clearDraft: clearDraft,
    draftIsMeaningful: draftIsMeaningful,
    HANDOFF_KEY: HANDOFF_KEY,
    setHandoff: setHandoff,
    takeHandoff: takeHandoff
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

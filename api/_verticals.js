/**
 * _verticals.js — what each kind of listing actually needs.
 *
 * A church is not a bakery is not a law firm is not a bouzouki player. Giving
 * all of them "Address / Phone / Website" is why the directory felt like Yellow
 * Pages. This module defines, per vertical, the page a professional in that
 * field would have built for themselves: its vocabulary, its primary actions,
 * its content sections, and the specific capabilities it unlocks on claiming.
 *
 * HONESTY CONTRACT
 * Sections render ONLY from data we actually hold — the entity row and its
 * `profile` JSONB. Nothing is invented: no service times we don't know, no menu
 * we've never seen, no follower counts. Where a section has no data, the page
 * does not fake it; it names the capability in the claim panel instead. That is
 * also the conversion engine: the owner sees exactly what their page becomes.
 *
 * The `profile` JSONB is the forward contract. Keys are documented per vertical
 * below so the suite can start writing them and the page renders immediately.
 * (Filename is underscore-prefixed so Vercel treats it as a lib, not a route.)
 */

import { orthodoxPascha, iso, feastsOn, seasonsFor, isFastDay, nameDaysOn,
  upcomingFeasts, resolveFeastDate, shiftForOldCalendar } from './_orthocal.js';

/* ---------------- tiny helpers ---------------- */
export function esc(s) {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const A = (s) => esc(s);
function str(v) { return v == null ? '' : String(v).trim(); }
function arr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
function telHref(p) { return 'tel:' + String(p || '').replace(/[^0-9+]/g, ''); }
function httpish(u) { u = str(u); return /^https?:\/\//i.test(u) ? u : (u ? 'https://' + u : ''); }

export const IC = {
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>',
  pin: '<path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  cal: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M8 3v3M16 3v3M3 10h18"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m21 7-9 6L3 7"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 7h7M8 11h7"/>',
  heart: '<path d="M20.8 5.6a5.4 5.4 0 0 0-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 1 0-7.7 7.7L12 21.8l8.8-8.5a5.4 5.4 0 0 0 0-7.7z"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
  ticket: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4z"/>',
  menu: '<path d="M6 3v18M18 3v18M6 8h12M6 14h12"/>',
  scale: '<path d="M12 3v18M5 7h14M7 7l-3 6h6zM17 7l-3 6h6z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.2 1.1 6-5.3-3.1L6.7 19.5l1.1-6L3.4 9.3l6-.7z"/>',
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.4 12h11.2L21 7H6"/>',
  cap: '<path d="M2.5 8.5L12 4l9.5 4.5L12 13z"/><path d="M6 10.5V17c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-6.5"/>',
  cross: '<path d="M12 2.5v19M6.5 8h11"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
  camera: '<rect x="2.5" y="6.5" width="19" height="14" rx="2.5"/><circle cx="12" cy="13.5" r="4"/><path d="M8 6.5l1.5-3h5l1.5 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5a2.5 2.5 0 0 1-2.5 4"/><path d="M12 14v3M8.5 20.5h7"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
};
export function icon(d, cls) {
  return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
}

/* ================= shared primitives =================
 * Conventions that apply to every vertical, implemented once.
 */

/* HONESTY GUARD. An owner-editable JSONB blob must never be able to inject a
 * rating, a review or a review count — those would flow into JSON-LD as
 * unverifiable claims (and a Google policy violation). Ratings come from the
 * entity row alone. Stripped before anything is rendered. */
const BANNED_PROFILE_KEYS = /^(rating|rating_count|ratingvalue|reviewcount|aggregaterating|reviews?|stars|score)$/i;
/* Reserved namespaces inside `profile`. Neither is display data:
 *   _enrich  machine-derived from the business's own website (see
 *            supabase/functions/zoi-enrich). Used as a FALLBACK only.
 *   _geo     coordinate precision, written by the geocode backfill.
 * Plus the bookkeeping keys the enrichment writer adds alongside its fields. */
const RESERVED_PROFILE_KEYS = new Set(['_enrich', '_geo', '_meta']);
const ENRICH_META_KEYS = new Set(['provenance', 'source_url', 'checked_at',
                                  'blocked', 'blocked_reason', 'last_error']);

/**
 * The profile a page should render.
 *
 * Owner-supplied keys win outright. Anything the owner has not filled in falls
 * back to what the business's own website said, and that fallback is *labelled*
 * — `_from` records which keys are machine-derived and where each came from, so
 * a page can say "hours from their website, checked 12 June" instead of
 * implying a human confirmed it. That distinction is the whole reason owner and
 * machine writes are stored separately.
 */
export function safeProfile(e) {
  const raw = (e && e.profile && typeof e.profile === 'object' && !Array.isArray(e.profile)) ? e.profile : {};
  const enr = (raw._enrich && typeof raw._enrich === 'object' && !Array.isArray(raw._enrich)) ? raw._enrich : {};
  const out = {};

  // Enrichment first, so an owner key written afterwards overwrites it.
  for (const k of Object.keys(enr)) {
    if (BANNED_PROFILE_KEYS.test(k) || ENRICH_META_KEYS.has(k) || RESERVED_PROFILE_KEYS.has(k)) continue;
    out[k] = enr[k];
  }
  for (const k of Object.keys(raw)) {
    if (BANNED_PROFILE_KEYS.test(k) || RESERVED_PROFILE_KEYS.has(k)) continue;
    out[k] = raw[k];
  }

  // Which of the surviving keys nobody at the business typed.
  const prov = (enr.provenance && typeof enr.provenance === 'object') ? enr.provenance : {};
  const from = {};
  for (const k of Object.keys(enr)) {
    if (!(k in out)) continue;
    if (Object.prototype.hasOwnProperty.call(raw, k)) continue;   // owner's own
    from[k] = prov[k] || 'website';
  }
  // Non-enumerable so this metadata can never be mistaken for a profile field,
  // serialised into JSON-LD, or iterated over by a renderer.
  Object.defineProperty(out, '_from', { value: from, enumerable: false });
  Object.defineProperty(out, '_checked', { value: str(enr.checked_at) || null, enumerable: false });
  Object.defineProperty(out, '_source', { value: str(enr.source_url) || null, enumerable: false });
  return out;
}

/**
 * One honest line about machine-derived detail, or nothing at all.
 * Says where it came from and when, and never claims verification.
 */
export function provenanceNote(p) {
  const keys = Object.keys((p && p._from) || {});
  if (!keys.length) return '';
  let host = '';
  try { host = new URL(p._source).hostname.replace(/^www\./, ''); } catch { host = ''; }
  const when = p._checked ? niceDay(p._checked) : '';
  const what = keys.length === 1 ? 'One detail' : keys.length + ' details';
  return '<p class="prov">' + what + ' on this page ' +
    (keys.length === 1 ? 'was' : 'were') + ' read from ' +
    (host ? esc(host) : 'the business\u2019s own website') +
    (when ? ' on ' + esc(when) : '') +
    ', not confirmed by them. ' +
    '<a href="/social">Claim this listing</a> to correct anything.</p>';
}

function niceDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return String(Number(m[3])) + ' ' + MON[Number(m[2]) - 1] + ' ' + m[1];
}

/* Bilingual convention: any display string may carry an `_el` sibling.
 * We never machine-translate; we show what the owner wrote. */
export function bi(obj, key) {
  const en = str(obj && obj[key]);
  const el = str(obj && obj[key + '_el']);
  if (en && el) return esc(en) + ' <span lang="el" class="bi-el">' + esc(el) + '</span>';
  if (en) return esc(en);
  if (el) return '<span lang="el">' + esc(el) + '</span>';
  return '';
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const DAY_SCHEMA = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
function hhmm(v) { const m = /^(\d{1,2}):(\d{2})$/.exec(str(v)); return m ? (m[1].padStart(2, '0') + ':' + m[2]) : ''; }

/* Machine hours -> display, grouping consecutive identical days:
 * "Mon–Thu 17:00–23:00". Takes [{day,open,close,note}]. */
export function hoursBlock(hours) {
  const rows = arr(hours).map((h) => ({
    day: str(h.day).slice(0, 3).toLowerCase(),
    open: hhmm(h.open), close: hhmm(h.close), note: str(h.note),
  })).filter((h) => DAYS.indexOf(h.day) >= 0 && h.open && h.close);
  if (!rows.length) return '';
  const byDay = {};
  rows.forEach((r) => { (byDay[r.day] = byDay[r.day] || []).push(r); });
  const sig = (d) => (byDay[d] || []).map((r) => r.open + '-' + r.close + '|' + r.note).join(',');
  const groups = [];
  for (const d of DAYS) {
    if (!byDay[d]) { groups.push({ days: [d], closed: true }); continue; }
    const last = groups[groups.length - 1];
    if (last && !last.closed && sig(last.days[0]) === sig(d)) last.days.push(d);
    else groups.push({ days: [d], closed: false });
  }
  // merge runs of closed days too
  const merged = [];
  for (const g of groups) {
    const last = merged[merged.length - 1];
    if (last && last.closed && g.closed) last.days.push(...g.days);
    else merged.push(g);
  }
  return '<div class="sched">' + merged.map((g) => {
    const label = g.days.length > 1
      ? DAY_LABEL[g.days[0]] + '–' + DAY_LABEL[g.days[g.days.length - 1]]
      : DAY_LABEL[g.days[0]];
    if (g.closed) {
      return '<div class="schrow closed"><span class="schday">' + label + '</span>' +
        '<span class="schlabel">Closed</span><span class="schtime"></span></div>';
    }
    const spans = byDay[g.days[0]];
    return '<div class="schrow"><span class="schday">' + label + '</span>' +
      '<span class="schlabel">' + spans.map((r) => esc(r.open + '–' + r.close)).join(', ') +
      (spans[0].note ? '<em>' + esc(spans[0].note) + '</em>' : '') + '</span>' +
      '<span class="schtime"></span></div>';
  }).join('') + '</div>';
}

/* Open-now, computed server-side in the venue's own timezone.
 * A browser clock cannot be trusted for this and a wrong "Open" is a lie.
 * Returns true | false | null (null = we cannot say). */
export function openNow(hours, timezone) {
  const rows = arr(hours);
  if (!rows.length) return null;
  const tz = str(timezone);
  if (!tz) return null;
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
  } catch (e) { return null; }
  const get = (t) => (parts.find((x) => x.type === t) || {}).value || '';
  const wd = get('weekday').slice(0, 3).toLowerCase();
  const nowMin = (parseInt(get('hour'), 10) || 0) * 60 + (parseInt(get('minute'), 10) || 0);
  const idx = DAYS.indexOf(wd);
  if (idx < 0) return null;
  const prevDay = DAYS[(idx + 6) % 7];
  const toMin = (v) => { const m = /^(\d{2}):(\d{2})$/.exec(hhmm(v)); return m ? (+m[1] * 60 + +m[2]) : null; };
  for (const h of rows) {
    const d = str(h.day).slice(0, 3).toLowerCase();
    const o = toMin(h.open), c = toMin(h.close);
    if (o == null || c == null) continue;
    if (c > o) { if (d === wd && nowMin >= o && nowMin < c) return true; }
    else {
      // spans midnight
      if (d === wd && nowMin >= o) return true;
      if (d === prevDay && nowMin < c) return true;
    }
  }
  return false;
}

/* Seasonal gating, in the listing's timezone. An item whose window has passed
 * is not rendered and not emitted as an offer — an expired offer is a false
 * claim about what you can buy today. */
export function todayISO(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: str(timezone) || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch (e) { return new Date().toISOString().slice(0, 10); }
}
export function inSeason(item, timezone) {
  const today = todayISO(timezone);
  const from = str(item && item.from), to = str(item && item.to);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from) && today < from) return false;
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to) && today > to) return false;
  return true;
}
export function seasonOf(list, timezone) {
  return arr(list).filter((i) => inSeason(i, timezone));
}

/* Visible freshness stamp. A menu nobody has touched in two years is the main
 * way a page starts lying, so we date it instead of hiding it. */
export function freshness(dateStr, label) {
  const d = str(dateStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  let when = d;
  try {
    when = new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch (e) { /* keep the ISO date */ }
  return '<p class="fresh">' + esc((label || 'Updated') + ' ' + when) + '</p>';
}

/* ---------------- shared section builders ---------------- */
function panel(title, iconPath, bodyHtml, opts) {
  if (!bodyHtml) return '';
  opts = opts || {};
  return '<section class="sec' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.id ? ' id="' + A(opts.id) + '"' : '') + '>' +
    '<h2>' + (iconPath ? icon(iconPath, 'sech') : '') + esc(title) + '</h2>' +
    (opts.sub ? '<p class="secsub">' + esc(opts.sub) + '</p>' : '') +
    bodyHtml + '</section>';
}

/* A weekly schedule: profile.schedule = [{day,label,time,note}] */
function scheduleBlock(list) {
  list = arr(list);
  if (!list.length) return '';
  return '<div class="sched">' + list.map((s) => {
    const day = esc(str(s.day) || str(s.when));
    const label = esc(str(s.label) || str(s.name));
    const time = esc(str(s.time));
    if (!day && !label && !time) return '';
    return '<div class="schrow"><span class="schday">' + day + '</span>' +
      '<span class="schlabel">' + label + (s.note ? '<em>' + esc(str(s.note)) + '</em>' : '') + '</span>' +
      '<span class="schtime">' + time + '</span></div>';
  }).join('') + '</div>';
}

/* Named people: profile.people = [{name,role,photo,email}] */
function peopleBlock(list) {
  list = arr(list);
  if (!list.length) return '';
  return '<div class="ppl">' + list.map((pp) => {
    const n = esc(str(pp.name)); if (!n) return '';
    return '<div class="pcard">' +
      (str(pp.photo) ? '<img src="' + A(httpish(pp.photo)) + '" alt="" loading="lazy">' : '<span class="pav">' + esc(n.charAt(0).toUpperCase()) + '</span>') +
      '<div><b>' + n + '</b>' + (str(pp.role) ? '<span>' + esc(str(pp.role)) + '</span>' : '') + '</div></div>';
  }).join('') + '</div>';
}

/* Simple labelled list: profile.x = ["a","b"] or [{name,note}] */
function chipList(list) {
  list = arr(list);
  if (!list.length) return '';
  return '<div class="chips">' + list.map((v) => {
    const t = typeof v === 'string' ? v : str(v.name || v.label);
    return t ? '<span class="pill">' + esc(t) + '</span>' : '';
  }).join('') + '</div>';
}

/* Priced items: profile.menu = [{section,items:[{name,price,note}]}] */
function menuBlock(sections) {
  sections = arr(sections);
  if (!sections.length) return '';
  return sections.map((sec) => {
    const items = arr(sec.items);
    if (!items.length) return '';
    return '<div class="mgroup"><h3>' + esc(str(sec.section) || str(sec.name)) + '</h3>' +
      items.map((it) => {
        const n = esc(str(it.name)); if (!n) return '';
        return '<div class="mitem"><span><b>' + n + '</b>' +
          (str(it.note) ? '<em>' + esc(str(it.note)) + '</em>' : '') + '</span>' +
          (str(it.price) ? '<span class="mprice">' + esc(str(it.price)) + '</span>' : '') + '</div>';
      }).join('') + '</div>';
  }).join('');
}

/* Dated things: profile.dates = [{date,title,note,url}] */
function datesBlock(list, ctaLabel) {
  list = arr(list);
  if (!list.length) return '';
  return '<div class="dates">' + list.map((d) => {
    const t = esc(str(d.title) || str(d.name)); if (!t) return '';
    const when = esc(str(d.date) || str(d.when));
    const href = httpish(d.url);
    return '<div class="drow"><span class="dwhen">' + when + '</span>' +
      '<span class="dwhat"><b>' + t + '</b>' + (str(d.note) ? '<em>' + esc(str(d.note)) + '</em>' : '') + '</span>' +
      (href ? '<a class="btn btn-ghost btn-xs" href="' + A(href) + '" rel="noopener" target="_blank">' + esc(ctaLabel || 'Details') + '</a>' : '') +
      '</div>';
  }).join('') + '</div>';
}

/* Streaming / listen links: profile.listen = {spotify,apple,youtube,bandcamp,soundcloud} */
const LISTEN = [['spotify', 'Spotify'], ['apple', 'Apple Music'], ['youtube', 'YouTube'],
  ['bandcamp', 'Bandcamp'], ['soundcloud', 'SoundCloud'], ['deezer', 'Deezer']];
function listenBlock(obj) {
  obj = obj && typeof obj === 'object' ? obj : {};
  const out = LISTEN.map(([k, label]) => {
    const u = httpish(obj[k]);
    return u ? '<a class="btn btn-ghost" href="' + A(u) + '" rel="noopener" target="_blank">' + icon(IC.play) + esc(label) + '</a>' : '';
  }).filter(Boolean);
  return out.length ? '<div class="acts">' + out.join('') + '</div>' : '';
}

function gallery(list) {
  list = arr(list);
  if (!list.length) return '';
  return '<div class="gal">' + list.slice(0, 12).map((u) => {
    const h = httpish(typeof u === 'string' ? u : u.url);
    return h ? '<img src="' + A(h) + '" alt="" loading="lazy" decoding="async">' : '';
  }).join('') + '</div>';
}

function prose(text, cls) {
  const t = str(text);
  return t ? '<p class="' + (cls || 'secp') + '">' + esc(t) + '</p>' : '';
}

/* ---------------- the liturgical day ----------------
 * This is the one section on a parish page that is useful before the parish has
 * typed a single character: today's commemoration, the name days to greet, the
 * fast, and what is coming. All computed from the Paschalion, not supplied.
 */
function fmtDate(dateISO, todayISO) {
  // Show the year whenever the date is not in the current year — "Sunday 2 May"
  // is ambiguous for something eight months out.
  const sameYear = todayISO && String(dateISO).slice(0, 4) === String(todayISO).slice(0, 4);
  try {
    return new Date(dateISO + 'T00:00:00Z').toLocaleDateString('en-GB', Object.assign(
      { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' },
      sameYear ? {} : { year: 'numeric' }));
  } catch (e) { return dateISO; }
}
export function liturgicalBlock(e, p) {
  const style = str(p.calendar_style) === 'old' ? 'old' : 'new';
  let today;
  try {
    today = new Intl.DateTimeFormat('en-CA', {
      timeZone: str(p.timezone) || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch (err) { today = new Date().toISOString().slice(0, 10); }

  // A Julian-calendar parish keeps fixed feasts 13 days later, so we look up the
  // civil date shifted back to find what they are commemorating today.
  const lookup = style === 'old' ? shiftForOldCalendar(today, 'old') : today;
  const feasts = feastsOn(lookup).filter((f) => !f.civic);
  const names = nameDaysOn(lookup);
  const fast = isFastDay(lookup);
  const seasons = seasonsFor(lookup);

  const season = seasons.includes('holy_week') ? 'Holy Week'
    : seasons.includes('great_lent') ? 'Great Lent'
    : seasons.includes('bright_week') ? 'Bright Week'
    : seasons.includes('dormition_fast') ? 'the Dormition Fast'
    : seasons.includes('nativity_fast') ? 'the Nativity Fast'
    : seasons.includes('apostles_fast') ? 'the Apostles Fast'
    : seasons.includes('triodion') ? 'the Triodion' : '';

  let rows = '';
  if (feasts.length) {
    rows += '<div class="litrow"><span class="litk">Today</span><span class="litv">' +
      feasts.map((f) => esc(f.name)).join(' &middot; ') + '</span></div>';
  }
  if (names.length) {
    rows += '<div class="litrow"><span class="litk">Name days</span><span class="litv">' +
      '<b>\u03a7\u03c1\u03cc\u03bd\u03b9\u03b1 \u03c0\u03bf\u03bb\u03bb\u03ac</b> to ' +
      names.map((n) => esc(n)).join(', ') + '</span></div>';
  }
  rows += '<div class="litrow"><span class="litk">Fasting</span><span class="litv">' +
    (fast ? 'Today is a fast day' : 'No fast today') +
    (season ? ' &middot; we are in ' + esc(season) : '') + '</span></div>';

  // Pascha is the anchor everything else moves with — worth stating plainly.
  const y = Number(today.slice(0, 4));
  const pascha = iso(orthodoxPascha(y));
  const paschaShown = pascha >= today ? pascha : iso(orthodoxPascha(y + 1));
  rows += '<div class="litrow"><span class="litk">Pascha</span><span class="litv">' +
    esc(fmtDate(paschaShown, today)) + '</span></div>';

  // the patronal feast, if the parish named one
  const pf = p.patronal_feast;
  if (pf && (str(pf.saint) || str(pf.date))) {
    const d = resolveFeastDate(pf, y) || resolveFeastDate(pf, y + 1);
    const when = d && d >= today ? d : resolveFeastDate(pf, y + 1);
    rows += '<div class="litrow"><span class="litk">Patronal feast</span><span class="litv">' +
      (str(pf.saint) ? esc(str(pf.saint)) : '') +
      (str(pf.saint_el) ? ' <span lang="el">' + esc(str(pf.saint_el)) + '</span>' : '') +
      (when ? ' &middot; ' + esc(fmtDate(when, today)) : '') + '</span></div>';
  }

  let html = '<div class="lit">' + rows + '</div>';

  // what is coming, from the calendar not from the blob
  const up = upcomingFeasts(today, 75).filter((f) => !f.civic).slice(0, 6);
  if (up.length) {
    html += '<div class="dates" style="margin-top:14px">' + up.map((f) =>
      '<div class="drow"><span class="dwhen">' + esc(fmtDate(f.date, today).replace(/^\w+,\s*/, '')) +
      '</span><span class="dwhat"><b>' + esc(f.name) + '</b></span></div>').join('') + '</div>';
  }
  return html;
}

/* ---------------- the verticals ---------------- */
/* Each: noun (what the owner calls themselves), actions(), sections(), unlock[] */

const CHURCH = {
  key: 'church',
  noun: 'parish',
  eyebrow: (e) => 'Orthodox parish',
  /* profile: {schedule[], clergy[], sacraments[], giving{url,note}, livestream,
     bulletin, ministries[], hall{note,url}, festival{name,date,url}, office_hours } */
  actions(e, p) {
    const out = [];
    if (str(p.livestream)) out.push({ label: 'Watch the Liturgy live', href: httpish(p.livestream), icon: IC.play, primary: true, external: true });
    if (p.giving && str(p.giving.url)) out.push({ label: 'Give / stewardship', href: httpish(p.giving.url), icon: IC.heart, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('The liturgical day', IC.cross, liturgicalBlock(e, p),
      { id: 'today', sub: 'Computed from the Paschalion \u2014 not supplied by the parish.' });
    h += panel('Service times', IC.clock, scheduleBlock(p.schedule), { id: 'services', sub: 'Divine Liturgy, Orthros and Vespers.' });
    h += panel('Clergy', IC.users, peopleBlock(p.clergy));
    h += panel('Sacraments & requests', IC.cross, chipList(p.sacraments),
      { sub: 'Baptisms, weddings, memorials and house blessings.' });
    h += panel('Ministries', IC.users, chipList(p.ministries));
    h += panel('This week', IC.book, prose(p.bulletin));
    if (p.festival && str(p.festival.name)) {
      h += panel('Annual festival', IC.spark,
        '<div class="drow"><span class="dwhen">' + esc(str(p.festival.date)) + '</span>' +
        '<span class="dwhat"><b>' + esc(str(p.festival.name)) + '</b></span>' +
        (httpish(p.festival.url) ? '<a class="btn btn-ghost btn-xs" href="' + A(httpish(p.festival.url)) + '" rel="noopener" target="_blank">Details</a>' : '') +
        '</div>');
    }
    h += panel('Hall rental', IC.home, prose(p.hall && p.hall.note));
    return h;
  },
  unlock: [
    ['Service times', 'Divine Liturgy, Orthros, Vespers — a weekly schedule visitors can actually read.'],
    ['Sacrament requests', 'Baptisms, weddings, memorials and house blessings, requested straight from the page.'],
    ['Stewardship & giving', 'A giving link and a stewardship note, front and centre.'],
    ['Feast days & namedays', 'Your patronal feast and the namedays your parish celebrates.'],
    ['Livestream', 'Send the faithful straight to the Liturgy stream.'],
    ['Weekly bulletin', 'Publish the bulletin without touching a website.'],
    ['Ministries', 'Philoptochos, Sunday school, GOYA, Greek school, choir.'],
    ['Hall rental & the festival', 'Take enquiries for the hall and promote the annual festival.'],
  ],
};

const RESTAURANT = {
  key: 'restaurant',
  noun: 'restaurant',
  eyebrow: (e, sub) => sub || 'Restaurant',
  /* profile: {hours[], menu[], reserve, order[], delivery{}, photos[], specials[], catering, payment[]} */
  actions(e, p) {
    const out = [];
    if (str(p.reserve)) out.push({ label: 'Reserve a table', href: httpish(p.reserve), icon: IC.cal, primary: true, external: true });
    arr(p.order).forEach((o) => {
      const u = httpish(typeof o === 'string' ? o : o.url);
      if (u) out.push({ label: str(o.label) || 'Order online', href: u, icon: IC.cart, external: true });
    });
    if (arr(p.menu).length) out.push({ label: 'See the menu', href: '#menu', icon: IC.menu });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Hours', IC.clock, scheduleBlock(p.hours));
    h += panel('Menu', IC.menu, menuBlock(p.menu), { id: 'menu' });
    h += panel("Today's specials", IC.spark, chipList(p.specials));
    h += panel('Photos', IC.camera, gallery(p.photos));
    h += panel('Catering & private dining', IC.users, prose(p.catering));
    h += panel('Good to know', IC.star, chipList(p.payment));
    return h;
  },
  unlock: [
    ['Your menu', 'Sections, dishes, prices — the thing every customer opens first.'],
    ['Hours & open-now', 'So nobody drives over on the day you are closed.'],
    ['Reservations', 'Take bookings from the page, or link the system you already use.'],
    ['Ordering & delivery', 'Every ordering link in one place instead of five.'],
    ["Today's specials", 'Change the plate of the day in seconds.'],
    ['Photos', 'The room, the plates, the grill.'],
    ['Catering & private dining', 'The high-value enquiries, made easy to send.'],
  ],
};

const BAKERY = {
  key: 'bakery', noun: 'bakery', eyebrow: () => 'Bakery',
  /* profile: {hours[], menu[], preorder, seasonal[], photos[], wholesale} */
  actions(e, p) {
    const out = [];
    if (str(p.preorder)) out.push({ label: 'Pre-order', href: httpish(p.preorder), icon: IC.cart, primary: true, external: true });
    if (arr(p.menu).length) out.push({ label: 'What we bake', href: '#menu', icon: IC.menu });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Hours', IC.clock, scheduleBlock(p.hours));
    h += panel('What we bake', IC.menu, menuBlock(p.menu), { id: 'menu' });
    h += panel('Seasonal', IC.spark, chipList(p.seasonal), { sub: 'Tsoureki, vasilopita, melomakarona — in their season.' });
    h += panel('Photos', IC.camera, gallery(p.photos));
    h += panel('Wholesale', IC.cart, prose(p.wholesale));
    return h;
  },
  unlock: [
    ['Your counter, online', 'Breads, sweets and prices, so people know before they walk in.'],
    ['Pre-orders', 'Take the vasilopita and tsoureki orders without the phone ringing all day.'],
    ['Seasonal specials', 'Name-day cakes, Easter, Christmas — up in a click.'],
    ['Hours & holidays', 'Including the days you close.'],
    ['Wholesale enquiries', 'Cafés and restaurants can reach you properly.'],
  ],
};

const PROFESSIONAL = {
  key: 'professional', noun: 'practice', eyebrow: (e, sub) => sub || 'Professional',
  /* profile: {services[], credentials[], languages[], consult, fees, hours[], team[], areas[]} */
  actions(e, p) {
    const out = [];
    if (str(p.consult)) out.push({ label: 'Book a consultation', href: httpish(p.consult), icon: IC.cal, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Services', IC.scale, chipList(p.services));
    h += panel('Credentials', IC.cap, chipList(p.credentials));
    h += panel('Languages', IC.globe, chipList(p.languages));
    h += panel('The team', IC.users, peopleBlock(p.team));
    h += panel('Fees & consultations', IC.book, prose(p.fees));
    h += panel('Office hours', IC.clock, scheduleBlock(p.hours));
    return h;
  },
  unlock: [
    ['Practice areas', 'What you actually do, in the words clients search for.'],
    ['Credentials', 'Bar admissions, licences, professional bodies, years in practice.'],
    ['Consultation booking', 'Turn the page into a calendar that fills itself.'],
    ['Languages', 'Greek, English — the reason a diaspora client chooses you.'],
    ['Your team', 'Partners and associates, with photos.'],
    ['Fees & first consultation', 'Set expectations before the phone rings.'],
  ],
};

const MUSIC = {
  key: 'music', noun: 'artist', eyebrow: (e, sub) => sub || 'Artist',
  /* profile: {listen{}, releases[], tour[], videos[], booking{name,email}, press, merch} */
  actions(e, p) {
    const out = [];
    const l = p.listen && typeof p.listen === 'object' ? p.listen : {};
    const first = LISTEN.map(([k]) => httpish(l[k])).find(Boolean);
    if (first) out.push({ label: 'Listen', href: first, icon: IC.play, primary: true, external: true });
    if (arr(p.tour).length) out.push({ label: 'Tour dates', href: '#tour', icon: IC.cal });
    if (str(p.merch)) out.push({ label: 'Merch', href: httpish(p.merch), icon: IC.cart, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Listen', IC.play, listenBlock(p.listen));
    h += panel('Releases', IC.star, datesBlock(p.releases, 'Listen'));
    h += panel('Tour dates', IC.cal, datesBlock(p.tour, 'Tickets'), { id: 'tour' });
    h += panel('Watch', IC.camera, datesBlock(p.videos, 'Watch'));
    if (p.booking && (str(p.booking.name) || str(p.booking.email))) {
      h += panel('Booking', IC.mail,
        '<p class="secp">' + esc(str(p.booking.name)) +
        (str(p.booking.email) ? ' — <a href="mailto:' + A(str(p.booking.email)) + '">' + esc(str(p.booking.email)) + '</a>' : '') + '</p>');
    }
    h += panel('Press kit', IC.book, prose(p.press));
    return h;
  },
  unlock: [
    ['Listen everywhere', 'Spotify, Apple Music, YouTube — one page, every platform.'],
    ['Tour dates', 'Dates and ticket links, and they can sell through Zoi Tickets.'],
    ['Releases', 'New single, new album, front and centre.'],
    ['Video', 'Clips and live sets embedded.'],
    ['Booking', 'Promoters reach your agent, not a voicemail.'],
    ['Press kit', 'Bio, photos, rider — the things venues ask for every time.'],
  ],
};

const CREATOR = {
  key: 'creator', noun: 'creator', eyebrow: (e, sub) => sub || 'Creator',
  /* profile: {platforms{}, work[], collab{email}, rate_card, press} */
  actions(e, p) {
    const out = [];
    if (p.collab && str(p.collab.email)) out.push({ label: 'Work with me', href: 'mailto:' + str(p.collab.email), icon: IC.mail, primary: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Recent work', IC.camera, datesBlock(p.work, 'View'));
    h += panel('Collaborations', IC.spark, prose(p.rate_card));
    h += panel('Press', IC.book, prose(p.press));
    return h;
  },
  unlock: [
    ['Every channel in one place', 'Instagram, TikTok, YouTube — the whole footprint.'],
    ['Your work', 'Recent posts, films, campaigns.'],
    ['Brand enquiries', 'A real inbound channel for paid work.'],
    ['Rate card', 'Set the terms before the DM.'],
    ['Link in bio', 'A Zoi bio page that matches this listing.'],
  ],
};

const ORGANIZATION = {
  key: 'organization', noun: 'association', eyebrow: () => 'Association',
  /* profile: {mission, join{url,note}, events[], board[], giving{url}, newsletter} */
  actions(e, p) {
    const out = [];
    if (p.join && str(p.join.url)) out.push({ label: 'Become a member', href: httpish(p.join.url), icon: IC.users, primary: true, external: true });
    if (p.giving && str(p.giving.url)) out.push({ label: 'Donate', href: httpish(p.giving.url), icon: IC.heart, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Our mission', IC.book, prose(p.mission));
    h += panel('Upcoming', IC.cal, datesBlock(p.events, 'Details'));
    h += panel('Membership', IC.users, prose(p.join && p.join.note));
    h += panel('Board & committee', IC.users, peopleBlock(p.board));
    return h;
  },
  unlock: [
    ['Membership', 'Let people join from the page instead of asking how.'],
    ['Your calendar', 'Meetings, dances, name-day events, the annual gala.'],
    ['Mission & history', 'Why the association exists, properly told.'],
    ['Board & committees', 'Who to contact, with photos.'],
    ['Donations', 'For the causes the community funds.'],
    ['Newsletter', 'Build a list and mail it from Zoi.'],
  ],
};

const SCHOOL = {
  key: 'school', noun: 'school', eyebrow: () => 'School',
  /* profile: {programs[], enrol{url,note}, tuition, calendar[], staff[], hours[]} */
  actions(e, p) {
    const out = [];
    if (p.enrol && str(p.enrol.url)) out.push({ label: 'Enrol / apply', href: httpish(p.enrol.url), icon: IC.cap, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Programs', IC.cap, chipList(p.programs));
    h += panel('Enrolment', IC.book, prose(p.enrol && p.enrol.note));
    h += panel('Tuition', IC.book, prose(p.tuition));
    h += panel('Term calendar', IC.cal, datesBlock(p.calendar, 'Details'));
    h += panel('Teachers', IC.users, peopleBlock(p.staff));
    h += panel('Class times', IC.clock, scheduleBlock(p.hours));
    return h;
  },
  unlock: [
    ['Programs & levels', 'Greek school, day school, adult classes — by age and level.'],
    ['Enrolment', 'Take applications from the page.'],
    ['Term calendar', 'Terms, holidays, performances.'],
    ['Tuition', 'Clear fees, fewer emails.'],
    ['Teachers', 'The people parents are trusting.'],
  ],
};

const EVENT = {
  key: 'event', noun: 'event', eyebrow: () => 'Event',
  /* profile: {starts, ends, venue, tickets, lineup[], schedule[], price} */
  actions(e, p) {
    const out = [];
    if (str(p.tickets)) out.push({ label: 'Get tickets', href: httpish(p.tickets), icon: IC.ticket, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    if (str(p.starts) || str(p.venue)) {
      h += panel('When & where', IC.cal,
        '<div class="sched">' +
        (str(p.starts) ? '<div class="schrow"><span class="schday">Starts</span><span class="schlabel">' + esc(str(p.starts)) + '</span><span class="schtime"></span></div>' : '') +
        (str(p.ends) ? '<div class="schrow"><span class="schday">Ends</span><span class="schlabel">' + esc(str(p.ends)) + '</span><span class="schtime"></span></div>' : '') +
        (str(p.venue) ? '<div class="schrow"><span class="schday">Venue</span><span class="schlabel">' + esc(str(p.venue)) + '</span><span class="schtime"></span></div>' : '') +
        '</div>');
    }
    h += panel('Line-up', IC.star, chipList(p.lineup));
    h += panel('Running order', IC.clock, scheduleBlock(p.schedule));
    return h;
  },
  unlock: [
    ['Sell tickets through Zoi', 'Reservations now, paid checkout as it ships — no third-party cut.'],
    ['Line-up & running order', 'Who plays, and when.'],
    ['When & where', 'Doors, start, venue, parking.'],
    ['Promote it', 'Push the event to the Community feed and your audience.'],
  ],
};

const VENUE = {
  key: 'venue', noun: 'venue', eyebrow: () => 'Venue',
  /* profile: {capacity, spaces[], rental{url,note}, calendar[], photos[]} */
  actions(e, p) {
    const out = [];
    if (p.rental && str(p.rental.url)) out.push({ label: 'Enquire about hire', href: httpish(p.rental.url), icon: IC.mail, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Spaces', IC.home, chipList(p.spaces), { sub: str(p.capacity) ? ('Capacity ' + str(p.capacity)) : '' });
    h += panel('Hire', IC.book, prose(p.rental && p.rental.note));
    h += panel("What's on", IC.cal, datesBlock(p.calendar, 'Details'));
    h += panel('Photos', IC.camera, gallery(p.photos));
    return h;
  },
  unlock: [
    ['Spaces & capacity', 'Rooms, seated and standing numbers, floor plans.'],
    ['Seat maps in 3D', 'Design the room once, sell the exact seat.'],
    ["What's on", 'Your calendar, public.'],
    ['Hire enquiries', 'The bookings that pay the bills.'],
    ['Photos', 'The room as it actually looks.'],
  ],
};

const VENDOR = {
  key: 'vendor', noun: 'shop', eyebrow: () => 'Shop',
  /* profile: {products[], shop, wholesale, shipping, hours[], photos[]} */
  actions(e, p) {
    const out = [];
    if (str(p.shop)) out.push({ label: 'Shop online', href: httpish(p.shop), icon: IC.cart, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('What we sell', IC.cart, menuBlock(p.products));
    h += panel('Shipping', IC.globe, prose(p.shipping));
    h += panel('Wholesale', IC.users, prose(p.wholesale));
    h += panel('Hours', IC.clock, scheduleBlock(p.hours));
    h += panel('Photos', IC.camera, gallery(p.photos));
    return h;
  },
  unlock: [
    ['Your products', 'With prices, so people can decide before they call.'],
    ['Sell online', 'A storefront that reaches the whole diaspora.'],
    ['Shipping', 'Where you ship and what it costs.'],
    ['Wholesale', 'The orders that move real volume.'],
  ],
};

const TRAVEL = {
  key: 'travel_place', noun: 'place', eyebrow: () => 'Place to go',
  /* profile: {highlights[], best_time, getting_there, tips, photos[], hours[]} */
  actions() { return []; },
  sections(e, p) {
    let h = '';
    h += panel('Why go', IC.sun, chipList(p.highlights));
    h += panel('Best time to visit', IC.cal, prose(p.best_time));
    h += panel('Getting there', IC.pin, prose(p.getting_there));
    h += panel('Opening times', IC.clock, scheduleBlock(p.hours));
    h += panel('Photos', IC.camera, gallery(p.photos));
    return h;
  },
  unlock: [
    ['Why go', 'The three things worth the trip.'],
    ['Best time to visit', 'Season, hours, when it is quiet.'],
    ['Getting there', 'Ferry, bus, road, on foot.'],
    ['Photos', 'What it really looks like.'],
  ],
};

const SPORTS = {
  key: 'sports', noun: 'club', eyebrow: () => 'Club',
  /* profile: {teams[], fixtures[], join{url,note}, results[], colours} */
  actions(e, p) {
    const out = [];
    if (p.join && str(p.join.url)) out.push({ label: 'Join / trials', href: httpish(p.join.url), icon: IC.trophy, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Teams', IC.users, chipList(p.teams));
    h += panel('Fixtures', IC.cal, datesBlock(p.fixtures, 'Details'));
    h += panel('Results', IC.trophy, datesBlock(p.results));
    h += panel('Join the club', IC.book, prose(p.join && p.join.note));
    return h;
  },
  unlock: [
    ['Teams & squads', 'Every age group, one page.'],
    ['Fixtures & results', 'So supporters know where to be.'],
    ['Trials & sign-up', 'Bring new players in.'],
    ['Club shop & membership', 'Kit and subs, collected properly.'],
  ],
};

const GENERIC = {
  key: 'business', noun: 'business', eyebrow: (e, sub) => sub || 'Business',
  /* profile: {hours[], services[], photos[], booking, payment[]} */
  actions(e, p) {
    const out = [];
    if (str(p.booking)) out.push({ label: 'Book', href: httpish(p.booking), icon: IC.cal, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Hours', IC.clock, scheduleBlock(p.hours));
    h += panel('What we do', IC.star, chipList(p.services));
    h += panel('Photos', IC.camera, gallery(p.photos));
    h += panel('Good to know', IC.book, chipList(p.payment));
    return h;
  },
  unlock: [
    ['Hours & open-now', 'The first thing every customer checks.'],
    ['What you do', 'Services and prices in your own words.'],
    ['Photos', 'Show the place, not a placeholder.'],
    ['Bookings & enquiries', 'Turn the page into a channel that brings work in.'],
  ],
};

const HOTEL = {
  key: 'hotel', noun: 'property', eyebrow: (e, sub) => sub || 'Hotel',
  /* profile: {rooms[], amenities[], book, checkin, photos[], dining, transfers} */
  actions(e, p) {
    const out = [];
    if (str(p.book)) out.push({ label: 'Check availability', href: httpish(p.book), icon: IC.cal, primary: true, external: true });
    return out;
  },
  sections(e, p) {
    let h = '';
    h += panel('Rooms & rates', IC.home, menuBlock(p.rooms));
    h += panel('Amenities', IC.star, chipList(p.amenities));
    h += panel('Check-in', IC.clock, prose(p.checkin));
    h += panel('Dining', IC.menu, prose(p.dining));
    h += panel('Getting here', IC.pin, prose(p.transfers));
    h += panel('Photos', IC.camera, gallery(p.photos));
    return h;
  },
  unlock: [
    ['Rooms & rates', 'Room types, what they sleep, what they cost.'],
    ['Direct booking', 'Take the booking yourself instead of paying commission.'],
    ['Amenities', 'Pool, parking, breakfast, sea view — the filters guests use.'],
    ['Check-in & house rules', 'Times and policies, so nobody is surprised.'],
    ['Photos', 'The rooms and the view, properly shot.'],
    ['Transfers', 'Port, airport, the walk from the bus.'],
  ],
};

/* category_slug refinements — a "business" is not one thing */
const CATEGORY_MAP = [
  [/restaurant|taverna|meze|ouzer|grill|souvla|estiatorio|dining/, RESTAURANT, 'Restaurant'],
  [/baker|patisserie|zaxarop|sweet|pastry/, BAKERY, 'Bakery'],
  [/cafe|coffee|kafeneio/, RESTAURANT, 'Café'],
  [/hotel|resort|villa|rooms|accommodation|guesthouse/, HOTEL, 'Hotel'],
  [/law|legal|attorney|solicitor|barrister/, PROFESSIONAL, 'Law practice'],
  [/account|tax|book-?keep/, PROFESSIONAL, 'Accountancy'],
  [/dental|dentist/, PROFESSIONAL, 'Dental practice'],
  [/doctor|medical|clinic|physio|health|therap/, PROFESSIONAL, 'Clinic'],
  [/architect|engineer/, PROFESSIONAL, 'Architecture & engineering'],
  [/real-?estate|realtor|property|broker/, PROFESSIONAL, 'Real estate'],
  [/insur|financ|mortgage|invest/, PROFESSIONAL, 'Financial services'],
  [/music|singer|band|bouzouki|composer|\bdj\b|djs/, MUSIC, 'Musician'],
  [/theatre|theater|comedy|dance|performer|actor/, CREATOR, 'Performer'],
  [/chef/, CREATOR, 'Chef'],
  [/radio|podcast|broadcast/, CREATOR, 'Radio & podcast'],
  [/media|creator|influencer|youtube|blogger/, CREATOR, 'Creator'],
  [/travel|agency|tour/, GENERIC, 'Travel'],
  [/jewel/, VENDOR, 'Jeweller'],
  [/market|grocer|deli|butcher|fish|wine|liquor|import|olive|honey|specialty|food/, VENDOR, 'Food shop'],
  [/religious-goods|icons?/, VENDOR, 'Religious goods'],
  [/salon|barber|beauty|spa|hair/, GENERIC, 'Salon'],
];

const BY_TYPE = {
  church: CHURCH,
  organization: ORGANIZATION,
  school: SCHOOL,
  event: EVENT,
  venue: VENUE,
  vendor: VENDOR,
  travel_place: TRAVEL,
  sports: SPORTS,
  artist: MUSIC,
  creator: CREATOR,
  professional: PROFESSIONAL,
  business: GENERIC,
};

/**
 * Pick the vertical for an entity. entity_type decides the family;
 * category_slug refines it, so a taverna gets a menu and a law office gets
 * practice areas even though both are "business" in the data.
 */
export function verticalFor(e) {
  const type = String((e && e.entity_type) || '').toLowerCase();
  const cat = String((e && e.category_slug) || '').toLowerCase();
  let v = BY_TYPE[type] || GENERIC;
  let sub = '';
  for (const [re, vert, label] of CATEGORY_MAP) {
    if (!cat || !re.test(cat)) continue;
    // An `artist` filed under the generic "media-creators" bucket is still a
    // musician first — don't let a vague category downgrade the vertical.
    if (type === 'artist' && vert === CREATOR && /media|creator|influencer/.test(cat)) break;
    // Only let the category override inside the loose, mixed families.
    if (type === 'business' || type === 'professional' || type === 'vendor' ||
        type === 'creator' || type === 'artist' || !BY_TYPE[type]) {
      v = vert; sub = label;
    }
    break;
  }
  return { v, sub };
}

export function profileOf(e) {
  // Route everything through safeProfile so the enrichment fallback, the banned
  // rating keys and the reserved namespaces are handled in exactly one place.
  // This used to hand back the raw column, which meant a caller could render
  // _enrich or _geo as if they were profile fields.
  return safeProfile(e);
}

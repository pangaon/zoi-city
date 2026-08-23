/**
 * _orthocal.js — the Orthodox liturgical calendar.
 *
 * WHY THIS EXISTS
 * A parish page that cannot say "Divine Liturgy, Sunday 9:30" is useless, and
 * every date it needs to say that moves: Pascha shifts by up to five weeks, and
 * roughly forty feasts and four fasting seasons hang off it. Volunteers must
 * never hand-type these — a typed date is wrong within a year. So the platform
 * computes them and the parish only ever supplies *times*.
 *
 * Orthodox Pascha is NOT Western Easter. They coincide occasionally (2025, 2028)
 * and diverge by up to five weeks otherwise, so a Western Easter library is
 * wrong most years. This computes the Julian Paschalion and converts.
 *
 * Pure functions, no I/O, no dependencies — so it is cheap to call and testable.
 * (Underscore-prefixed so Vercel treats it as a lib, not a route.)
 */

/* ---------- date helpers (UTC-only, no local-time drift) ---------- */
function ymdToUTC(y, m, d) { return Date.UTC(y, m - 1, d); }
function addDays(ms, n) { return ms + n * 86400000; }
export function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? ymdToUTC(+m[1], +m[2], +m[3]) : null;
}
function dayOfWeek(ms) { return new Date(ms).getUTCDay(); } // 0=Sun

/**
 * Gregorian date of Orthodox Pascha. Meeus's Julian algorithm, then the
 * Julian→Gregorian offset (13 days for 1900–2099).
 * Verified against 2020–2030 in tests/unit/orthocal.test.mjs.
 */
export function orthodoxPascha(Y) {
  Y = Number(Y);
  const a = Y % 4, b = Y % 7, c = Y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);   // 3=Mar, 4=Apr (Julian)
  const day = ((d + e + 114) % 31) + 1;
  // The Julian date above is expressed on the Julian calendar; shift to Gregorian.
  const offset = (Y >= 1900 && Y <= 2099) ? 13 : julianGregorianOffset(Y);
  return addDays(ymdToUTC(Y, month, day), offset);
}
function julianGregorianOffset(Y) {
  // Centennial rule: offset grows by 1 each century that is not a leap year.
  const c = Math.floor(Y / 100);
  return c - Math.floor(c / 4) - 2;
}

/* ---------- moveable feasts: integer offsets from Pascha ---------- */
export const MOVEABLE = [
  { key: 'triodion_begins', off: -70, name: 'Sunday of the Publican and the Pharisee' },
  { key: 'prodigal_son', off: -63, name: 'Sunday of the Prodigal Son' },
  { key: 'saturday_of_souls_1', off: -57, name: 'Saturday of Souls' },
  { key: 'meatfare', off: -56, name: 'Sunday of the Last Judgement (Meatfare)' },
  { key: 'saturday_of_souls_2', off: -50, name: 'Saturday of Souls' },
  { key: 'cheesefare', off: -49, name: 'Forgiveness Sunday (Cheesefare)' },
  { key: 'clean_monday', off: -48, name: 'Clean Monday — Great Lent begins' },
  { key: 'sunday_of_orthodoxy', off: -42, name: 'Sunday of Orthodoxy' },
  { key: 'saturday_of_souls_3', off: -43, name: 'Saturday of Souls' },
  { key: 'gregory_palamas', off: -35, name: 'St Gregory Palamas' },
  { key: 'veneration_of_cross', off: -28, name: 'Veneration of the Holy Cross' },
  { key: 'john_climacus', off: -21, name: 'St John Climacus' },
  { key: 'akathist_full', off: -15, name: 'The Akathist Hymn' },
  { key: 'mary_of_egypt', off: -14, name: 'St Mary of Egypt' },
  { key: 'lazarus_saturday', off: -8, name: 'Saturday of Lazarus' },
  { key: 'palm_sunday', off: -7, name: 'Palm Sunday' },
  { key: 'holy_monday', off: -6, name: 'Holy Monday' },
  { key: 'holy_tuesday', off: -5, name: 'Holy Tuesday — Hymn of Kassiani' },
  { key: 'holy_wednesday', off: -4, name: 'Holy Wednesday — Holy Unction' },
  { key: 'holy_thursday', off: -3, name: 'Holy Thursday — the Twelve Gospels' },
  { key: 'holy_friday', off: -2, name: 'Great Friday — Apokathilosis and the Lamentations' },
  { key: 'holy_saturday', off: -1, name: 'Holy Saturday — Anastasi at midnight' },
  { key: 'pascha', off: 0, name: 'Holy Pascha — the Resurrection of Christ' },
  { key: 'zoodochos_peghe', off: 5, name: 'Zoodochos Peghe (Bright Friday)' },
  { key: 'thomas_sunday', off: 7, name: 'Thomas Sunday (Antipascha)' },
  { key: 'myrrhbearers', off: 14, name: 'Sunday of the Myrrhbearers' },
  { key: 'paralytic', off: 21, name: 'Sunday of the Paralytic' },
  { key: 'mid_pentecost', off: 24, name: 'Mid-Pentecost' },
  { key: 'samaritan_woman', off: 28, name: 'Sunday of the Samaritan Woman' },
  { key: 'blind_man', off: 35, name: 'Sunday of the Blind Man' },
  { key: 'ascension', off: 39, name: 'Holy Ascension' },
  { key: 'fathers_first_council', off: 42, name: 'Fathers of the First Council' },
  { key: 'saturday_of_souls_5', off: 48, name: 'Saturday of Souls before Pentecost' },
  { key: 'pentecost', off: 49, name: 'Holy Pentecost' },
  { key: 'holy_spirit_monday', off: 50, name: 'Monday of the Holy Spirit' },
  { key: 'all_saints', off: 56, name: 'Sunday of All Saints' },
  { key: 'apostles_fast_begins', off: 57, name: 'Apostles Fast begins' },
];

/* ---------- fixed feasts (MM-DD) ---------- */
export const FIXED = [
  { key: 'nativity_of_theotokos', md: '09-08', name: 'Nativity of the Theotokos' },
  { key: 'exaltation_of_the_cross', md: '09-14', name: 'Exaltation of the Holy Cross' },
  { key: 'st_demetrios', md: '10-26', name: 'St Demetrios the Myrrh-streaming' },
  { key: 'oxi_day', md: '10-28', name: 'Oxi Day', civic: true },
  { key: 'holy_archangels', md: '11-08', name: 'Synaxis of the Archangels Michael and Gabriel' },
  { key: 'entrance_of_theotokos', md: '11-21', name: 'Entrance of the Theotokos' },
  { key: 'st_andrew', md: '11-30', name: 'St Andrew the First-Called' },
  { key: 'st_nicholas', md: '12-06', name: 'St Nicholas of Myra' },
  { key: 'st_spyridon', md: '12-12', name: 'St Spyridon' },
  { key: 'nativity', md: '12-25', name: 'The Nativity of Christ' },
  { key: 'st_basil', md: '01-01', name: 'St Basil the Great' },
  { key: 'theophany', md: '01-06', name: 'Theophany — the Great Blessing of the Waters' },
  { key: 'st_john_baptist', md: '01-07', name: 'Synaxis of St John the Baptist' },
  { key: 'st_anthony', md: '01-17', name: 'St Anthony the Great' },
  { key: 'three_hierarchs', md: '01-30', name: 'The Three Hierarchs — Day of Greek Letters' },
  { key: 'presentation_hypapante', md: '02-02', name: 'The Presentation of Christ (Hypapante)' },
  { key: 'annunciation', md: '03-25', name: 'The Annunciation — and Greek Independence Day' },
  { key: 'st_george', md: '04-23', name: 'St George the Trophy-bearer' },
  { key: 'ss_constantine_helen', md: '05-21', name: 'Ss Constantine and Helen' },
  { key: 'ss_peter_paul', md: '06-29', name: 'Ss Peter and Paul' },
  { key: 'prophet_elias', md: '07-20', name: 'The Prophet Elias' },
  { key: 'transfiguration', md: '08-06', name: 'The Transfiguration of Christ' },
  { key: 'dormition', md: '08-15', name: 'The Dormition of the Theotokos' },
  { key: 'beheading_of_john', md: '08-29', name: 'The Beheading of St John the Baptist' },
];

/* Name days worth greeting. Keyed to the fixed feasts above. */
export const NAMEDAYS = {
  '09-08': ['Maria', 'Panagiotis', 'Despina'],
  '10-26': ['Dimitris', 'Dimitra'],
  '11-08': ['Michalis', 'Gabriel', 'Angelos', 'Angeliki'],
  '11-21': ['Maria', 'Despina'],
  '11-30': ['Andreas', 'Andriana'],
  '12-06': ['Nikolaos', 'Nikoletta'],
  '12-12': ['Spyridon', 'Spyridoula'],
  '12-25': ['Christos', 'Christina'],
  '01-01': ['Vasilis', 'Vasiliki'],
  '01-06': ['Fotis', 'Fotini', 'Iordanis'],
  '01-07': ['Ioannis', 'Ioanna'],
  '01-17': ['Antonis', 'Antonia'],
  '01-30': ['Grigoris', 'Vasilis', 'Ioannis'],
  '03-25': ['Evangelos', 'Evangelia'],
  '04-23': ['Georgios', 'Georgia'],
  '05-21': ['Konstantinos', 'Eleni'],
  '06-29': ['Petros', 'Pavlos'],
  '07-20': ['Ilias'],
  '08-06': ['Sotiris', 'Sotiria'],
  '08-15': ['Maria', 'Panagiotis', 'Despina'],
  '08-29': ['Ioannis'],
};

/* ---------- resolution ---------- */

/** Every feast falling on a given ISO date, moveable and fixed. */
export function feastsOn(dateISO) {
  const ms = parseISO(dateISO);
  if (ms == null) return [];
  const y = new Date(ms).getUTCFullYear();
  const out = [];
  // moveable: check this year's and the neighbouring years' Pascha, because the
  // Triodion of year Y+1 can begin in December of year Y.
  for (const py of [y - 1, y, y + 1]) {
    const p = orthodoxPascha(py);
    for (const f of MOVEABLE) {
      if (addDays(p, f.off) === ms) out.push({ ...f, kind: 'moveable', paschaYear: py });
    }
  }
  const md = dateISO.slice(5);
  for (const f of FIXED) {
    if (f.md === md) out.push({ ...f, kind: 'fixed' });
  }
  return out;
}

/** Name days for a date (fixed feasts only — that is how they are kept). */
export function nameDaysOn(dateISO) {
  return NAMEDAYS[String(dateISO || '').slice(5)] || [];
}

/**
 * Which liturgical seasons a date falls in. A parish's recurring service marked
 * season:'great_lent' renders only on dates this returns 'great_lent' for.
 */
export function seasonsFor(dateISO) {
  const ms = parseISO(dateISO);
  if (ms == null) return ['all'];
  const y = new Date(ms).getUTCFullYear();
  const seasons = new Set(['all']);
  const md = dateISO.slice(5);

  for (const py of [y - 1, y, y + 1]) {
    const p = orthodoxPascha(py);
    const off = Math.round((ms - p) / 86400000);
    if (off >= -70 && off <= -49) seasons.add('triodion');
    if (off >= -48 && off <= -1) { seasons.add('great_lent'); seasons.add('triodion'); }
    if (off >= -7 && off <= -1) seasons.add('holy_week');
    if (off >= -48 && off <= -8 && dayOfWeek(ms) !== 0 && dayOfWeek(ms) !== 6) seasons.add('great_lent_weekdays');
    if (off >= 0 && off <= 6) seasons.add('bright_week');
    if (off >= 0 && off <= 39) seasons.add('pascha_period');
    if (off >= 49 && off <= 55) seasons.add('pentecost_period');
    if (off >= 57) {
      // Apostles Fast runs from All Saints' Monday to 28 June
      const june28 = ymdToUTC(new Date(p).getUTCFullYear(), 6, 28);
      if (ms <= june28) seasons.add('apostles_fast');
    }
  }
  if (md >= '08-01' && md <= '08-14') seasons.add('dormition_fast');
  if (md >= '11-15' || md <= '12-24') {
    if (md >= '11-15' || md <= '12-24') {
      if (md >= '11-15' && md <= '12-31') seasons.add('nativity_fast');
      else if (md <= '12-24' && md >= '12-01') seasons.add('nativity_fast');
    }
  }
  if (md >= '06-01' && md <= '08-31') seasons.add('summer');
  if (!seasons.has('great_lent') && !seasons.has('holy_week')) seasons.add('outside_lent');
  return [...seasons];
}

/** Is a fast day? Wednesdays and Fridays outside the fast-free weeks, plus the fasting seasons. */
export function isFastDay(dateISO) {
  const ms = parseISO(dateISO);
  if (ms == null) return false;
  const s = seasonsFor(dateISO);
  if (s.includes('bright_week') || s.includes('pentecost_period')) return false;
  const md = dateISO.slice(5);
  if (md >= '12-25' || md <= '01-04') return false;            // Nativity to Theophany eve
  if (s.includes('great_lent') || s.includes('holy_week')) return true;
  if (s.includes('dormition_fast') || s.includes('nativity_fast') || s.includes('apostles_fast')) return true;
  const dow = dayOfWeek(ms);
  return dow === 3 || dow === 5;
}

/**
 * The next N dated feasts from a given day — what a parish page shows as
 * "coming up", and what JSON-LD emits as discrete Events.
 */
export function upcomingFeasts(fromISO, days) {
  const start = parseISO(fromISO);
  if (start == null) return [];
  const out = [];
  for (let i = 0; i < (days || 90); i++) {
    const d = iso(addDays(start, i));
    for (const f of feastsOn(d)) out.push({ date: d, ...f });
  }
  return out;
}

/** A parish's patronal feast resolved to a real date in a given year. */
export function resolveFeastDate(feast, year) {
  if (!feast) return null;
  if (feast.kind === 'moveable' && feast.pascha_offset != null) {
    return iso(addDays(orthodoxPascha(year), Number(feast.pascha_offset)));
  }
  const md = String(feast.date || '');
  if (/^\d{2}-\d{2}$/.test(md)) return `${year}-${md}`;
  return null;
}

/** Julian-calendar parishes keep fixed feasts 13 days later. */
export function shiftForOldCalendar(dateISO, calendarStyle) {
  if (calendarStyle !== 'old') return dateISO;
  const ms = parseISO(dateISO);
  return ms == null ? dateISO : iso(addDays(ms, 13));
}

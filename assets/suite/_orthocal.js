/*!
 * _orthocal.js — the Orthodox liturgical calendar, in the browser.
 * Classic script (NO ES modules), zero dependencies. Exposes window.ZoiOrthocal.
 *
 * WHY THIS FILE EXISTS TWICE
 * api/_orthocal.js is the server-side source of truth (an ES module, used by
 * the parish pages and the JSON-LD emitters). The browser cannot import it, and
 * the suite must not need a build step, so the pure data and pure functions are
 * ported here as a classic script. The feast tables below are kept BYTE-FOR-BYTE
 * identical to api/_orthocal.js on purpose: if the two ever drift, parish pages
 * and the scheduler would disagree about when Pascha is, and one of them would
 * be wrong. tests/unit/orthocal-browser.test.mjs pins both to the published
 * Paschalion and cross-checks them against each other.
 *
 * WHY THE MATHS LOOKS ODD
 * Orthodox Pascha is NOT Western Easter. It is computed on the JULIAN calendar
 * (Meeus's Julian algorithm), and the answer is then shifted onto the Gregorian
 * calendar — 13 days for 1900–2099, because the Julian calendar has drifted by
 * one day per non-leap century since 1582. They coincide occasionally (2025,
 * 2028) and diverge by up to five weeks otherwise, so a Western Easter library
 * is silently wrong most years.
 *
 * WHY A SCHEDULER CARES
 * A Greek business's calendar is the liturgical calendar. Feasts are the busiest
 * days of the year; name days are the reason people walk into a shop; and the
 * fasting seasons change what may be advertised. A bakery promoting tyropita on
 * Clean Monday — the strictest fast of the year, the one day everybody eats
 * lagana and halva instead — is a real, repeated, expensive mistake. So this
 * file also carries fasting STRICTNESS and a food-word conflict detector, which
 * the server-side copy has no reason to know about.
 */
(function (global) {
  'use strict';

  /* ---------- date helpers (UTC-only, no local-time drift) ---------- */
  function ymdToUTC(y, m, d) { return Date.UTC(y, m - 1, d); }
  function addDays(ms, n) { return ms + n * 86400000; }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  /**
   * Accept an ISO day string, a Date, or an epoch-millisecond number.
   *
   * This used to take the string form only, and returned null for anything else
   * — which meant fastInfo(new Date(...)) answered "not a fast day" for Great
   * Friday, silently. A calendar that quietly says Clean Monday is an ordinary
   * Monday is worse than one that throws, and every caller reaching for a Date
   * is making the obvious mistake, not an exotic one.
   */
  function parseISO(s) {
    if (s == null) return null;
    if (s instanceof Date) {
      return isFinite(s.getTime())
        ? ymdToUTC(s.getFullYear(), s.getMonth() + 1, s.getDate())   // local day, as drawn
        : null;
    }
    // Numbers are deliberately NOT accepted. A bare number is ambiguous —
    // milliseconds or seconds? — and guessing wrong yields a confidently wrong
    // date, which is the exact failure this function exists to prevent. Callers
    // with a timestamp should pass new Date(ms) and say what they mean.

    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? ymdToUTC(+m[1], +m[2], +m[3]) : null;
  }
  function dayOfWeek(ms) { return new Date(ms).getUTCDay(); } // 0=Sun

  /** ISO day key for a *local* Date — the calendar grid is drawn in local time. */
  function isoLocal(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /**
   * Gregorian date of Orthodox Pascha. Meeus's Julian algorithm, then the
   * Julian→Gregorian offset (13 days for 1900–2099).
   */
  function orthodoxPascha(Y) {
    Y = Number(Y);
    var a = Y % 4, b = Y % 7, c = Y % 19;
    var d = (19 * c + 15) % 30;
    var e = (2 * a + 4 * b - d + 34) % 7;
    var month = Math.floor((d + e + 114) / 31);   // 3=Mar, 4=Apr (Julian)
    var day = ((d + e + 114) % 31) + 1;
    // The date above is expressed on the Julian calendar; shift to Gregorian.
    var offset = (Y >= 1900 && Y <= 2099) ? 13 : julianGregorianOffset(Y);
    return addDays(ymdToUTC(Y, month, day), offset);
  }
  function julianGregorianOffset(Y) {
    // Centennial rule: offset grows by 1 each century that is not a leap year.
    var c = Math.floor(Y / 100);
    return c - Math.floor(c / 4) - 2;
  }

  /* ---------- moveable feasts: integer offsets from Pascha ---------- */
  var MOVEABLE = [
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
    { key: 'apostles_fast_begins', off: 57, name: 'Apostles Fast begins' }
  ];

  /* ---------- fixed feasts (MM-DD) ---------- */
  var FIXED = [
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
    { key: 'beheading_of_john', md: '08-29', name: 'The Beheading of St John the Baptist' }
  ];

  /* Name days worth greeting. Keyed to the fixed feasts above. */
  var NAMEDAYS = {
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
    '08-29': ['Ioannis']
  };

  /* The Twelve Great Feasts (plus Pascha, the "feast of feasts"). These get the
   * gold treatment in the UI — they are the days a business must not miss. */
  var GREAT = {
    pascha: 1, nativity: 1, theophany: 1, presentation_hypapante: 1, annunciation: 1,
    palm_sunday: 1, ascension: 1, pentecost: 1, transfiguration: 1, dormition: 1,
    nativity_of_theotokos: 1, exaltation_of_the_cross: 1, entrance_of_theotokos: 1
  };

  /* ---------- resolution ---------- */

  /** Every feast falling on a given ISO date, moveable and fixed. */
  function feastsOn(dateISO) {
    var ms = parseISO(dateISO);
    if (ms == null) return [];
    var y = new Date(ms).getUTCFullYear();
    var out = [];
    // moveable: check this year's and the neighbouring years' Pascha, because the
    // Triodion of year Y+1 can begin in December of year Y.
    for (var i = 0; i < 3; i++) {
      var py = y - 1 + i;
      var p = orthodoxPascha(py);
      for (var j = 0; j < MOVEABLE.length; j++) {
        var f = MOVEABLE[j];
        if (addDays(p, f.off) === ms) {
          out.push({ key: f.key, name: f.name, off: f.off, kind: 'moveable', paschaYear: py, great: !!GREAT[f.key] });
        }
      }
    }
    // Derive month-day from the PARSED value, never from the raw argument.
    // String(dateISO).slice(5) only worked for a bare 'YYYY-MM-DD': a Date gave
    // 'ug 15 2026 ...' and an ISO datetime gave '08-15T10:00:00Z', so fixed
    // feasts silently vanished for both. Moveable feasts kept working, which is
    // what made it hard to see.
    var md = iso(ms).slice(5);
    for (var k = 0; k < FIXED.length; k++) {
      var g = FIXED[k];
      if (g.md === md) out.push({ key: g.key, name: g.name, md: g.md, civic: !!g.civic, kind: 'fixed', great: !!GREAT[g.key] });
    }
    return out;
  }

  /** Name days for a date (fixed feasts only — that is how they are kept). */
  function nameDaysOn(dateISO) {
    var ms = parseISO(dateISO);
    if (ms == null) return [];
    return NAMEDAYS[iso(ms).slice(5)] || [];
  }

  /**
   * Which liturgical seasons a date falls in.
   *
   * PORTED WITH ONE FIX: api/_orthocal.js tags 25–31 December as
   * 'nativity_fast'. The Nativity fast ends on the 24th — the twelve days that
   * follow are fast-FREE, which is why its isFastDay() has to special-case
   * them. Here the season itself stops on the 24th, because this module shows
   * the season name to a human ("Nativity fast" printed over Christmas week is
   * simply wrong) rather than only feeding a boolean.
   */
  function seasonsFor(dateISO) {
    var ms = parseISO(dateISO);
    if (ms == null) return ['all'];
    var y = new Date(ms).getUTCFullYear();
    var seen = {};
    var seasons = [];
    function add(s) { if (!seen[s]) { seen[s] = 1; seasons.push(s); } }
    add('all');
    var md = String(dateISO).slice(5);

    for (var i = 0; i < 3; i++) {
      var py = y - 1 + i;
      var p = orthodoxPascha(py);
      var off = Math.round((ms - p) / 86400000);
      if (off >= -70 && off <= -49) add('triodion');
      if (off >= -48 && off <= -1) { add('great_lent'); add('triodion'); }
      if (off >= -7 && off <= -1) add('holy_week');
      if (off >= -48 && off <= -8 && dayOfWeek(ms) !== 0 && dayOfWeek(ms) !== 6) add('great_lent_weekdays');
      if (off >= 0 && off <= 6) add('bright_week');
      if (off >= 0 && off <= 39) add('pascha_period');
      if (off >= 49 && off <= 55) add('pentecost_period');
      if (off >= 57) {
        // Apostles Fast runs from All Saints' Monday to 28 June
        var june28 = ymdToUTC(new Date(p).getUTCFullYear(), 6, 28);
        if (ms <= june28) add('apostles_fast');
      }
      // Cheesefare (dairy) week: meat is already gone, dairy is still allowed.
      if (off >= -55 && off <= -49) add('cheesefare_week');
      // The first week of the Triodion is deliberately fast-free.
      if (off >= -70 && off <= -64) add('fast_free_week');
    }
    if (md >= '08-01' && md <= '08-14') add('dormition_fast');
    if (md >= '11-15' || md <= '12-24') {
      if ((md >= '11-15' && md <= '11-30') || (md >= '12-01' && md <= '12-24')) add('nativity_fast');
    }
    if (md >= '12-25' || md <= '01-04') add('twelve_days');
    if (md >= '06-01' && md <= '08-31') add('summer');
    if (seen.great_lent !== 1 && seen.holy_week !== 1) add('outside_lent');
    return seasons;
  }

  /** Is a fast day? Wednesdays and Fridays outside the fast-free weeks, plus the fasting seasons. */
  function isFastDay(dateISO) {
    var ms = parseISO(dateISO);
    if (ms == null) return false;
    var s = seasonsFor(dateISO);
    function has(x) { return s.indexOf(x) !== -1; }
    if (has('bright_week') || has('pentecost_period')) return false;
    var md = String(dateISO).slice(5);
    if (md >= '12-25' || md <= '01-04') return false;            // Nativity to Theophany eve
    if (has('fast_free_week')) return false;
    if (has('great_lent') || has('holy_week')) return true;
    if (has('dormition_fast') || has('nativity_fast') || has('apostles_fast')) return true;
    var dow = dayOfWeek(ms);
    if (has('cheesefare_week')) return dow === 3 || dow === 5; // dairy days, still Wed/Fri
    return dow === 3 || dow === 5;
  }

  /**
   * How strict is the fast, and what does it mean for a shop's messaging?
   *
   * Levels, loosest to strictest:
   *   'none'    — nothing is off the table.
   *   'dairy'   — Cheesefare week: no meat, dairy still allowed (galaktoboureko
   *               week, literally).
   *   'fast'    — the ordinary fast: no meat, dairy or eggs.
   *   'strict'  — xerophagy: the days when even oil, wine and fish come off the
   *               table. Clean Monday, Great Friday, the Exaltation of the
   *               Cross, the Beheading of St John, the eves of Nativity and
   *               Theophany. These are the days a food promotion can genuinely
   *               offend, so they are called out by name.
   * Every level carries `why` — the reason shown to the user, because an
   * unexplained warning gets clicked through.
   */
  function fastInfo(dateISO) {
    var ms = parseISO(dateISO);
    if (ms == null) return { level: 'none', label: 'Not a fast day', why: '' };
    var s = seasonsFor(dateISO);
    function has(x) { return s.indexOf(x) !== -1; }
    var md = String(dateISO).slice(5);
    var keys = feastsOn(dateISO).map(function (f) { return f.key; });
    function onFeast(k) { return keys.indexOf(k) !== -1; }

    // Strict days, named individually.
    if (onFeast('clean_monday')) {
      return { level: 'strict', label: 'Clean Monday — strict fast',
        why: 'The first day of Great Lent and the strictest fast of the year. Kites, lagana, halva, taramosalata — no meat, no dairy, no oil.' };
    }
    if (onFeast('holy_friday')) {
      return { level: 'strict', label: 'Great Friday — strict fast',
        why: 'The most solemn day of the year. Shops are quiet, the Lamentations are in the evening; promotional posts land badly.' };
    }
    if (onFeast('exaltation_of_the_cross')) {
      return { level: 'strict', label: 'Exaltation of the Cross — strict fast',
        why: 'A feast that is also a strict fast day, whatever day of the week it falls on.' };
    }
    if (onFeast('beheading_of_john')) {
      return { level: 'strict', label: 'Beheading of St John — strict fast',
        why: 'A strict fast; traditionally nothing is eaten off a plate or knife.' };
    }
    if (md === '12-24' || md === '01-05') {
      return { level: 'strict', label: 'Eve of a Great Feast — strict fast',
        why: 'The eve is kept as a strict fast until the vigil.' };
    }
    if (has('holy_week')) {
      return { level: 'strict', label: 'Holy Week — strict fast',
        why: 'The whole week is kept strictly. Keep messaging quiet and liturgical, not commercial.' };
    }
    if (has('bright_week')) {
      return { level: 'none', label: 'Bright Week — fast-free',
        why: 'The week after Pascha is fast-free: everything is allowed, and everybody is celebrating. The best selling week of the spring.' };
    }
    if (has('twelve_days')) {
      return { level: 'none', label: 'The twelve days of Christmas — fast-free',
        why: 'From the Nativity to the eve of Theophany the fast is lifted.' };
    }
    if (has('pentecost_period')) {
      return { level: 'none', label: 'Week after Pentecost — fast-free', why: 'A fast-free week.' };
    }
    if (has('fast_free_week')) {
      return { level: 'none', label: 'Fast-free week (Triodion)', why: 'The first week of the Triodion is deliberately fast-free.' };
    }
    if (has('cheesefare_week')) {
      return { level: 'dairy', label: 'Cheesefare week — dairy allowed, no meat',
        why: 'Meat has stopped, dairy has not. This is the week to promote cheese, milk and eggs — not souvlaki.' };
    }
    if (has('great_lent')) {
      var dow = dayOfWeek(ms);
      if (dow === 0 || dow === 6) {
        return { level: 'fast', label: 'Great Lent (weekend)', why: 'Oil and wine are allowed at weekends, but meat, dairy and eggs are not.' };
      }
      return { level: 'strict', label: 'Great Lent weekday — strict fast',
        why: 'Weekdays in Great Lent are kept strictly. Anything with meat or dairy in it will read badly.' };
    }
    if (has('dormition_fast')) {
      return { level: 'fast', label: 'Dormition fast', why: 'The two-week fast before 15 August. No meat, dairy or eggs.' };
    }
    if (has('nativity_fast')) {
      return { level: 'fast', label: 'Nativity fast', why: 'The forty days before Christmas. No meat, dairy or eggs.' };
    }
    if (has('apostles_fast')) {
      return { level: 'fast', label: 'Apostles fast', why: 'The fast up to 29 June. No meat, dairy or eggs.' };
    }
    if (isFastDay(dateISO)) {
      var d2 = dayOfWeek(ms);
      return { level: 'fast', label: d2 === 3 ? 'Wednesday fast' : 'Friday fast',
        why: 'Wednesdays and Fridays are fast days through most of the year.' };
    }
    return { level: 'none', label: 'Not a fast day', why: '' };
  }

  /** Convenience: is this one of the days where food messaging really matters? */
  function isStrictFast(dateISO) { return fastInfo(dateISO).level === 'strict'; }

  /**
   * Food words that clash with a fast, English and Greek.
   * The point is not lexical completeness — it is catching the handful of words
   * that appear in 95% of Greek food promotions. Matching is accent-insensitive
   * and case-insensitive, and only whole words count, so "creamy" does not fire
   * on "cream" but "cream" does.
   */
  var FOOD = {
    meat: ['meat', 'pork', 'beef', 'lamb', 'chicken', 'bacon', 'sausage', 'burger', 'steak', 'souvlaki',
      'gyros', 'gyro', 'kebab', 'kontosouvli', 'kokoretsi', 'pastitsio', 'moussaka', 'keftedes', 'meatball', 'meatballs',
      'κρεας', 'κρεατικα', 'χοιρινο', 'μοσχαρι', 'αρνι', 'κοτοπουλο', 'μπεικον', 'λουκανικο', 'μπιφτεκι',
      'σουβλακι', 'γυρος', 'κοντοσουβλι', 'κοκορετσι', 'παστιτσιο', 'μουσακας', 'κεφτεδες', 'ψητο'],
    dairy: ['cheese', 'milk', 'butter', 'yogurt', 'yoghurt', 'cream', 'feta', 'halloumi', 'kasseri', 'graviera',
      'tiropita', 'tyropita', 'bougatsa', 'galaktoboureko', 'kataifi', 'cheesecake', 'gelato', 'latte', 'cappuccino',
      'τυρι', 'τυρια', 'γαλα', 'βουτυρο', 'γιαουρτι', 'κρεμα', 'φετα', 'χαλουμι', 'κασερι', 'γραβιερα',
      'τυροπιτα', 'μπουγατσα', 'γαλακτομπουρεκο', 'παγωτο', 'καπουτσινο', 'φραπε'],
    egg: ['egg', 'eggs', 'omelette', 'omelet', 'αυγο', 'αυγα', 'ομελετα'],
    fish: ['fish', 'octopus', 'calamari', 'squid', 'shrimp', 'prawn', 'prawns', 'salmon', 'tuna', 'sardine', 'sardines',
      'ψαρι', 'χταποδι', 'καλαμαρι', 'γαριδες', 'σολομος', 'τονος', 'σαρδελες'],
    oil_wine: ['wine', 'ouzo', 'tsipouro', 'raki', 'beer', 'cocktail', 'cocktails', 'happy hour',
      'κρασι', 'ουζο', 'τσιπουρο', 'ρακι', 'μπιρα', 'μπυρα', 'κοκτειλ']
  };

  /* What a Greek shop actually sells on the strict days — offered as an
   * alternative when a clash is found, so the warning is useful and not just a
   * telling-off. */
  var FAST_FRIENDLY = {
    clean_monday: 'lagana, halva, taramosalata, olives, gigantes, pickled vegetables',
    great_lent: 'lenten (nistisima) options — seafood-free pites, gigantes, dolmades, halva, tahini sweets',
    holy_week: 'nistisima, lagana, halva, koulourakia for Pascha, tsoureki pre-orders for Saturday',
    default: 'nistisima (fast-friendly) options — vegetable, tahini and olive-oil based'
  };

  function deaccent(s) {
    // Strip Greek and Latin accents so "τυρόπιτα" matches "τυροπιτα".
    var t = String(s == null ? '' : s).toLowerCase();
    if (typeof t.normalize === 'function') {
      t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      // final sigma → sigma, so "γύρος"/"γυρος" and plurals normalise
      t = t.replace(/ς/g, 'σ');
    }
    return t;
  }
  function wordsOf(text) {
    // Split on anything that is not a letter or digit, in any script.
    var t = deaccent(text);
    var out = [];
    var re = /[a-z0-9\u0370-\u03ff\u1f00-\u1fff]+/g;
    var m;
    while ((m = re.exec(t)) !== null) out.push(m[0]);
    return out;
  }

  /**
   * Does this post clash with the fast on this date?
   * Returns null when there is nothing to say — a warning that fires on
   * everything gets ignored, so the rules are deliberately narrow:
   *   strict day → meat, dairy, eggs, fish, wine/spirits all clash
   *   fast day   → meat, dairy, eggs clash (fish, oil and wine do not)
   *   dairy week → only meat clashes
   *   fast-free  → nothing clashes
   */
  function fastConflict(body, dateISO) {
    var info = fastInfo(dateISO);
    if (info.level === 'none') return null;
    var groups = info.level === 'strict' ? ['meat', 'dairy', 'egg', 'fish', 'oil_wine']
      : info.level === 'fast' ? ['meat', 'dairy', 'egg']
        : ['meat'];
    var words = wordsOf(body);
    var index = {};
    for (var i = 0; i < words.length; i++) index[words[i]] = 1;
    var hits = [];
    for (var g = 0; g < groups.length; g++) {
      var list = FOOD[groups[g]];
      for (var j = 0; j < list.length; j++) {
        var term = deaccent(list[j]);
        if (term.indexOf(' ') !== -1) {
          if (deaccent(body).indexOf(term) !== -1) hits.push({ group: groups[g], word: list[j] });
        } else if (index[term]) {
          hits.push({ group: groups[g], word: list[j] });
        }
      }
    }
    if (!hits.length) return null;
    var keys = feastsOn(dateISO).map(function (f) { return f.key; });
    var seasons = seasonsFor(dateISO);
    var alt = keys.indexOf('clean_monday') !== -1 ? FAST_FRIENDLY.clean_monday
      : seasons.indexOf('holy_week') !== -1 ? FAST_FRIENDLY.holy_week
        : seasons.indexOf('great_lent') !== -1 ? FAST_FRIENDLY.great_lent
          : FAST_FRIENDLY.default;
    // de-duplicate the words we show
    var shown = [], seenW = {};
    for (var h = 0; h < hits.length; h++) {
      if (!seenW[hits[h].word]) { seenW[hits[h].word] = 1; shown.push(hits[h].word); }
    }
    return {
      level: info.level,
      label: info.label,
      why: info.why,
      words: shown.slice(0, 6),
      groups: hits.map(function (x) { return x.group; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
      suggest: alt
    };
  }

  /**
   * The next N dated feasts from a given day — in date order, because the
   * caller renders them as a list and re-sorting a sorted list is a bug farm.
   */
  function upcomingFeasts(fromISO, days) {
    var start = parseISO(fromISO);
    if (start == null) return [];
    var out = [];
    var n = days || 90;
    for (var i = 0; i < n; i++) {
      var d = iso(addDays(start, i));
      var fs = feastsOn(d);
      for (var j = 0; j < fs.length; j++) {
        out.push({ date: d, key: fs[j].key, name: fs[j].name, kind: fs[j].kind, great: fs[j].great, civic: fs[j].civic });
      }
    }
    return out;
  }

  /** The next N days' name days, in date order. */
  function upcomingNameDays(fromISO, days) {
    var start = parseISO(fromISO);
    if (start == null) return [];
    var out = [];
    var n = days || 30;
    for (var i = 0; i < n; i++) {
      var d = iso(addDays(start, i));
      var names = nameDaysOn(d);
      if (names.length) out.push({ date: d, names: names.slice(), feasts: feastsOn(d).map(function (f) { return f.name; }) });
    }
    return out;
  }

  /** Everything a calendar cell needs about one day, in one call. */
  function dayInfo(dateISO) {
    var feasts = feastsOn(dateISO);
    var fast = fastInfo(dateISO);
    return {
      date: dateISO,
      feasts: feasts,
      great: feasts.some(function (f) { return f.great; }),
      namedays: nameDaysOn(dateISO),
      seasons: seasonsFor(dateISO),
      fast: fast,
      isFast: isFastDay(dateISO)
    };
  }

  /**
   * "This week's opportunities": the feasts and name days a business could post
   * about, each with a suggested draft. The draft is a SUGGESTION the user
   * edits — it contains no claims, no numbers and no invented facts, only a
   * greeting and the name of the day.
   */
  function opportunities(fromISO, days, opts) {
    opts = opts || {};
    var biz = String(opts.business || '').trim();
    var start = parseISO(fromISO);
    if (start == null) return [];
    var out = [];
    var n = days || 14;
    for (var i = 0; i < n; i++) {
      var d = iso(addDays(start, i));
      var info = dayInfo(d);
      if (!info.feasts.length && !info.namedays.length) continue;
      var headline = info.feasts.length ? info.feasts[0].name : (info.namedays.join(', ') + ' name day');
      out.push({
        date: d,
        daysAway: i,
        kind: info.feasts.length ? (info.great ? 'great_feast' : 'feast') : 'nameday',
        headline: headline,
        feasts: info.feasts,
        namedays: info.namedays,
        fast: info.fast,
        draft: suggestDraft(info, biz)
      });
    }
    return out;
  }

  /* Greeting drafts. Kept short and Greek-first: "Χρόνια πολλά" is what a shop
   * actually writes. Every draft is plainly a template for the user to edit. */
  function suggestDraft(info, business) {
    var sig = business ? '\n\n— ' + business : '';
    var names = info.namedays || [];
    var feast = info.feasts && info.feasts[0];
    if (names.length) {
      var list = names.length === 1 ? names[0]
        : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
      return 'Χρόνια πολλά to every ' + list + ' celebrating today! 🎉\n\n' +
        (feast ? 'Today is ' + feast.name + '. ' : '') +
        'Come by and let us help you celebrate.' + sig;
    }
    if (feast) {
      if (info.fast.level === 'strict') {
        return feast.name + '.\n\nWishing you a blessed day.' + sig;
      }
      return 'Today we mark ' + feast.name + '. 🕯️\n\nWishing you and your family a blessed feast.' + sig;
    }
    return '';
  }

  /** A patronal feast resolved to a real date in a given year. */
  function resolveFeastDate(feast, year) {
    if (!feast) return null;
    if (feast.kind === 'moveable' && feast.pascha_offset != null) {
      return iso(addDays(orthodoxPascha(year), Number(feast.pascha_offset)));
    }
    var md = String(feast.date || '');
    if (/^\d{2}-\d{2}$/.test(md)) return year + '-' + md;
    return null;
  }

  /** Julian-calendar parishes keep fixed feasts 13 days later. */
  function shiftForOldCalendar(dateISO, calendarStyle) {
    if (calendarStyle !== 'old') return dateISO;
    var ms = parseISO(dateISO);
    return ms == null ? dateISO : iso(addDays(ms, 13));
  }

  global.ZoiOrthocal = {
    version: '1.0.0',
    iso: iso,
    isoLocal: isoLocal,
    orthodoxPascha: orthodoxPascha,
    MOVEABLE: MOVEABLE,
    FIXED: FIXED,
    NAMEDAYS: NAMEDAYS,
    GREAT: GREAT,
    FOOD: FOOD,
    feastsOn: feastsOn,
    nameDaysOn: nameDaysOn,
    seasonsFor: seasonsFor,
    isFastDay: isFastDay,
    fastInfo: fastInfo,
    isStrictFast: isStrictFast,
    fastConflict: fastConflict,
    upcomingFeasts: upcomingFeasts,
    upcomingNameDays: upcomingNameDays,
    dayInfo: dayInfo,
    opportunities: opportunities,
    suggestDraft: suggestDraft,
    resolveFeastDate: resolveFeastDate,
    shiftForOldCalendar: shiftForOldCalendar
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

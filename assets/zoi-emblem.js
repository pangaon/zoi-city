/*!
 * zoi-emblem.js — Zoi generated visual identity
 * Classic script (NO ES modules). Zero dependencies.
 *
 * WHY THIS EXISTS
 * The directory holds thousands of real listings and almost none of them have a
 * photograph. Rendering rows of text makes a living record of the Greek world
 * look like a phone book. So every listing gets a generated cover: a tinted
 * gradient, a Greek motif chosen from the listing's own category, and a
 * monogram from its own name.
 *
 * HONESTY: this is decoration derived from a listing's name + category. It is
 * never presented as a photograph of the place. The moment a listing has a real
 * photo_url, callers should render the photo instead — see ZoiEmblem.cover().
 *
 * Everything is expressed in shared design tokens, so covers re-theme with the
 * rest of the site (dark / light / gold) instead of being baked-in colour.
 *
 *   ZoiEmblem.cover({name, type, slug, photo})  -> HTML string (photo or emblem)
 *   ZoiEmblem.emblem({name, type, slug})        -> SVG string
 *   ZoiEmblem.mark({name, type, slug})          -> small square SVG (avatars)
 */
(function (global) {
  'use strict';

  /* ---------- deterministic hash: same listing, same art, forever ---------- */
  function hash(str) {
    var h = 2166136261, i;
    str = String(str == null ? '' : str);
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /* ---------- category system ----------
   * `tint` places the category on one brand axis so the whole grid reads as a
   * family: 0 = fully --gold (warm), 100 = fully --acc (cool). A couple of
   * categories borrow --green to keep long scrolls from feeling monotonous.
   * `motif` is the line-art watermark — it doubles as a category signal, so the
   * grid is scannable by shape before you read a word.
   */
  /* Twelve categories placed on a wheel built from the four brand tokens
   * (gold -> red -> acc -> green -> gold). Only ADJACENT anchors are ever
   * mixed: blending gold straight into blue goes through mud, whereas
   * gold->red->violet->blue->teal->green->olive stays vivid the whole way.
   * The six biggest categories sit far apart on the wheel (slots 0,2,4,6,8,11)
   * so a long scroll never looks monochrome.
   */
  var WHEEL = ['--gold', '--red', '--acc', '--green'];
  var TYPES = {
    business:     { slot: 0,  label: 'Business' },
    vendor:       { slot: 1,  label: 'Vendor' },
    event:        { slot: 2,  label: 'Event' },
    artist:       { slot: 3,  label: 'Artist' },
    creator:      { slot: 4,  label: 'Creator' },
    venue:        { slot: 5,  label: 'Venue' },
    church:       { slot: 6,  label: 'Church' },
    school:       { slot: 7,  label: 'School' },
    professional: { slot: 8,  label: 'Professional' },
    travel_place: { slot: 9,  label: 'Place to go' },
    sports:       { slot: 10, label: 'Sports' },
    organization: { slot: 11, label: 'Association' }
  };
  var FALLBACK = { slot: 0, label: 'Listing' };

  function cfg(type) {
    var k = String(type == null ? '' : type).toLowerCase().trim();
    return TYPES[k] || FALLBACK;
  }

  /* Accent colour for a category, always expressed in shared tokens. */
  function accentOf(c) {
    var seg = Math.floor(c.slot / 3) % 4;          /* which wheel segment */
    var step = c.slot % 3;                          /* 0 = pure anchor */
    var a = WHEEL[seg], b = WHEEL[(seg + 1) % 4];
    if (step === 0) return 'var(' + a + ')';
    var w = step === 1 ? 67 : 33;                   /* 67/33 toward the next anchor */
    return 'color-mix(in srgb, var(' + a + ') ' + w + '%, var(' + b + '))';
  }

  /* ---------- motifs (drawn in a 0 0 24 24 box, stroked, no fill) ---------- */
  var MOTIF = {
    /* storefront: awning + shutter */
    business: 'M3 9l2.2-4h13.6L21 9M3 9h18M4.5 9v11h15V9M4.5 20h15M8 20v-6h8v6',
    /* amphora: body, neck, two handles */
    vendor: 'M9.5 3.4h5M10.4 3.4v2.4C8.4 7 7 9.2 7 11.9c0 3.1 2.2 5.3 5 5.3s5-2.2 5-5.3c0-2.7-1.4-4.9-3.4-6.1V3.4M12 17.2v3.4M9 20.6h6M7.2 8.4C5.6 8.9 4.7 10 4.9 11.3M16.8 8.4c1.6.5 2.5 1.6 2.3 2.9',
    /* laurel star: a star held by two branches */
    event: 'M12 3l1.8 3.9 4.2.5-3.1 2.8.85 4.2L12 12.2 8.25 14.4l.85-4.2L6 7.4l4.2-.5zM5.5 17.5c1.9 2.1 4 3.2 6.5 3.2s4.6-1.1 6.5-3.2',
    /* church: dome, cross, doorway */
    church: 'M12 2.2v2.4M10.9 3.4h2.2M12 4.8c-2.7 1.1-4.2 3.1-4.2 5.6h8.4c0-2.5-1.5-4.5-4.2-5.6zM6.6 10.4h10.8M7.4 10.4V20.6M16.6 10.4V20.6M5 20.6h14M10.2 20.6v-4.8a1.8 1.8 0 013.6 0v4.8',
    /* theatre mask */
    artist: 'M5 5.6h14v5.8c0 4.2-3.1 7.6-7 7.6s-7-3.4-7-7.6zM9 10.2h.01M15 10.2h.01M9.4 14c1.7 1.3 3.5 1.3 5.2 0',
    /* lyre: two arms, crossbar, strings */
    creator: 'M6.6 4.2C4.9 7.4 4.4 10.9 5.4 14.2M17.4 4.2c1.7 3.2 2.2 6.7 1.2 10M4.6 15.6h14.8M6.8 19.4h10.4M4.6 15.6l2.2 3.8M19.4 15.6l-2.2 3.8M9.4 6.4v9.2M12 6.4v9.2M14.6 6.4v9.2M6.6 4.2h10.8',
    /* amphitheatre: tiers + stage */
    venue: 'M3.4 19.6a8.6 8.6 0 0117.2 0M6.6 19.6a5.4 5.4 0 0110.8 0M9.8 19.6a2.2 2.2 0 014.4 0M2.8 19.6h18.4M8.6 8.6L12 5.6l3.4 3',
    /* laurel wreath: two facing branches */
    organization: 'M12 20.4c-3.4-1.4-5.4-4.6-5.4-8.4 0-3 1.2-5.6 3-7.4M12 20.4c3.4-1.4 5.4-4.6 5.4-8.4 0-3-1.2-5.6-3-7.4M8.4 8.6c1.3.2 2.2.9 2.6 2M15.6 8.6c-1.3.2-2.2.9-2.6 2M7.4 12.6c1.3.2 2.2.9 2.6 2M16.6 12.6c-1.3.2-2.2.9-2.6 2',
    /* ionic capital on a column */
    professional: 'M4.6 9.4c0-1.9 1.3-3.2 2.8-3.2 1.4 0 2.4 1.1 2.4 2.4M19.4 9.4c0-1.9-1.3-3.2-2.8-3.2-1.4 0-2.4 1.1-2.4 2.4M4.6 9.4h14.8M7.4 9.4V20M16.6 9.4V20M12 9.4V20M5 20h14',
    /* pediment + columns */
    school: 'M3 8.8L12 3.6l9 5.2M5 8.8h14M6.8 8.8V19M12 8.8V19M17.2 8.8V19M4.4 19h15.2M3 21h18',
    /* sun over water */
    travel_place: 'M12 3.6v1.8M12 12.4a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8zM6.2 6.2l1.3 1.3M17.8 6.2l-1.3 1.3M3.8 9h1.8M18.4 9h1.8M3 16.6c1.5-1.1 3-1.1 4.5 0s3 1.1 4.5 0 3-1.1 4.5 0 2.5 1 3.5.3M3 20c1.5-1.1 3-1.1 4.5 0s3 1.1 4.5 0 3-1.1 4.5 0 2.5 1 3.5.3',
    /* olive wreath ring */
    sports: 'M12 20.6c-4.2 0-7.4-3.4-7.4-8 0-4.8 3.2-8.6 7.4-9.2 4.2.6 7.4 4.4 7.4 9.2 0 4.6-3.2 8-7.4 8zM12 3.4v17.2M9 7.6c1 .5 1.7 1.3 2 2.5M15 7.6c-1 .5-1.7 1.3-2 2.5M8.6 12.4c1 .5 1.7 1.3 2 2.5M15.4 12.4c-1 .5-1.7 1.3-2 2.5'
  };
  function motifOf(type) { return MOTIF[String(type || '').toLowerCase()] || MOTIF.business; }

  /* ---------- monogram ----------
   * Two initials read like a crest; one letter for single-word names. Leading
   * articles and honorifics are skipped so "The Athens Bakery" gives "AB".
   */
  var SKIP = { the: 1, a: 1, an: 1, of: 1, and: 1, at: 1, in: 1, on: 1, for: 1, to: 1, la: 1, le: 1, el: 1, os: 1 };
  function monogram(name) {
    var words = String(name == null ? '' : name)
      .replace(/[()[\]{}"'’.,/\\|–—-]+/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w && !SKIP[w.toLowerCase()]; });
    if (!words.length) return 'Ζ';
    var a = firstLetter(words[0]);
    if (words.length === 1) return a;
    var b = firstLetter(words[1]);
    return b ? (a + b) : a;
  }
  function firstLetter(w) {
    var m = String(w).match(/[\p{L}\p{N}]/u);
    return m ? m[0].toUpperCase() : '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  /* ---------- the emblem ----------
   * Layout is fixed on purpose: monogram bottom-left, category badge top-right.
   * They never collide, so 8,000 covers stay legible and scannable, and the eye
   * always knows where to look. Variation comes from colour, gradient angle and
   * ornament — never from moving the furniture around.
   */
  function emblem(o) {
    o = o || {};
    var c = cfg(o.type);
    var seed = hash(o.slug || o.name || 'zoi');
    var accent = accentOf(c);
    var mono = monogram(o.name);
    var uid = 'e' + (seed % 100000).toString(36);

    var angle = 116 + (seed % 6) * 13;          /* 116..181deg */
    var strength = 58 + (seed >> 3) % 18;       /* 58..75% accent into the card */
    var band = (seed >> 5) % 3;                 /* 0,1 = meander, 2 = none */
    var mono2 = mono.length > 1;

    var g1 = 'color-mix(in srgb, ' + accent + ' ' + strength + '%, var(--card))';
    var g2 = 'color-mix(in srgb, ' + accent + ' 10%, var(--card2))';

    return '' +
'<svg class="ze" viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
  '<defs>' +
    '<linearGradient id="' + uid + 'g" gradientTransform="rotate(' + angle + ' .5 .5)">' +
      '<stop offset="0" stop-color="' + g1 + '"/>' +
      '<stop offset="1" stop-color="' + g2 + '"/>' +
    '</linearGradient>' +
    /* meander (Greek key) — one running hook, tiled */
    '<pattern id="' + uid + 'm" width="22" height="22" patternUnits="userSpaceOnUse">' +
      '<path d="M2 20V5h15v11h-9v-6h5" fill="none" stroke="var(--tx)" stroke-opacity=".5" stroke-width="1.7"/>' +
    '</pattern>' +
    '<linearGradient id="' + uid + 'f" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#000" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#000" stop-opacity=".22"/>' +
    '</linearGradient>' +
  '</defs>' +
  '<rect width="320" height="200" fill="url(#' + uid + 'g)"/>' +
  '<rect width="320" height="200" fill="url(#' + uid + 'f)"/>' +
  (band < 2 ? '<rect y="178" width="320" height="22" fill="url(#' + uid + 'm)" opacity=".2"/>' : '') +
  /* category badge, top-right — the shape tells you what this is before you read */
  '<g transform="translate(246 20)">' +
    '<rect width="54" height="54" rx="16" fill="var(--tx)" fill-opacity=".10"/>' +
    '<rect width="54" height="54" rx="16" fill="none" stroke="var(--tx)" stroke-opacity=".18"/>' +
    '<g transform="translate(13 13) scale(1.16)" opacity=".82">' +
      '<path d="' + motifOf(o.type) + '" fill="none" stroke="var(--tx)" stroke-width="1.5" ' +
        'stroke-linecap="round" stroke-linejoin="round"/>' +
    '</g>' +
  '</g>' +
  /* monogram, bottom-left */
  '<text x="24" y="' + (mono2 ? 158 : 160) + '" font-family="Fraunces,Georgia,serif" font-style="italic" ' +
    'font-weight="300" font-size="' + (mono2 ? 84 : 96) + '" fill="var(--tx)" fill-opacity=".34" ' +
    'letter-spacing="-3">' + esc(mono) + '</text>' +
'</svg>';
  }

  /* ---------- small square mark (avatars, list rows) ---------- */
  function mark(o) {
    o = o || {};
    var c = cfg(o.type);
    var seed = hash(o.slug || o.name || 'zoi');
    var accent = accentOf(c);
    var uid = 'k' + (seed % 100000).toString(36);
    return '' +
'<svg class="ze-mark" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" focusable="false">' +
  '<defs><linearGradient id="' + uid + '" gradientTransform="rotate(' + (120 + (seed % 4) * 18) + ' .5 .5)">' +
    '<stop offset="0" stop-color="color-mix(in srgb, ' + accent + ' 34%, var(--card))"/>' +
    '<stop offset="1" stop-color="color-mix(in srgb, ' + accent + ' 8%, var(--card2))"/>' +
  '</linearGradient></defs>' +
  '<rect width="48" height="48" rx="13" fill="url(#' + uid + ')"/>' +
  '<text x="24" y="33" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-style="italic" ' +
    'font-weight="400" font-size="21" fill="var(--tx)" fill-opacity=".72">' + esc(monogram(o.name)) + '</text>' +
'</svg>';
  }

  /* ---------- cover: a real photo when there is one, else the emblem ---------- */
  function cover(o) {
    o = o || {};
    var photo = String(o.photo == null ? '' : o.photo).trim();
    if (/^https?:\/\//i.test(photo)) {
      return '<img class="ze-photo" src="' + esc(photo) + '" alt="" loading="lazy" decoding="async" ' +
             'onerror="this.parentNode.classList.add(\'ze-fallback\');this.remove()">' +
             '<span class="ze-alt">' + emblem(o) + '</span>';
    }
    return emblem(o);
  }

  global.ZoiEmblem = {
    cover: cover, emblem: emblem, mark: mark,
    monogram: monogram, typeLabel: function (t) { return cfg(t).label; },
    types: TYPES
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

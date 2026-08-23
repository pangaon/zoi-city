/*!
 * _vertical-forms.js — the per-vertical profile editor.
 *
 * WHY THIS EXISTS
 * api/_verticals.js renders 26 purpose-built listing types: a parish page knows
 * about services, sacraments and its patronal feast; a restaurant knows about
 * its menu and reservations; a law practice knows about admissions and its
 * regulator. All of it reads listings.profile — and until now nothing could
 * write it. The schema existed, the renderer existed, and an owner had no form.
 * So a claimed parish still rendered as a name, a category and a city.
 *
 * THE DESIGN THAT MATTERS
 * Every field can arrive pre-filled from profile._enrich — what the enrichment
 * worker read off the business's own website. So claiming is not "fill in thirty
 * empty boxes", it is "check the eight things we already found". Each pre-filled
 * value is visibly marked as unconfirmed until the owner accepts it, and
 * accepting it promotes it from a machine guess to the owner's own word. That
 * distinction is the whole point of keeping the two apart in the database.
 *
 * Classic script, zero dependencies. Exposes ZoiVerticalForms.
 */
(function (global) {
  'use strict';

  /* ---------- field types ----------
   * Deliberately few. Every extra type is another thing to get wrong in three
   * themes and on a phone, and none of these schemas need more than this.
   */
  var T = {
    TEXT: 'text', AREA: 'area', URL: 'url', TEL: 'tel', MAIL: 'mail',
    TIME: 'time', SELECT: 'select', TAGS: 'tags', REPEAT: 'repeat', HOURS: 'hours'
  };

  var DAYS = [['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']];

  /* Fields every vertical gets. `bi:true` means the value may carry a Greek
     sibling (key + '_el'); we never machine-translate, so both are typed. */
  var SHARED = [
    { k: 'tagline', label: 'One line about you', type: T.TEXT, bi: true, max: 120,
      hint: 'Shown under your name. Say what you are, not that you are the best.' },
    { k: 'about', label: 'About', type: T.AREA, bi: true, max: 1200 },
    { k: 'languages', label: 'Languages spoken', type: T.TAGS,
      hint: 'Greek, English, … — this is how the diaspora finds you.' },
    { k: 'service_areas', label: 'Areas you serve', type: T.TAGS },
    { k: 'hours', label: 'Opening hours', type: T.HOURS,
      hint: 'Leave a day blank if you are closed. Times are in your own timezone.' }
  ];

  /* ---------- per-vertical schemas ----------
   * Field names match what api/_verticals.js renders, so anything typed here
   * appears on the public page. Adding a field to one without the other is how
   * you get an editor for something nobody can see.
   */
  var V = {
    church: {
      title: 'Your parish',
      note: 'Times only — every liturgical date is calculated, so you never have to type one.',
      fields: [
        { k: 'services', label: 'Regular services', type: T.REPEAT, of: [
            { k: 'name', label: 'Service', type: T.TEXT, ph: 'Divine Liturgy' },
            { k: 'day', label: 'Day', type: T.SELECT, opts: DAYS.concat([['daily','Daily']]) },
            { k: 'time', label: 'Time', type: T.TIME },
            { k: 'language', label: 'Language', type: T.TEXT, ph: 'Greek / English' }
        ]},
        { k: 'patronal_feast', label: 'Patronal feast', type: T.TEXT,
          hint: 'The saint or feast your parish is named for. The date is worked out for you.' },
        { k: 'clergy', label: 'Clergy', type: T.REPEAT, of: [
            { k: 'name', label: 'Name', type: T.TEXT },
            { k: 'role', label: 'Role', type: T.TEXT, ph: 'Parish Priest' }
        ]},
        { k: 'ministries', label: 'Ministries and groups', type: T.TAGS,
          hint: 'Philoptochos, Sunday school, youth, choir…' },
        { k: 'sacraments', label: 'How to request a sacrament', type: T.AREA,
          hint: 'Baptisms, weddings, memorials — who to contact and what you need.' },
        { k: 'stewardship_url', label: 'Giving / stewardship link', type: T.URL },
        { k: 'festival', label: 'Annual festival', type: T.TEXT, ph: 'Greek Festival, first weekend of June' }
      ]
    },
    restaurant: {
      title: 'Your restaurant',
      fields: [
        { k: 'cuisine', label: 'Cuisine', type: T.TAGS, ph: 'Greek, Cretan, seafood' },
        { k: 'menu_url', label: 'Menu link', type: T.URL },
        { k: 'menu_updated', label: 'Menu last updated', type: T.TEXT, ph: '2026-06' ,
          hint: 'So diners know it is current. A stale menu costs you a table.' },
        { k: 'specials', label: 'Regular specials', type: T.REPEAT, of: [
            { k: 'name', label: 'Dish', type: T.TEXT },
            { k: 'when', label: 'When', type: T.TEXT, ph: 'Fridays' }
        ]},
        { k: 'reserve_url', label: 'Reservations link', type: T.URL },
        { k: 'order_url', label: 'Order / delivery link', type: T.URL },
        { k: 'catering', label: 'Catering', type: T.AREA },
        { k: 'price_range', label: 'Price range', type: T.SELECT,
          opts: [['','—'],['$','$'],['$$','$$'],['$$$','$$$'],['$$$$','$$$$']] }
      ]
    },
    professional: {
      title: 'Your practice',
      note: 'Regulated fields are checked before they are published. A licence number is not optional.',
      fields: [
        { k: 'practice_areas', label: 'Practice areas', type: T.TAGS },
        { k: 'registrations', label: 'Registrations and licences', type: T.REPEAT, of: [
            { k: 'body', label: 'Regulator', type: T.TEXT, ph: 'Law Society of Ontario' },
            { k: 'number', label: 'Number', type: T.TEXT },
            { k: 'jurisdiction', label: 'Jurisdiction', type: T.TEXT }
        ], hint: 'Required. Without this, protected titles are suppressed on your page.' },
        { k: 'consult', label: 'How a first consultation works', type: T.AREA },
        { k: 'consult_fee', label: 'Consultation fee', type: T.TEXT, ph: 'Free / $150' },
        { k: 'booking_url', label: 'Booking link', type: T.URL }
      ]
    },
    school: {
      title: 'Your school',
      fields: [
        { k: 'programs', label: 'Programmes', type: T.REPEAT, of: [
            { k: 'name', label: 'Programme', type: T.TEXT, ph: 'Saturday Greek School' },
            { k: 'ages', label: 'Ages', type: T.TEXT, ph: '5–12' },
            { k: 'when', label: 'When', type: T.TEXT, ph: 'Sat 09:30–12:30' }
        ]},
        { k: 'enrolment', label: 'Enrolment', type: T.AREA, hint: 'When it opens, how to apply.' },
        { k: 'tuition', label: 'Tuition', type: T.TEXT },
        { k: 'exam_prep', label: 'Exams prepared for', type: T.TAGS, ph: 'Ellinomatheia' },
        { k: 'enrol_url', label: 'Enrolment link', type: T.URL }
      ]
    },
    organization: {
      title: 'Your association',
      fields: [
        { k: 'origin', label: 'Region or village of origin', type: T.TEXT,
          hint: 'The thing members actually search for.' },
        { k: 'founded', label: 'Founded', type: T.TEXT, ph: '1954' },
        { k: 'membership', label: 'How to become a member', type: T.AREA },
        { k: 'membership_url', label: 'Membership link', type: T.URL },
        { k: 'meetings', label: 'When you meet', type: T.TEXT, ph: 'Second Tuesday, 19:00' },
        { k: 'scholarships', label: 'Scholarships', type: T.AREA },
        { k: 'give_url', label: 'Donate link', type: T.URL }
      ]
    },
    creator: {
      title: 'Your work',
      note: 'Follower counts are never typed in. They only ever come from a connected account.',
      fields: [
        { k: 'work', label: 'Selected work', type: T.REPEAT, of: [
            { k: 'title', label: 'Title', type: T.TEXT },
            { k: 'url', label: 'Link', type: T.URL },
            { k: 'year', label: 'Year', type: T.TEXT }
        ]},
        { k: 'rate_card_url', label: 'Rate card', type: T.URL },
        { k: 'collab_email', label: 'Brand enquiries to', type: T.MAIL },
        { k: 'press_kit_url', label: 'Press kit', type: T.URL }
      ]
    },
    venue: {
      title: 'Your venue',
      fields: [
        { k: 'spaces', label: 'Spaces', type: T.REPEAT, of: [
            { k: 'name', label: 'Space', type: T.TEXT },
            { k: 'seated', label: 'Seated', type: T.TEXT },
            { k: 'standing', label: 'Standing', type: T.TEXT }
        ]},
        { k: 'hire_enquiry_url', label: 'Hire enquiry link', type: T.URL },
        { k: 'catering_model', label: 'Catering', type: T.SELECT,
          opts: [['','—'],['in_house','In-house only'],['preferred','Preferred list'],['byo','Bring your own']] }
      ]
    },
    event: {
      title: 'Your event',
      fields: [
        { k: 'starts', label: 'Starts', type: T.TEXT, ph: '2026-06-14 18:00' },
        { k: 'ends', label: 'Ends', type: T.TEXT },
        { k: 'venue_name', label: 'Venue', type: T.TEXT },
        { k: 'tickets_url', label: 'Tickets link', type: T.URL },
        { k: 'lineup', label: 'Line-up', type: T.TAGS },
        { k: 'admission', label: 'Admission', type: T.TEXT, ph: 'Free / $20' }
      ]
    },
    generic: {
      title: 'Your details',
      fields: [
        { k: 'founded', label: 'Established', type: T.TEXT },
        { k: 'highlights', label: 'What you are known for', type: T.TAGS },
        { k: 'booking_url', label: 'Booking or enquiry link', type: T.URL }
      ]
    }
  };

  /* Route an entity to a schema, mirroring api/_verticals.js so the editor and
     the page it feeds never disagree about which vertical a listing is. */
  var CATMAP = [
    // Stems, not words: the category slugs are plural ('bakeries', 'tavernas'),
    // and 'bakery' does not match 'bakeries' — that one silently routed every
    // bakery in the directory to the generic form.
    [/restaurant|taverna|cafe|kafene|baker|patisserie|pastry|deli|grocer|butcher|food|meze|souvla/i, 'restaurant'],
    [/lawyer|attorney|doctor|dentist|accountant|realtor|architect|engineer|insur|financ|notar/i, 'professional'],
    [/school|studies|language|academy/i, 'school'],
    [/church|monaster|parish|chapel|cathedral/i, 'church'],
    [/association|society|federation|charit|ngo|foundation|community/i, 'organization'],
    [/influencer|creator|media|artist|musician|dj|podcast|radio|photograph/i, 'creator'],
    [/venue|hall|centre|center|theatre|theater/i, 'venue'],
    [/festival|event|concert|panigiri/i, 'event']
  ];
  function schemaFor(entityType, categorySlug) {
    var t = String(entityType || '').toLowerCase();
    if (V[t]) return { key: t, schema: V[t] };
    var c = String(categorySlug || '');
    for (var i = 0; i < CATMAP.length; i++) {
      if (CATMAP[i][0].test(c) || CATMAP[i][0].test(t)) {
        var k = CATMAP[i][1];
        if (V[k]) return { key: k, schema: V[k] };
      }
    }
    return { key: 'generic', schema: V.generic };
  }

  /** Every field a vertical shows: its own, then the shared ones. */
  function fieldsFor(entityType, categorySlug) {
    var r = schemaFor(entityType, categorySlug);
    return { key: r.key, title: r.schema.title, note: r.schema.note || '',
             fields: r.schema.fields.concat(SHARED) };
  }

  /**
   * Split a profile into what the owner has said and what we merely read.
   * Returns { own, found, fromWebsite } where fromWebsite lists the keys that
   * exist only as a machine guess — those are the ones to ask about.
   */
  function partition(profile, fields) {
    var p = (profile && typeof profile === 'object') ? profile : {};
    var enr = (p._enrich && typeof p._enrich === 'object') ? p._enrich : {};
    var own = {}, found = {}, fromWebsite = [];
    fields.forEach(function (f) {
      var has = Object.prototype.hasOwnProperty.call(p, f.k) && !isEmpty(p[f.k]);
      if (has) { own[f.k] = p[f.k]; return; }
      // enrichment uses a few different names for the same idea
      var alt = ENRICH_ALIAS[f.k] || f.k;
      if (Object.prototype.hasOwnProperty.call(enr, alt) && !isEmpty(enr[alt])) {
        found[f.k] = enr[alt];
        fromWebsite.push(f.k);
      }
    });
    return { own: own, found: found, fromWebsite: fromWebsite,
             source: enr.source_url || '', checked: enr.checked_at || '' };
  }

  /* The enrichment worker names some things differently from the public schema;
     map them rather than duplicating fields. */
  var ENRICH_ALIAS = {
    about: 'description', tagline: 'tagline', menu_url: 'menu_url',
    order_url: 'order_url', reserve_url: 'booking_url', booking_url: 'booking_url',
    give_url: 'give_url', stewardship_url: 'give_url', hours: 'hours',
    price_range: 'price_range', cuisine: 'cuisine'
  };

  function isEmpty(v) {
    if (v === null || v === undefined || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  }

  /**
   * Strip anything that must never be stored, and drop empties so a profile does
   * not fill up with nulls. The database strips these too — this is the second
   * of two locks, not the only one.
   */
  var BANNED = /^(rating|rating_count|reviews?|review_count|aggregaterating|score|stars|ranking|provider_stats|_enrich|_geo|_meta)$/i;
  function clean(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) {
      if (BANNED.test(k)) return;
      var v = obj[k];
      if (isEmpty(v)) return;
      if (Array.isArray(v)) {
        var arr = v.map(function (x) {
          if (x && typeof x === 'object') { var o = clean(x); return Object.keys(o).length ? o : null; }
          return (typeof x === 'string') ? x.trim() : x;
        }).filter(function (x) { return !isEmpty(x); });
        if (arr.length) out[k] = arr;
        return;
      }
      out[k] = (typeof v === 'string') ? v.trim() : v;
    });
    return out;
  }

  global.ZoiVerticalForms = {
    T: T, DAYS: DAYS, SHARED: SHARED, VERTICALS: V,
    schemaFor: schemaFor, fieldsFor: fieldsFor,
    partition: partition, clean: clean, isEmpty: isEmpty, ENRICH_ALIAS: ENRICH_ALIAS
  };
})(typeof window !== 'undefined' ? window : globalThis);

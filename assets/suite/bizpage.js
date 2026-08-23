/*!
 * bizpage.js — Zoi Suite module: Business page editor
 * Classic script (NO ES modules). Self-contained IIFE. Zero external deps.
 *
 * HONESTY CONTRACT (hard requirement): this module never fabricates a claim or
 * a verification. It asks bizpage_status(ctx.ws) whether THIS workspace has a
 * claimed listing. If it does not, it shows an honest "claim your business
 * first" state that points to /explore — it does NOT invent a page. A
 * verification badge is shown ONLY when the backend reports the listing as
 * verified. Everything else is user-entered content the operator owns.
 *
 * Registers into window.ZoiSuite.modules.
 *   mount(root, ctx); ctx = { C:ZoiCore, ws(uuid), channels:[], avail, toast }
 *   ctx.C provides: esc, relTime, toast, api.rpc(fn, params, {auth}) -> Promise
 *
 * RPCs:
 *   bizpage_status(p_workspace) -> status object (shape inspected defensively)
 *   bizpage_get(p_workspace, p_listing) -> current page content  (read)
 *   bizpage_save(p_workspace, p_listing, p_description, p_phone, p_email,
 *                p_website, p_hours, p_price_range, p_photo_url, p_social)
 *                -> {ok}  (write, auth:'require')
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zp-styles';
  var VERSION = '1.0.0';

  var PRICE_OPTS = [
    { v: '', label: 'Not set' },
    { v: '$', label: '$ · Budget' },
    { v: '$$', label: '$$ · Moderate' },
    { v: '$$$', label: '$$$ · Upscale' },
    { v: '$$$$', label: '$$$$ · Fine' }
  ];

  // Social platforms we offer as row options. Assembled into a jsonb object
  // keyed by platform, e.g. { instagram:'…', facebook:'…', website:'…' }.
  var SOCIAL_PLATFORMS = [
    { key: 'instagram', name: 'Instagram' },
    { key: 'facebook',  name: 'Facebook' },
    { key: 'tiktok',    name: 'TikTok' },
    { key: 'youtube',   name: 'YouTube' },
    { key: 'x',         name: 'X (Twitter)' },
    { key: 'linkedin',  name: 'LinkedIn' },
    { key: 'website',   name: 'Website' }
  ];
  var SOCIAL_NAME = {};
  SOCIAL_PLATFORMS.forEach(function (p) { SOCIAL_NAME[p.key] = p.name; });

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
  // first defined (non null/undefined) argument, else null
  function firstDef() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] != null) return arguments[i];
    }
    return null;
  }
  // first non-empty string, else ''
  function firstStr() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }
  function normPlatform(p) {
    p = String(p == null ? '' : p).toLowerCase().trim();
    if (p === 'twitter') return 'x';
    if (p === 'ig') return 'instagram';
    if (p === 'fb') return 'facebook';
    if (p === 'yt') return 'youtube';
    if (p === 'in' || p === 'linked-in') return 'linkedin';
    return p;
  }

  /* ---------- defensive normalization of bizpage_status ----------
   * The exact shape is not guaranteed. We probe a broad set of likely field
   * names and reduce them to a stable internal view. If we cannot positively
   * establish a claimed listing (with an id we can edit), we treat the
   * workspace as UN-claimed and show the honest claim-first state.
   */
  function normStatus(raw) {
    var view = {
      claimed: false,
      listingId: null,
      name: '',
      category: '',
      verified: false,
      verificationStatus: '',
      claimStatus: '',
      slug: '',
      raw: raw
    };
    if (raw == null) return view;

    // Some backends wrap the payload: {status:{...}} or [ {...} ]
    var o = raw;
    if (Array.isArray(o)) o = o[0] || null;
    if (o == null || typeof o !== 'object') return view;
    var listing = (o.listing && typeof o.listing === 'object') ? o.listing : null;

    // ---- listing id (uuid) ----
    view.listingId = firstStr(
      o.listing_id, o.listingId, o.id, o.business_id, o.businessId,
      listing && listing.id, listing && listing.listing_id
    ) || null;

    // ---- name ----
    view.name = firstStr(
      o.name, o.business_name, o.businessName, o.listing_name, o.title,
      listing && (listing.name || listing.business_name || listing.title)
    );
    view.category = firstStr(
      o.category, o.category_name, o.type,
      listing && (listing.category || listing.category_name)
    );

    // ---- claim state ----
    var claimFlag = firstDef(
      o.has_page, o.hasPage, o.has_listing, o.hasListing,
      o.claimed, o.is_claimed, o.isClaimed, o.owns_listing
    );
    view.claimStatus = firstStr(o.claim_status, o.claimStatus, o.status, o.state);
    var claimed;
    if (typeof claimFlag === 'boolean') {
      claimed = claimFlag;
    } else if (view.claimStatus) {
      var cs = view.claimStatus.toLowerCase();
      // explicit "no claim" signals win
      if (/^(none|unclaimed|no[_-]?claim|not[_-]?claimed|available|pending_claim)$/.test(cs)) claimed = false;
      else claimed = /claim|approv|active|verified|owned|granted|complete/.test(cs);
    } else {
      claimed = !!view.listingId;
    }
    // We can only edit a page we can address by id.
    view.claimed = !!(claimed && view.listingId);

    // ---- verification (badge only when backend affirms it) ----
    var verifiedFlag = firstDef(
      o.verified, o.is_verified, o.isVerified,
      listing && (listing.verified != null ? listing.verified : listing.is_verified)
    );
    view.verificationStatus = firstStr(
      o.verification_status, o.verificationStatus, o.verify_status,
      listing && (listing.verification_status || listing.verificationStatus)
    );
    if (typeof verifiedFlag === 'boolean') {
      view.verified = verifiedFlag;
    } else if (view.verificationStatus) {
      view.verified = /verified|approved|confirmed|complete/i.test(view.verificationStatus);
    } else {
      view.verified = false;
    }

    // ---- public slug (for /p/<slug>) ----
    view.slug = firstStr(
      o.slug, o.public_slug, o.publicSlug, o.handle, o.path_slug,
      listing && (listing.slug || listing.public_slug)
    );

    return view;
  }

  // Normalize bizpage_get content into a stable draft object.
  function normContent(raw) {
    var o = (raw && typeof raw === 'object') ? raw : {};
    var draft = {
      description: firstStr(o.description, o.about, o.bio),
      phone: firstStr(o.phone, o.phone_number, o.tel),
      email: firstStr(o.email, o.contact_email),
      website: firstStr(o.website, o.url, o.site),
      hours: firstStr(o.hours, o.opening_hours, o.business_hours),
      price_range: firstStr(o.price_range, o.priceRange, o.price),
      photo_url: firstStr(o.photo_url, o.photoUrl, o.image_url, o.photo, o.image),
      social: normSocialRows(firstDef(o.social, o.socials, o.social_links, o.links))
    };
    // Clamp price_range to a known option; unknown values fall back to ''.
    var known = false;
    for (var i = 0; i < PRICE_OPTS.length; i++) { if (PRICE_OPTS[i].v === draft.price_range) { known = true; break; } }
    if (!known) draft.price_range = '';
    return draft;
  }

  // Accepts jsonb object {instagram:'…',…}, array [{platform,url}], or null.
  // Returns an array of {platform, url} rows (kept in a stable order).
  function normSocialRows(social) {
    var rows = [];
    if (social == null) return rows;
    if (Array.isArray(social)) {
      social.forEach(function (r) {
        if (!r) return;
        if (typeof r === 'string') { return; } // bare url without platform — skip, ambiguous
        var plat = normPlatform(r.platform || r.network || r.name || r.key || r.type);
        var url = firstStr(r.url, r.link, r.href, r.value);
        if (url) rows.push({ platform: plat || 'website', url: url });
      });
    } else if (typeof social === 'object') {
      Object.keys(social).forEach(function (k) {
        var url = social[k];
        if (url == null) return;
        if (typeof url === 'object') url = firstStr(url.url, url.link, url.href, url.value);
        url = firstStr(url);
        if (url) rows.push({ platform: normPlatform(k) || 'website', url: url });
      });
    }
    return rows;
  }

  // Assemble editor rows -> jsonb object { platform: url }. Empty urls dropped;
  // duplicate platforms: last non-empty wins.
  function assembleSocial(rows) {
    var obj = {};
    (rows || []).forEach(function (r) {
      var plat = normPlatform(r.platform);
      var url = firstStr(r.url);
      if (plat && url) obj[plat] = url;
    });
    return obj;
  }

  /* ---------- completeness ---------- */
  function completeness(draft) {
    var checks = [
      !!firstStr(draft.description),
      !!firstStr(draft.phone),
      !!firstStr(draft.email),
      !!firstStr(draft.website),
      !!firstStr(draft.hours),
      !!firstStr(draft.price_range),
      !!firstStr(draft.photo_url),
      (draft.social || []).some(function (r) { return !!firstStr(r.url); })
    ];
    var done = checks.filter(Boolean).length;
    return { done: done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
  }

  /* ---------- styles ---------- */
  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var css = [
      '.zp-wrap{font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--tx);display:flex;flex-direction:column;gap:16px}',
      '.zp-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px}',
      '.zp-title{font-weight:800;font-size:17px;margin:0;display:flex;align-items:center;gap:9px}',
      '.zp-title small{font-weight:600;font-size:11.5px;color:var(--mut)}',
      '.zp-sub{font-size:12.5px;color:var(--mut);margin:2px 0 0;max-width:640px;line-height:1.5}',
      '.zp-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.zp-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font:700 12.5px "Hanken Grotesk",system-ui;cursor:pointer;transition:.15s;text-decoration:none}',
      '.zp-btn:hover{border-color:var(--acc);color:var(--acc)}',
      '.zp-btn svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zp-btn[disabled]{opacity:.5;cursor:not-allowed;pointer-events:none}',
      '.zp-btn.primary{background:var(--acc);border-color:var(--acc);color:#fff}',
      '.zp-btn.primary:hover{filter:brightness(1.08);color:#fff}',
      '.zp-btn.ghost{background:none}',
      /* layout */
      '.zp-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start}',
      '@media(max-width:900px){.zp-grid{grid-template-columns:1fr}}',
      '.zp-card{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:16px;min-width:0}',
      '.zp-card h3{margin:0 0 3px;font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}',
      '.zp-card .zp-csub{color:var(--mut);font-size:11.5px;margin:0 0 14px}',
      /* form */
      '.zp-field{display:flex;flex-direction:column;gap:6px;margin-bottom:13px}',
      '.zp-field label{font-size:12px;font-weight:700;color:var(--mut);display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.zp-field label .zp-hint{font-weight:600;color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}',
      '.zp-input,.zp-textarea,.zp-select{width:100%;background:var(--bg3);border:1px solid var(--line);border-radius:10px;color:var(--tx);font:500 13px "Hanken Grotesk",system-ui;padding:9px 11px;transition:.15s}',
      '.zp-input:focus,.zp-textarea:focus,.zp-select:focus{outline:none;border-color:var(--acc)}',
      '.zp-textarea{resize:vertical;min-height:84px;line-height:1.5}',
      '.zp-select{appearance:none;cursor:pointer}',
      '.zp-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '@media(max-width:480px){.zp-row2{grid-template-columns:1fr}}',
      /* social rows */
      '.zp-social{display:flex;flex-direction:column;gap:9px}',
      '.zp-srow{display:grid;grid-template-columns:130px 1fr auto;gap:8px;align-items:center}',
      '@media(max-width:480px){.zp-srow{grid-template-columns:110px 1fr auto}}',
      '.zp-srm{background:none;border:1px solid var(--line);color:var(--mut);border-radius:9px;width:32px;height:34px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none;transition:.15s}',
      '.zp-srm:hover{border-color:#d6708a;color:#d6708a}',
      '.zp-srm svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zp-addrow{align-self:flex-start;margin-top:2px}',
      '.zp-formfoot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;padding-top:14px;border-top:1px solid var(--line2)}',
      /* completeness meter */
      '.zp-meter{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}',
      '.zp-meter-top{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:700;color:var(--mut)}',
      '.zp-meter-top b{color:var(--tx);font-weight:800}',
      '.zp-meter-track{height:8px;background:var(--bg3);border-radius:6px;overflow:hidden;border:1px solid var(--line)}',
      '.zp-meter-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,var(--gold),var(--green));transition:width .35s;min-width:2px}',
      /* preview card */
      '.zp-pv{position:sticky;top:12px}',
      '.zp-pv-shell{background:var(--bg);border:1px solid var(--line);border-radius:14px;overflow:hidden}',
      '.zp-pv-photo{width:100%;height:150px;background:var(--bg3);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:12px;border-bottom:1px solid var(--line)}',
      '.zp-pv-body{padding:15px 16px}',
      '.zp-pv-name{font-size:17px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1.25}',
      '.zp-pv-cat{font-size:11.5px;color:var(--mut);font-weight:600;margin:3px 0 0}',
      '.zp-verify{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;color:var(--green);background:rgba(46,139,87,.14);border:1px solid rgba(46,139,87,.4);border-radius:20px;padding:2px 9px;text-transform:uppercase;letter-spacing:.04em}',
      '.zp-verify svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2.4}',
      '.zp-pv-desc{font-size:13px;color:var(--tx);line-height:1.55;margin:12px 0 0;white-space:pre-wrap;word-break:break-word}',
      '.zp-pv-desc.muted{color:var(--dim);font-style:italic}',
      '.zp-pv-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}',
      '.zp-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:var(--mut);background:var(--bg3);border:1px solid var(--line);border-radius:20px;padding:5px 11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.zp-chip svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;flex:none}',
      '.zp-chip.price b{color:var(--gold);font-weight:800;letter-spacing:1px}',
      '.zp-pv-contact{display:flex;flex-direction:column;gap:7px;margin-top:13px;padding-top:13px;border-top:1px solid var(--line2)}',
      '.zp-pv-line{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--tx);min-width:0}',
      '.zp-pv-line svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;color:var(--mut);flex:none}',
      '.zp-pv-line a{color:var(--acc);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.zp-pv-line a:hover{text-decoration:underline}',
      '.zp-pv-line span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.zp-pv-social{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}',
      '.zp-pv-social a{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--mut);background:var(--bg3);border:1px solid var(--line);border-radius:8px;padding:4px 9px;text-decoration:none;transition:.15s}',
      '.zp-pv-social a:hover{border-color:var(--acc);color:var(--acc)}',
      '.zp-pv-empty{color:var(--dim);font-size:12px;text-align:center;padding:8px}',
      '.zp-pvlabel{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);margin:0 0 9px;display:flex;align-items:center;gap:7px}',
      '.zp-pvlabel::after{content:"";flex:1;height:1px;background:var(--line2)}',
      /* claim-first state */
      '.zp-claim{background:linear-gradient(135deg,rgba(184,137,59,.10),rgba(59,130,246,.06));border:1px solid rgba(184,137,59,.34);border-radius:18px;padding:28px 24px;text-align:center;max-width:620px;margin:8px auto}',
      '.zp-claim .zp-ic{width:52px;height:52px;border-radius:14px;background:rgba(184,137,59,.16);color:var(--gold);display:inline-flex;align-items:center;justify-content:center;margin:0 auto 14px}',
      '.zp-claim .zp-ic svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2}',
      '.zp-claim h3{margin:0 0 8px;font-size:18px;font-weight:800}',
      '.zp-claim p{margin:0 auto 8px;font-size:13.5px;color:var(--tx);line-height:1.6;max-width:480px}',
      '.zp-claim p.zp-note{font-size:12px;color:var(--mut)}',
      '.zp-claim .zp-cta{margin-top:16px;display:inline-flex;gap:10px;flex-wrap:wrap;justify-content:center}',
      '.zp-claim .zp-status{margin-top:14px;font-size:11.5px;color:var(--mut)}',
      '.zp-claim .zp-status b{color:var(--tx)}',
      /* skeleton / states */
      '.zp-skel{background:linear-gradient(90deg,var(--bg3),var(--bg2),var(--bg3));background-size:200% 100%;animation:zp-sh 1.2s infinite;border-radius:12px}',
      '@keyframes zp-sh{0%{background-position:200% 0}100%{background-position:-200% 0}}',
      '.zp-err{background:rgba(214,112,138,.08);border:1px solid rgba(214,112,138,.35);color:#e8a7b8;border-radius:14px;padding:16px;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.zp-note{font-size:12px;color:var(--mut);margin:0}',
      '.zp-spin{width:15px;height:15px;border:2px solid var(--line);border-top-color:var(--acc);border-radius:50%;display:inline-block;animation:zp-rot .7s linear infinite;vertical-align:-2px}',
      '@keyframes zp-rot{to{transform:rotate(360deg)}}',
      '.zp-badge{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:20px;border:1px solid currentColor}',
      '.zp-badge.gold{color:var(--gold)}',
      '.zp-badge.green{color:var(--green)}',
      '.zp-badge.mut{color:var(--mut)}'
    ].join('\n');
    var st = el(doc, 'style', null, css);
    st.id = STYLE_ID;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ---------- small svg icons ---------- */
  var IC = {
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
    store: '<svg viewBox="0 0 24 24"><path d="M3 9 4 3h16l1 6"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 21v-6h6v6"/></svg>'
  };

  /* ================= MOUNT ================= */
  async function mountBizPage(root, ctx) {
    ctx = ctx || {};
    var doc = root.ownerDocument || global.document;
    var C = ctx.C || global.ZoiCore || {};
    var esc = (C && C.esc) || fallbackEsc;
    var toast = ctx.toast || (C && C.toast) || function () {};
    var ws = ctx.ws;
    injectStyle(doc);

    var state = {
      loading: true,
      error: null,
      status: null,      // normalized status view
      draft: null,       // editor draft (also drives preview)
      saving: false,
      vform: null,       // the per-vertical profile form, once mounted
      vkind: '',         // which vertical it resolved to
      entity: null       // the public record, for entity_type / category / profile
    };

    root.innerHTML = '';
    var wrap = el(doc, 'div', 'zp-wrap');
    root.appendChild(wrap);

    /* ---- rpc helpers ---- */
    function rpcRead(fn, params) {
      if (!C.api || typeof C.api.rpc !== 'function') return Promise.reject(new Error('RPC unavailable'));
      return C.api.rpc(fn, params, { auth: 'require' });
    }
    function rpcWrite(fn, params) {
      if (!C.api || typeof C.api.rpc !== 'function') return Promise.reject(new Error('RPC unavailable'));
      return C.api.rpc(fn, params, { auth: 'require' });
    }

    /* ---- public link ---- */
    function publicPath() {
      var slug = state.status && state.status.slug;
      return slug ? ('/p/' + slug) : null;
    }
    function publicUrl() {
      var p = publicPath();
      if (!p) return null;
      try {
        var origin = (global.location && global.location.origin) || '';
        return origin ? origin + p : p;
      } catch (e) { return p; }
    }
    function copyLink(btn) {
      var url = publicUrl();
      if (!url) return;
      function done(ok) { toast(ok ? 'Public link copied.' : 'Copy failed — here it is: ' + url); }
      try {
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
          return;
        }
      } catch (e) {}
      // fallback via temp textarea
      try {
        var ta = el(doc, 'textarea'); ta.value = url;
        ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px';
        (doc.body || doc.documentElement).appendChild(ta);
        ta.focus(); ta.select();
        var ok = doc.execCommand && doc.execCommand('copy');
        ta.parentNode && ta.parentNode.removeChild(ta);
        done(!!ok);
      } catch (e2) { done(false); }
    }

    /* ---- header (always present in editor + claim states) ---- */
    function renderHeader(sub) {
      var head = el(doc, 'div', 'zp-head');
      var left = el(doc, 'div');
      left.appendChild(el(doc, 'h2', 'zp-title',
        '<span style="display:inline-flex;color:var(--gold)">' + IC.store + '</span> Business page' +
        '<small>your public listing</small>'));
      if (sub) left.appendChild(el(doc, 'p', 'zp-sub', sub));
      head.appendChild(left);
      return head;
    }

    /* ---- loading ---- */
    function renderLoading() {
      wrap.innerHTML = '';
      wrap.appendChild(renderHeader(''));
      var g = el(doc, 'div', 'zp-grid');
      var a = el(doc, 'div', 'zp-skel'); a.style.height = '440px';
      var b = el(doc, 'div', 'zp-skel'); b.style.height = '340px';
      g.appendChild(a); g.appendChild(b);
      wrap.appendChild(g);
      wrap.appendChild(el(doc, 'p', 'zp-note', '<span class="zp-spin"></span> Checking your business listing…'));
    }

    /* ---- error ---- */
    function renderError(msg) {
      wrap.innerHTML = '';
      wrap.appendChild(renderHeader(''));
      var e = el(doc, 'div', 'zp-err');
      e.innerHTML = '<span>' + esc(msg || 'Could not load your business page.') + '</span>';
      var retry = el(doc, 'button', 'zp-btn', 'Retry');
      retry.addEventListener('click', function () { boot(); });
      e.appendChild(retry);
      wrap.appendChild(e);
    }

    /* ---- claim-first (honest: no page invented) ---- */
    function renderClaimFirst() {
      wrap.innerHTML = '';
      wrap.appendChild(renderHeader(''));

      var card = el(doc, 'div', 'zp-claim');
      card.appendChild(el(doc, 'div', 'zp-ic', IC.store));
      card.appendChild(el(doc, 'h3', null, 'Claim your business first'));
      card.appendChild(el(doc, 'p', null,
        'A business page is the public face of a listing you own. This workspace ' +
        'is not linked to a claimed listing yet, so there is nothing to edit here.'));
      card.appendChild(el(doc, 'p', 'zp-note',
        'Find your business in the directory and claim it. Once your claim is ' +
        'approved, this editor unlocks and you can add your description, hours, ' +
        'contact details and photos.'));

      var cta = el(doc, 'div', 'zp-cta');
      var explore = el(doc, 'a', 'zp-btn primary',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Find & claim on Explore');
      explore.setAttribute('href', '/explore');
      cta.appendChild(explore);
      card.appendChild(cta);

      // If the backend gave us a partial signal (e.g. a pending claim), surface
      // it honestly rather than pretending everything is fine.
      var s = state.status || {};
      if (s.name || s.claimStatus) {
        var line = el(doc, 'div', 'zp-status');
        var bits = [];
        if (s.name) bits.push('Detected listing: <b>' + esc(s.name) + '</b>');
        if (s.claimStatus) bits.push('claim status: <b>' + esc(s.claimStatus) + '</b>');
        line.innerHTML = bits.join(' · ');
        card.appendChild(line);
      }

      wrap.appendChild(card);
    }

    /* ---- editor ---- */
    /**
     * Fetch the public record for the claimed listing and mount the per-vertical
     * form. entity_type, category and the current profile all come from
     * seo_entity, which is the same source the public page renders from — so the
     * editor can never offer a field the page will not show.
     */
    async function mountVertical(slot) {
      var UI = global.ZoiVerticalUI, FS = global.ZoiVerticalForms;
      if (!UI || !FS || !slot) return;                       // degrade to the basics
      var slug = state.status && state.status.slug;
      if (!slug) return;
      slot.innerHTML = '<p class="zp-note">Loading your details\u2026</p>';
      try {
        var raw = await rpcRead('seo_entity', { p_slug: slug });
        var e = Array.isArray(raw) ? raw[0] : raw;
        if (!e) { slot.innerHTML = ''; return; }
        state.entity = e;
        var spec = FS.fieldsFor(e.entity_type, e.category_slug);
        state.vkind = spec.key === 'generic' ? 'details' : spec.key + ' details';
        state.vform = UI.render(slot, {
          entityType: e.entity_type,
          categorySlug: e.category_slug,
          profile: e.profile,
          onDirty: function () { /* the save button is always enabled here */ }
        });
      } catch (err) {
        // Never block the basics on this.
        slot.innerHTML = '<p class="zp-note">Could not load your detailed fields '
          + '(' + fallbackEsc((err && err.message) || 'unknown error') + '). '
          + 'The fields above still save.</p>';
      }
    }

    function renderEditor() {
      wrap.innerHTML = '';
      var s = state.status;

      // header + tools
      var head = renderHeader('Edit how ' + (s.name ? '“' + s.name + '”' : 'your business') +
        ' appears publicly. Changes show live in the preview; nothing is public until you save.');
      var tools = el(doc, 'div', 'zp-tools');
      if (publicPath()) {
        var copyBtn = el(doc, 'button', 'zp-btn', IC.link + ' Copy public link');
        copyBtn.addEventListener('click', function () { copyLink(copyBtn); });
        tools.appendChild(copyBtn);
        var viewBtn = el(doc, 'a', 'zp-btn ghost',
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg> View');
        viewBtn.setAttribute('href', publicPath());
        viewBtn.setAttribute('target', '_blank');
        viewBtn.setAttribute('rel', 'noopener');
        tools.appendChild(viewBtn);
      }
      head.appendChild(tools);
      wrap.appendChild(head);

      var grid = el(doc, 'div', 'zp-grid');

      /* ===== FORM CARD ===== */
      var form = el(doc, 'form', 'zp-card');
      form.setAttribute('novalidate', 'novalidate');
      form.appendChild(el(doc, 'h3', null, 'Page details'));
      form.appendChild(el(doc, 'p', 'zp-csub', 'All fields optional — a fuller page ranks and converts better.'));

      // completeness meter (updated live)
      var meter = el(doc, 'div', 'zp-meter');
      meter.innerHTML =
        '<div class="zp-meter-top"><span>Profile completeness</span><b class="zp-meter-pct">0%</b></div>' +
        '<div class="zp-meter-track"><div class="zp-meter-fill" style="width:0%"></div></div>';
      form.appendChild(meter);
      var meterFill = meter.querySelector('.zp-meter-fill');
      var meterPct = meter.querySelector('.zp-meter-pct');

      var d = state.draft;

      function field(labelText, hint) {
        var f = el(doc, 'div', 'zp-field');
        var lab = el(doc, 'label', null, esc(labelText) + (hint ? '<span class="zp-hint">' + esc(hint) + '</span>' : ''));
        f.appendChild(lab);
        return f;
      }

      // description
      var fDesc = field('Description');
      var taDesc = el(doc, 'textarea', 'zp-textarea');
      taDesc.setAttribute('placeholder', 'Tell customers what makes your business special…');
      taDesc.setAttribute('maxlength', '1000');
      taDesc.value = d.description;
      fDesc.appendChild(taDesc);
      form.appendChild(fDesc);

      // phone + email
      var rowCE = el(doc, 'div', 'zp-row2');
      var fPhone = field('Phone');
      var inPhone = el(doc, 'input', 'zp-input');
      inPhone.type = 'tel'; inPhone.setAttribute('placeholder', '+30 210 000 0000'); inPhone.value = d.phone;
      fPhone.appendChild(inPhone);
      var fEmail = field('Email');
      var inEmail = el(doc, 'input', 'zp-input');
      inEmail.type = 'email'; inEmail.setAttribute('placeholder', 'hello@business.gr'); inEmail.value = d.email;
      fEmail.appendChild(inEmail);
      rowCE.appendChild(fPhone); rowCE.appendChild(fEmail);
      form.appendChild(rowCE);

      // website + hours
      var rowWH = el(doc, 'div', 'zp-row2');
      var fWeb = field('Website');
      var inWeb = el(doc, 'input', 'zp-input');
      inWeb.type = 'url'; inWeb.setAttribute('placeholder', 'https://…'); inWeb.value = d.website;
      fWeb.appendChild(inWeb);
      var fHours = field('Hours');
      var inHours = el(doc, 'input', 'zp-input');
      inHours.type = 'text'; inHours.setAttribute('placeholder', 'Mon–Fri 9–5, Sat 10–2'); inHours.value = d.hours;
      fHours.appendChild(inHours);
      rowWH.appendChild(fWeb); rowWH.appendChild(fHours);
      form.appendChild(rowWH);

      // price + photo
      var rowPP = el(doc, 'div', 'zp-row2');
      var fPrice = field('Price range');
      var selPrice = el(doc, 'select', 'zp-select');
      PRICE_OPTS.forEach(function (o) {
        var opt = el(doc, 'option', null, esc(o.label));
        opt.value = o.v;
        if (o.v === d.price_range) opt.selected = true;
        selPrice.appendChild(opt);
      });
      fPrice.appendChild(selPrice);
      var fPhoto = field('Photo URL');
      var inPhoto = el(doc, 'input', 'zp-input');
      inPhoto.type = 'url'; inPhoto.setAttribute('placeholder', 'https://…/photo.jpg'); inPhoto.value = d.photo_url;
      fPhoto.appendChild(inPhoto);
      rowPP.appendChild(fPrice); rowPP.appendChild(fPhoto);
      form.appendChild(rowPP);

      // social rows
      var fSocial = field('Social links');
      var socialBox = el(doc, 'div', 'zp-social');
      fSocial.appendChild(socialBox);
      var addBtn = el(doc, 'button', 'zp-btn ghost zp-addrow', IC.plus + ' Add link');
      addBtn.type = 'button';
      addBtn.addEventListener('click', function () {
        d.social.push({ platform: 'website', url: '' });
        renderSocialRows();
        sync();
      });
      fSocial.appendChild(addBtn);
      form.appendChild(fSocial);

      function renderSocialRows() {
        socialBox.innerHTML = '';
        if (!d.social.length) {
          var empty = el(doc, 'p', 'zp-note', 'No social links yet — add Instagram, Facebook, your website and more.');
          socialBox.appendChild(empty);
          return;
        }
        d.social.forEach(function (row, idx) {
          var r = el(doc, 'div', 'zp-srow');
          var sel = el(doc, 'select', 'zp-select');
          SOCIAL_PLATFORMS.forEach(function (p) {
            var opt = el(doc, 'option', null, esc(p.name));
            opt.value = p.key;
            if (p.key === normPlatform(row.platform)) opt.selected = true;
            sel.appendChild(opt);
          });
          sel.addEventListener('change', function () { row.platform = sel.value; sync(); });
          var inp = el(doc, 'input', 'zp-input');
          inp.type = 'url';
          inp.setAttribute('placeholder', 'https://…');
          inp.value = row.url;
          inp.addEventListener('input', function () { row.url = inp.value; sync(); });
          var rm = el(doc, 'button', 'zp-srm', IC.trash);
          rm.type = 'button';
          rm.setAttribute('aria-label', 'Remove link');
          rm.addEventListener('click', function () {
            d.social.splice(idx, 1);
            renderSocialRows();
            sync();
          });
          r.appendChild(sel); r.appendChild(inp); r.appendChild(rm);
          socialBox.appendChild(r);
        });
      }
      renderSocialRows();

      /* ---- the part of the page only this kind of business has ----
         A parish needs services and a patronal feast; a taverna needs a menu and
         reservations; a practice needs its regulator. api/_verticals.js has
         rendered all of that from listings.profile for a while and nothing could
         write it, so a claimed listing still showed a name and a city. This is
         that form. It fills itself in from whatever the enrichment worker read
         off the owner's own website, and nothing it suggests is saved as the
         owner's word until they accept it. */
      var vwrap = el(doc, 'div', 'zp-card');
      var vslot = el(doc, 'div');
      vwrap.appendChild(vslot);
      form.appendChild(vwrap);
      mountVertical(vslot);

      // footer: save
      var foot = el(doc, 'div', 'zp-formfoot');
      var savedNote = el(doc, 'span', 'zp-note', 'Saved changes update your public page.');
      var saveBtn = el(doc, 'button', 'zp-btn primary',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg> Save page');
      saveBtn.type = 'submit';
      foot.appendChild(savedNote);
      foot.appendChild(saveBtn);
      form.appendChild(foot);

      /* ===== PREVIEW CARD ===== */
      var pvCol = el(doc, 'div', 'zp-pv');
      var pvCard = el(doc, 'div', 'zp-card');
      pvCard.appendChild(el(doc, 'p', 'zp-pvlabel', 'Live preview'));
      var pvShell = el(doc, 'div', 'zp-pv-shell');
      pvCard.appendChild(pvShell);
      var pvHint = el(doc, 'p', 'zp-note');
      pvHint.style.marginTop = '10px';
      pvHint.textContent = 'This is how your listing appears to the public.';
      pvCard.appendChild(pvHint);
      pvCol.appendChild(pvCard);

      function renderPreview() {
        pvShell.innerHTML = '';
        // photo
        var photo = el(doc, 'div', 'zp-pv-photo');
        var purl = firstStr(d.photo_url);
        if (purl) {
          photo.style.backgroundImage = 'url("' + purl.replace(/"/g, '%22') + '")';
          photo.textContent = '';
        } else {
          photo.textContent = 'No photo yet';
        }
        pvShell.appendChild(photo);

        var body = el(doc, 'div', 'zp-pv-body');

        // name + verified badge (badge ONLY if backend says verified)
        var nameHtml = '<h4 class="zp-pv-name">' + esc(s.name || 'Your business');
        if (s.verified) {
          nameHtml += '<span class="zp-verify">' + IC.check + ' Verified</span>';
        }
        nameHtml += '</h4>';
        body.innerHTML = nameHtml;
        if (s.category) body.appendChild(el(doc, 'p', 'zp-pv-cat', esc(s.category)));

        // meta chips: price
        var meta = el(doc, 'div', 'zp-pv-meta');
        var hasMeta = false;
        if (firstStr(d.price_range)) {
          meta.appendChild(el(doc, 'span', 'zp-chip price', '<b>' + esc(d.price_range) + '</b>'));
          hasMeta = true;
        }
        if (firstStr(d.hours)) {
          meta.appendChild(el(doc, 'span', 'zp-chip', IC.clock + '<span style="overflow:hidden;text-overflow:ellipsis">' + esc(d.hours) + '</span>'));
          hasMeta = true;
        }
        if (hasMeta) body.appendChild(meta);

        // description
        if (firstStr(d.description)) {
          body.appendChild(el(doc, 'p', 'zp-pv-desc', esc(d.description)));
        } else {
          body.appendChild(el(doc, 'p', 'zp-pv-desc muted', 'Add a description to tell customers about your business.'));
        }

        // contact lines
        var contactLines = [];
        if (firstStr(d.phone)) {
          var ph = firstStr(d.phone);
          contactLines.push('<div class="zp-pv-line">' + IC.phone +
            '<a href="tel:' + esc(ph.replace(/[^+\d]/g, '')) + '">' + esc(ph) + '</a></div>');
        }
        if (firstStr(d.email)) {
          var em = firstStr(d.email);
          contactLines.push('<div class="zp-pv-line">' + IC.mail +
            '<a href="mailto:' + esc(em) + '">' + esc(em) + '</a></div>');
        }
        if (firstStr(d.website)) {
          var wsite = firstStr(d.website);
          var href = /^https?:\/\//i.test(wsite) ? wsite : ('https://' + wsite);
          contactLines.push('<div class="zp-pv-line">' + IC.globe +
            '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(wsite.replace(/^https?:\/\//i, '')) + '</a></div>');
        }
        if (contactLines.length) {
          var contact = el(doc, 'div', 'zp-pv-contact', contactLines.join(''));
          body.appendChild(contact);
        }

        // social pills
        var socialObj = assembleSocial(d.social);
        var socialKeys = Object.keys(socialObj);
        if (socialKeys.length) {
          var soc = el(doc, 'div', 'zp-pv-social');
          socialKeys.forEach(function (k) {
            var url = socialObj[k];
            var href2 = /^https?:\/\//i.test(url) ? url : ('https://' + url);
            var a = el(doc, 'a', null, esc(SOCIAL_NAME[k] || k));
            a.setAttribute('href', href2);
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener');
            soc.appendChild(a);
          });
          body.appendChild(soc);
        }

        pvShell.appendChild(body);
      }

      // sync: pull DOM -> draft, refresh meter + preview
      function sync() {
        d.description = taDesc.value;
        d.phone = inPhone.value;
        d.email = inEmail.value;
        d.website = inWeb.value;
        d.hours = inHours.value;
        d.price_range = selPrice.value;
        d.photo_url = inPhoto.value;
        // social rows already write into d.social directly
        var c = completeness(d);
        meterFill.style.width = c.pct + '%';
        meterPct.textContent = c.pct + '%';
        renderPreview();
      }

      [taDesc, inPhone, inEmail, inWeb, inHours, inPhoto].forEach(function (n) {
        n.addEventListener('input', sync);
      });
      selPrice.addEventListener('change', sync);

      // submit
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (state.saving) return;
        doSave(saveBtn, savedNote, sync);
      });

      grid.appendChild(form);
      grid.appendChild(pvCol);
      wrap.appendChild(grid);

      // initial paint
      sync();
    }

    /* ---- save ---- */
    function doSave(saveBtn, savedNote, sync) {
      var s = state.status;
      var d = state.draft;
      state.saving = true;
      saveBtn.setAttribute('disabled', 'disabled');
      saveBtn.innerHTML = '<span class="zp-spin"></span> Saving…';
      savedNote.textContent = 'Saving your changes…';

      var params = {
        p_workspace: ws,
        p_listing: s.listingId,
        p_description: firstStr(d.description) || null,
        p_phone: firstStr(d.phone) || null,
        p_email: firstStr(d.email) || null,
        p_website: firstStr(d.website) || null,
        p_hours: firstStr(d.hours) || null,
        p_price_range: firstStr(d.price_range) || null,
        p_photo_url: firstStr(d.photo_url) || null,
        p_social: assembleSocial(d.social)
      };

      rpcWrite('bizpage_save', params).then(async function (res) {
        var ok = res == null ? true : (res.ok !== false);

        /* The vertical profile goes through its own writer, because owner-typed
           detail and machine-read detail are stored separately on purpose. A
           failure here must not make the basics look like they failed. */
        var profileNote = '';
        if (ok && state.vform && state.status && state.status.listingId) {
          try {
            var prof = state.vform.read();
            if (Object.keys(prof).length) {
              await rpcWrite('bizpage_save_profile', {
                p_workspace: ctx.ws, p_listing: state.status.listingId, p_profile: prof });
              profileNote = ' Your ' + (state.vkind || 'details') + ' were saved too.';
            }
          } catch (e) {
            profileNote = ' The basics saved, but your detailed fields did not — '
              + ((e && e.message) || 'please try again') + '.';
          }
        }

        state.saving = false;
        finishSave(saveBtn, savedNote);
        if (ok) {
          toast('Business page saved.' + (profileNote ? profileNote : ''));
          savedNote.textContent = 'Saved · your public page is up to date.' + profileNote;
        } else {
          toast('Save did not complete.');
          savedNote.textContent = 'Save did not complete — please try again.';
        }
      }, function (err) {
        state.saving = false;
        finishSave(saveBtn, savedNote);
        var msg = (err && err.message) || 'Could not save.';
        toast('Save failed: ' + msg);
        savedNote.textContent = 'Save failed — ' + msg;
      });
    }
    function finishSave(saveBtn, savedNote) {
      saveBtn.removeAttribute('disabled');
      saveBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg> Save page';
    }

    /* ---- controller ---- */
    async function boot() {
      state.loading = true;
      state.error = null;
      renderLoading();

      var statusRaw;
      try {
        statusRaw = await rpcRead('bizpage_status', { p_workspace: ws });
      } catch (e) {
        state.loading = false;
        renderError((e && e.message) || 'Could not check your business listing.');
        return;
      }

      var status = normStatus(statusRaw);
      state.status = status;

      if (!status.claimed) {
        // No claimed, editable listing -> honest claim-first state.
        state.loading = false;
        renderClaimFirst();
        return;
      }

      // Has a claimed listing -> load its current content.
      var contentRaw = null;
      try {
        contentRaw = await rpcRead('bizpage_get', { p_workspace: ws, p_listing: status.listingId });
      } catch (e2) {
        // Content load failed, but the claim is real — let them start from blank
        // rather than blanking the whole module. Surface a gentle note.
        contentRaw = null;
      }
      state.draft = normContent(contentRaw);
      state.loading = false;
      renderEditor();
    }

    await boot();
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'bizpage',
    label: 'Business page',
    order: 70,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>',
    mount: mountBizPage
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

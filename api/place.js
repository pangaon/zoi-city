/**
 * api/place.js — server-rendered place and category hubs.
 *
 * WHY THIS EXISTS
 * /explore ships zero listing links in its server HTML: to a crawler the
 * directory is a blank page. And there was no page for "Greek bakeries in North
 * Carolina", which is the shape of thing people actually search. The result was
 * 8,787 listing pages that only the sitemap knew about — orphans with no internal
 * links pointing at them, which is close to the worst position a directory can be
 * in.
 *
 * These hubs are the missing link layer: country -> region -> city -> category,
 * every level a real page with real listings, breadcrumbs, and links both down to
 * its children and sideways to its siblings.
 *
 * Routes (see vercel.json):
 *   /in/:country
 *   /in/:country/:region
 *   /in/:country/:region/:city
 *   /c/:category
 *   /c/:category/in/:country
 *   /c/:category/in/:country/:region
 *   /c/:category/in/:country/:region/:city
 *
 * Everything rendered here comes from the database. There is no placeholder
 * copy, no invented count, and a hub with nothing in it 404s rather than
 * publishing an empty page for a crawler to index.
 */

const BASE = 'https://csebihpaychdkanjjsmz.supabase.co';
const KEY = 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
const SITE = 'https://www.zoi.city';
const PER = 60;

async function rpc(fn, args) {
  const r = await fetch(BASE + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  if (!r.ok) throw new Error(fn + ': ' + r.status);
  return r.json();
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const attr = esc;
const n = (x) => Number(x || 0).toLocaleString('en');

/** Slug <-> display. Kept reversible so a URL round-trips to the same query. */
function slug(s) {
  return String(s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // drop accents for the URL only
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const typeSlug = (t) => (t === 'travel_place' ? 'travel-place' : t);

/* ---------- the page ---------- */

function shell(o) {
  const nav = ['/explore:Directory', '/community:Community', '/social:Business',
    '/tickets:Tickets', '/#marketplace:Marketplace']
    .map((x) => { const i = x.indexOf(':'); const h = x.slice(0, i), l = x.slice(i + 1);
      return '<a href="' + h + '"' + (h === '/explore' ? ' aria-current="page"' : '') + '>' + l + '</a>'; })
    .join('');
  return '<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + esc(o.title) + '</title>'
    + '<meta name="description" content="' + attr(o.desc) + '">'
    + '<link rel="canonical" href="' + attr(SITE + o.path) + '">'
    + (o.prev ? '<link rel="prev" href="' + attr(SITE + o.prev) + '">' : '')
    + (o.next ? '<link rel="next" href="' + attr(SITE + o.next) + '">' : '')
    + '<meta property="og:type" content="website">'
    + '<meta property="og:title" content="' + attr(o.title) + '">'
    + '<meta property="og:description" content="' + attr(o.desc) + '">'
    + '<meta property="og:url" content="' + attr(SITE + o.path) + '">'
    + '<meta name="theme-color" content="#060b14">'
    + '<link rel="manifest" href="/manifest.webmanifest">'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">'
    + '<link rel="stylesheet" href="/assets/zoi-theme.css">'
    + '<script>(function(){try{document.documentElement.setAttribute("data-theme",localStorage.getItem("zoi_theme")||"dark")}catch(e){}})()</script>'
    + '<style>' + CSS + '</style>'
    + (o.jsonld ? '<script type="application/ld+json">' + JSON.stringify(o.jsonld).replace(/</g, '\\u003c') + '</script>' : '')
    + '</head><body>'
    + '<header class="zoi-header"><div class="wrap zoi-bar">'
    + '<a class="zoi-brand" href="/" aria-label="Zoi home"><span class="zoi-seal">&#918;</span><b>Zoi</b></a>'
    + '<nav class="zoi-nav" aria-label="Zoi">' + nav + '</nav>'
    + '<form class="zoi-search" role="search" action="/explore" method="get">'
    + '<input type="search" name="q" placeholder="Search the Greek world&hellip;" aria-label="Search"><button type="submit">Search</button></form>'
    + '<div class="zoi-actions"><a class="btn btn-primary" href="/social">Start free</a></div>'
    + '</div></header>'
    + '<main class="wrap ph">' + o.body + '</main>'
    + '<footer class="ph-foot"><div class="wrap">'
    + '<p>' + n(o.totalSite || 0) + ' Greek places across ' + n(o.countries || 0) + ' countries. '
    + '<a href="/explore">Search the whole directory</a> &middot; <a href="/explore/map">See it on the map</a></p>'
    + '</div></footer>'
    + '<script src="/assets/zoi-theme.js"></script></body></html>';
}

const CSS = [
  '.ph{padding:clamp(22px,4vw,44px) 0 clamp(40px,6vw,70px)}',
  '.ph-crumb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;color:var(--mut);margin-bottom:16px}',
  '.ph-crumb a{color:var(--mut);text-decoration:none}.ph-crumb a:hover{color:var(--tx);text-decoration:underline}',
  '.ph-crumb i{font-style:normal;opacity:.5}',
  '.ph h1{font-family:"Fraunces",serif;font-size:clamp(28px,4.4vw,46px);font-weight:600;letter-spacing:-.025em;line-height:1.06;margin:0 0 10px}',
  '.ph-lede{font-size:15.5px;color:var(--mut);line-height:1.6;max-width:62ch;margin:0 0 22px}',
  '.ph-sec{margin:30px 0 0}',
  '.ph-sec h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);font-weight:700;margin:0 0 12px}',
  '.ph-chips{display:flex;flex-wrap:wrap;gap:7px}',
  '.ph-chips a{display:inline-flex;align-items:baseline;gap:6px;padding:6px 12px;border-radius:999px;',
  'border:1px solid var(--line);background:var(--card2);color:var(--mut);font-size:13px;font-weight:600;text-decoration:none;transition:.16s var(--ease)}',
  '.ph-chips a:hover{color:var(--tx);border-color:var(--line2);transform:translateY(-1px)}',
  '.ph-chips b{font-weight:500;font-size:11.5px;opacity:.7;font-variant-numeric:tabular-nums}',
  '.ph-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));margin:14px 0 0}',
  '.ph-card{display:flex;gap:12px;padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--card);',
  'text-decoration:none;color:inherit;transition:.18s var(--ease)}',
  '.ph-card:hover{border-color:var(--line2);transform:translateY(-2px);box-shadow:var(--shadow)}',
  '.ph-card img,.ph-card .ph-mono{width:52px;height:52px;flex:none;border-radius:11px;object-fit:cover;background:var(--card2)}',
  '.ph-mono{display:grid;place-items:center;font-family:"Fraunces",serif;font-weight:700;font-size:19px;color:var(--bg);background:var(--gold)}',
  '.ph-card .m{min-width:0;flex:1}',
  '.ph-card .nm{display:block;font-weight:650;font-size:14.5px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.ph-card .ct{display:block;font-size:12px;color:var(--mut);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.ph-card .ds{display:block;font-size:12px;color:var(--dim);margin-top:5px;line-height:1.45;',
  'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
  '.ph-page{display:flex;gap:10px;align-items:center;justify-content:center;margin:30px 0 0;font-size:13.5px}',
  '.ph-page a{padding:9px 16px;border:1px solid var(--line);border-radius:999px;color:var(--tx);text-decoration:none}',
  '.ph-page a:hover{border-color:var(--line2)}',
  '.ph-page span{color:var(--dim)}',
  '.ph-foot{border-top:1px solid var(--line);padding:22px 0;font-size:13px;color:var(--mut)}',
  '.ph-foot a{color:var(--acc)}',
  '.ph-empty{padding:28px 0;color:var(--mut)}',
].join('');

function card(l) {
  const href = '/' + typeSlug(l.entity_type || 'business') + '/' + encodeURIComponent(l.slug);
  const where = [l.city, l.region].filter(Boolean).join(', ');
  const initial = (l.name || '?').trim().charAt(0).toUpperCase();
  const media = (l.photo && /^https:\/\//.test(l.photo))
    ? '<img src="' + attr(l.photo) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
    : '<span class="ph-mono" aria-hidden="true">' + esc(initial) + '</span>';
  return '<a class="ph-card" href="' + attr(href) + '">' + media
    + '<span class="m"><span class="nm">' + esc(l.name) + '</span>'
    + '<span class="ct">' + esc([l.category, where].filter(Boolean).join(' &middot; ').replace(/&amp;middot;/g, '·')) + '</span>'
    + (l.description ? '<span class="ds">' + esc(l.description) + '</span>' : '')
    + '</span></a>';
}

function chips(items) {
  return '<div class="ph-chips">' + items.map((i) =>
    '<a href="' + attr(i.href) + '">' + esc(i.label) + ' <b>' + n(i.count) + '</b></a>').join('') + '</div>';
}

export default async function handler(req, res) {
  const send = (code, html, cache) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (code === 404) res.setHeader('X-Robots-Tag', 'noindex');
    else res.setHeader('Cache-Control', cache || 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.end(html);
  };
  const notFound = (what) => send(404,
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found &mdash; Zoi</title>'
    + '<link rel="stylesheet" href="/assets/zoi-theme.css"></head><body><main class="wrap" style="padding:70px 0">'
    + '<h1>Nothing here yet</h1><p class="muted">' + esc(what || 'That place has no listings on Zoi.') + '</p>'
    + '<p><a href="/explore">Search the directory</a></p></main></body></html>');

  try {
    const url = new URL(req.url, SITE);
    const q = url.searchParams;
    const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);

    // Route params come from vercel.json rewrites.
    const wantCountry = q.get('country') || '';
    const wantRegion = q.get('region') || '';
    const wantCity = q.get('city') || '';
    const wantCat = q.get('category') || '';

    // Resolve slugs back to the real values by matching against the database,
    // so a URL never has to be a guess about capitalisation or accents.
    const countries = await rpc('explore_countries', {});
    const site = countries.reduce((a, c) => a + Number(c.listings || 0), 0);

    let country = '';
    if (wantCountry) {
      const hit = countries.find((c) => slug(c.country) === wantCountry);
      if (!hit) return notFound('We have no listings in that country yet.');
      country = hit.country;
    }

    let region = '', regionRow = null;
    if (wantRegion) {
      const regions = await rpc('explore_regions', { p_country: country || null });
      regionRow = regions.find((r) => slug(r.region) === wantRegion);
      if (!regionRow) return notFound('We have no listings in that region yet.');
      region = regionRow.region;
    }

    let city = '';
    if (wantCity) {
      const cities = await rpc('explore_cities', { p_country: country || null, p_region: region || null });
      const hit = cities.find((c) => slug(c.city) === wantCity);
      if (!hit) return notFound('We have no listings in that city yet.');
      city = hit.city;
    }

    let cat = '', catLabel = '';
    if (wantCat) {
      const cats = await rpc('explore_categories', {
        p_country: country || null, p_region: region || null, p_city: city || null });
      const hit = cats.find((c) => c.category_slug === wantCat);
      if (!hit) return notFound('Nothing in that category here yet.');
      cat = hit.category_slug; catLabel = hit.label;
    }

    const data = await rpc('explore_place_listings', {
      p_country: country || null, p_region: region || null, p_city: city || null,
      p_category: cat || null, p_limit: PER, p_offset: (page - 1) * PER });
    const rows = data.rows || [];
    const total = Number(data.total || 0);
    if (!total) return notFound();

    /* ---- names and copy, from real values only ---- */
    const hasPlace = !!(city || region || country);
    const placeName = city || region || country || 'the Greek world';
    // Headings read as English rather than as a template: "Greek North Carolina"
    // and "Greek the Greek world" were both coming out of one naive concatenation.
    const heading = catLabel
      ? (hasPlace ? catLabel + ' in ' + placeName : 'Greek ' + catLabel.toLowerCase() + ', worldwide')
      : (hasPlace ? 'Greek life in ' + placeName : 'The Greek world');
    const title = heading + ' — ' + n(total) + ' on Zoi';
    const lede = catLabel
      ? n(total) + ' Greek ' + catLabel.toLowerCase()
        + (hasPlace ? ' in ' + placeName : ' across ' + countries.length + ' countries') + ', verified and searchable on Zoi.'
      : n(total) + ' Greek businesses, parishes, schools, associations and places'
        + (hasPlace ? ' in ' + placeName : ' across ' + countries.length + ' countries') + '.';

    /* ---- breadcrumb ---- */
    const crumbs = [{ name: 'Directory', item: '/explore' }];
    if (country) crumbs.push({ name: country, item: '/in/' + slug(country) });
    if (region) crumbs.push({ name: region, item: '/in/' + slug(country) + '/' + slug(region) });
    if (city) crumbs.push({ name: city, item: '/in/' + slug(country) + '/' + slug(region) + '/' + slug(city) });
    if (catLabel) crumbs.push({ name: catLabel, item: url.pathname });

    let body = '<nav class="ph-crumb" aria-label="Breadcrumb">'
      + crumbs.map((c, i) => (i ? '<i>/</i>' : '')
        + (i === crumbs.length - 1 ? '<span>' + esc(c.name) + '</span>'
          : '<a href="' + attr(c.item) + '">' + esc(c.name) + '</a>')).join('')
      + '</nav>'
      + '<h1>' + esc(heading) + '</h1>'
      + '<p class="ph-lede">' + esc(lede) + '</p>';

    /* ---- the listings ---- */
    body += '<div class="ph-grid">' + rows.map(card).join('') + '</div>';

    const pages = Math.ceil(total / PER);
    const base = url.pathname;
    let prev = null, next = null;
    if (pages > 1) {
      if (page > 1) prev = base + (page - 1 > 1 ? '?page=' + (page - 1) : '');
      if (page < pages) next = base + '?page=' + (page + 1);
      body += '<div class="ph-page">'
        + (prev ? '<a href="' + attr(prev) + '" rel="prev">&larr; Previous</a>' : '')
        + '<span>Page ' + page + ' of ' + pages + '</span>'
        + (next ? '<a href="' + attr(next) + '" rel="next">Next &rarr;</a>' : '')
        + '</div>';
    }

    /* ---- the link graph: down to children, sideways to siblings ---- */
    if (!cat) {
      const cats = await rpc('explore_categories', {
        p_country: country || null, p_region: region || null, p_city: city || null });
      if (cats.length > 1) {
        const prefix = '/c/'; const place = country
          ? '/in/' + slug(country) + (region ? '/' + slug(region) : '') + (city ? '/' + slug(city) : '')
          : '';
        body += '<section class="ph-sec"><h2>By category' + (placeName !== 'the Greek world' ? ' in ' + esc(placeName) : '') + '</h2>'
          + chips(cats.slice(0, 40).map((c) => ({
            label: c.label, count: c.listings, href: prefix + c.category_slug + place })))
          + '</section>';
      }
    }
    if (country && region && !city) {
      const cities = await rpc('explore_cities', { p_country: country, p_region: region });
      if (cities.length > 1) {
        body += '<section class="ph-sec"><h2>Cities in ' + esc(region) + '</h2>'
          + chips(cities.slice(0, 60).map((c) => ({
            label: c.city, count: c.listings,
            href: '/in/' + slug(country) + '/' + slug(region) + '/' + slug(c.city) })))
          + '</section>';
      }
    }
    if (country && !region) {
      const regions = await rpc('explore_regions', { p_country: country });
      if (regions.length) {
        body += '<section class="ph-sec"><h2>Regions of ' + esc(country) + '</h2>'
          + chips(regions.slice(0, 60).map((r) => ({
            label: r.region, count: r.listings,
            href: '/in/' + slug(country) + '/' + slug(r.region) })))
          + '</section>';
      }
    }
    if (!country) {
      body += '<section class="ph-sec"><h2>Countries</h2>'
        + chips(countries.map((c) => ({
          label: c.country, count: c.listings, href: '/in/' + slug(c.country) })))
        + '</section>';
    }
    // Sideways: the same category elsewhere, which is how a crawler finds the
    // rest of the set rather than one leaf.
    if (cat && (region || country)) {
      const scope = region ? { p_country: country } : {};
      const siblings = region
        ? (await rpc('explore_regions', scope)).slice(0, 30)
            .filter((r) => r.region !== region)
            .map((r) => ({ label: catLabel + ' in ' + r.region, count: r.listings,
              href: '/c/' + cat + '/in/' + slug(country) + '/' + slug(r.region) }))
        : countries.slice(0, 20).filter((c) => c.country !== country)
            .map((c) => ({ label: catLabel + ' in ' + c.country, count: c.listings,
              href: '/c/' + cat + '/in/' + slug(c.country) }));
      if (siblings.length) {
        body += '<section class="ph-sec"><h2>' + esc(catLabel) + ' elsewhere</h2>'
          + chips(siblings.slice(0, 24)) + '</section>';
      }
    }

    const jsonld = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description: lede,
      url: SITE + url.pathname,
      isPartOf: { '@type': 'WebSite', name: 'Zoi', url: SITE },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.item })),
      },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: total,
        itemListElement: rows.slice(0, 20).map((l, i) => ({
          '@type': 'ListItem', position: (page - 1) * PER + i + 1,
          url: SITE + '/' + typeSlug(l.entity_type || 'business') + '/' + encodeURIComponent(l.slug),
          name: l.name })),
      },
    };

    return send(200, shell({
      title, desc: lede, path: url.pathname + (page > 1 ? '?page=' + page : ''),
      prev, next, body, jsonld, totalSite: site, countries: countries.length }));
  } catch (e) {
    return send(500, '<!doctype html><title>Zoi</title><h1>Something went wrong</h1>'
      + '<p><a href="/explore">Back to the directory</a></p>');
  }
}

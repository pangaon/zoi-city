import {publicCountryRead} from './_public-country-read.js';
// Dynamic sitemap of every indexable Zoi entity page (plus the home).
const SUPA = 'https://csebihpaychdkanjjsmz.supabase.co';
const KEY  = 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
const SITE = 'https://www.zoi.city';

async function rpc(fn, body) {
  const r = await fetch(SUPA + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!r.ok) throw new Error('rpc ' + fn + ' ' + r.status);
  return r.json();
}
function xesc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c];});}
function iso(d){ if(!d)return null; try{ return new Date(d).toISOString().slice(0,10); }catch(e){ return null; } }

// ESM: package.json sets "type":"module", so a CommonJS export leaves this
// function with no handler at all — which is what made every listing page 500.
/* ── sitemap index + parts ───────────────────────────────────────────────────
 * A single sitemap had to do three jobs at once and was capped to stay inside
 * the request timeout: 6 countries x 8 regions, which listed 585 hubs when 519
 * region-by-category pages alone exist. Splitting it lets each part be complete
 * and fast, and gives search engines a smaller thing to re-fetch when only one
 * kind of page has changed.
 *
 *   /sitemap.xml            the index
 *   /sitemap-core.xml       the handful of pages that are not generated
 *   /sitemap-listings-N.xml  bounded pages of published organizations
 *   /sitemap-places.xml     every place and category hub
 */
const PAGE = 1000;

function url(loc, freq, pri, lastmod) {
  return '<url><loc>' + xesc(loc) + '</loc>'
    + (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '')
    + '<changefreq>' + freq + '</changefreq><priority>' + pri + '</priority></url>\n';
}
function hubSlug(v) {
  return String(v == null ? '' : v).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default async function handler(req, res) {
  const send = (xml) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.end(xml);
  };
  try {
    const u = new URL(req.url, SITE);
    const part = (u.searchParams.get('part') || 'index').toLowerCase();

    /* ---- the index ---- */
    if (part === 'index') {
      const stats = await rpc('seo_sitemap_stats', {});
      if (!stats || !Number.isSafeInteger(stats.count) || stats.count < 0 || stats.count > 10000000) throw new Error('invalid sitemap statistics');
      let x = '<?xml version="1.0" encoding="UTF-8"?>\n'
            + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (const p of ['core', 'places']) {
        x += '<sitemap><loc>' + SITE + '/sitemap-' + p + '.xml</loc></sitemap>\n';
      }
      for (let page = 1; page <= Math.ceil(stats.count / PAGE); page++) {
        x += '<sitemap><loc>' + SITE + '/sitemap-listings-' + page + '.xml</loc></sitemap>\n';
      }
      x += '</sitemapindex>\n';
      return send(x);
    }

    let out = '<?xml version="1.0" encoding="UTF-8"?>\n'
            + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    /* ---- core: the pages nothing generates ---- */
    if (part === 'core') {
      out += url(SITE + '/', 'daily', '1.0');
      out += url(SITE + '/explore', 'daily', '0.9');
      out += url(SITE + '/in', 'daily', '0.9');            // the crawlable directory
      out += url(SITE + '/explore/map', 'weekly', '0.8');
      out += url(SITE + '/community', 'daily', '0.8');
      out += url(SITE + '/tickets', 'weekly', '0.7');
      out += url(SITE + '/shop/', 'daily', '0.8');
      out += url(SITE + '/apps/intelligence/', 'weekly', '0.6');
      // Workspace tools (/social) and private noindex trip plans are not public landing pages.
      out += '</urlset>\n';
      return send(out);
    }

    /* ---- listings ---- */
    if (part === 'listings') {
      const rawPage = u.searchParams.get('page') || '1';
      if (!/^[1-9]\d{0,4}$/.test(rawPage) || Number(rawPage)>10000) {
        res.statusCode=400;res.setHeader('Cache-Control','no-store');res.end('invalid sitemap page\n');return;
      }
      const rows = await rpc('seo_index', {p_limit:PAGE,p_offset:(Number(rawPage)-1)*PAGE});
      if (!Array.isArray(rows)) throw new Error('invalid sitemap response');
      const seen = Object.create(null);
      for (const r of rows) {
        if (!r || !r.slug) continue;
        const t = String(r.entity_type || 'business').replace('travel_place', 'travel-place');
        const loc = SITE + '/' + t + '/' + encodeURIComponent(r.slug);
        if (seen[loc]) continue;                    // a duplicate <loc> is a crawl error
        seen[loc] = 1;
        out += url(loc, 'weekly', '0.7', iso(r.updated_at));
      }
      out += '</urlset>\n';
      return send(out);
    }

    /* ---- places and categories ---- */
    if (part === 'places') {
      const [countries, regions, cities, cats, regionCats] = await Promise.all([
        publicCountryRead({endpoint:SUPA+'/rest/v1/rpc/explore_countries',timeoutMs:8000,load:()=>rpc('explore_countries', {})}),
        rpc('explore_regions', {}),
        rpc('explore_region_cities', {}),
        rpc('explore_categories', {}),
        // One query instead of one per region. The N+1 this replaces is what
        // forced the old cap of 6 countries x 8 regions.
        rpc('explore_region_categories', { p_min: 3 }),
      ]);
      if (![countries,regions,cities,cats,regionCats].every(Array.isArray)) throw new Error('invalid places sitemap response');
      const seen = Object.create(null);
      const add = (path, pri) => {
        const loc = SITE + path;
        if (seen[loc]) return;
        seen[loc] = 1;
        out += url(loc, 'weekly', pri);
      };
      (countries || []).forEach((c) => c.country && add('/in/' + hubSlug(c.country), '0.8'));
      (regions || []).forEach((r) => {
        if (!r.region || !r.country || Number(r.listings) < 3) return;
        add('/in/' + hubSlug(r.country) + '/' + hubSlug(r.region), '0.7');
      });
      (cities || []).forEach((c) => {
        // A one-listing city page is a thin page; do not spend crawl budget on it.
        if (!c.city || !c.region || !c.country || Number(c.listings) < 3) return;
        add('/in/' + hubSlug(c.country) + '/' + hubSlug(c.region) + '/' + hubSlug(c.city), '0.6');
      });
      (cats || []).forEach((c) => {
        if (!c.category_slug || Number(c.listings) < 3) return;
        add('/c/' + c.category_slug, '0.7');
      });
      (regionCats || []).forEach((rc) => {
        if (!rc.category_slug || !rc.region || !rc.country) return;
        add('/c/' + rc.category_slug + '/in/' + hubSlug(rc.country) + '/' + hubSlug(rc.region), '0.6');
      });
      out += '</urlset>\n';
      return send(out);
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('unknown sitemap part\n');
  } catch (e) {
    // Never replace a valid index with an empty or partial success on outage.
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    res.end('Sitemap temporarily unavailable. Please retry.\n');
  }
}

// Dynamic sitemap of every indexable Zoi entity page (plus the home).
const SUPA = 'https://csebihpaychdkanjjsmz.supabase.co';
const KEY  = 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
const SITE = 'https://www.zoi.city';

async function rpc(fn, body) {
  const r = await fetch(SUPA + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!r.ok) throw new Error('rpc ' + fn + ' ' + r.status);
  return r.json();
}
function xesc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c];});}
function iso(d){ try{ return new Date(d).toISOString().slice(0,10); }catch(e){ return null; } }

// ESM: package.json sets "type":"module", so a CommonJS export leaves this
// function with no handler at all — which is what made every listing page 500.
export default async function handler(req, res) {
  try {
    // seo_index caps at 1000 rows per call regardless of p_limit, so a single
    // request left ~7,000 of the ~8,900 listings out of the sitemap entirely —
    // invisible to search. Page through until a short page comes back.
    // Paged in PARALLEL, in windows. Sequentially this was the dominant cost of
    // the whole function and it grows with the directory: at 20,000 listings the
    // serial version would pass the platform's request timeout and the sitemap
    // would start 504-ing, which fails silently — nothing tells you crawling
    // stopped. Fetch a window at a time, stop at the first short page.
    var PAGE = 1000, MAX_PAGES = 60, WINDOW = 6, rows = [], done = false;
    for (var w = 0; w < MAX_PAGES && !done; w += WINDOW) {
      var offsets = [];
      for (var k = 0; k < WINDOW && (w + k) < MAX_PAGES; k++) offsets.push((w + k) * PAGE);
      var batches = await Promise.all(offsets.map(function (o) {
        return rpc('seo_index', { p_limit: PAGE, p_offset: o })
          .catch(function () { return []; });
      }));
      for (var b = 0; b < batches.length; b++) {
        var batch = batches[b];
        if (!Array.isArray(batch) || batch.length === 0) { done = true; break; }
        rows = rows.concat(batch);
        if (batch.length < PAGE) { done = true; break; }
      }
    }
    var out = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    out += '<url><loc>' + SITE + '/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n';
    out += '<url><loc>' + SITE + '/explore</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n';
    out += '<url><loc>' + SITE + '/explore/map</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n';

    /* The place and category hubs.
     *
     * Without these the sitemap listed 8,787 leaf pages and nothing that links
     * to them — a flat list of orphans. The hubs are the layer that gives the
     * directory a shape a crawler can walk: country -> region -> city, and
     * category within each. They are generated from the same aggregates the
     * pages themselves render, so the sitemap can never advertise a hub that
     * would 404. */
    function hubSlug(v) {
      return String(v == null ? '' : v).toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    var hubs = [];
    try {
      var agg = await Promise.all([
        rpc('explore_countries', {}), rpc('explore_regions', {}), rpc('explore_categories', {})
      ]);
      var countries = agg[0] || [], regions = agg[1] || [], cats = agg[2] || [];
      countries.forEach(function (c) {
        if (!c.country) return;
        hubs.push(['/in/' + hubSlug(c.country), 0.8]);
      });
      regions.forEach(function (r) {
        // A hub with one listing is a thin page; leave it out of the sitemap
        // rather than ask a crawler to spend budget on it.
        if (!r.region || !r.country || Number(r.listings) < 3) return;
        hubs.push(['/in/' + hubSlug(r.country) + '/' + hubSlug(r.region), 0.7]);
      });
      cats.forEach(function (c) {
        if (!c.category_slug || Number(c.listings) < 3) return;
        hubs.push(['/c/' + c.category_slug, 0.7]);
      });
      // The pages that actually match a search: category within a region.
      var byCountry = {};
      regions.forEach(function (r) {
        if (!r.country || !r.region || Number(r.listings) < 25) return;
        (byCountry[r.country] = byCountry[r.country] || []).push(r);
      });
      // Bounded on purpose. This expansion is one RPC per region, and the whole
      // function has to finish inside the platform's request timeout — an
      // unbounded loop here is how a sitemap starts 504-ing and silently stops
      // being crawled at all. Top 6 countries, top 8 regions each, and the cap
      // is logged in the XML so a truncation is never invisible.
      // Bounded AND parallel. This expansion is one RPC per region; doing them
      // sequentially took six seconds on its own, which is most of the way to
      // the platform's request timeout — and a sitemap that starts timing out
      // silently stops being crawled. Top 6 countries, top 8 regions each,
      // fetched together.
      var topCountries = Object.keys(byCountry)
        .sort(function (a, b) { return byCountry[b].length - byCountry[a].length; })
        .slice(0, 6);
      var jobs = [];
      topCountries.forEach(function (cn) {
        byCountry[cn].slice(0, 8).forEach(function (rr) {
          jobs.push(rpc('explore_categories', { p_country: cn, p_region: rr.region })
            .then(function (rcats) { return { cn: cn, region: rr.region, cats: rcats || [] }; })
            .catch(function () { return { cn: cn, region: rr.region, cats: [] }; }));
        });
      });
      var results = await Promise.all(jobs);
      results.forEach(function (g) {
        g.cats.forEach(function (rc) {
          if (Number(rc.listings) < 3) return;
          hubs.push(['/c/' + rc.category_slug + '/in/' + hubSlug(g.cn) + '/' + hubSlug(g.region), 0.6]);
        });
      });
    } catch (e) { /* a hub failure must not cost us the listing sitemap */ }
    out += '<!-- ' + hubs.length + ' hub urls; category-by-region expansion is capped at '
         + '6 countries x 8 regions to stay inside the function timeout -->\n';
    var hubSeen = Object.create(null);   // hubs dedupe among themselves; the
                                        // listing loop below has its own map
    for (var h = 0; h < hubs.length; h++) {
      var hl = SITE + hubs[h][0];
      if (hubSeen[hl]) continue;
      hubSeen[hl] = 1;
      out += '<url><loc>' + xesc(hl) + '</loc><changefreq>weekly</changefreq><priority>'
           + hubs[h][1] + '</priority></url>\n';
    }
    var seen = Object.create(null);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r || !r.slug) continue;
      var key = (r.entity_type || 'p') + '/' + r.slug;
      if (seen[key]) continue;            // a duplicate <loc> is a crawl error
      seen[key] = 1;
      // Must match the canonical the entity page emits (/<type>/<slug>), or the
      // sitemap and the canonical tag disagree and crawl budget is wasted.
      var t = String(r.entity_type || 'p');
      if (t === 'travel_place') t = 'travel-place';   // no underscores in public URLs
      var loc = SITE + '/' + encodeURIComponent(t) + '/' + encodeURIComponent(r.slug);
      var lm = iso(r.updated_at);
      out += '<url><loc>' + xesc(loc) + '</loc>' + (lm ? ('<lastmod>' + lm + '</lastmod>') : '') + '<changefreq>weekly</changefreq><priority>0.7</priority></url>\n';
    }
    out += '</urlset>\n';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    res.end(out);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + SITE + '/</loc></url></urlset>');
  }
}

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
    var PAGE = 1000, MAX_PAGES = 60, rows = [], off = 0;
    for (var pageNo = 0; pageNo < MAX_PAGES; pageNo++) {
      var batch = await rpc('seo_index', { p_limit: PAGE, p_offset: off });
      if (!Array.isArray(batch) || batch.length === 0) break;
      rows = rows.concat(batch);
      if (batch.length < PAGE) break;
      off += PAGE;
    }
    var out = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    out += '<url><loc>' + SITE + '/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n';
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

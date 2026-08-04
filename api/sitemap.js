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

module.exports = async (req, res) => {
  try {
    var rows = await rpc('seo_index', { p_limit: 50000, p_offset: 0 });
    if (!Array.isArray(rows)) rows = [];
    var out = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    out += '<url><loc>' + SITE + '/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!r || !r.slug) continue;
      var loc = SITE + '/p/' + encodeURIComponent(r.slug);
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
};

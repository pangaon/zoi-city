// Server-rendered Zoi entity page: full HTML + schema.org JSON-LD + internal links for search + AI indexing.
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
function esc(s){return (s==null?'':String(s)).replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function attr(s){return esc(s);}
function pretty(slug){return (slug||'').replace(/-/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});}
function schemaType(e){
  var t=e.entity_type, c=e.category_slug||'';
  if(t==='church') return 'Church';
  if(t==='school') return 'School';
  if(t==='event') return 'Event';
  if(t==='organization') return 'Organization';
  if(/restaurant|taverna|meze|ouzo/.test(c)) return 'Restaurant';
  if(/baker/.test(c)) return 'Bakery';
  if(/cafe|coffee/.test(c)) return 'CafeOrCoffeeShop';
  if(/hotel/.test(c)) return 'Hotel';
  return 'LocalBusiness';
}
function socialArr(e){
  var sl=e.social_links||{}, a=[]; if(e.website) a.push(e.website);
  ['instagram','facebook','tiktok','youtube','twitter','linkedin','spotify'].forEach(function(k){ if(sl[k]){ var v=sl[k]; if(/^https?:/.test(v)) a.push(v); } });
  return a;
}
function jsonld(e,url){
  var o={ '@context':'https://schema.org', '@type':schemaType(e), name:e.name, url:url };
  if(e.description) o.description=e.description;
  if(e.address||e.city){
    o.address={ '@type':'PostalAddress' };
    if(e.address) o.address.streetAddress=e.address;
    if(e.city) o.address.addressLocality=e.city;
    if(e.country) o.address.addressCountry=e.country;
  }
  if(e.latitude!=null&&e.longitude!=null) o.geo={ '@type':'GeoCoordinates', latitude:e.latitude, longitude:e.longitude };
  if(e.phone) o.telephone=e.phone;
  if(e.price_range) o.priceRange=e.price_range;
  if(e.rating!=null && e.rating_count!=null && e.rating_count>0) o.aggregateRating={ '@type':'AggregateRating', ratingValue:e.rating, reviewCount:e.rating_count };
  var sa=socialArr(e); if(sa.length) o.sameAs=sa;
  return JSON.stringify(o);
}
function page(e, related){
  var url = SITE + '/p/' + encodeURIComponent(e.canonical_slug || e.slug);
  var title = e.meta_title || (e.name + (e.city ? ' — ' + e.city : '') + ' | Zoi');
  var desc = e.meta_description || e.description || (e.name + (e.city?(' in '+e.city):'') + ' — on Zoi, the Greek world directory.');
  var catLabel = pretty(e.category_slug) || pretty(e.entity_type);
  var mapHref = (e.latitude!=null&&e.longitude!=null)
      ? ('https://www.google.com/maps/search/?api=1&query='+e.latitude+','+e.longitude)
      : (e.address? ('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(e.address)) : null);
  var rows=[];
  if(e.address) rows.push('<div class="row"><span>Address</span><b>'+esc(e.address)+'</b></div>');
  else if(e.city) rows.push('<div class="row"><span>Location</span><b>'+esc(e.city)+(e.country?(', '+esc(e.country)):'')+'</b></div>');
  if(e.place_path) rows.push('<div class="row"><span>Area</span><b>'+esc(e.place_path)+'</b></div>');
  if(e.phone) rows.push('<div class="row"><span>Phone</span><b><a href="tel:'+attr((e.phone+'').replace(/[^0-9+]/g,''))+'">'+esc(e.phone)+'</a></b></div>');
  if(e.website) rows.push('<div class="row"><span>Website</span><b><a href="'+attr(e.website)+'" rel="nofollow noopener" target="_blank">'+esc(e.website.replace(/^https?:\/\//,''))+'</a></b></div>');
  if(e.category_slug) rows.push('<div class="row"><span>Category</span><b>'+esc(catLabel)+'</b></div>');
  // social row
  var sl=e.social_links||{}, socLinks=[];
  [['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],['twitter','X'],['linkedin','LinkedIn']].forEach(function(p){
    var v=sl[p[0]]; if(v){ var href=/^https?:/.test(v)?v:('https://'+p[0]+'.com/'+(''+v).replace(/^@/,'')); socLinks.push('<a href="'+attr(href)+'" rel="nofollow noopener" target="_blank">'+p[1]+'</a>'); }
  });
  if(socLinks.length) rows.push('<div class="row"><span>Social</span><b>'+socLinks.join(' · ')+'</b></div>');
  // related internal links
  var rel='';
  if(related && related.length){
    rel='<h2>Related Greek '+esc(catLabel.toLowerCase())+(e.city?(' near '+esc(e.city)):'')+'</h2><ul class="rel">';
    related.forEach(function(r){ if(!r.slug) return; rel+='<li><a href="'+SITE+'/p/'+encodeURIComponent(r.slug)+'">'+esc(r.name)+(r.city?(' — '+esc(r.city)):'')+'</a></li>'; });
    rel+='</ul>';
  }
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">'
   +'<meta name="viewport" content="width=device-width, initial-scale=1">'
   +'<title>'+esc(title)+'</title>'
   +'<meta name="description" content="'+attr(desc)+'">'
   +'<link rel="canonical" href="'+attr(url)+'">'
   +'<meta property="og:type" content="business.business"><meta property="og:site_name" content="Zoi">'
   +'<meta property="og:title" content="'+attr(title)+'"><meta property="og:description" content="'+attr(desc)+'"><meta property="og:url" content="'+attr(url)+'">'
   +'<meta name="twitter:card" content="summary"><meta name="twitter:title" content="'+attr(title)+'"><meta name="twitter:description" content="'+attr(desc)+'">'
   +'<script type="application/ld+json">'+jsonld(e,url).replace(/</g,'\\u003c')+'</script>'
   +'<style>:root{--sea:#0a4d8c;--gold:#c79a4b;--ink:#0c2f4e;--paper:#f4efe3}*{box-sizing:border-box}body{margin:0;font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--paper)}'
   +'.wrap{max-width:760px;margin:0 auto;padding:28px 20px 60px}a{color:var(--sea)}nav.bc{font-size:13px;color:#5c7b92;margin-bottom:18px}nav.bc a{color:#5c7b92;text-decoration:none}'
   +'.badge{display:inline-block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a6a24;font-weight:700}h1{font-size:30px;margin:6px 0 4px;line-height:1.15}h2{font-size:19px;margin:34px 0 10px}'
   +'.card{background:#fffdf9;border:1px solid rgba(199,154,75,.28);border-radius:16px;padding:18px 20px;margin:18px 0;box-shadow:0 18px 40px -28px rgba(6,40,70,.5)}'
   +'.row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid rgba(12,47,78,.08)}.row:last-child{border-bottom:0}.row span{color:#5c7b92}.row b{text-align:right}'
   +'.cta{display:inline-block;background:linear-gradient(135deg,var(--gold),#b8893b);color:#3a2706;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:30px;margin-top:8px}'
   +'.mapbtn{display:inline-block;border:1px solid var(--sea);color:var(--sea);text-decoration:none;padding:10px 18px;border-radius:30px;margin:8px 8px 0 0}'
   +'p.desc{font-size:17px}ul.rel{list-style:none;padding:0;margin:0}ul.rel li{padding:7px 0;border-bottom:1px solid rgba(12,47,78,.08)}footer{margin-top:34px;font-size:13px;color:#5c7b92}</style></head><body><div class="wrap">'
   +'<nav class="bc"><a href="'+SITE+'/">Zoi</a> › <a href="'+SITE+'/">'+esc(catLabel)+'</a> › '+esc(e.name)+'</nav>'
   +'<div class="badge">'+esc(catLabel)+'</div>'
   +'<h1>'+esc(e.name)+'</h1>'
   +(e.city?('<div style="color:#5c7b92">'+esc(e.city)+(e.country?(', '+esc(e.country)):'')+'</div>'):'')
   +(e.description?('<p class="desc">'+esc(e.description)+'</p>'):'')
   +'<div class="card">'+rows.join('')+'</div>'
   +(mapHref?('<a class="mapbtn" href="'+attr(mapHref)+'" rel="nofollow noopener" target="_blank">View on map</a>'):'')
   +'<div><a class="cta" href="'+SITE+'/">Open in Zoi — the Greek world, live →</a></div>'
   +rel
   +'<footer>Part of <a href="'+SITE+'/">Zoi</a> — a verified directory of the global Greek world: churches, tavernas, schools, creators and businesses across the diaspora and Greece.</footer>'
   +'</div></body></html>';
}
module.exports = async (req, res) => {
  var slug = (req.query && req.query.slug ? String(req.query.slug) : '').trim();
  try {
    if (!slug) { res.statusCode=404; res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<!doctype html><title>Not found</title><h1>Not found</h1><p><a href="'+SITE+'/">Go to Zoi</a></p>'); return; }
    var e = await rpc('seo_entity', { p_slug: slug });
    if (Array.isArray(e)) e = e[0];
    if (!e || !e.name) { res.statusCode=404; res.setHeader('Content-Type','text/html; charset=utf-8'); res.setHeader('X-Robots-Tag','noindex'); res.end('<!doctype html><title>Not found — Zoi</title><h1>Listing not found</h1><p><a href="'+SITE+'/">Browse Zoi</a></p>'); return; }
    var related=[]; try { related = await rpc('seo_related', { p_slug: slug, p_limit: 8 }); if(!Array.isArray(related)) related=[]; } catch(e2) { related=[]; }
    res.statusCode=200;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
    res.end(page(e, related));
  } catch (err) {
    res.statusCode=500; res.setHeader('Content-Type','text/html; charset=utf-8'); res.setHeader('X-Robots-Tag','noindex');
    res.end('<!doctype html><title>Zoi</title><h1>Temporarily unavailable</h1><p><a href="'+SITE+'/">Go to Zoi</a></p>');
  }
};

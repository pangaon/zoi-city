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
  var slug = e.canonical_slug || e.slug;
  var url = SITE + '/' + encodeURIComponent(e.entity_type || 'p') + '/' + encodeURIComponent(slug);
  var title = e.meta_title || (e.name + (e.city ? ' — ' + e.city : '') + ' | Zoi');
  var desc = e.meta_description || e.description || (e.name + (e.city?(' in '+e.city):'') + ' — on Zoi, the directory of the Greek world.');
  var catLabel = pretty(e.category_slug) || pretty(e.entity_type);
  var mapHref = (e.latitude!=null&&e.longitude!=null)
      ? ('https://www.google.com/maps/search/?api=1&query='+e.latitude+','+e.longitude)
      : (e.address? ('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(e.address)) : null);

  var rows=[];
  function row(label, value){ rows.push('<div class="row"><span>'+esc(label)+'</span><b>'+value+'</b></div>'); }
  if(e.address) row('Address', esc(e.address));
  else if(e.city) row('Location', esc(e.city)+(e.country?(', '+esc(e.country)):''));
  if(e.place_path) row('Area', esc(e.place_path));
  if(e.phone) row('Phone', '<a href="tel:'+attr((e.phone+'').replace(/[^0-9+]/g,''))+'">'+esc(e.phone)+'</a>');
  if(e.website) row('Website', '<a href="'+attr(e.website)+'" rel="nofollow noopener" target="_blank">'+esc(e.website.replace(/^https?:\/\//,''))+'</a>');
  if(e.category_slug) row('Category', esc(catLabel));
  if(e.price_range) row('Price', esc(e.price_range));
  var sl=e.social_links||{}, socLinks=[];
  [['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],['twitter','X'],['linkedin','LinkedIn']].forEach(function(pp){
    var v=sl[pp[0]]; if(v){ var href=/^https?:/.test(v)?v:('https://'+pp[0]+'.com/'+(''+v).replace(/^@/,'')); socLinks.push('<a href="'+attr(href)+'" rel="nofollow noopener" target="_blank">'+pp[1]+'</a>'); }
  });
  if(socLinks.length) row('Social', socLinks.join(' &middot; '));

  /* Related listings link by slug — never by a derived path. */
  var rel='';
  if(related && related.length){
    rel='<h2>More Greek '+esc(catLabel.toLowerCase())+(e.city?(' near '+esc(e.city)):'')+'</h2><div class="relgrid">';
    related.forEach(function(r){
      if(!r.slug) return;
      var rh = SITE + '/' + encodeURIComponent(r.entity_type||'p') + '/' + encodeURIComponent(r.slug);
      rel+='<a class="relcard" href="'+attr(rh)+'"><b>'+esc(r.name)+'</b>'+(r.city?('<span>'+esc(r.city)+'</span>'):'')+'</a>';
    });
    rel+='</div>';
  }

  var NAV = [['/explore','Directory'],['/community','Community'],['/social','Business'],['/tickets','Tickets'],['/#marketplace','Marketplace']];
  var nav = NAV.map(function(n){ return '<a href="'+n[0]+'">'+n[1]+'</a>'; }).join('');
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';

  return '<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">'
   +'<meta name="viewport" content="width=device-width, initial-scale=1">'
   +'<meta name="color-scheme" content="dark light">'
   +'<title>'+esc(title)+'</title>'
   +'<meta name="description" content="'+attr(desc)+'">'
   +'<link rel="canonical" href="'+attr(url)+'">'
   +'<meta property="og:type" content="business.business"><meta property="og:site_name" content="Zoi">'
   +'<meta property="og:title" content="'+attr(title)+'"><meta property="og:description" content="'+attr(desc)+'"><meta property="og:url" content="'+attr(url)+'">'
   +'<meta name="twitter:card" content="summary"><meta name="twitter:title" content="'+attr(title)+'"><meta name="twitter:description" content="'+attr(desc)+'">'
   +'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
   +'<link rel="stylesheet" href="/assets/zoi-theme.css">'
   +'<script type="application/ld+json">'+jsonld(e,url).replace(/</g,'\\u003c')+'</script>'
   +'<style>'
   +'.wrap{max-width:900px}'
   +'.ep-cover{aspect-ratio:16/6;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:var(--card);margin:26px 0 0}'
   +'.ep-cover svg{display:block;width:100%;height:100%}'
   +'.bc{font-size:12.5px;color:var(--dim);margin:22px 0 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
   +'.bc a{color:var(--mut)}.bc a:hover{color:var(--tx)}'
   +'.ep-type{font-size:10.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--gold);margin-top:20px;display:block}'
   +'h1{font-size:clamp(30px,4.6vw,46px);margin:8px 0 0}'
   +'.ep-loc{color:var(--mut);font-size:14.5px;margin-top:8px;display:flex;align-items:center;gap:7px}'
   +'.ep-loc svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2}'
   +'p.desc{font-size:16.5px;color:var(--mut);line-height:1.65;margin:18px 0 0;max-width:64ch}'
   +'.card{margin:24px 0 0;padding:6px 20px}'
   +'.row{display:flex;justify-content:space-between;gap:18px;padding:13px 0;border-bottom:1px solid var(--line)}'
   +'.row:last-child{border-bottom:0}.row span{color:var(--mut);font-size:13.5px;flex:none}'
   +'.row b{text-align:right;font-weight:600;font-size:14px;min-width:0;overflow-wrap:anywhere}'
   +'.row b a{color:var(--acc)}'
   +'.acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}'
   +'h2{font-size:20px;margin:44px 0 14px}'
   +'.relgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}'
   +'.relcard{display:flex;flex-direction:column;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-sm);padding:13px 15px;transition:.25s var(--ease)}'
   +'.relcard:hover{border-color:var(--acc);transform:translateY(-2px)}'
   +'.relcard b{font-size:14px;font-weight:600;letter-spacing:-.01em}'
   +'.relcard span{font-size:12px;color:var(--dim)}'
   +'.claimbar{margin:34px 0 0;padding:18px 20px;border-radius:var(--r);border:1px solid color-mix(in srgb, var(--gold) 32%, transparent);background:color-mix(in srgb, var(--gold) 9%, transparent);display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}'
   +'.claimbar p{margin:0;font-size:14px;color:var(--tx)}.claimbar b{color:var(--gold)}'
   +'</style></head><body>'
   +'<header class="zoi-header"><div class="wrap zoi-bar">'
     +'<a class="zoi-brand" href="/" aria-label="Zoi home"><span class="zoi-seal">&#918;</span><b>Zoi</b></a>'
     +'<nav class="zoi-nav" aria-label="Zoi">'+nav+'</nav>'
     +'<div class="zoi-actions">'
       +'<button class="theme-btn" id="themeBtn" title="Theme — dark / light / gold" aria-label="Switch theme">'+MOON+'</button>'
       +'<a class="btn btn-primary" id="zoiCta" href="/social">Start free</a>'
     +'</div>'
   +'</div></header>'
   +'<div class="wrap">'
   +'<nav class="bc"><a href="/">Zoi</a> &rsaquo; <a href="/explore">Directory</a> &rsaquo; '
     +'<a href="/explore?type='+attr(e.entity_type||'')+'">'+esc(catLabel)+'</a></nav>'
   +'<div class="ep-cover" id="epCover"></div>'
   +'<span class="ep-type">'+esc(catLabel)+'</span>'
   +'<h1>'+esc(e.name)+'</h1>'
   +(e.city?('<div class="ep-loc"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>'+esc(e.city)+(e.country?(', '+esc(e.country)):'')+'</div>'):'')
   +(e.description?('<p class="desc">'+esc(e.description)+'</p>'):'')
   +(rows.length?('<div class="card">'+rows.join('')+'</div>'):'')
   +'<div class="acts">'
     +(mapHref?('<a class="btn btn-ghost" href="'+attr(mapHref)+'" rel="nofollow noopener" target="_blank">View on map</a>'):'')
     +'<a class="btn btn-ghost" href="/explore?type='+attr(e.entity_type||'')+(e.city?('&city='+encodeURIComponent(e.city)):'')+'">More like this</a>'
   +'</div>'
   +'<div class="claimbar"><p><b>Is this your listing?</b> Claim it to edit the details, add photos and publish from Zoi.</p>'
     +'<a class="btn btn-primary" href="/explore?q='+encodeURIComponent(e.name||'')+'">Claim this listing</a></div>'
   +rel
   +'</div>'
   +'<footer class="zoi-footer"><div class="wrap" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;align-items:center">'
     +'<span class="zoi-fmeta">&copy; <span id="yr">2026</span> Zoi &middot; The home of the Greek world.</span>'
     +'<nav class="zoi-fnav" aria-label="Footer">'+nav+'<a href="/apps/">Advanced tools</a></nav>'
   +'</div></footer>'
   +'<script src="/assets/zoi-emblem.js"></script>'
   +'<script>(function(){var h=document.getElementById("epCover");'
     +'if(h&&window.ZoiEmblem){h.innerHTML=ZoiEmblem.emblem('
       +JSON.stringify({name:e.name||'', type:e.entity_type||'', slug:slug||''}).replace(/</g,'\\u003c')+');}})();</script>'
   +'<script src="/assets/zoi-theme.js"></script>'
   +'</body></html>';
}
// ESM: package.json sets "type":"module", so a CommonJS export leaves this
// function with no handler at all — which is what made every listing page 500.
export default async function handler(req, res) {
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
}

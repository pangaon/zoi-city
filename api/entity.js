import { verticalFor, profileOf, icon, IC } from './_verticals.js';

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
/* schema.org type per vertical. Collapsing five entity types into
 * LocalBusiness was throwing away the structured data that makes these pages
 * eligible for rich results at all. Refined by entity_type first, then by
 * category_slug. */
/* Public URLs never contain underscores. `travel_place` is the only offender
 * in the taxonomy; the underscore form 301s to this. */
function typeSlug(t){ t=String(t||'p'); return t==='travel_place' ? 'travel-place' : t; }

function schemaType(e){
  var t=String(e.entity_type||'').toLowerCase(), c=String(e.category_slug||'').toLowerCase();
  // category wins where it is more specific than the type
  if(/restaurant|taverna|meze|ouzer|grill|souvla|estiatorio|dining/.test(c)) return 'Restaurant';
  if(/baker|patisserie|zaxarop|pastry/.test(c)) return 'Bakery';
  if(/cafe|coffee|kafeneio/.test(c)) return 'CafeOrCoffeeShop';
  if(/hotel|resort|guesthouse/.test(c)) return 'Hotel';
  if(/villa|rooms|apartment|accommodation/.test(c)) return 'LodgingBusiness';
  if(/law|legal|attorney|solicitor|barrister/.test(c)) return 'Attorney';
  if(/dental|dentist/.test(c)) return 'Dentist';
  if(/doctor|medical|clinic|physio|health/.test(c)) return 'MedicalClinic';
  if(/account|tax|book-?keep/.test(c)) return 'AccountingService';
  if(/real-?estate|realtor/.test(c)) return 'RealEstateAgent';
  if(/insur/.test(c)) return 'InsuranceAgency';
  if(/financ|mortgage|invest/.test(c)) return 'FinancialService';
  if(/architect|engineer/.test(c)) return 'ProfessionalService';
  if(/jewel/.test(c)) return 'JewelryStore';
  if(/wine|liquor|spirits/.test(c)) return 'LiquorStore';
  if(/market|grocer|deli|butcher|fish|olive|honey|specialty|food|import/.test(c)) return 'GroceryStore';
  if(/music|singer|band|bouzouki|composer|\bdj\b|djs/.test(c)) return 'MusicGroup';
  if(/radio|podcast|broadcast/.test(c)) return 'RadioStation';
  // then the entity type
  if(t==='church') return 'Church';
  if(t==='school') return 'School';
  if(t==='event') return /festival|panigiri/.test(c) ? 'Festival' : 'Event';
  if(t==='organization') return 'NGO';
  if(t==='venue') return 'EventVenue';
  if(t==='sports') return 'SportsTeam';
  if(t==='travel_place') return 'TouristAttraction';
  if(t==='vendor') return 'Store';
  if(t==='artist') return 'MusicGroup';
  if(t==='creator') return 'Person';
  if(t==='professional') return 'ProfessionalService';
  return 'LocalBusiness';
}

/* Reviews and ratings are a hard NO for whole verticals, not a preference:
 * AHPRA bans patient testimonials in health advertising (AU/NZ), legal
 * advertising rules bite on outcome-implying testimonials, and the financial
 * regimes require conflict disclosure we do not have. Enforced in the
 * renderer so no data path can turn them on. */
function reviewsAllowed(e){
  var t=String(e.entity_type||'').toLowerCase(), c=String(e.category_slug||'').toLowerCase();
  if(/dental|dentist|doctor|medical|clinic|physio|health|pharmac/.test(c)) return false;
  if(/law|legal|attorney|solicitor|barrister/.test(c)) return false;
  if(/insur|financ|mortgage|invest|advis/.test(c)) return false;
  if(t==='church') return false;
  return true;
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
  if(reviewsAllowed(e) && e.rating!=null && e.rating_count!=null && e.rating_count>0){
    o.aggregateRating={ '@type':'AggregateRating', ratingValue:e.rating, reviewCount:e.rating_count };
  }
  // Languages are the diaspora conversion mechanism — a Greek-speaking lawyer is
  // *why* someone picks this listing. First-class, not a chip.
  var langs=(e.profile&&Array.isArray(e.profile.languages))?e.profile.languages:[];
  if(langs.length){
    o.knowsLanguage=langs.map(function(l){
      if(typeof l==='string') return { '@type':'Language', name:l };
      return { '@type':'Language', name:String(l.name||l.code||''), alternateName:String(l.code||'') };
    }).filter(function(l){ return l.name; });
  }
  var areas=(e.profile&&Array.isArray(e.profile.service_areas))?e.profile.service_areas:[];
  if(areas.length){
    o.areaServed=areas.map(function(a){ return { '@type':'Place', name:String(a) }; });
  }
  var sa=socialArr(e); if(sa.length) o.sameAs=sa;
  return JSON.stringify(o);
}
function page(e, related){
  var slug = e.canonical_slug || e.slug;
  var url = SITE + '/' + encodeURIComponent(typeSlug(e.entity_type)) + '/' + encodeURIComponent(slug);
  var picked = verticalFor(e), V = picked.v, sub = picked.sub;
  var p = profileOf(e);
  var eyebrow = (typeof V.eyebrow === 'function' ? V.eyebrow(e, sub) : sub) || pretty(e.entity_type);
  var catLabel = pretty(e.category_slug) || pretty(e.entity_type);
  var title = e.meta_title || (e.name + (e.city ? ' — ' + e.city : '') + ' | Zoi');
  var desc = e.meta_description || e.description || (e.name + (e.city?(' in '+e.city):'') + ' — on Zoi, the directory of the Greek world.');
  var mapHref = (e.latitude!=null&&e.longitude!=null)
      ? ('https://www.google.com/maps/search/?api=1&query='+e.latitude+','+e.longitude)
      : (e.address? ('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(e.address)) : null);

  /* ---- primary actions: the vertical's own, then the universally real ones ---- */
  var acts = [];
  (V.actions ? V.actions(e, p) : []).forEach(function(a){ acts.push(a); });
  if(e.phone)   acts.push({ label:'Call', href: 'tel:'+String(e.phone).replace(/[^0-9+]/g,''), icon: IC.phone });
  if(e.website) acts.push({ label:'Website', href: e.website, icon: IC.globe, external:true });
  if(mapHref)   acts.push({ label:'Directions', href: mapHref, icon: IC.pin, external:true });
  var actHtml = acts.length ? '<div class="acts">' + acts.map(function(a,i){
      var cls = (a.primary || (i===0 && !acts.some(function(x){return x.primary;}))) ? 'btn btn-primary' : 'btn btn-ghost';
      return '<a class="'+cls+'" href="'+attr(a.href)+'"'+(a.external?' rel="nofollow noopener" target="_blank"':'')+'>'+
             (a.icon?icon(a.icon):'')+esc(a.label)+'</a>';
    }).join('') + '</div>' : '';

  /* ---- contact card ---- */
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

  /* ---- the vertical's own content, real data only ---- */
  var verticalHtml = V.sections ? V.sections(e, p) : '';

  /* ---- claim panel: names exactly what THIS kind of listing unlocks ---- */
  var unlock = (V.unlock||[]).map(function(u){
    return '<li><b>'+esc(u[0])+'</b><span>'+esc(u[1])+'</span></li>';
  }).join('');
  var claim = '<section class="claim"><div class="claimhead">'+
      '<div><span class="ctag">Unclaimed</span><h2>Own '+esc(e.name)+'?</h2>'+
      '<p>Claim it and this page becomes a full '+esc(V.noun||'business')+' page — free.</p></div>'+
      '<a class="btn btn-primary" href="/explore?q='+encodeURIComponent(e.name||'')+'">Claim this listing</a></div>'+
      (unlock?'<ul class="unlock">'+unlock+'</ul>':'')+
      '<p class="claimfoot">Everything above is what a claimed '+esc(V.noun||'listing')+' can publish here. '+
      'Nothing on this page is invented \u2014 we only show what has actually been provided.</p></section>';

  /* ---- related, linked by slug ---- */
  var rel='';
  if(related && related.length){
    rel='<section class="sec"><h2>'+icon(IC.pin,'sech')+'More Greek '+esc(catLabel.toLowerCase())+(e.city?(' near '+esc(e.city)):'')+'</h2><div class="relgrid">';
    related.forEach(function(r){
      if(!r.slug) return;
      var rh = SITE + '/' + encodeURIComponent(typeSlug(r.entity_type)) + '/' + encodeURIComponent(r.slug);
      rel+='<a class="relcard" href="'+attr(rh)+'"><b>'+esc(r.name)+'</b>'+(r.city?('<span>'+esc(r.city)+'</span>'):'')+'</a>';
    });
    rel+='</div></section>';
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
   +'<style>'+PAGE_CSS+'</style></head><body>'
   +'<header class="zoi-header"><div class="wrap zoi-bar">'
     +'<a class="zoi-brand" href="/" aria-label="Zoi home"><span class="zoi-seal">&#918;</span><b>Zoi</b></a>'
     +'<nav class="zoi-nav" aria-label="Zoi">'+nav+'</nav>'
     +'<div class="zoi-actions">'
       +'<button class="theme-btn" id="themeBtn" title="Theme &mdash; dark / light / gold" aria-label="Switch theme">'+MOON+'</button>'
       +'<a class="btn btn-primary" id="zoiCta" href="/social">Start free</a>'
     +'</div>'
   +'</div></header>'
   +'<div class="wrap">'
   +'<nav class="bc"><a href="/">Zoi</a> &rsaquo; <a href="/explore">Directory</a> &rsaquo; '
     +'<a href="/explore?type='+attr(e.entity_type||'')+'">'+esc(catLabel)+'</a></nav>'
   +'<div class="ep-cover" id="epCover"></div>'
   +'<span class="ep-type">'+esc(eyebrow)+'</span>'
   +'<h1>'+esc(e.name)+'</h1>'
   +(e.city?('<div class="ep-loc">'+icon(IC.pin)+esc(e.city)+(e.country?(', '+esc(e.country)):'')+'</div>'):'')
   +(e.description?('<p class="desc">'+esc(e.description)+'</p>'):'')
   +actHtml
   +(rows.length?('<div class="card">'+rows.join('')+'</div>'):'')
   +verticalHtml
   +claim
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

var PAGE_CSS = [
  '.wrap{max-width:920px}',
  '.ep-cover{aspect-ratio:16/6;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:var(--card);margin:24px 0 0}',
  '.ep-cover svg{display:block;width:100%;height:100%}',
  '.bc{font-size:12.5px;color:var(--dim);margin:22px 0 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
  '.bc a{color:var(--mut)}.bc a:hover{color:var(--tx)}',
  '.ep-type{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-top:20px;display:block}',
  'h1{font-size:clamp(30px,4.6vw,46px);margin:8px 0 0}',
  '.ep-loc{color:var(--mut);font-size:14.5px;margin-top:8px;display:flex;align-items:center;gap:7px}',
  '.ic{width:15px;height:15px;flex:none}',
  'p.desc{font-size:16.5px;color:var(--mut);line-height:1.65;margin:16px 0 0;max-width:64ch}',
  '.acts{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 0}',
  '.btn-xs{padding:6px 12px;min-height:32px;font-size:12.5px}',
  '.card{margin:22px 0 0;padding:6px 20px}',
  '.row{display:flex;justify-content:space-between;gap:18px;padding:13px 0;border-bottom:1px solid var(--line)}',
  '.row:last-child{border-bottom:0}.row span{color:var(--mut);font-size:13.5px;flex:none}',
  '.row b{text-align:right;font-weight:600;font-size:14px;min-width:0;overflow-wrap:anywhere}.row b a{color:var(--acc)}',
  /* vertical sections */
  '.sec{margin:40px 0 0}',
  '.sec h2{font-size:20px;margin:0 0 12px;display:flex;align-items:center;gap:9px}',
  '.sec h2 .sech{width:18px;height:18px;color:var(--gold);flex:none}',
  '.secsub{color:var(--mut);font-size:13px;margin:-6px 0 12px}',
  '.secp{color:var(--mut);font-size:15px;line-height:1.65;margin:0;max-width:64ch}',
  '.sched{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}',
  '.schrow{display:grid;grid-template-columns:120px 1fr auto;gap:14px;padding:12px 18px;border-bottom:1px solid var(--line);align-items:baseline}',
  '.schrow:last-child{border-bottom:0}',
  '.schday{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--gold)}',
  '.schlabel{font-size:14.5px;font-weight:600}.schlabel em{display:block;font-style:normal;font-size:12.5px;color:var(--mut);font-weight:400;margin-top:2px}',
  '.schtime{font-size:14px;color:var(--mut);font-variant-numeric:tabular-nums;white-space:nowrap}',
  '@media(max-width:560px){.schrow{grid-template-columns:1fr auto}.schday{grid-column:1/-1}}',
  '.chips{display:flex;flex-wrap:wrap;gap:8px}',
  '.pill{font-size:13px;font-weight:600;color:var(--tx);background:var(--card);border:1px solid var(--line2);border-radius:999px;padding:7px 14px}',
  '.ppl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}',
  '.pcard{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px}',
  '.pcard img,.pcard .pav{width:44px;height:44px;border-radius:50%;flex:none;object-fit:cover}',
  '.pcard .pav{display:grid;place-items:center;background:var(--card2);border:1px solid var(--line2);font-family:Fraunces,Georgia,serif;font-style:italic;font-size:19px;color:var(--gold)}',
  '.pcard b{display:block;font-size:14.5px}.pcard span{display:block;font-size:12.5px;color:var(--mut)}',
  '.mgroup{margin:0 0 22px}.mgroup h3{font-size:13px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--gold);margin:0 0 8px}',
  '.mitem{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid var(--line);align-items:baseline}',
  '.mitem b{font-weight:600;font-size:15px}.mitem em{display:block;font-style:normal;font-size:12.5px;color:var(--mut);margin-top:2px}',
  '.mprice{font-variant-numeric:tabular-nums;color:var(--gold);font-weight:700;white-space:nowrap}',
  '.dates{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}',
  '.drow{display:grid;grid-template-columns:140px 1fr auto;gap:14px;padding:13px 18px;border-bottom:1px solid var(--line);align-items:center}',
  '.drow:last-child{border-bottom:0}',
  '.dwhen{font-size:12.5px;font-weight:700;color:var(--gold);font-variant-numeric:tabular-nums}',
  '.dwhat b{font-size:14.5px;font-weight:600}.dwhat em{display:block;font-style:normal;font-size:12.5px;color:var(--mut);margin-top:2px}',
  '@media(max-width:560px){.drow{grid-template-columns:1fr}}',
  '.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}',
  '.gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--r-sm);border:1px solid var(--line)}',
  '.lit{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}',
  '.litrow{display:grid;grid-template-columns:130px 1fr;gap:14px;padding:13px 18px;border-bottom:1px solid var(--line);align-items:baseline}',
  '.litrow:last-child{border-bottom:0}',
  '.litk{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}',
  '.litv{font-size:14.5px;line-height:1.5}.litv b{color:var(--gold)}',
  '@media(max-width:560px){.litrow{grid-template-columns:1fr;gap:3px}}',
  /* claim */
  '.claim{margin:48px 0 0;padding:22px;border-radius:var(--r);border:1px solid color-mix(in srgb, var(--gold) 34%, transparent);background:color-mix(in srgb, var(--gold) 8%, transparent)}',
  '.claimhead{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}',
  '.ctag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);border:1px solid color-mix(in srgb, var(--gold) 40%, transparent);border-radius:999px;padding:3px 9px}',
  '.claimhead h2{font-size:22px;margin:10px 0 4px}',
  '.claimhead p{margin:0;color:var(--mut);font-size:14.5px}',
  '.unlock{list-style:none;padding:0;margin:22px 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}',
  '.unlock li{background:var(--card);border:1px solid var(--line);border-radius:var(--r-sm);padding:13px 15px}',
  '.unlock b{display:block;font-size:14px;font-weight:700;margin-bottom:3px}',
  '.unlock span{font-size:12.5px;color:var(--mut);line-height:1.5}',
  '.claimfoot{margin:18px 0 0;font-size:12px;color:var(--dim)}',
  '.relgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}',
  '.relcard{display:flex;flex-direction:column;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-sm);padding:13px 15px;transition:.25s var(--ease)}',
  '.relcard:hover{border-color:var(--acc);transform:translateY(-2px)}',
  '.relcard b{font-size:14px;font-weight:600;letter-spacing:-.01em}.relcard span{font-size:12px;color:var(--dim)}'
].join('');
// ESM: package.json sets "type":"module", so a CommonJS export leaves this
// function with no handler at all — which is what made every listing page 500.
export default async function handler(req, res) {
  var slug = (req.query && req.query.slug ? String(req.query.slug) : '').trim();
  try {
    if (!slug) { res.statusCode=404; res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<!doctype html><title>Not found</title><h1>Not found</h1><p><a href="'+SITE+'/">Go to Zoi</a></p>'); return; }
    var e = await rpc('seo_entity', { p_slug: slug });
    if (Array.isArray(e)) e = e[0];
    // Reached via a legacy shape (/p/<slug> or /travel_place/<slug>)? Those were
    // live duplicates of every listing. Send the crawler to the one canonical URL.
    if (e && e.name && req.query && req.query.canon) {
      var target = '/' + encodeURIComponent(typeSlug(e.entity_type)) + '/' +
        encodeURIComponent(e.canonical_slug || e.slug);
      res.statusCode = 301;
      res.setHeader('Location', target);
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      res.end('');
      return;
    }
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

import {auxiliaryImage} from '../../supabase/functions/zoi-enrich/_image-context.js';
import {ARTIST_SOURCES} from '../homes/templates/music/sources.mjs';
import {reviewedArtistMedia} from '../homes/templates/music/reviewed-media.mjs';
import {SIGNATURE,PARKVIEW} from '../homes/templates/events/data.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const has=(v,k)=>Object.hasOwn(object(v),k);
export function httpsImage(value){
 if(typeof value!=='string'||value.length>3000)return null;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function machineImage(value){const url=httpsImage(value);if(!url||auxiliaryImage(url))return null;const u=new URL(url);return u.pathname==='/'&&!u.search?null:url;}
export function imageIdentity(value){
 const url=httpsImage(value);if(!url)return null;const u=new URL(url);
 u.pathname=u.pathname.replace(/\.(jpe?g|png)\.webp$/i,'.$1').replace(/-(?:\d{2,5}x\d{2,5}|\d{2,5}w)(?=\.[a-z]+$)/i,'');
 for(const key of ['w','h','width','height','quality','q','fit','auto','format'])u.searchParams.delete(key);
 return u.href;
}
export function interfaceArtwork(value){
 const url=machineImage(value);if(!url)return true;
 let leaf=new URL(url).pathname||'';
 try{leaf=decodeURIComponent(leaf);}catch{}leaf=leaf.toLowerCase();
 return /(?:^|[/\s_.+-])(?:(?:web[-_]?)?logos?|advert(?:isement)?|anzeige|flyer|poster|icon|avatar|sprite|pixel|tracking|favicon|badge|food[-_]rating|app[-_]?store|google[-_]?play|payment|placeholder)(?:[/\s_.+-]|$)/i.test(leaf)||/^(?:apple|google|top|bottom|blue(?:[-_]left)?)(?:[-_]\d+w)?\.(?:png|svg|webp)$/i.test(leaf.split('/').pop());
}
export function sourceQuarantined(q={}){return ['association_directory','association_member'].includes(q.source_kind)||q.identity_scope==='organization'||q.organization_identity_quarantine||q.scope_review_required||q.blocked_reason==='source_scope_mismatch'||q.source_affiliation||q.member?.affiliation||q.association_member;}
function effectiveWebsite(entity){const raw=object(entity?.profile),owner=object(entity?.owner_content),op=object(owner.profile);const chosen=selected([owner,op,raw],['website']);return chosen.present?chosen.value:entity?.website;}
export function sourceIdentity(entity){
 const q=object(entity?.profile?._enrich),owner=object(entity?.owner_content);
 if(sourceQuarantined(q))return false;
 try{const a=new URL(effectiveWebsite(entity)),b=new URL(q.source_url);return ['https:','http:'].includes(a.protocol)&&['https:','http:'].includes(b.protocol)&&!a.username&&!a.password&&!b.username&&!b.password&&a.port===b.port&&a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&(a.pathname==='/'||a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,''));}catch{return false;}
}
function selected(layers,keys){for(const layer of layers)for(const key of keys)if(has(layer,key))return{present:true,value:layer[key],key};return{present:false,value:null};}
function selectedLogo(layers){for(const layer of layers){if(has(layer.brand,'logo'))return{present:true,value:layer.brand.logo};for(const key of ['logo_url','logo'])if(has(layer,key))return{present:true,value:layer[key]};}return{present:false,value:null};}
export function profileMedia(entity,profile={},options={}){
 const raw=object(entity?.profile),derived={...object(raw._enrich?.fields),...object(raw._enrich)},owner=object(entity?.owner_content),op=object(owner.profile),layers=[owner,op,raw];
 const ownerHero=selected([owner,op],['photo_url','hero_url']),rawHero=selected([raw],['photo_url','hero_url']);
 const explicitHero=ownerHero.present?ownerHero:rawHero,explicitGallery=selected([op,owner,raw],['photo_urls','photos','gallery']),explicitLogo=selectedLogo(layers);
 // Preserve the established pure-function interface for callers with no source
 // context. Real entity/source URLs always require exact source identity.
 const unbound=!derived.source_url&&!has(owner,'website')&&!has(op,'website')&&!has(raw,'website')&&(options.legacyUnbound===true||(options.allowUnbound!==false&&!entity?.website));
 const quarantined=sourceQuarantined(derived);
 const trusted=!quarantined&&(sourceIdentity(entity)||unbound),reviewed=object(options.reviewed);
 const source=explicitGallery.present?explicitGallery.value:trusted?(profile.photo_urls||profile.photos||derived.photo_urls||derived.photos||[]):[];
 const gallery=[],seen=new Set();
 for(const item of Array.isArray(source)?source:[]){const url=httpsImage(typeof item==='string'?item:item?.url);if(!url||(!explicitGallery.present&&interfaceArtwork(url)))continue;const key=imageIdentity(url);if(seen.has(key))continue;seen.add(key);gallery.push(url);if(gallery.length===12)break;}
 const roles=trusted&&Array.isArray(derived.photo_roles)?derived.photo_roles:[],galleryOnly=new Set(roles.filter(x=>x?.role==='gallery_only'&&httpsImage(x.url)).map(x=>httpsImage(x.url)));
 const heroGallery=explicitGallery.present?gallery:gallery.filter(url=>!galleryOnly.has(url));
 const base=trusted||(!derived.source_url&&!quarantined)?entity?.hero_url||entity?.photo_url||entity?.photo:null;
 const candidates=[reviewed.hero,base,...(trusted?[profile.hero_url,profile.photo_url,derived.hero_url,derived.photo_url]:[]),...heroGallery].filter(v=>httpsImage(v)&&!interfaceArtwork(v)&&(explicitGallery.present||!galleryOnly.has(v)));
 // A populated base photo remains the current photo ahead of a populated
 // legacy profile hero. Explicit owner fields and profile clears still win;
 // a nullable base column alone does not erase a source/curated fallback.
 const currentBase=!ownerHero.present&&rawHero.key==='hero_url'&&httpsImage(rawHero.value)&&httpsImage(base)&&!interfaceArtwork(base)&&!galleryOnly.has(base)?httpsImage(base):null;
 const hero=explicitHero.present?(currentBase||httpsImage(explicitHero.value)):candidates[0]||null;
 const inferredLogo=trusted&&derived.hero_url&&/logo/i.test(derived.hero_url)?httpsImage(derived.hero_url):null;
 const logo=explicitLogo.present?httpsImage(explicitLogo.value):machineImage(reviewed.logo)||(trusted?machineImage(entity?.logo_url||profile.logo_url||derived.logo_url||derived.logo):null)||inferredLogo;
 return{hero,logo,gallery,heroGallery};
}
export function reviewedListingMedia(entity){
 const owner=object(entity?.owner_content),op=object(owner.profile),q=object(entity?.profile?._enrich);
 if(sourceQuarantined(q))return null;
 const curated=entity?.entity_type==='artist'?ARTIST_SOURCES[entity.id]:null;
 if(curated){try{const a=new URL(effectiveWebsite(entity)),b=new URL(curated.website);if(['https:','http:'].includes(a.protocol)&&!a.username&&!a.password&&a.port===b.port&&a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&(b.pathname==='/'||a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'')))return{hero:curated.portrait,logo:null,logoBackdrop:'light',source:curated.website};}catch{}}
 const artist=entity?.entity_type==='artist'&&sourceIdentity(entity)?reviewedArtistMedia(entity):null;
 if(artist)return{hero:artist.portrait,logo:null,logoBackdrop:'light',source:q.source_url};
 const base=entity?.id===SIGNATURE.id&&entity.entity_type==='business'&&(!has(op,'business_type')||op.business_type==='concert_promoter')?SIGNATURE:entity?.id===PARKVIEW.id&&entity.entity_type==='venue'?PARKVIEW:null;
 if(!base)return null;
 try{const website=new URL(effectiveWebsite(entity)),source=new URL(base.website);if(website.protocol!=='https:'||website.username||website.password||website.port||website.hostname.replace(/^www\./,'')!==source.hostname.replace(/^www\./,''))return null;}catch{return null;}
 return{hero:base.hero,logo:base.logo,source:base.website,logoBackdrop:base===SIGNATURE?'dark':'light'};
}
export function listingMediaEntity(row){return row?.media_input?{...row,...object(row.media_input),profile:object(row.media_input.profile),owner_content:object(row.media_input.owner_content)}:row;}
export function publicListingMedia(row){
 const entity=listingMediaEntity(row),raw=object(entity?.profile),owner=object(entity?.owner_content),op=object(owner.profile),q=object(raw._enrich);
 // Older search deployments have only a selected photo field. Keep that field
 // usable until the bounded projection is installed; do not infer source data.
 if(!row?.media_input&&!row?.profile&&!row?.owner_content){const hero=machineImage(row?.photo_url);return{hero,logo:null,gallery:[],heroGallery:[],logoFit:'contain',logoBackdrop:'light',imageKind:row?.image_kind==='event_poster'?'event_poster':null};}
 const profile={...q,...raw,...op},reviewed=reviewedListingMedia(entity),media=profileMedia(entity,profile,{reviewed,allowUnbound:false}),kind=selected([owner,op,raw],['hero_kind']),url=selected([owner,op,raw],['hero_url']);
 // Exact native asset inspected at 792x612: its outer white padding can be
 // cropped inside a badge without changing the source logo or its identity.
 return{...media,logoFit:media.logo==='https://www.yamas.co.ke/logo.png'?'cover':'contain',logoBackdrop:reviewed?.logoBackdrop||'light',imageKind:kind.value==='event_poster'&&media.hero&&media.hero===httpsImage(url.value)?'event_poster':null};
}

export function publicListingDescription(row){
 const entity=listingMediaEntity(row),raw=object(entity?.profile),owner=object(entity?.owner_content),op=object(owner.profile),q=object(raw._enrich);
 const explicit=selected([owner,op,raw],['description']);
 const clean=v=>typeof v==='string'?v.replace(/<[^>]*(?:>|$)/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim():'';
 if(explicit.present)return clean(explicit.value);
 const trusted=sourceIdentity(entity),machine=trusted?clean(q.description||q.biography||q.bio||q.excerpt):'';
 // Artist biographies are current publisher/source material; other categories
 // keep their reviewed base description ahead of an imported source excerpt.
 const base=clean(entity?.description);
 return entity?.entity_type==='artist'?(machine||base):(base||machine);
}

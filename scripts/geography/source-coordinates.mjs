import {canonical,sha256} from '../quality/evidence.mjs';
const norm=v=>typeof v==='string'?v.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu,' ').trim():'';
const host=u=>{try{const v=new URL(u);return v.protocol==='https:'&&!v.username&&!v.password?v.hostname.replace(/^www\./,''):null}catch{return null}};
const sourceWithin=(url,website)=>{try{const a=new URL(url),b=new URL(website),base=b.pathname.replace(/\/$/,'');return host(url)===host(website)&&(!base||a.pathname===base||a.pathname.startsWith(base+'/'));}catch{return false}};
const types=v=>(Array.isArray(v)?v:[v]).filter(x=>typeof x==='string').map(x=>x.replace(/^https?:\/\/schema.org\//,''));
const placeTypes=new Set(['LocalBusiness','Restaurant','Hotel','LodgingBusiness','Store','Bakery','School','PlaceOfWorship','Church','SportsActivityLocation','MedicalBusiness','ProfessionalService','Organization']);
const numeric=v=>typeof v==='number'?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v.trim())?Number(v):NaN;
const country=v=>typeof v==='object'&&v?v.name||v.identifier:v;
export const coordinateSnapshot=row=>sha256(canonical({id:row.id,website:row.website,name:row.name,address:row.address,city:row.city,country:row.country,latitude:row.latitude??null,longitude:row.longitude??null,geo_precision:row.geo_precision??null,source_fingerprint:row.source_fingerprint,owner_hash:row.owner_hash}));
// Pinned ISO 3166-1 alpha-2/alpha-3 spellings; unsupported names stay exact.
const countryCodes={AU:['AU','AUS','Australia'],CY:['CY','CYP','Cyprus'],GR:['GR','GRC','Greece'],CA:['CA','CAN','Canada'],US:['US','USA','United States','United States of America'],GB:['GB','GBR','United Kingdom'],KE:['KE','KEN','Kenya'],DE:['DE','DEU','Germany'],FR:['FR','FRA','France'],NZ:['NZ','NZL','New Zealand']};
export const canonicalCountry=value=>{const key=norm(country(value));for(const [code,names]of Object.entries(countryCodes))if(names.some(name=>norm(name)===key))return code;return key;};
const addressFields=a=>({street:a.streetAddress,city:a.addressLocality,region:a.addressRegion||'',postal_code:a.postalCode||'',country:country(a.addressCountry)});
function reviewedIdentity(review,row,sourceUrl,sourceHash){return !!(review&&review.listing_id===row.id&&review.snapshot_sha256===coordinateSnapshot(row)&&review.source_url===sourceUrl&&review.source_sha256===sourceHash&&typeof review.reviewer==='string'&&review.reviewer.trim()&&(!Object.hasOwn(review,'source_name')||(typeof review.source_name==='string'&&review.source_name.trim().length>0&&review.source_name.length<=300&&review.exact_name_confirmed===true))&&typeof review.reviewed_at==='string'&&Number.isFinite(Date.parse(review.reviewed_at))&&review.exact_address_confirmed===true&&review.source_address&&['street','city','country'].every(k=>norm(review.source_address[k])));}
function sourceNameMatches(name,row,review){return norm(name)===norm(row.name)||!!(review&&typeof review.source_name==='string'&&norm(review.source_name)&&norm(name)===norm(review.source_name));}
function sameAddress(a,b){return ['street','city','region','postal_code'].every(k=>norm(a[k])===norm(b[k]))&&canonicalCountry(a.country)===canonicalCountry(b.country);}
function addressMatches(a,row,review){
 const source=addressFields(a);if(review&&sameAddress(source,review.source_address))return true;
 if(norm(source.city)!==norm(row.city)||canonicalCountry(source.country)!==canonicalCountry(row.country))return false;
 const full=[source.street,source.city,source.region,source.postal_code].filter(Boolean).join(' ');
 return norm(row.address)===norm(source.street)||norm(row.address)===norm(full);
}
const finitePoint=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&(lat!==0||lng!==0);
// Offline, explicitly reviewed capture only. This does not follow arbitrary URLs
// or turn a shortlink / camera position into coordinate evidence automatically.
function namedPlaceShortlinkCandidate(html,row,review,sourceUrl){
 if(!review||review.publisher_contact_scope!==true||review.destination_purpose!=='place_location'||host(sourceUrl)!==host(row.website))return null;
 const capture=review.shortlink_capture,card=review.contact_card_html;
 if(!capture||typeof card!=='string'||card.length>50000||review.contact_card_sha256!==sha256(card))return null;
 const doc=String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const cards=[...doc.matchAll(/<details\b[^>]*>[\s\S]*?<\/details\s*>/gi)].map(m=>m[0]);
 if(cards.filter(c=>c===card).length!==1)return null;
 const summary=card.match(/<summary\b[^>]*>([\s\S]*?)<\/summary\s*>/i)?.[1]?.replace(/<[^>]+>/g,' ');
 if(!summary||!sourceNameMatches(summary,row,review))return null;
 const text=norm(card.replace(/<[^>]+>/g,' ')),a=review.source_address;
 if(/\b(parking|car\s?park|garage|nearby|recommended)\b/i.test(text)||![a.street,a.city,a.postal_code].filter(Boolean).every(v=>text.includes(norm(v))))return null;
 let short,final;try{short=new URL(capture.url);final=new URL(capture.final_url)}catch{return null}
 if(short.protocol!=='https:'||short.hostname!=='maps.app.goo.gl'||short.username||short.password||short.search||short.hash||!/^\/[A-Za-z0-9]+$/.test(short.pathname))return null;
 const links=[...card.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)].filter(m=>m[1]===capture.url);
 if(links.length!==1||!/^driving directions$/i.test(links[0][2].replace(/<[^>]+>/g,' ').trim()))return null;
 if(final.protocol!=='https:'||final.hostname!=='www.google.com'||final.username||final.password||final.hash||[...final.searchParams.keys()].some(k=>!['entry','g_ep','skid'].includes(k)))return null;
 if(!Array.isArray(capture.redirects)||capture.redirects.length!==1)return null;
 const redirect=capture.redirects[0];
 if(redirect.url!==capture.url||redirect.location!==capture.final_url||![301,302,303,307,308].includes(redirect.status)||capture.final_status!==200)return null;
 if(typeof capture.final_html!=='string'||capture.final_html.length>2000000||!capture.final_html.length||capture.final_sha256!==sha256(capture.final_html)||!Number.isFinite(Date.parse(capture.captured_at)))return null;
 const match=final.pathname.match(/^\/maps\/place\/([^/]+)\/@[^/]+\/data=!4m9!3m8!1s(0x[0-9a-f]+:0x[0-9a-f]+)!5m2!4m1!1i2!8m2!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)!16s[^!]+$/i);
 if(!match)return null;
 let name;try{name=decodeURIComponent(match[1].replace(/\+/g,' '))}catch{return null}
 if(norm(name)!==norm(row.name)||capture.place_id!==match[2]||!capture.final_html.includes(capture.place_id)||!capture.final_html.includes(name))return null;
 const latitude=Number(match[3]),longitude=Number(match[4]),b=review.destination_locality;
 if(!finitePoint(latitude,longitude)||!b||!host(b.source_url)||![b.south,b.north,b.west,b.east].every(Number.isFinite)||b.south>=b.north||b.west>=b.east||b.south< -90||b.north>90||b.west< -180||b.east>180||b.north-b.south>5||b.east-b.west>5||latitude<b.south||latitude>b.north||longitude<b.west||longitude>b.east)return null;
 return{latitude,longitude,precision:'source_published',name:row.name,address:a,evidence_kind:'reviewed_named_place_shortlink',evidence_url:capture.final_url,shortlink_url:capture.url,place_id:capture.place_id,capture_sha256:sha256(canonical(capture)),contact_card_sha256:review.contact_card_sha256,destination_locality:b};
}
export function namedPlaceReviewMatches(report,review,website){
 const c=report?.candidate;
 if(c?.evidence_kind!=='reviewed_named_place_shortlink'||host(report.source_url)!==host(website)||!host(website)||review?.publisher_contact_scope!==true||review?.named_place_confirmed!==true||review?.destination_purpose!=='place_location')return false;
 for(const key of ['source_sha256','identity_review_sha256'])if(!/^[a-f0-9]{64}$/.test(report[key]||'')||review[key]!==report[key])return false;
 for(const key of ['capture_sha256','contact_card_sha256'])if(!/^[a-f0-9]{64}$/.test(c[key]||'')||review[key]!==c[key])return false;
 for(const [a,b]of [['destination_url','evidence_url'],['shortlink_url','shortlink_url'],['place_id','place_id']])if(review[a]!==c[b])return false;
 try{
  const u=new URL(c.evidence_url),m=u.pathname.match(/^\/maps\/place\/([^/]+)\/@[^/]+\/data=!4m9!3m8!1s(0x[0-9a-f]+:0x[0-9a-f]+)!5m2!4m1!1i2!8m2!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)!16s[^!]+$/i);
  if(u.protocol!=='https:'||u.hostname!=='www.google.com'||u.username||u.password||u.hash||[...u.searchParams.keys()].some(k=>!['entry','g_ep','skid'].includes(k))||!m||norm(decodeURIComponent(m[1].replace(/\+/g,' ')))!==norm(c.name)||m[2]!==c.place_id||Number(m[3])!==c.latitude||Number(m[4])!==c.longitude||!/^https:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+$/.test(c.shortlink_url))return false;
 }catch{return false;}
 return canonical(review.locality_extent)===canonical(c.destination_locality);
}
export function reviewedContactSource(row,review){
 return review?.publisher_contact_scope===true&&host(review.source_url)===host(row.website)&&host(row.website)&&/^[a-f0-9]{64}$/.test(review.source_sha256||'')&&reviewedIdentity(review,row,review.source_url,review.source_sha256)?review.source_url:row.website;
}
function destinationCandidate(html,row,review){
 html=String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 if(!review||review.destination_purpose!=='place_location'||typeof review.destination_url!=='string')return null;
 let u;try{u=new URL(review.destination_url)}catch{return null}
 if(u.protocol!=='https:'||u.hostname!=='www.google.com'||u.username||u.password||u.search||u.hash)return null;
 // Exactly one named destination, no origin, no waypoint, and an explicit
 // destination pair. Camera @ coordinates are deliberately never extracted.
 const m=u.pathname.match(/^\/maps\/dir\/\/([^/]+)\/@[^/]+\/data=!4m8!4m7!1m0!1m5!1m1!1s[^!]+!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)$/);
 if(!m)return null;
 let destination;try{destination=decodeURIComponent(m[1].replace(/\+/g,' '))}catch{return null}
 const a=review.source_address,expected=[row.name,a.street,[a.city,a.postal_code].filter(Boolean).join(' '),a.country].join(', ');
 if(norm(destination)!==norm(expected))return null;
 let matching=0;
 for(const link of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)){
  if(link[1].replace(/&amp;/g,'&')!==review.destination_url)continue;
  const before=String(html).slice(Math.max(0,link.index-1000),link.index),context=(before+link[2]).replace(/<[^>]+>/g,' ');
  if(/\b(parking|car\s?park|garage|neighbou?rhood|nearby|other location|recommended)\b/i.test(context))return null;
  matching++;
 }
 if(!matching)return null;
 const lat=Number(m[3]),lng=Number(m[2]);if(!finitePoint(lat,lng))return null;
 return {latitude:lat,longitude:lng,precision:'source_published',name:row.name,address:a,evidence_kind:'official_destination',evidence_url:review.destination_url};
}
function squarespaceCandidate(html,row,review){
 // Site configuration is not a branch directory. Require a reviewed exact
 // postal identity plus independent matching LocalBusiness JSON-LD.
 if(!review)return null;
 const doc=String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const scripts=[...doc.matchAll(/<script\b[^>]*data-name\s*=\s*["']static-context["'][^>]*>([\s\S]*?)<\/script\s*>/gi)];
 if(scripts.length!==1)return null;
 const assignment=scripts[0][1].trim().match(/^Static\s*=\s*window\.Static\s*\|\|\s*\{\s*\}\s*;\s*Static\.SQUARESPACE_CONTEXT\s*=\s*([\s\S]+);$/);
 if(!assignment)return null;
 let data;try{data=JSON.parse(assignment[1])}catch{return null}
 const website=data?.website,location=website?.location,a=review.source_address;
 if(!website||!location||Array.isArray(location)||typeof location!=='object'||!sourceWithin(website.authenticUrl,row.website)||!sourceWithin(website.baseUrl,row.website)||host('https://'+website.primaryDomain)!==host(row.website))return null;
 if(norm(location.addressTitle)!==norm(row.name)||norm(location.addressLine1)!==norm(a.street)||norm(location.addressLine2)!==norm([a.city,a.region,a.postal_code].filter(Boolean).join(' '))||canonicalCountry(location.addressCountry)!==canonicalCountry(a.country))return null;
 const expected=[location.addressLine1,location.addressLine2,location.addressCountry].join(' ');let corroborated=false;
 for(const match of doc.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){
  let json;try{json=JSON.parse(match[1])}catch{continue}
  for(const n of nodes(json))if(types(n['@type']).some(t=>placeTypes.has(t))&&norm(n.name||n.legalName)===norm(row.name)&&typeof n.address==='string'&&norm(n.address)===norm(expected)&&(!n.url||sourceWithin(n.url,row.website)))corroborated=true;
 }
 const lat=numeric(location.mapLat),lng=numeric(location.mapLng);if(!corroborated||!finitePoint(lat,lng))return null;
 return{latitude:lat,longitude:lng,precision:'source_published',name:row.name,address:a,evidence_kind:'squarespace_website_location',evidence_path:'Static.SQUARESPACE_CONTEXT.website.location'};
}
function nodes(v,out=[],depth=0){if(depth>12||out.length>500)return out;if(Array.isArray(v)){for(const n of v)nodes(n,out,depth+1)}else if(v&&typeof v==='object'){out.push(v);if(v['@graph'])nodes(v['@graph'],out,depth+1)}return out;}
export function extractSourceCoordinates(html,row,{sourceUrl=row.website,httpStatus=200,identityReview=null}={}){
 const result={schema:1,kind:'official_coordinate_dry_run',listing_id:row.id,snapshot_sha256:coordinateSnapshot(row),source_fingerprint:row.source_fingerprint,source_url:sourceUrl,http_status:httpStatus,source_sha256:sha256(String(html)),status:'review_required',coordinate_writes:0,provider_calls:0};
 const refuse=reason=>({...result,reason});
 if(row.owner_managed||row.owner_workspace_id)return refuse('owner_managed');
 if(row.public_eligible!==true)return refuse('not_public_eligible');
 if(!row.source_fingerprint||!row.owner_hash||!norm(row.name))return refuse('snapshot_incomplete');
 if(httpStatus!==200)return refuse('source_http_'+String(httpStatus));
 if(!host(row.website)||host(sourceUrl)!==host(row.website))return refuse('source_identity_mismatch');
 if(row.source_kind!=='official_website')return refuse('official_source_review_required');
 if(!norm(row.address)||!norm(row.city)||!norm(row.country))return refuse('address_components_missing');
 const identity=reviewedIdentity(identityReview,row,sourceUrl,result.source_sha256)?identityReview:null;
 if(identityReview&&!identity)return refuse('identity_review_mismatch');
 if(identity)result.identity_review_sha256=sha256(canonical(identity));
 const namedPlace=namedPlaceShortlinkCandidate(html,row,identity,sourceUrl);
 // A parent publisher contact page may supply only the explicitly bound card,
 // never its other hotels' structured data or unreviewed links.
 if(!sourceWithin(sourceUrl,row.website))return namedPlace?{...result,reason:'coordinate_plausibility_review_required',candidate:namedPlace}:refuse('source_identity_mismatch');
 const candidates=[];let addressMismatch=false;
 if(namedPlace)candidates.push(namedPlace);
 const structuredDoc=String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(template|noscript|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 for(const m of structuredDoc.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){
  let data;try{data=JSON.parse(m[1])}catch{continue}
  for(const n of nodes(data)){
   if(!types(n['@type']).some(t=>placeTypes.has(t))||!sourceNameMatches(n.name,row,identity))continue;
   if(n.url&&!sourceWithin(n.url,row.website))continue;
   const a=n.address,g=n.geo;if(!a||!g||!types(a['@type']).includes('PostalAddress')||!types(g['@type']).includes('GeoCoordinates'))continue;
   if(!addressMatches(a,row,identity)||(norm(n.name)!==norm(row.name)&&!sameAddress(addressFields(a),identity.source_address))){addressMismatch=true;continue;}
   const lat=numeric(g.latitude),lng=numeric(g.longitude);if(!finitePoint(lat,lng))continue;
   // Source claims are not proof of a door. Require review even for exact identity.
   candidates.push({latitude:lat,longitude:lng,precision:'source_published',name:n.name,address:addressFields(a),evidence_kind:'jsonld',schema_type:types(n['@type'])[0]});
  }
 }
 const siteLocation=squarespaceCandidate(html,row,identity);if(siteLocation)candidates.push(siteLocation);
 const destination=destinationCandidate(html,row,identity);if(destination)candidates.push(destination);
 const unique=[...new Map(candidates.map(c=>[c.latitude+','+c.longitude,c])).values()];
 if(!unique.length)return refuse(addressMismatch?'structured_address_mismatch':'matching_structured_coordinates_missing');
 if(unique.length!==1)return refuse('conflicting_source_coordinates');
 const candidate=unique[0];if(norm(candidate.name)!==norm(row.name)){candidate.stored_name=row.name;candidate.name_identity_review_sha256=result.identity_review_sha256;}
 return {...result,reason:'coordinate_plausibility_review_required',candidate};
}
export function reviewCoordinateCandidate(report,review,current){
 if(report.listing_id!==current.id||report.snapshot_sha256!==coordinateSnapshot(current)||report.source_fingerprint!==current.source_fingerprint||current.owner_managed||current.owner_workspace_id||current.public_eligible!==true)throw Error('coordinate_snapshot_changed');
 if(report.schema!==1||report.kind!=='official_coordinate_dry_run'||report.status!=='review_required'||report.reason!=='coordinate_plausibility_review_required'||report.http_status!==200||(!sourceWithin(report.source_url,current.website)&&!namedPlaceReviewMatches(report,review,current.website))||!finitePoint(report.candidate?.latitude,report.candidate?.longitude))throw Error('coordinate_report_invalid');
 if(report.candidate?.evidence_kind==='reviewed_named_place_shortlink'&&!namedPlaceReviewMatches(report,review,current.website))throw Error('named_place_review_required');
 if(!report.candidate||review.report_sha256!==sha256(canonical(report))||typeof review.reviewer!=='string'||!review.reviewer.trim()||!review.reviewed_at||!Number.isFinite(Date.parse(review.reviewed_at))||review.exact_address_confirmed!==true||review.not_area_centroid!==true)throw Error('coordinate_review_required');
 if(report.collector&&norm(report.collector)===norm(review.reviewer))throw Error('independent_coordinate_review_required');
 // An independently reviewed locality envelope is necessary to catch swapped
 // but globally legal lat/lng values. It is never derived from existing pins.
 const b=review.locality_extent,c=report.candidate;if(!b||!host(b.source_url)||!Number.isFinite(b.south)||!Number.isFinite(b.north)||!Number.isFinite(b.west)||!Number.isFinite(b.east)||b.south< -90||b.north>90||b.west< -180||b.east>180||b.south>=b.north||b.west>=b.east||b.north-b.south>5||b.east-b.west>5)throw Error('locality_evidence_required');
 if(c.latitude<b.south||c.latitude>b.north||c.longitude<b.west||c.longitude>b.east)throw Error('coordinate_outside_reviewed_locality');
 return {...report,status:'reviewed_pending_guarded_writer',review_sha256:sha256(canonical(review)),coordinate_writes:0};
}

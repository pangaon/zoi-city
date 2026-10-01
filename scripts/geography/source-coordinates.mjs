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
 if(!host(row.website)||!sourceWithin(sourceUrl,row.website))return refuse('source_identity_mismatch');
 if(row.source_kind!=='official_website')return refuse('official_source_review_required');
 if(!norm(row.address)||!norm(row.city)||!norm(row.country))return refuse('address_components_missing');
 const identity=reviewedIdentity(identityReview,row,sourceUrl,result.source_sha256)?identityReview:null;
 if(identityReview&&!identity)return refuse('identity_review_mismatch');
 if(identity)result.identity_review_sha256=sha256(canonical(identity));
 const candidates=[];let addressMismatch=false;
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
 if(report.schema!==1||report.kind!=='official_coordinate_dry_run'||report.status!=='review_required'||report.reason!=='coordinate_plausibility_review_required'||report.http_status!==200||!sourceWithin(report.source_url,current.website)||!finitePoint(report.candidate?.latitude,report.candidate?.longitude))throw Error('coordinate_report_invalid');
 if(!report.candidate||review.report_sha256!==sha256(canonical(report))||typeof review.reviewer!=='string'||!review.reviewer.trim()||!review.reviewed_at||!Number.isFinite(Date.parse(review.reviewed_at))||review.exact_address_confirmed!==true||review.not_area_centroid!==true)throw Error('coordinate_review_required');
 if(report.collector&&norm(report.collector)===norm(review.reviewer))throw Error('independent_coordinate_review_required');
 // An independently reviewed locality envelope is necessary to catch swapped
 // but globally legal lat/lng values. It is never derived from existing pins.
 const b=review.locality_extent,c=report.candidate;if(!b||!host(b.source_url)||!Number.isFinite(b.south)||!Number.isFinite(b.north)||!Number.isFinite(b.west)||!Number.isFinite(b.east)||b.south< -90||b.north>90||b.west< -180||b.east>180||b.south>=b.north||b.west>=b.east||b.north-b.south>5||b.east-b.west>5)throw Error('locality_evidence_required');
 if(c.latitude<b.south||c.latitude>b.north||c.longitude<b.west||c.longitude>b.east)throw Error('coordinate_outside_reviewed_locality');
 return {...report,status:'reviewed_pending_guarded_writer',review_sha256:sha256(canonical(review)),coordinate_writes:0};
}

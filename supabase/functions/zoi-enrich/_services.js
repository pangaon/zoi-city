// Deterministic statements explicitly offered by the exact source client.
// No prose/category inference, reviews, ratings, member-directory inheritance,
// provider account connection, booking availability or additional requests.
import { sourceClientIdentity } from './_brief.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
const list=v=>v==null?[]:Array.isArray(v)?v:[v];
const text=v=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
const norm=v=>text(v).normalize('NFKC').toLowerCase();
const countryKey=value=>{const key=norm(typeof value==='string'?value:value?.name||value?.identifier);return ({uk:'gb',gb:'gb','united kingdom':'gb','great britain':'gb',us:'us',usa:'us','united states':'us','united states of america':'us',au:'au',australia:'au',ca:'ca',canada:'ca',gr:'gr',greece:'gr',cy:'cy',cyprus:'cy',ie:'ie',ireland:'ie'})[key]||key;};
const typed=(v,t)=>list(v?.['@type']).some(s=>String(s).replace(/^https?:\/\/schema.org\//,'')===t);
function documentURL(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;return u.protocol+'//'+u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search;}catch{return null;}}
function structuredContext(html,row,url,{linkedSupplement=false,linkedDocumentURL=null}={}){
 if(typeof html!=='string'||html.length>1500000||!documentURL(url)||documentURL(url)!==documentURL(row?.website))return null;
 const held=row?.profile?._enrich||{};
 if(held.blocked_reason==='source_scope_mismatch'||[held.scope_review_required,held.organization_identity_quarantine,held.blocked].some(v=>v===true||v==='true'))return null;
 const identity=sourceClientIdentity(row,html,url);
 if(!linkedSupplement&&(identity?.verification!=='exact_name_typed_jsonld'||identity.expected_entity_type!==row.entity_type))return null;
 const queue=[],nodes=[];let scanned=0;
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{queue.push(JSON.parse(m[1]));}catch{if(linkedSupplement)return null;}}
 while(queue.length&&scanned++<1000){const node=queue.shift();if(Array.isArray(node)){if(node.length>100)return null;queue.push(...node);continue;}if(!object(node))continue;nodes.push(node);for(const key of['@graph','mainEntity'])if(node[key])queue.push(node[key]);}
 if(queue.length)return null;
 const roots=nodes.filter(n=>norm(n.name)===norm(row.name)&&(linkedSupplement||typed(n,identity.schema_type))&&(!n.url||documentURL(n.url)===documentURL(url)));
 if(roots.length>1||!linkedSupplement&&roots.length!==1)return null;
 if(linkedSupplement&&nodes.some(n=>['Restaurant','Bakery','CafeOrCoffeeShop','LocalBusiness','Organization'].some(t=>typed(n,t))&&n.name&&norm(n.name)!==norm(row.name)))return null;
 if(linkedSupplement&&nodes.some(n=>['Restaurant','Bakery','CafeOrCoffeeShop','LocalBusiness','Organization'].some(t=>typed(n,t))&&n.url&&documentURL(n.url)!==documentURL(row.website)&&documentURL(n.url)!==documentURL(linkedDocumentURL)))return null;
 const root=roots[0]||{name:row.name};
 if(list(root.address).length>1||list(root.location).length>1)return null;
 const addressMatches=value=>{if(list(value).length>1)return false;if(value==null)return true;const a=object(resolve(list(value)[0]));if(!a)return false;if(a?.addressCountry&&(!row.country||countryKey(a.addressCountry)!==countryKey(row.country)))return false;if(a?.addressLocality&&(!row.city||norm(a.addressLocality)!==norm(row.city)))return false;if(a?.streetAddress){const street=norm(a.streetAddress),stored=norm(row.address);if(!stored||stored!==street&&!stored.startsWith(street+','))return false;}return true;};
 const ids=new Map();for(const n of nodes)if(typeof n['@id']==='string'){if(ids.has(n['@id']))return null;ids.set(n['@id'],n);}
 const resolve=n=>{const seen=new Set();let value=n;for(let i=0;i<6;i++){if(!object(value)||typeof value['@id']!=='string'||Object.keys(value).length!==1)return value;if(seen.has(value['@id']))return null;seen.add(value['@id']);value=ids.get(value['@id']);}return null;};
 if(!addressMatches(root.address))return null;
 const locationMatches=(value,depth=0)=>{if(value==null)return true;if(depth>3||list(value).length!==1)return false;const p=resolve(list(value)[0]);if(!object(p)||!addressMatches(p.address)||!addressMatches(p))return false;return locationMatches(p.location,depth+1);};
 if(!locationMatches(root.location)||linkedSupplement&&nodes.some(n=>!addressMatches(n)||!addressMatches(n.address)||!locationMatches(n.location)))return null;
 const providerMatches=value=>{
  if(value==null)return true;const providers=list(value);if(providers.length!==1)return false;
  const p=resolve(providers[0]);if(typeof p==='string')return p===root['@id']||documentURL(p)===documentURL(url);
  if(!object(p)||!addressMatches(p.address)||!locationMatches(p.location))return false;if(p.name&&norm(p.name)!==norm(root.name))return false;
  return p===root||p['@id']&&p['@id']===root['@id']||!!p.name&&norm(p.name)===norm(root.name)&&(!p.url||documentURL(p.url)===documentURL(url));
 };
 return {root,nodes,resolve,providerMatches,identity};
}
// Server-projected canonical fields alone establish the branch comparison.
export function structuredSourceContextMatches(html,row,url,{linkedSupplement=false}={}){
 if(typeof row?.city!=='string'||!row.city.trim()||typeof row?.country!=='string'||!row.country.trim())return false;
 if(linkedSupplement){try{if(new URL(url).origin!==new URL(row.website).origin)return false;}catch{return false;}}
 return !!structuredContext(html,row,linkedSupplement?row.website:url,{linkedSupplement,linkedDocumentURL:url});
}
export async function extractStructuredServices(html,row,url){
 const context=structuredContext(html,row,url);if(!context)return null;
 const {root,nodes,resolve,providerMatches,identity}=context;
 const services=[],seen=new Map(),work=[];let visited=0;const visitedObjects=new Set();
 for(const key of['hasOfferCatalog','makesOffer','offers'])if(root[key])work.push({value:root[key],owned:true});
 // A separate graph Service needs its own explicit matching provider; proximity
 // to an organization or a review is never an ownership relationship.
 for(const n of nodes)if(typed(n,'Service')&&n.provider!=null)work.push({value:n,owned:false});
 while(work.length&&visited++<300){const {value,owned}=work.shift();if(Array.isArray(value)){if(value.length>100)return null;work.push(...value.map(v=>({value:v,owned})));continue;}
  const node=resolve(value);if(!object(node))return null;if(visitedObjects.has(node))continue;visitedObjects.add(node);
  if(typed(node,'Service')){
   if(!owned&&node.provider==null||!providerMatches(node.provider)||['areaServed','serviceArea','location','availableAtOrFrom'].some(k=>node[k]!=null))return null;
   const name=text(node.name);if(!name||name.length>160)continue;const description=text(node.description).slice(0,500),key=norm(name);
   if(seen.has(key)){if(seen.get(key)!==description)return null;continue;}seen.set(key,description);services.push({name,description});
   if(services.length>30)return null;
  }else if(typed(node,'OfferCatalog')||typed(node,'Offer')||typed(node,'ListItem')){
   if(!providerMatches(node.seller)||!providerMatches(node.provider)||node.availableAtOrFrom!=null)return null;
   for(const key of['itemListElement','itemOffered','item','hasOfferCatalog'])if(node[key])work.push({value:node[key],owned});
  }
 }
 if(work.length||!services.length)return null;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html));
 return{services,source_url:url,source_sha256:Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join(''),method:'jsonld_owned_services',identity_verification:identity.verification,provider_identity:root.name,operational_connections_verified:false};
}

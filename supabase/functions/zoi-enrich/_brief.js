import { buildClientBrief, briefURL, briefBlocked } from '../../../assets/enrichment/client-brief.mjs';
import { inspectSourceDocument } from './_document-quality.js';
const normalized=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase():'';
/** Exact source-name evidence, not ownership/credential verification. A linked
 * publisher/partner/review node or ambiguous same-named node cannot qualify. */
export function sourceClientIdentity(row,html,url){
 if(typeof html!=='string'||html.length>1500000||!normalized(row?.name)||!briefURL(url))return null;
 if(inspectSourceDocument(html).source_state==='source_challenge'||/cf-chl-|\/cdn-cgi\/challenge-platform\//i.test(html))return null;
 const body=html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]||html;
 const visible=body.replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 if(visible.length<500&&/^(?:verify you are human|checking your browser|please wait while your request is being verified|one moment,? please|request (?:is )?being verified)(?:[.!…]|\s|$)/i.test(visible))return null;
 const organizations=['LocalBusiness','Restaurant','Bakery','CafeOrCoffeeShop','Store','Hotel','LodgingBusiness','Church','Organization','School','NGO','SportsTeam'];
 const types=row.entity_type==='artist'?['Person','MusicGroup']:row.entity_type==='creator'?['Person']:row.entity_type==='professional'?['Person','Physician','Dentist','Attorney','ProfessionalService']:organizations;
 const entityTypes=[...new Set([...organizations,'Person','Physician','Dentist','Attorney','ProfessionalService','MusicGroup'])];
 const queue=[];for(const tag of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{queue.push(JSON.parse(tag[1]));}catch{}}
 const candidates=[];let count=0;
 while(queue.length&&count++<1000){
  const node=queue.shift();if(Array.isArray(node)){if(node.length>100)return null;queue.push(...node);continue;}if(!node||typeof node!=='object')continue;
  const nodeTypes=(Array.isArray(node['@type'])?node['@type']:[node['@type']]).map(t=>String(t).replace(/^https?:\/\/schema.org\//,''));
  if(nodeTypes.some(t=>entityTypes.includes(t))){
   let scope=true;if(node.url){try{const a=new URL(node.url),b=new URL(url);scope=briefURL(node.url)&&a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&a.pathname.replace(/\/$/,'')===b.pathname.replace(/\/$/,'');}catch{scope=false;}}
   if(scope)candidates.push(node);
  }
  for(const key of ['@graph','mainEntity'])if(node[key])queue.push(node[key]);
 }
 if(queue.length||candidates.length!==1||normalized(candidates[0].name)!==normalized(row.name))return null;
 const sourceTypes=(Array.isArray(candidates[0]['@type'])?candidates[0]['@type']:[candidates[0]['@type']]).map(t=>String(t).replace(/^https?:\/\/schema.org\//,''));
 const compatible=sourceTypes.find(type=>types.includes(type));
 return {name:row.name,source_url:briefURL(url),schema_type:compatible||sourceTypes.find(type=>entityTypes.includes(type)),verification:compatible?'exact_name_typed_jsonld':'entity_family_review_required',expected_entity_type:row.entity_type,ownership_verified:false};
}
/** Merge only the machine namespace queued for enrich_apply. Owners remain in
 * their canonical content store; transient errors preserve the prior brief. */
export function prepareClientBrief(batch,queue,checkedAt=new Date().toISOString()){
 const rows=new Map(queue.map(row=>[row.slug,row]));
 let bytes=new TextEncoder().encode(JSON.stringify(batch)).byteLength;
 for(const result of batch){
  const row=rows.get(result.slug);
  if(!row||result.profile?.crawl_status==='error'||briefBlocked(result.profile))continue;
  const brief=buildClientBrief({listing:row,profile:result.profile,provenance:result.provenance,sourceURL:result.website,checkedAt,sources:result.source_evidence});
  if(!brief)continue;
  if(result.profile.client_brief)bytes-=new TextEncoder().encode(JSON.stringify(result.profile.client_brief)).byteLength;
  const extra=new TextEncoder().encode(JSON.stringify(brief)).byteLength+100;
  // Stay below enrich_apply's shared 2MB limit. Source data is retained; a
  // deferred brief is an explicit next action, never an individualized-home pass.
  result.profile.client_brief=bytes+extra<1950000?brief:{schema_version:1,status:'deferred_payload_limit',listing:brief.listing,source:brief.source,progress:{brief:'pending',acceptance:'not_reviewed'},next_action:'Prepare the client brief from the stored source fields in a smaller bounded batch.'};
  bytes+=new TextEncoder().encode(JSON.stringify(result.profile.client_brief)).byteLength+100;
  result.provenance.client_brief='deterministic_source_brief_v1';
 }
 return batch;
}

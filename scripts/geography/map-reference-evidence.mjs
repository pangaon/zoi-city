import {Buffer} from 'node:buffer';
import {sha256} from '../quality/evidence.mjs';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {wixDocumentParts} from './wix-business-location-evidence.mjs';
// Review support only. A map reference is neither a coordinate nor verified
// identity. Never follow it here or interpret a camera/CID as a point.
export const MAP_REFERENCE_LIMITS=Object.freeze({document:1500000,url:3000,occurrences:8,element:8192,report:16000});
const held=v=>v===true||v==='true';
const host=raw=>{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.hostname.replace(/^www\./,''):null;}catch{return null;}};
function sourceWithin(raw,website){try{const s=new URL(raw),w=new URL(website),base=w.pathname.replace(/\/$/,'');return host(raw)&&host(raw)===host(website)&&(!base||s.pathname===base||s.pathname.startsWith(base+'/'));}catch{return false;}}
function referenceShape(raw){try{const u=new URL(raw);return u.hostname==='goo.gl'&&u.pathname.startsWith('/maps/')?'shortlink':(['www.google.com','maps.google.com'].includes(u.hostname)&&u.pathname==='/maps/embed'?'embed':null);}catch{return null;}}
function classify(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>MAP_REFERENCE_LIMITS.url||/[\x00-\x20\\]/.test(raw))return null;
 let u;try{u=new URL(raw);}catch{return null;}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.href!==raw)return null;
 if(u.hostname==='goo.gl'&&/^\/maps\/[A-Za-z0-9]{1,100}$/.test(u.pathname)&&!u.search)return{kind:'opaque_shortlink_reference',url:raw};
 if(!['www.google.com','maps.google.com'].includes(u.hostname)||u.pathname!=='/maps/embed'||[...u.searchParams.keys()].length!==1||!u.searchParams.has('pb'))return null;
 const pb=u.searchParams.get('pb');if(!pb||/[\x00-\x1f\x7f]/.test(pb))return null;
 const ids=[...pb.matchAll(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)!2s([^!]{1,300})(?=!|$)/gi)];
 if(ids.length!==1||!ids[0][2].trim())return null;
 return{kind:'named_embed_reference',url:raw,unverified_place_reference:{id:ids[0][1],label:ids[0][2]}};
}
export function mapReferenceSupport(html,row,{sourceUrl=row?.website,httpStatus=200,snapshotSha256=null}={}){
 if(typeof html!=='string'||!row?.id||typeof row.name!=='string'||!row.name.trim()||row.public_eligible!==true||row.source_kind!=='official_website'||row.owner_managed||row.owner_user_id||row.owner_workspace_id||httpStatus!==200||!sourceWithin(sourceUrl,row.website)||!/^[a-f0-9]{64}$/.test(snapshotSha256||''))return null;
 const contexts=[row.source_context,row.profile?._enrich,row.enrichment].filter(v=>v&&typeof v==='object'&&!Array.isArray(v));
 if(contexts.some(e=>[e.source_scope_mismatch,e.scope_review_required,e.organization_identity_quarantine,e.blocked,e.source_challenge].some(held)||!!e.blocked_reason||e.source_kind==='association_member'||e.identity_scope==='organization'&&['artist','creator','professional'].includes(row.entity_type)))return null;
 const base={schema:1,kind:'official_map_reference_support',listing_id:row.id,source_url:sourceUrl,source_sha256:sha256(html),source_bytes:Buffer.byteLength(html),snapshot_sha256:snapshotSha256,authority:'none',writer_eligible:false,official_source_confirmed:false,country_verified:false,precision:'unverified',independent_review_required:true};
 const refuse=reason=>({...base,status:'held',reason});
 if(base.source_bytes>MAP_REFERENCE_LIMITS.document)return refuse('map_reference_document_limit');
 const quality=inspectSourceDocument(html);if(quality.source_state==='source_challenge'||quality.requires_rendering)return null;
 let parts;try{parts=wixDocumentParts(html);}catch{return refuse('map_reference_active_html_unclassified');}
 const observations=[...parts.frames.map(f=>({...f,url:f.src,element_kind:'iframe'})),...parts.anchors.filter(a=>a.visible).map(a=>({...a,url:a.href,element_kind:'anchor'}))].filter(o=>referenceShape(o.url)).sort((a,b)=>a.start-b.start);
 if(!observations.length)return null;
 if(observations.length>MAP_REFERENCE_LIMITS.occurrences)return refuse('map_reference_occurrence_limit');
 const references=[];
 for(const o of observations){
  const reference=classify(o.url);if(!reference)return refuse('map_reference_url_unclassified');
  const actualFrame=o.raw.slice(0,7).toLowerCase()==='<iframe'&&['\t','\n','\f','\r',' ','/','>'].includes(o.raw[7]);
  if(o.element_kind==='iframe'&&(!actualFrame||reference.kind!=='named_embed_reference')||o.element_kind==='anchor'&&reference.kind!=='opaque_shortlink_reference')return refuse('map_reference_element_role_unclassified');
  if(typeof o.raw!=='string'||Buffer.byteLength(o.raw)>MAP_REFERENCE_LIMITS.element)return refuse('map_reference_element_limit');
  const start=Buffer.byteLength(html.slice(0,o.start)),end=Buffer.byteLength(html.slice(0,o.end));
  if(html.slice(o.start,o.end)!==o.raw||end-start!==Buffer.byteLength(o.raw))return refuse('map_reference_occurrence_unclassified');
  references.push({...reference,occurrence:{start_byte:start,end_byte:end,sha256:sha256(o.raw)}});
 }
 const result={...base,status:references.length===1?'reference_review_required':'held',reason:references.length===1?'map_reference_requires_distinct_destination_review':'multiple_map_reference_occurrences_require_review',references};
 if(Buffer.byteLength(JSON.stringify(result))>MAP_REFERENCE_LIMITS.report)return refuse('map_reference_report_limit');
 return result;
}

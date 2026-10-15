/** Reviewed-only SSR evidence, reusing the deployed extractor and existing source guards.
 * This is source HTML, never a substitute or fabricated hash for a browser render. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {sourceURL,createSourceSession,requestPage} from '../quality/source-fetch.mjs';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {memberLeaseGuard} from '../../supabase/functions/zoi-enrich/_member.js';
import {assessMachineSourceIdentity} from '../../supabase/functions/zoi-enrich/_source-identity.js';
import {extractRenderedSource,extractorHash} from './extractor.mjs';
import {launchSourceBrowser} from './render-source.mjs';
import {canonical,sha256} from '../quality/evidence.mjs';
import {supplementaryPages} from '../../supabase/functions/zoi-enrich/_images.js';
import {sourceClientIdentity} from '../../supabase/functions/zoi-enrich/_brief.js';
import {structuredSourceContextMatches} from '../../supabase/functions/zoi-enrich/_services.js';

// The source cache changes strategy when its extraction, guards or runtime do.
// This explicit dependency list covers the capture helpers and their local imports;
// extractorHash separately includes the worker extraction body and seven helpers.
const recipeFiles=['./source-html.mjs','./extractor.mjs','./render-source.mjs','../quality/source-fetch.mjs','../quality/evidence.mjs','../../supabase/functions/zoi-enrich/_member.js','../../supabase/functions/zoi-enrich/_scope.js','../../supabase/functions/zoi-enrich/_source-identity.js','../../supabase/functions/zoi-enrich/_document-quality.js','../../supabase/functions/zoi-enrich/_brief.js','../../supabase/functions/zoi-enrich/_services.js','../../assets/enrichment/client-brief.mjs','../../assets/enrichment/member-source.mjs','../../assets/enrichment/association-cards.mjs'];
export const sourceHTMLRecipeHash=sha256(canonical({strategy:'reviewed-food-source-v1',node:process.versions.node,extractor_sha256:extractorHash,files:Object.fromEntries(recipeFiles.map(file=>[file,sha256(readFileSync(new URL(file,import.meta.url)))]))}));
const MAX_PIXELS=20000000;
const publicHTML=html=>html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\s(?:on[a-z]+|value)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
const dimensions=(width,height)=>{if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>12000||height>12000||width*height>MAX_PIXELS)throw Error('source_image_dimensions');return{width,height};};
/** Inspect dimensions BEFORE allocation/decoding. Deliberately JPEG/PNG only initially. */
export function rasterHeader(bytes,mime){
 const b=Buffer.from(bytes);mime=String(mime).split(';')[0].trim().toLowerCase();
 if(b.length>8000000)throw Error('source_image_too_large');
 if(mime==='image/png'){
  if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.readUInt32BE(8)!==13||b.toString('ascii',12,16)!=='IHDR')throw Error('source_image_invalid');
  return{mime,...dimensions(b.readUInt32BE(16),b.readUInt32BE(20))};
 }
 if(mime==='image/jpeg'){
  if(b.length<4||b[0]!==255||b[1]!==216)throw Error('source_image_invalid');
  let p=2;while(p<b.length){if(b[p++]!==255)throw Error('source_image_invalid');while(b[p]===255)p++;const marker=b[p++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;if(p+2>b.length)break;const n=b.readUInt16BE(p);if(n<2||p+n>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(n<8)break;return{mime,...dimensions(b.readUInt16BE(p+5),b.readUInt16BE(p+3))};}p+=n;}
  throw Error('source_image_invalid');
 }
 throw Error('source_image_unsupported');
}
async function bounded(deadline,fn,onLate=null){
 const left=deadline-Date.now();if(left<=0)throw Error('source_time_budget');let timer,expired=false;
 const operation=Promise.resolve().then(fn);operation.then(value=>{if(expired)Promise.resolve(onLate?.(value)).catch(()=>{});},()=>{});
 try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('source_time_budget'));},left);})]);}finally{clearTimeout(timer);}
}
// Teardown has a separate 2s grace; network remains offline/guarded and no new fetch starts.
async function closeDecoder(decoder){if(!decoder)return;let timer;try{await Promise.race([Promise.resolve().then(()=>decoder.close()).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,2000);})]);}finally{clearTimeout(timer);}}
async function offlineDecoder(options,deadline){
 const browser=await bounded(deadline,()=>launchSourceBrowser(options),b=>b.close());let context;
 try{
  context=await bounded(deadline,()=>browser.newContext({serviceWorkers:'block',acceptDownloads:false,offline:true}));
  await bounded(deadline,()=>context.route('**/*',route=>route.abort()));
  await bounded(deadline,()=>context.routeWebSocket('**/*',socket=>socket.close()));
  const page=await bounded(deadline,()=>context.newPage());
  await bounded(deadline,()=>page.goto('about:blank'));
  return{async decode(bytes,mime){return bounded(Math.min(deadline,Date.now()+4000),()=>page.evaluate(async({base64,mime})=>{const raw=atob(base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:mime}));try{return{width:bitmap.width,height:bitmap.height};}finally{bitmap.close();}},{base64:bytes.toString('base64'),mime}));},async close(){await Promise.allSettled([context.close(),browser.close()]);}};
 }catch(e){await closeDecoder({close:()=>Promise.allSettled([context?.close(),browser.close()])});throw e;}
}
async function retainImage(directory,hash,bytes){
 await mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,hash+'.image');
 try{await writeFile(file,bytes,{flag:'wx',mode:0o400});}catch(e){if(e.code!=='EEXIST'||sha256(await readFile(file))!==hash)throw Error('source_image_artifact_mismatch');}
}
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const foodSourceHeld=(prior,website)=>{
 const flagged=value=>value===true||value==='true';
 if(flagged(prior.blocked)||prior.status==='blocked'||['blocked','error'].includes(prior.crawl_status)||prior.blocked_reason==='source_scope_mismatch'||['scope_review_required','organization_identity_quarantine','source_scope_mismatch','source_challenge','challenge'].some(key=>flagged(prior[key]))||prior.identity_scope||prior.member||prior.association_member||prior.source_affiliation||['association_directory','association_member','supporting_publisher_profile'].includes(prior.source_kind))return true;
 const document=value=>{try{const url=new URL(value);return url.protocol+'//'+url.hostname.replace(/^www\./,'')+url.pathname.replace(/\/$/,'')+url.search;}catch{return null;}};
 if(prior.source_url)return !document(prior.source_url)||document(prior.source_url)!==document(website);
 return Object.keys(prior).some(key=>!['lease','_lease_source_context','provenance','checked_at','last_attempt_at','status','crawl_status'].includes(key));
};
const foodFields=['menu','menu_source','menu_source_format','menu_total_items','menu_truncated'];
async function retainSourceDocument(directory,html){
 const hash=sha256(html),file=path.join(directory,hash+'.source.html');
 await mkdir(directory,{recursive:true,mode:0o700});
 try{await writeFile(file,html,{flag:'wx',mode:0o400});}catch(error){if(error.code!=='EEXIST'||sha256(await readFile(file))!==hash)throw Error('source_document_artifact_mismatch');}
 return hash;
}
// Reviewed food evidence uses the same canonical branch context and structured
// identity checks as the worker. A linked page cannot lend another branch's menu.
async function captureFoodOffering(row,source,extracted,{directory,session,deadline}){
 const linked=supplementaryPages(source.text,source.url).find(page=>page.purpose==='menu');
 if(!extracted.profile.menu&&!linked)return null;
 const prior=object(row.existing_enrich),context=object(prior._lease_source_context);
 const unresolved=reason=>({state:'unresolved',reason,customer_journey_verified:false});
 if(row.owner_managed!==false||row.owner_workspace_id)return unresolved('owner_review_required');
 if(foodSourceHeld(prior,row.website))return unresolved('source_hold_review_required');
 const client={...row,city:context.city,country:context.country,address:context.address};
 const identity=sourceClientIdentity(client,source.text,source.url);
 if(identity?.verification!=='exact_name_typed_jsonld'||!structuredSourceContextMatches(source.text,client,source.url))return unresolved('source_identity_or_branch_unconfirmed');
 await bounded(deadline,()=>retainSourceDocument(directory,source.text));
 let document=source,fields=extracted.profile;
 if(!fields.menu&&linked){
  const target=sourceURL(linked.url);
  const response=await bounded(deadline,()=>session.sourceFetch(target.href));
  if(response.status!==200)return unresolved('menu_source_unavailable');
  const final=sourceURL(response.url);
  if(final.origin!==new URL(source.url).origin)return unresolved('menu_source_origin_changed');
  if(typeof response.text!=='string'||Buffer.byteLength(response.text)>1500000)return unresolved('menu_source_too_large');
  const quality=inspectSourceDocument(response.text);
  if(quality.source_state==='source_challenge'||quality.requires_rendering||/cf-chl-|\/cdn-cgi\/challenge-platform\//i.test(response.text))return unresolved('menu_source_unavailable');
  if(!structuredSourceContextMatches(response.text,client,final.href,{linkedSupplement:true}))return unresolved('menu_branch_unconfirmed');
  document={...response,url:final.href};fields=extractRenderedSource(response.text,final.href).profile;
 }
 const hasMenu=Array.isArray(fields.menu)&&fields.menu.length>0;
 if(!hasMenu&&!linked)return unresolved('menu_items_unavailable');
 const hash=await bounded(deadline,()=>retainSourceDocument(directory,document.text)),retained=hasMenu?fields.menu.reduce((n,section)=>n+(Array.isArray(section.items)?section.items.length:0),0):0;
 const total=Number.isInteger(fields.menu_total_items)?fields.menu_total_items:null;
 return{state:'captured_pending_review',source_url:document.url,source_sha256:hash,hash_basis:'decoded_utf8',linked_from_sha256:sha256(source.text),primary_source_url:source.url,primary_identity:identity,canonical_context:context,kind:hasMenu?'structured_menu':'menu_handoff',menu_sha256:hasMenu?sha256(canonical(fields.menu)):null,source_format:hasMenu?fields.menu_source_format:'source_document_handoff',original_total:total,retained_items:retained,truncated:typeof fields.menu_truncated==='boolean'?fields.menu_truncated:null,total_state:total===null?'unreported_by_extractor':'observed',retrieved_at:new Date().toISOString(),profile:hasMenu?Object.fromEntries(foodFields.filter(key=>Object.hasOwn(fields,key)).map(key=>[key,fields[key]])):{menu_url:document.url},customer_journey_verified:false};
}
export async function captureSourceHTML(row,{directory,session=null,timeoutMs=40000,executablePath=process.env.CHROMIUM_EXECUTABLE_PATH,launch,decoderFactory=offlineDecoder}={}){
 if(!directory)throw Error('source_image_directory_required');
 if(!/^[0-9a-f-]{36}$/i.test(row?.listing_id||row?.id||''))throw Error('invalid_listing_identity');
 if(!row?.source_fingerprint||typeof row.source_fingerprint!=='string'||!row.source_fingerprint.trim())throw Error('source_capture_fingerprint_missing');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>40000)throw Error('source_time_budget');
 if(memberLeaseGuard(row).handled)throw Error('source_identity_scope_review');
 const publisher=row.source_scope==='record_label';
 if(publisher&&(row.entity_type!=='artist'||row.source_kind!=='label_artist_profile'||!row.name?.trim()))throw Error('publisher_identity_required');
 if(row.source_scope&&!['official_site','record_label'].includes(row.source_scope))throw Error('source_scope_unsupported');
 const url=sourceURL(row.website),deadline=Date.now()+timeoutMs;let imagePhase=false;
 session ||=createSourceSession({maxRequests:80,maxBytes:15000000,deadline,request:(target,limits)=>requestPage(target,{maxBytes:Math.min(!imagePhase||new URL(target).pathname==='/robots.txt'?1500000:8000000,limits.maxBytes),timeout:limits.timeout,onBytes:limits.onBytes})});
 const source=await bounded(deadline,()=>session.sourceFetch(url.href));
 if(source.status!==200)throw Error('source_http_'+source.status);
 if(Buffer.byteLength(source.text)>1500000)throw Error('source_too_large');
 const quality=inspectSourceDocument(source.text);
 if(quality.source_state==='source_challenge'||/cf-chl-/i.test(source.text))throw Error('source_challenge');
 if(quality.requires_rendering)throw Error('javascript_render_required');
 if(quality.visible_text_length<100)throw Error('source_html_sparse');
 const final=sourceURL(source.url);if(publisher&&(final.origin!==url.origin||final.pathname.replace(/\/$/,'')!==url.pathname.replace(/\/$/,'')))throw Error('publisher_source_path_changed');if(final.hostname.replace(/^www\./,'')!==url.hostname.replace(/^www\./,''))throw Error('source_cross_host_navigation');
 if(memberLeaseGuard(row,source.text,source.url).handled)throw Error('source_identity_scope_review');
 const extracted=extractRenderedSource(source.text,source.url),title=(source.text.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||'').replace(/<[^>]+>/g,' ').trim();
 if(extracted.aggregator||assessMachineSourceIdentity({website:row.website,finalUrl:source.url,name:row.name,title,description:extracted.profile.description}).outcome!=='continue')throw Error('source_identity_scope_review');
 const profile=Object.fromEntries(['description','tagline','phone','email','social','site_lang','rooms','dining','venues','amenities'].filter(k=>extracted.profile[k]!=null&&extracted.profile[k]!==''&&(!(typeof extracted.profile[k]==='object')||Object.keys(extracted.profile[k]).length)).map(k=>[k,extracted.profile[k]]));
 // Preserve an explicit machine-contact quarantine; absence is not a clear.
 if(extracted.profile.email_conflict){profile.email=null;profile.email_conflict=extracted.profile.email_conflict;}
 else if(extracted.profile.email_conflict===null&&typeof profile.email==='string'&&/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(profile.email))profile.email_conflict=null;
 if(publisher){for(const key of Object.keys(profile))if(!['description','tagline','site_lang'].includes(key))delete profile[key];profile.source_kind='label_artist_profile';const spotify=extracted.profile.listen?.spotify;try{const u=new URL(spotify);if(u.protocol==='https:'&&u.hostname==='open.spotify.com'&&!u.username&&!u.password&&/^\/artist\/[A-Za-z0-9]{22}\/?$/.test(u.pathname))profile.listen={spotify:'https://open.spotify.com'+u.pathname.replace(/\/$/,'')};}catch{}}
 const food=publisher?null:await captureFoodOffering(row,source,extracted,{directory,session,deadline});
 if(food?.state==='captured_pending_review')Object.assign(profile,food.profile);
 let candidates=[...new Set(extracted.profile.photo_urls||[])].slice(0,4);
 if(publisher&&row.publisher_photo_urls!==undefined){if(!Array.isArray(row.publisher_photo_urls)||!row.publisher_photo_urls.length||row.publisher_photo_urls.length>4||new Set(row.publisher_photo_urls).size!==row.publisher_photo_urls.length||row.publisher_photo_urls.some(url=>!(extracted.profile.photo_urls||[]).includes(url)))throw Error('publisher_photo_not_in_source');candidates=row.publisher_photo_urls;}
 const images=[],rejected=[];let decoder;
 imagePhase=true;
 try{for(const candidate of candidates){
   try{
    const imageURL=sourceURL(candidate);const response=await bounded(deadline,()=>session.sourceFetch(imageURL.href));
    if(response.status!==200)throw Error('source_image_http');
    const actualURL=sourceURL(response.url);if(actualURL.hostname.replace(/^www\./,'')!==imageURL.hostname.replace(/^www\./,''))throw Error('source_image_redirect');
    const bytes=Buffer.from(response.body||[]),header=rasterHeader(bytes,response.headers?.['content-type']);
    if(header.width<160||header.height<120||header.width*header.height<60000)throw Error('source_image_dimensions');
    decoder ||=await bounded(deadline,()=>decoderFactory({executablePath,...(launch?{launch}:{})},deadline),d=>d.close());
    const decoded=await bounded(deadline,()=>decoder.decode(bytes,header.mime));
    if(decoded.width!==header.width||decoded.height!==header.height)throw Error('source_image_dimensions');
    const hash=sha256(bytes);await bounded(deadline,()=>retainImage(directory,hash,bytes));
    images.push({url:imageURL.href,final_url:sourceURL(response.url).href,sha256:hash,mime:header.mime,bytes:bytes.length,width:decoded.width,height:decoded.height,role:'photo'});
   }catch(e){if(Date.now()>=deadline||e.message==='source_time_budget')throw Error('source_time_budget');rejected.push({url:candidate,reason:/^source_image_[a-z_]+$/.test(e.message)?e.message:'source_image_unavailable'});}
  }
 }finally{await closeDecoder(decoder);}
 if(images.length){profile.photo_urls=images.map(x=>x.url);profile.hero_url=images[0].url;profile.photo_url=images[0].url;}
 if(!profile.menu?.length&&!profile.menu_url&&!profile.phone&&!profile.email&&!images.length&&!['rooms','dining','venues','amenities'].some(k=>profile[k]?.length)&&String(profile.description||'').length<80)throw Error('source_html_no_useful_fields');
 return{schema:2,capture_kind:'source_html',capture_recipe_sha256:sourceHTMLRecipeHash,source_scope:publisher?'record_label':'official_site',...(publisher?{publisher_identity:{listing_id:row.listing_id||row.id,name:row.name,source_url:source.url,kind:'label_artist_profile'}}:{}),listing_id:row.listing_id||row.id,website:row.website,source_fingerprint:row.source_fingerprint,html:publicHTML(source.text),collected_at:new Date().toISOString(),review_required:true,render:null,source:{url:source.url,title,http_status:source.status,sha256:sha256(source.text),...quality},extractor_sha256:extractorHash,profile,...(food?{food_offering:Object.fromEntries(Object.entries(food).filter(([key])=>key!=='profile'))}:{}),images,rejected_images:rejected,network:{...session.stats},aggregator:false,provenance:Object.fromEntries(Object.keys(profile).map(k=>[k,'official-source-html:'+source.url]))};
}

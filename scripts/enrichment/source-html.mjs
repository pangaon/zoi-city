/** Reviewed-only SSR evidence, reusing the deployed extractor and existing source guards.
 * This is source HTML, never a substitute or fabricated hash for a browser render. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {sourceURL,createSourceSession,requestPage} from '../quality/source-fetch.mjs';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {memberLeaseGuard} from '../../supabase/functions/zoi-enrich/_member.js';
import {assessMachineSourceIdentity} from '../../supabase/functions/zoi-enrich/_source-identity.js';
import {extractRenderedSource,extractorHash} from './extractor.mjs';
import {launchSourceBrowser} from './render-source.mjs';
import {sha256} from '../quality/evidence.mjs';

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
export async function captureSourceHTML(row,{directory,session=null,timeoutMs=40000,executablePath=process.env.CHROMIUM_EXECUTABLE_PATH,launch,decoderFactory=offlineDecoder}={}){
 if(!directory)throw Error('source_image_directory_required');
 if(!/^[0-9a-f-]{36}$/i.test(row?.listing_id||row?.id||''))throw Error('invalid_listing_identity');
 if(!row?.source_fingerprint||typeof row.source_fingerprint!=='string'||!row.source_fingerprint.trim())throw Error('source_capture_fingerprint_missing');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>40000)throw Error('source_time_budget');
 if(memberLeaseGuard(row).handled)throw Error('source_identity_scope_review');
 const url=sourceURL(row.website),deadline=Date.now()+timeoutMs;let imagePhase=false;
 session ||=createSourceSession({maxRequests:80,maxBytes:15000000,deadline,request:(target,limits)=>requestPage(target,{maxBytes:Math.min(!imagePhase||new URL(target).pathname==='/robots.txt'?1500000:8000000,limits.maxBytes),timeout:limits.timeout,onBytes:limits.onBytes})});
 const source=await bounded(deadline,()=>session.sourceFetch(url.href));
 if(source.status!==200)throw Error('source_http_'+source.status);
 if(Buffer.byteLength(source.text)>1500000)throw Error('source_too_large');
 const quality=inspectSourceDocument(source.text);
 if(quality.source_state==='source_challenge'||/cf-chl-/i.test(source.text))throw Error('source_challenge');
 if(quality.requires_rendering)throw Error('javascript_render_required');
 if(quality.visible_text_length<100)throw Error('source_html_sparse');
 const final=sourceURL(source.url);if(final.hostname.replace(/^www\./,'')!==url.hostname.replace(/^www\./,''))throw Error('source_cross_host_navigation');
 if(memberLeaseGuard(row,source.text,source.url).handled)throw Error('source_identity_scope_review');
 const extracted=extractRenderedSource(source.text,source.url),title=(source.text.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||'').replace(/<[^>]+>/g,' ').trim();
 if(extracted.aggregator||assessMachineSourceIdentity({website:row.website,finalUrl:source.url,name:row.name,title,description:extracted.profile.description}).outcome!=='continue')throw Error('source_identity_scope_review');
 const profile=Object.fromEntries(['description','tagline','phone','email','social','site_lang'].filter(k=>extracted.profile[k]!=null&&extracted.profile[k]!==''&&(!(typeof extracted.profile[k]==='object')||Object.keys(extracted.profile[k]).length)).map(k=>[k,extracted.profile[k]]));
 // Preserve an explicit machine-contact quarantine; absence is not a clear.
 if(extracted.profile.email_conflict){profile.email=null;profile.email_conflict=extracted.profile.email_conflict;}
 else if(extracted.profile.email_conflict===null&&typeof profile.email==='string'&&/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(profile.email))profile.email_conflict=null;
 const candidates=[...new Set(extracted.profile.photo_urls||[])].slice(0,4),images=[],rejected=[];let decoder;
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
 if(!profile.phone&&!profile.email&&!images.length&&String(profile.description||'').length<80)throw Error('source_html_no_useful_fields');
 return{schema:2,capture_kind:'source_html',source_scope:'official_site',listing_id:row.listing_id||row.id,website:row.website,source_fingerprint:row.source_fingerprint,html:publicHTML(source.text),collected_at:new Date().toISOString(),review_required:true,render:null,source:{url:source.url,title,http_status:source.status,sha256:sha256(source.text),...quality},extractor_sha256:extractorHash,profile,images,rejected_images:rejected,network:{...session.stats},aggregator:false,provenance:Object.fromEntries(Object.keys(profile).map(k=>[k,'official-source-html:'+source.url]))};
}

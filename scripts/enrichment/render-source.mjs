import {sourceURL,createSourceSession,requestPage} from '../quality/source-fetch.mjs';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {extractRenderedSource,extractorHash} from './extractor.mjs';
import {sha256} from '../quality/evidence.mjs';

export async function launchSourceBrowser({executablePath=process.env.CHROMIUM_EXECUTABLE_PATH,launch=async options=>(await import('playwright-core')).chromium.launch(options)}={}){
 try{return await launch({headless:true,chromiumSandbox:true,env:Object.fromEntries(['PATH','HOME','TMPDIR','XDG_RUNTIME_DIR','DISPLAY','NODE_EXTRA_CA_CERTS'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),...(executablePath?{executablePath}:{}),args:['--disable-background-networking','--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--disable-features=WebTransport']});}catch(error){error.source_stage='browser_launch';throw error;}
}
export async function verifySourceBrowser(options={}){const browser=await launchSourceBrowser(options);const browserVersion=browser.version?.()||'unknown';try{const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();await page.goto('about:blank');await context.close();}finally{await browser.close();}return {sandbox:true,external_page_requests:0,browser_version:browserVersion};}
export function allowedRenderRequest(request){return request.method()==='GET'&&['document','script','stylesheet','xhr','fetch','image'].includes(request.resourceType());}
/** Browser HTTP/WebSocket interception: every page HTTP request is fulfilled through the shared
 * DNS-pinned public-only fetcher and robots gate. No browser cookies/auth forwarded.
 * Per run: max80requests,1.5MB documents/scripts and8MB image files,1s host spacing,40s render budget, no audio/video loads; images use the same public-only byte guards.
 */
export async function renderOfficialSource(row,{executablePath=process.env.CHROMIUM_EXECUTABLE_PATH,launch=async options=>(await import('playwright-core')).chromium.launch(options),session=null,timeoutMs=40000}={}){
 const url=sourceURL(row.website);const deadline=Date.now()+timeoutMs;
 session ||=createSourceSession({maxRequests:80,maxBytes:15000000,deadline,request:(url,limits)=>requestPage(url,{maxBytes:Math.min(/\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(new URL(url).pathname)?8000000:1500000,limits.maxBytes),timeout:limits.timeout,onBytes:limits.onBytes})});
 const source=await session.sourceFetch(url.href);
 if(source.status!==200)throw Error('source_http_'+source.status);
 if(inspectSourceDocument(source.text).source_state==='source_challenge'||/cf-chl-|checking your browser|verify you are human/i.test(source.text))throw Error('source_challenge');
 const browser=await launchSourceBrowser({executablePath,launch});
 let context;let pending=0;const blocked=[];const requested=[];
 try{
  context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false,viewport:{width:1440,height:1000},userAgent:'ZoiQualityBot/1.0 (+https://www.zoi.city; permitted rendered-source audit)'});
  await context.routeWebSocket('**/*',socket=>socket.close());
  await context.route('**/*',async route=>{
   const req=route.request();if(!allowedRenderRequest(req)||Date.now()>deadline||session.stats.bytes>15000000)return route.abort();
   pending++;const resource={type:req.resourceType(),url:req.url().split('?')[0]};requested.push(resource);
   try{const target=sourceURL(req.url());if(req.resourceType()==='document'&&target.hostname.replace(/^www\./,'')!==url.hostname.replace(/^www\./,''))throw Error('source_cross_host_navigation');
    const response=target.href===source.url?source:await session.sourceFetch(target.href);
    resource.status=response.status;resource.bytes=response.bytes;resource.content_type=response.headers?.['content-type']||'';
    await route.fulfill({status:response.status,headers:{'content-type':response.headers?.['content-type']||'text/plain'},body:response.body||response.text});
   }catch(error){blocked.push(/^[a-z_0-9]+$/i.test(error.message)?error.message:'resource_unavailable');await route.abort().catch(()=>{});}finally{pending--;}
  });
  const page=await context.newPage();await page.goto(source.url,{waitUntil:'domcontentloaded',timeout:Math.min(timeoutMs,30000)});
  await page.waitForFunction(()=>{const root=document.querySelector('#root,#__next,#__nuxt,#app');return !root||root.innerText.trim().length>100;},{},{timeout:Math.min(12000,Math.max(1000,deadline-Date.now()))}).catch(()=>{});
  // A bounded settling period lets publicly loaded menus finish without networkidle
  // depending on advertising/analytics requests that may never settle.
  await page.waitForTimeout(Math.min(2000,Math.max(0,deadline-Date.now())));
  while(pending>0&&Date.now()<deadline)await page.waitForTimeout(250);
  await page.waitForTimeout(Math.min(750,Math.max(0,deadline-Date.now())));
  const snapshot=await page.evaluate(()=>({html:document.documentElement.outerHTML,url:location.href,title:document.title,text:document.body.innerText.slice(0,24000)}));
  if(Buffer.byteLength(snapshot.html)>1500000)throw Error('rendered_document_too_large');
  if(inspectSourceDocument(snapshot.html).source_state==='source_challenge')throw Error('source_challenge');
  if(inspectSourceDocument(snapshot.html).requires_rendering)throw Error('javascript_render_unresolved');
  const result=extractRenderedSource(snapshot.html,snapshot.url);
  // Only promote images whose actual public bytes loaded successfully. Broken CSS
  // references and image-loader placeholders never become the business hero.
  const loaded=new Set(requested.filter(r=>r.type==='image'&&r.status===200&&/^image\//i.test(r.content_type)).map(r=>r.url));
  if(result.profile.photo_urls){result.profile.photo_urls=result.profile.photo_urls.filter(u=>loaded.has(u.split('?')[0]));result.profile.hero_url=result.profile.photo_urls[0]||null;result.profile.photo_url=result.profile.hero_url;}
  if(result.profile.logo_url&&!loaded.has(result.profile.logo_url.split('?')[0]))delete result.profile.logo_url;
  if(result.profile.menu_image_urls)result.profile.menu_image_urls=result.profile.menu_image_urls.filter(u=>loaded.has(u.split('?')[0]));

  return{schema:1,listing_id:row.listing_id||row.id,website:row.website,collected_at:new Date().toISOString(),source:{url:source.url,http_status:source.status,sha256:sha256(source.text),...inspectSourceDocument(source.text)},render:{url:snapshot.url,title:snapshot.title,sha256:sha256(snapshot.html),text:snapshot.text,blocked_resource_reasons:[...new Set(blocked)],network:{...session.stats},requested_resources:requested.slice(0,80)},extractor_sha256:extractorHash,...result,html:snapshot.html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\s(?:on[a-z]+|value)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,''),review_required:true};
 }finally{await context?.close().catch(()=>{});await browser.close();}
}

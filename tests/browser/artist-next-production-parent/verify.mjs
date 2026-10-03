import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {renderMusicHome} from '../../../api/_music-home.js';
const root=resolve(import.meta.dirname,'../../..'),evidence=resolve(process.env.EVIDENCE_DIR||root+'/docs/audits/evidence/artist-next-production-parent-2026-10-02');
const directory=root+'/docs/audits/evidence/artist-next-batch-2026-10-02/packets';
const {readdir}=await import('node:fs/promises');
const packets={};for(const file of(await readdir(directory)).filter(f=>f.endsWith('-rollback.sql'))){const key=file.replace('-rollback.sql','');packets[key]=JSON.parse(await readFile(directory+'/'+key+'.json','utf8'));}
await mkdir(evidence,{recursive:true});
const origin='https://www.zoi.city',browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
const results=[],sourceImages=[];
for(const packet of Object.values(packets))for(const image of packet.images){const r=await fetch(image.url,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer()),sha=createHash('sha256').update(bytes).digest('hex');let decodedPixelsMatch=null;
if(sha!==image.sha256){
 const captured=resolve(root,'docs/audits/evidence/artist-next-batch-2026-10-02/portraits',packet.listing.id+'.jpg');
 assert.equal(createHash('sha256').update(await readFile(captured)).digest('hex'),image.sha256,'Captured approved image changed');
 const current=resolve(evidence,'current-'+packet.listing.id+'.jpg');await writeFile(current,bytes);
 decodedPixelsMatch=JSON.parse(execFileSync('python3',['-c',`from PIL import Image
import sys,json
a,b=Image.open(sys.argv[1]),Image.open(sys.argv[2])
print(json.dumps(a.size==b.size and a.convert('RGB').tobytes()==b.convert('RGB').tobytes()))`,captured,current],{encoding:'utf8'}));
 assert.equal(decodedPixelsMatch,true,'Publisher image content changed since independent approval');
}
sourceImages.push({id:packet.listing.id,url:image.url,bytes:bytes.length,sha256:sha,approvedByteSha256:image.sha256,exactBytesMatch:sha===image.sha256,decodedPixelsMatch,dimensions:image.dimensions});}
try{
 for(const width of[390,1440])for(const key of Object.keys(packets))for(const template of['canonical']){
  const packet=packets[key],context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],protectedRequests=[],publicReadResponses=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{const u=new URL(r.url());if(u.pathname.includes('/rest/v1/rpc/'))publicReadResponses.push({name:u.pathname.split('/').at(-1),status:r.status()});});
  await page.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(r.method()==='POST'&&u.pathname==='/rest/v1/rpc/inquiry_availability'){
    assert.deepEqual(r.postDataJSON(),{p_listing:packet.listing.id});return route.continue();
   }
   if(!['GET','HEAD'].includes(r.method())||/\/(?:auth|functions)\/v1\//.test(u.pathname)){protectedRequests.push({method:r.method(),url:r.url()});return route.abort();}
   if(u.hostname==='open.spotify.com'){external.push(r.url());return route.abort();}
   return route.continue();
  });
  const response=await page.goto(origin+'/artist/'+packet.listing.slug,{waitUntil:'networkidle',timeout:45000});assert.equal(response.status(),200);
  await page.getByRole('button',{name:'Open Spotify player',exact:true}).waitFor();
  assert.equal(await page.locator('iframe').count(),0,'Player loaded before explicit action');
  if(packet.proposed_machine_fields.description)assert.equal(await page.getByText(packet.proposed_machine_fields.description,{exact:true}).count()>0,true);
  for(const link of await page.locator('a').all()){
   const href=await link.getAttribute('href');if(href?.startsWith('https://open.spotify.com'))assert.equal(href,packet.proposed_machine_fields.listen.spotify);
  }
  await page.locator('.music-footer details').evaluate(el=>el.open=true);
  const source=page.locator('.music-footer').getByRole('link',{name:'Record label artist page',exact:true});
  assert.equal(await source.getAttribute('href'),packet.source_url);
  if(packet.images.length){
   const image=page.locator('.artist-portrait img');await image.waitFor();
   assert.equal(await image.evaluate((el,d)=>el.complete&&el.naturalWidth===d.width&&el.naturalHeight===d.height,packet.images[0].dimensions),true);
   await page.locator('[data-gallery]').first().click();const dialog=page.locator('dialog.music-dialog');await dialog.waitFor({state:'visible'});
   assert.equal(await dialog.locator('img').getAttribute('src'),packet.images[0].url);
   assert.equal(await dialog.getByRole('link',{name:'Credited image source ↗',exact:true}).getAttribute('href'),packet.source_url);
   await page.keyboard.press('Escape');assert.equal(await dialog.evaluate(el=>el.open),false);assert.equal(await dialog.locator('img').count(),0);
  }else{
   assert.equal(await page.locator('.artist-portrait img,[data-gallery]').count(),0,'Unapproved publisher image appeared');
   await page.getByText('Artist photograph unavailable',{exact:true}).waitFor({state:'attached'});
  }
  await page.screenshot({path:evidence+'/artist-'+key+'-'+template+'-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Open Spotify player',exact:true}).click();
  const iframe=page.locator('iframe');await iframe.waitFor({state:'attached'});
  const expected=packet.proposed_machine_fields.listen.spotify.replace('/artist/','/embed/artist/');assert.equal(await iframe.getAttribute('src'),expected);
  const compact=page.getByRole('button',{name:'Compact music player',exact:true}),expand=page.getByRole('button',{name:'Expand music player',exact:true});
  if(await expand.count())await expand.click();await compact.click();await expand.click();
  if(template==='concierge')await page.screenshot({path:evidence+'/blocked-provider-'+key+'-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'Close music player',exact:true}).click();assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);assert.deepEqual(protectedRequests,[]);
  results.push({key,width,template,qualifiedSpotify:expected,source:packet.source_url,portrait:packet.images[0]?.url||null,galleryOpenEscapeUnload:packet.images.length>0,sparsePortraitHonest:!packet.images.length,playerExplicitOpenCompactExpandClose:true,protectedRequests,publicReadResponses,pageErrors:errors,blockedExternal:external});
  await context.close();console.log('PASS production rendered artist',key,template,width);
 }
 await writeFile(evidence+'/rendered-journeys.json',JSON.stringify({results,sourceImages,hypotheticalMachineFields:false,actualPublicReadback:true,scope:'16 exact reviewed records; independent production apply receipt required before running',providerPlayback:'not exercised; Spotify iframe request blocked after explicit action',customerWrites:0},null,2)+'\n');
}finally{await browser.close();}

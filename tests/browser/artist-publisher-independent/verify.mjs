import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {renderMusicHome} from '../../../api/_music-home.js';
const root=resolve(import.meta.dirname,'../../..'),evidence=resolve(process.env.EVIDENCE_DIR||root+'/docs/audits/evidence/artist-publisher-independent-2026-10-02');
const directory=root+'/docs/audits/evidence/kakosaios';
const records=JSON.parse(await readFile(directory+'/ready-artist-records-refresh-2026-10-02.json','utf8')).rows;
const packets=Object.fromEntries(await Promise.all(['kakosaios','sabanis'].map(async key=>[key,JSON.parse(await readFile(directory+'/ready-packets-2026-10-02/'+key+'.json','utf8'))])));
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/artist'){
  const packet=packets[u.searchParams.get('key')];if(!packet)throw Error();
  const row=records.find(r=>r.row.id===packet.listing.id).row;
  const entity={...row,website:packet.source_url,source_url:packet.source_url,profile:{...row.profile,_enrich:{...packet.proposed_machine_fields,source_url:packet.source_url,checked_at:'2026-10-02'}}};
  res.setHeader('Content-Type','text/html');return res.end(renderMusicHome(entity,{template:u.searchParams.get('template')}));
 }
 const file=resolve(root,'.'+u.pathname);if(!file.startsWith(root+'/'))throw Error();
 res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.statusCode=404;res.end();}});
await mkdir(evidence,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
const results=[];
try{
 for(const width of[390,1440])for(const key of['kakosaios','sabanis'])for(const template of['atelier','concierge','table','parea']){
  const packet=packets[key],context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],protectedRequests=[],publicReadFixtures=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(r.method()==='POST'&&u.pathname==='/rest/v1/rpc/inquiry_availability'){
    assert.deepEqual(r.postDataJSON(),{p_listing:packet.listing.id});publicReadFixtures.push({name:'inquiry_availability',listing:packet.listing.id,controlledUnavailable:true});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,available:false})});
   }
   if(r.method()!=='GET'||/\/(?:rest|auth|functions)\/v1\//.test(u.pathname)){protectedRequests.push({method:r.method(),url:r.url()});return route.abort();}
   if(u.origin===origin)return route.continue();
   const portrait=packets.kakosaios.images[0].url;
   if(r.url()===portrait)return route.fulfill({contentType:'image/jpeg',body:await readFile(evidence+'/kakosaios-portrait.jpeg')});
   external.push(r.url());return route.abort();
  });
  await page.goto(origin+'/artist?key='+key+'&template='+template,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Open Spotify player',exact:true}).waitFor();
  assert.equal(await page.locator('iframe').count(),0,'Player loaded before explicit action');
  assert.equal(await page.getByText(packet.proposed_machine_fields.description,{exact:true}).count()>0,true);
  for(const link of await page.locator('a').all()){
   const href=await link.getAttribute('href');if(href?.startsWith('https://open.spotify.com'))assert.equal(href,packet.proposed_machine_fields.listen.spotify);
  }
  await page.locator('.music-footer details').evaluate(el=>el.open=true);
  const source=page.locator('.music-footer').getByRole('link',{name:'Record label artist page',exact:true});
  assert.equal(await source.getAttribute('href'),packet.source_url);
  if(key==='kakosaios'){
   const image=page.locator('.artist-portrait img');await image.waitFor();
   assert.equal(await image.evaluate(el=>el.complete&&el.naturalWidth===1000&&el.naturalHeight===1000),true);
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
  results.push({key,width,template,qualifiedSpotify:expected,source:packet.source_url,portrait:packet.images[0]?.url||null,galleryOpenEscapeUnload:key==='kakosaios',sparsePortraitHonest:key==='sabanis',playerExplicitOpenCompactExpandClose:true,protectedRequests,publicReadFixtures,pageErrors:errors,blockedExternal:external});
  await context.close();console.log('PASS independent local rendered artist',key,template,width);
 }
 await writeFile(evidence+'/rendered-journeys.json',JSON.stringify({results,hypotheticalMachineFields:true,actualPublicReadback:false,providerPlayback:'not exercised; external provider requests blocked',customerWrites:0},null,2)+'\n');
}finally{await browser.close();await new Promise(r=>server.close(r));}

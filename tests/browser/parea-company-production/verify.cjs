const {chromium}=require('playwright-core');
const fs=require('node:fs/promises'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
(async()=>{
 const manifest=JSON.parse(await fs.readFile(process.env.RELEASE_ARTIFACTS||'/tmp/zoi-parea-production-manifest.json'));
 const result={commit:manifest.commit,deployment:manifest.deployment,artifacts:[],redirects:[],journeys:[]};
 // Compare published bytes with immutable main, not concurrent specialist work.
 for(const asset of manifest.artifacts){
  const response=await fetch('https://www.zoi.city/'+asset.file,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,asset.file);
  const body=await response.text();const sourceHash=crypto.createHash('sha256').update(execFileSync('git',['show',manifest.commit+':'+asset.file])).digest('hex');assert.equal(sourceHash,asset.sha256,asset.file+' immutable manifest');
  const sha256=crypto.createHash('sha256').update(body).digest('hex');assert.equal(sha256,asset.sha256);result.artifacts.push({...asset,exactMainBytes:true});
 }
 for(const entry of manifest.redirects||[]){const response=await fetch('https://www.zoi.city/'+entry.file,{redirect:'manual',signal:AbortSignal.timeout(15000)});assert([301,308].includes(response.status),entry.file+' permanent redirect');assert.equal(new URL(response.headers.get('location'),'https://www.zoi.city').pathname,entry.destination);result.redirects.push({...entry,status:response.status});}
 const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(request.method()!=='GET'||/\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\/|\/api\//.test(url.pathname)){requests.push({method:request.method(),path:url.pathname});return route.abort();}return route.continue();});
  await page.goto('https://www.zoi.city/tickets/hosts/?event=11111111-1111-4111-8111-111111111111',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.locator('[data-readiness],[data-form=grant],[data-roster]').count(),0);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/parea-production-signout-'+width+'.png'});result.journeys.push({width,entry:'Parea',signedOut:true,privateSurfaceAbsent:true,requests:[],pageErrors:[]});await page.close();
  const palette=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),paletteErrors=[];palette.on('pageerror',e=>paletteErrors.push(e.message));
  // Keyboard palette opens on the deployed homepage without submitting a customer query.
  await palette.goto('https://www.zoi.city/',{waitUntil:'domcontentloaded'});await palette.waitForFunction(()=>!!window.ZoiSearch);await palette.keyboard.press('Control+k');await palette.locator('.zk-input').waitFor({state:'visible'});assert.equal(await palette.locator('.zk-input').evaluate(e=>e===document.activeElement),true);await palette.keyboard.press('Escape');await palette.locator('.zk-input').waitFor({state:'hidden'});assert.equal(await palette.locator('.zk-input').isVisible(),false);assert.deepEqual(paletteErrors,[]);result.journeys.push({width,entry:'Homepage palette',keyboardOpenClose:true,pageErrors:[]});await palette.close();
 }}finally{await browser.close();}
 await fs.mkdir('docs/audits/evidence',{recursive:true});await fs.writeFile('docs/audits/evidence/parea-company-production-2026-10-02.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({commit:result.commit,artifacts:result.artifacts.length,journeys:result.journeys}));
})().catch(error=>{console.error(error);process.exitCode=1;});

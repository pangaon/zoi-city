const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const base=process.env.QA_SNAPSHOT,out=path.join(__dirname,'negative-journeys');if(!base)throw Error('QA_SNAPSHOT required');
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),f=path.resolve(base,'.'+u.pathname);if(!f.startsWith(base+path.sep)||!(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/tests/browser/source-health-owner/')))throw Error();res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(f));}catch{res.statusCode=404;res.end();}});
(async()=>{await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,report={snapshot:base,controlled:true,production:false,no_live_writes:true,cases:[]};let browser;
try{browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
for(const width of[390,1440])for(const scenario of['auth-wait-account','auth-wait-workspace','read-wait-account','read-wait-workspace','write-wait-account','write-wait-workspace','write-wait-remount','write-refusal','receipt-mismatch','optional-retry-account']){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());let optionalFail=scenario==='optional-retry-account',retryResolve,retryWaiting=false;
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();if(optionalFail&&u.pathname==='/assets/suite/source-health.mjs'&&!u.search){optionalFail=false;return route.fulfill({status:503,body:''});}if(scenario==='optional-retry-account'&&u.pathname==='/assets/suite/source-health.mjs'&&u.search){retryWaiting=true;await new Promise(r=>retryResolve=r);}return route.continue();});
 await page.goto(origin+'/tests/browser/source-health-owner/fixture.html');
 const panel=page.getByRole('region',{name:'Website and source review'}),input=page.getByLabel('Official website address');
 if(scenario==='optional-retry-account'){
  await page.getByRole('button',{name:'Retry website review'}).click();while(!retryWaiting)await new Promise(r=>setTimeout(r,10));await page.evaluate(()=>qa.actor='55555555-5555-4555-8555-555555555555');await page.getByText('Your account or workspace changed. Reopen Business home.',{exact:true}).waitFor();retryResolve();await page.waitForTimeout(100);assert.equal(await panel.count(),0);assert.equal(await page.evaluate(()=>qa.writes.length),0);
 }else{
 await panel.waitFor();await page.evaluate(()=>{qa.ctx={C,ws};qa.mount=()=>ZoiSuite.modules.find(x=>x.id==='bizpage').mount(document.querySelector('#root'),qa.ctx);return qa.mount();});await panel.waitFor();
 await input.fill('https://owner.example/independent');
 if(scenario.startsWith('auth-wait')){
  await page.evaluate(()=>{qa.entered=false;C.auth.ensureFresh=async()=>{qa.entered=true;return new Promise(r=>qa.release=r);};});await page.getByRole('button',{name:'Save page',exact:true}).click();await page.waitForFunction(()=>qa.entered);
 }else if(scenario.startsWith('read-wait')){
  await page.evaluate(()=>{const original=C.api.rpc;C.api.rpc=async(name,args)=>{const value=await original(name,args);if(name==='home_content_get'){qa.entered=true;await new Promise(r=>qa.release=r);}return value;};qa.mount();});await page.waitForFunction(()=>qa.entered);
 }else if(scenario.startsWith('write-wait')){
  await page.evaluate(()=>{const original=C.api.rpc;C.api.rpc=async(name,args)=>{const value=await original(name,args);if(name==='home_content_save'){qa.entered=true;await new Promise(r=>qa.release=r);}return value;};});await page.getByRole('button',{name:'Save page',exact:true}).click();await page.waitForFunction(()=>qa.entered);
 }else if(scenario==='write-refusal'){
  await page.evaluate(()=>qa.mode='refuse');await page.getByRole('button',{name:'Save page',exact:true}).click();await page.getByText('Save was refused: not authorized',{exact:true}).waitFor();assert.equal(await panel.getAttribute('data-source-state'),'import-held');assert.equal(await input.inputValue(),'https://owner.example/independent');assert.equal(await page.evaluate(()=>qa.owner_content.website),undefined);await page.getByRole('button',{name:'Save page',exact:true}).click();assert.equal(await page.evaluate(()=>qa.writes.length),1);
 }else if(scenario==='receipt-mismatch'){
  await page.evaluate(()=>{const original=C.api.rpc;C.api.rpc=async(name,args)=>{const value=await original(name,args);return name==='home_content_save'?{...value,listing_id:'99999999-9999-4999-8999-999999999999'}:value;};});await page.getByRole('button',{name:'Save page',exact:true}).click();await page.getByRole('button',{name:'Retry this save',exact:true}).waitFor();assert.equal(await panel.getAttribute('data-source-state'),'import-held');assert(await input.isDisabled());assert.equal(await page.getByText('Saved. Your page details and menu are updated.',{exact:true}).count(),0);
 }
 if(scenario.endsWith('account')||scenario.endsWith('workspace')){
  await page.evaluate(kind=>{if(kind==='workspace')qa.ctx.ws='66666666-6666-4666-8666-666666666666';else qa.actor='55555555-5555-4555-8555-555555555555';},scenario.endsWith('workspace')?'workspace':'account');
  await page.getByText('Your account or workspace changed. Reopen Business home.',{exact:true}).waitFor();await page.evaluate(()=>qa.release(true));await page.waitForTimeout(100);assert.equal(await panel.count(),0);assert.equal(await input.count(),0);assert.equal(await page.getByText('Saved. Your page details and menu are updated.',{exact:true}).count(),0);if(scenario.startsWith('auth-wait'))assert.equal(await page.evaluate(()=>qa.writes.length),0);
 }
 if(scenario==='write-wait-remount'){
  await page.evaluate(()=>{qa.base.website='https://new-snapshot.example/';qa.owner_content.website=qa.base.website;return qa.mount();});await panel.waitFor();assert.equal(await input.inputValue(),'https://new-snapshot.example/');await page.evaluate(()=>qa.release());await page.waitForTimeout(100);assert.equal(await input.inputValue(),'https://new-snapshot.example/');assert.equal(await panel.getAttribute('data-source-state'),'owner-url');assert.equal(await panel.getByText('https://owner.example/independent',{exact:true}).count(),0);
 }
 }
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:path.join(out,`${scenario}-${width}.png`),fullPage:true});report.cases.push({width,scenario,passed:true,errors});await page.close();
}
report.status='passed';}catch(error){report.status='failed';report.failure=error.stack;throw error;}finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}console.log(JSON.stringify({status:report.status,cases:report.cases.length}));})().catch(e=>{console.error(e);process.exitCode=1;});

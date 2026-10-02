const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const commit=process.env.RELEASE_COMMIT;
const origin=process.env.PRODUCTION_ORIGIN||'https://www.zoi.city';
const deployment=process.env.RELEASE_DEPLOYMENT;
const out=process.env.EVIDENCE_DIR||path.join(root,'docs/audits/evidence/service-installed-production-independent-2026-10-02');
const version='20261002-installed-service',event='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const artifacts=[
 ['social/index.html','/social/index.html'],['tickets/hosts/index.html','/tickets/hosts/index.html'],
 ...['service-menu.js','service-queue.js','workspace-navigation.mjs'].map(f=>['assets/suite/'+f,'/assets/suite/'+f+'?v='+version]),
 ...['event-service-client.mjs','event-service-configuration.mjs','event-service-order.mjs','event-service-session.mjs','service-capabilities.mjs','service-menu.mjs','service-queue.mjs'].map(f=>['assets/events/'+f,'/assets/events/'+f+'?v='+version]),
 ['assets/tickets/host-allocations.mjs','/assets/tickets/host-allocations.mjs?v=20261002-contextual-setup'],
 ['assets/tickets/host-allocations.css','/assets/tickets/host-allocations.css?v=20261002-contextual-setup'],
 ['assets/tickets/organizer-setup.mjs','/assets/tickets/organizer-setup.mjs?v=20261002-contextual-setup'],
 ['assets/community/session-state.mjs','/assets/community/session-state.mjs'],['assets/zoi-core.js','/assets/zoi-core.js']
];
const evidence={commit,deployment,origin,startedAt:new Date().toISOString(),sourceArtifacts:[],journeys:[],capabilityBoundary:{signedOutOnly:true,customerWrites:false,sends:false,onlinePaymentVerified:false,eventConfigurationVerified:false,authenticatedOperationsVerified:false}};
async function verifyPage(browser,width,kind,suffix){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();
 const pageErrors=[],consoleErrors=[],blocked=[],failedAssets=[],httpErrors=[],loaded=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 page.on('requestfailed',r=>{const u=new URL(r.url());if(u.origin===origin&&u.pathname.startsWith('/assets/'))failedAssets.push({path:u.pathname,error:r.failure()?.errorText});});
 page.on('response',r=>{const u=new URL(r.url());if(u.origin===origin){if(r.status()>=400)httpErrors.push({path:u.pathname,status:r.status()});if(u.pathname.startsWith('/assets/'))loaded.push(u.pathname+u.search);}});
 await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(!['GET','HEAD'].includes(r.method())||/\/(?:rest|auth|functions)\/v1\/|\/api\//.test(u.pathname)){blocked.push({method:r.method(),path:u.pathname});return route.abort();}return route.continue();});
 const target=kind.startsWith('social-')?'/social/'+kind.slice(7)+'?workspace='+workspace:'/tickets/hosts/'+suffix;
 try{
  const response=await page.goto(origin+target,{waitUntil:'networkidle',timeout:45000});assert.equal(response.status(),200,target);
  assert.equal(new URL(page.url()).origin,origin);
  if(kind.startsWith('social-')){
   await page.getByRole('button',{name:'Send my code',exact:true}).waitFor();
   assert.equal(await page.locator('#g-email[autocomplete="email"]').count(),1);
   const modules=await page.evaluate(()=>window.ZoiSuite.modules.map(m=>({id:m.id,label:m.label})));
   assert.equal(modules.some(m=>m.id==='service-menu'&&m.label==='Menu & bottles'),true);
   assert.equal(modules.some(m=>m.id==='service-queue'&&m.label==='Service queue'),true);
   assert.equal(await page.getByRole('button',{name:'Set up event service',exact:true}).count(),0);
   assert.equal(await page.getByRole('button',{name:'Manage event service',exact:true}).count(),0);
   assert.equal(await page.locator('.zevent-service,[data-event],[data-venue]').count(),0);
   assert.equal(await page.evaluate(()=>window.ZoiCore.auth.token()),null);
   evidence.journeys.push({kind,width,url:page.url(),signedOutGate:true,registeredServiceModules:modules.filter(m=>m.id.startsWith('service-'))});
  }else{
   await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
   const before=await page.locator('#host-root').innerText();
   assert.equal(await page.locator('[data-organizer-setup],[data-form="grant"],[data-roster]').count(),0);
   const button=page.getByRole('button',{name:'Open service at my admitted table',exact:true});
   if(kind==='host-valid'){
    await button.waitFor();await button.click();
    await page.getByText('Sign in to view service available to your admitted event table.',{exact:true}).waitFor();
    assert.equal(await page.locator('#host-root').innerText(),before,'Existing Parea sign-in changed');
    assert.equal(await page.getByRole('button',{name:'Send sign-in code',exact:true}).count(),1);
    assert.equal(loaded.includes('/assets/events/event-service-order.mjs?v='+version),true);
   }else assert.equal(await button.count(),0,'Ambiguous event opened service entry');
   assert.equal(await page.locator('.zevent-service').count(),0);
   evidence.journeys.push({kind,width,url:page.url(),signedOutGate:true,preservedTableGroupSignIn:true,serviceSignInBoundary:kind==='host-valid'});
  }
  assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),true,'Horizontal overflow '+target);
  assert.deepEqual(pageErrors,[],target);assert.deepEqual(blocked,[],target);assert.deepEqual(failedAssets,[],target);assert.deepEqual(httpErrors,[],target);assert.deepEqual(consoleErrors,[],target);
  const name=kind+'-'+width+'.png';await page.screenshot({path:path.join(out,name),fullPage:true});
  Object.assign(evidence.journeys.at(-1),{pageErrors,consoleErrors,blockedProtectedRequests:blocked,failedAssets,httpErrors,loadedAssets:loaded,screenshot:name});
  console.log('PASS real production signed-out entry',kind,width);
 }finally{await context.close();}
}
(async()=>{
 assert.match(commit||'',/^[a-f0-9]{40}$/,'Supply exact pushed RELEASE_COMMIT');assert.ok(deployment,'Supply matching READY RELEASE_DEPLOYMENT');
 await fs.mkdir(out,{recursive:true});
 for(const[file,url]of artifacts){const source=execFileSync('git',['show',commit+':'+file],{cwd:root}),expected=hash(source);const r=await fetch(origin+url,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,url);const actual=hash(Buffer.from(await r.arrayBuffer()));assert.equal(actual,expected,'Deployed artifact differs from pushed commit: '+file);evidence.sourceArtifacts.push({file,url,sha256:expected,exactCommitBytes:true});}
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
 try{for(const width of[390,1440]){
  for(const kind of['social-service-menu','social-service-queue'])await verifyPage(browser,width,kind,'');
  await verifyPage(browser,width,'host-valid','?event='+event);
  await verifyPage(browser,width,'host-duplicate','?event='+event+'&event='+event);
  await verifyPage(browser,width,'host-invalid','?event=invalid');
  await verifyPage(browser,width,'host-missing','');
 }}finally{await browser.close();}
 evidence.completedAt=new Date().toISOString();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(evidence,null,2)+'\n');console.log('PASS',artifacts.length,'immutable assets;',evidence.journeys.length,'real signed-out journeys');
})().catch(async e=>{evidence.failure=String(e.stack||e);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'failure.json'),JSON.stringify(evidence,null,2)+'\n');console.error(e);process.exitCode=1;});

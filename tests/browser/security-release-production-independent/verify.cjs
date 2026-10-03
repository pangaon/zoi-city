const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const commit=process.env.RELEASE_COMMIT,deployment=process.env.RELEASE_DEPLOYMENT,out=process.env.EVIDENCE_DIR,origin=process.env.PRODUCTION_ORIGIN||'https://www.zoi.city';
if(!commit||!deployment||!out)throw Error('Exact release commit, deployment and evidence directory required');
const observe=process.env.OBSERVE_DENIAL_FAILURE==='1';
const captures=[
 '/docs/audits/evidence/olympia-coordinate-independent-2026-10-02/official-shortlink.source',
 '/docs/audits/evidence/olympia-current-source-2026-10-02/destination.html',
 '/docs/audits/evidence/olympia-current-source-2026-10-02/identity-review.json'
];
const signatureCount=text=>Array.from(text.matchAll(/AIza[0-9A-Za-z_-]{35}/g)).length;
const report={release_commit:commit,release_deployment:deployment,origin,production:true,signed_in:false,capture_checks:[],assets:[],journeys:[]};
async function captureCheck(candidate){
 let url=new URL(candidate,origin).href,chain=[];
 for(let i=0;i<5;i++){
  const r=await fetch(url,{redirect:'manual'}),body=await r.text();
  const signatures=signatureCount(body); // Never retain a raw response body.
  chain.push({url,status:r.status,google_signatures:signatures,cache_control:r.headers.get('cache-control'),robots:r.headers.get('x-robots-tag'),bytes:Buffer.byteLength(body)});
  if([301,302,303,307,308].includes(r.status)){
   const next=new URL(r.headers.get('location'),url);assert.ok(['www.zoi.city','zoi.city'].includes(next.hostname));url=next.href;continue;
  }
  const result={requested:candidate,chain,denied:[403,404].includes(r.status),no_secret_signatures:signatures===0,body_persisted:false};report.capture_checks.push(result);
  if(!observe)assert.equal(result.denied,true,'Capture was not denied');assert.equal(signatures,0,'Credential signature in response (value withheld)');return;
 }
 throw Error('Capture redirect chain exceeded bound');
}
(async()=>{await fs.mkdir(out,{recursive:true});let browser;
try{
 for(const file of ['/assets/zoi-theme.js','/assets/zoi-core.js','/assets/homes/templates/events/canonical.mjs','/assets/homes/templates/events/style.css','/sw.js','/assets/discovery/public-listing-media.mjs','/assets/discovery/profile-preview.mjs','/assets/tickets/event-payment-policy.mjs?v=20261003-response-deadline','/assets/tickets/event-payment-policy-client.mjs?v=20261003-response-deadline','/assets/tickets/host-allocations.mjs?v=20261003-response-deadline','/assets/tickets/host-allocation-client.mjs','/tickets/hosts/index.html']){
  const bytes=cp.execFileSync('git',['show',commit+':'+file.slice(1).split('?')[0]],{maxBuffer:16*1024*1024}),r=await fetch(origin+file),actual=Buffer.from(await r.arrayBuffer());
  const hash=b=>crypto.createHash('sha256').update(b).digest('hex');report.assets.push({path:file,status:r.status,expected_sha256:hash(bytes),served_sha256:hash(actual)});assert.equal(r.status,200);assert.equal(hash(actual),hash(bytes),'Served asset differs from release commit');
 }
 const variants=[...captures,...captures.map(p=>p+'/'),captures[2]+'?download=1',captures[0].replace('/docs/','/%64ocs/'),captures[1].replace('/audits/','/%61udits/'),captures[2].replace('/evidence/','/%65vidence/'),'/docs/audits','/docs/audits/','/api/audit-evidence'];
 variants.push('/docs/audits/source-credentials-independent-2026-10-03.md',captures[2].replace('/docs/','/d%6Fcs/'),captures[2].replace('/docs/','/%64%6f%63%73/'),captures[2].replace('/docs/audits/','/docs%2Faudits/'),captures[1].replace('/docs/audits/','/docs%2faudits/'));for(const host of ['www.zoi.city','zoi.city'])for(const variant of variants)await captureCheck('https://'+host+variant);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 for(const width of[390,1440])for(const client of[{label:'Signature',route:'/business/signatureproductions-6aa61d',root:'#event-home'},{label:'Yamas',route:'/business/ke-nairobi-yamas-greek-restaurant',root:'main'}]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[],bad=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/rest/v1/rpc/'))bad.push({url:r.url().split('?')[0],status:r.status()});});
  await page.route('**/*',r=>{const req=r.request(),u=new URL(req.url()),fn=u.pathname.includes('/rest/v1/rpc/')?u.pathname.split('/').pop():null;if(fn&&/(?:save|write|update|send|create|delete|reserve|publish|checkout|claim|commit|insert|configure)/i.test(fn)){blocked.push({function:fn});return r.abort();}return r.continue();});
  const response=await page.goto(origin+client.route,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);await page.locator(client.root).waitFor();await page.getByRole('heading',{level:1}).waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(900);
  const before=await page.evaluate(()=>({title:document.title,heading:document.querySelector('h1')?.innerText,scroll_width:document.documentElement.scrollWidth,viewport:innerWidth,links:Array.from(document.querySelectorAll('a')).map(a=>({text:a.innerText,href:a.getAttribute('href')})).filter(a=>a.href&&(/#contact|#visit|#offerings/.test(a.href)))}));
  assert.ok(before.heading);assert.equal(before.scroll_width,before.viewport);await page.screenshot({path:path.join(out,client.label+'-'+width+'-home.png')});
  let target;if(client.label==='Yamas'){await page.getByRole('button',{name:'Plan a visit',exact:true}).click();target='dialog,[role="dialog"]';await page.locator(target).waitFor();assert.match(await page.locator(target).innerText(),/confirmed by the restaurant/);assert.equal(await page.getByRole('button',{name:'Save my visit plan',exact:true}).isVisible(),true);}else{const anchors=page.locator('a[href="#contact"],a[href="#visit"],a[href="#offerings"],a[href="#request"]');let anchor;for(let i=0;i<await anchors.count();i++){if(await anchors.nth(i).isVisible()){anchor=anchors.nth(i);break;}}assert.ok(anchor,'Visible client action missing');target=await anchor.getAttribute('href');await anchor.click();await page.locator(target).scrollIntoViewIfNeeded();}await page.waitForTimeout(400);assert.equal(await page.locator(target).isVisible(),true);await page.screenshot({path:path.join(out,client.label+'-'+width+'-action.png')});
  const journey={client:client.label,width,url:page.url(),status:response.status(),before,target,errors,bad_public_rpc:bad,blocked_mutations:blocked,passed:errors.length===0&&bad.length===0&&blocked.length===0};report.journeys.push(journey);assert.equal(journey.passed,true,'Normal client flow failed');await context.close();
 }
 report.sanitization_passed=report.capture_checks.every(r=>r.no_secret_signatures);report.public_denial_passed=report.capture_checks.every(r=>r.denied);report.normal_clients_passed=report.journeys.length===4&&report.journeys.every(r=>r.passed);report.passed=report.sanitization_passed&&report.public_denial_passed&&report.normal_clients_passed;console.log(JSON.stringify({sanitization_passed:report.sanitization_passed,public_denial_passed:report.public_denial_passed,normal_clients_passed:report.normal_clients_passed,captures:report.capture_checks.length,journeys:report.journeys.length}));if(!report.passed)process.exitCode=1;
}catch(e){report.passed=false;report.failure=e.message;throw e;}finally{await browser?.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}})().catch(e=>{console.error(e.message);process.exitCode=1;});

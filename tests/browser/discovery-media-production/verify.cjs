const {chromium}=require('playwright-core');
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const commit=process.env.RELEASE_COMMIT,deployment=process.env.RELEASE_DEPLOYMENT,out=process.env.EVIDENCE_DIR,origin='https://www.zoi.city';
if(!commit||!deployment||!out)throw Error('Exact commit, READY deployment and evidence path required');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={commit,deployment,production:true,transport:'actual anonymous public readers; no fixtures or customer writes',cases:[],assets:[]};
const sampleImages=el=>({images:Array.from(el.querySelectorAll('img')).map(i=>({src:i.currentSrc||i.src,loaded:i.complete&&i.naturalWidth>0,width:i.naturalWidth,height:i.naturalHeight,visible:getComputedStyle(i).display!=='none'})),brand_inside:Array.from(el.querySelectorAll('.lbrand:not(.lbrand-only)')).every(b=>{const a=el.getBoundingClientRect(),r=b.getBoundingClientRect();return r.left>=a.left&&r.top>=a.top&&r.right<=a.right&&r.bottom<=a.bottom;})});
(async()=>{await fs.mkdir(out,{recursive:true});const source=JSON.parse(await fs.readFile(path.join(__dirname,'../../../docs/audits/evidence/discovery-media-before-2026-10-02/source-api-report.json'),'utf8'));
let browser;
try{
for(const file of ['/assets/discovery/public-listing-media.mjs','/assets/discovery/profile-preview.mjs','/explore/index.html']){
 const expected=cp.execFileSync('git',['show',commit+':'+file.slice(1)],{maxBuffer:8*1024*1024}),r=await fetch(origin+file),actual=Buffer.from(await r.arrayBuffer());report.assets.push({path:file,status:r.status,expected_sha256:hash(expected),served_sha256:hash(actual)});assert.equal(r.status,200);assert.equal(hash(actual),hash(expected));
}
browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
for(const record of source.records)for(const width of[390,1440]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),c={label:record.label,name:record.row.name,width,errors:[],bad_readers:[],blocked_mutations:[],image_failures:[]};report.cases.push(c);
 page.on('pageerror',e=>c.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/rest/v1/rpc/'))c.bad_readers.push({function:new URL(r.url()).pathname.split('/').pop(),status:r.status()});});page.on('requestfailed',r=>{if(r.resourceType()==='image')c.image_failures.push({url:new URL(r.url()).origin+new URL(r.url()).pathname,error:r.failure()?.errorText});});
 await page.route('**/*',r=>{const u=new URL(r.request().url()),fn=u.pathname.includes('/rest/v1/rpc/')?u.pathname.split('/').pop():null;if(fn&&/(?:save|write|update|send|create|delete|reserve|publish|checkout|claim|commit|insert|configure)/i.test(fn)){c.blocked_mutations.push(fn);return r.abort();}return r.continue();});
 const response=await page.goto(origin+'/explore/?q='+encodeURIComponent(record.row.name),{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);
 await page.waitForFunction(id=>typeof ST!=='undefined'&&!ST.busy&&ST.rows.some(r=>r.id===id),record.row.id,{timeout:45000});
 c.selected=await page.evaluate(id=>{const r=ST.rows.find(r=>r.id===id);return{id:r.id,name:r.name,path:r.path,photo:r.photo_url,logo:r.logo_url,kind:r.image_kind};},record.row.id);
 const card=page.locator('.lcard').filter({has:page.locator('h3 a[href="'+c.selected.path+'"]')}).first();await card.scrollIntoViewIfNeeded();await card.locator('.lcover img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));c.card=await card.locator('.lcover').evaluate(sampleImages);
 assert.equal(c.card.brand_inside,true);assert.ok(c.card.images.filter(i=>i.visible).every(i=>i.loaded),'Visible card image failed');
 if(['Church','School','Professional'].includes(record.label))assert.equal(c.card.images.length,0,'Sparse profile used unrelated imagery');
 await page.screenshot({path:path.join(out,record.label+'-'+width+'-card.png')});
 await card.getByRole('button',{name:'Quick look',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#qv-details').textContent.includes('Loading more details'),null,{timeout:45000});
 await page.locator('.qv-cover img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));c.quick=await page.locator('.qv-cover').evaluate(sampleImages);c.destination=await page.getByRole('link',{name:'Open full page',exact:true}).getAttribute('href');assert.equal(c.destination,c.selected.path);assert.equal(c.quick.brand_inside,true);assert.deepEqual(c.quick.images.map(i=>i.src),c.card.images.map(i=>i.src));assert.ok(c.quick.images.filter(i=>i.visible).every(i=>i.loaded),'Visible Quick look image failed');
 await page.screenshot({path:path.join(out,record.label+'-'+width+'-quick.png')});
 await page.getByRole('link',{name:'Open full page',exact:true}).click();await page.getByRole('heading',{level:1}).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
 c.canonical={url:page.url(),heading:await page.getByRole('heading',{level:1}).first().innerText(),og_image:await page.locator('meta[property="og:image"]').getAttribute('content').catch(()=>null),overflow:await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))};
 assert.ok(!/refreshing|temporarily unavailable/i.test(c.canonical.heading),'Canonical profile unavailable');assert.equal(new URL(c.canonical.url).pathname.replace(/\/$/,''),c.destination.replace(/\/$/,''));assert.equal(c.canonical.overflow.width,c.canonical.overflow.scroll);
 if(['Signature','Venue'].includes(record.label))assert.equal(c.canonical.og_image,c.selected.photo);
 await page.screenshot({path:path.join(out,record.label+'-'+width+'-canonical.png')});
 assert.deepEqual(c.errors,[]);assert.deepEqual(c.bad_readers,[]);assert.deepEqual(c.blocked_mutations,[]);c.passed=true;console.log(record.label,width,'actual production passed');await context.close();
}
report.passed=report.cases.length===16&&report.cases.every(c=>c.passed);assert.equal(report.passed,true);
}catch(e){report.passed=false;report.failure=e.message;throw e;}finally{await browser?.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}})().catch(e=>{console.error(e.message);process.exitCode=1;});

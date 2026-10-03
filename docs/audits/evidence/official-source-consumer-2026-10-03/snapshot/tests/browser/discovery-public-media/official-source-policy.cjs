const {chromium}=require('playwright-core'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=process.env.FROZEN_ROOT||path.resolve(__dirname,'../../..');
(async()=>{
 const dir=process.env.QA_OFFICIAL_POLICY_DIR||path.join(root,'docs/audits/evidence/official-source-consumer-2026-10-03/browser');
 await fs.mkdir(dir,{recursive:true});
 const targets=JSON.parse(await fs.readFile(path.join(root,'docs/audits/evidence/source-conflict-host-review-2026-10-03/quarantine-targets.json'),'utf8')).targets;
 const selected=targets.filter(x=>['01194243','2d10f0a6','b8bf8b4a','e278574d'].includes(x.id.slice(0,8)));
 const preflight=JSON.parse(await fs.readFile(path.join(root,'docs/audits/evidence/source-conflict-host-review-2026-10-03/full-listing-preflight.json'),'utf8')).rows;
 const handler=(await import(pathToFileURL(path.join(root,'api/entity.js')))).default;
 let active;const actualFetch=global.fetch;
 global.fetch=async(url,options)=>String(url).includes('/rest/v1/rpc/')?new Response(JSON.stringify(String(url).endsWith('/home_entity')?active.entity:null)):actualFetch(url,options);
 const server=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://local'),p=u.pathname;
   if(/^\/(business|event|artist|professional|venue|creator|church|school|association|travel-place|vendor)\//.test(p)){
    return await handler({query:{slug:decodeURIComponent(p.split('/').filter(Boolean).pop())}},res);
   }
   const filename=path.join(root,p.endsWith('/')?p+'index.html':p);
   res.setHeader('Content-Type',filename.endsWith('.html')?'text/html':filename.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(filename));
  }catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
 const report={controlled_local_candidate:true,production_candidate:false,source_context:'Exact retained listing metadata; proposed blocked receipts and deliberate owner variants. No live data writes or external unsafe navigation.',cases:[]};
 try{
  for(const width of [390,1440])for(const target of selected)for(const mode of ['held-default','owner-same-domain-edit','owner-clear']){
   const original=preflight.find(x=>x.id===target.id);
   active={entity:{id:original.id,name:original.name,slug:original.slug,entity_type:original.entity_type,city:original.city,country:original.country,address:original.address,website:original.website,profile:{_enrich:{source_url:original.imported_source,blocked:'true',blocked_reason:'source_scope_mismatch',last_error:target.last_error}},publish_status:'published',moderation_status:'clean'}};
   const owner=mode==='owner-same-domain-edit'?new URL('/owner-confirmed',original.website).href:null;
   if(mode!=='held-default')active.entity.owner_content={website:owner};
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
   const result={id:target.id,width,mode,errors:[],rpc_calls:[],external_unsafe_requests:[]};report.cases.push(result);
   page.on('pageerror',e=>result.errors.push({name:e.name,message:e.message}));
   await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.pathname.includes('/rest/v1/rpc/')){
     const rpc=u.pathname.split('/').pop();result.rpc_calls.push(rpc);
     return route.fulfill({contentType:'application/json',body:JSON.stringify(rpc==='explore_search'?[active.entity]:rpc==='home_entity'?active.entity:[])});
    }
    if([original.website,original.imported_source].some(x=>{try{return new URL(x).hostname===u.hostname;}catch{return false;}})){result.external_unsafe_requests.push(u.hostname);return route.abort();}
    return route.continue();
   });
   await page.goto(origin+'/explore/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof ST!=='undefined'&&!ST.busy&&ST.rows.length===1);
   await page.getByRole('button',{name:'Quick look',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('#qv-details').textContent.includes('Loading more details'));
   result.quicklook_details=await page.locator('#qv-details').innerText();
   assert.ok(!result.quicklook_details.includes('could not load'));
   const official=page.locator('#qv').getByRole('link',{name:/^Official website/});
   assert.equal(await official.count(),mode==='owner-same-domain-edit'?1:0);
   if(mode==='owner-same-domain-edit')assert.equal(await official.getAttribute('href'),owner);
   result.quicklook_overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.equal(result.quicklook_overflow.width,result.quicklook_overflow.scroll);
   assert.equal(result.rpc_calls.filter(x=>x==='home_entity').length,1);
   await page.locator('#qv').getByRole('link',{name:'Open full page',exact:true}).click();
   await page.waitForLoadState('domcontentloaded');
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   await page.waitForTimeout(500);
   result.canonical=await page.evaluate(()=>({url:location.href,title:document.title,anchors:Array.from(document.querySelectorAll('a[href]')).map(a=>a.getAttribute('href')),schemas:Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s=>JSON.parse(s.textContent)),overflow:{width:innerWidth,scroll:document.documentElement.scrollWidth}}));
   if(mode==='owner-same-domain-edit')assert.ok(result.canonical.anchors.includes(owner));
   else{
    assert.ok(!result.canonical.anchors.some(x=>x===original.website||x===original.imported_source));
    assert.ok(!JSON.stringify(result.canonical.schemas).includes(original.website));
   }
   assert.equal(result.canonical.overflow.width,result.canonical.overflow.scroll);
   assert.deepEqual(result.external_unsafe_requests,[]);assert.deepEqual(result.errors,[]);
   if(target.id.startsWith('01194243'))await page.screenshot({path:path.join(dir,mode+'-'+width+'.png')});
   result.passed=true;await page.close();
  }
 }finally{
  await browser.close();await new Promise(r=>server.close(r));global.fetch=actualFetch;
  await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 console.log(JSON.stringify({cases:report.cases.length,passed:report.cases.filter(x=>x.passed).length}));
})().catch(e=>{console.error(e);process.exitCode=1;});

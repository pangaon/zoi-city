const {chromium}=require('playwright-core'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.FROZEN_ROOT||path.resolve(__dirname,'../../..');
(async()=>{
 const fixture=JSON.parse(await fs.readFile(path.join(base,'docs/audits/evidence/discovery-media-before-2026-10-02/source-api-report.json'),'utf8')).records.find(x=>x.label==='Yamas');
 const photo=fixture.canonical.og_image,dir=process.env.QA_DISCOVERY_MEDIA_DIR||'/tmp/zoi-media-partial-policy';await fs.mkdir(dir,{recursive:true});
 const report={controlled_local_candidate:true,production_candidate:false,api_fixtures:'Retained actual Yamas card; deliberately partial detail payloads exercise stale-cover policy. Original remote photo loads naturally.',cases:[]};
 const server=http.createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(path.join(base,p)));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
 const variants=[['owner-website-clear',{owner_content:{website:null}}],['profile-website-edit',{profile:{website:'https://new-client.example/'}}],['source-quarantined',{profile:{_enrich:{scope_review_required:true}}}],['source-mismatch',{profile:{_enrich:{source_url:'https://other-client.example/'}}}],['genuinely-sparse',{}]];
 try{
  for(const width of [390,1440])for(const [mode,patch]of variants){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),c={width,mode,errors:[],rpc_calls:[]};report.cases.push(c);page.on('pageerror',e=>c.errors.push({name:e.name,message:e.message}));
   const partial={id:fixture.row.id,name:fixture.row.name,slug:fixture.row.slug,entity_type:fixture.row.entity_type,website:fixture.entity.website,profile:{},...patch};assert.equal(Object.hasOwn(partial,'photo_url'),false);
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname.includes('/rest/v1/rpc/')){const rpc=u.pathname.split('/').pop();c.rpc_calls.push(rpc);return route.fulfill({contentType:'application/json',body:JSON.stringify(rpc==='explore_search'?[{...fixture.row,photo_url:photo}]:rpc==='home_entity'?partial:[])});}return route.continue();});
   await page.goto(origin+'/explore/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof ST!=='undefined'&&!ST.busy&&ST.rows.length===1);await page.locator('.lcard').scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.querySelector('.lcover img');return !!i&&i.complete&&i.naturalWidth>0;});
   c.initial_photo=await page.locator('.lcover img').getAttribute('src');assert.equal(c.initial_photo,photo);
   await page.getByRole('button',{name:'Quick look',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#qv-details').textContent.includes('Loading more details'));
   c.final_cover=await page.locator('.qv-cover').evaluate(el=>({classes:el.className,images:Array.from(el.querySelectorAll('img')).map(i=>i.getAttribute('src')),text:el.innerText}));
   if(mode==='genuinely-sparse'){assert.deepEqual(c.final_cover.images,[photo]);assert.equal(c.final_cover.classes.includes('is-identity'),false);}else{assert.deepEqual(c.final_cover.images,[]);assert.equal(c.final_cover.classes.includes('is-identity'),true);assert.ok(c.final_cover.text);}
   c.overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.equal(c.overflow.width,c.overflow.scroll);assert.equal(c.rpc_calls.filter(x=>x==='home_entity').length,1);assert.deepEqual(c.errors,[]);
   await page.screenshot({path:path.join(dir,mode+'-'+width+'.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('#qv').isVisible(),false);c.passed=true;await page.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({cases:report.cases.length,passed:report.cases.filter(c=>c.passed).length}));
})().catch(e=>{console.error(e);process.exitCode=1;});

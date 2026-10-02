const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const actor='11111111-1111-4111-8111-111111111111';
const firstSession='22222222-2222-4222-8222-222222222222';
const nextSession='33333333-3333-4333-8333-333333333333';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
 const evidence=[];
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  let searches=0;
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.endsWith('/explore_search')){searches++;return route.fulfill({json:[{slug:'session-private-result',name:'Private result',entity_type:'professional'}]});}
   if(url.pathname==='/assets/zoi-search.js')return route.fulfill({contentType:'text/javascript',body:await fs.readFile(path.resolve(__dirname,'../../../assets/zoi-search.js'))});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Search session boundary</title><script src="/assets/zoi-search.js"></script><main><a href="#" id="outside">Outside</a></main>'});
  });
  await page.goto('https://fixture.invalid/');
  const session=async(sid,expired=false)=>page.evaluate(({actor,sid,expired})=>localStorage.setItem('zoi_auth',JSON.stringify({user_id:actor,access_token:'x.'+btoa(JSON.stringify({sub:actor,session_id:sid}))+'.x',expires_at:Math.floor(Date.now()/1000)+(expired?-1:3600)})),{actor,sid,expired});
  await session(firstSession);await page.evaluate(()=>ZoiSearch.open());await page.locator('.zk-input').fill('Current private search');await page.locator('.zk-row').filter({hasText:'Private result'}).waitFor();
  // A replacement session without an auth notification must not allow a stale result click.
  await session(nextSession);await page.locator('.zk-row').filter({hasText:'Private result'}).click();
  assert.equal(new URL(page.url()).pathname,'/');assert.equal(await page.locator('.zk-input').inputValue(),'');assert.equal(await page.locator('.zk-list').innerText(),'');
  assert.equal(await page.evaluate(actor=>localStorage.getItem('zoi_recent_searches_v2:'+actor),actor),null);
  await page.evaluate(()=>ZoiSearch.open());await page.locator('.zk-input').fill('Expiry private search');await page.locator('.zk-row').filter({hasText:'Private result'}).waitFor();
  // Expiration while results are open must retire them before Enter can navigate or remember.
  await session(nextSession,true);await page.locator('.zk-input').press('Enter');
  assert.equal(new URL(page.url()).pathname,'/');assert.equal(await page.locator('.zk-input').inputValue(),'');assert.equal(await page.locator('.zk-list').innerText(),'');
  assert.equal(await page.evaluate(actor=>localStorage.getItem('zoi_recent_searches_v2:'+actor),actor),null);
  assert.equal(searches,2);evidence.push({width,replacementSessionStaleClickBlocked:true,expiredSessionEnterBlocked:true,privateHistoryNotWritten:true});await page.close();
 }}finally{await browser.close();}
 await fs.writeFile('/tmp/search-session-boundary-independent.json',JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
})().catch(error=>{console.error(error);process.exitCode=1;});

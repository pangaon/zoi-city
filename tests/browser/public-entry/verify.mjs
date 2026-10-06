import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const out='/tmp/zoi-public-entry-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const width of [390,1440])for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();const requests=[];const errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(t=>localStorage.setItem('zoi_theme',t),theme);
  await page.route('https://**/*',route=>route.abort());
  const started=Date.now();await page.goto('http://127.0.0.1:8768/social/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'A little closer to your Greek world.'}).waitFor();const visibleMs=Date.now()-started;
  assert.equal(await page.locator('#g-email').count(),0);
  assert.equal(requests.some(url=>url.includes('/assets/suite/')),false,'guest fetched private suite scripts');
  assert.equal(requests.some(url=>url.includes('/auth/v1')||url.includes('/rest/v1')),false,'guest initiated identity or database request');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflows');
  await page.screenshot({path:`${out}/${width}-${theme}-guest.png`,fullPage:true});
  await page.locator('[data-guest-signin]').click();await page.locator('#g-email').waitFor();assert.equal(await page.locator('#g-email').getAttribute('placeholder'),'you@example.com');
  await page.getByRole('button',{name:'Keep exploring'}).click();await page.locator('#guest-title').waitFor();assert.equal(await page.locator('#g-email').count(),0);
  await page.goto('http://127.0.0.1:8768/social/?signin=1',{waitUntil:'domcontentloaded'});await page.locator('#g-email').waitFor();
  await page.getByRole('button',{name:'Keep exploring'}).click();await page.locator('#guest-title').waitFor();
  assert.deepEqual(errors,[]);results.push({width,theme,visibleMs,noAutomaticAccountOrDatabaseRequest:true,noSuiteDownloadsForGuest:true,optionalSignInAndReturn:true,overflow:false});await context.close();
 }
 await writeFile(`${out}/report.json`,JSON.stringify({localOnly:true,results},null,2));console.log(JSON.stringify({status:'pass',localOnly:true,results}));
}finally{await browser.close();}

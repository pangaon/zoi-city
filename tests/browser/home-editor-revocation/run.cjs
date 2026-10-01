const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const http=require('node:http');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const repository=path.resolve(__dirname,'../../..');
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/assets/')&&pathname!=='/tests/browser/home-editor-revocation/fixture.html')throw Error('fixture path refused');
  const file=path.resolve(repository,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(repository+path.sep))throw Error('outside repository');
  const bytes=await readFile(file);
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'text/javascript');res.end(bytes);
 }catch{res.statusCode=404;res.end('Not found');}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let b;
 try{b=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});for(const width of[390,1440]){const p=await b.newPage({viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await p.goto(origin+'/tests/browser/home-editor-revocation/fixture.html');await p.waitForFunction(()=>window.ready);await p.evaluate(()=>mode='transient');await p.locator('[data-reload]').click();await p.waitForFunction(()=>!document.querySelector('[data-reload]').disabled);assert.equal(await p.locator('[data-copy="headline"]').inputValue(),'PRIVATE OWNER DRAFT');
await p.evaluate(()=>mode='ok');await p.locator('[data-copy="headline"]').fill('UNCERTAIN PRIVATE EDIT');await p.locator('[data-save]').click();await p.waitForSelector('[data-retry]');assert.equal(await p.evaluate(()=>writes),1);const before=await p.evaluate(()=>JSON.stringify({...sessionStorage}));
await p.evaluate(value=>mode=value,width===390?'http-denied':'denied');p.once('dialog',d=>d.accept());await p.locator('[data-reload]').click();await p.waitForFunction(()=>document.querySelector('#root').textContent.includes('no longer has access'));assert.equal(await p.locator('iframe,textarea,input,[data-publish],[data-retry]').count(),0);assert.equal(await p.evaluate(()=>JSON.stringify({...sessionStorage})),before);
await p.evaluate(()=>mode='ok');await p.locator('[data-reload]').click();await p.waitForSelector('[data-retry]');assert.equal(await p.evaluate(()=>writes),1);assert.equal(await p.evaluate(()=>JSON.stringify({...sessionStorage})),before);
await p.evaluate(()=>{actor='';window.dispatchEvent(new Event('zoi:authchange'))});assert.equal(await p.locator('iframe,textarea,input,[data-publish],[data-retry]').count(),0);console.log('PASS',width,'transient preserve, revoked clear, durable pending preserved, restored retry, signout clear');await p.evaluate(()=>sessionStorage.clear());await p.reload();await p.waitForFunction(()=>window.ready);let code=200;await p.route('**/api/home-preview',r=>r.fulfill({status:code,contentType:code===200?'application/json':'text/html',body:code===200?JSON.stringify({ok:true,html:'<h1>PRIVATE PREVIEW CONTENT</h1>'}):'Unavailable'}));await p.locator('[data-preview]').click();await p.waitForFunction(()=>document.querySelector('iframe')?.srcdoc.includes('PRIVATE PREVIEW CONTENT'));assert.equal(await p.frameLocator('iframe').locator('h1').innerText(),'PRIVATE PREVIEW CONTENT');code=502;await p.locator('[data-preview]').click();await p.waitForFunction(()=>!document.querySelector('[data-preview]').disabled);assert.equal(await p.locator('[data-copy="headline"]').inputValue(),'PRIVATE OWNER DRAFT');code=200;await p.locator('[data-preview]').click();await p.waitForFunction(()=>document.querySelector('iframe')?.srcdoc.includes('PRIVATE PREVIEW CONTENT'));code=403;await p.locator('[data-preview]').click();await p.waitForFunction(()=>document.querySelector('#root').textContent.includes('no longer has access'));assert.equal(await p.locator('iframe,input,textarea').count(),0);await p.locator('[data-reload]').click();await p.waitForSelector('[data-preview]');await p.evaluate(()=>{actor='10000000-0000-4000-8000-000000000099';window.dispatchEvent(new Event('zoi:authchange'))});assert.equal(await p.locator('iframe,input,textarea').count(),0);console.log('PASS',width,'nonJSON502 preserves draft, nonJSON403 clears, account switch clears');assert.deepEqual(errors,[],'no browser errors');await p.close();}}finally{await b?.close();await new Promise(resolve=>server.close(resolve));}})().catch(error=>{console.error(error);process.exitCode=1;});

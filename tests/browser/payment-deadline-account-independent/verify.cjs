const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=process.env.FROZEN_ROOT,out=process.env.EVIDENCE_DIR;
if(!root||!out)throw Error('FROZEN_ROOT and EVIDENCE_DIR required');
const cases=[];
const server=http.createServer(async(req,res)=>{try{
 const name=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+'/'))throw Error('outside fixture');
 let data=await fs.readFile(file);
 if(name.endsWith('/fixture.html')){
  let source=data.toString();
  assert.ok(source.includes('const rpc=async(name,p)=>{qa.calls.push({name,p});'));
  source=source.replace('const rpc=async(name,p)=>{qa.calls.push({name,p});','const rpc=async(name,p,options)=>{qa.calls.push({name,p,options});if(qa.rpcWait&&name===\'event_payment_policy_configure\'){qa.rpcEntered=true;await new Promise(resolve=>qa.releaseRpc=resolve);}');
  source=source.replace('ensureFresh:async()=>true','ensureFresh:async()=>{if(qa.tokenWait){qa.tokenEntered=true;return await new Promise(resolve=>qa.releaseToken=resolve);}return qa.fresh!==false;}');
  data=source;
 }
 res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript');res.end(data);
}catch(e){res.statusCode=500;res.end(e.message);}});
(async()=>{await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 for(const width of[390,1440])for(const scenario of['token-account','token-switch','token-detach','reply-account','reply-switch','signedout','token-rejected']){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin+'/tests/browser/event-payment-deadline/fixture.html');await page.getByLabel('Allowed guest payment option').waitFor();
  if(scenario==='signedout'){
   await page.evaluate(()=>{qa.actor=null;dispatchEvent(new Event('zoi:auth-change'));});await page.waitForTimeout(100);
   assert.equal(await page.locator('main').isHidden(),true);assert.equal(await page.locator('main').textContent(),'');
  }else{
   await page.evaluate(s=>{qa.calls=[];qa.tokenWait=s.startsWith('token-')&&s!=='token-rejected';qa.rpcWait=s.startsWith('reply-');qa.fresh=s!=='token-rejected';},scenario);
   await page.getByRole('button',{name:'Save event payment policy'}).click();
   if(scenario.startsWith('token-')&&scenario!=='token-rejected'){
    await page.waitForFunction(()=>qa.tokenEntered);
    await page.evaluate(s=>{qa.tokenWait=false;if(s==='token-detach'){qa.handle.destroy();qa.mount();}else{qa.actor=s==='token-switch'?'83000000-0000-4000-8000-000000000001':null;dispatchEvent(new Event('zoi:auth-change'));}qa.releaseToken(true);},scenario);
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>qa.calls.filter(x=>x.name==='event_payment_policy_configure').length),0);
   }else if(scenario.startsWith('reply-')){
    await page.waitForFunction(()=>qa.rpcEntered);await page.evaluate(s=>{qa.actor=s==='reply-switch'?'83000000-0000-4000-8000-000000000001':null;dispatchEvent(new Event('zoi:auth-change'));qa.releaseRpc();},scenario);await page.waitForTimeout(100);
    if(scenario==='reply-account'){assert.equal(await page.locator('main').isHidden(),true);assert.equal(await page.locator('main').textContent(),'');}
    else{assert.equal(await page.getByText('Event payment options saved.',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Check saved result'}).count(),0);}
    assert.equal(await page.evaluate(()=>qa.calls.find(x=>x.name==='event_payment_policy_configure').options.auth),'prefer');
   }else{
    await page.getByRole('button',{name:'Check saved result'}).waitFor();assert.equal(await page.evaluate(()=>qa.calls.filter(x=>x.name==='event_payment_policy_configure').length),0);
    assert.equal(await page.getByText('Event payment options saved.',{exact:true}).count(),0);
   }
  }
  assert.deepEqual(errors,[]);const record={scenario,width,errors,calls:await page.evaluate(()=>qa.calls),passed:true};cases.push(record);await page.close();
 }
 await fs.writeFile(path.join(out,'account-browser-report.json'),JSON.stringify({controlled_local_candidate:true,production:false,frozen_root:root,cases},null,2));console.log('PASS',cases.length,'mounted token/reply/account/detach/signedout cases');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

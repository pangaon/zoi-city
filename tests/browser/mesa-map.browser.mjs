import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const output=resolve(process.env.MESA_BROWSER_OUTPUT||resolve(root,'artifacts/mesa-map-browser'));
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith('/assets/')&&!path.startsWith('/tests/browser/mesa-map.')){res.writeHead(404);res.end();return;}
    const file=resolve(root,'.'+decodeURIComponent(path));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':({'.mjs':'text/javascript','.css':'text/css','.html':'text/html'})[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const checks=[],screenshots=[],errors=[];
let context,browser;
const check=(name)=>checks.push(name);
async function open(theme='light',mobile=false){
  await context?.close();
  context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1050},colorScheme:theme,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/tests/browser/mesa-map.fixture.html?theme=${theme}`);
  await page.waitForFunction(()=>window.mesaQA?.ready===true);
  await page.getByRole('combobox',{name:'Your managed business'}).waitFor();
  return page;
}
const snapshot=page=>page.evaluate(()=>window.mesaQA.snapshot());
async function visible(locator){await locator.waitFor({state:'visible'});}
async function connectedPlan(page){
  const vendor=page.locator('#vendor'),operator=page.locator('#operator');
  await vendor.getByRole('combobox',{name:'Your managed business'}).selectOption('1');
  await vendor.getByRole('button',{name:'Propose business connection'}).click();
  await visible(vendor.getByText('Business connection proposed.',{exact:false}));
  assert.equal((await snapshot(page)).binding.business.name,'Synthetic Long Name Florist & Event Studio');
  await operator.getByRole('button',{name:'Refresh saved plan'}).click();
  await visible(operator.getByRole('button',{name:'Accept business connection'}));
  await operator.getByRole('button',{name:'Accept business connection'}).click();
  await visible(operator.getByText('Business connection accepted.',{exact:false}));
  await operator.getByRole('button',{name:/＋ Florist/}).click();
  await operator.getByRole('combobox',{name:'Assigned vendor application'}).selectOption('10000000-0000-4000-8000-000000000004');
  await operator.getByRole('button',{name:'Apply stand details',exact:true}).click();
  return {operator,vendor};
}
try{
  browser=await chromium.launch({headless:true});
  let page=await open();
  let {operator,vendor}=await connectedPlan(page);
  check('managed-business choice, proposal and organiser acceptance use real UI modules');
  await page.evaluate(()=>window.mesaQA.failNextSave());
  await operator.getByRole('button',{name:'Save draft',exact:true}).click();
  await visible(operator.getByRole('alert'));
  assert.equal((await snapshot(page)).record.version,1);
  await operator.getByRole('button',{name:'Save draft',exact:true}).click();
  await visible(operator.getByText(/Draft saved/));
  let state=await snapshot(page),saves=state.calls.filter(c=>c.name==='festival_map_save');
  assert.equal(saves.length,2);assert.equal(saves[0].request,saves[1].request);assert.equal(state.record.version,1);
  check('lost save response retries identical request without another synthetic version increment');
  await page.evaluate(()=>window.mesaQA.refreshPublic());
  await visible(page.locator('#visitor').getByRole('heading',{name:'A site plan is not shared yet.'}));
  assert.equal(state.record.published_version,undefined);
  await operator.getByRole('button',{name:'Publish visitor plan'}).click();
  await visible(operator.getByText(/Visitor plan published/));
  await page.evaluate(()=>window.mesaQA.refreshPublic());
  await page.locator('#visitor .mesa-stand-list').getByRole('button',{name:/L01.*Synthetic Long Name/}).click();
  await visible(page.locator('#visitor').getByRole('link',{name:'Visit business ↗'}));
  assert.equal(await page.locator('#visitor').getByRole('link',{name:'Visit business ↗'}).getAttribute('href'),'/business/synthetic-florist');
  check('save leaves visitor state unchanged; separate publish exposes accepted business and canonical link');
  await page.locator('#visitor').getByRole('button',{name:'Zoom map in',exact:true}).click();
  await visible(page.locator('#visitor').getByText('150%',{exact:true}));
  await page.locator('#visitor').getByRole('button',{name:'Fit map',exact:true}).click();
  await page.locator('#visitor').getByRole('button',{name:'Copy “come visit us” caption',exact:true}).click();
  await visible(page.locator('#visitor').getByText('Visit caption and stand link copied.',{exact:true}));
  const caption=await page.evaluate(()=>navigator.clipboard.readText());
  assert.match(caption,/Synthetic Long Name Florist & Event Studio at Synthetic Toronto Greek Festival/);
  const captionURL=new URL(caption.split('\n').at(-1));
  assert.equal(captionURL.searchParams.get('event'),'10000000-0000-4000-8000-000000000001');
  assert.equal(captionURL.searchParams.get('stand'),(await snapshot(page)).record.published.booths[0].id);
  check('visitor zoom/fit and come-visit clipboard caption retain selected event/stand identity');
  await page.evaluate(()=>window.mesaQA.failNextPublic());
  await page.evaluate(()=>window.mesaQA.refreshPublic());
  await page.getByRole('button',{name:'Try map again'}).click();
  await visible(page.locator('#visitor').getByRole('heading',{name:'Synthetic Toronto Greek Festival'}));
  check('visitor RPC failure retains retry path and recovers');
  const booth=operator.getByRole('button',{name:/L01.*Synthetic Long Name/});
  await booth.focus();await booth.press('ArrowRight');
  await operator.getByRole('button',{name:'Undo',exact:true}).click();
  await operator.getByRole('button',{name:'Redo',exact:true}).click();
  await page.evaluate(()=>window.mesaQA.remountOperator());
  await page.getByRole('button',{name:'Restore browser draft'}).click();
  await visible(operator.getByText('Unsaved edits',{exact:true}));
  check('keyboard movement, undo/redo and same-tab recovery restore unsaved layout');
  await page.evaluate(()=>window.mesaQA.switchAccount());
  assert.equal(await vendor.locator('.mesa-vendor-panel').innerText(),'');
  const before=(await snapshot(page)).calls.length;
  await operator.getByRole('button',{name:'Save draft',exact:true}).click();
  await page.waitForTimeout(50);
  assert.equal((await snapshot(page)).calls.length,before);
  check('vendor view clears on account switch; stale operator cannot dispatch a save');
  page=await open();({operator,vendor}=await connectedPlan(page));
  assert.ok(await page.evaluate(()=>sessionStorage.length>0));
  await page.evaluate(()=>window.mesaQA.revokeSession());
  page.on('dialog',dialog=>dialog.accept());
  await operator.getByRole('button',{name:'Refresh saved plan'}).click();
  await visible(operator.getByText('Your access changed.',{exact:false}));
  await vendor.getByRole('button',{name:'Revoke this connection'}).click();
  await visible(vendor.getByText('Your access changed.',{exact:false}));
  assert.equal(await operator.locator('[data-mesa-svg]').count(),0);
  assert.equal(await vendor.getByRole('combobox',{name:'Your managed business'}).count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  check('403 session revocation clears operator/vendor private views and browser draft');
  for(const mobile of [false,true])for(const theme of ['light','dark']){
    page=await open(theme,mobile);({operator}=await connectedPlan(page));
    await operator.getByRole('button',{name:'Save draft',exact:true}).click();
    await visible(operator.getByText(/Draft saved/));
    await operator.getByRole('button',{name:'Publish visitor plan'}).click();
    await visible(operator.getByText(/Visitor plan published/));
    await page.evaluate(()=>window.mesaQA.refreshPublic());
    await page.locator('#visitor .mesa-stand-list').getByRole('button',{name:/L01.*Synthetic Long Name/}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'fixture has horizontal page overflow');
    const contrast=await page.locator('#visitor .mesa-primary').evaluate(element=>{
      const color=value=>value.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4);
      const lum=value=>{const c=color(value);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
      const styles=getComputedStyle(element),a=lum(styles.color),b=lum(styles.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    assert.ok(contrast>=4.5,'primary business action contrast must remain readable under festival styles');
    for(const section of ['operator','vendor','visitor']){
      const filename=`${mobile?'390px':'desktop'}-${theme}-${section}.png`;
      await page.locator('#'+section).screenshot({path:resolve(output,filename)});screenshots.push(filename);
    }
  }
  check('desktop and 390px light/dark screenshots; no horizontal page overflow');
  assert.deepEqual(errors,[],'unexpected frontend exceptions');
  await writeFile(resolve(output,'receipt.json'),JSON.stringify({scope:'isolated synthetic frontend; not production or PostgreSQL acceptance',passed:true,checks,screenshots},null,2));
  console.log(JSON.stringify({passed:true,checks:checks.length,screenshots:screenshots.length,scope:'isolated-synthetic-frontend-only'}));
}catch(error){
  await writeFile(resolve(output,'receipt.json'),JSON.stringify({scope:'isolated-synthetic-frontend-only',passed:false,checks,error:String(error.message),pageErrors:errors},null,2));
  throw error;
}finally{await context?.close();await browser?.close();await new Promise(resolve=>server.close(resolve));}

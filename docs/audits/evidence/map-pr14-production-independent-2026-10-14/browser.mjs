import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out='docs/audits/evidence/map-pr14-production-independent-2026-10-14';
const data=JSON.parse(await readFile('docs/audits/evidence/global-map-independent-2026-10-13/production-reviewed-points.json'));
const report={release:{id:'dpl_6evnh4fZoEQwic8gEfPmk5beSEbs',commit:'618f1541f0bb31d008d3661e3a0ff5c29eae4cb6'},kind:'Actual anonymous production browser/public APIs; no data mocks or provider navigation calls',results:[]};
const liveHTML=await (await fetch('https://www.zoi.city/explore/map/')).text();
assert(liveHTML.includes('20261014-adaptive-map-feed'),'Expected merged adaptive-map loader cache version absent; stop before live claim');
const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const row of data.results) {
   await page.goto('https://www.zoi.city/explore/map/?place='+encodeURIComponent(row.slug),{waitUntil:'domcontentloaded',timeout:45000});
   await page.getByText('Plan directions',{exact:true}).waitFor({timeout:60000});
   await page.getByText('Plan directions',{exact:true}).click();
   const link=page.getByRole('link',{name:'Open directions in Google Maps',exact:false});
   await link.waitFor();const href=await link.getAttribute('href'),url=new URL(href);
   assert.equal(url.searchParams.get('destination'),row.destination.value);
   for(const mode of ['driving','walking','bicycling','transit']) {
    await page.locator('.m-directions').getByRole('combobox').selectOption(mode);
    assert.equal(new URL(await link.getAttribute('href')).searchParams.get('travelmode'),mode);
   }
   await page.getByPlaceholder('Current location in Google Maps',{exact:true}).fill('12 Test Starting Street');
   assert.equal(new URL(await link.getAttribute('href')).searchParams.get('origin'),'12 Test Starting Street');
   await page.getByPlaceholder('Current location in Google Maps',{exact:true}).fill('');
   assert(!new URL(await link.getAttribute('href')).searchParams.has('origin'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   report.results.push({width,id:row.id,slug:row.slug,href,fourTravelModes:true,optionalOrigin:true,overflow:false});
  }
  await page.goto('https://www.zoi.city/apps/command-center/delivery/');
  await page.getByText(/founder access|Founder sign|Sign in/i).first().waitFor({timeout:30000});
  assert.equal(await page.locator('.dd-card').count(),0);
  report.results.push({width,anonymousDashboardPrivateCards:0,pageErrors:errors});
  assert.deepEqual(errors,[]);await page.close();
 }
 report.pass=true;
} catch(e) {report.pass=false;report.error=e.stack;process.exitCode=1;}
finally {await browser.close();await writeFile(out+'/journeys.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));

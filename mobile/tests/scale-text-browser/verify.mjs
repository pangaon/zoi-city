import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.ZOI_PLAYWRIGHT_MODULE || '/workspaces/zoi-city-release/node_modules/playwright-core/index.mjs');
const out = process.env.OUTPUT_DIR || '/home/codespace/.cache/zoi/native-scale-text-owner-20261015/browser';
const bundle = process.env.BUNDLE_PATH || '/home/codespace/.cache/zoi/native-scale-text-owner-20261015/host-bundle.js';
await fs.mkdir(out, {recursive: true});
const server = http.createServer(async (request, response) => {
  if (request.url === '/bundle.js') {response.setHeader('Content-Type', 'text/javascript');return response.end(await fs.readFile(bundle));}
  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;min-height:100%;background:#f6faff}main{padding:16px;display:grid;gap:16px}input{min-height:44px}button{min-height:44px}</style><div id="root"></div><script src="/bundle.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox']});
const results = [];let current;
try {
  for (const platform of ['android', 'ios', 'web']) for (const [width, height] of [[390,844],[390,390],[1440,900]]) {
    const page = await browser.newPage({viewport: {width, height}});current = page;const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await page.goto(origin + '/?platform=' + platform);await page.waitForFunction(() => typeof window.scaleFixture === 'object');
    await page.getByTestId('draft-input').fill('Retained private enquiry — edited');
    await page.getByRole('button', {name: 'Expand map', exact: true}).click();
    await page.evaluate(() => {
      window.originalText = document.querySelector('[data-testid="object-ref"]');
      window.originalInput = document.querySelector('[data-testid="draft-input"]');
      window.originalMap = document.querySelector('[data-testid="retained-map"]');
      window.originalCamera = window.scaleFixture.state().camera;
      window.scaleFixture.setScale(2);
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="object-ref"]')).fontSize === '36px');
    const atTwo = await page.evaluate(() => {
      const text = document.querySelector('[data-testid="object-ref"]');
      return {
        hostChanged: text !== window.originalText,
        inputRetained: document.querySelector('[data-testid="draft-input"]') === window.originalInput,
        mapRetained: document.querySelector('[data-testid="retained-map"]') === window.originalMap,
        cameraRetained: window.scaleFixture.state().camera === window.originalCamera,
        parentEvents: window.parentEvents,
        state: window.scaleFixture.state(),
        refCurrent: window.scaleFixture.objectRef() === text,
        callbackDetached: window.scaleFixture.callbackEvents().includes(null),
        explicitProps: {
          allowFontScaling: window.lastHostProps['explicit-props'].allowFontScaling,
          maxFontSizeMultiplier: window.lastHostProps['explicit-props'].maxFontSizeMultiplier,
          numberOfLines: window.lastHostProps['explicit-props'].numberOfLines,
        },
      };
    });
    assert.equal(atTwo.hostChanged, platform !== 'web');
    assert.equal(atTwo.callbackDetached, platform !== 'web');
    for (const key of ['inputRetained', 'mapRetained', 'cameraRetained', 'refCurrent']) assert.equal(atTwo[key], true, key);
    assert.deepEqual(atTwo.parentEvents, ['mount']);assert.equal(atTwo.state.draft, 'Retained private enquiry — edited');
    assert.equal(atTwo.state.expanded, true);assert.equal(atTwo.state.selected, 'Hellenic Bakery & Grocery');
    assert.deepEqual(atTwo.explicitProps, {allowFontScaling:false,maxFontSizeMultiplier:1.5,numberOfLines:2});
    await page.screenshot({path:path.join(out,`${platform}-${width}-${height}-font2.png`),fullPage:true});
    await page.getByRole('button', {name:'Close expanded map',exact:true}).click();
    await page.getByRole('button', {name:'Expand map',exact:true}).click();
    await page.evaluate(() => {window.atTwoText=document.querySelector('[data-testid="object-ref"]');window.scaleFixture.rerender();});
    assert.equal(await page.evaluate(() => window.atTwoText===document.querySelector('[data-testid="object-ref"]')),true,'ordinary parent update retains text host');
    await page.getByRole('button',{name:'All sections',exact:true}).click();
    for (const name of ['Home','Discover','Community','Events','Grow']) await page.getByRole('button',{name:'Go to '+name,exact:true}).waitFor();
    await page.screenshot({path:path.join(out,`${platform}-${width}-${height}-more-font2.png`),fullPage:true});
    await page.getByRole('button',{name:'Close sections',exact:true}).click();
    for (const [label, id] of [['Home','home'],['Community','community'],['Events','tickets'],['Grow','grow'],['Discover','discover']]) {
      await page.getByRole('button',{name:'All sections',exact:true}).click();
      await page.getByRole('button',{name:'Go to '+label,exact:true}).click();
      assert.equal(await page.evaluate(() => window.scaleFixture.state().route),id);
    }
    await page.getByTestId('callback-ref').click();
    await page.waitForFunction(() => window.scaleFixture.state().selected==='Explicitly selected place');
    await page.evaluate(() => window.scaleFixture.setScale(1));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="object-ref"]')).fontSize==='18px');
    assert.equal(await page.evaluate(() => window.originalInput===document.querySelector('[data-testid="draft-input"]')),true);
    assert.equal(await page.getByTestId('draft-input').inputValue(),'Retained private enquiry — edited');
    assert.equal(await page.evaluate(() => window.scaleFixture.objectRef()===document.querySelector('[data-testid="object-ref"]')),true);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(out,`${platform}-${width}-${height}-restored.png`),fullPage:true});
    results.push({platform,width,height,nativeHostChanged:atTwo.hostChanged,refs:true,parentInputCameraMapRetained:true,normalProps:true,closeMoreCallbacks:true,passed:true});
    await page.close();
  }
} catch (error) {
  if(current){await current.screenshot({path:path.join(out,'failure.png'),fullPage:true});await fs.writeFile(path.join(out,'failure.html'),await current.content());}
  throw error;
} finally {
  await browser.close();await new Promise(resolve=>server.close(resolve));
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({cases:results,limits:'Actual React19/RN-web host reconciliation with controlled native platform/scale; not Android paragraph cache or installed font2 acceptance.'},null,2)+'\n');
}
console.log('PASS '+results.length+' actual React host/ref/parent-state cases');

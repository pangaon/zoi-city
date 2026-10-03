const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const marker = 'SYNTHETIC_INTERNAL_CAPTURE';
let current = false;
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/sw.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(await fs.readFile(current ? path.join(root, 'sw.js') : process.env.ORIGINAL_SW));
  } else if (pathname.startsWith('/docs/')) {
    res.end(marker);
  } else if (/\.(js|mjs|css|png)$/.test(pathname)) {
    res.end('');
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><title>Offline source boundary</title></head><body>Public page</body></html>');
  }
});
(async () => {
  assert.ok(process.env.ORIGINAL_SW, 'retain original worker for the actual before/after journey');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox']});
    for (const width of [390, 1440]) {
      current = false;
      const context = await browser.newContext({viewport: {width, height: 900}});
      const page = await context.newPage();
      await page.goto(origin);
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('/sw.js', {scope: '/'});
        await navigator.serviceWorker.ready;
      });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await page.evaluate(async ({marker}) => {
        const cache = await caches.open('zoi-v5-blue-olive');
        await cache.put('/docs/audits/evidence/old.html', new Response(marker));
      }, {marker});
      await context.setOffline(true);
      assert.equal(await page.evaluate(async () => (await fetch('/docs/audits/evidence/old.html')).text()), marker);
      await context.setOffline(false);
      current = true;
      await page.evaluate(async () => { window.__originalWorker = navigator.serviceWorker.controller; const r = await navigator.serviceWorker.getRegistration('/'); await r.update(); });
      await page.waitForFunction(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller !== window.__originalWorker);
      await page.waitForFunction(async () => {
        const keys = await caches.keys();
        return keys.includes('zoi-v6-internal-source-block') && !keys.includes('zoi-v5-blue-olive');
      });
      await page.waitForFunction(async () => (await fetch('/docs/audits/evidence/old.html')).status === 404);
      await context.setOffline(true);
      for (const pathname of ['/docs', '/docs/audits/evidence/old.html', '/%64%6f%63%73/audits/evidence/old.html', '/docs%2Faudits%2Fevidence%2Fold.html']) {
        const result = await page.evaluate(async p => {
          let r; try { r = await fetch(p); } catch (error) { throw Error(p + ' failed; controller=' + navigator.serviceWorker.controller?.state + '; ' + error); }
          return {status: r.status, cache: r.headers.get('Cache-Control'), robots: r.headers.get('X-Robots-Tag'), body: await r.text()};
        }, pathname);
        assert.deepEqual(result, {status: 404, cache: 'no-store', robots: 'noindex, nofollow', body: 'Not found'});
      }
      assert.equal(await page.evaluate(async () => (await fetch('/')).text()), '<!doctype html><html><head><title>Offline source boundary</title></head><body>Public page</body></html>');
      console.log('PASS', width, 'original offline exposure reproduced, update purged old cache, four denied variants, public offline shell preserved');
      await context.close();
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

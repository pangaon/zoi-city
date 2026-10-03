const {chromium} = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const base = path.resolve(__dirname, '../../..');
const output = process.env.QA_OUTPUT_DIR || path.join(base, 'docs/audits/evidence/parea-shared-production-2026-10-03');
const assetBase = process.env.PAREA_ASSET_BASE || base;
const expectedCommit = process.env.PAREA_EXPECTED_COMMIT;
const origin = 'https://www.zoi.city';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const targets = [
  {kind:'toronto', path:'/events/giannis-ploutarchos-andromache-toronto-2027/', id:'4546481e-8995-482a-a0af-f0017613f187', table:'9'},
  {kind:'montreal', path:'/event/giannis-ploutarchos-andromache-montreal-2027', id:'9b241a00-f0c9-5748-8e22-79e2e0b57f79', table:'10A'},
  {kind:'sparse', path:'/event/kalamata-international-choir-competition-and-festival-kalamata', id:'013e2e23-c8cd-4a27-8036-13df80a109ba', table:null},
];
const readRPCs = new Set(['home_entity', 'table_inventory_map', 'event_placements_public', 'event_artists', 'zoi_me', 'event_plan_list', 'event_plan_get']);

async function main() {
  assert.match(expectedCommit || '', /^[a-f0-9]{40}$/, 'Parent must supply the exact ready production commit.');
  assert.equal(process.env.PAREA_DEPLOY_READY, expectedCommit, 'Do not run before parent confirms deployment READY.');
  await fs.mkdir(output, {recursive:true});
  const report = {captured_at:new Date().toISOString(), expected_ready_commit:expectedCommit,
    production_origin:origin, actual_production:true, local_asset_overlay:false, api_stubs:false,
    no_authentication:true, no_sends:true, no_live_writes:true, status:'running', assets:[], cases:[]};
  let browser;
  try {
    const manifestPath = 'docs/audits/evidence/parea-shared-frontdoor-2026-10-03/manifest.json';
    const manifestBytes = await fs.readFile(path.join(base, manifestPath));
    assert.equal(sha(manifestBytes), 'c648135b0caf700675dacdbf0d95b22ba262eeb61b923a18112a319bbc82c406');
    report.base_candidate_manifest = {path:manifestPath, sha256:sha(manifestBytes)};
    const manifest = JSON.parse(manifestBytes);
    // The parent may make a reviewed version-binding derivative. Compare the exact
    // staged/archive bytes supplied by the parent, never substitute them in browser.
    for (const file of [...manifest.runtime_paths,'assets/events/signature/parea-shell.mjs']) {
      const bytes = await fs.readFile(path.join(assetBase, file));
      const url = origin + '/' + file;
      const response = await fetch(url, {cache:'no-store'});
      const served = Buffer.from(await response.arrayBuffer());
      const entry = {path:file, status:response.status, expected_sha256:sha(bytes), served_sha256:sha(served), bytes:served.length};
      report.assets.push(entry);
      assert.equal(response.status, 200, file);
      assert.equal(entry.served_sha256, entry.expected_sha256, 'Deployed asset differs from exact parent release bytes: '+file);
    }
    browser = await chromium.launch({
      executablePath:'/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
      args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
    });
    for (const width of [390,1440]) for (const target of targets) {
      const context = await browser.newContext({viewport:{width,height:1000}, serviceWorkers:'block'});
      const page = await context.newPage();
      const item = {kind:target.kind,width,url:origin+target.path,errors:[],failed_requests:[],rpcs:[],blocked_writes:[],steps:[],screenshots:[],status:'running'};
      report.cases.push(item);
      const pendingResponses = [];
      page.on('pageerror', error => item.errors.push(error.message));
      page.on('requestfailed', request => item.failed_requests.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
      page.on('response', response => {
        const url = new URL(response.url());
        if (!url.pathname.includes('/rest/v1/rpc/')) return;
        pendingResponses.push((async () => {
          const rpc = url.pathname.split('/').pop();
          const request = response.request();
          const entry = {rpc,status:response.status(),timing:request.timing()};
          try {
            const args = request.postDataJSON();
            entry.event_id = args?.p_event || null;
            const reply = await response.json();
            if (rpc === 'home_entity') entry.reply = {id:reply.id,entity_type:reply.entity_type,slug:reply.canonical_slug || reply.slug};
            if (rpc === 'table_inventory_map') entry.reply = {ok:reply.ok,event_id:reply.event_id,configured:reply.configured,tables:reply.tables?.length};
          } catch (error) { entry.response_parse_error = error.message; }
          item.rpcs.push(entry);
        })());
      });
      // This gate only refuses accidental writes. It never fulfills, alters or
      // delays a real production response and no sender/composer link is clicked.
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        const rpc = url.pathname.includes('/rest/v1/rpc/') ? url.pathname.split('/').pop() : null;
        if (!['GET','HEAD','OPTIONS'].includes(request.method()) && !(request.method()==='POST' && readRPCs.has(rpc))) {
          item.blocked_writes.push({method:request.method(),path:url.pathname});
          return route.abort();
        }
        return route.continue();
      });
      try {
        const response = await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:60000});
        assert.equal(response.status(),200);
        assert.equal(await page.evaluate(()=>document.characterSet),'UTF-8');
        item.html = {status:response.status(),sha256:sha(Buffer.from(await response.text())),url:response.url(),content_type:response.headers()['content-type']};
        if (target.kind !== 'toronto') {
          const data = JSON.parse(await page.locator('#event-home-content').textContent());
          const entity = data.entity;
          assert.equal(entity.id,target.id);
          assert.equal(entity.family,'event');
          item.source = {id:entity.id,slug:entity.slug,name:entity.name,starts:entity.starts,venue:entity.venue,
            floor_plan_url:entity.floor_plan_url,hero:entity.hero,website:entity.website,contact_url:entity.contact_url};
          item.expected_title = entity.name;
          if (target.kind === 'sparse') {
            assert.equal(entity.generic,true);
            for (const field of ['starts','venue','floor_plan_url','hero','website','contact_url']) assert(!entity[field], 'Sparse source field changed: '+field);
          }
        } else {
          const {SIGNATURE_EVENT} = await import(path.join(assetBase,'assets/events/signature/source-facts.mjs'));
          item.expected_title = SIGNATURE_EVENT.title;
        }
        await page.locator('[data-count]').waitFor({timeout:45000});
        assert.equal(await page.locator('[data-signature-shell]').count(),1);
        item.loaded_module_urls = await page.evaluate(() => performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/assets/') && /\.(mjs|css)(\?|$)/.test(u)));
        if (target.kind === 'toronto') {
          await page.locator('#signature-room canvas').first().waitFor({timeout:45000});
          await page.locator('.sig-a-title a[href="#sig-request"]').click();
          const room = page.locator('#signature-room');
          await room.locator('[data-details-toggle]').click();
          await room.locator('[data-find]').selectOption(target.table);
          await room.locator('[data-request]').click();
        } else if (target.table) {
          await page.locator('[data-open-event-room]').click();
          const room = page.locator('[data-event-room]');
          await room.locator('canvas').waitFor({timeout:45000});
          await room.locator('[data-numbers]').click();
          await room.locator('.rs-numbers [data-table="'+target.table+'"]').click();
          assert.equal(await page.locator('[name=preferred_table]').inputValue(),target.table);
          await room.locator('[data-continue]').click();
        } else {
          assert.equal(await page.locator('[data-open-event-room]').count(),0);
          await page.locator('a[href="#parea-plan"]').first().click();
        }
        assert.equal(await page.locator('[data-count]').count(),1);
        if (target.table) assert.match(await page.locator('.sig-a-selected-table').innerText(),new RegExp('Table '+target.table+'\\b'));
        item.steps.push(target.table?'actual interactive scene '+target.table+' -> same shared planner':'actual sparse generic hero -> shared planner; no invented room');
        const capture = async name => {
          await page.evaluate(()=>document.fonts.ready);
          await page.locator('.sig-a-work').evaluate(element=>element.scrollIntoView({block:'start'}));
          const stem=target.kind+'-'+width+'-'+name;
          await page.screenshot({path:path.join(output,stem+'.png')});
          if (name !== 'contact') await page.locator('.sig-a-work').screenshot({path:path.join(output,stem+'-full.png')});
          item.screenshots.push(stem);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
        };
        await page.locator('[data-count]').fill('9');
        await page.locator('[data-next]').click();
        for(let index=0;index<3;index++) {
          if(index) await page.locator('[data-add-recipient]').click();
          await page.locator('[data-recipient-name]').nth(index).fill(['Alex','Maria','Niko'][index]);
          await page.locator('[data-ticket-quantity]').nth(index).fill(String([3,1,5][index]));
        }
        assert.match(await page.locator('[data-allocation-status]').innerText(),/9 of 9/);
        await page.locator('.sig-a-recipient-contacts summary').first().click();
        await page.locator('[data-recipient-email]').first().fill('alex@example.org');
        await page.locator('[data-recipient-tel]').first().fill('+1 416 555 1234');
        await capture('crew');
        await page.locator('[data-pick-contact]').nth(1).click();
        const dialog=page.locator('dialog[open]');
        await dialog.locator('[name=name]').fill('Maria');
        await dialog.locator('[name=email]').fill('maria@example.org');
        await dialog.locator('[name=tel]').fill('+1 514 555 5678');
        await capture('contact');
        await dialog.getByRole('button',{name:'Use these details',exact:true}).click();
        assert.equal(await page.locator('[data-recipient-email]').nth(1).inputValue(),'maria@example.org');
        await page.locator('[data-next]').click();
        assert.equal(await page.locator('[data-person-channels] a').count(),0,'Composers must wait for explicit review.');
        await page.locator('[data-review-message]').first().click();
        const message=await page.locator('[data-person-message]').first().inputValue();
        assert(message.startsWith('Let’s get our parea ready for '+item.expected_title+'!'),'Exact Unicode public event title must survive message.');
        assert.match(message,/Alex: 3 tickets in our group of 9/);
        assert.match(message,/not a booking, payment request or admission ticket/);
        assert(!message.includes('maria@example.org'));
        if(target.table) assert(message.includes('Our table preference: '+target.table));
        else assert(!message.includes('Our table preference:'));
        const links=await page.locator('[data-person-channels]').first().locator('a').evaluateAll(elements=>elements.map(e=>e.href));
        assert.equal(links.length,2);
        const sms=links.find(link=>link.startsWith('sms:')), email=links.find(link=>link.startsWith('mailto:'));
        assert(sms&&email);
        assert.equal(decodeURIComponent(sms.split('body=')[1]),message);
        assert.equal(new URL(email).searchParams.get('body'),message);
        assert.equal(new URL(email).searchParams.get('subject'),item.expected_title+' · Our parea');
        item.message=message; item.composers={sms,email};
        if(target.kind==='toronto') assert.match(await page.locator('.sig-a-allocation-total').innerText(),/1,800\.00/);
        else assert.match(await page.locator('.sig-a-allocation-total').innerText(),/To confirm/);
        await capture('review');
        item.steps.push('3/1/5 whole tickets -> optional contact confirmation -> explicit review -> exact Unicode SMS/mailto; composers inspected, never sent');
        const inventoryResponse=page.waitForResponse(response=>response.url().includes('/rest/v1/rpc/table_inventory_map'),{timeout:25000});
        await page.locator('[data-check-ticket-setup]').click();
        const inventory=await inventoryResponse;
        assert.equal(inventory.status(),200);
        const reply=await inventory.json();
        assert.equal(reply.event_id,target.id); assert.equal(reply.ok,true); assert.equal(reply.configured,false); assert.deepEqual(reply.tables,[]);
        await page.getByText('Ticket inventory is not configured on Zoi for this event.',{exact:false}).waitFor();
        item.inventory={status:inventory.status(),event_id:reply.event_id,configured:reply.configured,tables:reply.tables.length};
        item.host_handoff=await page.locator('.sig-a-host-handoff a').getAttribute('href');
        assert.equal(item.host_handoff,'/tickets/hosts/?event='+target.id);
        await capture('inventory');
        item.steps.push('real anonymous unconfigured inventory -> exact event operating URL; no fabricated allocation/hold/payment/delivery');
        await page.locator('[data-usual-group] summary').click();
        await page.getByText('Sign in to see only your own saved groups.',{exact:true}).waitFor();
        item.steps.push('anonymous saved crew requires sign-in');
        await Promise.all(pendingResponses);
        if(target.kind==='toronto') assert(item.rpcs.some(r=>r.rpc==='home_entity' && r.status===200 && r.reply?.id===target.id));
        assert.deepEqual(item.errors,[]); assert.deepEqual(item.blocked_writes,[]);
        item.status='passed';
      } catch(error) { item.status='failed'; item.failure=error.message; await page.screenshot({path:path.join(output,target.kind+'-'+width+'-failure.png')}).catch(()=>{}); throw error; }
      finally { await Promise.allSettled(pendingResponses); await context.close(); }
    }
    report.status='passed';
  } catch(error) { report.status='failed'; report.failure=error.message; throw error; }
  finally {
    await browser?.close();
    const bytes=JSON.stringify(report,null,2)+'\n';
    const {credentialFindings}=await import('../../../scripts/check-source-credentials.mjs');
    assert.equal(credentialFindings(bytes).length,0,'Never retain credentials in acceptance evidence.');
    await fs.writeFile(path.join(output,'report.json'),bytes);
  }
  console.log(JSON.stringify({status:report.status,commit:expectedCommit,cases:report.cases.map(item=>({kind:item.kind,width:item.width,status:item.status,inventory:item.inventory,errors:item.errors}))}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import assert from 'node:assert/strict';
export async function destinationBrowser({q,claims,editor,ws,listing,entity,quote,j,out,makeDestination,id}){
 const base=process.cwd(),dest=join(out,'destination-browser');await mkdir(dest,{recursive:true});let lossPrepare=0,lossSave=0;const calls=[],results=[];
 const json=s=>JSON.parse(q(claims(editor)+s));
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/rpc'){
   let raw='';for await(const chunk of req)raw+=chunk;const {fn,p,post}=JSON.parse(raw);calls.push({fn,p});let value;
   if(fn==='business_creative_destinations_context')value=json(`select public.business_creative_destinations_context('${ws}',${quote(p.p_post)}::uuid)`);
   else if(fn==='business_creative_destinations_prepare')value=json(`select public.business_creative_destinations_prepare('${ws}',${quote(p.p_post)}::uuid,${quote(p.p_request)}::uuid,${quote(p.p_expected_updated_at)}::timestamptz)`);
   else if(fn==='business_creative_destinations_recover')value=json(`select public.business_creative_destinations_recover('${ws}',${quote(p.p_post)}::uuid,${quote(p.p_request)}::uuid,${p.p_cancel_if_missing===true})`);
   else if(fn==='business_creative_destinations_save')value=json(`select public.business_creative_destinations_save('${ws}',${quote(p.p_post)}::uuid,${quote(p.p_request)}::uuid,${j(p.p_payload)})`);
   else if(fn==='social_delete_post'){q('delete from zoi.social_posts where id='+quote(p.p_id)+'::uuid');value=true;}
   else if(fn==='social_list_posts')value=JSON.parse(q(`select coalesce(jsonb_agg(to_jsonb(p)),'[]')from zoi.social_posts p where id=${quote(post)}::uuid`));
   else if(fn==='bizpage_status')value={ok:true,workspace_id:ws,owned:[{id:listing,name:entity.name,slug:entity.slug,city:entity.city}]};
   else if(fn==='home_entity')value=json(`select public.home_entity(${quote(p.p_slug)})`);
   else if(fn==='business_creative_draft_get')value=json(`select public.business_creative_draft_get('${ws}',${quote(p.p_post)}::uuid)`);
   else if(['social_channels_list','hashtag_list','template_list','slot_list'].includes(fn))value=[];
   else if(fn==='zoi_namedays_today')value={names:[]};
   else if(fn.startsWith('editorial_'))value={ok:false,available:false};
   else throw Error('Unexpected RPC (no generic save/send allowed): '+fn);
   if(fn==='business_creative_destinations_prepare'&&lossPrepare>0){lossPrepare--;throw Error('Controlled response loss after canonical preparation commit');}
   if(fn==='business_creative_destinations_save'&&lossSave>0){lossSave--;throw Error('Controlled response loss after canonical reviewed save commit');}
   res.setHeader('content-type','application/json');res.end(JSON.stringify(value));return;
  }
  if(url.pathname==='/'){
   const post=url.searchParams.get('post');assert.match(post,/^[a-f0-9-]{36}$/i);
   res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;background:#071726;color:#f4f8ff;--tx:#f4f8ff;--mut:#bbcede;--acc:#57c9ff;--gold:#edcc86;--bdr:#36566f;--line:#36566f;--card:#102b42;--bg:#071726;--bg2:#102b42;--bg3:#123047;font:16px Arial}*{box-sizing:border-box}</style><nav><button class="nitem" data-id="calendar">Calendar</button><button class="nitem" data-id="composer">Composer</button></nav><main id="root"></main><p id="toast" role="status"></p><script src="/assets/suite/_schedule.js"></script><script src="/assets/suite/calendar.js"></script><script src="/assets/suite/composer.js"></script><script>window.fixture={actor:${JSON.stringify(editor)},sid:'11111111-1111-4111-8111-000000000020',post:${JSON.stringify(post)},calls:[]};const f=fixture;window.C={BASE:'https://csebihpaychdkanjjsmz.supabase.co',KEY:'fixture',esc:s=>String(s??'').replace(/[&<>\x22']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\x22':'&quot;',"'":'&#39;'}[c])),auth:{load:()=>f.actor?{user_id:f.actor}:null,token:()=>f.actor?'x.'+btoa(JSON.stringify({sub:f.actor,session_id:f.sid}))+'.x':'',ensureFresh:async()=>!!f.actor},api:{rpc:async(fn,p,opts)=>{f.calls.push(fn);if(opts?.beforeDispatch&&opts.beforeDispatch()===false)throw Error('Account or workspace changed.');const r=await fetch('/rpc',{method:'POST',body:JSON.stringify({fn,p,post:f.post})}),v=await r.json();if(!r.ok)throw Object.assign(Error(v.error||'reader failed'),{status:r.status});return v;}},toast:s=>document.querySelector('#toast').textContent=s};window.ctx={C,ws:${JSON.stringify(ws)},channels:[],avail:{publish:false},toast:C.toast};window.openView=async name=>{window.handle?.destroy();window.handle=await ZoiSuite.modules.find(m=>m.id===name).mount(document.querySelector('#root'),ctx);};for(const n of document.querySelectorAll('.nitem'))n.onclick=()=>openView(n.dataset.id);(async()=>{if(new URL(location.href).searchParams.get('view')==='composer'){const v=await C.api.rpc('business_creative_destinations_context',{p_workspace:ctx.ws,p_post:f.post});ZoiSchedule.setHandoff({...v.post,scheduledAt:v.post.scheduled_at},localStorage,{actor:f.actor,workspace:ctx.ws});await openView('composer');}else await openView('calendar');window.ready=true;})();</script>`);return;
  }
  const file=resolve(base,'.'+url.pathname);if(!file.startsWith(base+'/'))throw Error('path');res.setHeader('content-type',['.js','.mjs'].includes(extname(file))?'text/javascript':extname(file)==='.css'?'text/css':'text/plain');res.end(await readFile(file));
 }catch(error){res.statusCode=/permission|suite_session|invitation_unavailable|no_access_to/.test(error.stderr||error.message)?403:409;res.setHeader('content-type','application/json');res.end(JSON.stringify({error:error.stderr||error.message}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const {chromium}=await import(process.env.ZOI_PLAYWRIGHT_MODULE||'/workspaces/zoi-city-release/node_modules/playwright-core/index.mjs');const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});let page;
 try{for(const width of [390,1440]){
  const draft=makeDestination(id(width+300)),post=draft.post.id;lossPrepare=width===390?1:0;lossSave=width===390?1:0;
  const context=await browser.newContext({viewport:{width,height:950}});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/?post='+post);await page.waitForFunction(()=>window.ready);await page.locator('[data-role=fill]').click();await page.getByText('Business drafts stay private. Use Review destinations or edit in Composer. Nothing was scheduled.',{exact:true}).waitFor();await page.locator('[data-view=list]').click();await page.getByText(draft.post.body,{exact:true}).click();for(const role of ['edit','dup','rp7','rp30'])assert.equal(await page.locator('[data-role='+role+']').isDisabled(),true);await page.getByRole('button',{name:'Review destinations',exact:true}).click();await page.getByRole('button',{name:'Prepare Zoi Community draft',exact:true}).focus();await page.keyboard.press('Enter');
  if(width===390){await page.getByRole('button',{name:'Check saved result',exact:true}).waitFor();await page.reload();await page.waitForFunction(()=>window.ready);await page.locator('[data-view=list]').click();await page.getByText(draft.post.body,{exact:true}).click();await page.getByRole('button',{name:'Review destinations',exact:true}).click();await page.getByRole('button',{name:'Check saved result',exact:true}).click();}
  await page.getByText('Saved as a Zoi Community draft. Nothing was sent.',{exact:true}).first().waitFor();await page.screenshot({path:join(dest,width+'-prepared.png'),fullPage:true});
  let saved=json(`select public.business_creative_destinations_context('${ws}','${post}')`);assert.equal(saved.post.id,post);assert.deepEqual(saved.post.channels,['zoi']);assert.equal(saved.post.scheduled_at,null);
  for(const role of ['edit','dup','rp7','rp30'])assert.equal(await page.locator('[data-role='+role+']').isDisabled(),true);await page.getByRole('button',{name:'Edit in Composer',exact:true}).click();await page.locator('.zc-ta').waitFor();await page.waitForFunction(()=>document.querySelector('.zc-ta').value.startsWith('Reviewed owner copy'));
  assert.equal(await page.locator('[data-role=publish]').isDisabled(),true);assert.equal(await page.locator('[data-role=schedule]').isDisabled(),true);assert.equal(await page.locator('.zc-chip.on').count(),1);await page.locator('.zc-ta').fill('Reviewed owner edit · Ελληνικά '+width);await page.locator('[data-role=draft]').click();
  if(width===390){await page.getByRole('button',{name:'Retry original draft save',exact:true}).waitFor();await page.locator('.zc-ta').fill('Later unconfirmed changed form');await page.getByRole('button',{name:'Retry original draft save',exact:true}).click();}
  if(width===1440)await page.getByText('Draft saved.',{exact:true}).waitFor();await page.waitForFunction(({text})=>document.querySelector('.zc-ta').value===text,{text:'Reviewed owner edit · Ελληνικά '+width});
  saved=json(`select public.business_creative_destinations_context('${ws}','${post}')`);assert.equal(saved.post.body,'Reviewed owner edit · Ελληνικά '+width);assert.equal(saved.post.status,'draft');assert.deepEqual(saved.post.channels,['zoi']);assert.equal(saved.post.scheduled_at,null);
  await page.goto(origin+'/?post='+post+'&view=composer');await page.waitForFunction(()=>window.ready);await page.waitForFunction(({text})=>document.querySelector('.zc-ta').value===text,{text:saved.post.body});await page.screenshot({path:join(dest,width+'-reopened.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>fixture.calls.includes('social_save_post')||fixture.calls.some(n=>/feed_publish|email_send/.test(n))),false);
  await page.evaluate(()=>{fixture.actor=null;dispatchEvent(new Event('zoi:auth-change'));});await page.waitForFunction(()=>!document.querySelector('.zc-ta'));results.push({width,passed:true,same_post:post,actual_calendar:true,actual_composer:true,canonical_sql:true,lost_prepare_response:width===390,lost_edit_response:width===390,no_generic_save:true,no_send:true});await context.close();

 }
 const negative=await browser.newContext({viewport:{width:390,height:950}});page=await negative.newPage();await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 async function openReview(draft){await page.goto(origin+'/?post='+draft.post.id);await page.waitForFunction(()=>window.ready);await page.locator('[data-view=list]').click();await page.getByText(draft.post.body,{exact:true}).click();await page.getByRole('button',{name:'Review destinations',exact:true}).click();await page.getByRole('button',{name:'Prepare Zoi Community draft',exact:true}).waitFor();}
 const imageDraft=makeDestination(id(1900),[{type:'image',url:entity.photo_url,order:0,alt:'QA bakery bread'}]);await openReview(imageDraft);await page.getByRole('button',{name:'Prepare Zoi Community draft',exact:true}).click();await page.getByText('Use text only by removing the image, or create a supported image in Image layout before reviewing destinations.',{exact:true}).waitFor();await page.screenshot({path:join(dest,'390-media-refusal.png'),fullPage:true});await page.getByRole('button',{name:'Cancel if not saved',exact:true}).click();await page.getByText('The unsaved review was cancelled. Your saved post is unchanged. You can edit its image or text before reviewing destinations again.',{exact:true}).waitFor();assert.deepEqual(json(`select public.business_creative_destinations_context('${ws}','${imageDraft.post.id}')`).post.channels,[]);results.push({width:390,passed:true,scenario:'unsupported source-site image gives useful text/layout choice and canonical cancel-if-unsaved; original draft unchanged'});
 const heldDraft=makeDestination(id(1901));lossPrepare=1;await openReview(heldDraft);await page.getByRole('button',{name:'Prepare Zoi Community draft',exact:true}).click();await page.getByRole('button',{name:'Check saved result',exact:true}).waitFor();q(`update zoi.listings set public_entity=jsonb_set(public_entity,'{description}','"Changed after committed preparation"')where id='${listing}'`);await page.getByRole('button',{name:'Check saved result',exact:true}).click();await page.getByText('The saved result is recorded, but current business details need review. Reopen the draft from Calendar before editing.',{exact:true}).waitFor();assert.equal(json(`select public.business_creative_destinations_context('${ws}','${heldDraft.post.id}')`).source_current,false);assert.equal(await page.evaluate(()=>fixture.calls.includes('social_save_post')),false);await page.screenshot({path:join(dest,'390-source-changed-recovery.png'),fullPage:true});q(`update zoi.listings set public_entity=${j(entity)} where id='${listing}'`);results.push({width:390,passed:true,scenario:'known committed receipt with changed current source cannot authorize editing; historical receipt and held currentness remain distinct'});
 // Reviewer-only controlled deletion adapter tests actual Calendar handlers; no
 // claim of exercising a canonical deletion RPC. All save paths remain actual
 // source and every unexpected save is refused by the fixture server.
 const fenceDraft=makeDestination(id(1950));await openReview(fenceDraft);
 const countSaves=()=>calls.filter(c=>c.fn==='social_save_post').length;
 const beforeSaves=countSaves();
 for(const role of ['dup','rp7','rp30','savetime']){
  await page.locator('[data-role='+role+']').dispatchEvent('click');
  await page.waitForTimeout(40);assert.equal(countSaves(),beforeSaves,role+' cannot reach generic save even by synthetic dispatch on disabled control');
 }
 page.on('dialog',d=>d.accept());await page.locator('[data-role=del]').click();
 await page.getByRole('button',{name:'Undo',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Undo',exact:true}).dispatchEvent('click');await page.waitForTimeout(60);
 assert.equal(countSaves(),beforeSaves);assert.equal(q('select count(*)from zoi.social_posts where id='+quote(fenceDraft.post.id)+'::uuid'),'0');
 results.push({width:390,passed:true,reviewer_probe:'actual Calendar disabled duplicate/repost/reschedule and Undo listeners forced by DOM event still hit central fence before generic RPC; deletion adapter controlled SQL fixture only'});
 const malformed=makeDestination(id(1951));q('update zoi.social_posts set meta=jsonb_set(meta,\'{business_creative}\',\'null\') where id='+quote(malformed.post.id)+'::uuid');
 await page.goto(origin+'/?post='+malformed.post.id);await page.waitForFunction(()=>window.ready);await page.locator('[data-view=list]').click();await page.getByText(malformed.post.body,{exact:true}).click();
 for(const role of ['dup','rp7','rp30','savetime']){assert.equal(await page.locator('[data-role='+role+']').isDisabled(),true);await page.locator('[data-role='+role+']').dispatchEvent('click');}
 await page.waitForTimeout(60);assert.equal(countSaves(),beforeSaves);
 results.push({width:390,passed:true,reviewer_probe:'null business_creative key presence remains enrolled; no generic save after forced disabled handlers'});

await negative.close();
 }catch(error){if(page&&!page.isClosed()){await page.screenshot({path:join(dest,'failure.png'),fullPage:true});await writeFile(join(dest,'failure.html'),await page.content());}throw error;}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(dest,'results.json'),JSON.stringify({basis:'Actual Calendar/Composer/new controller and disposable canonicalSQL. Controlled currentAuth/JWT, bounded post-list/public-owned-business auxiliary readers; all external network aborted. No production/provider calls.',results,calls},null,2)+'\n');}
 return results;
}

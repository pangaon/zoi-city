import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {execFile as execute} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {chromium} from 'playwright-core';
import previewHandler from '../../../api/home-preview.js';
import {renderRestaurantHome} from '../../../api/_restaurant-home.js';
import {renderCreatorCanonicalHome} from '../../../api/_creator-home.js';
const exec=promisify(execute),root=fileURLToPath(new URL('../../../',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'zoi-owner-lifecycle-')),bin=process.env.PG_BIN||'/usr/lib/postgresql/16/bin';
const env={...process.env,PGHOST:dir,PGPORT:'15507',PGDATABASE:'postgres'},owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',workspace='10000000-0000-4000-8000-000000000001';
const ids=['20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000012'];
const lit=v=>v==null?'null':"'"+String(v).replaceAll("'","''")+"'",json=v=>lit(JSON.stringify(v))+'::jsonb';
let browser,server,started=false;const originalFetch=globalThis.fetch;
async function sql(text,actor=null,anonymous=false){const scoped=actor?`set role authenticated;select set_config('request.jwt.claim.sub',${lit(actor)},false);`:anonymous?'set role anon;':'';const r=await exec(path.join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',scoped+text],{env});return r.stdout.trim().split('\n').filter(Boolean).at(-1)||'';}
async function rpc(fn,a,actor){if(![owner,other].includes(actor))throw Error('fixture_actor_required');let args;if(fn==='home_design_editor')args=[lit(a.p_workspace),lit(a.p_listing)];else if(fn==='home_design_preview_data')args=[lit(a.p_workspace),lit(a.p_listing),json(a.p_design)];else if(fn==='home_design_change')args=[lit(a.p_workspace),lit(a.p_listing),lit(a.p_request),lit(a.p_expected_version),lit(a.p_action),a.p_design?json(a.p_design):'null',lit(a.p_restore_version)];else throw Error('fixture_rpc_refused');return JSON.parse(await sql(`select public.${fn}(${args.join(',')});`,actor));}
async function entity(slug){return JSON.parse(await sql(`select public.home_entity(${lit(slug)});`,null,true)||'null');}
try{
 await exec(path.join(bin,'initdb'),['-D',path.join(dir,'data'),'-A','trust','--no-locale']);await exec(path.join(bin,'pg_ctl'),['-D',path.join(dir,'data'),'-l',path.join(dir,'log'),'-o',`-k ${dir} -p 15507 -c listen_addresses=''`,'-w','start']);started=true;
 await sql(await readFile(path.join(root,'tests/database/venue-fixture.sql'),'utf8'));await sql(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 // Base listing projection is fixture-only. Production design projection and
 // authorization functions below are loaded verbatim from their migration.
 await sql(`create function public.seo_entity(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$select to_jsonb(l)||jsonb_build_object('category_slug',c.slug) from zoi.listings l left join zoi.categories c on c.id=l.primary_category_id where l.slug=p_slug and l.publish_status='published' and l.moderation_status in('clean','cleared') and coalesce(l.marketplace_status,'')<>'hidden'$$;`);
 await sql(await readFile(path.join(root,'supabase/migrations/20260930043408_owner_home_design_drafts_and_publication.sql'),'utf8'));
 await sql(`insert into zoi.categories values(1,'greek-restaurants');insert into zoi.listings(id,owner_workspace_id,entity_type,publish_status,moderation_status,marketplace_status,name,slug,primary_category_id,profile) values('${ids[0]}','${workspace}','business','published','clean','','SYNTHETIC RESTAURANT','fixture-restaurant',1,'{}'),('${ids[1]}','${workspace}','creator','published','clean','','SYNTHETIC CREATOR','fixture-creator',null,'{}');`);
 // Actual private-preview API receives local authenticated SQL replies only.
 globalThis.fetch=async(url,options)=>{if(String(url)!=='https://csebihpaychdkanjjsmz.supabase.co/rest/v1/rpc/home_design_preview_data')throw Error('external_network_refused');try{return new Response(JSON.stringify(await rpc('home_design_preview_data',JSON.parse(options.body),options.headers.Authorization.replace('Bearer ',''))),{status:200});}catch{return new Response('Forbidden',{status:403});}};
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(req.method==='POST'){let bytes='';for await(const chunk of req){bytes+=chunk;if(bytes.length>40000)throw Error('oversize');}const body=JSON.parse(bytes);if(u.pathname==='/api/home-preview'){req.body=body;return await previewHandler(req,res);}if(u.pathname.startsWith('/rpc/')){const value=await rpc(u.pathname.slice(5),body,req.headers.authorization?.replace('Bearer ',''));res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(value));}throw Error('route_refused');}
 if(u.pathname.startsWith('/public/')){const e=await entity(u.pathname.slice(8));const html=e&&(renderCreatorCanonicalHome(e,e.published_design?.design)||renderRestaurantHome(e,e.published_design?.design));res.setHeader('Content-Type','text/html');return res.end(html||'No public home');}
 if(!u.pathname.startsWith('/assets/')&&!u.pathname.startsWith('/tests/browser/home-editor-lifecycle/'))throw Error('path_refused');const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!file.startsWith(root))throw Error('path_refused');const bytes=await readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
 }catch(error){res.statusCode=403;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'home_design_permission_denied',code:'42501'}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
 for(const [index,id] of ids.entries()){
 const slug=index?'fixture-creator':'fixture-restaurant',headline='PRIVATE SAVED REVISION '+index,p=await browser.newPage({viewport:{width:index?390:1440,height:950}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await p.goto(origin+'/tests/browser/home-editor-lifecycle/fixture.html?listing='+id);await p.waitForFunction(()=>window.ready);assert.equal((await entity(slug)).published_design,null);
 await p.locator('[data-copy="headline"]').fill(headline);await p.locator('[data-save]').click();await p.waitForFunction(()=>document.querySelector('[data-status]')?.textContent==='Private draft saved.');assert.equal((await rpc('home_design_editor',{p_workspace:workspace,p_listing:id},owner)).version,1);assert(!JSON.stringify(await entity(slug)).includes(headline));
 await p.locator('[data-preview]').click();await p.waitForFunction(()=>document.querySelector('iframe')?.srcdoc.includes('PRIVATE SAVED REVISION'));assert((await p.frameLocator('iframe').locator('body').innerText()).includes(headline));assert.equal((await entity(slug)).published_design,null);
 p.once('dialog',d=>d.accept());await p.locator('[data-publish]').click();await p.waitForFunction(()=>document.querySelector('[data-status]')?.textContent.startsWith('Design published.'));const published=await entity(slug);assert.equal(published.published_design.version,2);assert.equal(published.published_design.design.copy.headline,headline);
 const html=renderCreatorCanonicalHome(published,published.published_design.design)||renderRestaurantHome(published,published.published_design.design);assert(html.includes(headline));
 const publicPage=await browser.newPage({javaScriptEnabled:false,viewport:{width:index?390:1440,height:950}});
 await publicPage.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await publicPage.goto(origin+'/public/'+slug);assert((await publicPage.locator('body').innerText()).includes(headline));assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await publicPage.close();
 await p.locator('[data-copy="headline"]').fill('NEXT UNPUBLISHED REVISION');await p.locator('[data-save]').click();await p.waitForFunction(()=>document.querySelector('[data-status]')?.textContent==='Private draft saved.');assert.equal((await rpc('home_design_editor',{p_workspace:workspace,p_listing:id},owner)).version,3);assert(!JSON.stringify(await entity(slug)).includes('NEXT UNPUBLISHED REVISION'));assert.equal((await entity(slug)).published_design.version,2);
 await assert.rejects(rpc('home_design_editor',{p_workspace:workspace,p_listing:id},other),/home_design_permission_denied/);await assert.rejects(rpc('home_design_preview_data',{p_workspace:workspace,p_listing:id,p_design:published.published_design.design},other),/home_design_permission_denied/);await assert.rejects(rpc('home_design_change',{p_workspace:workspace,p_listing:id,p_request:crypto.randomUUID(),p_expected_version:3,p_action:'publish'},other),/home_design_permission_denied/);
 assert.deepEqual(errors,[]);await p.close();console.log('PASS',slug,'mounted save/private preview/publish/readback; newer draft remains private; wrong actor denied');
 }
}finally{
 globalThis.fetch=originalFetch;
 try{await browser?.close();}
 finally{try{if(server)await new Promise(resolve=>server.close(resolve));}
 finally{try{if(started)await exec(path.join(bin,'pg_ctl'),['-D',path.join(dir,'data'),'-m','immediate','-w','stop']);}
 finally{await rm(dir,{recursive:true,force:true});}}}
}

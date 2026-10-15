import { installEventAuthorityCandidate } from "./event-table-current-session.integration.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";
import https from "node:https";
import path from "node:path";
import {readFile,mkdir,writeFile}from "node:fs/promises";
const evidence=process.env.ZOI_PAREA_CONTACT_EVIDENCE||"/tmp/zoi-parea-contact-pg";await mkdir(evidence,{recursive:true});
let server,browser,currentPage;const results=[];const pass=name=>{results.push({name,passed:true});console.log("PASS",name);};
const dir = mkdtempSync(join(tmpdir(), "parea-contact-")),
  bin = "/usr/lib/postgresql/16/bin",
  env = {
    ...process.env,
    PGHOST: dir,
    PGPORT: process.env.PGPORT || "15763",
    PGDATABASE: "postgres",
  };
let started = false;
const q = (s) =>
    execFileSync(
      join(bin, "psql"),
      ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", s],
      { env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim(),
  uid = "10000000-0000-4000-8000-000000000001",
  uid2 = "10000000-0000-4000-8000-000000000002",
  actor = "20000000-0000-4000-8000-000000000001",
  actor2 = "20000000-0000-4000-8000-000000000002",
  ws = "30000000-0000-4000-8000-000000000001",
  event = "40000000-0000-4000-8000-000000000001",
  venue = "50000000-0000-4000-8000-000000000001",
  table = "60000000-0000-4000-8000-000000000001",
  request = "70000000-0000-4000-8000-000000000001";
const as = (s, u = uid) => q(`set request.jwt.claim.sub='${u}';${s}`),
  json = (s, u = uid) => JSON.parse(as(s, u)),
  hold = (req = request, version = 1, party = 5) =>
    `select public.table_hold_create('${event}','${table}',${party},${version},'${req}')`;
const data = {
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    enabled: true,
    tables: [
      {
        table_id: table,
        source_label: "Table1",
        capacity: 10,
        min_party_size: 2,
        price_per_guest_cents: 27500,
        currency: "CAD",
        fees_included: true,
      },
    ],
  },
  configure = (version = 0, req = request, d = data) =>
    `select public.table_inventory_configure('${ws}','${event}',${version},'${req}','${JSON.stringify(d)}')`;
const run = (s, u = uid) =>
  new Promise((resolve) => {
    let out = "",
      err = "";
    const p = spawn(
      join(bin, "psql"),
      [
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `set request.jwt.claim.sub='${u}';${s}`,
      ],
      { env },
    );
    p.stdout.on("data", (x) => (out += x));
    p.stderr.on("data", (x) => (err += x));
    p.on("close", (code) => resolve({ code, out: out.trim(), err }));
  });
try {
  execFileSync(
    join(bin, "initdb"),
    ["-D", join(dir, "data"), "-A", "trust", "--no-locale"],
    { stdio: "ignore" },
  );
  execFileSync(
    join(bin, "pg_ctl"),
    [
      "-D",
      join(dir, "data"),
      "-l",
      join(dir, "log"),
      "-o",
      `-k ${dir} -p ${env.PGPORT} -c listen_addresses=''`,
      "-w",
      "start",
    ],
    { stdio: "ignore" },
  );
  started = true;
  q(
    `create extension pgcrypto;create schema zoi;create schema auth;create role anon;create role authenticated;create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table auth.users(id uuid primary key);create table zoi.user_profiles(id uuid primary key,auth_user_id uuid);create function zoi.ensure_profile()returns uuid language sql as $$select id from zoi.user_profiles where auth_user_id=auth.uid()$$;create table zoi.workspaces(id uuid primary key);create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);create table zoi.listings(id uuid primary key,name text,primary_category_id bigint,owner_workspace_id uuid,entity_type text,publish_status text,moderation_status text,marketplace_status text);create table zoi.categories(id bigint primary key,slug text);insert into zoi.categories values(6,'events-entertainment');create function zoi.qa_category_gate()returns trigger language plpgsql as $$begin if new.publish_status='published' and new.primary_category_id is null then new.publish_status:='pending_review';end if;return new;end$$;create trigger qa_category_gate before insert or update on zoi.listings for each row execute function zoi.qa_category_gate();create table zoi.ticket_types(id bigint generated always as identity,event_id uuid);create table zoi.seating_sessions(id uuid default gen_random_uuid(),event_id uuid);insert into auth.users values('${uid}'),('${uid2}');insert into zoi.user_profiles values('${actor}','${uid}'),('${actor2}','${uid2}');insert into zoi.workspaces values('${ws}');insert into zoi.workspace_members values('${ws}','${actor}','owner');insert into zoi.listings(id,owner_workspace_id,entity_type,primary_category_id,publish_status,moderation_status,marketplace_status)values('${event}','${ws}','event',6,'published','clean','visible');`,
  );
  const ddl = readFileSync(
    new URL(
      "../../supabase/migrations/0027_table_orders_and_venues.sql",
      import.meta.url,
    ),
    "utf8",
  );
  q(ddl.slice(0, ddl.indexOf("-- Realtime publication")));
  q(
    `alter table public.event_venues add column workspace_id uuid;insert into public.event_venues(id,event_id,name,workspace_id)values('${venue}','${event}','QA venue','${ws}');insert into public.venue_tables_zones(id,venue_id,name,capacity)values('${table}','${venue}','QA table',10)`,
  );
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930125216_versioned_event_table_holds.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );

  q("create schema extensions;alter extension pgcrypto set schema extensions");
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930144328_event_host_table_allocations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  json(configure());
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20260930192244_event_payment_preferences.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );

  q(
    `alter table auth.users add column deleted_at timestamptz,add column is_anonymous boolean default false,add column banned_until timestamptz;create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);insert into auth.sessions select id,id,null from auth.users;create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('session_id',auth.uid())$$;alter table zoi.workspaces add column owner_profile_id uuid;update zoi.workspaces set owner_profile_id='${actor}';`,
  );
  const shared = readFileSync(
    new URL(
      "../../supabase/migrations/20261001170000_workspace_current_authority.sql",
      import.meta.url,
    ),
    "utf8",
  );
  q(
    shared.slice(
      shared.indexOf("create function zoi.suite_current_session"),
      shared.indexOf("create or replace function zoi.assert_ws"),
    ),
  );
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261001032515_event_host_request_cancellation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  for (const signature of [
    "zoi.event_payment_policy_view(uuid,uuid)",
    "public.event_payment_policy_get(uuid,uuid)",
    "public.event_payment_policy_save(uuid,uuid,integer,uuid,boolean,boolean)",
    "public.event_guest_payment_options(uuid)",
    "public.event_guest_payment_choose(uuid,text,integer,integer,uuid)",
    "public.event_payment_operator_report(uuid,uuid)",
  ])
    console.log(
      "GUARD",
      signature,
      q(`select md5(pg_get_functiondef('${signature}'::regprocedure))`),
    );
  q(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261001171500_event_payment_response_deadline.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  installEventAuthorityCandidate(q);
  const contracts=JSON.parse(readFileSync(new URL('./fixtures/parea-contacts-live-contracts.json',import.meta.url))).functions;
  const columns=JSON.parse(readFileSync(new URL('./fixtures/parea-audience-columns.json',import.meta.url))).columns;
  q('create table zoi.audience_contacts('+columns.map(c=>c.name+' '+c.type+(c.not_null?' not null':'')+(c.default_expression?' default '+c.default_expression:'')).join(',')+');alter table zoi.audience_contacts add primary key(id);');
  for(const row of contracts.filter(r=>r.signature!=='ops_records_list(uuid,text,boolean)')){
    const sig=row.signature.startsWith('zoi.')?row.signature:'public.'+row.signature;
    q(row.definition+';alter function '+sig+' owner to postgres;');
    if(row.acl!==null){q('set role postgres;revoke all on function '+sig+' from public,anon,authenticated,service_role;reset role;');for(const entry of row.acl.slice(1,-1).split(',')){const role=entry.split('=')[0]||'public';q('set role postgres;grant execute on function '+sig+' to '+role+';reset role;');}}
    assert.equal(q("select md5(pg_get_functiondef('"+sig+"'::regprocedure))"),row.body_md5,'actual captured body '+sig);
  }
  const foreign='30000000-0000-4000-8000-000000000099',contact1='82000000-0000-4000-8000-000000000001',contact2='82000000-0000-4000-8000-000000000002';
  q(`insert into zoi.workspaces(id,owner_profile_id)values('${foreign}','${actor2}');insert into zoi.workspace_members values('${foreign}','${actor2}','owner');insert into zoi.audience_contacts(id,workspace_id,name,email,phone,tags,notes)values('${contact1}','${ws}','Alex Papas','alex.one@example.test','+14165550101',array['private'],'Private contact note'),('${contact2}','${ws}','Alex Papas','alex.two@example.test','+14165550102',array['private'],'Other private note'),('82000000-0000-4000-8000-000000000099','${foreign}','Foreign Person','foreign@example.test',null,'{}','Foreign private note');insert into zoi.audience_contacts(workspace_id,name,created_at)select '${ws}','Saved person '||n,clock_timestamp()+interval '1 second' from generate_series(1,501)n;`);
  const user=(s,u=uid)=>q(`set role authenticated;set request.jwt.claim.sub='${u}';${s}`),dataJSON=(s,u=uid)=>JSON.parse(user(s,u).split('\n').at(-1)),quote=s=>"'"+String(s).replaceAll("'","''")+"'";
  assert.equal(dataJSON(`select public.audience_access('${ws}')`).workspace_id,ws);
  assert.equal(dataJSON(`select coalesce(jsonb_agg(c),'[]')from public.audience_list('${ws}','Alex',null)c`).length,2);
  assert.equal(dataJSON(`select coalesce(jsonb_agg(c),'[]')from public.audience_list('${ws}',null,null)c`).length,500);
  assert.throws(()=>dataJSON(`select public.audience_access('${foreign}')`),/no_access_to_workspace/);
  assert.throws(()=>dataJSON(`select coalesce(jsonb_agg(c),'[]')from public.audience_list('${ws}',null,null)c`,uid2),/no_access_to_workspace/);
  pass('actual captured contact readers keep workspace/session authority and server search beyond initial500');
  const allocation=dataJSON(`select public.event_host_allocate('${ws}','${event}','${table}','${actor}',10,clock_timestamp()+interval '1 hour',1,'91000000-0000-4000-8000-000000000001')`).allocation;
  const beforeContacts=q("select md5(coalesce(jsonb_agg(to_jsonb(c)order by id)::text,''))from zoi.audience_contacts c"),rpcCalls=[],writes=[];let lost=false,failRead=false;
  const specs={audience_access:['p_workspace'],audience_list:['p_workspace','p_q','p_tag'],event_host_list:['p_workspace','p_event'],event_host_get:['p_allocation'],table_inventory_operator:['p_workspace','p_event'],event_guest_payment_options:['p_event'],event_payment_policy_get:['p_workspace','p_event'],event_payment_operator_report:['p_workspace','p_event'],event_host_guest_save:['p_allocation','p_guest','p_expected_version','p_request','p_label','p_quantity','p_token'],event_host_receipt:['p_request'],event_host_request_cancel:['p_request','p_kind']};
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'fixture-key.pem'),'-out',join(dir,'fixture-cert.pem'),'-subj','/CN=localhost','-days','1'],{stdio:'ignore'});server=https.createServer({key:readFileSync(join(dir,'fixture-key.pem')),cert:readFileSync(join(dir,'fixture-cert.pem'))},async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/host'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/zoi-theme.css"><link rel="stylesheet" href="/assets/tickets/host-allocations.css"><main id="fixture"></main><script type="module">import{mountHostAllocations}from'/assets/tickets/host-allocations.mjs';const uid='${uid}',profile='${actor}';window.fixture={actor:uid,sid:uid,phoneCalls:[],phoneProperties:[],mode:'ok',writes:0};const f=fixture;Object.defineProperty(navigator,'contacts',{configurable:true,value:{getProperties:async()=>['name','email','tel','address'],select:(properties,options)=>{f.phoneCalls.push({properties,options});if(f.mode==='cancel')return Promise.reject({name:'AbortError'});if(f.mode==='deny')return Promise.reject({name:'NotAllowedError'});return Promise.resolve([{name:['Phone Alex'],email:['must-not-read@example.test'],tel:['+14165550999']}]);}}});const C={auth:{load:()=>f.actor?{user_id:f.actor}:null,token:()=>f.actor?'x.'+btoa(JSON.stringify({sub:f.actor,session_id:f.sid}))+'.x':'',ensureFresh:async()=>!!f.actor},api:{rpc:async(name,args)=>{const r=await fetch('/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Actor':f.actor||''},body:JSON.stringify(args)}),v=await r.json();if(!r.ok)throw Object.assign(Error(v.error),{status:r.status});return v;}}};window.fixtureCore=C;document.querySelector('#fixture').id='host-root';window.dispose=mountHostAllocations(document.querySelector('#host-root'),{core:C});</script>`);}
    if(url.pathname.startsWith('/assets/')){const file=path.resolve(process.cwd(),'.'+url.pathname);if(!file.startsWith(process.cwd()+'/assets/'))throw Error('asset_refused');res.setHeader('Content-Type',file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');return res.end(await readFile(file));}
    if(url.pathname.startsWith('/rpc/')){const name=url.pathname.split('/').at(-1),u=req.headers['x-fixture-actor'];if(![uid,uid2].includes(u))throw Error('not_signed_in');let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)throw Error('body_limit');}const args=JSON.parse(body);rpcCalls.push(name);if(name==='zoi_me'){res.setHeader('Content-Type','application/json');return res.end(q("select jsonb_build_object('authenticated',true,'profile',jsonb_build_object('id',id)) from zoi.user_profiles where auth_user_id="+quote(u)));}if(!Object.hasOwn(specs,name)||Object.keys(args).some(k=>!specs[name].includes(k)))throw Error('rpc_refused');if(name==='audience_list'&&failRead){failRead=false;throw Error('controlled_reader_failure');}const params=specs[name].map(k=>args[k]===null||args[k]===undefined?'NULL':typeof args[k]==='number'?String(args[k]):quote(args[k])).join(',');const sql=name==='audience_list'?`select coalesce(jsonb_agg(c),'[]')from public.audience_list(${params})c`:`select public.${name}(${params})`;const value=dataJSON(sql,u);if(name==='event_host_guest_save'){writes.push({name,keys:Object.keys(args),label:args.p_label,quantity:args.p_quantity});if(lost){lost=false;throw Error('controlled_lost_response_after_commit');}}res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(value));}
    res.statusCode=404;res.end('Not found');
  }catch(error){console.error('FIXTURE_RPC_ERROR',String(error.stderr||error.message));res.statusCode=/controlled/.test(error.message)?503:403;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.message.slice(0,300)}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='https://127.0.0.1:'+server.address().port;
  const {chromium}=await import(process.env.ZOI_PLAYWRIGHT_MODULE||'/workspaces/zoi-city-release/node_modules/playwright-core/index.mjs');browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
  for(const width of[390,1440]){const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width,height:950}}),errors=[];currentPage=page;page.on('pageerror',e=>{console.error('BROWSER_ERROR',e.message);errors.push(e.message)});await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await page.goto(origin+'/host?workspace='+ws+'&event='+event);await page.getByRole('button',{name:'Open group',exact:true}).click();if(width===1440)await page.locator('[data-guest-status=invited]').getByText('Alex Papas',{exact:true}).waitFor();const form=page.locator('[data-form=guest]');await form.locator('[name=quantity]').fill('3');await form.getByRole('button',{name:'Use an audience contact',exact:true}).click();const query=form.locator('[data-contact-query]');await query.fill('Alex');await query.press('Enter');const choice=form.getByRole('button',{name:'Alex Papas · alex.two@example.test',exact:true});await choice.waitFor();await query.press('ArrowDown');await page.keyboard.press('ArrowDown');await choice.click();await page.waitForFunction(()=>document.querySelector('[data-form=guest] [name=label]').value==='Alex Papas');assert.equal(await form.locator('[name=quantity]').inputValue(),'3');assert.equal(await form.getByText(/Private contact note/).count(),0);await form.getByRole('button',{name:'Review guest allocation',exact:true}).click();await page.getByRole('button',{name:'Back to editing',exact:true}).click();assert.equal(await form.locator('[name=label]').inputValue(),'Alex Papas');if(width===390){lost=true;await form.getByRole('button',{name:'Review guest allocation',exact:true}).click();await page.getByRole('button',{name:'Confirm allocation',exact:true}).click();await page.getByRole('button',{name:'Check result',exact:true}).click();await page.getByRole('heading',{name:'Share this private claim link',exact:true}).waitFor();const saved=dataJSON(`select public.event_host_get('${allocation.id}')`);assert.equal(saved.guests[0].label,'Alex Papas');assert.equal(saved.guests[0].quantity,3);assert.ok(![contact1,contact2].includes(saved.guests[0].id));assert.equal(writes.length,1);assert.deepEqual(writes[0].keys.sort(),specs.event_host_guest_save.slice().sort());pass('actual mounted Contacts→guest review→canonical save with lost response→receipt/readback preserves quantity and no contact metadata');}
    await page.screenshot({path:path.join(evidence,'host-'+width+'.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(errors,[]);await page.close();pass('actual mounted audience guest draft at'+width+' preserves editable name/quantity and separate duplicate records');}
  assert.equal(q("select md5(coalesce(jsonb_agg(to_jsonb(c)order by id)::text,''))from zoi.audience_contacts c"),beforeContacts);assert.ok(!rpcCalls.some(n=>/audience_(?:upsert|delete|import)|consent|send|schedule/.test(n)));pass('contact/consent/source rows unchanged and no writer/provider beyond canonical guest save');
  await writeFile(path.join(evidence,'results.json'),JSON.stringify({basis:'Isolated real PostgreSQL, actual captured reader/writer definitions and mounted current host; controlled Auth/local HTTP only.',results,guest_writes:writes.length,contact_writes:0,provider_calls:0},null,2)+'\n');
}catch(error){if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:path.join(evidence,'failure.png')});await writeFile(path.join(evidence,'failure.html'),await currentPage.content());}throw error;}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

#!/usr/bin/env node
// Real isolated PostgreSQL transactions; no Supabase/network calls.
// Requires PostgreSQL16 server binaries installed. Run explicitly with node.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {createLayout,seatRows} from '../../assets/tickets/venue-model.mjs';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-seats-pg-')),bin=process.env.PG_BIN||'/usr/lib/postgresql/16/bin';
const port=15490;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){const r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){try{await query(q,user);assert.fail('Expected SQL rejection');}catch(e){assert.match(e.stderr||e.message,pattern);}}
let started=false,checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(readFileSync(new URL('./venue-fixture.sql',import.meta.url),'utf8'));
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA host',add column slug text default 'qa-host',add column city text default 'Athens',add column country text default 'Greece';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930043127_artist_appearances_and_private_trips.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const call=(fn,args,user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse),j=x=>literal(JSON.stringify(x))+'::jsonb',req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await query(`insert into zoi.workspace_members values('10000000-0000-4000-8000-000000000002','${other}','owner');insert into zoi.listings(id,owner_workspace_id,entity_type,publish_status,marketplace_status,name,slug) values('${req(100)}','10000000-0000-4000-8000-000000000002','artist','published','','Greek performer','greek-performer');`);
 const artist=req(100),pid=req(1),trip=req(2),item=req(3),start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+90000000).toISOString(),proposal={artist_id:artist,event_id:event,starts_at:start,ends_at:end,timezone:'Europe/Athens',source_url:'https://example.org/confirmed-show'};
 await rejects(`select public.appearance_propose('${pid}',${j(proposal)});`,member,/appearance_permission_denied/);pass('viewer cannot claim an artist appearance');
 let p=(await call('appearance_propose',`'${pid}',${j(proposal)}`)).appearance;assert.equal(p.status,'pending');assert.equal((await call('artist_shows',`'${artist}'`)).shows.length,0);pass('event owner proposal is not a publicly confirmed artist booking');
 const retry=await call('appearance_propose',`'${pid}',${j(proposal)}`);assert.equal(retry.appearance.id,pid);pass('appearance creation retry preserves one proposal');
 p=(await call('appearance_decide',`'${pid}',1,'confirm'`,other)).appearance;assert.equal(p.status,'confirmed');assert.equal((await call('artist_shows',`'${artist}'`)).shows.length,1);pass('both artist and event owners must confirm identical immutable terms');
 await query(`update zoi.listings set owner_workspace_id='${ws}' where id='${artist}';`);assert.equal((await call('artist_shows',`'${artist}'`)).shows.length,0);await rejects(`select public.appearance_decide('${pid}',2,'confirm');`,other,/appearance_listing_unavailable/);await query(`update zoi.listings set owner_workspace_id='10000000-0000-4000-8000-000000000002' where id='${artist}';`);pass('ownership transfer invalidates confirmed discovery and blocks former owner reconfirmation');
 assert.equal((await call('trip_discover',"'Greek','Greece','artist'",other)).listings.length,1);pass('actual listing discovery is separate from confirmed show associations');
 const form={name:'Greece trip',timezone:'Europe/Athens',notes:'Private travel notes'};const copies=await Promise.all([call('trip_save',`'${trip}',0,${j(form)}`,other),call('trip_save',`'${trip}',0,${j(form)}`,other)]);assert.equal(copies[0].trip.id,copies[1].trip.id);pass('private trip creation is idempotent under concurrency');
 await rejects(`select public.trip_get('${trip}');`,actor,/trip_permission_denied/);await rejects('select * from zoi.private_trips;',other,/permission denied/);pass('workspace operators cannot read customer private itineraries');
 const itemData={listing_id:event,appearance_id:pid,starts_at:'2000-01-01T00:00:00Z',ends_at:'2000-01-01T01:00:00Z',timezone:'UTC',notes:'See this artist'};
 let it=(await call('trip_item_save',`'${trip}','${item}',0,${j(itemData)}`,other)).item;assert.equal(new Date(it.starts_at).toISOString(),start);assert.equal(it.timezone,'Europe/Athens');pass('show itinerary derives confirmed time on server instead of trusting client');
 await call('trip_item_save',`'${trip}','${req(4)}',0,${j({...itemData,appearance_id:null,starts_at:start,ends_at:end,timezone:'Europe/Athens'})}`,other);let got=await call('trip_get',`'${trip}'`,other);assert.equal(got.items.filter(i=>i.time_conflict).length,2);pass('overlapping planned stops are flagged without fabricated transit estimates');
 await rejects(`select public.trip_item_save('${trip}','${req(5)}',0,${j({...itemData,appearance_id:null,starts_at:'infinity'})});`,other,/trip_timezone_required/);await rejects(`select public.trip_save('${req(6)}',null,${j(form)});`,other,/trip_version_conflict/);pass('finite timezone-explicit intervals and non-null insert versions are enforced');
 p=(await call('appearance_decide',`'${pid}',2,'withdraw'`,other)).appearance;assert.equal((await call('artist_shows',`'${artist}'`)).shows.length,0);got=await call('trip_get',`'${trip}'`,other);assert.equal(got.items.find(i=>i.id===item).appearance_confirmed,false);pass('withdrawal removes discovery and marks saved show no longer confirmed');
 await query(`update zoi.listings set marketplace_status='hidden' where id='${event}';`);got=await call('trip_get',`'${trip}'`,other);assert.equal(got.items[0].listing_name,null);assert.equal(got.items[0].listing_available,false);pass('private itinerary does not leak subsequently hidden public listing details');
 await call('trip_remove',`'${trip}','${item}',1`,other);got=await call('trip_get',`'${trip}'`,other);assert.equal(got.items.length,1);assert.ok(got.audit.length>=4);await call('trip_remove',`'${trip}',null,1`,other);assert.equal((await call('trips_mine','',other)).trips.length,0);pass('customer removes stops and archives trip with private change history');
 console.log(`${checks} trip/appearance database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

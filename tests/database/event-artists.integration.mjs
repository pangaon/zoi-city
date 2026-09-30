#!/usr/bin/env node
// Real isolated PostgreSQL transactions; no Supabase/network calls.
// Requires PostgreSQL16 server binaries installed. Run explicitly with node.
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const run=promisify(execFile),dir=mkdtempSync(join(tmpdir(),'zoi-seats-pg-')),bin=process.env.PG_BIN||'/usr/lib/postgresql/16/bin';
const port=15829;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column moderation_status text default 'clean',add column name text default 'QA host',add column slug text default 'qa-host',add column city text default 'Athens',add column country text default 'Greece';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930043127_artist_appearances_and_private_trips.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await query(readFileSync(new URL('../../supabase/migrations/20260930134827_public_event_artists.sql',import.meta.url),'utf8'));

 const id=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`,artist=id(1),appearance=id(2),artistWs='10000000-0000-4000-8000-000000000002';
 await query(`insert into zoi.listings(id,owner_workspace_id,entity_type,publish_status,marketplace_status,moderation_status,name,slug) values('${artist}','${artistWs}','artist','published','','clean','QA artist','qa-artist');
 insert into zoi.artist_appearances(id,artist_id,event_id,artist_workspace,event_workspace,starts_at,ends_at,timezone,source_url,event_confirmed_by,artist_confirmed_by,status,created_by,initial_data)
 values('${appearance}','${artist}','${event}','${artistWs}','${ws}',now()+interval '1 day',now()+interval '2 days','UTC','https://example.test/announcement','${actor}','${other}','confirmed','${actor}','{"private":"never public"}');`);
 const read=async(eventId=event,role='anon')=>JSON.parse(await query(`set role ${role};select public.event_artists(${eventId?literal(eventId):'null'});`));
 const shows=async()=>JSON.parse(await query(`set role anon;select public.artist_shows('${artist}');`));
 let result=await read();assert.equal((await shows()).shows.length,1);assert.equal(result.artists.length,1);assert.equal(result.artists[0].artist_id,artist);assert.equal(result.confirmation,'event_and_artist_workspace');
 assert.deepEqual(Object.keys(result.artists[0]).sort(),['id','artist_id','event_id','artist_name','entity_type','slug','city','country','starts_at','ends_at','timezone','source_url','updated_at'].sort());assert.doesNotMatch(JSON.stringify(result.artists),/private|workspace|confirmed_by|initial_data/);pass('anonymous projection exposes only explicit public identity and dates');
 for(const listing of [artist,event]){
  for(const [column,bad,good] of [['publish_status','draft','published'],['marketplace_status','hidden',''],['moderation_status','flagged','clean']]){
   await query(`update zoi.listings set ${column}=${literal(bad)} where id='${listing}';`);assert.equal((await read()).artists.length,0);assert.equal((await shows()).shows.length,0);await query(`update zoi.listings set ${column}=${literal(good)} where id='${listing}';`);
  }
  await query(`update zoi.listings set owner_workspace_id=null where id='${listing}';`);assert.equal((await read()).artists.length,0);assert.equal((await shows()).shows.length,0);await query(`update zoi.listings set owner_workspace_id='${listing===artist?artistWs:ws}' where id='${listing}';`);
 }pass('both sides reject hidden, unpublished, moderated and transferred identities');
 for(const clause of ["status='withdrawn'","status='pending'","artist_confirmed_by=null","event_confirmed_by=null","ends_at=now()-interval '1 second'"]){await query(`begin;update zoi.artist_appearances set ${clause} where id='${appearance}';do $$begin if jsonb_array_length(public.event_artists('${event}')->'artists')<>0 or jsonb_array_length(public.artist_shows('${artist}')->'shows')<>0 then raise exception 'bad visibility';end if;end$$;rollback;`);}pass('withdrawal, pending, missing dual confirmation and past appearances remain invisible');
 await query(`update zoi.listings set slug='current-artist',entity_type='creator',moderation_status='cleared' where id='${artist}';`);result=await read(event,'authenticated');assert.equal(result.artists[0].slug,'current-artist');assert.equal(result.artists[0].entity_type,'creator');pass('current canonical identity and cleared moderation preserved');
 for(const unknown of [id(99),null])assert.deepEqual((await read(unknown)).artists,[]);await rejects('set role anon; select * from zoi.artist_appearances;',null,/permission denied/);pass('missing identities reveal nothing and raw table remains private');
 await query(`insert into zoi.artist_appearances select ('a0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,artist_id,event_id,artist_workspace,event_workspace,starts_at+n*interval '1 second',ends_at+n*interval '1 second',timezone,source_url,event_confirmed_by,artist_confirmed_by,status,version,created_by,initial_data,created_at,updated_at from zoi.artist_appearances cross join generate_series(1,110)n where id='${appearance}';`);
 result=await read();assert.equal(result.artists.length,100);assert.equal((await shows()).shows.length,100);assert.equal(result.artists[0].id,appearance);assert.deepEqual(result,await read());pass('bounded stable 100 appearance rows, no unbounded public response');
 await query(`create table zoi.categories(id integer primary key,slug text);insert into zoi.categories values(6,'events-entertainment');alter table zoi.listings add column primary_category_id integer;insert into zoi.workspaces values('053a5656-b19b-48a4-8721-65c4674f647c');insert into zoi.user_profiles(id,auth_user_id)values('21a04e78-e3b1-448e-8517-47aad25dd5da','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd');insert into zoi.workspace_members values('053a5656-b19b-48a4-8721-65c4674f647c','21a04e78-e3b1-448e-8517-47aad25dd5da','owner');`);
 const before=await query('select count(*) from zoi.listings;');assert.equal(await query(readFileSync(new URL('../../ops/verify-event-artists.sql',import.meta.url),'utf8')),'event_artists_rollback_checks_passed');assert.equal(await query('select count(*) from zoi.listings;'),before);pass('exact production rollback fixture passes and retains no generated listing rows');
 console.log(`${checks} event artist database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

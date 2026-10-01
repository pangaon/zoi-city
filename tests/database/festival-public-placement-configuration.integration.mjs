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
const port=15848;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA host';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql','20260930014346_private_business_inquiries.sql','20260930020814_festival_packages_and_applications.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await query(`alter table zoi.listings add column moderation_status text default 'clean';`);
 await query(readFileSync(new URL('../../supabase/migrations/20261001041345_festival_sponsor_placements.sql',import.meta.url),'utf8'));
 await query(readFileSync(new URL('../../supabase/migrations/20261001044543_festival_public_placement_configuration.sql',import.meta.url),'utf8'));
 const read=async(configuration='front',id=event,role='anon')=>JSON.parse(await query(`set role ${role};select public.festival_placement_configuration('${id}',${literal(configuration)});`));
 let r=await read();assert.equal(r.configuration_version,null);assert.deepEqual(Object.keys(r).sort(),['configuration','configuration_version','event_id','ok','server_time']);assert.equal(r.ok,true);assert.ok(Number.isFinite(Date.parse(r.server_time)));pass('anonymous empty configuration exposes only exact public fields');
 await query(`insert into zoi.festival_placement_scopes(event_id,workspace_id,configuration,version) values('${event}','${ws}','front',1);`);
 assert.equal((await read()).configuration_version,1);assert.equal((await read('front',event,'authenticated')).configuration_version,1);pass('anonymous and authenticated current public scope is readable');
 for(const conf of ['side','unrecognized','',null]){const v=conf===null?JSON.parse(await query(`set role anon;select public.festival_placement_configuration('${event}',null);`)):await read(conf);assert.equal(v.configuration_version,null);}
 assert.equal((await read('front','20000000-0000-4000-8000-999999999999')).configuration_version,null);pass('missing and unsupported scopes fail closed without private data');
 for(const [field,value,restore] of [['publish_status','draft','published'],['marketplace_status','hidden',null],['moderation_status','flagged','clean'],['moderation_status',null,'clean'],['entity_type','business','event']]){await query(`update zoi.listings set ${field}=${value===null?'NULL':literal(value)} where id='${event}';`);assert.equal((await read()).configuration_version,null);await query(`update zoi.listings set ${field}=${restore===null?'NULL':literal(restore)} where id='${event}';`);}
 pass('publication, visibility, moderation and event type gates checked');
 await query(`update zoi.listings set owner_workspace_id='10000000-0000-4000-8000-000000000002' where id='${event}';`);assert.equal((await read()).configuration_version,null);await query(`update zoi.listings set owner_workspace_id='${ws}' where id='${event}';`);assert.equal((await read()).configuration_version,1);pass('scope ownership must equal current listing ownership');
 await query(`update zoi.festival_placement_scopes set version=2 where event_id='${event}' and configuration='front';`);assert.equal((await read()).configuration_version,2);const old=JSON.parse(await query(`set role anon;select public.festival_placements_public('${event}','front',1);`));assert.deepEqual(old.placements,[]);pass('current revision discovery does not revive previous projection');
 assert.equal(await query(`select has_function_privilege('anon','public.festival_placement_configuration(uuid,text)','execute') and has_function_privilege('authenticated','public.festival_placement_configuration(uuid,text)','execute');`),'t');
 await rejects(`set role anon;select * from zoi.festival_placement_scopes`,null,/permission denied/);await rejects(`set role authenticated;select * from zoi.festival_placements`,null,/permission denied/);pass('narrow RPC grants do not expose private tables');
 console.log(`PASS ${checks} public placement configuration groups`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

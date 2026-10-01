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
const port=15529;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
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
 await query(`alter table zoi.user_profiles add column display_name text;alter table zoi.listings add column name text default 'QA business';update zoi.workspace_members set role='viewer' where profile_id='${member}';`);
 for(const file of ['20260930001738_business_operations_foundation.sql'])await query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await query(`alter table zoi.workspaces add column name text default 'Original',add column created_by_auth uuid,add column owner_profile_id uuid;`);
 await query(readFileSync(new URL('../../supabase/migrations/20261001014658_workspace_rename_owner_authority.sql',import.meta.url),'utf8'));
 const rename=(name,user=actor)=>query(`select public.workspace_rename('${ws}',${literal(name)});`,user);
 assert.equal(await rename('  Owner name  '),'t');assert.equal(await query(`select name from zoi.workspaces where id='${ws}';`),'Owner name');pass('owner rename returns true with trimmed authoritative name');
 for(const role of ['viewer','editor','member']){await query(`update zoi.workspace_members set role='${role}' where profile_id='${member}';`);await rejects(`select public.workspace_rename('${ws}','Denied');`,member,/insufficient_permission/);}pass('ordinary membership and editors cannot rename');
 await query(`update zoi.workspace_members set role='admin' where profile_id='${member}';`);assert.equal(await rename('Admin name',member),'t');pass('current admin can rename');
 await query(`delete from zoi.workspace_members where profile_id='${actor}';update zoi.workspaces set created_by_auth='${actor}' where id='${ws}';`);assert.equal(await rename('Creator name'),'t');pass('legacy creator without membership remains authorized');
 await query(`update zoi.workspaces set created_by_auth=null,owner_profile_id='${actor}' where id='${ws}';`);assert.equal(await rename('Profile owner name'),'t');pass('legacy profile owner remains authorized');
 await query(`update zoi.workspaces set owner_profile_id=null where id='${ws}';`);await rejects(`select public.workspace_rename('${ws}','Revoked');`,actor,/insufficient_permission/);await rejects(`select public.workspace_rename('${ws}','Unrelated');`,other,/insufficient_permission/);pass('revoked owner and unrelated actor denied');
 await rejects(`set role anon;select public.workspace_rename('${ws}','Anonymous');`,null,/permission denied/);await rejects(`set role authenticated;select public.workspace_rename('${ws}','No actor');`,null,/not_authorized/);pass('anonymous and no-actor callers denied');
 for(const name of ['', ' '.repeat(4),'a'.repeat(121)])await rejects(`select public.workspace_rename('${ws}',${literal(name)});`,member,/invalid_workspace_name/);pass('blank and oversized names rejected');
 assert.equal(await query(`select name from zoi.workspaces where id='${ws}';`),'Profile owner name');pass('rejections preserve current workspace identity');
 console.log(`${checks} workspace rename authority checks passed`);

}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

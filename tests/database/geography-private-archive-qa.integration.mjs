import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync,execFile} from 'node:child_process';import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'zoi-archive-qa-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:'15711',PGDATABASE:'postgres'};let started=false,checks=0;
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const budget=()=>JSON.parse(q('set role service_role;select public.geography_source_archive_budget()'));
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 15711 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 q("create schema storage;create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema storage to anon,authenticated,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id integer primary key,bucket_id text,metadata jsonb);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;create policy existing_permissive on storage.objects for all to anon,authenticated using(true)with check(true);");
 q(readFileSync(new URL('../../supabase/migrations/20261014130713_geography_source_private_archive.sql',import.meta.url),'utf8'));
 q("insert into storage.objects values(1,'geography-source-evidence','{\"size\":100}'),(2,'other','{\"size\":200}')");
 for(const role of ['anon','authenticated']) {
  assert.equal(q(`set role ${role};select count(*)from storage.objects`),'1');checks++;
  assert.throws(()=>q(`set role ${role};insert into storage.objects values(3,'geography-source-evidence','{}')`),/row-level security/);checks++;
  assert.equal(q(`set role ${role};with d as(delete from storage.objects where bucket_id='geography-source-evidence'returning*)select count(*)from d`),'0');checks++;
  assert.throws(()=>q(`set role ${role};select public.geography_source_archive_budget()`),/permission denied/);checks++;
 }
 assert.equal(budget().stored_bytes,300);assert.equal(budget().can_archive,true);checks++;
 q("insert into storage.objects values(3,'other','{}')");assert.equal(budget().can_archive,false);assert.equal(budget().unknown_size_objects,1);checks++;
 q("update storage.objects set metadata='{\"size\":-1}'where id=3");assert.equal(budget().can_archive,false);checks++;
 q("update storage.objects set metadata=jsonb_build_object('size',536870912-15000000-300)where id=3");assert.equal(budget().can_archive,true);checks++;
 q("update storage.objects set metadata=jsonb_build_object('size',536870912-15000000-299)where id=3");assert.equal(budget().can_archive,false);checks++;
 assert.equal(q("select public from storage.buckets where id='geography-source-evidence'"),'f');checks++;
 assert.equal(q("select file_size_limit from storage.buckets where id='geography-source-evidence'"),'2097152');checks++;
 q('create schema zoi;grant usage on schema zoi to anon,authenticated,service_role');q(readFileSync(new URL('../../supabase/migrations/20261014140218_geography_source_capture_single_flight.sql',import.meta.url),'utf8'));
for(const role of ['anon','authenticated']){assert.throws(()=>q(`set role ${role};select public.geography_source_capture_acquire('11111111-1111-4111-8111-111111111111')`),/permission denied/);checks++;assert.throws(()=>q(`set role ${role};select*from zoi.geography_source_capture_lock`),/permission denied/);checks++;}
const acquire=id=>JSON.parse(q(`set role service_role;select public.geography_source_capture_acquire('${id}')`)),release=id=>JSON.parse(q(`set role service_role;select public.geography_source_capture_release('${id}')`));const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';assert.equal(acquire(a).acquired,true);checks++;assert.equal(acquire(a).acquired,false);checks++;assert.equal(acquire(b).acquired,false);checks++;assert.equal(release(b).released,false);checks++;assert.equal(acquire(b).acquired,false);checks++;assert.equal(release(a).released,true);checks++;assert.equal(acquire(b).acquired,true);checks++;q("update zoi.geography_source_capture_lock set expires_at=clock_timestamp()-interval'1second'");assert.equal(acquire(a).acquired,true);checks++;assert.equal(release(b).released,false);checks++;release(a);
const parallel=id=>new Promise((resolve,reject)=>execFile(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',`set role service_role;begin;select public.geography_source_capture_acquire('${id}');select pg_sleep(0.15);commit;`],{env,encoding:'utf8'},(err,stdout)=>err?reject(err):resolve(JSON.parse(stdout.trim().split('\n')[0]))));const simultaneous=await Promise.all([parallel(a),parallel(b)]);assert.equal(simultaneous.filter(x=>x.acquired).length,1);checks++;assert.equal(release(simultaneous.find(x=>x.acquired).lease_id).released,true);checks++;
console.log(JSON.stringify({pass:true,checks,kind:'Real PostgreSQL restrictive policy against existing permissive policies; all Storage objects quota and unknown-size refusal',production:false}));
} finally {if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

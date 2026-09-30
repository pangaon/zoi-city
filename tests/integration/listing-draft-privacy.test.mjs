import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawn} from 'node:child_process';
const container=process.env.ZOI_TEST_POSTGRES_CONTAINER;let db='postgres';function sql(q){return new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('close',n=>n?reject(Error(err)):resolve(out.trim()));p.stdin.end(q);});}const file=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('actual listing trigger preserves explicit drafts while maintaining existing quality-gated publication and metadata',{skip:!container},async t=>{
 const name='listing_draft_'+process.pid;await sql('create database '+name);db=name;t.after(async()=>{db='postgres';await sql('drop database '+name);});
 await sql(`create schema zoi;create table zoi.listings(id uuid primary key default gen_random_uuid(),name text,entity_type text,primary_category_id bigint,city text,country text,phone text,address text,website text,publish_status text,profile jsonb,completeness_score numeric);
 -- Controlled dependency isolates the trigger's decision from quality scoring internals.
 create function zoi.publish_gate(text,text,bigint,text,text,text,text,text) returns jsonb language sql as $$select jsonb_build_object('ok',$1='Quality passes','fails',case when $1='Quality passes' then '[]'::jsonb else '["quality_failed"]'::jsonb end,'warnings','["fixture_warning"]'::jsonb,'quality_score',case when $1='Quality passes' then 87 else 12 end)$$;`);
 await sql(file('../fixtures/listing-publish-trigger-before.sql'));
 await sql('create trigger listings_publish_gate before insert on zoi.listings for each row execute function zoi.tg_apply_publish_gate();');
 assert.equal(await sql("insert into zoi.listings(name,publish_status) values('Quality passes','draft') returning publish_status;"),'published','reproduces reviewed production bug');
 const oldRow=await sql('select to_jsonb(l) from zoi.listings l;');
 await sql(file('../../supabase/migrations/20260930015254_preserve_explicit_listing_drafts.sql'));
 assert.equal(await sql('select to_jsonb(l) from zoi.listings l;'),oldRow,'migration does not mutate preexisting rows');
 for(const status of ['draft','published',null,'pending_review','hidden','archived'])for(const good of [true,false]){
  const row=JSON.parse(await sql(`insert into zoi.listings(name,publish_status,profile,completeness_score) values('${good?'Quality passes':'Quality fails'}',${status===null?'NULL':"'"+status+"'"},'{"custom":"preserved","gate":{"original":true}}',0.555) returning to_jsonb(listings);`));
  const expected=status==='draft'?'draft':status===null||status==='published'?(good?'published':'pending_review'):status;
  assert.equal(row.publish_status,expected);assert.equal(row.profile.custom,'preserved');
  if(['draft','published',null].includes(status)){assert.equal(row.profile.gate.ok,good);assert.deepEqual(row.profile.gate.fails,good?[]:['quality_failed']);assert.deepEqual(row.profile.gate.warnings,['fixture_warning']);assert.match(row.profile.gate.checked_at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);assert.equal(row.completeness_score,good?.87:.12);}else{assert.deepEqual(row.profile.gate,{original:true});assert.equal(row.completeness_score,.555);}
 }
 assert.deepEqual(JSON.parse(await sql("select to_jsonb(proconfig) from pg_proc where oid='zoi.tg_apply_publish_gate()'::regprocedure;")),['search_path=""']);
});

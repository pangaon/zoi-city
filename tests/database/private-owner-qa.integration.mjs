import{mkdtempSync,readFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{execFileSync}from'node:child_process';import assert from'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'zoi-private-owner-')),bin='/usr/lib/postgresql/16/bin',env={...process.env,PGHOST:dir,PGPORT:'15729',PGDATABASE:'postgres'},fixture='48c711ee-e83b-4ce2-a7cc-4126d713048a';let started=false;
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const setup=readFileSync(new URL('../../ops/private-owner-qa/provision.sql',import.meta.url),'utf8'),cleanup=readFileSync(new URL('../../ops/private-owner-qa/cleanup.sql',import.meta.url),'utf8');
try{execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 15729 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
q(`create schema zoi;create table zoi.user_profiles(id uuid,auth_user_id uuid);create table zoi.workspace_members(workspace_id uuid,profile_id uuid,role text);create table zoi.categories(id bigint,slug text);create table zoi.listings(id uuid primary key,name text,slug text unique,entity_type text,primary_category_id bigint,owner_workspace_id uuid,publish_status text,marketplace_status text,moderation_status text,profile jsonb,website text,email text,phone text,description text,photo_url text,hours text,price_range text,social_links jsonb);create table zoi.home_designs(listing_id uuid);create table zoi.home_content_requests(listing_id uuid references zoi.listings,workspace_id uuid,actor_id uuid,request_id uuid,payload jsonb,receipt jsonb,primary key(actor_id,request_id));create function public.home_design_public(uuid) returns jsonb language sql as $$select null::jsonb$$;insert into zoi.categories values(21,'restaurants');insert into zoi.user_profiles values('21a04e78-e3b1-448e-8517-47aad25dd5da','2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd');insert into zoi.workspace_members values('053a5656-b19b-48a4-8721-65c4674f647c','21a04e78-e3b1-448e-8517-47aad25dd5da','owner');`);
q(setup);assert.equal(q(`select publish_status||'/'||marketplace_status from zoi.listings where id='${fixture}'`),'draft/hidden');assert.throws(()=>q(setup),/qa_fixture_already_exists/);console.log('PASS unchanged create-only setup refuses existing fixture');
const captured=JSON.parse(readFileSync(new URL('../fixtures/private-owner-archived.json',import.meta.url),'utf8')),reactivate=readFileSync(new URL('../../ops/private-owner-qa/reactivate.sql',import.meta.url),'utf8'),lit=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb",old='678a541a-c3dc-4cb0-96f5-6d67a1539b54',next='fd78dcbc-6164-4658-8e87-1b5e38debe9c',workspace='053a5656-b19b-48a4-8721-65c4674f647c',actor='21a04e78-e3b1-448e-8517-47aad25dd5da';
const restore=()=>q(`delete from zoi.home_content_requests;update zoi.listings set profile=${lit(captured.profile)},publish_status='archived',marketplace_status='hidden',description=null,owner_workspace_id='${workspace}';insert into zoi.home_content_requests values('${fixture}','${workspace}','${actor}','${old}',${lit(captured.payload)},${lit(captured.receipt)});`);
restore();assert.equal(q(`select md5(profile::text) from zoi.listings`),'729f2ce7922ccbbb018ae911ba543b53');assert.equal(q('select md5(payload::text) from zoi.home_content_requests'),'b24a2313e2ca31b54b3081b238408535');assert.equal(q('select md5(receipt::text) from zoi.home_content_requests'),'49fa7f303ceaa706d9ed11b7367afba9');console.log('PASS exact captured private profile and immutable receipt hashes');
q("update zoi.listings set publish_status='published'");assert.throws(()=>q(reactivate),/qa_reactivation_fingerprint_mismatch/);assert.throws(()=>q(cleanup),/qa_cleanup_fingerprint_mismatch/);restore();console.log('PASS unexpected publication rejected');
q('update zoi.listings set owner_workspace_id=gen_random_uuid()');assert.throws(()=>q(reactivate),/qa_reactivation_fingerprint_mismatch/);assert.throws(()=>q(cleanup),/qa_cleanup_fingerprint_mismatch/);restore();console.log('PASS transferred ownership rejected');
q("update zoi.workspace_members set role='editor'");assert.throws(()=>q(reactivate),/qa_identity_mismatch/);q("update zoi.workspace_members set role='owner'");console.log('PASS non-owner membership rejected');
q(`update zoi.listings set profile=profile||'{"unexpected":"edit"}'::jsonb`);assert.throws(()=>q(reactivate),/qa_reactivation_fingerprint_mismatch/);restore();console.log('PASS concurrent profile drift rejected');
q(`update zoi.home_content_requests set payload=payload||'{"unexpected":true}'::jsonb`);assert.throws(()=>q(reactivate),/qa_reactivation_receipt_mismatch/);assert.throws(()=>q(cleanup),/qa_prior_receipt_mismatch/);restore();console.log('PASS immutable receipt/payload drift rejected');
q(`insert into zoi.home_content_requests select listing_id,workspace_id,actor_id,gen_random_uuid(),payload,receipt from zoi.home_content_requests`);assert.throws(()=>q(reactivate),/qa_reactivation_receipt_mismatch/);assert.throws(()=>q(cleanup),/qa_unexpected_content_write/);restore();console.log('PASS unknown additional receipt rejected');
q(reactivate);assert.equal(q('select publish_status from zoi.listings'),'draft');assert.equal(q(`select profile->>'_qa_cleanup' from zoi.listings`),'reactivated:'+next);assert.equal(q('select count(*) from zoi.home_content_requests'),'1');assert.throws(()=>q(reactivate),/qa_reactivation_fingerprint_mismatch/);q(cleanup);q(cleanup);assert.throws(()=>q(reactivate),/qa_reactivation_fingerprint_mismatch/);console.log('PASS activation is one-use even when no new save occurred; cleanup idempotent');
restore();q(reactivate);const payload={...captured.payload,expected_version:'a'.repeat(32)},receipt={...captured.receipt,request_id:next,version:'b'.repeat(32)};q(`insert into zoi.home_content_requests values('${fixture}','${workspace}','${actor}','${next}',${lit(payload)},${lit(receipt)});update zoi.listings set description=${lit(captured.payload.base.description)}#>>'{}',profile=profile||${lit(captured.payload.profile)};`);q(cleanup);assert.equal(q('select count(*) from zoi.home_content_requests'),'2');assert.equal(q(`select publish_status||'/'||marketplace_status from zoi.listings`),'archived/hidden');assert.equal(q(`select count(*) from zoi.home_content_requests where request_id='${old}' and md5(receipt::text)='49fa7f303ceaa706d9ed11b7367afba9'`),'1');q(cleanup);assert.throws(()=>q(reactivate),/qa_reactivation_fingerprint_mismatch/);console.log('PASS successful second save retained alongside untouched first receipt, no replay');
q(`update zoi.home_content_requests set payload=jsonb_set(payload,'{base,description}','"Unexpected content"'::jsonb) where request_id='${next}'`);assert.throws(()=>q(cleanup),/qa_new_receipt_mismatch/);console.log('PASS second request must match reviewed synthetic content exactly');


for(const [label,change] of [
 ['description',"description='Real owner description'"],
 ['menu',`profile=profile||' {"menu":[{"section":"Real menu","items":[{"name":"Owner dish","price":"20"}]}]}'::jsonb`],
 ['promotion',`profile=profile||'{"specials":[{"name":"Real promotion","when":"Friday"}]}'::jsonb`],
 ['nonempty promotion object',`profile=profile||'{"specials":{"name":"Unexpected"}}'::jsonb`]
]){
 restore();q(reactivate);q(`update zoi.listings set ${change}`);
 const before=q('select to_jsonb(l)::text from zoi.listings l');
 assert.throws(()=>q(cleanup),/qa_cleanup_content_drift/);
 assert.equal(q('select to_jsonb(l)::text from zoi.listings l'),before);
 assert.equal(q('select count(*) from zoi.home_content_requests'),'1');
 console.log('PASS cleanup preserves unexpected current '+label+' and receipts');
}
for(const state of ['absent','null','empty']){
 restore();q(reactivate);
 if(state==='null')q(`update zoi.listings set profile=profile||'{"menu":null,"specials":null}'::jsonb`);
 if(state==='empty')q(`update zoi.listings set profile=profile||'{"specials":[]}'::jsonb`);
 q(cleanup);q(cleanup);assert.equal(q(`select (description is null and not profile?'menu' and not profile?'specials')::text from zoi.listings`),'true');
 console.log('PASS cleanup accepts '+state+' cleared content and remains idempotent');
}

}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

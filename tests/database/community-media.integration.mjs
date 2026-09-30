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
const port=15494;const env={...process.env,PGHOST:dir,PGPORT:String(port),PGDATABASE:'postgres'};
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003',ws='10000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000001';
const literal=x=>"'"+String(x).replace(/'/g,"''")+"'";
const sql=(query,user)=>`${user?`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`:''}${query}`;
async function query(q,user){let r;try{r=await run(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql(q,user)],{env});}catch(e){throw Object.assign(new Error(e.stderr),{stderr:e.stderr});}return r.stdout.trim().split('\n').filter(Boolean).at(-1);}
async function rejects(q,user,pattern){try{await query(q,user);assert.fail('Expected SQL rejection');}catch(e){assert.match(e.stderr||e.message,pattern);}}
let started=false,checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'server.log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 await query(readFileSync(new URL('./community-fixture.sql',import.meta.url),'utf8'));
 await query("create schema storage;create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;grant all on storage.objects to authenticated;grant usage on schema storage to authenticated;create policy broad_legacy on storage.objects for all to authenticated using(true) with check(true);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 let migration=readFileSync(new URL('../../supabase/migrations/20260930042430_community_profiles_graph_and_personal_feeds.sql',import.meta.url),'utf8');
 await query(migration);
 await query(readFileSync(new URL('../../supabase/migrations/20260930042431_community_private_media_publish.sql',import.meta.url),'utf8'));
 const call=(fn,args='',user=actor)=>query(`select public.${fn}(${args});`,user).then(JSON.parse),j=x=>literal(JSON.stringify(x))+'::jsonb',req=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await query(`insert into zoi.user_profiles(id,auth_user_id) values('${req(1)}','${actor}'),('${req(2)}','${other}');`);
 const metadata={type:'image',mime_type:'image/png',width:512,height:512,duration_seconds:null};
 const begin=(n,user=actor,purpose='post',mime='image/png')=>call('community_media_begin',`'${req(n)}','${purpose}','${mime}',100,'${'a'.repeat(64)}',${j(metadata)}`,user);
 await rejects("insert into storage.objects values(gen_random_uuid(),'community-private');",actor,/row-level security/);pass('restrictive bucket fence overrides broad legacy storage policy');
 await rejects("select public.feed_post('Fake',null,null,'[\"https://csebihpaychdkanjjsmz.supabase.co/storage/v1/object/public/media/forged.png\"]');",actor,/verified_media_required/);pass('legacy caller cannot publish forged storage URLs');
 const a=await begin(10);assert.equal(a.state,'pending');assert.equal((await begin(10)).id,a.id);pass('upload intent exact retry is stable');
 await rejects(`select public.community_media_finish('${a.id}');`,actor,/permission denied/);await rejects(`select * from zoi.community_media_assets;`,other,/permission denied/);pass('clients cannot finalize or read private asset ledger');
 await rejects(`select public.community_media_begin('${req(10)}','post','image/png',101,'${'a'.repeat(64)}',${j(metadata)});`,actor,/request_payload_changed/);
 await call('community_media_finish',`'${a.id}'`,null);await rejects(`select public.community_media_read('${a.id}');`,null,/media_unavailable/);pass('ready unposted upload stays private');
 await rejects(`select public.community_publish('${req(20)}','My post',array['${a.id}']::uuid[]);`,other,/invalid_post_media/);
 const ctx={intent:'moment',topics:['culture'],media_alts:{[a.id]:'Family recipe on a plate'}};
 const publish=()=>call('community_publish',`'${req(20)}','My post',array['${a.id}']::uuid[],null,${j(ctx)}`);
 const receipts=await Promise.all([publish(),publish()]);assert.equal(receipts[0].id,receipts[1].id);const post=receipts[0].id;
 assert.equal(await query('select count(*) from zoi.feed_posts;'),'1');const read=await call('community_post_get',`'${post}'`);assert.equal(read.post.media[0].alt,'Family recipe on a plate');assert.equal(read.post.media[0].id,a.id);assert.ok((await call('community_media_read',`'${a.id}'`,null)).path);pass('concurrent publish creates one post with exact verified media and authored alt');
 await rejects(`select public.community_publish('${req(20)}','Changed',array['${a.id}']::uuid[]);`,actor,/request_payload_changed/);await rejects(`select public.community_media_discard('${a.id}');`,actor,/media_in_use/);pass('published attachments cannot be discarded and request cannot be altered');
 const b=await begin(11);await call('community_media_finish',`'${b.id}'`,null);await rejects(`select public.community_publish('${req(21)}','Bad context',array['${b.id}']::uuid[],null,'{"topics":["fake"]}');`,actor,/community_invalid_topics/);assert.equal(await query('select count(*) from zoi.feed_posts;'),'1');pass('context validation failure rolls back post insertion');
 await call('community_media_discard',`'${b.id}'`);await rejects(`select public.community_publish('${req(22)}','Discarded',array['${b.id}']::uuid[]);`,actor,/invalid_post_media/);pass('discarded uploads cannot be published');
 const c=await begin(12,actor,'avatar');await call('community_media_finish',`'${c.id}'`,null);await call('community_profile_save',`0,${j({handle:'media_member',display_name:'Member',interests:[],avatar_media_id:c.id})}`);assert.ok((await call('community_media_read',`'${c.id}'`,null)).path);await rejects(`select public.community_media_discard('${c.id}');`,actor,/media_in_use/);pass('explicit chosen avatar is public while other assets remain private');
 await query(`update zoi.community_media_assets set created_at=now()-interval '2 days';`);const cleanup=await call('community_media_cleanup','',null);assert.equal(cleanup.paths.length,1);assert.ok(cleanup.paths[0].endsWith(b.id));await query(`select public.community_media_cleanup_finish(array['${cleanup.paths[0]}']);`);assert.equal((await call('community_media_cleanup','',null)).paths.length,0);pass('cleanup skips attached posts and avatars and acknowledges object deletion');
 await query(`update zoi.feed_posts set status='hidden' where id='${post}';`);await rejects(`select public.community_media_read('${a.id}');`,null,/media_unavailable/);pass('hidden post loses stable public media access');
 const d=await begin(13,other,'avatar');await call('community_media_finish',`'${d.id}'`,null);await query(`update zoi.community_media_assets set created_at=now()-interval '2 days' where id='${d.id}';`);
 const profileTransaction=query(`begin;select public.community_profile_save(0,${j({handle:'second_member',display_name:'Second',interests:[],avatar_media_id:d.id})});select pg_sleep(0.25);commit;`,other);
 await new Promise(resolve=>setTimeout(resolve,70));await call('community_media_cleanup','',null);await profileTransaction;assert.equal(await query(`select state from zoi.community_media_assets where id='${d.id}';`),'ready');pass('concurrent avatar publication prevents cleanup from discarding referenced media');
 console.log(`${checks} community media database checks passed`);
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execAsync=promisify(execFile);
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'zoi-geography-')),bin='/usr/lib/postgresql/16/bin';
const env={...process.env,PGHOST:dir,PGPORT:'15667',PGDATABASE:'postgres'};
const id='40000000-0000-4000-8000-000000000001';let started=false,serial=0,passed=0;
const q=s=>execFileSync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',s],{env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const quote=s=>"'"+s.replaceAll("'","''")+"'",j=x=>quote(JSON.stringify(x))+'::jsonb';
const request=()=> '50000000-0000-4000-8000-'+String(++serial).padStart(12,'0');
const snapshot=()=>q(`select zoi.geography_fingerprint(l) from zoi.listings l where id='${id}'`);
const pass=s=>{passed++;console.log('PASS '+s)};
function proposal(){
 const report={schema:1,kind:'official_coordinate_dry_run',http_status:200,snapshot_sha256:'b'.repeat(64),listing_id:id,status:'review_required',reason:'coordinate_plausibility_review_required',source_fingerprint:q(`select zoi.listing_quality_fingerprint(l) from zoi.listings l where id='${id}'`),source_url:'https://example.org/location/',source_sha256:'a'.repeat(64),candidate:{name:'QA exact place',evidence_kind:'jsonld',address:{street:'1 Test Street',city:'Melbourne',country:'Australia'},latitude:-37.8110808,longitude:144.9670491,precision:'source_published'}};
 const text=JSON.stringify(report),expected=snapshot();
 const review={official_source_confirmed:true,stored_address:'1 Test Street',stored_city:'Melbourne',stored_country:'Australia',candidate_address:report.candidate.address,database_snapshot:expected,report_sha256:createHash('sha256').update(text).digest('hex'),specialist:'source-specialist',reviewer:'independent-reviewer',reviewed_at:new Date().toISOString(),exact_address_confirmed:true,not_area_centroid:true,locality_extent:{south:-38,north:-37,west:144,east:145,source_url:'https://example.org/locality/'}};
 return {report,text,expected,review,request:request()};
}
const sql=p=>`select public.geography_review_apply('${p.request}','${id}',${quote(p.expected)},${quote(p.text)},${j(p.review)})`;
const apply=p=>JSON.parse(q('set role service_role;'+sql(p)));
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-A','trust','--no-locale'],{stdio:'ignore'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 15667 -c listen_addresses=''`,'-w','start'],{stdio:'ignore'});started=true;
 q(`create schema zoi;create schema extensions;create extension pgcrypto with schema extensions;create role anon;create role authenticated;create role service_role;
 create table zoi.listings(id uuid primary key,name text,address text,city text,country text,entity_type text,website text,source_url text,primary_category_id bigint,owner_workspace_id uuid,owner_user_id uuid,publish_status text,moderation_status text,marketplace_status text,profile jsonb,latitude double precision,longitude double precision,geo_precision text,updated_at timestamptz);
 insert into zoi.listings values('${id}','QA exact place','1 Test Street','Melbourne','Australia','business','https://example.org','https://example.org',1,null,null,'published','clean',null,'{"_enrich":{"rooms":[{"name":"Keep"}]},"owner_note":"Preserve","_geo":{"precision":"approx","old":true}}',-37.8136,144.9631,'approx',now());`);
 const source=readFileSync(new URL('../../supabase/migrations/20260930053625_listing_quality_coverage.sql',import.meta.url),'utf8');
 q(source.match(/CREATE FUNCTION zoi\.listing_quality_fingerprint\(l zoi\.listings\)[\s\S]*?\$\$;/)[0]);
 q(readFileSync(new URL('../../supabase/migrations/20261001035423_reviewed_geography_apply.sql',import.meta.url),'utf8'));
 const prior=JSON.parse(q(`select to_jsonb(l) from zoi.listings l where id='${id}'`));
 let p=proposal(),r=apply(p);assert.equal(r.precision,'street');assert.deepEqual(apply(p),r);
 assert.deepEqual(JSON.parse(q(`select profile-'_geo' from zoi.listings where id='${id}'`)),{_enrich:prior.profile._enrich,owner_note:'Preserve'});
 assert.equal(q(`select count(*) from zoi.geography_reviews`),'1');pass('actual writer updates reviewed coordinates once and preserves unrelated imported/owner fields');
 assert.throws(()=>apply({...p,review:{...p.review,reviewer:'changed'}}),/geography_request_conflict/);
 const after=snapshot();q(`update zoi.listings set name='Concurrent edit' where id='${id}'`);
 assert.throws(()=>apply(p),/geography_snapshot_changed/);assert.throws(()=>q(`set role service_role;select public.geography_review_revert('${p.request}','${after}')`),/geography_snapshot_changed/);
 q(`update zoi.listings set name='QA exact place' where id='${id}'`);
 const rev=`select public.geography_review_revert('${p.request}','${after}')`;
 assert.equal(JSON.parse(q('set role service_role;'+rev)).reverted,true);assert.equal(JSON.parse(q('set role service_role;'+rev)).reverted,true);
 const restored=JSON.parse(q(`select to_jsonb(l) from zoi.listings l where id='${id}'`));
 for(const key of ['latitude','longitude','geo_precision','profile'])assert.deepEqual(restored[key],prior[key]);
 assert.throws(()=>apply(p),/geography_review_reverted/);pass('changed payload and intervening edit refuse replay/revert; exact reversal restores previous geography only');
 p=proposal();q(`update zoi.listings set owner_workspace_id='20000000-0000-4000-8000-000000000001' where id='${id}'`);assert.throws(()=>apply(p),/geography_listing_unavailable/);q(`update zoi.listings set owner_workspace_id=null,moderation_status=null where id='${id}'`);assert.throws(()=>apply(p),/geography_listing_unavailable/);q(`update zoi.listings set moderation_status='clean' where id='${id}'`);
 p=proposal();q(`update zoi.listings set website='https://changed.org' where id='${id}'`);assert.throws(()=>apply(p),/geography_snapshot_changed/);q(`update zoi.listings set website='https://example.org' where id='${id}'`);pass('owner transfer, unknown moderation and source changes refuse reviewed writes');
 for(const change of [v=>v.review.reviewer=v.review.specialist,v=>v.review.reviewer=' SOURCE-SPECIALIST ',v=>v.review.reviewer='   ',v=>v.review.exact_address_confirmed=false,v=>v.review.not_area_centroid=false,v=>v.review.reviewed_at='2000-01-01',v=>v.review.report_sha256='0'.repeat(64),v=>v.review.locality_extent.south=0]){
  p=proposal();change(p);assert.throws(()=>apply(p),/independent_geography_review_required|geography_review_expired|geography_outside_reviewed_locality/);
 }
 for(const change of [v=>v.report.candidate.name='Other branch',v=>v.report.kind='unknown',v=>v.report.http_status=404,v=>v.review.candidate_address={},v=>v.report.candidate.precision='city',v=>v.report.candidate.latitude=0,v=>v.report.source_url='https://other.org/place']){
  p=proposal();change(p);p.text=JSON.stringify(p.report);p.review.report_sha256=createHash('sha256').update(p.text).digest('hex');assert.throws(()=>apply(p),/geography_locality_evidence_required|geography_outside_reviewed_locality|geography_source_mismatch|geography_identity_review_required/);
 }
 // Prefix scoping must not accept URLs that normalize into a sibling property.
 q(`update zoi.listings set website='https://example.org/property-a' where id='${id}'`);
 const ambiguousPaths=['/property-a/../property-b','/property-a/./location','/property-a/%2e%2e/property-b','/property-a/.%2E/property-b','/property-a/%2Fproperty-b','/property-a/%5cproperty-b','/property-a/%252e%252e/property-b','/property-a//location','/property-a/'+String.fromCharCode(92)+'property-b'];
 for(const path of ambiguousPaths){
  p=proposal();p.report.source_url='https://example.org'+path;p.text=JSON.stringify(p.report);p.review.report_sha256=createHash('sha256').update(p.text).digest('hex');
  assert.throws(()=>apply(p),/geography_source_path_noncanonical/);
 }
 p=proposal();p.report.source_url='https://example.org/property-ab/location';p.text=JSON.stringify(p.report);p.review.report_sha256=createHash('sha256').update(p.text).digest('hex');assert.throws(()=>apply(p),/geography_identity_review_required/);
 for(const path of ambiguousPaths){
  q(`update zoi.listings set website=${quote('https://example.org'+path)} where id='${id}'`);p=proposal();p.report.source_url='https://example.org'+path;p.text=JSON.stringify(p.report);p.review.report_sha256=createHash('sha256').update(p.text).digest('hex');
  assert.throws(()=>apply(p),/geography_source_path_noncanonical/);
 }
 q(`update zoi.listings set website='https://example.org' where id='${id}'`);
 assert.equal(q('select count(*) from zoi.geography_reviews'),'1');pass('missing independent proof, stale review, hash mismatch, coarse precision and wrong locality/source never mutate');
 q(`update zoi.listings set website='https://example.org/property-a/' where id='${id}'`);p=proposal();p.report.source_url='https://example.org/property-a/location/?language=en#address';p.text=JSON.stringify(p.report);p.review.report_sha256=createHash('sha256').update(p.text).digest('hex');const scoped=apply(p);q(`set role service_role;select public.geography_review_revert('${p.request}','${scoped.after_snapshot}')`);q(`update zoi.listings set website='https://example.org' where id='${id}'`);
 q(`update zoi.listings set profile=null where id='${id}'`);p=proposal();apply(p);const nullAfter=snapshot();q(`set role service_role;select public.geography_review_revert('${p.request}','${nullAfter}')`);assert.equal(q(`select profile is null from zoi.listings where id='${id}'`),'t');pass('exact rollback preserves an originally SQL-null profile');
 for(const profile of ['null','[]','1','"text"']){q(`update zoi.listings set profile=null where id='${id}'`);p=proposal();q(`update zoi.listings set profile=${quote(profile)}::jsonb where id='${id}'`);assert.throws(()=>apply(p),/geography_profile_shape_invalid/);}q(`update zoi.listings set profile=null where id='${id}'`);pass('non-object profile JSON cannot be promoted into malformed geographic provenance');
 const concurrent=code=>execAsync(join(bin,'psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c','set role service_role;'+code],{env,encoding:'utf8'});
 p=proposal();const copies=await Promise.all([concurrent(sql(p)),concurrent(sql(p))]);assert.deepEqual(JSON.parse(copies[0].stdout),JSON.parse(copies[1].stdout));
 q(`set role service_role;select public.geography_review_revert('${p.request}','${snapshot()}')`);
 const one=proposal(),two=proposal();two.report.candidate.latitude=-37.82;two.text=JSON.stringify(two.report);two.review.report_sha256=createHash('sha256').update(two.text).digest('hex');
 const race=await Promise.allSettled([concurrent(sql(one)),concurrent(sql(two))]);assert.equal(race.filter(v=>v.status==='fulfilled').length,1);assert.match(race.find(v=>v.status==='rejected').reason.stderr,/geography_snapshot_changed/);const winner=JSON.parse(race.find(v=>v.status==='fulfilled').value.stdout);assert.equal(winner.after_snapshot,snapshot());
 q(`set role service_role;select public.geography_review_revert('${winner.request_id}','${winner.after_snapshot}')`);pass('concurrent identical requests replay once; competing reviewed coordinates cannot overwrite one another');
 for(const role of ['anon','authenticated']){assert.equal(q(`select has_function_privilege('${role}','public.geography_review_apply(uuid,uuid,text,text,jsonb)','execute')`),'f');assert.equal(q(`select has_function_privilege('${role}','public.geography_review_revert(uuid,text)','execute')`),'f');assert.throws(()=>q(`set role ${role};select * from zoi.geography_reviews`),/permission denied/);}
 assert.equal(q("select has_function_privilege('service_role','public.geography_review_apply(uuid,uuid,text,text,jsonb)','execute')"),'t');pass('only privileged reviewed-source service can apply or reverse; evidence ledger remains private');
 console.log(passed+' geography database groups passed');
}finally{if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'ignore'});rmSync(dir,{recursive:true,force:true});}

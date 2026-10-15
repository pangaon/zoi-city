import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,readdir,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {sha256} from '../../scripts/quality/evidence.mjs';
import {runGeographyCapture} from '../../scripts/geography/process-repair-jobs.mjs';
const root=new URL('../../',import.meta.url),key='fixture-service-private',token='c'.repeat(40),url='https://csebihpaychdkanjjsmz.supabase.co',bucket='fixture-archive-private',body=Buffer.from('<p>Ελληνικά exact original source</p>'),hash=sha256(body),job={id:'00000000-0000-4000-8000-000000000001',lease_id:'00000000-0000-4000-8000-000000000002',status:'leased'},result=()=>({status:'unresolved',reason:'matching_structured_coordinates_missing',source:{pages:[{url:'https://official.example/',sha256:hash,http_status:200}]},precision:'unknown',confidence:'unresolved'}),env={SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,GEOGRAPHY_REPAIR_PRIVATE_BUCKET:bucket,GEOGRAPHY_REPAIR_TOKEN:token,GEOGRAPHY_REPAIR_SOURCE_ENABLED:'on'};
const temporary=[];async function directory(){const d=await mkdtemp('/tmp/zoi-archive-completion-test-');temporary.push(d);return d;}
const originalFetch=globalThis.fetch;
globalThis.Deno={env:{get:k=>env[k]},serve(){},makeTempDir:({dir,prefix})=>mkdtemp(dir+'/'+prefix),mkdir,writeTextFile:writeFile,writeFile,readFile,remove:(p,o)=>rm(p,{recursive:o.recursive})};
const {createHandler}=await import('../../supabase/functions/geography-repair-source-consumer/index.ts');
function transport({failure,publicBucket=false,jobs=[job],budget,finishStatus}={}){
 const calls=[],archive=new Map();let acquired;
 const fetcher=async(raw,options={})=>{
  const u=new URL(raw),path=u.pathname;assert.equal(u.origin,url);calls.push({path,options});
  if(path.includes('/bucket/'))return Response.json({public:publicBucket});
  if(path.endsWith('capture_acquire')){acquired=JSON.parse(options.body).p_lease;return Response.json({acquired:true,lease_id:acquired});}
  if(path.endsWith('capture_release')){assert.equal(JSON.parse(options.body).p_lease,acquired);return Response.json({released:true});}
  if(path.endsWith('archive_budget'))return Response.json(budget??{can_archive:true,stored_bytes:0,limit_bytes:536870912});
  if(path.endsWith('geography_repair_lease')){assert.deepEqual(JSON.parse(options.body),{p_limit:4,p_strategy:'official_sources_v1'});return Response.json(jobs);}
  if(path.includes('/object/authenticated/')){
   if(failure==='readback_unknown')throw Error('transport timeout private '+key);
   if(failure==='readback_http')return new Response('private fixture error',{status:503});
   if(failure==='oversized')return new Response(new Uint8Array(2097153));
   if(failure==='oversized_header')return new Response('small',{headers:{'content-length':'2097153'}});
   const bytes=archive.get(path.split('/').at(-1));return new Response(failure==='hash'?new Uint8Array(bytes.byteLength).fill(65):failure==='size'?body.subarray(0,body.length-1):bytes);
  }
  if(path.includes('/object/')){
   archive.set(path.split('/').at(-1),new Uint8Array(options.body));
   if(failure==='upload_unknown')throw Error('unknown upload outcome '+key);
   return new Response(null,{status:failure==='upload_http'?503:200});
  }
  if(path.endsWith('geography_repair_finish')){
   const p=JSON.parse(options.body);assert.equal(p.p_job,job.id);assert.equal(p.p_lease,job.lease_id);assert.ok(calls.some(c=>c.path.includes('/object/authenticated/')));assert.equal(p.p_result.source.private_archive,bucket);assert.equal(p.p_result.source.archive_format,'decoded_utf8_sha256');
   if(failure==='finish_unknown')throw Error('unknown finish outcome '+key);
   if(failure==='finish_bad_ack')return Response.json({});
   if(failure==='finish_bad_status')return Response.json({status:'leased',coordinate_writes:0});
   if(failure==='finish_factual_write')return Response.json({status:'unresolved',coordinate_writes:1});
   if(failure==='stale_lease')return Response.json({code:'P0001',message:'geography_lease_unavailable'},{status:400});
   return Response.json({status:finishStatus??p.p_result.status,coordinate_writes:0});
  }
  if(path.endsWith('geography_repair_summary'))return Response.json({pending_jobs:12});
  throw Error('unexpected service path '+path);
 };
 return{calls,archive,fetcher};
}
async function capturedRun(jobs,{directory,finishJob}){await writeFile(directory+'/'+hash+'.source.html',body,{mode:0o600});const r=result();if(finishJob)await finishJob(jobs[0].id,jobs[0].lease_id,r);return{results:[{result:r}],source_requests:0};}
const req=()=>new Request('https://worker.example/',{method:'POST',headers:{'x-geography-repair-token':token}});
for(const mode of ['edge']){
 test(mode+' archives exact UTF8, independently reads bytes, then finishes once with original current lease',async()=>{
  const h=transport();let output;
  {globalThis.fetch=h.fetcher;const r=await createHandler({runJobs:capturedRun})(req());assert.equal(r.status,200);output=await r.json();}
  assert.equal(output.database_results_persisted,true);assert.equal(output.coordinate_writes,0);
  const upload=h.calls.findIndex(c=>c.path.includes('/object/')&&!c.path.includes('/authenticated/')),readback=h.calls.findIndex(c=>c.path.includes('/object/authenticated/')),finish=h.calls.findIndex(c=>c.path.endsWith('geography_repair_finish'));
  assert.ok(upload>=0&&readback>upload&&finish>readback);assert.equal(h.calls.filter(c=>c.path.endsWith('geography_repair_finish')).length,1);assert.equal(sha256(h.archive.get(hash+'.html')),hash);assert.equal(h.archive.get(hash+'.html').byteLength,body.length);
  assert.equal(h.calls.filter(c=>c.path.endsWith('capture_release')).length,1);
  assert.ok(h.calls.every(c=>!c.path.includes('review_apply')&&!c.path.includes('enqueue')));
 });
 for(const failure of ['upload_http','upload_unknown','readback_http','readback_unknown','hash','size','oversized','oversized_header','finish_unknown','finish_bad_ack','finish_bad_status','finish_factual_write','stale_lease'])test(mode+' '+failure+' refuses authority without retry or a second canonical completion',async()=>{
  const h=transport({failure});
  {globalThis.fetch=h.fetcher;const r=await createHandler({runJobs:capturedRun})(req());assert.equal(r.status,503);const safe=JSON.stringify(await r.json());assert.ok(!safe.includes(key));assert.ok(!safe.includes(token));}
  assert.equal(h.calls.filter(c=>c.path.includes('/object/')&&!c.path.includes('/authenticated/')).length,1);
  assert.equal(h.calls.filter(c=>c.path.includes('/object/authenticated/')).length,failure.startsWith('upload')?0:1);
  assert.equal(h.calls.filter(c=>c.path.endsWith('geography_repair_finish')).length,['finish_unknown','finish_bad_ack','finish_bad_status','finish_factual_write','stale_lease'].includes(failure)?1:0);
  assert.equal(h.calls.filter(c=>c.path.endsWith('capture_release')).length,1);
 });
 test(mode+' private bucket/budget admission fail before job lease and source research',async()=>{
  for(const opts of[{publicBucket:true},{budget:{can_archive:true,stored_bytes:530000000,limit_bytes:536870912}}]){
   const h=transport(opts);let ran=0;const runJobs=async()=>{ran++;throw Error('must not capture');};
   {globalThis.fetch=h.fetcher;assert.equal((await createHandler({runJobs})(req())).status,503);}
   assert.equal(ran,0);assert.ok(h.calls.every(c=>!c.path.endsWith('geography_repair_lease')&&!c.path.endsWith('geography_repair_finish')));
  }
 });
}
for(const mode of ['edge'])test(mode+' verifies every document before finish; late-page corruption leaves no canonical completion',async()=>{
 const second=Buffer.from('<p>Second exact official contact source</p>'),secondHash=sha256(second),h=transport();
 const fetcher=async(u,o)=>new URL(u).pathname.endsWith('/authenticated/'+bucket+'/'+secondHash+'.html')?new Response('wrong second page'):h.fetcher(u,o);
 const runJobs=async(jobs,{directory,finishJob})=>{await writeFile(directory+'/'+hash+'.source.html',body);await writeFile(directory+'/'+secondHash+'.source.html',second);const r=result();r.source.pages.push({url:'https://official.example/contact',sha256:secondHash,http_status:200});await finishJob(jobs[0].id,jobs[0].lease_id,r);return{results:[{}],source_requests:0};};
 {globalThis.fetch=fetcher;assert.equal((await createHandler({runJobs})(req())).status,503);}
 assert.equal(h.calls.filter(c=>c.path.includes('/object/')&&!c.path.includes('/authenticated/')).length,2);assert.ok(h.calls.every(c=>!c.path.endsWith('geography_repair_finish')));
});
test('official callback binds the originally returned job and lease before archive writes, even if runner mutates its input',async()=>{
 for(const mutation of ['wrong job','wrong lease','mutated input']){
  const h=transport({jobs:[{...job}]});globalThis.fetch=h.fetcher;
  const runJobs=async(jobs,{finishJob})=>{if(mutation==='mutated input')jobs[0].lease_id='unadmitted-lease';await finishJob(mutation==='wrong job'?'unadmitted-job':job.id,mutation==='wrong job'?job.lease_id:'unadmitted-lease',result());return{results:[],source_requests:0};};
  const r=await createHandler({runJobs})(req());assert.equal(r.status,503);assert.ok(h.calls.every(c=>!c.path.includes('/object/')&&!c.path.endsWith('geography_repair_finish')));
 }
});
test('matching repeated callbacks share one original promise and one canonical completion',async()=>{
 const h=transport();globalThis.fetch=h.fetcher;
 const runJobs=async(jobs,{directory,finishJob})=>{await writeFile(directory+'/'+hash+'.source.html',body);const first=finishJob(job.id,job.lease_id,result()),second=finishJob(job.id,job.lease_id,result());assert.strictEqual(first,second);await first;assert.strictEqual(finishJob(job.id,job.lease_id,result()),first);return{results:[{}],source_requests:0};};
 assert.equal((await createHandler({runJobs})(req())).status,200);assert.equal(h.calls.filter(c=>c.path.endsWith('geography_repair_finish')).length,1);assert.equal(h.calls.filter(c=>c.path.includes('/object/')&&!c.path.includes('/authenticated/')).length,1);
});
test('changed-payload repeat refuses; an unknown same-payload attempt never redispatches upload or completion',async()=>{
 for(const failure of [undefined,'finish_unknown']){
  const h=transport({failure});globalThis.fetch=h.fetcher;
  const runJobs=async(jobs,{directory,finishJob})=>{await writeFile(directory+'/'+hash+'.source.html',body);const first=finishJob(job.id,job.lease_id,result());
   if(failure){await assert.rejects(first,/unknown/);await assert.rejects(finishJob(job.id,job.lease_id,result()),/unknown/);throw Error('unconfirmed completion');}
   assert.throws(()=>finishJob(job.id,job.lease_id,{...result(),reason:'changed'}),/invalid_geography_capture_result/);await assert.rejects(first,/invalid_geography_capture_result/);throw Error('conflicting callback');};
  assert.equal((await createHandler({runJobs})(req())).status,503);assert.equal(h.calls.filter(c=>c.path.endsWith('geography_repair_finish')).length,failure?1:0);assert.equal(h.calls.filter(c=>c.path.includes('/object/')&&!c.path.includes('/authenticated/')).length,failure?1:0);
 }
});
test('official completion snapshots the exact payload before an asynchronous runner mutation',async()=>{
 const h=transport();globalThis.fetch=h.fetcher;
 const runJobs=async(jobs,{directory,finishJob})=>{await writeFile(directory+'/'+hash+'.source.html',body);const r=result(),pending=finishJob(job.id,job.lease_id,r);r.reason='later runner mutation';r.source.pages=[];await pending;return{results:[{}],source_requests:0};};
 assert.equal((await createHandler({runJobs})(req())).status,200);const completion=JSON.parse(h.calls.find(c=>c.path.endsWith('geography_repair_finish')).options.body);assert.equal(completion.p_result.reason,'matching_structured_coordinates_missing');assert.equal(completion.p_result.source.pages.length,1);
});
test('a conflicting callback discovered during archive readback prevents pending canonical finish',async()=>{
 const h=transport();let conflict;
 globalThis.fetch=async(u,o)=>{const r=await h.fetcher(u,o);if(new URL(u).pathname.includes('/object/authenticated/'))conflict();return r;};
 const runJobs=async(jobs,{directory,finishJob})=>{await writeFile(directory+'/'+hash+'.source.html',body);conflict=()=>assert.throws(()=>finishJob(job.id,job.lease_id,{...result(),reason:'conflict after upload'}),/invalid_geography_capture_result/);await finishJob(job.id,job.lease_id,result());return{results:[],source_requests:0};};
 assert.equal((await createHandler({runJobs})(req())).status,503);assert.ok(h.calls.every(c=>!c.path.endsWith('geography_repair_finish')));
});
test('CLI refuses a nonempty evidence directory before any lease or retained raw resume',async()=>{
 const d=await directory();await writeFile(d+'/old.job-result.json','{}');const h=transport();
 await assert.rejects(runGeographyCapture({input:'unused-input.json',directory:d,runJobs:capturedRun}),/fresh_private_evidence_directory_required/);assert.equal(h.calls.length,0);
});
test('actual offline CLI emits only non-authoritative raw capture and executable SQL refuses canonical completion',async()=>{
 const d=await directory(),input=(await directory())+'/leases.json';await writeFile(input,'[]');
 const out=JSON.parse(execFileSync(process.execPath,['scripts/geography/process-repair-jobs.mjs',input,d],{cwd:root,encoding:'utf8'}));assert.equal(out.non_authoritative,true);assert.equal(out.database_results_persisted,false);
 const summary=JSON.parse(await readFile(d+'/run-summary.json','utf8'));assert.equal(summary.non_authoritative,true);assert.equal(summary.database_results_persisted,false);
 const sql=await readFile(d+'/finish-research-results.sql','utf8');assert.match(sql,/RAISE EXCEPTION 'canonical_private_archive_completion_required'/);assert.doesNotMatch(sql,/geography_repair_finish|private_archive\s*:/);assert.equal((await readdir(d)).length,2);
});
test('CLI RPC mode refuses even configured service credentials before service IO, directory creation or a lease',async()=>{
 let attempted=0;globalThis.fetch=async()=>{attempted++;throw Error('must not dispatch');};
 await assert.rejects(runGeographyCapture({input:'rpc',directory:'/dev/null/not-created'}),/finite_ticket_edge_capture_required/);assert.equal(attempted,0);
 assert.throws(()=>execFileSync(process.execPath,['scripts/geography/process-repair-jobs.mjs','rpc','/dev/null/not-created'],{cwd:root,env:{...process.env,...env},stdio:['pipe','pipe','pipe']}),error=>{assert.equal(error.status,1);const diagnostic=JSON.parse(error.stderr.toString());assert.equal(diagnostic.error,'finite_ticket_edge_capture_required');assert.equal(diagnostic.automatic_retry,false);assert.ok(!JSON.stringify(diagnostic).includes(key));return true;});
});
test.after(async()=>{globalThis.fetch=originalFetch;delete globalThis.Deno;for(const d of temporary)await rm(d,{recursive:true,force:true});});

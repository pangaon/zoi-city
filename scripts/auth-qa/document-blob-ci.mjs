import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {QA,withQaSession} from './session.mjs';
import {serviceCredential} from '../quality/ci.mjs';
const exec=promisify(execFile),REQUEST='ops/document-blob-qa-request.json';
export const CODE_FILES=['.github/workflows/document-blob-qa.yml','scripts/auth-qa/document-blob-ci.mjs','tests/unit/document-blob-ci.test.mjs','assets/enrichment/association-cards.mjs','assets/enrichment/member-source.mjs','scripts/auth-qa/session.mjs','scripts/quality/browser.mjs','scripts/quality/ci.mjs','scripts/quality/evidence.mjs','scripts/quality/source-fetch.mjs','scripts/quality-collector.mjs','supabase/functions/zoi-enrich/_document-quality.js','supabase/functions/ops-documents/index.ts','assets/documents/file-rules.mjs','assets/documents/bounded-body.mjs'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
export function validateRequest(env,r,e,now=Date.now()){
 const keys=['schema_version','purpose','request_id','parent_sha','issued_at','expires_at','code_sha256','edge_source_sha256','edge_bundle_sha256'];
 if(!r||Object.keys(r).sort().join()!==keys.sort().join()||r.schema_version!==1||r.purpose!=='dedicated-qa-private-document-blob-v1'||!UUID.test(r.request_id||''))throw Error('request_guard');
 const start=Date.parse(r.issued_at),end=Date.parse(r.expires_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>now+60000||now<start-60000||now>=end||end<=start||end-start>1800000)throw Error('request_expired');
 if(env.GITHUB_REPOSITORY!=='pangaon/zoi-city'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_RUN_ATTEMPT!=='1')throw Error('ci_guard');
 if(!/^[a-f0-9]{40}$/.test(r.parent_sha||'')||e.parents!==1||e.parent!==r.parent_sha||e.head!==env.GITHUB_SHA||e.event.before!==r.parent_sha||e.event.after!==env.GITHUB_SHA||e.event.ref!=='refs/heads/main'||e.event.repository?.full_name!=='pangaon/zoi-city'||e.event.forced!==false||e.event.created!==false||e.event.deleted!==false||!['A\t'+REQUEST,'M\t'+REQUEST].includes(e.diff))throw Error('push_guard');
 if(Object.keys(r.code_sha256||{}).sort().join()!==[...CODE_FILES].sort().join()||CODE_FILES.some(p=>!/^[a-f0-9]{64}$/.test(r.code_sha256[p]||'')||r.code_sha256[p]!==e.hashes[p])||r.edge_source_sha256!==e.hashes['supabase/functions/ops-documents/index.ts']||!/^[a-f0-9]{64}$/.test(r.edge_bundle_sha256||''))throw Error('source_guard');
 return true;
}
export async function checkRequest(env=process.env){
 const git=async args=>(await exec('git',args,{timeout:10000,maxBuffer:100000})).stdout.trim();
 const r=JSON.parse(await readFile(REQUEST,'utf8')),event=JSON.parse(await readFile(env.GITHUB_EVENT_PATH,'utf8')),head=await git(['rev-parse','HEAD']),parent=await git(['rev-parse','HEAD^']);
 const hashes={};for(const p of CODE_FILES)hashes[p]=sha(await readFile(p));
 validateRequest(env,r,{event,head,parent,parents:(await git(['rev-list','--parents','-n','1','HEAD'])).split(' ').length-1,diff:await git(['diff','--name-status',parent,head]),hashes});return r;
}
export async function runBlob({session},service,{fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),admit=async()=>{},onProgress=async()=>{}}={}){
 const results={},records=[],documents=[],requests=[];let pending;
 const checkpoint=()=>onProgress({records:records.map(r=>({id:r.id,version:r.version})),documents,requests,pending});
 const bytes=Buffer.from('%PDF-1.7\n'),wrong=Buffer.from('%PDF-8.9\n'),digest=sha(bytes);
 const authHeaders={apikey:QA.key,Authorization:'Bearer '+session.access_token};
 const serviceHeaders={apikey:service,...(service.startsWith('eyJ')?{Authorization:'Bearer '+service}:{})};
 async function request(path,options={},headers=authHeaders){await admit();const response=await fetchImpl(QA.base+path,{...options,headers:{...headers,...options.headers},redirect:'error',signal:AbortSignal.timeout(25000)});return response;}
 async function rpc(name,args){const r=await request('/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});let d;try{d=await r.json();}catch{throw Error('rpc_unconfirmed');}if(!r.ok||d?.ok!==true)throw Error('rpc_unconfirmed');return d;}
 async function upload(nonce,title){const f=new FormData();for(const[k,v]of Object.entries({workspace:QA.workspace,project:records[1].id,expected_version:'0',title,request_id:nonce}))f.set(k,v);f.set('file',new Blob([bytes],{type:'application/pdf'}),'proof.pdf');return request('/functions/v1/ops-documents?action=upload',{method:'POST',body:f});}
 async function history(id){return rpc('document_history',{p_workspace:QA.workspace,p_document:id});}
 try{
  for(const kind of ['company','project']){const x=await rpc('ops_record_save',{p_workspace:QA.workspace,p_kind:kind,p_data:{title:'Zoi isolated blob QA '+kind,...(kind==='project'?{company_id:records[0].id}:{})},p_id:null,p_expected_version:0});if(!UUID.test(x.record?.id||'')||x.record.version!==1)throw Error('record_unconfirmed');records.push(x.record);await checkpoint();}
  const nonce=randomUUID();requests.push({nonce,purpose:'positive'});await checkpoint();const first=await upload(nonce,'Private blob QA positive');if(!first.ok)throw Error('upload_unconfirmed');const a=await first.json();if(a.ok!==true||a.version?.state!=='ready'||!UUID.test(a.document?.id||'')||!UUID.test(a.version?.id||''))throw Error('upload_unconfirmed');documents.push({id:a.document.id,version:1});await checkpoint();
  const repeat=await upload(nonce,'Private blob QA positive');if(!repeat.ok)throw Error('retry_unconfirmed');const b=await repeat.json();if(b.version?.id!==a.version.id)throw Error('retry_unconfirmed');const h=await history(a.document.id);if(h.audit.filter(x=>x.action==='uploaded').length!==1||h.versions.length!==1)throw Error('audit_unconfirmed');results.same_nonce_one_version_one_uploaded_audit=true;
  const downloaded=await request('/functions/v1/ops-documents?action=file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace:QA.workspace,version_id:a.version.id})});if(!downloaded.ok||sha(Buffer.from(await downloaded.arrayBuffer()))!==digest)throw Error('download_unconfirmed');results.actual_private_download_digest_matches=true;
  const nonce2=randomUUID();requests.push({nonce:nonce2,purpose:'wrong_object'});await checkpoint();const begun=await rpc('document_upload_begin',{p_workspace:QA.workspace,p_project:records[1].id,p_document:null,p_expected_version:0,p_title:'Private blob QA wrong object',p_request:nonce2,p_filename:'proof.pdf',p_mime:'application/pdf',p_size:9,p_sha256:digest});
  const u=begun.upload;if(!UUID.test(u?.id||'')||u.state!=='pending'||!/^[-a-zA-Z0-9_]+\/[-a-zA-Z0-9_]+\/[-a-zA-Z0-9_]+\.pdf$/.test(u.object_path||''))throw Error('reservation_unconfirmed');pending={id:u.id,document:begun.document.id,created_at:u.created_at};documents.push({id:begun.document.id,version:0});await checkpoint();
  const stored=await request('/storage/v1/object/workspace-documents/'+u.object_path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:wrong},serviceHeaders);if(!stored.ok)throw Error('wrong_object_setup_unconfirmed');
  const refused=await upload(nonce2,'Private blob QA wrong object');if(refused.status!==409)throw Error('wrong_object_not_refused');const refusal=await refused.json();if(refusal.ok!==false||!['uploaded_object_hash_mismatch','document_request_unconfirmed'].includes(refusal.error))throw Error('wrong_object_not_refused');const bad=await history(pending.document);if(bad.versions.find(x=>x.id===pending.id)?.state!=='pending'||bad.audit.some(x=>x.action==='uploaded'))throw Error('wrong_object_state_unconfirmed');results.wrong_same_mime_same_size_object_refused_pending=true;
 }finally{
  if(pending){let eligible=Date.parse(pending.created_at)+900000;if(!Number.isFinite(eligible))throw Error('cleanup_time_unconfirmed');const deadline=now()+960000;
   while(now()<eligible){if(now()>=deadline)throw Error('cleanup_pending');await sleep(Math.min(30000,eligible-now()+1000));}
   const clean=await request('/functions/v1/ops-documents?action=cleanup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace:QA.workspace,version_id:pending.id})});if(!clean.ok)throw Error('cleanup_pending');const d=await clean.json();if(d.ok!==true||d.state!=='failed')throw Error('cleanup_pending');results.pending_object_canonically_cleaned=true;
  }
  for(const d of documents)await rpc('document_archive',{p_workspace:QA.workspace,p_document:d.id,p_expected_version:d.version});
  for(const r of records.reverse())await rpc('ops_record_archive',{p_workspace:QA.workspace,p_id:r.id,p_expected_version:r.version});
  results.documents_and_qa_records_archived=true;
 }
 return{...results,actual_storage_body_checked:true,ready_object_retained_with_archived_history:true,provider_calls:0,auth_user_created:false,founder_session_used:false};
}
export async function main(stage,env=process.env){const r=await checkRequest(env);if(stage==='check')return;if(stage!=='run')throw Error('stage_guard');
 const safeFetch=(url,opts={})=>fetch(url,{...opts,redirect:'error'});
 // Verify actual deployed source BEFORE resolving credentials or creating a session.
 const response=await safeFetch('https://api.supabase.com/v1/projects/csebihpaychdkanjjsmz/functions/ops-documents',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('deployed_source_unconfirmed');const meta=await response.json();
 // Reviewed request binds the exact deployed bundle to the pinned local Edge source.
 if(meta.status!=='ACTIVE'||meta.ezbr_sha256!==r.edge_bundle_sha256)throw Error('deployed_source_unconfirmed');
 await mkdir('qa-document-blob-evidence',{recursive:true,mode:0o700});
 const onProgress=x=>writeFile('qa-document-blob-evidence/reconciliation.json',JSON.stringify({request_id:r.request_id,commit:env.GITHUB_SHA,known_canonical_ids:x,contains_credentials:false,object_paths_omitted:true}),{mode:0o600});
 const service=await serviceCredential(env,safeFetch,key=>console.log('::add-mask::'+key));const result=await withQaSession(service,ctx=>runBlob(ctx,service,{fetchImpl:safeFetch,admit:()=>checkRequest(env),onProgress}),{fetchImpl:safeFetch});
 await mkdir('qa-document-blob-evidence',{recursive:true,mode:0o700});await writeFile('qa-document-blob-evidence/result.json',JSON.stringify({request_id:r.request_id,commit:env.GITHUB_SHA,result,local_logout_completed:true}),{mode:0o600});console.log(JSON.stringify({status:'private_blob_verified',...result}));}
if(process.argv[1]?.endsWith('/auth-qa/document-blob-ci.mjs'))main(process.argv[2]).catch(()=>{console.error(JSON.stringify({status:'document_blob_unconfirmed',automatic_retry:false,manual_reconciliation_required:true}));process.exitCode=1;});

#!/usr/bin/env node
// Explicit, expiring releases through the repository's existing CI credential.
// Never runs a blanket db push or retries an ambiguous production mutation.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const PROJECT='csebihpaychdkanjjsmz';
const WORKERS=new Map([['ops-documents',false],['social-config',false],['ai-generate',false],['email-send',false],['email-unsubscribe',false],['social-publish',false],['zoi-feed-publish',true],['zoi-enrich',false],['delivery-charge',false],['delivery-connect-onboard',false]]);
const digest=value=>createHash('sha256').update(value).digest('hex');
export function validateRelease(manifest,{read=readFileSync,now=Date.now(),attempt='1'}={}){
 if(attempt!=='1')throw Error('Automatic replay of a production release is not allowed');
 if(manifest?.project!==PROJECT||!/^release-[0-9a-z-]{6,80}$/.test(manifest?.id||''))throw Error('Invalid release identity');
 const expires=Date.parse(manifest.expires_at);
 if(!Number.isFinite(expires)||expires<now||expires>now+3600000)throw Error('Release must expire within one hour');
 if(!Array.isArray(manifest.migrations)||!Array.isArray(manifest.workers)||manifest.migrations.length>8||manifest.workers.length>8)throw Error('Invalid bounded release');
 const seen=new Set();
 function checked(path,hash){
  if(typeof path!=='string'||path.includes('..')||path.startsWith('/')||!/^((supabase\/functions|assets)\/[a-zA-Z0-9_./-]+\.(ts|js|mjs|json)|supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql)$/.test(path))throw Error('Invalid release path');
  if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('Missing content digest');
  const value=read(path,'utf8');if(digest(value)!==hash)throw Error('Release content changed: '+path);return value;
 }
 const migrations=manifest.migrations.map(m=>{
  if(!/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(m.path||''))throw Error('Invalid migration path');
  const name=m.path.replace(/^.*\/\d{14}_/,'').replace(/\.sql$/,'');
  if(seen.has(name))throw Error('Duplicate migration');seen.add(name);
  return {...m,name,query:checked(m.path,m.sha256)};
 });
 const names=new Set();
 const workers=manifest.workers.map(w=>{
  if(!WORKERS.has(w.name)||names.has(w.name)||!Array.isArray(w.files)||!w.files.length)throw Error('Invalid worker');names.add(w.name);
  if(!w.files.some(f=>f.path==='supabase/functions/'+w.name+'/index.ts'))throw Error('Worker entrypoint not pinned');
  for(const f of w.files)checked(f.path,f.sha256);
  return {name:w.name,verifyJwt:WORKERS.get(w.name)};
 });
 return {id:manifest.id,migrations,workers};
}
export async function runRelease(manifest,{env=process.env,read=readFileSync,fetcher=fetch,deploy=execFileSync,log=console.log}={}){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='pangaon/zoi-city'||env.GITHUB_REF!=='refs/heads/main')throw Error('Production releases run only in the authorized main CI');
 const release=validateRelease(manifest,{read,attempt:env.GITHUB_RUN_ATTEMPT||'1'});
 const token=env.SUPABASE_ACCESS_TOKEN;if(!token)throw Error('CI Supabase credential is unavailable');
 log('::add-mask::'+token);
 async function api(path,body,key){
  let response;
  try{response=await fetcher('https://api.supabase.com/v1/projects/'+PROJECT+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});}catch{throw Error('Backend response unconfirmed; inspect before retrying');}
  if(!response.ok)throw Error('Backend API returned '+response.status+'; no automatic retry');
  return response.json();
 }
 if(release.migrations.length){
  const ledger=await api('/database/migrations');if(!Array.isArray(ledger))throw Error('Migration ledger response unrecognized');
  for(const m of release.migrations)if(ledger.some(row=>row.name===m.name))throw Error('Migration already exists; reconcile before release: '+m.name);
  for(const m of release.migrations){await api('/database/migrations',{name:m.name,query:m.query},release.id+'-'+m.sha256);log(JSON.stringify({migration:m.name,status:'applied'}));}
  const after=await api('/database/migrations');
  log(JSON.stringify({migration_versions:after.filter(row=>release.migrations.some(m=>m.name===row.name)).map(row=>({name:row.name,version:row.version}))}));
 }
 for(const worker of release.workers){
  const args=['--yes','supabase@2.115.0','functions','deploy',worker.name,'--use-api','--project-ref',PROJECT];if(!worker.verifyJwt)args.push('--no-verify-jwt');
  try{deploy('npx',args,{env,stdio:['ignore','pipe','pipe'],timeout:120000});}catch{throw Error('Worker deployment unconfirmed: '+worker.name+'; inspect before retrying');}
  log(JSON.stringify({worker:worker.name,status:'deployed'}));
 }
 log(JSON.stringify({release:release.id,status:'completed'}));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{await runRelease(JSON.parse(readFileSync('ops/backend-release-request.json','utf8')));}catch(error){console.error(error.message);process.exitCode=1;}
}

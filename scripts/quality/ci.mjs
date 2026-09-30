import {options,runCollector} from '../quality-collector.mjs';
export async function serviceCredential(env,fetchImpl=fetch,mask=()=>{}){
 let key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SECRET_KEY;
 if(!key){if(!env.SUPABASE_ACCESS_TOKEN)throw Error('service_credential_unavailable');const response=await fetchImpl('https://api.supabase.com/v1/projects/csebihpaychdkanjjsmz/api-keys?reveal=true',{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('management_keys_'+response.status);const rows=await response.json();if(!Array.isArray(rows))throw Error('management_keys_unconfirmed');key=rows.find(r=>r.type==='secret'&&r.api_key?.startsWith('sb_secret_'))?.api_key||rows.find(r=>r.name==='service_role'&&r.api_key?.startsWith('eyJ'))?.api_key;}
 if(!key||/[\r\n]/.test(key))throw Error('service_credential_unavailable');mask(key);return key;
}
export async function ciMain(env=process.env){const config=options(['--task',env.QUALITY_TASK||'classification','--limit',env.QUALITY_LIMIT||'3','--report-dir','quality-evidence',...(env.QUALITY_EXECUTE==='true'?['--execute']:[]),...(env.QUALITY_RESUME==='true'?['--resume']:[])]);if(!config.execute)return runCollector(config);const key=await serviceCredential(env,fetch,key=>console.log('::add-mask::'+key));return runCollector(config,{env:{SUPABASE_SECRET_KEY:key}});}
if(process.argv[1]?.endsWith('/quality/ci.mjs'))ciMain().catch(()=>{console.error('Quality audit failed. Preserve the evidence artifact before an exact receipt retry.');process.exitCode=1});

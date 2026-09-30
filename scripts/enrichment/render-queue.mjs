import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {serviceCredential} from '../quality/ci.mjs';
import {canonical,sha256} from '../quality/evidence.mjs';
import {renderOfficialSource} from './render-source.mjs';
import {assessMachineSourceIdentity} from '../../supabase/functions/zoi-enrich/_source-identity.js';
const PROJECT='https://csebihpaychdkanjjsmz.supabase.co';
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu,' ').trim();
export function automaticRenderedPayload(row,report,hash){
 const refusal=reason=>({slug:row.slug,website:row.website,lease_id:row.lease_id,profile:{crawl_status:'error',last_error:reason},provenance:{}});
 if(row.owner_managed)return refusal('owner_managed_render_review');
 if(report.status==='repair_required')return refusal(report.reason||'rendered_source_unavailable');
 if(report.source?.http_status!==200||!report.render?.sha256||!report.source?.sha256)return refusal('rendered_source_incomplete');
 if(report.listing_id!==row.listing_id||report.website!==row.website||report.aggregator)return refusal('rendered_source_identity_mismatch');
 if(assessMachineSourceIdentity({website:row.website,finalUrl:report.render?.url,name:row.name,title:report.render?.title,description:report.profile?.description}).outcome!=='continue')return refusal('rendered_source_identity_review');
 // Exact source-title identity is deliberately required for unattended imports.
 // Other names/agency/member pages retain their source data and get a repair report.
 if(norm(report.render?.title)!==norm(row.name))return refusal('rendered_source_identity_review');
 const fields=Object.fromEntries(Object.entries(report.profile||{}).filter(([,v])=>v!==null&&v!==''&&(!Array.isArray(v)||v.length)));
 if(!fields.hero_url&&!fields.phone&&!fields.email&&!fields.menu_url)return refusal('rendered_source_no_useful_fields');
 const {lease,blocked,last_error,status,crawl_status,...previous}=row.existing_enrich||{};
 return{slug:row.slug,website:row.website,lease_id:row.lease_id,profile:{...previous,...fields,crawl_status:'ok',rendered_source_evidence:{sha256:hash,source_sha256:report.source.sha256,render_sha256:report.render.sha256,method:'exact_title_same_host_rendered_source',identity_verified:false}},provenance:{...(previous.provenance||{}),...Object.fromEntries(Object.keys(fields).map(k=>[k,'rendered-official-source:'+report.render.url]))}};
}
export async function runRenderQueue({directory='rendered-source-evidence',env=process.env,fetchImpl=fetch,render=renderOfficialSource,log=v=>console.log(JSON.stringify(v))}={}){
 const request=JSON.parse(await readFile(new URL('../../ops/source-render-request.json',import.meta.url),'utf8'));
 if(request.enabled!==true||!Number.isFinite(Date.parse(request.expires_at))||Date.parse(request.expires_at)<=Date.now()||request.max_listings_per_run!==3){log({status:'disabled_or_expired',network_requests:0});return;}
 const key=await serviceCredential(env,fetchImpl,key=>{if(env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+key)});
 const rpc=async(fn,args)=>{const r=await fetchImpl(PROJECT+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('enrichment_rpc_'+r.status);return r.json()};
 await mkdir(directory,{recursive:true,mode:0o700});
 // A single existing capped queue lease; no parallel/new queue, no arbitrary URL.
 const rows=await rpc('enrich_queue_lease',{p_limit:3});if(!Array.isArray(rows)||rows.length>3)throw Error('enrichment_lease_unconfirmed');
 for(const row of rows){let report;try{report=await render(row);}catch(e){report={schema:1,listing_id:row.listing_id,website:row.website,status:'repair_required',reason:['ENOTFOUND','EAI_AGAIN'].includes(e.code)?'source_dns_unavailable':/timeout/i.test(e.message||'')?'source_render_timeout':/^[a-z_0-9]+$/i.test(e.message||'')?e.message:'source_capture_failed',specialist:'enrichment'};}
  const hash=sha256(canonical(report));await writeFile(path.join(directory,hash+'.json'),canonical(report),{flag:'wx',mode:0o600});
  const payload=automaticRenderedPayload(row,report,hash);const pending={listing_id:row.listing_id,hash,payload};await writeFile(path.join(directory,hash+'.pending.json'),canonical(pending),{flag:'wx',mode:0o600});
  // Never retry an ambiguous write. Preserve exact pending artifact for reconciliation.
  const receipts=await rpc('enrich_apply',{p_batch:[payload]});if(!Array.isArray(receipts)||receipts.length!==1||receipts[0].slug!==row.slug||receipts[0].applied!==true)throw Error('enrichment_apply_unconfirmed');
  await writeFile(path.join(directory,hash+'.receipt.json'),canonical(receipts[0]),{flag:'wx',mode:0o600});
  log({listing_id:row.listing_id,source_evidence:hash,status:payload.profile.crawl_status==='ok'?'fetched_pending_qa':'repair_required',reason:payload.profile.last_error||null});
 }
}
if(process.argv[1]?.endsWith('/render-queue.mjs'))runRenderQueue().catch(e=>{console.error(JSON.stringify({status:'failed_preserve_evidence',reason:/^[a-z_0-9]+$/i.test(e.message||'')?e.message:'source_queue_failed'}));process.exitCode=1;});

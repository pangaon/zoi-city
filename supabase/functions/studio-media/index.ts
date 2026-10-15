import {inspectMedia,mediaDigest} from '../../../assets/community/media-rules.mjs';
import {readBoundedBody} from '../../../assets/documents/bounded-body.mjs';
const BASE=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX=5242880,UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','X-Content-Type-Options':'nosniff'}});
const encoded=(path:string)=>path.split('/').map(encodeURIComponent).join('/');
async function request(path:string,token:string,options:RequestInit={}){
 return fetch(BASE+path,{...options,redirect:'error',headers:{apikey:token===SERVICE?SERVICE:ANON,...(token===SERVICE&&token.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+token}),...options.headers},signal:AbortSignal.timeout(20000)});
}
async function rpc(name:string,args:unknown,token:string){
 const r=await request('/rest/v1/rpc/'+name,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)}),value=await r.json();
 if(!r.ok||value?.ok===false||value?.error)throw Error(value.message||value.error||'studio_media_request_unconfirmed');return value;
}
// Maintenance callers may hold a different valid service API credential from
// the function environment. The service-only RPC ACL is the authority check;
// neither string equality nor an unverified JWT claim grants cleanup access.
async function maintenanceCandidates(credential:string){
 const r=await fetch(BASE+'/rest/v1/rpc/studio_media_cleanup_candidates',{method:'POST',redirect:'error',headers:{apikey:credential,...(credential.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+credential}),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
 if(r.status===401||r.status===403)return null;
 if(r.status!==200)throw Error('studio_media_cleanup_authority_unconfirmed');
 const ids=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedBody(r,8192,20000)));
 if(!Array.isArray(ids)||ids.length>20||ids.some((id:unknown)=>typeof id!=='string'||!UUID.test(id)))throw Error('studio_media_cleanup_authority_unconfirmed');
 return ids as string[];
}
function validPath(path:unknown){return typeof path==='string'&&path.length>0&&path.length<=1800&&!/(^\/|\/$|\/\/|(^|\/)\.\.?($|\/)|[\x00-\x1f\x7f\\?#])/.test(path);}
function same(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
function grant(value:any,purpose:string,args:any){
 const e=value?.expected;
 if(value?.ok!==true||!UUID.test(value.grant||'')||value.request!==args.p_request||value.purpose!==purpose||!validPath(value.path)||e?.path!==value.path||!['image/png','image/jpeg','image/webp'].includes(e.mime_type)||purpose==='output'&&e.mime_type!=='image/png'||! /^[a-f0-9]{64}$/.test(e.sha256||'')||!Number.isInteger(e.size_bytes)||e.size_bytes<16||e.size_bytes>MAX||!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<1||e.height<1||e.width>8192||e.height>8192||e.width*e.height>40000000)throw Error('studio_media_grant_unavailable');
 if(value.existing_asset===null&&!new RegExp('^[a-f0-9-]{36}/studio-v1/'+args.p_request+'/'+purpose+'-'+e.sha256+'\\.(png|jpg|webp)$','i').test(value.path))throw Error('studio_media_grant_unavailable');
 return value;
}
async function inspect(bytes:Uint8Array,mime:string,expected:any){
 if(bytes.length!==expected.size_bytes)throw Error('studio_media_byte_proof_mismatch');
 const metadata=inspectMedia(bytes,mime),sha=await mediaDigest(bytes);
 if(sha!==expected.sha256||metadata.type!=='image'||metadata.width!==expected.width||metadata.height!==expected.height||mime!==expected.mime_type)throw Error('studio_media_byte_proof_mismatch');
 return{metadata,sha};
}
async function cleanup(grants:string[]){
 let state='cancelled';const seen=new Set<string>();
 for(const id of grants){if(!UUID.test(id))throw Error('studio_media_cleanup_unconfirmed');const plan=await rpc('studio_media_cleanup_plan',{p_grant:id},SERVICE);
  if(plan?.ok!==true||!['saved','cancelled'].includes(plan.state)||!Array.isArray(plan.paths)||plan.paths.length>2)throw Error('studio_media_cleanup_unconfirmed');
  if(plan.state==='saved'){state='saved';continue;}
  for(const entry of plan.paths){if(!UUID.test(entry.grant||'')||!validPath(entry.path)||! /^[a-f0-9-]{36}\/studio-v1\/[a-f0-9-]{36}\/(original|output)-[a-f0-9]{64}\.(png|jpg|webp)$/i.test(entry.path))throw Error('studio_media_cleanup_unconfirmed');if(seen.has(entry.grant))continue;seen.add(entry.grant);
   if(entry.object!==null){const r=await request('/storage/v1/object/media',SERVICE,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[entry.path]})});if(!r.ok)throw Error('studio_media_cleanup_unconfirmed');}
   // Finish rechecks actual object absence under the same nonce lock. A failed
   // DELETE never produces a false complete response; the tombstone stays.
   await rpc('studio_media_cleanup_finish',{p_grant:entry.grant},SERVICE);
  }
 }
 return state;
}
async function verify(args:any,purpose:string,token:string,file:File|null,known:Set<string>){
 const prepare=()=>rpc('studio_media_prepare',{...args,p_purpose:purpose},token);
 let value=await prepare();if(value.receipt)return value.receipt;value=grant(value,purpose,args);known.add(value.grant);
 if(value.existing_asset===null&&value.object===null){
  if(!file)throw Error('studio_media_'+purpose+'_file_required');
  if(file.type!==value.expected.mime_type||file.size!==value.expected.size_bytes||file.size>MAX)throw Error('studio_media_byte_proof_mismatch');
  const bytes=new Uint8Array(await file.arrayBuffer());await inspect(bytes,file.type,value.expected);
  const r=await request('/storage/v1/object/media/'+encoded(value.path),token,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false','cache-control':'max-age=0'},body:bytes});
  if(!r.ok){const error=await r.json().catch(()=>({}));if(r.status!==409&&String(error.statusCode)!=='409'&&error.error!=='Duplicate')throw Error('studio_media_upload_unconfirmed');}
  const again=grant(await prepare(),purpose,args);if(again.grant!==value.grant||!same(again.expected,value.expected))throw Error('studio_media_grant_changed');value=again;
 }
 if(!value.object)throw Error('studio_media_object_unavailable');
 // The only byte fetch is the fixed Storage origin/path from the current DB
 // grant. Client URLs, redirects and remote website images are never fetched.
 const stored=await request('/storage/v1/object/authenticated/media/'+encoded(value.path),SERVICE),mime=(stored.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!stored.ok||mime!==value.expected.mime_type)throw Error('studio_media_byte_proof_mismatch');
 const bytes=await readBoundedBody(stored,Math.min(MAX,value.expected.size_bytes),20000),proof=await inspect(bytes,mime,value.expected);
 const after=grant(await prepare(),purpose,args);
 if(after.grant!==value.grant||!same(after.expected,value.expected)||!same(after.object,value.object))throw Error('studio_media_object_changed');
 await rpc('studio_media_prove',{p_grant:value.grant,p_object:value.object,p_sha256:proof.sha,p_mime:mime,p_size:bytes.length,p_metadata:proof.metadata},SERVICE);
 return null;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply(405,{ok:false,error:'method_not_allowed'});
 const known=new Set<string>();let token='';
 try{
  const action=new URL(req.url).searchParams.get('action')||'commit',bearer=req.headers.get('authorization')||'';token=/^Bearer [^\s]+$/.test(bearer)?bearer.slice(7):'';
  if(action==='cleanup'){
   const apiKey=req.headers.get('apikey')||'',credential=bearer?token:apiKey;
   if(!SERVICE||!credential||credential.length>4096||bearer&&!token||apiKey&&token&&apiKey!==token||! /^(?:sb_secret_[A-Za-z0-9_-]+|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(credential))return reply(401,{ok:false,error:'sign_in_required'});
   let ids:string[]|null;
   try{ids=await maintenanceCandidates(credential);}catch{return reply(503,{ok:false,error:'studio_media_cleanup_authority_unconfirmed',retryable:true,cleanup_complete:false});}
   if(ids===null)return reply(401,{ok:false,error:'sign_in_required'});
   try{await cleanup(ids);}catch{return reply(503,{ok:false,error:'studio_media_cleanup_unconfirmed',retryable:true,cleanup_complete:false});}
   return reply(200,{ok:true,requests_checked:ids.length});
  }
  if(!['commit','recover','cancel'].includes(action))return reply(400,{ok:false,error:'invalid_action'});
  if(!token||token===SERVICE)return reply(401,{ok:false,error:'sign_in_required'});
  const auth=await request('/auth/v1/user',token);if(!auth.ok)return reply(401,{ok:false,error:'sign_in_required'});const user=await auth.json();if(!UUID.test(user?.id||''))return reply(401,{ok:false,error:'sign_in_required'});
  let args:any,form:FormData|null=null;
  if(action==='commit'&&(req.headers.get('content-type')||'').startsWith('multipart/form-data')){
   const bytes=await readBoundedBody(req,2*MAX+132000,20000);form=await new Request('https://local.invalid',{method:'POST',headers:{'Content-Type':req.headers.get('content-type')!},body:bytes}).formData();
   if([...form.keys()].some(k=>!['args','original','output'].includes(k))||form.getAll('args').length!==1||form.getAll('original').length>1||form.getAll('output').length>1||typeof form.get('args')!=='string'||new TextEncoder().encode(String(form.get('args'))).length>132000)throw Error('studio_media_invalid_request');args=JSON.parse(String(form.get('args')));
  }else args=JSON.parse(new TextDecoder().decode(await readBoundedBody(req,132000,20000)));
  const keys=action==='commit'?['p_workspace','p_listing','p_request','p_payload']:['p_workspace','p_listing','p_request'];
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==keys.length||keys.some(k=>!Object.hasOwn(args,k))||!['p_workspace','p_listing','p_request'].every(k=>UUID.test(args[k]||'')))throw Error('studio_media_invalid_request');
  const scope={p_workspace:args.p_workspace,p_listing:args.p_listing,p_request:args.p_request},started=await rpc('studio_media_request',{...scope,p_cancel_if_missing:action==='cancel'},token);
  if(started?.ok!==true||!Array.isArray(started.grants)||started.grants.length>2||started.grants.some((id:unknown)=>typeof id!=='string'||!UUID.test(id)))throw Error('studio_media_request_unconfirmed');started.grants.forEach((id:string)=>known.add(id));
  if(action!=='commit'){
   if(started.receipt?.state==='cancelled')await cleanup([...known]);
   // Recovery repeats real current-session authority after any cleanup IO.
   const current=await rpc('business_creative_draft_recover',{...scope,p_cancel_if_missing:false},token);return reply(200,current);
  }
  if(started.receipt?.state==='cancelled'){await cleanup([...known]);return reply(200,started.receipt);}
  if(['saved','removed'].includes(started.receipt?.state))return reply(200,await rpc('business_creative_render_save',args,token));
  for(const purpose of['original','output']){const value=form?.get(purpose);if(value!==undefined&&value!==null&&!(value instanceof File))throw Error('studio_media_invalid_request');const receipt=await verify(args,purpose,token,value instanceof File?value:null,known);if(receipt)return reply(200,receipt);}
  return reply(200,await rpc('business_creative_render_save',args,token));
 }catch(e){
  const message=e instanceof Error?e.message:'',safe=/^(studio_media_|business_creative_|request_too_large$|request_read_timeout$|invalid_media_|unsupported_media_|animated_images_unsupported$)/.test(message)?message:/suite_session_unavailable|invitation_unavailable|not_authorized|no_access_to_workspace|insufficient_permission/.test(message)?'studio_media_authority_changed':'studio_media_request_unconfirmed';
  // Preserve a missing-file request for reload/reselection or explicit cancel.
  // Every other failed started upload is durably closed before exact cleanup.
  let complete=false;if(known.size&&!/^studio_media_(original|output)_file_required$/.test(safe)){try{await cleanup([...known]);complete=true;}catch{return reply(503,{ok:false,error:'studio_media_cleanup_unconfirmed',retryable:true,cleanup_complete:false});}}
  return reply(safe==='request_too_large'?413:409,{ok:false,error:safe,retryable:true,cleanup_complete:complete});
 }
});

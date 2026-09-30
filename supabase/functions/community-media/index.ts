import {inspectMedia,mediaDigest,VIDEO_MAX} from '../../../assets/community/media-rules.mjs';
import {readBoundedBody} from '../../../assets/documents/bounded-body.mjs';
const BASE=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET='community-private';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
async function request(path:string,token:string,options:RequestInit={}){return fetch(BASE+path,{...options,headers:{apikey:token===SERVICE?SERVICE:ANON,...(token===SERVICE&&token.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+token}),...options.headers},signal:AbortSignal.timeout(20000)});}
async function rpc(name:string,args:unknown,token:string){const r=await request('/rest/v1/rpc/'+name,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});const d=await r.json();if(!r.ok||d?.ok===false||d?.error)throw Error(d.message||d.error||'media_request_unconfirmed');return d;}
const path=(p:string)=>p.split('/').map(encodeURIComponent).join('/');
async function remove(paths:string[]){if(!paths.length)return;const r=await request('/storage/v1/object/'+BUCKET,SERVICE,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})});if(!r.ok)throw Error('media_cleanup_unconfirmed');await rpc('community_media_cleanup_finish',{p_paths:paths},SERVICE);}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const url=new URL(req.url);
 try{
  if(req.method==='GET'){
   const id=url.searchParams.get('asset');if(!/^[0-9a-f-]{36}$/i.test(id||''))return reply(404,{ok:false,error:'media_unavailable'});
   const allowed=await rpc('community_media_read',{p_id:id},SERVICE);
   const r=await request('/storage/v1/object/sign/'+BUCKET+'/'+path(allowed.path),SERVICE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})});const d=await r.json();if(!r.ok||!d.signedURL)throw Error('media_unavailable');
   return new Response(null,{status:302,headers:{...cors,Location:BASE+'/storage/v1'+d.signedURL,'X-Content-Type-Options':'nosniff'}});
  }
  if(req.method!=='POST')return reply(405,{ok:false,error:'method_not_allowed'});
  const bearer=req.headers.get('authorization')||'';const token=/^Bearer [^\s]+$/.test(bearer)?bearer.slice(7):'';
  if(url.searchParams.get('action')==='cleanup'){
   if(token!==SERVICE||!token)return reply(401,{ok:false,error:'sign_in_required'});
   const d=await rpc('community_media_cleanup',{},SERVICE);await remove(d.paths);return reply(200,{ok:true,removed:d.paths.length});
  }
  if(!token||!(await request('/auth/v1/user',token)).ok)return reply(401,{ok:false,error:'sign_in_required'});
  if(url.searchParams.get('action')==='upload'){
   const body=await readBoundedBody(req,VIDEO_MAX+65536);
   const form=await new Request('https://local.invalid',{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body}).formData();
   const file=form.get('file');if(!(file instanceof File))throw Error('media_file_required');
   const bytes=new Uint8Array(await file.arrayBuffer()),purpose=String(form.get('purpose')||'post');let metadata;
   try{metadata=inspectMedia(bytes,file.type,purpose);}catch(e){throw Error(e instanceof RangeError?'invalid_media_content':e instanceof Error?e.message:'invalid_media_content');}
   const digest=await mediaDigest(bytes);
   const started=await rpc('community_media_begin',{p_request:form.get('request_id'),p_purpose:purpose,p_mime:file.type,p_size:bytes.length,p_sha256:digest,p_metadata:metadata},token);
   if(started.state==='ready')return reply(200,{ok:true,asset:started.asset});if(started.state!=='pending')throw Error('media_request_closed');
   const stored=await request('/storage/v1/object/'+BUCKET+'/'+path(started.path),SERVICE,{method:'POST',headers:{'Content-Type':file.type,'x-upsert':'false','Cache-Control':'private, no-store'},body:bytes});
   if(!stored.ok){const err=await stored.json().catch(()=>({}));if(stored.status!==409&&err.statusCode!=='409'&&err.error!=='Duplicate')throw Error('media_storage_unconfirmed');}
   return reply(200,await rpc('community_media_finish',{p_id:started.id},SERVICE));
  }
  if(url.searchParams.get('action')==='discard'){
   const data=JSON.parse(new TextDecoder().decode(await readBoundedBody(req,4096)));
   const fenced=await rpc('community_media_discard',{p_id:data.asset_id},token);await remove([fenced.path]);return reply(200,{ok:true,id:fenced.id});
  }
  return reply(400,{ok:false,error:'invalid_action'});
 }catch(e){const error=e instanceof Error?e.message:'media_request_unconfirmed';const safe=/^(media_|invalid_|unsupported_|animated_|request_payload_changed|request_too_large|sign_in_required)/.test(error)?error:'media_request_unconfirmed';return reply(req.method==='GET'?404:safe==='request_too_large'?413:409,{ok:false,error:safe});}
});

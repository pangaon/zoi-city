import {MAX_DOCUMENT_BYTES,DOCUMENT_TYPES,validateFileMetadata,validateFileBytes,sha256} from '../../../assets/documents/file-rules.mjs';
import {readBoundedBody,boundedStream} from '../../../assets/documents/bounded-body.mjs';
const BASE=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET='workspace-documents';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Expose-Headers':'Content-Disposition,Content-Type,Content-Length,Cache-Control','Cache-Control':'no-store','Vary':'Origin'};
const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
async function request(path:string,token:string,options:RequestInit={}){return fetch(BASE+path,{...options,headers:{apikey:token===SERVICE?SERVICE:ANON,...(token===SERVICE&&token.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+token}),...options.headers},signal:AbortSignal.timeout(20000)});}
async function rpc(name:string,args:unknown,token:string){const r=await request('/rest/v1/rpc/'+name,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});const d=await r.json();if(!r.ok||d?.ok===false||d?.error)throw Error(d.message||d.error||'document_request_failed');return d;}
const objectPath=(path:string)=>'/storage/v1/object/'+BUCKET+'/'+path.split('/').map(encodeURIComponent).join('/');
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return response(405,{ok:false,error:'method_not_allowed'});
 try{
  const bearer=req.headers.get('authorization')||'';if(!/^Bearer [^\s]+$/.test(bearer))return response(401,{ok:false,error:'sign_in_required'});
  const token=bearer.slice(7),user=await request('/auth/v1/user',token);if(!user.ok)return response(401,{ok:false,error:'sign_in_required'});
  const action=new URL(req.url).searchParams.get('action');
  if(action==='upload'){
   const body=await readBoundedBody(req,MAX_DOCUMENT_BYTES+65536);
   const parsed=await new Request('https://local.invalid',{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body}).formData();
   if(!/^[0-9]+$/.test(String(parsed.get('expected_version')??'')))throw Error('invalid_expected_version');
   const file=parsed.get('file');if(!(file instanceof File))throw Error('file_required');
   const bytes=new Uint8Array(await file.arrayBuffer());const metadata=validateFileBytes({name:file.name,type:file.type,size:file.size},bytes);const digest=await sha256(bytes);
   const started=await rpc('document_upload_begin',{p_workspace:parsed.get('workspace'),p_project:parsed.get('project'),p_document:parsed.get('document')||null,p_expected_version:Number(parsed.get('expected_version')),p_title:parsed.get('title'),p_request:parsed.get('request_id'),p_filename:metadata.name,p_mime:metadata.type,p_size:metadata.size,p_sha256:digest},token);
   const upload=started.upload;
   if(upload.state==='ready')return response(200,{ok:true,document:started.document,version:{id:upload.id,version:upload.version,state:upload.state}});
   if(upload.state!=='pending')throw Error('upload_request_closed');
   const stored=await request(objectPath(upload.object_path),SERVICE,{method:'POST',headers:{'Content-Type':metadata.type,'Cache-Control':'private, max-age=0, no-store','x-upsert':'false'},body:bytes});
   if(!stored.ok){const error=await stored.json().catch(()=>({}));if(stored.status!==409&&error.statusCode!=='409'&&error.error!=='Duplicate')throw Error('document_storage_failed');}
   // A timed-out finalization may have committed. Never delete here; retry reads the same request.
   const done=await rpc('document_upload_finish',{p_version:upload.id},SERVICE);
   return response(200,{ok:true,document:done.document,version:{id:done.version.id,version:done.version.version,state:done.version.state}});
  }
  const bytes=await readBoundedBody(req,4096);let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('invalid_document_request');}
  if(action==='file'){
   const allowed=await rpc('document_download_authorize',{p_workspace:data.workspace,p_version:data.version_id},token);
   const stored=await request('/storage/v1/object/authenticated/'+BUCKET+'/'+allowed.object_path.split('/').map(encodeURIComponent).join('/'),SERVICE);
   if(!stored.ok||!stored.body)throw Error('document_download_unavailable');
   const mime=(stored.headers.get('content-type')||'').split(';')[0].trim();
   const declared=stored.headers.get('content-length');const length=declared===null?MAX_DOCUMENT_BYTES:Number(declared);
   // Names originate in the validated immutable version. Revalidate before writing headers.
   validateFileMetadata({name:allowed.filename,type:mime,size:length});
   const encoded=encodeURIComponent(allowed.filename).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
   const disposition="attachment; filename=\"document."+DOCUMENT_TYPES[mime as keyof typeof DOCUMENT_TYPES]+"\"; filename*=UTF-8''"+encoded;
   return new Response(boundedStream(stored.body,MAX_DOCUMENT_BYTES),{status:200,headers:{...cors,'Content-Type':mime,'Content-Disposition':disposition,'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Expires':'0','X-Content-Type-Options':'nosniff'}});
  }
  if(action==='download'){
   const allowed=await rpc('document_download_authorize',{p_workspace:data.workspace,p_version:data.version_id},token);
   const sign=await request('/storage/v1/object/sign/'+BUCKET+'/'+allowed.object_path.split('/').map(encodeURIComponent).join('/'),SERVICE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})});
   const signed=await sign.json();if(!sign.ok||!signed.signedURL)throw Error('document_download_unavailable');
   const url=new URL(BASE+'/storage/v1'+signed.signedURL);url.searchParams.set('download',allowed.filename);
   return response(200,{ok:true,url:url.href,expires_in:60});
  }
  if(action==='cleanup'){
   const fenced=await rpc('document_cleanup_prepare',{p_workspace:data.workspace,p_version:data.version_id},token);
   const deleted=await request('/storage/v1/object/'+BUCKET,SERVICE,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[fenced.object_path]})});
   if(!deleted.ok)throw Error('document_cleanup_incomplete');
   const done=await rpc('document_cleanup_finish',{p_version:fenced.version_id},SERVICE);return response(200,done);
  }
  return response(400,{ok:false,error:'invalid_action'});
 }catch(error){
  const code=error instanceof Error?error.message:'document_request_failed';
  const known=/^(invalid_|unsupported_|filename_|document_|upload_|active_project_|version_conflict|cleanup_|file_required|request_too_large|empty_request|sign_in_required)/.test(code);
  return response(code==='request_too_large'?413:code==='document_permission_denied'?403:409,{ok:false,error:known?code:'document_request_unconfirmed'});
 }
});

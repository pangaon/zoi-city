// Fixed-purpose companion to the core account-deletion worker. All authority,
// identity/version ownership and progress checkpoints come from canonical RPCs.
type Rpc=(name:string,body:unknown)=>Promise<unknown>;
type Options={rpc:Rpc;url:string;serviceKey:string;fetch?:typeof fetch};
type ObjectRef={id:string;path:string;version:string|null};
type Step={request_id:string;state:string;community_complete:boolean;worker_id?:string;objects?:ObjectRef[]};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=(v:unknown):v is string=>typeof v==='string'&&v.length===36&&UUID.test(v);
const STATES=new Set(['accepted','requires_review','auth_pending','completed','prepared','cancelled']);
function validate(value:unknown,id:string,worker:string):Step{
 const r=value as Step;
 if(!r||r.request_id!==id||!STATES.has(r.state)||typeof r.community_complete!=='boolean'||Object.keys(r).some(k=>!['request_id','state','community_complete','worker_id','objects'].includes(k)))throw Error('Deletion checkpoint unavailable.');
 if(r.objects!==undefined){
  if(r.state!=='accepted'||r.community_complete||r.worker_id!==worker||!Array.isArray(r.objects)||!r.objects.length||r.objects.length>8)throw Error('Deletion checkpoint unavailable.');
  const ids=new Set(),paths=new Set();let profile='';
  for(const o of r.objects){
   if(!o||Object.keys(o).some(k=>!['id','path','version'].includes(k))||!validId(o.id)||typeof o.path!=='string'||!(o.version===null||typeof o.version==='string'&&o.version.length<=256)||ids.has(o.id)||paths.has(o.path))throw Error('Deletion checkpoint unavailable.');
   const pieces=o.path.split('/');if(pieces.length!==2||!pieces.every(validId)||profile&&profile!==pieces[0])throw Error('Deletion checkpoint unavailable.');
   profile=pieces[0];ids.add(o.id);paths.add(o.path);
  }
 }
 return r;
}
export function createCommunityErasureWorker({rpc,url,serviceKey,fetch:transport=fetch}:Options){
 const endpoint=new URL(url);
 if(endpoint.href!=='https://csebihpaychdkanjjsmz.supabase.co/'||!serviceKey)throw Error('Invalid deletion worker configuration.');
 async function storage(path:string,method:string,body?:unknown){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await transport(endpoint.origin+'/storage/v1/'+path,{method,redirect:'error',signal:controller.signal,headers:{Authorization:'Bearer '+serviceKey,apikey:serviceKey,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   // Never buffer or serialize Storage errors/metadata or personal bytes.
   await response.body?.cancel().catch(()=>{});
   if(method==='HEAD'){if(response.status!==404)throw Error('Stored media is not verified absent.');}
   else if(!response.ok)throw Error('Stored media cleanup remains pending.');
  }finally{clearTimeout(timer);}
 }
 return async(request:string,worker:string)=>{
  if(!validId(request)||!validId(worker))throw Error('Deletion checkpoint unavailable.');
  try{
   const result=validate(await rpc('account_delete_community_step',{p_request:request,p_worker:worker}),request,worker);
   if(result.objects){
    await storage('object/community-private','DELETE',{prefixes:result.objects.map(o=>o.path)});
    // At most four HEADs in flight, at most eight exact paths. No public URLs,
    // redirects, arbitrary buckets, downloads or image transformations.
    for(let offset=0;offset<result.objects.length;offset+=4)await Promise.all(result.objects.slice(offset,offset+4).map(o=>storage('object/authenticated/community-private/'+o.path.split('/').map(encodeURIComponent).join('/'),'HEAD')));
    return validate(await rpc('account_delete_community_storage_done',{p_request:request,p_worker:worker,p_objects:result.objects}),request,worker);
   }
   return result;
  }catch{
   // Same durable operation remains pending; no new nonce, no Auth deletion.
   await rpc('account_delete_community_retry',{p_request:request,p_worker:worker}).catch(()=>{});
   throw Error('Deletion cleanup is pending. Check progress again.');
  }
 };
}

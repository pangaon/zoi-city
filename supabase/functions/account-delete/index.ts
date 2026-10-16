// A purpose-specific erasure worker. User requests never supply another actor,
// Storage URL or Auth identifier. Existing history is held for reviewed handling.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const STATES = new Set(['prepared','accepted','requires_review','auth_pending','completed','cancelled']);
type Config={url:string|undefined;publicKey:string|undefined;serviceKey:string|undefined;fetch?:typeof fetch;crypto?:Crypto};
class RequestFailure extends Error {status:number;code?:string;constructor(status:number,code?:string){super('Request unavailable.');this.status=status;this.code=code;}}
const validId=(x:unknown):x is string=>typeof x==='string'&&x.length===36&&UUID.test(x);
const validToken=(x:unknown):x is string=>typeof x==='string'&&x.length===64&&TOKEN.test(x);
export function createAccountDeleteHandler({ url, publicKey, serviceKey, fetch: transport = fetch, crypto: cryptoApi = crypto }:Config) {
  if(!url||!publicKey||!serviceKey)throw Error('Invalid account deletion configuration.');
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || origin.hostname !== 'csebihpaychdkanjjsmz.supabase.co' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || !publicKey || !serviceKey) throw Error('Invalid account deletion configuration.');
  const reply = (status:number, body:unknown) => new Response(status===204?null:JSON.stringify(body), { status, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'https://www.zoi.city', 'Access-Control-Allow-Headers':'authorization,apikey,content-type', 'Access-Control-Allow-Methods':'POST,OPTIONS' } });
  async function call(path:string, body:unknown, token:string, key:string, method = 'POST') {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await transport(origin.origin + path, { method, redirect:'error', signal:controller.signal, headers:{ apikey:key, ...(token?{Authorization:'Bearer '+token}:{}), 'Content-Type':'application/json' }, ...(body===undefined?{}:{body:JSON.stringify(body)}) });
      const length = Number(response.headers.get('content-length') || 0); if (length > 16384) throw Error('Invalid response.');
      const reader = response.body?.getReader(); let bytes=0; const chunks:Uint8Array[]=[];
      if(reader) { try { for(;;){ const part=await reader.read(); if(part.done)break;bytes+=part.value.byteLength;if(bytes>16384)throw Error('Invalid response.');chunks.push(part.value); } } finally { await reader.cancel().catch(()=>{}); } }
      const buffer=new Uint8Array(bytes);let offset=0;for(const part of chunks){buffer.set(part,offset);offset+=part.byteLength;}
      const text=new TextDecoder().decode(buffer);const data=text?JSON.parse(text):null;
      if(!response.ok)throw new RequestFailure(response.status,data?.message==='account_delete_reauthenticate'?'reauthenticate':undefined);
      return data;
    } finally { clearTimeout(timer); }
  }
  const rpc=(name:string,body:unknown,token:string,key=publicKey)=>call('/rest/v1/rpc/'+name,body,token,key!);
  const safe=(data:{request_id:string;state:string},id:string)=>{if(!data||data.request_id!==id||!STATES.has(data.state))throw Error('Invalid receipt.');return {request_id:id,state:data.state};};
  async function process(id:string) {
    const worker=cryptoApi.randomUUID();
    const result=await rpc('account_delete_process',{p_request:id,p_worker:worker},serviceKey!,serviceKey!);
    const resultSafe=safe(result,id);if(resultSafe.state!=='auth_pending')return resultSafe;
    if(!validId(result.actor_id)||result.worker_id!==worker)throw Error('Invalid worker receipt.');
    // Hard deletion only. NO ACTION references/history hold before this step;
    // never soften constraints, erase shared workspaces or substitute sign-out.
    await call('/auth/v1/admin/users/'+result.actor_id,undefined,serviceKey!,serviceKey!,'DELETE').catch(error=>{if(!(error instanceof RequestFailure)||error.status!==404)throw error;});
    return safe(await rpc('account_delete_finish',{p_request:id,p_worker:worker},serviceKey!,serviceKey!),id);
  }
  return async (request:Request) => {
    if(request.method==='OPTIONS')return reply(204,null);
    if(request.method!=='POST')return reply(405,{error:'method_unavailable'});
    let body:Record<string,string>;
    try {
      const length=Number(request.headers.get('content-length')||0);if(length>2048)return reply(413,{error:'request_too_large'});
      const reader=request.body?.getReader();let text='';let size=0;const decoder=new TextDecoder();
      if(reader){try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2048)return reply(413,{error:'request_too_large'});text+=decoder.decode(part.value,{stream:true});}}finally{await reader.cancel().catch(()=>{});}}text+=decoder.decode();body=JSON.parse(text);
      if(!body||typeof body!=='object'||Array.isArray(body)||!['prepare','confirm','cancel','status','process_pending'].includes(body.action))return reply(400,{error:'invalid_request'});
      const allowed=body.action==='process_pending'?['action']:body.action==='prepare'||body.action==='status'?['action','request_id','recovery_token']:['action','request_id'];
      if(Object.keys(body).some(key=>!allowed.includes(key))||allowed.some(key=>!(key in body)))return reply(400,{error:'invalid_request'});
      const auth=request.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';
      if(body.action==='process_pending'){
        // This RPC validates the presented service JWT through PostgREST first.
        const ids=await rpc('account_delete_pending',{},token,publicKey);if(!Array.isArray(ids)||ids.length>5||ids.some(id=>!validId(id)))throw Error('Invalid queue.');
        let processed=0;for(const id of ids){try{await process(id);processed++;}catch{/* durable checkpoint remains retryable; never log actor/provider data */}}
        return reply(200,{processed});
      }
      if(!validId(body.request_id))return reply(400,{error:'invalid_request'});
      if(body.action==='status'){
        if(!validToken(body.recovery_token))return reply(400,{error:'invalid_request'});
        return reply(200,safe(await rpc('account_delete_status',{p_request:body.request_id,p_recovery_token:body.recovery_token},''),body.request_id));
      }
      if(!token)return reply(401,{error:'sign_in_required'});
      if(body.action==='prepare'){
        if(!validToken(body.recovery_token))return reply(400,{error:'invalid_request'});
        const digest=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(body.recovery_token));const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
        return reply(200,safe(await rpc('account_delete_prepare',{p_request:body.request_id,p_recovery_hash:hash},token),body.request_id));
      }
      if(body.action==='cancel')return reply(200,safe(await rpc('account_delete_cancel',{p_request:body.request_id},token),body.request_id));
      const accepted=safe(await rpc('account_delete_confirm',{p_request:body.request_id},token),body.request_id);
      try{return reply(200,await process(body.request_id));}catch{return reply(202,accepted);}
    } catch(error) {
      // Do not serialize provider errors, JWTs, request bodies or SDK contexts.
      const known=error instanceof RequestFailure?error:null;
      return reply(known?.code==='reauthenticate'?403:known?.status===401||known?.status===403?403:503,{error:known?.code==='reauthenticate'?'reauthenticate':'request_unavailable'});
    }
  };
}
if(import.meta.main)Deno.serve(createAccountDeleteHandler({url:Deno.env.get('SUPABASE_URL'),publicKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));

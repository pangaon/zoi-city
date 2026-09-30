export const QA=Object.freeze({user:'2ba5b8e3-4fe9-4ec7-a3bf-7f616fcf07fd',profile:'21a04e78-e3b1-448e-8517-47aad25dd5da',workspace:'053a5656-b19b-48a4-8721-65c4674f647c',base:'https://csebihpaychdkanjjsmz.supabase.co',site:'https://www.zoi.city',key:'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j'});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function qaUser(user){if(user?.id!==QA.user||typeof user.email!=='string'||!user.email.split('@')[0].toLowerCase().includes('qa')||!user.email.includes('@'))throw Error('qa_identity_guard');return user;}
export function qaMe(me){if(me?.authenticated!==true||me.profile?.id!==QA.profile||!me.workspaces?.some(w=>w.id===QA.workspace&&w.role==='owner'))throw Error('qa_workspace_guard');return true;}
export async function withQaSession(service,run,{fetchImpl=fetch}={}){
 let session;
 async function request(path,{method='GET',body,key=QA.key,token}={}){const response=await fetchImpl(QA.base+path,{method,redirect:'error',headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('qa_auth_http_'+response.status);return response.status===204?null:response.json();}
 try{
  const found=await request('/auth/v1/admin/users/'+QA.user,{key:service,token:service.startsWith('eyJ')?service:undefined});const user=qaUser(found.user||found);
  const generated=await request('/auth/v1/admin/generate_link',{method:'POST',key:service,token:service.startsWith('eyJ')?service:undefined,body:{type:'magiclink',email:user.email}});qaUser(generated.user||generated);
  const hash=generated.hashed_token||generated.properties?.hashed_token;if(typeof hash!=='string'||!hash||/[\r\n]/.test(hash))throw Error('qa_link_unconfirmed');
  session=await request('/auth/v1/verify',{method:'POST',body:{type:'magiclink',token_hash:hash}});qaUser(session?.user);
  if(!session.access_token||!session.refresh_token||!Number.isFinite(session.expires_in))throw Error('qa_session_unconfirmed');
  const rpc=(name,body)=>request('/rest/v1/rpc/'+name,{method:'POST',body,token:session.access_token});
  const me=await rpc('zoi_me',{});qaMe(me);
  const status=await rpc('bizpage_status',{p_workspace:QA.workspace});const owned=Array.isArray(status?.owned)?status.owned:[];const listing=owned.find(x=>uuid.test(x?.id||''))?.id||null;
  if(listing){const snapshot=await rpc('home_content_get',{p_workspace:QA.workspace,p_listing:listing});if(snapshot?.ok!==true||snapshot.workspace_id!==QA.workspace||snapshot.listing_id!==listing||!/^[a-f0-9]{32}$/.test(snapshot.version||''))throw Error('qa_home_read_unconfirmed');}
  return await run({session:{access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at||Math.floor(Date.now()/1000)+session.expires_in,email:user.email},listing});
 }finally{if(session?.access_token){await request('/auth/v1/logout?scope=local',{method:'POST',token:session.access_token});session=null;}}
}
export function permittedRequest(request,listing){try{const url=new URL(request.url);if(request.method==='GET')return url.origin===QA.site&&(url.pathname.startsWith('/assets/')||url.pathname==='/social/'||url.pathname==='/sw.js'||url.pathname==='/manifest.webmanifest'||url.pathname==='/favicon.ico');if(request.method==='OPTIONS')return url.origin===QA.base;if(request.method!=='POST'||url.origin!==QA.base)return false;const fn=url.pathname.replace('/rest/v1/rpc/','');const body=JSON.parse(request.postData||'{}');if(['zoi_me','suite_config'].includes(fn))return Object.keys(body).length===0;if(['social_channels_list','bizpage_status'].includes(fn))return Object.keys(body).length===1&&body.p_workspace===QA.workspace;if(['home_content_get','home_design_editor','bizpage_get'].includes(fn))return !!listing&&body.p_workspace===QA.workspace&&body.p_listing===listing&&Object.keys(body).length===2;return false;}catch{return false;}}

// Controlled Storage HTTP backed by actual isolated PostgreSQL Storage policies.
// No Supabase/network credentials and no external requests are used.
import assert from 'node:assert/strict';
export async function studioEdgeHarness({q,claims,quote,j,actor,authToken='fixture-current-session',bytesByPath=new Map()}){
 let handler;const BASE='https://csebihpaychdkanjjsmz.supabase.co',service='fixture-service-not-a-key',token=authToken,calls=[],hooks={};
 globalThis.Deno={env:{get:k=>({SUPABASE_URL:BASE,SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:service})[k]},serve:h=>handler=h};
 await import('../../supabase/functions/studio-media/index.ts?fixture='+crypto.randomUUID());
 const functions={studio_media_request:['p_workspace','p_listing','p_request','p_cancel_if_missing'],business_creative_draft_recover:['p_workspace','p_listing','p_request','p_cancel_if_missing'],studio_media_prepare:['p_workspace','p_listing','p_request','p_payload','p_purpose'],studio_media_prove:['p_grant','p_object','p_sha256','p_mime','p_size','p_metadata'],business_creative_render_save:['p_workspace','p_listing','p_request','p_payload'],studio_media_cleanup_plan:['p_grant'],studio_media_cleanup_finish:['p_grant'],studio_media_cleanup_candidates:[]};
 const sqlValue=v=>v===null?'NULL':typeof v==='object'?j(v):typeof v==='boolean'||typeof v==='number'?String(v):quote(v);
 const originalFetch=globalThis.fetch;globalThis.fetch=async(input,options={})=>{
  const url=new URL(String(input));assert.equal(url.origin,BASE,'No external byte fetch or provider request');assert.equal(options.redirect,'error');assert.ok(options.signal);calls.push({path:url.pathname,method:options.method||'GET'});
  const auth=options.headers?.Authorization||'',isService=auth==='Bearer '+service,actualToken=auth.slice(7);
  if(url.pathname==='/auth/v1/user')return Response.json({id:actor},{status:actualToken===token?200:401});
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1),keys=functions[name];assert.ok(keys,'Known RPC only');const args=JSON.parse(options.body);assert.deepEqual(Object.keys(args).sort(),[...keys].sort());
   try{const result=JSON.parse(q((isService?'set role service_role;':claims(actor))+`select public.${name}(${keys.map(k=>sqlValue(args[k])).join(',')});`));if(hooks.afterRpc)await hooks.afterRpc(name,args,result);return Response.json(result);}catch(error){if(error.fixtureLostResponse)throw error;return Response.json({message:String(error.stderr||error.message)},{status:400});}
  }
  if(url.pathname==='/storage/v1/object/media'&&options.method==='DELETE'){
   assert.equal(isService,true);if(hooks.deleteFailure)return Response.json({error:'fixture_storage_down'},{status:503});const data=JSON.parse(options.body);assert.equal(data.prefixes.length,1);const path=data.prefixes[0];if(hooks.beforeDelete)await hooks.beforeDelete(path);
   q(`delete from storage.objects where bucket_id='media'and name=${quote(path)}`);bytesByPath.delete(path);return Response.json([]);
  }
  const uploadPrefix='/storage/v1/object/media/',getPrefix='/storage/v1/object/authenticated/media/';
  if(url.pathname.startsWith(uploadPrefix)&&options.method==='POST'){
   assert.equal(isService,false);assert.equal(actualToken,token);assert.equal(options.headers['x-upsert'],'false');const path=decodeURIComponent(url.pathname.slice(uploadPrefix.length)),bytes=new Uint8Array(options.body);
   try{q(claims(actor)+`insert into storage.objects(bucket_id,name,owner,owner_id,version,metadata)values('media',${quote(path)},'${actor}','${actor}',gen_random_uuid()::text,${j({mimetype:options.headers['Content-Type'],size:bytes.length})})`);bytesByPath.set(path,{bytes,mime:options.headers['Content-Type']});if(hooks.postConflict)return Response.json({statusCode:'409',error:'Duplicate'},{status:409});return Response.json({Key:path});}catch(e){return Response.json({error:String(e.stderr||e.message)},{status:409});}
  }
  if(url.pathname.startsWith(getPrefix)){
   assert.equal(isService,true);const path=decodeURIComponent(url.pathname.slice(getPrefix.length)),stored=bytesByPath.get(path);if(!stored)return new Response(null,{status:404});const response={bytes:stored.bytes,mime:stored.mime};if(hooks.get)await hooks.get(path,response);return new Response(response.bytes,{headers:{'content-type':response.mime}});
  }
  throw Error('Unexpected controlled HTTP path '+url.pathname);
 };
 function request(action,args,files={}){let body,headers={Authorization:'Bearer '+token};if(Object.keys(files).length){body=new FormData();body.append('args',JSON.stringify(args));for(const[k,value]of Object.entries(files))body.append(k,value);}else{headers['Content-Type']='application/json';body=JSON.stringify(args);}return new Request('https://edge.fixture.invalid?action='+action,{method:'POST',headers,body});}
 return{handler,request,hooks,calls,bytesByPath,restore(){globalThis.fetch=originalFetch;delete globalThis.Deno;}};
}

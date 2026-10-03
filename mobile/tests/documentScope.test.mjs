import test from 'node:test';import assert from 'node:assert/strict';
import{documentRpc}from'../src/documentScope.ts';import{SessionClient}from'../src/session.ts';
const actor='11111111-1111-4111-8111-111111111111',ws='22222222-2222-4222-8222-222222222222',project='33333333-3333-4333-8333-333333333333';
for(const wait of['refresh','response'])for(const mode of['actor','workspace','project','unmount','unchanged'])test('actual SessionClient private documents '+wait+' '+mode,async()=>{
 let release,current=true,calls=0;
 const client=new SessionClient({read:async()=>null,write:async()=>{},clear:async()=>{}},async(url,init)=>{
  if(url.includes('refresh_token')){if(wait==='refresh')await new Promise(r=>release=r);return new Response(JSON.stringify({access_token:'renewed',refresh_token:'refresh',expires_in:3600,user:{id:mode==='actor'&&wait==='refresh'?ws:actor}}));}
  calls++;assert.equal(init.headers.Authorization,'Bearer '+(wait==='refresh'?'renewed':'valid'));if(wait==='response')await new Promise(r=>release=r);return new Response(JSON.stringify({ok:true}));
 });client.session={access_token:wait==='refresh'?'old':'valid',refresh_token:'refresh',expires_at:wait==='refresh'?1:Math.floor(Date.now()/1000)+3600,user:{id:actor}};
 const pending=documentRpc(client,actor,ws,()=>current,'documents_list',{p_workspace:ws,p_project:project});while(!release)await new Promise(r=>setImmediate(r));
 if(mode==='actor'&&wait==='response')client.session={...client.session,user:{id:ws}};else if(['workspace','project','unmount'].includes(mode))current=false;release();
 if(mode==='unchanged'){assert.equal((await pending).ok,true);assert.equal(calls,1);}else{await assert.rejects(pending,/changed/);assert.equal(calls,wait==='response'?1:0);}
});
test('private document RPC refuses malformed scopes, unknown writers and foreign workspace before dispatch',async()=>{
 const client={session:{user:{id:actor}},token:async()=>{assert.fail('token should not be accessed')},request:async()=>assert.fail('no request')};
 for(const [name,args]of[['documents_list',{p_workspace:ws,p_project:'bad'}],['document_archive',{p_workspace:ws,p_document:'bad'}],['documents_list',{p_workspace:actor,p_project:null}],['ops_record_upsert',{p_workspace:ws}]])await assert.rejects(documentRpc(client,actor,ws,()=>true,name,args));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceCapability} from '../../assets/events/service-capabilities.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),actor=id(1),workspace=id(2),profile=id(3),event=id(4);
const valid=(patch={})=>({ok:true,version:1,auth_user_id:actor,actor_profile_id:profile,workspace_id:workspace,event_id:null,role:'owner',capabilities:{menu:1,setup:1,queue:1,lifecycle:1},...patch});
test('strict installed proof accepts distinct internal profile and exact context only',async()=>{
 for(const patch of[{},{version:'1'},{version:2},{actor_profile_id:actor+'x'},{auth_user_id:profile},{workspace_id:event},{event_id:event},{role:'viewer'},{capabilities:{menu:true,setup:1,queue:1,lifecycle:1}},{capabilities:{menu:1,setup:1,queue:1}}]){
  const gate=serviceCapability({rpc:async()=>valid(patch),actor,workspace});if(!Object.keys(patch).length)await gate.require('menu');else await assert.rejects(gate.require('menu'),/not available/);
 }
});
test('guest proof cannot grant operator permission; malformed actor sends nothing',async()=>{
 let calls=0;const rpc=async()=>{calls++;return valid({workspace_id:null,event_id:event,role:'guest'});};
 const guest=serviceCapability({rpc,actor,event});await guest.require('lifecycle');await assert.rejects(guest.require('menu'));
 const count=calls;await assert.rejects(serviceCapability({rpc,actor:'opaque',workspace}).require('menu'));assert.equal(calls,count);
});
test('retired response cannot mark capability available; removal of capability clears prior proof',async()=>{
 let release,current=true,reply=valid();const gate=serviceCapability({actor,workspace,current:()=>current,rpc:async()=>{await new Promise(r=>release=r);return reply;}});
 const pending=gate.require('menu');current=false;release();await assert.rejects(pending);assert.equal(gate.state().available,false);
 current=true;const success=gate.require('menu');release();await success;reply=valid({capabilities:{menu:0,setup:0,queue:0,lifecycle:0}});const gone=gate.require('menu');release();await assert.rejects(gone);assert.equal(gate.state().available,false);
});
let source=readFileSync(new URL('../../assets/events/event-service-client.mjs',import.meta.url),'utf8');source=source.replace(/'\.\/service-capabilities\.mjs(?:\?[^']*)?'/,JSON.stringify(new URL('../../assets/events/service-capabilities.mjs',import.meta.url).href)).replace("'/assets/community/session-state.mjs'",JSON.stringify(new URL('../../assets/community/session-state.mjs',import.meta.url).href));
const {serviceClient}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(pending=false){const memory=new Map(),calls=[];let installed=false;const request=id(8),scope=id(9),key='zoi:event-service:'+actor+':'+workspace;if(pending)memory.set(key,JSON.stringify({actor,context:workspace,kind:'start',scope,request,event,expected:0}));
 const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const core={auth:{load:()=>({user_id:actor,access_token:'fixture'}),token:()=> 'fixture',ensureFresh:async()=>true},api:{rpc:async(n,p)=>{calls.push(n);if(n==='event_service_capabilities')return installed?valid():null;return{ok:true,kind:'start',scope_id:scope,request_id:request,status:'cancelled'};}}};
 return{client:serviceClient({core,context:workspace,storage,randomUUID:()=>request}),calls,memory,key,scope,enable:()=>installed=true};}
test('missing capability blocks read, mutation and recovery while preserving original marker',async()=>{
 const f=fixture(true),original=f.memory.get(f.key);await assert.rejects(f.client.rpc('event_service_sessions',{}));await assert.rejects(f.client.recover());assert.deepEqual(f.calls,['event_service_capabilities','event_service_capabilities']);assert.equal(f.memory.get(f.key),original);
 f.enable();assert.equal((await f.client.recover(true)).done,true);assert.equal(f.memory.has(f.key),false);assert.equal(f.calls.at(-1),'event_service_request');
 const fresh=fixture();await assert.rejects(fresh.client.mutate('start',fresh.scope,'event_service_start',{}, {event}));assert.equal(fresh.memory.size,0);assert.deepEqual(fresh.calls,['event_service_capabilities']);
});
test('capability authorization denial keeps transport status; no implicit retry or fallback',async()=>{
 for(const error of[Object.assign(Error('Denied'),{status:401}),Object.assign(Error('Denied'),{statusCode:403}),Object.assign(Error('Denied'),{code:'42501'})]){
  let calls=0;const gate=serviceCapability({actor,workspace,rpc:async()=>{calls++;throw error;}});await assert.rejects(gate.require('menu'),e=>e===error);assert.equal(calls,1);assert.equal(gate.state().available,false);
 }
});

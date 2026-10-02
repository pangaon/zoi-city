import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionClient} from '../src/session.ts';
import {scopedEventHostRpc,organiserEventHostLink} from '../src/eventHostLink.ts';
const actor='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',workspace='30000000-0000-4000-8000-000000000001',event='40000000-0000-4000-8000-000000000001';
const json=value=>new Response(JSON.stringify(value),{status:200});
function fixture(){let release;const f={current:true,calls:[],refreshActor:actor,holdRefresh:false,holdRead:false};
 f.client=new SessionClient({read:async()=>null,write:async()=>{},clear:async()=>{}},async(url,init)=>{
  if(url.includes('refresh_token')){if(f.holdRefresh)await new Promise(r=>release=r);return json({access_token:'renewed',refresh_token:'refresh',expires_in:3600,user:{id:f.refreshActor}});}
  f.calls.push({url,body:JSON.parse(init.body),authorization:init.headers.Authorization});
  if(f.holdRead)await new Promise(r=>release=r);
  return json(url.endsWith('zoi_me')?{profile:{id:other},workspaces:[{id:workspace,role:'admin'}]}:{ok:true,event_id:event,version:1,tables:[]});
 });
 f.client.session={access_token:'old',refresh_token:'refresh',expires_at:1,user:{id:actor}};
 f.rpc=(name,args)=>scopedEventHostRpc(f.client,actor,()=>f.current,name,args);
 f.wait=async()=>{while(!release)await new Promise(r=>setImmediate(r));};f.release=()=>release();return f;
}
test('actual session refresh preserves exact authorised event/workspace without credentials in link',async()=>{const f=fixture();const link=await organiserEventHostLink({event,workspace,actor,current:()=>f.current,rpc:f.rpc});assert.equal(link,`https://www.zoi.city/tickets/hosts/?event=${event}&workspace=${workspace}`);assert.equal(f.calls.length,2);assert.equal(f.calls[0].authorization,'Bearer renewed');assert.deepEqual(f.calls[1].body,{p_workspace:workspace,p_event:event});});
for(const change of['workspace','actor'])test(`held actual refresh refuses private send after ${change} switch`,async()=>{const f=fixture();f.holdRefresh=true;const pending=f.rpc('zoi_me',{});await f.wait();if(change==='workspace')f.current=false;else f.refreshActor=other;f.release();await assert.rejects(pending,/changed/);assert.equal(f.calls.length,0);});
test('late private response is refused after scope change',async()=>{const f=fixture();f.holdRead=true;const pending=f.rpc('zoi_me',{});await f.wait();f.current=false;f.release();await assert.rejects(pending,/changed/);assert.equal(f.calls.length,1);});
test('invalid actor, guest, lost scope and unsupported RPC refuse dispatch',async()=>{for(const mode of['invalid','guest','scope','writer']){const f=fixture();if(mode==='guest')f.client.session=null;if(mode==='scope')f.current=false;await assert.rejects(scopedEventHostRpc(f.client,mode==='invalid'?'opaque':actor,()=>f.current,mode==='writer'?'event_host_allocate':'zoi_me',{}));assert.equal(f.calls.length,0);}});
test('refresh rejection never dispatches private proof',async()=>{const f=fixture();f.client.token=async()=>{throw Error('refresh unavailable');};await assert.rejects(f.rpc('zoi_me',{}),/refresh unavailable/);assert.equal(f.calls.length,0);});

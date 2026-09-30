import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../assets/zoi-core.js',import.meta.url),'utf8');
function setup(fetch,{fast=false}={}){
 const store=new Map();const context={fetch,AbortController,Promise,Date,console,setTimeout:fast?(fn)=>setTimeout(fn,20):setTimeout,clearTimeout,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
 vm.createContext(context);vm.runInContext(source,context);return context.ZoiCore;
}
const expired={access_token:'old',refresh_token:'refresh',expires_at:1,user_id:'user'};
const ok=()=>new Response(JSON.stringify({access_token:'new',refresh_token:'rotated',expires_in:3600,user:{id:'user'}}),{status:200});
test('parallel expired requests share one refresh',async()=>{let calls=0;const c=setup(async()=>{calls++;await new Promise(r=>setTimeout(r,5));return ok()});c.auth.save(expired);assert.deepEqual(await Promise.all([c.auth.ensureFresh(),c.auth.ensureFresh()]),[true,true]);assert.equal(calls,1);assert.equal(c.auth.load().user_id,'user')});
test('refresh completion cannot restore a signed-out session',async()=>{let finish;const c=setup(()=>new Promise(r=>finish=r));c.auth.save(expired);const pending=c.auth.ensureFresh();c.auth.clear();finish(ok());assert.equal(await pending,false);assert.equal(c.auth.load(),null)});
test('transient refresh failure retains refresh credentials',async()=>{const c=setup(async()=>new Response('{}',{status:503}));c.auth.save(expired);assert.equal(await c.auth.ensureFresh(),false);assert.equal(c.auth.load().refresh_token,'refresh')});
test('invalid refresh clears expired credentials',async()=>{const c=setup(async()=>new Response('{}',{status:400}));c.auth.save(expired);assert.equal(await c.auth.ensureFresh(),false);assert.equal(c.auth.load(),null)});
test('RPC timeout aborts and never retries mutation',async()=>{let calls=0;const c=setup((url,opts)=>{calls++;return new Promise((r,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))},{fast:true});await assert.rejects(c.api.rpc('save',{}, {auth:'anon'}),/too long/);assert.equal(calls,1)});
test('application error envelopes cannot be success receipts',async()=>{const c=setup(async()=>new Response(JSON.stringify({ok:false,error:'capacity_exceeded'})));await assert.rejects(c.api.rpc('reserve',{}, {auth:'anon'}),/capacity_exceeded/)});
test('signout clears locally even if remote revocation fails',async()=>{const c=setup(async()=>{throw new Error('offline')});c.auth.save(expired);await assert.rejects(c.auth.signOut(),/offline/);assert.equal(c.auth.load(),null)});
test('a signed-out request cannot expose its previous account response',async()=>{let finish;const c=setup(()=>new Promise(r=>finish=r));c.auth.save({...expired,expires_at:Date.now()/1000+3600});const pending=c.api.rpc('private_records',{}, {auth:'require'});await new Promise(r=>setTimeout(r,0));c.auth.clear();finish(new Response(JSON.stringify({records:['private']})));await assert.rejects(pending,/session changed/)});

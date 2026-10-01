import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorPending} from '../../assets/creator/pending.mjs';
const actor='10000000-0000-4000-8000-000000000001',campaign='20000000-0000-4000-8000-000000000001';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
test('reload retains opaque recovery reference, never private arguments',()=>{
 const storage=memory(),p=creatorPending({actor,scope:'customer',storage});const args={p_note:'PRIVATE RESPONSE',p_submission:campaign};const payload=p.begin('creator_submission_decide',args);args.p_note='changed';assert.equal(payload.p_args.p_note,'PRIVATE RESPONSE');assert(![...storage.map.values()].join('').includes('PRIVATE RESPONSE'));
 const next=creatorPending({actor,scope:'customer',storage});assert.equal(next.record.request,payload.p_request);assert.equal(next.payload,null);assert.throws(()=>next.begin('creator_submission_decide',args),/creator_request_pending/);
 assert.equal(creatorPending({actor:'other',scope:'customer',storage}).record,null);assert.equal(creatorPending({actor,scope:'workspace',storage}).record,null);
});
test('only matched terminal receipts can be accepted; missing is not saved',()=>{
 const storage=memory(),p=creatorPending({actor,scope:'customer',storage});p.begin('creator_brief_decide',{});const value={ok:true,state:'saved',request_id:p.record.request,action:'creator_brief_decide',campaign_id:campaign,entity_id:campaign};assert(p.matches(value));assert(!p.matches({...value,request_id:actor}));assert(!p.matches({...value,action:'creator_submission_decide'}));assert(!p.matches({...value,entity_id:'bad'}));assert(p.matches({ok:true,state:'missing',request_id:p.record.request}));assert(p.record);p.dropPayload();assert.equal(p.payload,null);assert(p.record);p.clear();assert.equal(p.record,null);assert.equal(storage.map.size,0);
});
test('unavailable or corrupt durable storage fails before a mutation can start',()=>{
 for(const storage of [{getItem(){throw Error('denied')}},{getItem(){return '{invalid'}},{getItem(){return JSON.stringify({actor,request:'bad',action:'creator_convert'})}}])assert.throws(()=>creatorPending({actor,scope:'customer',storage}).begin('creator_convert',{}),/creator_recovery_unavailable/);
 const storage=memory();storage.setItem=()=>{throw Error('quota')};const p=creatorPending({actor,scope:'customer',storage});assert.throws(()=>p.begin('creator_convert',{}),/quota/);assert.equal(p.record,null);assert.equal(p.payload,null);
});

test('silent storage failure prevents sending without a durable marker',()=>{const storage={getItem(){return null},setItem(){}};const p=creatorPending({actor,scope:'customer',storage});assert.throws(()=>p.begin('creator_convert',{}),/creator_recovery_unavailable/);assert.equal(p.payload,null);});
test('readback error after successful persistence fences replacement until remount',()=>{const storage=memory(),p=creatorPending({actor,scope:'customer',storage});const read=storage.getItem;storage.getItem=()=>{throw Error('read failed')};assert.throws(()=>p.begin('creator_convert',{}),/read failed/);assert.equal(storage.map.size,1);assert.throws(()=>p.begin('creator_convert',{}),/creator_recovery_unavailable/);storage.getItem=read;assert(creatorPending({actor,scope:'customer',storage}).record);});

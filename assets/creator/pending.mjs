import {UUID} from '../inquiries/model.mjs';
export const CREATOR_MUTATIONS=['creator_convert','creator_draft_save','creator_deliverable_save','creator_brief_share','creator_submission_send','creator_brief_decide','creator_submission_decide'];
// Only opaque recovery metadata survives reload. Private form values stay in memory.
export function creatorPending({actor,scope,storage}){
 const key='zoi:creator-pending:v1:'+actor+':'+scope;let record=null,payload=null,available=true;
 try{storage=storage||globalThis.sessionStorage;const value=JSON.parse(storage.getItem(key)||'null');if(value!==null){if(value.actor!==actor||!UUID.test(value.request||'')||!CREATOR_MUTATIONS.includes(value.action))available=false;else record=value;}}catch{available=false;}
 return{get record(){return record},get payload(){return payload},dropPayload(){payload=null},begin(action,args){
  if(!available)throw Error('creator_recovery_unavailable');if(record)throw Error('creator_request_pending');if(!CREATOR_MUTATIONS.includes(action))throw Error('invalid_creator_request');
  const next={actor,request:crypto.randomUUID(),action};const copy=JSON.parse(JSON.stringify(args));delete copy.p_request;
  const encoded=JSON.stringify(next);storage.setItem(key,encoded);if(storage.getItem(key)!==encoded){available=false;throw Error('creator_recovery_unavailable');}record=next;payload={p_request:next.request,p_action:action,p_args:copy};return payload;
 },matches(value){return value?.ok===true&&record&&value.request_id===record.request&&(['missing','cancelled'].includes(value.state)||(value.state==='saved'&&value.action===record.action&&UUID.test(value.campaign_id||'')&&UUID.test(value.entity_id||'')));},clear(){storage.removeItem(key);record=null;payload=null;}};
}

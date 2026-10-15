import {createHash} from 'node:crypto';
import {QA,permittedRequest} from './session.mjs';
import {validateDraftReceipt} from '../../assets/email/campaign-draft-workflow.mjs';
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const sha=value=>createHash('sha256').update(value).digest('hex');
const exact=(a,b)=>a&&Object.keys(a).sort().join()===Object.keys(b).sort().join()&&Object.entries(b).every(([k,v])=>typeof v==='object'&&v!==null?exact(a[k],v):a[k]===v);
export function draftNonces(request){if(!UUID.test(request.request_id||''))throw Error('crm_qa_request');const h=sha('crm-email-lost:'+request.request_id);return[request.request_id,`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`];}
export function draftPayload(request,index,tag){return{subject:'INTERNAL QA email draft '+request.request_id+' '+(index?'recovery':'reopen'),body:'Synthetic private browser acceptance only. No delivery, recipients, scheduling or external action.',preheader:'Synthetic acceptance only',from_name:'INTERNAL QA',audience:tag,id:null};}
export function eligibleTag(tag){return typeof tag==='string'&&tag!==''&&tag===tag.trim()&&tag!=='all'&&tag.length<=100;}
export function selectFixtureTag(rows,digest){if(!Array.isArray(rows)||!/^[a-f0-9]{64}$/.test(digest||'')||rows.some(r=>r.workspace_id!==QA.workspace))throw Error('crm_qa_fixture');const tags=[...new Set(rows.flatMap(r=>Array.isArray(r.tags)?r.tags:[]).filter(t=>eligibleTag(t)&&sha(t)===digest))];if(tags.length!==1)throw Error('crm_qa_fixture');return tags[0];}
export function checkedReceipt(value,request,index,tag){const result=validateDraftReceipt(value,{actor:QA.user,workspace:QA.workspace},draftNonces(request)[index],tag===null?null:draftPayload(request,index,tag));if(result.state==='saved'&&tag!==null){const p=draftPayload(request,index,tag),c=result.campaign;if(c.status!=='draft'||c.subject!==p.subject||c.body!==p.body||c.preheader!==p.preheader||c.from_name!==p.from_name||c.audience_tag!==p.audience)throw Error('crm_qa_current_draft_changed');}return result;}
export function crmBrowserFence(request,tag,{now=Date.now}={}){
 const nonces=draftNonces(request),saved=new Set(),seen=[];
 if(!eligibleTag(tag)||sha(tag)!==request.fixture_tag_sha256)throw Error('crm_qa_fixture');
 return{count:()=>saved.size,seen:()=>[...seen],allow(r){try{const u=new URL(r.url),b=JSON.parse(r.postData||'{}');if(r.method==='GET')return u.origin===QA.site&&(['/social','/social/','/social/audience','/social/email'].includes(u.pathname)||u.pathname.startsWith('/assets/')||['/sw.js','/manifest.webmanifest','/favicon.ico'].includes(u.pathname));if(r.method==='OPTIONS')return u.origin===QA.base;if(r.method!=='POST'||u.origin!==QA.base)return false;const fn=u.pathname.replace('/rest/v1/rpc/','');
 if(fn==='audience_access'||fn==='email_campaign_list')return exact(b,{p_workspace:QA.workspace});
 if(fn==='audience_list')return exact(b,{p_workspace:QA.workspace,p_q:null,p_tag:b.p_tag})&&[null,tag].includes(b.p_tag);
 if(fn==='email_campaign_draft_status')return nonces.includes(b.p_request)&&exact(b,{p_workspace:QA.workspace,p_request:b.p_request,p_cancel_if_missing:false});
 if(fn==='email_campaign_draft_save'){const i=nonces.indexOf(b.p_request);if(i<0||now()>=Date.parse(request.expires_at)||saved.has(b.p_request)||!exact(b,{p_workspace:QA.workspace,p_request:nonces[i],p_payload:draftPayload(request,i,tag)}))return false;saved.add(b.p_request);seen.push(i);return true;}
 return permittedRequest(r,null);
 }catch{return false;}}};
}
const STAGES=new Set(['request','web_source','session','fixture','preflight','browser_open','browser_endpoint','browser_connect','browser_attach','browser_navigation','browser_ready','browser_identity','contacts','normal_save','normal_reopen','lost_save','lost_reload','receipt_recovery','recovery_reopen','browser_close','cleanup','evidence']);
export function safeCrmFailure(error,fallback='request'){return{status:'crm_email_browser_unconfirmed',stage:STAGES.has(error?.qaStage)?error.qaStage:STAGES.has(fallback)?fallback:'unknown',cleanup:'check original two receipts and canonical synthetic draft deletion only'};}

import {QA,permittedRequest} from './session.mjs';
export const SYNTHETIC=Object.freeze({title:'INTERNAL QA meeting minute',edited:'INTERNAL QA meeting minute edited',body:'Synthetic browser acceptance only. No decisions, filing or external action.',local_at:'2026-10-15T12:00',timezone:'Europe/Athens',participants:''});
export const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const same=(a,b)=>JSON.stringify(Object.fromEntries(Object.entries(a||{}).sort()))===JSON.stringify(Object.fromEntries(Object.entries(b||{}).sort()));
export function companyBrowserFence(company,{expiresAt=Infinity,now=Date.now}={}){
 if(!UUID.test(company))throw Error('company_qa_scope');let step=0,record=null;const requests=[];
 return{record(id){if(record&&record!==id||!UUID.test(id))throw Error('company_qa_scope');record=id;},requests:()=>[...requests],count:()=>step,
 allow(r){try{const u=new URL(r.url),b=JSON.parse(r.postData||'{}'),fn=u.pathname.replace('/rest/v1/rpc/','');
 if(r.method==='GET')return u.origin===QA.site&&(u.pathname==='/social/'||u.pathname.startsWith('/assets/')||['/sw.js','/manifest.webmanifest','/favicon.ico'].includes(u.pathname));
 if(r.method==='OPTIONS')return u.origin===QA.base;
 if(r.method!=='POST'||u.origin!==QA.base)return false;
 if(['company_private_list','company_private_get','company_private_request'].includes(fn)){
  if(b.p_workspace!==QA.workspace||b.p_company!==company)return false;
  if(fn==='company_private_list')return same(b,{p_workspace:QA.workspace,p_company:company,p_kind:'minute',p_archived:b.p_archived,p_limit:b.p_limit,p_offset:0})&&typeof b.p_archived==='boolean'&&[1,32].includes(b.p_limit);
  if(fn==='company_private_get'){if(!record&&step===1&&UUID.test(b.p_id))record=b.p_id;return record&&same(b,{p_workspace:QA.workspace,p_company:company,p_id:record,p_before_version:null});}
  return requests.includes(b.p_request)&&same(b,{p_workspace:QA.workspace,p_company:company,p_request:b.p_request,p_cancel_if_missing:false});
 }
 if(fn==='company_private_mutate'){
  if(now()>=expiresAt||step>=5||!UUID.test(b.p_request)||requests.includes(b.p_request)||b.p_workspace!==QA.workspace||b.p_company!==company||Object.keys(b).sort().join()!==['p_workspace','p_company','p_request','p_action','p_args'].sort().join())return false;
  const action=['save','save','archive','restore','archive'][step];let args;
  if(step<2)args={id:step===0?null:record,expected_version:step,kind:'minute',data:{title:step===0?SYNTHETIC.title:SYNTHETIC.edited,body:SYNTHETIC.body,local_at:SYNTHETIC.local_at,timezone:SYNTHETIC.timezone,participants:''}};
  else args={id:record,expected_version:step};
  if(step>0&&!record||b.p_action!==action||!same({...b.p_args,data:undefined},{...args,data:undefined})||step<2&&!same(b.p_args.data,args.data)||step>=2&&!same(b.p_args,args))return false;
  requests.push(b.p_request);step++;return true;
 }
 return permittedRequest(r,null)||(['ops_records_list','ops_audit_list'].includes(fn)&&b.p_workspace===QA.workspace&&(fn==='ops_records_list'?same(b,{p_workspace:QA.workspace,p_kind:null,p_include_archived:false}):b.p_record===company&&b.p_limit===50&&Object.keys(b).length===3));
 }catch{return false;}}};
}

import {QA,permittedRequest} from './session.mjs';
import {OWNER_QA,OWNER_DESIGN,ownerSavePayload} from './private-owner-flow.mjs';
const canonical=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])):x);
export function ownerRequestFence(){let version=null,writes=0,previews=0;return{
 arm(value){if(version!==null||!/^([a-f0-9]{32})$/.test(value||''))throw Error('qa_fence_arm');version=value;},
 allow(request){try{const u=new URL(request.url),b=JSON.parse(request.postData||'{}');
 if(request.method==='POST'&&u.origin===QA.base&&u.pathname==='/rest/v1/rpc/home_content_save'){
  if(version===null||writes!==0||canonical(b)!==canonical(ownerSavePayload(version)))return false;writes++;return true;
 }
 if(request.method==='POST'&&u.origin===QA.site&&u.pathname==='/api/home-preview'){
  if(writes!==1||previews!==0||canonical(b)!==canonical({workspace:QA.workspace,listing:OWNER_QA.listing,design:OWNER_DESIGN}))return false;previews++;return true;
 }
 return permittedRequest(request,OWNER_QA.listing);
 }catch{return false;}},counts(){return{writes,previews};}};}

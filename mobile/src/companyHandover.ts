import {companyWork,companyDocuments} from '../../assets/operations/company-journey.mjs';
import {companyHandover} from '../../assets/operations/company-console-model.mjs';
import {nativeCompanyConsole} from './companyConsole.ts';
import type {OpsRecord} from './operations.ts';

type Reader=(name:string,args:Record<string,unknown>)=>Promise<any>;
type Scope={workspace:string;companyId:string;current:()=>boolean;read:Reader;includeDocuments:boolean};
export type ReviewedCompanyHandover={workspace:string;companyId:string;role:string;includeDocuments:boolean;packet:any;signature:string};
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const signature=(model:any,documents:any,role:string)=>JSON.stringify(canonical({role,company:model.company,projects:[...model.projects].sort((a,b)=>a.id.localeCompare(b.id)),tasks:[...model.tasks].sort((a,b)=>a.id.localeCompare(b.id)),contacts:[...model.contacts].sort((a,b)=>a.id.localeCompare(b.id)),documents:documents===null?null:[...documents].sort((a,b)=>a.id.localeCompare(b.id))}));
function check(scope:Scope){if(!uuid(scope.workspace)||!uuid(scope.companyId)||!scope.current())throw Error('Your company, account or workspace changed. Review the records again.');}
async function records(scope:Scope){
 check(scope);const value=await scope.read('ops_records_list',{p_workspace:scope.workspace,p_kind:null,p_include_archived:false});check(scope);
 if(value?.ok!==true||!['owner','admin','editor','viewer'].includes(value.role))throw Error('Current company access could not be verified.');
 if(!Array.isArray(value.records))throw Error('Company records could not be verified.');
 nativeCompanyConsole(value.records,scope.workspace,{companyId:scope.companyId});return {model:companyWork(value.records,scope.workspace,scope.companyId),role:value.role};
}
/** Read-only, current saved scope. No writer, contact cache or document contents. */
export async function reviewCompanyHandover(scope:Scope):Promise<ReviewedCompanyHandover>{
 const first=await records(scope);let documents=null;
 if(scope.includeDocuments){
  if(!['owner','admin','editor'].includes(first.role))throw Error('Private document records require an authorized editor or owner.');
  check(scope);const result=await scope.read('documents_list',{p_workspace:scope.workspace,p_project:null});check(scope);
  documents=companyDocuments(result,scope.workspace,first.model.projects);
  if(new Set(result.documents.map((d:any)=>d.id)).size!==result.documents.length||new Set(result.projects.map((p:any)=>p.id)).size!==result.projects.length||first.model.projects.some((p:OpsRecord)=>!result.projects.some((r:any)=>r.id===p.id&&!r.archived_at)))throw Error('Company document scope changed. Review the records again.');
  const final=await records(scope);
  if(signature(first.model,null,first.role)!==signature(final.model,null,final.role))throw Error('Company records changed while document records were checked. Review again.');
 }
 check(scope);const packet=JSON.parse(JSON.stringify(companyHandover(first.model,{documents}))),text=JSON.stringify(packet);
 if([...text].reduce((bytes,character)=>{const code=character.codePointAt(0)!;return bytes+(code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4);},0)>2_000_000)throw Error('This company record export is too large. Export the records on the web.');
 return {workspace:scope.workspace,companyId:scope.companyId,role:first.role,includeDocuments:scope.includeDocuments,packet,signature:signature(first.model,documents,first.role)};
}
/** Re-read and compare every selected saved record, including explicit clears. */
export async function confirmCompanyHandover(review:ReviewedCompanyHandover,scope:Scope){
 check(scope);
 if(review.workspace!==scope.workspace||review.companyId!==scope.companyId||review.includeDocuments!==scope.includeDocuments)throw Error('Choose the reviewed company scope.');
 const fresh=await reviewCompanyHandover(scope);
 if(fresh.signature!==review.signature)throw Error('Company records or access changed. Review the current records before sharing.');
 // Never trust a caller-mutated review payload: emit the fresh source packet.
 check(scope);return fresh.packet;
}

/** Native OS handover with injected installed file/share APIs, fenced at waits. */
export async function shareCompanyHandover(review:ReviewedCompanyHandover,scope:Scope,io:{available:()=>Promise<boolean>;create:(text:string,name:string)=>{uri:string;remove:()=>void};share:(uri:string)=>Promise<void>}){
 check(scope);const available=await io.available();check(scope);
 if(!available)throw Error('File sharing is unavailable on this device. Use the web company workspace to export records.');
 const packet=await confirmCompanyHandover(review,scope);check(scope);
 const copy=io.create(JSON.stringify(packet,null,2),'zoi-company-'+scope.companyId+'.json');
 try{check(scope);await io.share(copy.uri);check(scope);}finally{copy.remove();}
}

/** A temporary copy is never reused across a scope change or a second share. */
export function companyTemporaryCopy(){
 let remove:(()=>void)|null=null;
 return {replace(cleanup:()=>void){this.clear();remove=cleanup;},clear(){const cleanup=remove;remove=null;try{cleanup?.();}catch{}},present(){return remove!==null;}};
}

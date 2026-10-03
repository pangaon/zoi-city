import {actionPlanContext,validateActionPlan,actionPlanArgs} from './company-action-plan-model.mjs';
import {operationsDenied} from './recovery.mjs?v=20261003-current-suite-authority';
/** Sequential existing writes. There is one ordinary Operations recovery reference, no bulk ledger. */
export function createCompanyActionPlan({workspace,companyId,current,read,recovery,changed=()=>{},refused=()=>{}}){
 let plan=null,index=0,projectId=null,last=null,verified=false,busy=false,dead=false,error='',context=null;
 function assert(){if(dead||!current()){dispose();throw Error('Company plan access changed.');}}
 function dispose(){dead=true;plan=context=last=null;projectId=null;error='';index=0;verified=false;}
 const state=()=>({plan,index,projectId,last,verified,busy,dead,error,complete:!!plan&&index===plan.tasks.length+1&&verified,pending:!!recovery.state().marker});
 async function fresh(){assert();const value=await read();assert();context=actionPlanContext(value,workspace,companyId);return context;}
 async function verifyLast(){const c=await fresh();if(!last)return;const record=[c.company,...c.projects,...c.tasks].find(r=>r.id===last.record_id&&r.kind===last.kind&&r.version>=last.version&&!r.archived_at);if(!record||last.kind==='project'&&record.company_id!==companyId||last.kind==='task'&&record.project_id!==projectId)throw Error('A change saved, but its current project link could not be verified. Open saved work before continuing.');verified=true;}
 function committed(receipt){assert();const expected=index===0?'project':'task';if(receipt?.ok!==true||receipt.state!=='saved'||receipt.workspace_id!==workspace||receipt.kind!==expected||receipt.version!==1||!receipt.record_id)throw Error('The saved action receipt did not match this plan.');if(index===0)projectId=receipt.record_id;last=receipt;index++;verified=false;changed();}
 async function run(fn){assert();if(busy)throw Error('Wait for the current plan step.');busy=true;error='';changed();try{return await fn();}catch(e){if(!dead&&current()){if(operationsDenied(e)){dispose();refused();}else error=e instanceof Error?e.message:'The plan step could not be confirmed.';}throw e;}finally{busy=false;changed();}}
 return{state,dispose,
  prepare:draft=>run(async()=>{if(plan||recovery.state().blocked)throw Error('Resolve your previous change before starting a plan.');const c=await fresh();plan=validateActionPlan(draft,c);changed();}),
  advance:()=>run(async()=>{if(!plan)throw Error('Review this plan before saving.');if(recovery.state().blocked)throw Error('Check the previous change before continuing.');if(last&&!verified)await verifyLast();while(index<=plan.tasks.length){const c=await fresh();validateActionPlan(plan,c);const args=actionPlanArgs(plan,companyId,projectId,index);committed(await recovery.send('save',args));await verifyLast();}changed();return state();}),
  acceptRecovery:value=>run(async()=>{if(!plan)throw Error('Open the saved record to continue after reloading.');if(value.state==='missing')throw Error('No saved receipt yet. Check, retry exactly or cancel before continuing.');if(value.state==='saved'){committed(value);await verifyLast();}else if(value.state!=='cancelled')throw Error('Recovery outcome could not be verified.');changed();return state();})
 };
}

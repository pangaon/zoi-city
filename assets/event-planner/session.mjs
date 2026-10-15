import{UUID}from'../bookings/model.mjs';
import{sessionIdentity}from'../community/session-state.mjs';
function planAccount(C){
 const usable=sessionIdentity(C);if(usable)return usable;
 // An expired access token may still refresh. Bind its existing account without
 // treating token expiry as an account switch; Core must obtain a fresh token.
 const saved=C.auth.load?.();if(typeof saved?.access_token!=='string'||!saved.refresh_token||!UUID.test(saved.user_id||''))return'';
 try{const part=saved.access_token.split('.')[1],subject=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/'))).sub;return UUID.test(subject||'')&&subject.toLowerCase()===saved.user_id.toLowerCase()?subject.toLowerCase():'';}catch{return'';}
}
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function createPlanScope({C,current=()=>true,events=globalThis,onChange=()=>{},onDenied=()=>{}}){
 const actor=planAccount(C);let disposed=false;const cleanup=[];
 const scope={actor,sameActor:()=>planAccount(C)===actor,current:()=>!disposed&&current()&&planAccount(C)===actor,assert(){if(!scope.current()||!UUID.test(actor||''))throw Error('event_plan_account_changed');},onDispose(fn){if(disposed)fn();else cleanup.push(fn);},dispose(){if(disposed)return;disposed=true;events.removeEventListener?.('zoi:auth-change',changed);for(const fn of cleanup)fn();},async rpc(fn,args,auth='require'){scope.assert();try{const value=await C.api.rpc(fn,args,{auth,beforeDispatch:()=>scope.assert()});scope.assert();return value;}catch(error){if(auth==='require'&&Number(error?.status)===403&&scope.current()){scope.dispose();onDenied();}throw error;}}};
 function changed(){if(planAccount(C)===actor)return;scope.dispose();onChange();}
 events.addEventListener?.('zoi:auth-change',changed);return scope;
}
function validate(p,actor){
 if(!p||p.schema_version!==1||p.actor!==actor||!UUID.test(actor||'')||!['save','confirm'].includes(p.type)||typeof p.uncertain!=='boolean'||!p.args||!UUID.test(p.args.p_request_id||'')||!Number.isInteger(p.args.p_expected_version)||p.args.p_expected_version<0||JSON.stringify(p).length>65536)throw Error('event_plan_pending_unavailable');
 const keys=Object.keys(p.args).sort().join(',');
 if(p.type==='save'){if(keys!=='p_data,p_expected_version,p_plan,p_request_id'||(p.args.p_plan!==null&&!UUID.test(p.args.p_plan||''))||(p.args.p_plan===null&&p.args.p_expected_version!==0)||!p.args.p_data||typeof p.args.p_data!=='object'||Array.isArray(p.args.p_data)||!Array.isArray(p.args.p_data.selections)||p.args.p_data.selections.length>8||JSON.stringify(p.args.p_data).length>50000||stable(p.data)!==stable(p.args.p_data))throw Error('event_plan_pending_unavailable');}
 else if(keys!=='p_expected_version,p_plan,p_request_id'||!UUID.test(p.args.p_plan||'')||p.args.p_expected_version<1||p.plan?.id!==p.args.p_plan||p.plan?.version!==p.args.p_expected_version||!UUID.test(p.plan?.profile_id||'')||p.plan?.status!=='draft'||!Array.isArray(p.plan?.data?.selections)||stable(p.data)!==stable(p.plan.data))throw Error('event_plan_pending_unavailable');
 return p;
}
export function createPlanRecovery({scope,storage=globalThis.localStorage,legacyStorage=globalThis.sessionStorage||storage,locks=globalThis.navigator?.locks}){
 if(!UUID.test(scope.actor||''))throw Error('event_plan_account_changed');const key='zoi:event-plan:pending:v1:'+scope.actor,legacy='zoi_event_pending:'+scope.actor;
 function read(){try{const raw=storage.getItem(key);if(raw)return validate(JSON.parse(raw),scope.actor);const old=legacyStorage.getItem(legacy);if(!old)return null;const p=validate({...JSON.parse(old),schema_version:1,actor:scope.actor,uncertain:true},scope.actor);store(p);legacyStorage.removeItem(legacy);return p;}catch{throw Error('event_plan_pending_unavailable');}}
 function store(p){try{validate(p,scope.actor);const text=stable(p);storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error('storage');}catch{throw Error('event_plan_pending_unavailable');}}
 function clear(p){try{const original=read();if(stable(original?.args)!==stable(p.args)||original?.type!==p.type)throw Error('changed');storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('storage');}catch{throw Error('event_plan_pending_unavailable');}}
 return{pending:read,async begin(work){const start=()=>{scope.assert();if(read())throw Error('event_plan_original_retry_required');const p=validate({...structuredClone(work),schema_version:1,actor:scope.actor,uncertain:false},scope.actor);store(p);return p;};return locks?.request?locks.request(key,start):start();},async execute(verify){scope.assert();const p=read();if(!p)throw Error('event_plan_pending_unavailable');store({...p,uncertain:true});try{const result=await scope.rpc(p.type==='save'?'event_plan_save':'event_plan_confirm',structuredClone(p.args));scope.assert();await verify(result,p);scope.assert();clear(p);return{result,work:p};}catch(error){const known=[400,403].includes(Number(error?.status))&&/invalid_event_plan|invalid_event_selection|duplicate_event_slot|slot_unavailable|booking_unavailable|slot_version_conflict|booking_price_changed|version_conflict|event_plan_not_owned|event_plan_already_confirmed|party_exceeds_capacity|request_id_conflict|suite_session_unavailable|booking_actor_unavailable/.test(String(error?.message||''));if(!p.uncertain&&known&&scope.sameActor())clear(p);throw error;}}};
}

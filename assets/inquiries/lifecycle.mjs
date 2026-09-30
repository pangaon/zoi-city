// A mount belongs to one authenticated actor. A late response cannot repaint another account.
export function inquiryLifetime({getActor,connected=()=>true}){
 const actor=getActor();let disposed=false;
 const active=()=>!disposed&&connected()&&!!actor&&getActor()===actor;
 return{actor,active,dispose(){disposed=true},assert(){if(!active())throw Error('inquiry_stale_session')},async read(work){this.assert();const result=await work();this.assert();return result;}};
}

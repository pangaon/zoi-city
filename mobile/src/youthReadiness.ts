import{youthCapability}from'../../assets/organizations/youth-recovery.mjs';
/** Server-installed current identity/scope capability; absence stays read-only. */
export function nativeYouthReady(value?:unknown,actor='',workspace:string|null=null):boolean{return youthCapability(value,actor,workspace);}

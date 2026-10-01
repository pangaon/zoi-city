// A same-account role revocation must clear cached private state. Network failures
// and domain read-only states do not establish that read permission was revoked.
export function creatorAccessDenied(error:unknown):boolean {
 const e=error as {message?:string;code?:string;status?:number;statusCode?:number}|null;
 return e?.message==='creator_permission_denied'||e?.code==='42501'||[401,403].includes(Number(e?.status||e?.statusCode));
}
export async function creatorAccess<T>(work:()=>Promise<T>,current:()=>boolean,onDenied:()=>void):Promise<T>{
 try{return await work();}catch(error){if(current()&&creatorAccessDenied(error))onDenied();throw error;}
}

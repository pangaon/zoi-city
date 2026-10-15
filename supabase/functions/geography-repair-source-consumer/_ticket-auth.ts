/** A cron ticket admits one fixed source-only batch; it cannot authorize archive reads. */
export function captureAuthMode(request:Request,tokenAuthorized:boolean):'token'|'ticket'|null{
 const hasToken=request.headers.has('x-geography-repair-token'),hasTicket=request.headers.has('x-geography-capture-ticket');
 if(hasToken&&hasTicket)return null;
 if(hasToken)return tokenAuthorized?'token':null;
 if(hasTicket&&/^[a-f0-9]{64}$/.test(request.headers.get('x-geography-capture-ticket')||''))return'ticket';
 return null;
}
export async function consumeCaptureTicket(request:Request,input:unknown,consume:(ticket:string,strategy:string)=>Promise<any>,now=Date.now){
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const data=input as Record<string,unknown>,keys=Object.keys(data);
 if(keys.some(k=>k!=='strategy')||(Object.hasOwn(data,'strategy')&&data.strategy!=='publisher_profiles_v1'))return false;
 const ticket=request.headers.get('x-geography-capture-ticket')||'';if(!/^[a-f0-9]{64}$/.test(ticket))return false;
 const strategy=data.strategy==='publisher_profiles_v1'?'publisher_profiles_v1':'official_sources_v1';
 const result=await consume(ticket,strategy);
 return result?.admitted===true&&result.strategy===strategy&&result.job_cap===4&&result.max_source_requests===(strategy==='publisher_profiles_v1'?30:50)&&result.max_response_bytes===(strategy==='publisher_profiles_v1'?12000000:15000000)&&typeof result.expires_at==='string'&&Number.isFinite(Date.parse(result.expires_at))&&Date.parse(result.expires_at)>now();
}

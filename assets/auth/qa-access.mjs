const BASE='https://csebihpaychdkanjjsmz.supabase.co';
const FOUNDER='8426419c-8445-4ca5-92ab-aa865288bce7';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function qaClaims(token,now=Math.floor(Date.now()/1000)){
 if(typeof token!=='string'||token.length>8192||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))throw Error('invalid');
 let claims;try{claims=JSON.parse(atob(token.split('.')[1].replaceAll('-','+').replaceAll('_','/')));}catch{throw Error('invalid');}
 if(claims.iss!==BASE+'/auth/v1'||claims.role!=='authenticated'||claims.aud!=='authenticated'||claims.sub!==FOUNDER||!uuid.test(claims.session_id||'')||!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.iat>now+30||claims.exp<=now||claims.exp-now>3600||claims.exp-claims.iat>3600||claims.exp<=claims.iat)throw Error('invalid');
 return claims;
}
export async function acceptQaToken(token,{core=window.ZoiCore,fetcher=fetch,now=Math.floor(Date.now()/1000)}={}){
 const claims=qaClaims(token,now),prior=JSON.stringify(core.auth.load());
 const response=await fetcher(BASE+'/auth/v1/user',{headers:{apikey:core.KEY,Authorization:'Bearer '+token},redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('unavailable');const user=await response.json();
 if(user?.id!==claims.sub||!user.email_confirmed_at||user.is_anonymous===true)throw Error('unavailable');
 qaClaims(token); // Recheck expiry after the network request.
 if(JSON.stringify(core.auth.load())!==prior)throw Error('account_changed');
 core.auth.save({access_token:token,expires_at:claims.exp,user_id:user.id,email:user.email||null});
 return{expires:claims.exp};
}
if(typeof window!=='undefined'&&document.getElementById('status')){
 const token=window.__zoiQaToken;delete window.__zoiQaToken;
 acceptQaToken(token).then(({expires})=>{document.getElementById('title').textContent='Your QA session is ready';document.getElementById('status').textContent='Access expires at '+new Date(expires*1000).toLocaleString()+'. This session cannot renew itself.';document.getElementById('actions').hidden=false;}).catch(()=>{document.getElementById('title').textContent='This access link could not be verified';document.getElementById('status').textContent='It may have expired. Request a new temporary QA link.';});
}

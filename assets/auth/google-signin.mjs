// Optional identity action only. Public browsing never imports this module.
const KEY='zoi_google_pkce_v1';
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function fingerprint(C){const session=C.auth.load();return session?.access_token||null;}
function identity(C){const session=C.auth.load();if(!session)return null;try{const claims=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return JSON.stringify([claims.sub,claims.session_id]);}catch{return String(session.user_id||'invalid-session');}}
async function jsonRequest(C,path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const response=await fetch(C.BASE+path,{...options,headers:{apikey:C.KEY,'Content-Type':'application/json',...options.headers},signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error('Sign-in could not finish. Try email instead.');return body;}
 finally{clearTimeout(timer);}
}
export async function googleEnabled(C){try{return (await jsonRequest(C,'/auth/v1/settings')).external?.google===true;}catch{return false;}}
export async function beginGoogle(C,{storage=sessionStorage,url=location.href,navigate=value=>location.assign(value),cryptoImpl=crypto,now=Date.now,isCurrent=()=>true}={}){
 const actorBefore=identity(C);
 if(!await googleEnabled(C))throw new Error('Google sign-in is unavailable. You can use email instead.');
 if(identity(C)!==actorBefore)throw new Error('Your account changed. Start sign-in again.');
 const current=new URL(url),verifier=b64(cryptoImpl.getRandomValues(new Uint8Array(48))),attempt=b64(cryptoImpl.getRandomValues(new Uint8Array(24)));
 const challenge=b64(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 if(!isCurrent()||identity(C)!==actorBefore)throw new Error('Sign-in was cancelled or your account changed. Start again.');
 // Preserve only this same-origin workspace destination. No caller-controlled external return URL.
 const callback=new URL('/social/',current.origin);callback.searchParams.set('oauth_attempt',attempt);
 const returnPath=current.pathname+current.search+current.hash;
 storage.setItem(KEY,JSON.stringify({verifier,attempt,created:now(),returnPath,identity:actorBefore}));
 if(JSON.parse(storage.getItem(KEY)||'null')?.attempt!==attempt)throw new Error('This browser could not prepare sign-in. Use email instead.');
 const authorize=new URL('/auth/v1/authorize',C.BASE);authorize.searchParams.set('provider','google');authorize.searchParams.set('redirect_to',callback.href);authorize.searchParams.set('code_challenge',challenge);authorize.searchParams.set('code_challenge_method','s256');
 navigate(authorize.href);
}
export async function finishGoogle(C,{storage=sessionStorage,url=location.href,replace=value=>history.replaceState(null,'',value),now=Date.now}={}){
 const current=new URL(url);if(!current.searchParams.has('code')&&!current.searchParams.has('error'))return false;
 const code=current.searchParams.get('code'),attempt=current.searchParams.get('oauth_attempt');
 // Remove one-use codes and provider errors before further resources/navigation load.
 ['code','error','error_code','error_description','oauth_attempt'].forEach(name=>current.searchParams.delete(name));replace(current.pathname+current.search+current.hash);
 let pending;try{pending=JSON.parse(storage.getItem(KEY)||'null');}catch{}storage.removeItem(KEY);
 if(!pending||pending.attempt!==attempt||!code||now()-pending.created>600000||now()<pending.created)throw new Error('This sign-in link expired or was cancelled. Try again, or use email.');
 if(pending.identity!==identity(C))throw new Error('Your account changed. Start sign-in again.');
 const destination=new URL(pending.returnPath,current.origin);if(destination.origin!==current.origin||!['/social','/social/'].includes(destination.pathname))throw new Error('Sign-in could not return to this page. Try again.');
 const before=fingerprint(C);let cancelled=false;const changed=()=>{cancelled=true;};window.addEventListener('zoi:auth-change',changed);
 try{
  const body=await jsonRequest(C,'/auth/v1/token?grant_type=pkce',{method:'POST',body:JSON.stringify({auth_code:code,code_verifier:pending.verifier})});
  if(cancelled||fingerprint(C)!==before)throw new Error('Your account changed while signing in. Please try again.');
  if(!body.access_token||!body.refresh_token||!body.user?.id||!Number.isFinite(body.expires_in)||body.expires_in<=0)throw new Error('Sign-in could not finish. Try email instead.');
  C.auth.save({access_token:body.access_token,refresh_token:body.refresh_token,expires_at:Math.floor(now()/1000)+body.expires_in,user_id:body.user.id,email:body.user.email||null});
  destination.searchParams.delete('signin');replace(destination.pathname+destination.search+destination.hash);return true;
 }finally{window.removeEventListener('zoi:auth-change',changed);}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto,createHash } from 'node:crypto';
import { beginGoogle,finishGoogle } from '../../assets/auth/google-signin.mjs';
const storage=()=>{const map=new Map();return{setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)||null,removeItem:k=>map.delete(k)}};
function core(){let session=null;return {BASE:'https://auth.example.test',KEY:'public-test-key',auth:{load:()=>session,save:value=>{session=value;}}};}
test('Google PKCE uses cryptographic S256 and same-origin callback without session token in URL',async()=>{
 const original=global.fetch;global.fetch=async()=>new Response(JSON.stringify({external:{google:true}}));
 try{const C=core(),store=storage();let target;await beginGoogle(C,{storage:store,url:'https://zoi.test/social/?workspace=example#operations',navigate:value=>target=value,cryptoImpl:webcrypto,now:()=>100});const url=new URL(target),pending=JSON.parse(store.getItem('zoi_google_pkce_v1'));assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(pending.verifier).digest('base64url'));assert.equal(new URL(url.searchParams.get('redirect_to')).origin,'https://zoi.test');assert.equal(url.searchParams.has('access_token'),false);assert.equal(pending.identity,null);}finally{global.fetch=original;}
});
test('PKCE callback consumes verifier, removes code before exchange and persists returned identity',async()=>{
 const original=global.fetch;const priorWindow=global.window;global.window=new EventTarget();const C=core(),store=storage();store.setItem('zoi_google_pkce_v1',JSON.stringify({verifier:'a'.repeat(64),attempt:'attempt',created:100,returnPath:'/social/?workspace=abc#operations',identity:null}));let clean=false;let body;
 global.fetch=async(url,options)=>{assert.ok(clean);assert.equal(url,'https://auth.example.test/auth/v1/token?grant_type=pkce');body=JSON.parse(options.body);return new Response(JSON.stringify({access_token:'returned-test-token',refresh_token:'returned-test-refresh',expires_in:3600,user:{id:'returned-user'}}));};
 try{assert.equal(await finishGoogle(C,{storage:store,url:'https://zoi.test/social/?code=one-use&oauth_attempt=attempt',replace:()=>clean=true,now:()=>200}),true);assert.equal(body.code_verifier,'a'.repeat(64));assert.equal(store.getItem('zoi_google_pkce_v1'),null);assert.equal(C.auth.load().user_id,'returned-user');}finally{global.fetch=original;global.window=priorWindow;}
});
test('expired, mismatched, foreign return and account-changed callbacks never exchange or save',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('must not exchange');};
 try{for(const change of [{created:0},{attempt:'different'},{returnPath:'https://outside.test/social/'},{identity:'another-account'}]){const C=core(),store=storage();store.setItem('zoi_google_pkce_v1',JSON.stringify({verifier:'a'.repeat(64),attempt:'attempt',created:999999,returnPath:'/social/',identity:null,...change}));await assert.rejects(()=>finishGoogle(C,{storage:store,url:'https://zoi.test/social/?code=one-use&oauth_attempt=attempt',replace:()=>{},now:()=>1000000}));assert.equal(C.auth.load(),null);assert.equal(store.getItem('zoi_google_pkce_v1'),null);}assert.equal(calls,0);}finally{global.fetch=original;}
});

test('account or sign-in surface change during held PKCE digest never persists or redirects',async()=>{
 const previous=global.fetch;global.fetch=async()=>new Response(JSON.stringify({external:{google:true}}));
 try{for(const transition of ['account','surface']){
  const C=core(),store=storage();let release,live=true,navigation=null;
  const pending=beginGoogle(C,{storage:store,url:'https://zoi.test/social/',navigate:v=>navigation=v,isCurrent:()=>live,cryptoImpl:{getRandomValues:a=>webcrypto.getRandomValues(a),subtle:{digest:async(...args)=>{await new Promise(resolve=>release=resolve);return webcrypto.subtle.digest(...args);}}}});
  while(!release)await new Promise(resolve=>setTimeout(resolve,1));
  if(transition==='account')C.auth.save({user_id:'another-actor',access_token:'e30.'+btoa(JSON.stringify({sub:'another-actor',session_id:'another-session'}))+'.fixture'});else live=false;
  release();await assert.rejects(pending,/cancelled|changed/);assert.equal(navigation,null);assert.equal(store.getItem('zoi_google_pkce_v1'),null);
 }}finally{global.fetch=previous;}
});

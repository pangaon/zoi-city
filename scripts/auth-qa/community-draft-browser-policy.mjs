import{QA}from'./session.mjs';
import{CODE_FILES as BYTE_FILES,sha,fixtureBytes,sameMetadata,UUID}from'./community-media-blob-policy.mjs';
export{sha,fixtureBytes,sameMetadata,UUID};
export const REQUEST='ops/community-draft-browser-qa.json';
export const CODE_FILES=[...new Set([...BYTE_FILES,'scripts/auth-qa/community-draft-browser-ci.mjs','scripts/auth-qa/community-draft-browser.mjs','scripts/auth-qa/community-draft-browser-policy.mjs','tests/unit/community-draft-browser-qa.test.mjs','.github/workflows/community-draft-browser-qa.yml'])].sort();
export const WEB_FILES=['community/index.html','assets/zoi-core.js','assets/community/experience.mjs','assets/community/member-draft.mjs','assets/community/media-client.mjs','assets/community/media-rules.mjs','assets/community/session-state.mjs','assets/community/view-model.mjs','assets/documents/bounded-body.mjs','assets/community/experience.css','assets/community/public-experience.mjs','assets/community/public-experience.css'];
export const SYNTHETIC=Object.freeze({body:'Dedicated private Community acceptance draft. Never publish.',alt:'Synthetic one-pixel private acceptance PNG'});
export function nonces(id){if(!UUID.test(id||''))throw Error('request_scope');return Object.fromEntries(['media','save','discard'].map(k=>{let x=sha(id+':community-private-browser:'+k).slice(0,32).split('');x[12]='4';x[16]='8';x=x.join('');return[k,`${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`];}));}
export function payload(asset){if(!UUID.test(asset||''))throw Error('asset_scope');return{body:SYNTHETIC.body,media:[asset],listing:null,context:{intent:'moment',topics:[],city:null,country:null,media_alts:{[asset]:SYNTHETIC.alt}}};}
export const same=(a,b)=>JSON.stringify(a,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)===JSON.stringify(b,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function validateRequest(env,r,e,now=Date.now(),cleanup=false){
 if(r?.enabled===false){if(Object.keys(r).join()!=='enabled')throw Error('disabled_request_shape');return false;}
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!=='pangaon/zoi-city'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='push'||env.GITHUB_RUN_ATTEMPT!=='1')throw Error('trusted_main');
 const start=Date.parse(r?.issued_at),end=Date.parse(r?.expires_at);
 if(Object.keys(r||{}).sort().join()!==['enabled','purpose','request_id','parent_sha','issued_at','expires_at','code_sha256','web_sha256','edge_bundle_sha256'].sort().join()||r.enabled!==true||!['dedicated-community-private-browser-qa-v1','dedicated-community-private-browser-cleanup-v1'].includes(r.purpose)||!UUID.test(r.request_id||'')||!Number.isFinite(start)||!Number.isFinite(end)||now<start||now>=end+(cleanup?3600000:0)||end<=start||end-start>1800000)throw Error('request_admission');
 if(!/^[a-f0-9]{40}$/.test(r.parent_sha||'')||e.parents!==1||e.parent!==r.parent_sha||e.head!==env.GITHUB_SHA||e.event?.before!==r.parent_sha||e.event?.after!==e.head||e.event?.ref!=='refs/heads/main'||e.event?.repository?.full_name!=='pangaon/zoi-city'||e.event.repository.private!==false||e.event.repository.visibility!=='public'||e.event.forced!==false||e.event.created!==false||e.event.deleted!==false||!['A\t'+REQUEST,'M\t'+REQUEST].includes(e.diff))throw Error('request_push');
 for(const[field,files]of[['code_sha256',CODE_FILES],['web_sha256',WEB_FILES]])if(Object.keys(r[field]||{}).sort().join()!==[...files].sort().join()||files.some(p=>!/^[a-f0-9]{64}$/.test(r[field][p]||'')||r[field][p]!==e.hashes[p]))throw Error('request_source');
 if(!/^[a-f0-9]{64}$/.test(r.edge_bundle_sha256||''))throw Error('request_source');return true;
}
export function browserFence(request,{expiresAt}={}){
 const n=nonces(request);let uploads=0,saves=0,discards=0,asset=null,draft=null;const valid=()=>Date.now()<expiresAt;
 return{bindAsset(id){if(!UUID.test(id||'')||asset&&asset!==id)throw Error('asset_scope');asset=id;},bindDraft(id){if(!UUID.test(id||'')||draft&&draft!==id)throw Error('draft_scope');draft=id;},counts:()=>({uploads,saves,discards}),
 allow(req){try{if(!valid())return false;const u=new URL(req.url);if(req.method==='GET'){if(u.origin===QA.site)return u.pathname==='/community/'||u.pathname.startsWith('/assets/');if(u.origin===QA.base&&u.pathname==='/functions/v1/community-media')return u.searchParams.get('action')==='draft-preview'&&u.searchParams.size===3&&u.searchParams.get('draft')===draft&&u.searchParams.get('asset')===asset&&!!draft&&!!asset;return false;}
 if(req.method==='OPTIONS')return u.origin===QA.base;if(req.method!=='POST'||u.origin!==QA.base)return false;
 if(u.pathname==='/functions/v1/community-media'&&u.search==='?action=upload'){if(uploads||!Object.entries(req.headers||{}).some(([k,v])=>k.toLowerCase()==='content-type'&&/^multipart\/form-data; boundary=/.test(v)))return false;uploads++;return true;}
 if(!u.pathname.startsWith('/rest/v1/rpc/'))return false;const fn=u.pathname.split('/').at(-1),b=JSON.parse(req.postData||'{}');
 if(['zoi_me','community_me'].includes(fn))return Object.keys(b).length===0;
 if(fn==='community_draft_get')return same(b,{p_draft:null})||!!draft&&same(b,{p_draft:draft});
 if(fn==='community_draft_history')return !!draft&&same(b,{p_draft:draft,p_before:null});
 if(fn==='community_draft_request')return [n.save,n.discard].includes(b.p_request)&&same(b,{p_request:b.p_request,p_cancel_if_missing:false});
 if(fn!=='community_draft_mutate')return false;
 if(!saves&&asset&&same(b,{p_request:n.save,p_action:'save',p_draft:null,p_expected_version:0,p_payload:payload(asset)})){saves++;return true;}
 if(saves===1&&!discards&&draft&&same(b,{p_request:n.discard,p_action:'discard',p_draft:draft,p_expected_version:1,p_payload:null})){discards++;return true;}return false;
 }catch{return false;}}};
}
const STAGES=new Set(['request','source','schema','session','preflight','browser_open','browser_ready','identity','compose','select_png','save','preview','reload','reopen','discard','canonical_check','cleanup','evidence']);
const CHECKS=new Set(['request_admission','request_source','web_source_unconfirmed','edge_source_unconfirmed','schema_unconfirmed','preflight_unconfirmed','canonical_unconfirmed','cleanup_unconfirmed','object_cleanup_unconfirmed','browser_unconfirmed']);
export function safeFailure(stage,error={},ids={},runStage=stage){return{unconfirmed:true,manual_reconciliation_required:true,automatic_retry:false,stage:STAGES.has(stage)?stage:'request',run_stage:STAGES.has(runStage)?runStage:'request',check:CHECKS.has(error.message)?error.message:'unknown',draft_id:UUID.test(ids.draft||'')?ids.draft:null,asset_id:UUID.test(ids.asset||'')?ids.asset:null};}

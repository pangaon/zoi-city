// Pure outward website policy. Never writes owner content or supplies replacement URLs.
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const own=(x,k)=>Object.hasOwn(object(x),k);
const normalized=Symbol('official-source-normalized');
const flagged=x=>x===true||x==='true';
const context=e=>e?.media_input&&typeof e.media_input==='object'?{...e,...e.media_input}:e;
// _enrich is machine content, never an owner override. Keep the review receipt
// available to owner tools, but do not project a known wrong source's content.
const receiptKeys=new Set(['source_url','provenance','checked_at','last_attempt_at','last_success_at','media_expires_at','blocked','blocked_reason','last_error','status','crawl_status','lease','source_kind','identity_scope','scope_review_required','organization_identity_quarantine','source_affiliation','member_source','publisher_source_evidence','email_conflict','phone_conflict']);
export function sourceIdentityContentHeld(entity){return object(context(entity)?.profile?._enrich).blocked_reason==='source_scope_mismatch';}
function receiptOnly(value){return Object.fromEntries(Object.entries(object(value)).filter(([key])=>receiptKeys.has(key)));}
export function officialSiteURL(value){try{if(typeof value!=='string')return '';const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function officialSourceQuarantined(entity){
 entity=context(entity);
 const q=object(entity?.profile?._enrich);
 return q.blocked_reason==='source_scope_mismatch'||flagged(q.scope_review_required)||flagged(q.organization_identity_quarantine);
}
function selected(entity){
 const owner=object(entity?.owner_content),profile=object(entity?.profile);
 for(const layer of [owner,object(owner.profile),profile])if(own(layer,'website'))return{present:true,value:layer.website};
 return{present:false,value:entity?.website};
}
export function selectedOfficialWebsite(entity){
 if(entity?.[normalized])return entity[normalized].website;
 entity=context(entity);
 const chosen=selected(entity),site=officialSiteURL(chosen.value);
 if(!site||!officialSourceQuarantined(entity))return site;
 // An imported/default website is withheld on an explicit source hold.
 // Published owner/profile fields remain authoritative, including same-domain
 // edits and clears. A stale machine receipt is not a moderation decision.
 return chosen.present?site:'';
}
export function officialSourceEntity(entity){
 if(!entity||typeof entity!=='object'||Array.isArray(entity))return entity;
 if(entity[normalized])return entity;
 const original=entity;entity=context(entity);
 const site=selectedOfficialWebsite(entity),chosen=selected(entity);
 // Keep an accepted stored URL's exact spelling in canonical/schema payloads.
 // Outward action helpers still normalize its URL independently.
 const out={...entity,website:site?(chosen.present?chosen.value:entity.website):''};
 if(sourceIdentityContentHeld(entity))out.profile={...object(entity.profile),_enrich:receiptOnly(entity.profile?._enrich)};
 // Clamp all fallback layers only when their selected outward website is empty.
 // This is a transient public projection; the supplied record remains untouched.
 if(!site&&(officialSourceQuarantined(entity)||chosen.present)){
  const raw=object(out.profile),owner=object(entity.owner_content);
  out.profile={...raw,website:'',...(officialSourceQuarantined(entity)?{_enrich:{...object(raw._enrich),website:''}}:{})};
  if(own(owner,'website')||own(owner.profile,'website'))out.owner_content={...owner,website:'',...(owner.profile?{profile:{...object(owner.profile),website:''}}:{})};
 }
 // Compact search context must carry the same cleaned view. Stored inputs and
 // explicit owner/profile/base fields remain unchanged; this is not a write.
 if(original.media_input&&typeof original.media_input==='object')out.media_input={...original.media_input,profile:out.profile,website:out.website};
 Object.defineProperty(out,normalized,{value:{website:site},enumerable:false});
 return out;
}

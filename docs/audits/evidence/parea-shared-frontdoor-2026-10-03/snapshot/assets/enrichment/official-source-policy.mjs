// Pure outward website policy. Never writes owner content or supplies replacement URLs.
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const own=(x,k)=>Object.hasOwn(object(x),k);
const normalized=Symbol('official-source-normalized');
const flagged=x=>x===true||x==='true';
const context=e=>e?.media_input&&typeof e.media_input==='object'?{...e,...e.media_input}:e;
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
 const site=selectedOfficialWebsite(entity),chosen=selected(entity);
 // Keep an accepted stored URL's exact spelling in canonical/schema payloads.
 // Outward action helpers still normalize its URL independently.
 const out={...entity,website:site?(chosen.present?chosen.value:entity.website):''};
 // Clamp all fallback layers only when their selected outward website is empty.
 // This is a transient public projection; the supplied record remains untouched.
 if(!site&&(officialSourceQuarantined(entity)||chosen.present)){
  const raw=object(entity.profile),owner=object(entity.owner_content);
  out.profile={...raw,website:'',...(officialSourceQuarantined(entity)?{_enrich:{...object(raw._enrich),website:''}}:{})};
  if(own(owner,'website')||own(owner.profile,'website'))out.owner_content={...owner,website:'',...(owner.profile?{profile:{...object(owner.profile),website:''}}:{})};
 }
 Object.defineProperty(out,normalized,{value:{website:site},enumerable:false});
 return out;
}

const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const owns=(value,key)=>Object.hasOwn(object(value),key);
function override(entity){
 const owner=object(entity?.owner_content),profile=object(entity?.profile),ownedProfile=object(owner.profile);
 if(owns(owner,'social_links'))return {present:true,value:object(owner.social_links)};
 for(const key of ['social_links','social'])if(owns(ownedProfile,key))return {present:true,value:object(ownedProfile[key])};
 const keys=['social_links','social'].filter(key=>owns(profile,key));
 if(keys.some(key=>!Object.keys(object(profile[key])).length))return {present:true,value:{}};
 if(keys.length)return {present:true,value:{...object(profile.social),...object(profile.social_links),...object(entity?.social_links)}};
 return {present:false,value:{}};
}
export function hasSocialOverride(entity){return override(entity).present;}
// Source input must already pass the caller's publisher/member/identity filters.
// An explicit dictionary replaces the whole set, so deleting one channel sticks.
export function resolveSocialLinks(entity,validatedProfile={},fallback={}){
 const own=override(entity);if(own.present)return {...own.value};
 return {...object(fallback),...object(validatedProfile.social),...object(validatedProfile.social_links),...object(entity?.social_links)};
}

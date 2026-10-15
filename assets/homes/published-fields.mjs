// Presence wins over fallbacks, including explicit null, empty and invalid edits.
// Callers supply their already-scoped fallback; this never reads machine facts.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export function publishedField(entity,key,fallback){
 const owner=object(entity?.owner_content);
 for(const layer of[owner,object(owner.profile),object(entity?.profile)])if(Object.hasOwn(layer,key))return layer[key];
 return fallback;
}
export function publishedEmail(entity,fallback=''){
 const value=publishedField(entity,'email',fallback),email=typeof value==='string'?value.trim():'';
 return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)?email:'';
}

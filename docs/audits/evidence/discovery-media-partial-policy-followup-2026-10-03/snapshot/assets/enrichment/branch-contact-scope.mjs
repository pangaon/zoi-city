// Reviewed Fournos root page exposes multiple branch popup contacts. Its first
// telephone belongs to The View, not a central contact or every listed branch.
// Keep brand assets/menu/socials; discard only machine location-contact fallback.
export function sharedBranchContactSource(entity,sourceURL){
 if(!['business','vendor'].includes(entity?.entity_type)||!/^fournos(?: bakery)?(?:\s|$)/i.test(String(entity?.name||'').trim()))return false;
 try{const u=new URL(sourceURL);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port&&['fournos.co.za','www.fournos.co.za'].includes(u.hostname.toLowerCase())&&/^\/(?:index\.(?:html?|php))?$/i.test(u.pathname);}catch{return false;}
}
export const BRANCH_CONTACT_FIELDS=new Set(['phone','email','hours','hours_raw','address','address_parts','geo','latitude','longitude','postcode']);

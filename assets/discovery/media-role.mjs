// Asset identity is exact. CDN transforms, filenames, dimensions and category
// cannot establish that a picture is a client's logo or a photograph.
const roles=new Set(['brand_logo','event_poster','photograph']);
export function exactImageURL(value){try{if(typeof value!=='string'||value.length>3000)return null;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function sourceKey(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port?u.protocol+'//'+u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search:null;}catch{return null;}}
export function assetRole({url,ownerRole,ownerURL,sourceURL,registeredSource,trusted=false,evidence=[]}={}){
 const asset=exactImageURL(url);if(!asset)return null;
 if(roles.has(ownerRole)&&exactImageURL(ownerURL)===asset)return ownerRole;
 if(!trusted||!sourceKey(sourceURL)||sourceKey(sourceURL)!==sourceKey(registeredSource))return 'unknown_media';
 const matches=(Array.isArray(evidence)?evidence:[]).filter(r=>exactImageURL(r?.url)===asset&&roles.has(r?.role)&&sourceKey(r.source_url)===sourceKey(sourceURL)&&/^[a-f0-9]{64}$/.test(r.asset_sha256||'')&&r.reviewed===true);
 const distinct=new Set(matches.map(r=>r.role));return distinct.size===1?[...distinct][0]:'unknown_media';
}
export function assetFit(role){return role==='photograph'?'cover':'contain';}

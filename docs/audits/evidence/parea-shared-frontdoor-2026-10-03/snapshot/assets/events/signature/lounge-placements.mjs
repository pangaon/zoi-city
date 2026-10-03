// Presentation gate only: placements must come from an authorized, reviewed server configuration.
// This module does not approve sponsors, create orders, or establish inventory.
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
export function activeLoungePlacements(values,{eventId,configuration,configurationVersion,now=Date.now()}={}){
 if(!Array.isArray(values)||!eventId||!configurationVersion||!['front','side'].includes(configuration)||!Number.isFinite(now))return[];
 const ids=new Set();return values.slice(0,100).flatMap(p=>{
  if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||p.approval!=='approved'||p.event_id!==eventId||p.configuration!==configuration||p.configuration_version!==configurationVersion)return[];
  const starts=Date.parse(p.starts_at),ends=Date.parse(p.ends_at),image=https(p.image_url),destination=https(p.destination_url);
  if(!Number.isFinite(starts)||!Number.isFinite(ends)||starts>now||ends<=now||ends<=starts||!image||!destination||typeof p.title!=='string'||!p.title.trim()||p.title.length>120||typeof p.description!=='string'||p.description.length>600)return[];
  ids.add(p.id);return[{id:p.id,title:p.title.trim(),description:p.description,image_url:image,destination_url:destination,expires_at:ends}];
 }).slice(0,3);
}

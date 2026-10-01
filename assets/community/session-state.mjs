import {UUID,TOPICS} from './view-model.mjs';
export function sessionIdentity(core){
  const session=core.auth.load?.(),token=core.auth.token();
  if(!token)return '';
  const stored=UUID.test(session?.user_id||'')?session.user_id:'';
  let subject='';
  try{const segment=token.split('.')[1];const payload=JSON.parse(atob(segment.replace(/-/g,'+').replace(/_/g,'/')));if(UUID.test(payload.sub||''))subject=payload.sub;}catch{}
  if(stored&&subject&&stored.toLowerCase()!==subject.toLowerCase())return '';
  return (subject||stored).toLowerCase();
}
export function pendingPublication(value){return !!value&&UUID.test(value.p_request||'')&&typeof value.p_body==='string'&&value.p_body.trim().length>0&&value.p_body.length<=1000&&Array.isArray(value.p_media)&&value.p_media.length<=4&&value.p_media.every(x=>UUID.test(x))&&new Set(value.p_media).size===value.p_media.length&&['moment','question','recommendation','event'].includes(value.p_context?.intent)&&Array.isArray(value.p_context?.topics)&&value.p_context.topics.length<=5&&value.p_context.topics.every(x=>TOPICS.includes(x))&&(value.p_listing===null||UUID.test(value.p_listing||''));}
export function scopedStore(storage,profile,kind,value){if(!UUID.test(profile||''))throw Error('session_changed');const key='zoi_community_'+kind+'_'+profile;try{if(value===undefined){const raw=storage.getItem(key);return raw?JSON.parse(raw):null;}if(value===null)storage.removeItem(key);else{const text=JSON.stringify(value);storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error('storage');}return value;}catch{throw Error('draft_storage_unavailable');}}
export function profileMatches(profile,data,version){return !!profile&&profile.version===version&&['handle','display_name','bio'].every(k=>(profile[k]||'')===String(data[k]||'').trim())&&['city','country'].every(k=>(profile[k]||'')===String(data[k]||'').trim())&&(profile.avatar_media_id||null)===(data.avatar_media_id||null)&&JSON.stringify([...(profile.interests||[])].sort())===JSON.stringify([...(data.interests||[])].sort());}
export function assertScope(expected,current){if(!UUID.test(expected||'')||expected!==current)throw Error('session_changed');}

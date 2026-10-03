export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function place(value){return String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim();}
export function validPlace(value){const s=place(value);return s.length>=2&&s.length<=100&&/^[\p{L}\p{M}\p{N} .,'’()\/-]+$/u.test(s);}
export function demandPayload({artist,city,country,active,request,version}){city=place(city);country=place(country);if(!uuid(artist)||!uuid(request)||!validPlace(city)||!validPlace(country)||typeof active!=='boolean'||!Number.isSafeInteger(version)||version<0)throw Error('Choose a city and country using their full names.');return {p_artist:artist,p_city:city,p_country:country,p_active:active,p_request:request,p_expected_version:version};}
export function receiptMatches(reply,payload){return reply?.ok===true&&reply.artist===payload.p_artist&&reply.request===payload.p_request&&reply.active===payload.p_active&&reply.version===payload.p_expected_version+1;}

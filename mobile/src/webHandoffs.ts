/** Explicit destinations for web capabilities that have no equivalent native screen yet. */
export function nativeWebHandoff(value:string):string|null{
 try{const raw=value.startsWith('zoi://')?'https://www.zoi.city/'+value.slice(6):value,u=new URL(raw,'https://www.zoi.city');if(u.origin!=='https://www.zoi.city'||u.username||u.password)return null;
  if(/^\/community\/?$/.test(u.pathname)&&u.hash==='#music')return 'https://www.zoi.city/community/#music';
  if(/^\/organization-calendar\/?$/.test(u.pathname)&&!u.searchParams.has('listing'))return 'https://www.zoi.city/organization-calendar/';
  return null;
 }catch{return null}
}

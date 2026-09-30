/** Explicit destinations for web capabilities that have no equivalent native screen yet. */
export function nativeWebHandoff(value:string):string|null{
 try{const raw=value.startsWith('zoi://')?'https://www.zoi.city/'+value.slice(6):value,u=new URL(raw,'https://www.zoi.city');if(u.origin!=='https://www.zoi.city'||u.username||u.password)return null;
  if(/^\/community\/?$/.test(u.pathname)&&u.hash==='#music')return 'https://www.zoi.city/community/#music';
  if(/^\/organization-calendar\/?$/.test(u.pathname)&&!u.searchParams.has('listing'))return 'https://www.zoi.city/organization-calendar/';
  if(/^\/explore\/map\/?$/.test(u.pathname)){
   const target=new URL('https://www.zoi.city/explore/map/');
   for(const [key,max]of [['q',120],['place',240],['t',200]] as const){const v=u.searchParams.get(key);if(v&&v.length<=max&&!/[\u0000-\u001f]/.test(v))target.searchParams.set(key,v);}
   const parts=u.hash.slice(1).replace(/^\//,'').split('/'),nums=parts.map(Number);
   if(parts.length>=3&&parts.length<=5&&parts.every(v=>/^-?\d+(?:\.\d+)?$/.test(v)&&v.length<=20)&&nums.every(Number.isFinite)&&nums[0]>=0&&nums[0]<=24&&Math.abs(nums[1])<=90&&Math.abs(nums[2])<=180&&(nums[3]===undefined||Math.abs(nums[3])<=360)&&(nums[4]===undefined||nums[4]>=0&&nums[4]<=85))target.hash=nums.join('/');
   return target.href;
  }
  return null;
 }catch{return null}
}

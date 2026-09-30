import {hasSocialOverride,resolveSocialLinks} from '../assets/homes/social-links.mjs';
// Accept only the server's whitelisted owner-write projection, never crawler fields.
const has=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=v=>typeof v==='string'?v.slice(0,20000):'';
export function ownerURL(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
const email=v=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(text(v))?text(v):'';
const socials=v=>Object.entries(object(v)).filter(([k,url])=>/^[a-z][a-z0-9_ -]{0,39}$/i.test(k)&&ownerURL(url)).map(([id,url])=>({id,label:id,description:'',url:ownerURL(url)}));
export function ownerHomeContent(base,entity,family){const out={...base},edits=object(entity.owner_content),p=object(edits.profile);if(has(edits,'description')){out[family==='music'?'story':family==='creator'?'bio':'intro']=text(edits.description);out.owner_description=true;}if(has(edits,'photo_url')){out[family==='events'?'hero':'portrait']=ownerURL(edits.photo_url);out.portrait_sources=[];out.portrait_credit=out.portrait?'Provided by the owner':'';}
 if(has(edits,'email'))out.email=email(edits.email);if(has(edits,'phone')){out.phone=/^[+\d ()-]{5,30}$/.test(text(edits.phone))?text(edits.phone):'';out.phone_label=out.phone;}
 if(hasSocialOverride(entity)){const links=resolveSocialLinks(entity);out.socials=socials(links);if(family==='creator')out.channels=(out.channels||[]).filter(c=>out.socials.some(s=>s.url===ownerURL(c.url)));if(family==='music')for(const k of ['spotify','youtube','facebook','instagram'])out[k]=ownerURL(links[k]);if(family==='music'&&!has(p,'video_playlist')&&!has(object(entity.profile),'video_playlist'))out.video_playlist='';}
 if(family==='music'){for(const[k,key]of Object.entries({spotify_url:'spotify',youtube_url:'youtube'}))if(has(p,k))out[key]=ownerURL(p[k]);else if(has(object(entity.profile),k))out[key]=ownerURL(entity.profile[k]);if(has(p,'video_playlist'))out.video_playlist=ownerURL(p.video_playlist);else if(has(object(entity.profile),'video_playlist'))out.video_playlist=ownerURL(entity.profile.video_playlist);else if(has(p,'youtube_url')||has(object(entity.profile),'youtube_url'))out.video_playlist='';if(has(p,'press')){out.story=text(p.press);out.owner_description=true;}if(has(p,'booking_email'))out.email=email(p.booking_email);}
 if(has(p,'photos')&&family==='music'){out.gallery=(Array.isArray(p.photos)?p.photos:[]).slice(0,12).map(x=>({url:ownerURL(typeof x==='string'?x:x?.url),caption:text(x?.caption)||out.name,credit:'Provided by the owner',source:out.website})).filter(x=>x.url);}
 return out;}

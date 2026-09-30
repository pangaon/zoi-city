import{auxiliaryImage}from'../supabase/functions/zoi-enrich/_image-context.js';
// Display selection for existing profile media. Owner selections retain priority;
// crawler fallback rejects interface artwork and duplicate resized derivatives.
export function httpsImage(value){
 if(typeof value!=='string'||value.length>3000)return null;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function machineImage(value){const url=httpsImage(value);if(!url||auxiliaryImage(url))return null;const u=new URL(url);return u.pathname==='/'&&!u.search?null:url;}
export function imageIdentity(value){
 const url=httpsImage(value);if(!url)return null;const u=new URL(url);
 u.pathname=u.pathname.replace(/\.(jpe?g|png)\.webp$/i,'.$1').replace(/-(?:\d{2,5}x\d{2,5}|\d{2,5}w)(?=\.[a-z]+$)/i,'');
 for(const key of ['w','h','width','height','quality','q','fit','auto','format'])u.searchParams.delete(key);
 return u.href;
}
export function interfaceArtwork(value){
 const url=machineImage(value);if(!url)return true;
 let leaf=new URL(url).pathname||'';
 try{leaf=decodeURIComponent(leaf);}catch{} leaf=leaf.toLowerCase();
 return /(?:^|[/\s_.-])(?:logos?|advert(?:isement)?|anzeige|flyer|poster|icon|avatar|sprite|pixel|tracking|favicon|badge|food[-_]rating|app[-_]?store|google[-_]?play|payment|placeholder)(?:[/\s_.-]|$)/i.test(leaf)||/^(?:apple|google|top|bottom|blue(?:[-_]left)?)(?:[-_]\d+w)?\.(?:png|svg|webp)$/i.test(leaf.split('/').pop());
}
export function profileMedia(entity,profile){
 const raw=entity?.profile||{},derived=raw._enrich||{},own=key=>Object.hasOwn(raw,key);
 const owner=entity?.owner_content||{},ownerProfile=owner.profile||{},ownerHero=Object.hasOwn(owner,'photo_url'),ownerPhotos=Object.hasOwn(ownerProfile,'photos');
 const explicitHero=ownerHero?owner.photo_url:entity.hero_url||entity.photo_url||entity.photo|| (own('hero_url')?raw.hero_url:own('photo_url')?raw.photo_url:null);
 const ownGallery=ownerPhotos||own('photo_urls')||own('photos');
 const source=ownerPhotos?ownerProfile.photos:own('photo_urls')?raw.photo_urls:own('photos')?raw.photos:profile.photo_urls||profile.photos||[];
 const gallery=[],seen=new Set();
 for(const item of Array.isArray(source)?source:[]){const url=httpsImage(typeof item==='string'?item:item?.url);if(!url||(!ownGallery&&interfaceArtwork(url)))continue;const key=imageIdentity(url);if(seen.has(key))continue;seen.add(key);gallery.push(url);if(gallery.length===12)break;}
 const roles=Array.isArray(derived.photo_roles)?derived.photo_roles:[];
 const galleryOnly=new Set(roles.filter(x=>x&&x.role==='gallery_only'&&httpsImage(x.url)).map(x=>httpsImage(x.url)));
 // Source roles bind exact URLs; they never override an explicit owner selection.
 const heroGallery=ownGallery?gallery:gallery.filter(url=>!galleryOnly.has(url));
 const mayFallback=!ownerHero&&!own('hero_url')&&!own('photo_url');
 const candidates=[profile.hero_url,profile.photo_url,...heroGallery].filter(v=>httpsImage(v)&&!interfaceArtwork(v)&&(ownGallery||!galleryOnly.has(v)));
 const trustedHero=ownerHero||own('hero_url')||own('photo_url');
 const hero=(trustedHero||(!interfaceArtwork(explicitHero)&&!galleryOnly.has(explicitHero))?httpsImage(explicitHero):null)||(mayFallback?candidates[0]||null:null);
 const logo=(own('logo_url')?httpsImage(raw.logo_url):machineImage(entity.logo_url||profile.logo_url))||(!own('logo_url')&&derived.hero_url&&/logo/i.test(derived.hero_url)?httpsImage(derived.hero_url):null);
 return{hero,logo,gallery,heroGallery};
}

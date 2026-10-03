/** One source-bound Zoi identity. Only populate after the actual supplied artwork
 * is identified. Client-owned logos are never replaced by this module. */
export const SITE_IDENTITY=Object.freeze({approved:true,source:'/assets/brand/zoi-logo.png',sha256:'08db50bee5caf18a878cb8468ced301d74c92bffd7b308678fb95e4f75514ff1',kind:'emblem',favicon:'/assets/brand/favicon-32.png?v=blue-olive',appleTouchIcon:'/assets/icons/apple-touch-icon.png?v=blue-olive'});
const localAsset=value=>typeof value==='string'&&/^\/assets\/[a-z0-9/_-]+\.(?:svg|png|webp|ico)(?:\?v=[a-z0-9_-]+)?$/i.test(value)?value:null;
export function identityAssets(config=SITE_IDENTITY){
 if(config.approved!==true||!/^[a-f0-9]{64}$/.test(config.sha256||''))return null;
 const source=localAsset(config.source);if(!source)return null;
 return{source,sha256:config.sha256,kind:config.kind==='emblem'?'emblem':'wordmark',favicon:localAsset(config.favicon),appleTouchIcon:localAsset(config.appleTouchIcon)};
}
export function identityHead(config=SITE_IDENTITY){const a=identityAssets(config);return a?[a.favicon?`<link rel="icon" href="${a.favicon}">`:'',a.appleTouchIcon?`<link rel="apple-touch-icon" href="${a.appleTouchIcon}">`:''].join(''):'';}
export function isZoiHomeLink(link,origin){
 try{const u=new URL(link.getAttribute('href'),origin);if(u.origin!==new URL(origin).origin||u.pathname!=='/'||u.search||u.hash)return false;}catch{return false;}
 return /^zoi home$/i.test(link.getAttribute('aria-label')||'')||/^(?:[ΖZ]\s*)?zoi(?:\s*greek life,? everywhere\.?)?$/i.test((link.textContent||'').replace(/\s+/g,' ').trim());
}
/** Wait for real image bytes before hiding an existing fallback. A failed load
 * leaves the site navigable, and no business-name/image heuristics are used. */
export async function applySiteIdentity({document=globalThis.document,origin=globalThis.location?.origin,config=SITE_IDENTITY,load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;})}={}){
 const a=identityAssets(config);if(!a||!document?.head)return{applied:0,configured:false};
 try{await load(a.source);}catch{return{applied:0,configured:true,imageFailed:true};}
 let count=0;
 for(const link of document.querySelectorAll('a[href]')){
  if(!isZoiHomeLink(link,origin)||link.dataset.zoiIdentity===a.sha256)continue;
  const image=document.createElement('img');image.src=a.source;image.alt='Zoi';image.width=a.kind==='emblem'?40:160;image.height=48;
  image.style.cssText='display:block;object-fit:contain;max-width:160px;width:auto;height:48px;flex-shrink:0';
  link.replaceChildren(image);if(a.kind==='emblem'){const word=document.createElement('span');word.textContent='Zoi';word.style.cssText='font-size:19px;font-weight:800;letter-spacing:normal;line-height:1' ;link.appendChild(word);}
  link.style.display='inline-flex';link.style.flexDirection='row';link.style.alignItems='center';link.style.gap='10px';link.setAttribute('aria-label','Zoi home');link.dataset.zoiIdentity=a.sha256;count++;
 }
 for(const [rel,href] of [['icon',a.favicon],['apple-touch-icon',a.appleTouchIcon]])if(href){
  for(const old of document.querySelectorAll(`link[rel="${rel}"]`))old.remove();
  const node=document.createElement('link');node.rel=rel;node.href=href;document.head.appendChild(node);
 }
 return{applied:count,configured:true};
}
/** Server-render known Zoi home links so canonical pages do not flash an old mark.
 * Script payloads are left byte-for-byte intact; client logos never qualify. */
export function identityHtml(html,config=SITE_IDENTITY){
 const a=identityAssets(config);if(!a)return html;
 const content=`<img src="${a.source}" alt="Zoi" width="35" height="48" style="display:block;object-fit:contain;width:auto;height:48px;flex-shrink:0">${a.kind==='emblem'?'<span style="font-size:19px;font-weight:800;letter-spacing:normal;line-height:1">Zoi</span>':''}`;
 return String(html).split(/(<script\b[^>]*>[\s\S]*?<\/script\s*>)/gi).map((part,i)=>i%2?part:part.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,(whole,attrs,body)=>{
  const href=attrs.match(/\bhref=["']([^"']*)["']/i)?.[1],label=attrs.match(/\baria-label=["']([^"']*)["']/i)?.[1]||'';
  const text=body.replace(/<[^>]*>/g,'').replace(/&#918;|&Zeta;/g,'Ζ');
  if(!isZoiHomeLink({textContent:text,getAttribute:k=>k==='href'?href:label},'https://www.zoi.city'))return whole;
  const clean=attrs.replace(/\s(?:aria-label|data-zoi-identity|style)=["'][^"']*["']/gi,'');
  return `<a${clean} aria-label="Zoi home" data-zoi-identity="${a.sha256}" style="display:inline-flex;flex-direction:row;align-items:center;gap:10px">${content}</a>`;
 })).join('');
}

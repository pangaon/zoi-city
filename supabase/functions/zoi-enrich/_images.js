import { auxiliaryImage } from './_image-context.js';
import { imageDocumentElements, imageStyleEvidence } from './_image-document.js';
// Source evidence only: never generate missing pictures or infer a photographed subject.
const decode=s=>String(s||'').replace(/&amp;|&#38;|&#x26;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'");
export function sourceImage(raw,base){
 if(typeof raw!=='string'||!raw.trim()||raw.length>3000||/[\u0000-\u001f\\]/.test(raw))return null;
 try{const u=new URL(decode(raw).trim(),base);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.includes(':')||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname))return null;if(u.pathname==='/'&&!u.search)return null;if(/\.(?:mp4|m4v|webm|mov|mp3|wav|ogg|pdf)(?:$)/i.test(u.pathname)||/%22|%27/i.test(u.pathname))return null;u.hash='';return u.href;}catch{return null;}
}
// Commas inside image URLs (notably Wix transforms) are not candidate separators.
// A descriptor is separated from its URL by whitespace; descriptorless URLs
// use trailing commas. Invalid/mixed descriptors are excluded, never guessed.
export function sourceSetCandidates(value){
 const text=decode(value),out=[];let pos=0;
 while(pos<text.length){
  while(/[\s,]/.test(text[pos]||'')&&pos<text.length)pos++;
  const start=pos;while(pos<text.length&&!/\s/.test(text[pos]))pos++;
  let url=text.slice(start,pos);if(!url)break;
  if(/,$/.test(url)){url=url.replace(/,+$/,'');if(url)out.push({url,size:1,unit:'x'});continue;}
  while(pos<text.length&&/\s/.test(text[pos]))pos++;
  const ds=pos;while(pos<text.length&&text[pos]!==',')pos++;
  const descriptor=text.slice(ds,pos).trim();if(pos<text.length)pos++;
  if(!descriptor){out.push({url,size:1,unit:'x'});continue;}
  const match=descriptor.match(/^(\d+(?:\.\d+)?)(w|x)$/);
  if(match&&Number(match[1])>0&&(match[2]!=='w'||Number.isInteger(Number(match[1]))))out.push({url,size:Number(match[1]),unit:match[2]});
 }
 if(new Set(out.map(x=>x.unit)).size>1)return[];
 return out.sort((a,b)=>b.size-a.size);
}
export function imageIdentity(raw){const u=new URL(raw);u.pathname=u.pathname.replace(/\.(jpe?g|png)\.webp$/i,'.$1').replace(/-(?:\d{2,5}x\d{2,5}|\d{2,5}w)(?=\.[a-z]+$)/i,'');for(const k of ['w','h','width','height','q','quality','fit','format','auto'])u.searchParams.delete(k);return u.href;}
const attr=(tag,name)=>{const m=tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));return decode(m?.[1]??m?.[2]??m?.[3]??'');};
const artwork=/(?:^|[\s/_.-])(?:logos?|icon|avatar|sprite|pixel|tracking|favicon|badge|food[-_ ]?rating|advert(?:isement)?|anzeige|flyer|poster|app[-_ ]?store|google[-_ ]?play|payment|placeholder|spinner|loader)(?:[\s/_.-]|$)/i;
const leaf=u=>{try{return decodeURIComponent(new URL(u).pathname).split('/').pop()||'';}catch{return u;}};
export function extractSiteImages(doc,base,business={}){
 const candidates=[],logos=[],menuImages=[],seen=new Map();const elements=imageDocumentElements(doc),active=elements.filter(e=>!e.excluded),read=(e,k)=>decode(e.attrs[k]||'');
 if(elements.valid!==true||elements.some(e=>e.styleEvidence?.valid===false))return{logo:null,photos:[],hero:null,menuImages:[]};
 // Both accepted and excluded occurrences use the same complete declaration
 // inventory. Hidden responsive/lazy/CSS URLs cannot return through metadata.
 let inventoryInvalid=false;
 const declaredURLs=e=>{
  const a=e.attrs,values=['src','data-src','data-lazy-src','data-original','data-lazyload','data-vc-parallax-image'].flatMap(key=>{const raw=a[key]||'';return [raw,...sourceSetCandidates(raw).map(x=>x.url)];});
  for(const key of ['srcset','data-srcset'])values.push(...sourceSetCandidates(a[key]||'').map(x=>x.url));
  values.push(...(e.styleEvidence?.urls||imageStyleEvidence(a.style).urls));
  if(e.tag==='meta')values.push(a.content||'');
  // The legacy extractor supplies a chosen JSON-LD node. Its images must not
  // escape an excluded source script even when the caller already parsed it.
  if(e.tag==='script'&&a.type==='application/ld+json'&&e.body){try{const queue=[JSON.parse(e.body)];let count=0;while(queue.length&&count++<1000){if(queue.length>1000||values.length>2000)throw Error();const node=queue.shift();if(Array.isArray(node)){if(node.length>1000)throw Error();queue.push(...node);continue;}if(!node||typeof node!=='object')continue;for(const [key,value]of Object.entries(node)){if(['image','logo','contentUrl','url'].includes(key)){const pending=[value];while(pending.length){if(pending.length>1000||values.length>2000)throw Error();const v=pending.pop();if(typeof v==='string')values.push(v);else if(Array.isArray(v))pending.push(...v);else if(v&&typeof v==='object')pending.push(v.contentUrl,v.url);}}if(value&&typeof value==='object')queue.push(value);}}if(queue.length)throw Error();}catch{inventoryInvalid=true;}}
  return values.map(raw=>sourceImage(raw,base)).filter(Boolean);
 };
 const excludedURLs=new Set(elements.filter(e=>e.excluded).flatMap(declaredURLs).map(imageIdentity));
 if(inventoryInvalid)return{logo:null,photos:[],hero:null,menuImages:[]};
 const add=(raw,kind,source,score=10,hint='')=>{const url=sourceImage(raw,base);if(!url||excludedURLs.has(imageIdentity(url))||auxiliaryImage(url,hint))return;const name=leaf(url);if(/(?:pexels|unsplash|shutterstock|istockphoto|depositphotos)/i.test(url))return;let context=new URL(url).pathname;try{context=decodeURIComponent(context);}catch{}context+=' '+hint;if(/(?:^|[\s/_.-])(?:quotation[-_ ]?mark|quote[-_ ]?icon|pattern|texture|divider)(?:[\s/_.-]|$)/i.test(context))return;if(/(?:^|[\s/_.-])(?:menu|speisekarte|μενού)(?:[\s/_.-]|$)/i.test(name+' '+hint)){if(!menuImages.some(x=>x.url===url))menuImages.push({url,source});return;}const logo=/(?:^|[\s/_.+-])(?:web[-_]?logos?|logos?)(?:[\s/_.+-]|$)/i.test(context),ui=artwork.test(context)||/^(?:apple|google|top|bottom|blue(?:[-_]left)?)(?:[-_]\d+w)?\.(?:png|svg|webp)$/i.test(name);if(kind==='logo'||logo){logos.push({url,source,score});return;}if(ui||/\.svg(?:\?|$)/i.test(url))return;const key=imageIdentity(url),prior=seen.get(key);if(prior){if(score>prior.score){prior.url=url;prior.source=source;prior.score=score;}return;}const record={url,source,score};seen.set(key,record);candidates.push(record);};
 const values=v=>Array.isArray(v)?v.flatMap(values):typeof v==='string'?[v]:v&&typeof v==='object'?values(v.contentUrl||v.url||[]):[];
 for(const u of values(business.logo))add(u,'logo','jsonld-logo',100);
 for(const u of values(business.image))add(u,'photo','jsonld-image',70);
 for(const e of active.filter(e=>e.tag==='meta')){const key=(read(e,'property')||read(e,'name')).toLowerCase(),url=read(e,'content');if(['og:logo','logo'].includes(key))add(url,'logo','meta-logo',70);if(['og:image','og:image:url','twitter:image'].includes(key))add(url,'photo','meta-image',60);}
 for(const e of active.filter(e=>['img','source'].includes(e.tag))){
  const hint=read(e,'alt')+' '+read(e,'class')+' '+read(e,'id'),width=Number(read(e,'width')),height=Number(read(e,'height'));if(!/logo/i.test(hint+' '+read(e,'src'))&&((width>0&&width<80)||(height>0&&height<60)))continue;
  const srcset=read(e,'data-srcset')||read(e,'srcset'),options=sourceSetCandidates(srcset);
  const fallback=read(e,'data-src')||read(e,'data-lazy-src')||read(e,'data-original')||(e.tag==='img'?read(e,'data-lazyload'):'')||read(e,'src');const selected=options[0]?.url||(/\s+\d+(?:\.\d+)?[wx](?:\s*,|\s*$)/.test(fallback)?sourceSetCandidates(fallback)[0]?.url:fallback);add(selected,'photo','page-image',40+Math.min(width,2000)/1000,hint);
 }
 // Explicit active-element background declaration, never source script text.
 for(const e of active){const value=read(e,'data-vc-parallax-image');if(value)add(value,'photo','page-background',30,read(e,'class')+' '+read(e,'id'));}
 // Inline/CSS background declarations only; do not crawl arbitrary URL functions/scripts.
 for(const e of active)for(const url of e.styleEvidence?.backgrounds||imageStyleEvidence(read(e,'style')).backgrounds)add(url,'photo','page-background',30);
 const logo=logos.sort((a,b)=>b.score-a.score)[0];const photos=candidates.filter(c=>!logo||imageIdentity(c.url)!==imageIdentity(logo.url)).sort((a,b)=>b.score-a.score).slice(0,12);
 return{logo:logo||null,photos,hero:photos[0]||null,menuImages:menuImages.slice(0,12)};
}
export function supplementaryPages(doc,base){
 const origin=new URL(base).origin,result=[];for(const match of String(doc).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').matchAll(/<a\b([^>]*)>([\s\S]{0,300}?)<\/a>/gi)){
  const href=attr(match[1],'href'),text=decode(match[2].replace(/<[^>]*>/g,' ')).trim();let url;try{url=new URL(href,base);}catch{continue;}
  if(url.origin!==origin||url.username||url.password||url.search||url.hash||url.href===base||/\.(?:pdf|jpe?g|png|webp|zip)$/i.test(url.pathname))continue;
  let pathname=url.pathname;try{pathname=decodeURIComponent(pathname);}catch{continue;}const context=text+' '+pathname;const purpose=/\b(?:menu|speisekarte|speisen|speisen-getraenke)\b|μενού|κατάλογος/i.test(context)?'menu':/\b(?:gallery|galerie|photos|bilder)\b|φωτογραφ|γκαλερί/i.test(context)?'gallery':/\b(?:contact|kontakt|contacto)\b|επικοινων/i.test(context)?'contact':null;
  if(purpose&&!result.some(x=>x.purpose===purpose))result.push({url:url.href,purpose});if(result.length===3)break;
 }return result.sort((a,b)=>(a.purpose==='menu'?-1:0)-(b.purpose==='menu'?-1:0)).slice(0,2);
}

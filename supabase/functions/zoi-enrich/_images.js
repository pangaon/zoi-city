import { auxiliaryImage } from './_image-context.js';
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
// Read plugin attributes as complete HTML attributes, not text embedded in another value.
const declaredAttr=(tag,name)=>{for(const m of tag.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)){if(m[1].toLowerCase()===name)return decode(m[2]??m[3]??m[4]??'');}return '';};
const artwork=/(?:^|[\s/_.-])(?:logos?|icon|avatar|sprite|pixel|tracking|favicon|badge|food[-_ ]?rating|advert(?:isement)?|anzeige|flyer|poster|app[-_ ]?store|google[-_ ]?play|payment|placeholder|spinner|loader)(?:[\s/_.-]|$)/i;
const leaf=u=>{try{return decodeURIComponent(new URL(u).pathname).split('/').pop()||'';}catch{return u;}};
export function extractSiteImages(doc,base,business={}){
 const candidates=[],logos=[],menuImages=[],seen=new Map();const clean=String(doc).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const add=(raw,kind,source,score=10,hint='')=>{const url=sourceImage(raw,base);if(!url||auxiliaryImage(url,hint))return;const name=leaf(url);if(/(?:pexels|unsplash|shutterstock|istockphoto|depositphotos)/i.test(url))return;let context=new URL(url).pathname;try{context=decodeURIComponent(context);}catch{}context+=' '+hint;if(/(?:^|[\s/_.-])(?:quotation[-_ ]?mark|quote[-_ ]?icon|pattern|texture|divider)(?:[\s/_.-]|$)/i.test(context))return;if(/(?:^|[\s/_.-])(?:menu|speisekarte|μενού)(?:[\s/_.-]|$)/i.test(name+' '+hint)){if(!menuImages.some(x=>x.url===url))menuImages.push({url,source});return;}const logo=/(?:^|[\s/_.+-])(?:web[-_]?logos?|logos?)(?:[\s/_.+-]|$)/i.test(context),ui=artwork.test(context)||/^(?:apple|google|top|bottom|blue(?:[-_]left)?)(?:[-_]\d+w)?\.(?:png|svg|webp)$/i.test(name);if(kind==='logo'||logo){logos.push({url,source,score});return;}if(ui||/\.svg(?:\?|$)/i.test(url))return;const key=imageIdentity(url),prior=seen.get(key);if(prior){if(score>prior.score){prior.url=url;prior.source=source;prior.score=score;}return;}const record={url,source,score};seen.set(key,record);candidates.push(record);};
 const values=v=>Array.isArray(v)?v.flatMap(values):typeof v==='string'?[v]:v&&typeof v==='object'?values(v.contentUrl||v.url||[]):[];
 for(const u of values(business.logo))add(u,'logo','jsonld-logo',100);
 for(const u of values(business.image))add(u,'photo','jsonld-image',70);
 for(const tag of clean.matchAll(/<meta\b[^>]*>/gi)){const key=(attr(tag[0],'property')||attr(tag[0],'name')).toLowerCase(),url=attr(tag[0],'content');if(['og:logo','logo'].includes(key))add(url,'logo','meta-logo',70);if(['og:image','og:image:url','twitter:image'].includes(key))add(url,'photo','meta-image',60);}
 for(const m of clean.matchAll(/<(img|source)\b[^>]*>/gi)){
  const tag=m[0],hint=attr(tag,'alt')+' '+attr(tag,'class')+' '+attr(tag,'id');const width=Number(attr(tag,'width')),height=Number(attr(tag,'height'));if(!/logo/i.test(hint+' '+attr(tag,'src'))&&((width>0&&width<80)||(height>0&&height<60)))continue;
  const srcset=attr(tag,'data-srcset')||attr(tag,'srcset');const options=sourceSetCandidates(srcset);
  const fallback=attr(tag,'data-src')||attr(tag,'data-lazy-src')||attr(tag,'data-original')||(m[1].toLowerCase()==='img'?declaredAttr(tag,'data-lazyload'):'')||attr(tag,'src');const selected=options[0]?.url||(/\s+\d+(?:\.\d+)?[wx](?:\s*,|\s*$)/.test(fallback)?sourceSetCandidates(fallback)[0]?.url:fallback);add(selected,'photo','page-image',40+Math.min(width,2000)/1000,hint);
 }
 // WPBakery explicitly declares this background URL; never infer an original from a thumbnail.
 for(const match of clean.matchAll(/<[a-z][a-z0-9:-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)){
  const tag=match[0],raw=declaredAttr(tag,'data-vc-parallax-image');if(raw)add(raw,'photo','page-background',30,attr(tag,'class')+' '+attr(tag,'id'));
 }
 // Inline/CSS background declarations only; do not crawl arbitrary URL functions/scripts.
 for(const match of decode(clean).matchAll(/background(?:-image)?\s*:[^;{}<>]{0,1800}?url\(\s*["']?([^\s"')]+)["']?\s*\)/gi))add(match[1],'photo','page-background',30);
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

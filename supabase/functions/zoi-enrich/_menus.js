// Structured source records only. No guessing products from image filenames,
// prose, prices without an item, review text or another website.
const list=v=>Array.isArray(v)?v:v?[v]:[];
const text=v=>typeof v==='string'||typeof v==='number'?String(v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
const typed=(v,t)=>list(v?.['@type']).some(x=>String(x).replace(/^https?:\/\/schema.org\//,'')===t);
export function extractStructuredMenu(html,sourceUrl){
 let source;try{source=new URL(sourceUrl);if(!/^https?:$/.test(source.protocol)||source.username||source.password)return null;}catch{return null;}
 if(typeof html!=='string'||html.length>2000000)return null;
 const nodes=[],queue=[];for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{queue.push(JSON.parse(m[1]));}catch{}}
 let scanned=0;while(queue.length&&scanned++<1000){const node=queue.shift();if(Array.isArray(node)){queue.push(...node.slice(0,200));continue;}if(!node||typeof node!=='object')continue;nodes.push(node);for(const k of ['@graph','mainEntity','hasMenu','menu','hasMenuSection','hasMenuItem'])if(node[k]&&typeof node[k]==='object')queue.push(node[k]);}
 const sections=[],seen=new Set();let count=0;
 const add=(section,items)=>{const parsed=[];for(const item of list(items)){if(count>=100||!item||typeof item!=='object'||!typed(item,'MenuItem'))continue;const name=text(item.name).slice(0,180);if(!name)continue;const signature=JSON.stringify([section,name,item.offers]);if(seen.has(signature))continue;seen.add(signature);const offers=list(item.offers).filter(o=>o&&typeof o==='object'),offer=offers.length===1?offers[0]:null,raw=offer?.price,price=(typeof raw==='number'&&Number.isFinite(raw)&&raw>=0||typeof raw==='string'&&/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim()))?String(raw).trim():'',currency=/^[A-Z]{3}$/.test(text(offer?.priceCurrency))?text(offer.priceCurrency):'';parsed.push({name,price:price+(price&&currency?' '+currency:''),note:text(item.description).slice(0,500)});count++;}if(parsed.length)sections.push({section:text(section).slice(0,160)||'Published menu',items:parsed});};
 for(const node of nodes){if(typed(node,'MenuSection'))add(node.name,node.hasMenuItem);else if(typed(node,'Menu'))add(node.name,node.hasMenuItem);}
 if(!sections.length)return null;return {menu:sections.slice(0,30),menu_source:source.href,menu_source_format:'schema.org'};
}

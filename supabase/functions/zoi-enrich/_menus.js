// Structured source records only. No guessing products from image filenames,
// prose, prices without an item, review text or another website.
const list=v=>Array.isArray(v)?v:v?[v]:[];
const text=v=>typeof v==='string'||typeof v==='number'?String(v).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
const typed=(v,t)=>list(v?.['@type']).some(x=>String(x).replace(/^https?:\/\/schema.org\//,'')===t);
// Compatible with the canonical owner menu: preserve source section names,
// retain at most300items/300per section/20sections, and reserve content space for
// other owner fields. A bound never creates replacement categories or prices.
export const MENU_SOURCE_LIMITS=Object.freeze({items:300,perSection:300,sections:20,bytes:120000});
function boundedMenu(sections,source,format,complete=true){
 const menu=[];let total=0,retained=0;const seen=new Set();
 for(const section of sections){const title=text(section.section)||'Published menu',items=[];
  for(const entry of section.items){const name=text(entry.name),price=text(entry.price),note=text(entry.note),signature=JSON.stringify([title,name,price,note]);if(!name||seen.has(signature))continue;seen.add(signature);total++;
   if(title.length>100||name.length>160||price.length>100||note.length>600||retained>=MENU_SOURCE_LIMITS.items||items.length>=MENU_SOURCE_LIMITS.perSection||menu.length>=MENU_SOURCE_LIMITS.sections)continue;
   const item={name,price,note},candidate=[...menu,{section:title,items:[...items,item]}];
   if(new TextEncoder().encode(JSON.stringify(candidate)).byteLength>MENU_SOURCE_LIMITS.bytes)continue;
   items.push(item);retained++;
  }if(items.length)menu.push({section:title,items});
 }
 if(!menu.length)return null;
 return{menu,menu_source:source,menu_source_format:format,...(complete?{menu_total_items:total,menu_truncated:total>retained}:{})};
}
export function extractStructuredMenu(html,sourceUrl){
 let source;try{source=new URL(sourceUrl);if(!/^https?:$/.test(source.protocol)||source.username||source.password)return null;}catch{return null;}
 if(typeof html!=='string'||html.length>2000000)return null;
 const nodes=[],queue=[];for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{queue.push(JSON.parse(m[1]));}catch{}}
 let scanned=0,complete=true;while(queue.length&&scanned++<1000){const node=queue.shift();if(Array.isArray(node)){if(node.length>200)complete=false;queue.push(...node.slice(0,200));continue;}if(!node||typeof node!=='object')continue;nodes.push(node);for(const k of ['@graph','mainEntity','hasMenu','menu','hasMenuSection','hasMenuItem'])if(node[k]&&typeof node[k]==='object')queue.push(node[k]);}
 const sections=[],seen=new Set();
 const add=(section,items)=>{const parsed=[];for(const item of list(items)){if(!item||typeof item!=='object'||!typed(item,'MenuItem'))continue;const name=text(item.name);if(!name)continue;const signature=JSON.stringify([section,name,item.offers,text(item.description)]);if(seen.has(signature))continue;seen.add(signature);const offers=list(item.offers).filter(o=>o&&typeof o==='object'),offer=offers.length===1?offers[0]:null,raw=offer?.price,price=(typeof raw==='number'&&Number.isFinite(raw)&&raw>=0||typeof raw==='string'&&/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim()))?String(raw).trim():'',currency=/^[A-Z]{3}$/.test(text(offer?.priceCurrency))?text(offer.priceCurrency):'';parsed.push({name,price:price+(price&&currency?' '+currency:''),note:text(item.description)});}if(parsed.length)sections.push({section:text(section)||'Published menu',items:parsed});};
 for(const node of nodes){if(typed(node,'MenuSection'))add(node.name,node.hasMenuItem);else if(typed(node,'Menu'))add(node.name,node.hasMenuItem);}
 if(!sections.length)return extractPublishedProductMenu(html,source.href)||extractSemanticFoodMenu(html,source.href);return boundedMenu(sections,source.href,'schema.org',complete&&queue.length===0);
}

// Some ordering sites publish paired name/price elements plus a matching product
// control. Require all three to agree; never infer an item from free text.
const entities=v=>String(v||'').replace(/&(?:amp|pound|euro|quot|apos|#39|nbsp);/gi,x=>({'&amp;':'&','&pound;':'£','&euro;':'€','&quot;':'"','&apos;':"'",'&#39;':"'",'&nbsp;':' '})[x.toLowerCase()]);
const attribute=(tag,key)=>{const m=tag.match(new RegExp('\\s'+key+'=["\']([^"\']*)["\']','i'));return entities(m?.[1]||'');};
function extractPublishedProductMenu(html,source){
 const clean=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const items=[],seen=new Set();
 const pattern=/<div\b[^>]*class=["'][^"']*\bmenuProductNameHolder\b[^"']*["'][^>]*>([^<]{1,500})<\/div>([\s\S]{0,700}?)<span\b([^>]*class=["'][^"']*\bmenuAddToBasket\b[^"']*["'][^>]*)>/gi;
 for(const m of clean.matchAll(pattern)){
  const name=text(entities(m[1])),tag=' '+m[3],id=attribute(tag,'data-id'),controlName=attribute(tag,'data-name'),base=attribute(tag,'data-price');
  const priceMatch=m[2].match(/<span\b[^>]*class=["'][^"']*\bmenuProductPriceHolder\b[^"']*["'][^>]*>([^<]{1,80})<\/span>/i),price=text(entities(priceMatch?.[1]||''));
  if(!name||name.length>180||name!==controlName||!/^\d+$/.test(id)||seen.has(id)||!/^\d+(?:\.\d{1,2})?$/.test(base)||! /^(?:£|€|\$)\s*\d+(?:\.\d{1,2})?$/.test(price)||Number(price.replace(/[^\d.]/g,''))!==Number(base))continue;
  seen.add(id);items.push({name,price,note:''});
 }
 return boundedMenu([{section:'Published menu',items}],source,'html-product-fields');
}

// Explicit publisher menu fields, not free prose or review/rating text. Parse a
// bounded balanced div tree so adjacent dishes and tray variants stay separate.
function extractSemanticFoodMenu(html,source){
 const clean=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const nodes=[],stack=[];let scanned=0;
 for(const match of clean.matchAll(/<\/?div\b[^>]*>/gi)){
  if(++scanned>20000||stack.length>60)return null;
  if(/^<\//.test(match[0])){const node=stack.pop();if(!node)return null;node.end=match.index;}
  else{const classes=attribute(' '+match[0],'class').split(/\s+/),node={classes,start:match.index+match[0].length,end:null,parent:stack.at(-1)||null,children:[]};if(node.parent)node.parent.children.push(node);nodes.push(node);stack.push(node);}
 }
 if(stack.length)return null;
 const sections=[],seen=new Set(),omitted=new Set(),itemsBySection=new Map();
 for(const node of nodes.filter(n=>n.classes.includes('food-item-holder'))){let parent=node.parent;while(parent&&!parent.classes.includes('food-menu-grid-item-content'))parent=parent.parent;if(parent){if(!itemsBySection.has(parent))itemsBySection.set(parent,[]);itemsBySection.get(parent).push(node);}}
 for(const section of nodes.filter(n=>n.classes.includes('food-menu-grid-item-content'))){
  const fragment=clean.slice(section.start,section.end),headings=[...fragment.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];if(headings.length!==1)continue;
  const title=text(entities(headings[0][1]))||'Published menu',items=[];
  for(const node of itemsBySection.get(section)||[]){
   const item=clean.slice(node.start,node.end),names=[...item.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];if(names.length!==1)continue;
   const name=text(entities(names[0][1]));if(!name)continue;
   const field=role=>{const fields=node.children.filter(n=>n.classes.includes(role));return fields.length===1?text(entities(clean.slice(fields[0].start,fields[0].end))):'';};
   const literals=node.children.filter(n=>n.classes.includes('food-price')).map(n=>text(entities(clean.slice(n.start,n.end)))),description=field('food-item-description');
   let price='',note=description;
   if(literals.length>1){
    // These are publisher-defined alternatives for one item. Retain every size
    // and price in source order, or omit the whole item with explicit coverage.
    const signature=JSON.stringify([title,name,literals,description]),joined=literals.join(' | ');
    if(description.length>600||!literals.every(v=>v.length<=600&&/^[£€$]\s*\d+(?:[.,]\d{1,2})?(?:\s*\/\s*[^|<>]+)?$/.test(v))){omitted.add(signature);continue;}
    if(joined.length<=100)price=joined;
    else{note=joined+(description?' — '+description:'');if(note.length>600){omitted.add(signature);continue;}}
   }else{const literal=literals[0]||'';price=literal&&/^[£€$]\s*\d/.test(literal)&&literal.length<=80?literal:'';}
   const signature=JSON.stringify([title,name,price,note]);if(seen.has(signature))continue;seen.add(signature);items.push({name,price,note});
  }
  if(items.length)sections.push({section:title,items});
 }
 const result=boundedMenu(sections,source,'html-semantic-food-fields');
 if(omitted.size){
  if(!result)throw new Error('source_menu_price_variants_unresolved');
  result.menu_total_items+=omitted.size;result.menu_truncated=true;
 }
 return result;
}

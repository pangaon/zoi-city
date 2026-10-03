import {esc,SECTIONS} from './editor-model.mjs';
// The fragments are compiled only from reviewed repository templates. Authored
// copy is escaped; a design cannot supply HTML, CSS, scripts or fragment IDs.
export function renderCompiledHome(layout,design){
 const order=[...new Set([...(design.section_order||[]).filter(x=>SECTIONS.includes(x)),...layout.parts.map(p=>p.section)])],hidden=new Set(design.hidden_sections||[]),copy=design.copy||{};
 const hiddenIds=[];
 let content=order.flatMap(section=>layout.parts.filter(p=>p.section===section).map(part=>{
  let html=part.html;
  if(section==='intro'){
   if(copy.headline)html=html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i,(_,a,b)=>a+esc(copy.headline)+b);
   if(copy.intro)html=html.replace(/(<p\b[^>]*class="(?:lead|hero-copy|intro|hero-description)"[^>]*>)[\s\S]*?(<\/p>)/i,(_,a,b)=>a+esc(copy.intro)+b);
  }else{const title=copy[section+'_title'];if(title)html=html.replace(/(<h2\b[^>]*>)[\s\S]*?(<\/h2>)/i,(_,a,b)=>a+esc(title)+b);}
  if(hidden.has(section)){
   for(const match of html.matchAll(/\bid="([^"]+)"/g))hiddenIds.push(match[1]);
   // Retain existing widget anchors for their event handlers. This is visual
   // visibility, never a mechanism for storing private or protected content.
   html=html.replace(/^(\s*<[a-z][\w-]*)/i,'$1 data-home-hidden="true"');
  }
  return html;
 })).join('');
 let html=layout.before+content+layout.after;
 for(const id of hiddenIds){const safe=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');html=html.replace(new RegExp('(<a\\b[^>]*href="#'+safe+'"[^>]*)(>)','g'),'$1 data-home-hidden="true"$2');}
 return html.replace('</head>','<style>[data-home-hidden="true"]{display:none!important}</style></head>');
}

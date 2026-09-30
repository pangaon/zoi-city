import {readFileSync,writeFileSync} from 'node:fs';
const templates={},layouts={};
function compile(html){
 const start=/<main\b[^>]*>/.exec(html),end=html.indexOf('</main>',start.index);if(!start||end<0)throw Error('Reviewed template main missing');
 const offset=start.index+start[0].length,body=html.slice(offset,end),parts=[],stack=[],voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);let begin=0;
 for(const m of body.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  const tag=m[1].toLowerCase(),closing=m[0].startsWith('</');
  if(!closing){if(!stack.length)begin=m.index;if(!voids.has(tag)&&!m[0].endsWith('/>'))stack.push(tag);}
  else{if(stack.pop()!==tag)throw Error('Unbalanced reviewed template '+tag);}
  if(!stack.length){const fragment=body.slice(begin,m.index+m[0].length),opening=/^<[a-z]+\b[^>]*>/i.exec(fragment)?.[0]||'',id=/\bid="([^"]+)"/.exec(opening)?.[1]||'',cls=/\bclass="([^"]+)"/.exec(opening)?.[1]||'';let section='intro';
   if(/menu|table-section/.test(cls)||['table','menu','menus'].includes(id))section='offerings';
   else if(/story|courtyard|moments/.test(cls)||id==='discover')section='gallery';
   else if(/planner|plan section/.test(cls)||id==='plan')section='calendar';
   else if(/visit|closing|gather/.test(cls)||id==='visit')section='contact';
   parts.push({section,html:fragment});
  }
 }
 if(stack.length||!parts.length)throw Error('Incomplete reviewed template');
 return {before:html.slice(0,offset),parts,after:html.slice(end)};
}
for(const name of ['atelier','concierge','table','parea']){
 let html=readFileSync(`showcase/avli/${name}/index.html`,'utf8');
 html=html.replace(/(href|src)="\.\/([^"]+)"/g,(_,attr,path)=>`${attr}="/showcase/avli/${name}/${path}"`)
  .replace(/<link\b[^>]*rel="canonical"[^>]*>/g,'')
  .replace('</head>','<link rel="canonical" href="https://www.zoi.city/business/taverna-avli-bochum"></head>')
  .replaceAll(`https://www.zoi.city/showcase/avli/${name}/`,'https://www.zoi.city/business/taverna-avli-bochum');
 templates[name]=html;
 layouts[name]=compile(html);
}
writeFileSync('assets/homes/templates/restaurant/avli.mjs','// Generated from the four reviewed Avli templates by scripts/build-avli-home.mjs.\nimport {renderCompiledHome} from "../../compiled-layout.mjs";\nexport const AVLI_ID="fda14b06-88d1-4d5e-b7f5-bc87a9210ce9";\nexport const templates='+JSON.stringify(templates)+';\nconst layouts='+JSON.stringify(layouts)+';\nexport function renderAvliHome(entity,design="concierge"){if(entity?.id!==AVLI_ID)return null;const id=typeof design==="string"?design:design?.template;const template=Object.hasOwn(templates,id)?id:"concierge";return design&&typeof design==="object"?renderCompiledHome(layouts[template],design):templates[template];}\n');

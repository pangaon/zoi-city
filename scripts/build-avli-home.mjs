import {readFileSync,writeFileSync} from 'node:fs';
const templates={};
for(const name of ['atelier','concierge','table','parea']){
 let html=readFileSync(`showcase/avli/${name}/index.html`,'utf8');
 html=html.replace(/(href|src)="\.\/([^"]+)"/g,(_,attr,path)=>`${attr}="/showcase/avli/${name}/${path}"`)
  .replace(/<link\b[^>]*rel="canonical"[^>]*>/g,'')
  .replace('</head>','<link rel="canonical" href="https://www.zoi.city/business/taverna-avli-bochum"></head>')
  .replaceAll(`https://www.zoi.city/showcase/avli/${name}/`,'https://www.zoi.city/business/taverna-avli-bochum');
 templates[name]=html;
}
writeFileSync('assets/homes/templates/restaurant/avli.mjs','// Generated from the four reviewed Avli templates by scripts/build-avli-home.mjs.\nexport const AVLI_ID="fda14b06-88d1-4d5e-b7f5-bc87a9210ce9";\nexport const templates='+JSON.stringify(templates)+';\nexport function renderAvliHome(entity,template="concierge"){return entity?.id===AVLI_ID?templates[Object.hasOwn(templates,template)?template:"concierge"]:null;}\n');

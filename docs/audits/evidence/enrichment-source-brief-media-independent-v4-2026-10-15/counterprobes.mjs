import {writeFileSync} from 'node:fs';
import {chromium} from '/workspaces/zoi-city-release/node_modules/playwright-core/index.mjs';
import {extractSiteImages} from '../../../../supabase/functions/zoi-enrich/_images.js';
import {sourceClientIdentity,prepareClientBrief} from '../../../../supabase/functions/zoi-enrich/_brief.js';
const origin='https://source.example.org/',image=origin+'hidden.jpg';
const cases=[
 ['css-comment','<div style="display:/**/none"><img src="'+image+'"></div>'],
 ['closed-dialog','<dialog><img src="'+image+'"></dialog>'],
 ['closed-details','<details><summary>Details</summary><img src="'+image+'"></details>'],
 ['content-visibility','<div style="content-visibility:hidden"><img src="'+image+'"></div>'],
 ['hidden-srcset-og','<div hidden><img srcset="'+image+' 2x"></div><meta property="og:image" content="'+image+'">'],
 ['hidden-background-og','<div hidden style="background-image:url('+image+')"></div><meta property="og:image" content="'+image+'">'],
 ['hidden-lazyload-og','<div hidden><img data-lazyload="'+image+'"></div><meta property="og:image" content="'+image+'">'],
];
const browser=await chromium.launch({headless:true,executablePath:'/home/codespace/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
const ctx=await browser.newContext({serviceWorkers:'block'});await ctx.route('**/*',r=>r.abort());const page=await ctx.newPage();const output=[];
try{for(const [key,html] of cases){await page.setContent(html);const visibility=await page.locator('img').evaluateAll(es=>es.map(e=>({src:e.getAttribute('src'),srcset:e.getAttribute('srcset'),visible:e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e.parentElement).display})));output.push({key,html,visibility,photos:extractSiteImages(html,origin).photos});}}finally{await browser.close();}
const row={name:'Exact Event',entity_type:'event',website:origin};const json=(url)=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Festival',name:row.name,url})+'</script>';
output.push({key:'event-different-query',identity:sourceClientIdentity(row,json(origin+'?past=1'),origin)});
output.push({key:'malformed-with-business',photos:extractSiteImages('<div title="unclosed',origin,{image}).photos});
writeFileSync(new URL('./counterprobes-result.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));

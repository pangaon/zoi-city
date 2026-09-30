/** Canonical church home adapter. Unsupported/incomplete parishes return null.
 * No fixture content is ever transplanted onto another church identity.
 */
import {PARISH,MINISTRIES,DESIGNS,PARISH_DETAILS} from '../assets/homes/templates/church/data.mjs';
import {renderChurch} from '../assets/homes/templates/church/render.mjs';
import {esc,httpsUrl,parishContent} from '../assets/homes/templates/church/model.mjs';
const SITE='https://www.zoi.city';
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function sourceMatches(value){try{const u=new URL(value);return u.protocol==='https:'&&['saintsophiadc.org','www.saintsophiadc.org'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
export function churchHomeContent(entity){
 if(!entity||entity.id!==PARISH.id||entity.entity_type!=='church'||!sourceMatches(entity.website)||entity.marketplace_status==='hidden'||entity.publish_status&&entity.publish_status!=='published')return null;
 const phone=String(entity.phone||PARISH.phone).replace(/[^\d+]/g,'');const normalizedPhone=phone.startsWith('+')?phone:phone.length===10?'+1'+phone:phone.length===11&&phone.startsWith('1')?'+'+phone:PARISH.phone;
 const content={...PARISH,ministries:MINISTRIES,details:PARISH_DETAILS,id:entity.id,slug:entity.canonical_slug||entity.slug||PARISH.slug,name:String(entity.name||PARISH.fullName).replace(/ Greek Orthodox Cathedral$/i,''),fullName:String(entity.name||PARISH.fullName),city:String(entity.city||PARISH.city),address:String(entity.address||PARISH.address),phone:normalizedPhone,phoneDisplay:String(entity.phone||PARISH.phoneDisplay),site:httpsUrl(entity.website)||PARISH.site};
 return parishContent(content);
}
export function renderChurchHome(entity,publishedDesign=null,options={}){
 const content=churchHomeContent(entity);if(!content)return null;
 const design=publishedDesign&&typeof publishedDesign==='object'&&!Array.isArray(publishedDesign)?publishedDesign:{};
 const template=Object.hasOwn(DESIGNS,design.template)?design.template:'concierge';
 const canonical=SITE+'/church/'+encodeURIComponent(entity.canonical_slug||entity.slug||PARISH.slug);
 const title=content.fullName+' in '+content.city+' · Zoi';
 const description='Explore '+content.fullName+': worship calendars, ministries, parish contacts and a personal visit plan. Official parish registration and giving links.';
 const schema={'@context':'https://schema.org','@type':'Church',name:content.fullName,url:canonical,address:content.address,telephone:content.phone,sameAs:[content.site],image:content.photos.map(p=>p.url)};
 const payload={parish:content,template,design:{...design,template}};
 const html=renderChurch(content,template,payload.design,{preview:false});
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:image" content="'+esc(content.photos[0].url)+'"><link rel="stylesheet" href="/assets/homes/templates/church/church.css?v=20260930"><script src="/assets/zoi-core.js?v=20260930" defer></script><script type="application/ld+json">'+json(schema)+'</script></head><body data-template="'+template+'"><div id="church-home">'+html+'</div><script type="application/json" id="church-home-content">'+json(payload)+'</script><script type="module" src="/assets/homes/templates/church/canonical.mjs?v=20260930"></script></body></html>';
}
export default renderChurchHome;

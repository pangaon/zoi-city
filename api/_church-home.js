import {resolveSocialLinks} from '../assets/homes/social-links.mjs';
import{completeHomeMetadata}from'./_home-metadata.js';
import{orthodoxSeason}from'../assets/faith/seasonal.mjs';
import{orthodoxPascha,iso}from'./_orthocal.js';
import{reviewedParish}from'../assets/homes/templates/church/sources.mjs';
import{profileOf}from'./_verticals.js';
import{profileMedia}from'./_profile-media.js';
/** Canonical church home adapter. All eligible church records share the four layouts.
 * No fixture content is ever transplanted onto another church identity.
 */
import {PARISH,MINISTRIES,DESIGNS,PARISH_DETAILS} from '../assets/homes/templates/church/data.mjs';
import {renderChurch} from '../assets/homes/templates/church/render.mjs';
import {esc,httpsUrl,parishContent} from '../assets/homes/templates/church/model.mjs';
const SITE='https://www.zoi.city';
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function sourceMatches(value){try{const u=new URL(value);return u.protocol==='https:'&&['saintsophiadc.org','www.saintsophiadc.org'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
export function churchHomeContent(entity){
 if(!entity||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entity.id||'')||entity.entity_type!=='church'||entity.marketplace_status==='hidden'||entity.publish_status&&entity.publish_status!=='published'||entity.moderation_status&&!['clean','cleared'].includes(entity.moderation_status))return null;
 return genericChurch(parishScopedEntity(entity));
}
export function renderChurchHome(entity,publishedDesign=null,options={}){
 const content=churchHomeContent(entity);if(!content)return null;
 const design=publishedDesign&&typeof publishedDesign==='object'&&!Array.isArray(publishedDesign)?publishedDesign:{};
 const template=Object.hasOwn(DESIGNS,design.template)?design.template:'concierge';
 const canonical=SITE+'/church/'+encodeURIComponent(entity.canonical_slug||entity.slug||PARISH.slug);
 const title=content.fullName+' in '+content.city+' · Zoi';
 const description='Explore '+content.fullName+': worship calendars, ministries, parish contacts and a personal visit plan. Official parish registration and giving links.';
 const schema={'@context':'https://schema.org','@type':'Church',name:content.fullName,url:canonical,address:content.address,telephone:content.phone,sameAs:[content.site].filter(Boolean),image:content.photos.map(p=>p.url)};
 let today;try{today=new Intl.DateTimeFormat('en-CA',{timeZone:content.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch{today=new Date().toISOString().slice(0,10);}content.season=orthodoxSeason(today,iso(orthodoxPascha(Number(today.slice(0,4)))));
 const payload={parish:content,template,design:{...design,template}};
 const html=renderChurch(content,template,payload.design,{preview:false});
 return completeHomeMetadata('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:image" content="'+esc(content.photos.find(p=>p.role!=='gallery_only')?.url||'')+'"><link rel="stylesheet" href="/assets/homes/templates/church/church.css?v=20260930-aegean"><script src="/assets/zoi-core.js?v=20260930" defer></script><script type="application/ld+json">'+json(schema)+'</script></head><body data-template="'+template+'"><div id="church-home">'+html+'</div><script type="application/json" id="church-home-content">'+json(payload)+'</script><script type="module" src="/assets/homes/templates/church/canonical.mjs?v=20260930-scope"></script></body></html>',{name:content.fullName,title,canonical,description:content.description,image:content.photos.find(p=>p.role!=='gallery_only')?.url,type:'Church',address:content.address,phone:content.phone,email:content.email,location:content.city});
}
export default renderChurchHome;

// Quarantine a recorded institutional source mismatch while retaining owner edits.
export function parishScopedEntity(entity){
 const raw=entity.profile&&typeof entity.profile==='object'?entity.profile:{},enrich=raw._enrich||{};
 if(enrich.scope_review_required!==true&&enrich.source_scope!=='source_scope_mismatch'&&enrich.last_error!=='source_scope_mismatch'&&enrich.blocked_reason!=='source_scope_mismatch')return entity;
 const owner=entity.owner_content&&typeof entity.owner_content==='object'?entity.owner_content:{};
 const profile={...raw,...(owner.profile||{})};delete profile._enrich;
 const clean={...entity,profile};
 // These projected values may come from the same import. An explicit owner
 // override, including null, is authoritative; parish name/address stay intact.
 for(const key of ['website','description','phone','email','photo_url','hero_url','photo','logo_url'])clean[key]=Object.hasOwn(owner,key)?owner[key]:null;
 return clean;
}

function genericChurch(e){const p=profileOf(e),owned=e.profile||{},source=reviewedParish(e)||(e.id===PARISH.id&&sourceMatches(e.website)?{...PARISH,ministries:MINISTRIES,details:PARISH_DETAILS}:null),media=profileMedia(e,p),field=(key,fallback='')=>{const aliases={giving:['giving','stewardship_url','give_url'],calendar:['calendar','schedule_url'],communityCalendar:['communityCalendar','community_calendar_url'],stream:['stream','stream_url']}[key]||[key];const own=aliases.find(k=>Object.hasOwn(owned,k));const v=own?owned[own]:p[key]||source?.[key]||fallback;return v&&typeof v==='object'&&Object.hasOwn(v,'url')?v.url:v;};let photos=(media.gallery||[]).map(x=>({url:x,alt:String(e.name)+' · published photograph',role:media.hero===x||media.heroGallery.includes(x)?'photo':'gallery_only'}));if(media.hero&&!photos.some(x=>x.url===media.hero))photos.unshift({url:media.hero,alt:String(e.name)+' · published photograph'});if(!['photos','photo_url','photo_urls','gallery','hero','hero_image'].some(k=>Object.hasOwn(owned,k))&&source)photos=source.photos;const ministries=Object.hasOwn(owned,'ministries')?owned.ministries:source?.ministries||p.ministries||[];const rows=(Array.isArray(ministries)?ministries:[]).map((m,i)=>typeof m==='string'?{id:'ministry-'+i,title:m,description:'Contact the parish for current details.',group:'community',icon:'◇',path:''}:{id:String(m.id||'ministry-'+i),title:String(m.title||m.name||''),description:String(m.description||''),group:['faith','family','service','community'].includes(m.group)?m.group:'community',icon:'◇',path:String(m.path||'')}).filter(m=>m.title);const details=source&&!Object.hasOwn(owned,'ministries')?source.details:{checked:p._checked||'',schedule:[],ministries:Object.fromEntries(rows.map(m=>[m.id,{summary:m.description,facts:[],source:httpsUrl(m.path)||httpsUrl(e.website)}]))};const phone=String(field('phone',e.phone||'')).replace(/[^+\d]/g,'');return parishContent({generic:true,id:e.id,slug:e.canonical_slug||e.slug,name:source?.name||String(e.name||'Parish'),fullName:String(e.name||'Parish'),description:String(field('description',e.description||'')),city:String(e.city||''),country:String(e.country||''),address:String(e.address||''),site:httpsUrl(e.website),calendar:httpsUrl(field('calendar',p.schedule_url||'')),communityCalendar:httpsUrl(field('communityCalendar',p.community_calendar_url||'')),giving:httpsUrl(field('giving',p.stewardship_url||p.give_url||'')),stream:httpsUrl(field('stream')),contact:httpsUrl(field('contact',e.website)),phone,phoneDisplay:phone,email:String(field('email',e.email||'')),timezone:String(field('timezone')),photos,ministries:rows,details,socials:Object.entries(resolveSocialLinks(e,p,Object.fromEntries((source?.socials||[]).map(x=>[x.name||x.label||x.id,x.url])))).map(([name,url])=>({name,url:httpsUrl(url)})).filter(x=>x.url)});}

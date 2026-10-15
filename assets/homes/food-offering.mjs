import {briefBlocked} from '../enrichment/client-brief.mjs';
import {officialSourceQuarantined,officialSourceEntity,selectedOfficialWebsite} from '../enrichment/official-source-policy.mjs';
// Shared food presentation only. Canonical menus and owner revisions remain the
// source of truth; this module creates no order, reservation or stored offering.
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const documentKey=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.protocol+'//'+u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search:null;}catch{return null;}};
const flagged=v=>v===true||v==='true';
export function foodSourceHeld(entity){
 const raw=entity?.profile?._enrich,q=object(raw),registered=documentKey(selectedOfficialWebsite(entity)),source=typeof q.source_url==='string'?documentKey(q.source_url):null;
 return !!(!registered||!source||source!==registered||briefBlocked(q)||officialSourceQuarantined(entity)||q.crawl_status==='error'||(typeof q.identity_scope==='string'?q.identity_scope.trim():q.identity_scope)||q.source_affiliation||q.member||q.association_member||['source_scope_mismatch','source_challenge','challenge'].some(k=>flagged(q[k]))||['association_directory','association_member','supporting_publisher_profile'].includes(q.source_kind));
}
export function foodReadEntity(entity){entity=officialSourceEntity(entity);if(!foodSourceHeld(entity))return entity;const q=object(entity?.profile?._enrich),keep=['source_url','checked_at','blocked','blocked_reason','status','crawl_status','scope_review_required','organization_identity_quarantine','identity_scope','source_kind','source_affiliation','source_scope_mismatch','source_challenge','challenge','association_member','member'];return {...entity,profile:{...object(entity.profile),_enrich:Object.fromEntries(keep.filter(k=>Object.hasOwn(q,k)).map(k=>[k,k==='member'?true:q[k]]))}};}
export function foodMedia(entity,media={}){
 const layers=[object(entity?.owner_content),object(entity?.owner_content?.profile),object(entity?.profile)];
 const logoExplicit=layers.some(p=>Object.hasOwn(p,'logo_url')||Object.hasOwn(p,'logo')||Object.hasOwn(object(p.brand),'logo'));
 const heroExplicit=layers.some(p=>Object.hasOwn(p,'photo_url')||Object.hasOwn(p,'hero_url'));
 const knownLogo=!heroExplicit&&media.heroKind==='brand_logo'&&media.hero;
 return{...media,hero:knownLogo?null:media.hero,logo:media.logo||(!logoExplicit&&knownLogo?media.hero:null),gallery:(media.gallery||[]).filter(url=>url!==knownLogo),heroFit:media.heroKind==='photograph'?'cover':'contain',heroKind:media.heroKind||'unknown_media'};
}
export function foodReservation(url,website){
 if(!url)return null;try{const a=new URL(url),b=new URL(website);return a.origin===b.origin?{url,label:'Request a table on the restaurant website',note:'The restaurant confirms your request.'}:{url,label:'Continue to reservation provider',note:'Check arrangements with the linked provider.'};}catch{return{url,label:'Open reservation information',note:'Confirm arrangements directly with the restaurant.'};}
}
export function foodMenuQuestion(name,item){return `Hello ${String(name||'').trim()}, I would like to ask about ${String(item?.name||'').trim()}. Could you confirm current availability, price, ingredients and any collection or dining arrangements?`;}
export function renderFoodMenu(sections=[]){
 if(!sections.length)return '';
 const total=sections.reduce((n,s)=>n+s.items.length,0);
 return `<div data-food-menu><form class="food-menu-search" role="search"><label>Find a dish or product<input type="search" name="food-query" maxlength="100" placeholder="Search the published menu" autocomplete="off"></label><button type="reset" class="text-link">Clear search</button></form><p class="source-note" data-food-count role="status" aria-live="polite">${total} published ${total===1?'item':'items'}</p>${sections.map((s,si)=>`<section class="menu-group" data-food-section="${si}"><h3>${esc(s.title)}</h3>${s.items.map((item,ii)=>`<div class="menu-item" data-food-item="${si}:${ii}"><div><strong>${esc(item.name)}</strong>${item.note?`<p>${esc(item.note)}</p>`:''}<button class="text-link food-item-question" type="button" data-food-question="${si}:${ii}">Ask about this item →</button></div>${item.price?`<span>${esc(item.price)}</span>`:''}</div>`).join('')}</section>`).join('')}<p class="menu-empty" data-food-empty hidden>No matching items. Try another name, or contact the business about what you need.</p></div>`;
}
export function mountFoodMenu(root,{sections=[],onQuestion=()=>{}}={}){
 const menu=root.querySelector('[data-food-menu]');if(!menu)return()=>{};
 const form=menu.querySelector('form'),input=form.querySelector('input'),count=menu.querySelector('[data-food-count]'),empty=menu.querySelector('[data-food-empty]');
 function filter(){const query=norm(input.value);let matches=0;for(const section of menu.querySelectorAll('[data-food-section]')){let visible=0;for(const node of section.querySelectorAll('[data-food-item]')){const[si,ii]=node.dataset.foodItem.split(':').map(Number),item=sections[si]?.items[ii];const show=!!item&&norm([sections[si].title,item.name,item.note].join(' ')).includes(query);node.hidden=!show;if(show){matches++;visible++;}}section.hidden=!visible;}empty.hidden=matches>0;count.textContent=matches+' matching '+(matches===1?'item':'items');}
 const submit=e=>e.preventDefault(),reset=()=>{input.value='';filter();input.focus();},click=e=>{const b=e.target.closest('[data-food-question]');if(!b)return;const[si,ii]=b.dataset.foodQuestion.split(':').map(Number),item=sections[si]?.items[ii];if(item)onQuestion(item,b);};
 input.addEventListener('input',filter);form.addEventListener('submit',submit);form.addEventListener('reset',reset);menu.addEventListener('click',click);
 return()=>{input.removeEventListener('input',filter);form.removeEventListener('submit',submit);form.removeEventListener('reset',reset);menu.removeEventListener('click',click);};
}

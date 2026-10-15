import {briefBlocked,reviewedFoodReceiptCurrent,reviewedFoodErrorDeferred} from '../enrichment/client-brief.mjs';
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
 return !!(!registered||!source||source!==registered||briefBlocked(q)||officialSourceQuarantined(entity)||q.crawl_status==='error'&&!(reviewedFoodErrorDeferred(q)&&reviewedFoodReceiptCurrent(entity))||q.source_identity?.verification==='reviewed_official_visible_branch'&&!reviewedFoodReceiptCurrent(entity)||(typeof q.identity_scope==='string'?q.identity_scope.trim():q.identity_scope)||q.source_affiliation||q.member||q.association_member||['source_scope_mismatch','source_challenge','challenge'].some(k=>flagged(q[k]))||['association_directory','association_member','supporting_publisher_profile'].includes(q.source_kind));
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
const FOOD_PAGE_SIZE=12;
export function renderFoodMenu(sections=[]){
 if(!sections.length)return '';
 const total=sections.reduce((n,s)=>n+s.items.length,0);let position=0;
 return `<div data-food-menu><form class="food-menu-search" role="search" aria-label="Search published menu"><label>Find a dish or product<input type="search" name="food-query" maxlength="100" placeholder="Search all ${total} published items" autocomplete="off"></label>${sections.length>1?`<label class="food-section-select">Menu section<select name="food-section" aria-label="Menu section"><option value="">All sections (${total})</option>${sections.map((s,i)=>`<option value="${i}">${esc(s.title)} (${s.items.length})</option>`).join('')}</select></label>`:''}<button type="reset" class="text-link">Clear search</button></form><p class="source-note" data-food-count role="status" aria-live="polite" aria-atomic="true">${total>FOOD_PAGE_SIZE?'Showing '+FOOD_PAGE_SIZE+' of ':''}${total} published ${total===1?'item':'items'}</p>${sections.map((s,si)=>{const first=position;return `<section class="menu-group" data-food-section="${si}" ${first>=FOOD_PAGE_SIZE?'hidden':''}><h3>${esc(s.title)}<span class="food-section-count">${s.items.length} ${s.items.length===1?'item':'items'}</span></h3>${s.items.map((item,ii)=>`<div class="menu-item" data-food-item="${si}:${ii}" ${position++>=FOOD_PAGE_SIZE?'hidden':''}><div><strong>${esc(item.name)}</strong>${item.note?`<p>${esc(item.note)}</p>`:''}<button class="text-link food-item-question" type="button" data-food-question="${si}:${ii}" aria-label="Ask about this item: ${esc(item.name)}">Ask about this item →</button></div>${item.price?`<span>${esc(item.price)}</span>`:''}</div>`).join('')}</section>`;}).join('')}<p class="menu-empty" data-food-empty hidden>No matching items. Try another name, or contact the business about what you need.</p><div class="food-menu-actions" ${total<=FOOD_PAGE_SIZE?'hidden':''}><button class="button green" type="button" data-food-more>Show ${Math.min(FOOD_PAGE_SIZE,total-FOOD_PAGE_SIZE)} more items</button><button class="text-link" type="button" data-food-all>Show all ${total} items</button><button class="text-link" type="button" data-food-less hidden>Show fewer items</button></div><noscript><style>[data-food-menu] [data-food-item][hidden],[data-food-menu] [data-food-section][hidden]{display:block!important}[data-food-menu] .food-menu-actions,[data-food-menu] .food-menu-search,[data-food-menu] [data-food-count]{display:none!important}</style><p class="source-note">All ${total} published items are listed below their source section names.</p></noscript></div>`;
}
export function mountFoodMenu(root,{sections=[],onQuestion=()=>{}}={}){
 const menu=root.querySelector('[data-food-menu]');if(!menu)return()=>{};
 const form=menu.querySelector('form'),input=form.querySelector('input'),select=form.querySelector('select'),count=menu.querySelector('[data-food-count]'),empty=menu.querySelector('[data-food-empty]'),more=menu.querySelector('[data-food-more]'),all=menu.querySelector('[data-food-all]'),less=menu.querySelector('[data-food-less]'),actions=menu.querySelector('.food-menu-actions');let limit=FOOD_PAGE_SIZE;
 function filter(focusNew=false){const query=norm(input.value),sectionChoice=select?.value||'',matched=[];let firstNew=null;
  for(const section of menu.querySelectorAll('[data-food-section]')){let visible=0;for(const node of section.querySelectorAll('[data-food-item]')){const[si,ii]=node.dataset.foodItem.split(':').map(Number),item=sections[si]?.items[ii],match=!!item&&(!sectionChoice||sectionChoice===String(si))&&norm([sections[si].title,item.name,item.note].join(' ')).includes(query);if(match)matched.push(node);const show=match&&matched.length<=limit;if(show&&node.hidden&&!firstNew)firstNew=node;node.hidden=!show;if(show)visible++;}section.hidden=!visible;}
  const matches=matched.length,shown=Math.min(matches,limit);empty.hidden=matches>0;count.textContent=(shown<matches?'Showing '+shown+' of ':'')+matches+(query?' matching ':' published ')+(matches===1?'item':'items');actions.hidden=matches<=FOOD_PAGE_SIZE;more.hidden=shown>=matches;more.textContent='Show '+Math.min(FOOD_PAGE_SIZE,matches-shown)+' more items';all.hidden=shown>=matches;all.textContent='Show all '+matches+' items';less.hidden=limit<=FOOD_PAGE_SIZE;
  if(focusNew&&firstNew)firstNew.querySelector('button')?.focus();
 }
 const submit=e=>e.preventDefault(),change=()=>{limit=FOOD_PAGE_SIZE;filter();},reset=e=>{e.preventDefault();input.value='';limit=FOOD_PAGE_SIZE;filter();input.focus();},click=e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-food-more')){limit+=FOOD_PAGE_SIZE;filter(true);return;}if(b.hasAttribute('data-food-all')){limit=Infinity;filter(true);return;}if(b.hasAttribute('data-food-less')){limit=FOOD_PAGE_SIZE;filter();input.focus();return;}if(!b.hasAttribute('data-food-question'))return;const[si,ii]=b.dataset.foodQuestion.split(':').map(Number),item=sections[si]?.items[ii];if(item)onQuestion(item,b);};
 input.addEventListener('input',change);select?.addEventListener('change',change);form.addEventListener('submit',submit);form.addEventListener('reset',reset);menu.addEventListener('click',click);filter();
 return()=>{input.removeEventListener('input',change);select?.removeEventListener('change',change);form.removeEventListener('submit',submit);form.removeEventListener('reset',reset);menu.removeEventListener('click',click);};
}


/** Source-bound selection labels never relabel owner-authored menu links. */
export function reviewedFoodMenuLabel(entity,profile={}){
 const owner=object(entity?.owner_content),raw=object(entity?.profile),layers=[owner,object(owner.profile),raw];
 if(layers.some(layer=>['menu','menu_url'].some(key=>Object.hasOwn(layer,key))))return null;
 const q=object(raw._enrich),coverage=object(q.food_source_coverage),identity=object(q.source_identity),proof=object(q.provenance),hash=identity.review_sha256;
 if(foodSourceHeld(entity)||identity.verification!=='reviewed_official_visible_branch'||!/^[a-f0-9]{64}$/.test(hash||'')||proof.source_identity!=='reviewed_official_visible_branch#sha256='+hash||coverage.identity_review_sha256!==hash||coverage.menu_kind!=='lunch'||coverage.menu_label!=='Lunch menu'||coverage.entire_business_offering!==false||coverage.source_url!==profile.menu_source||profile.menu_url!==coverage.source_url||!Number.isInteger(coverage.retained_items)||coverage.retained_items<0)return null;
 const count=Array.isArray(profile.menu)?profile.menu.reduce((n,s)=>n+(Array.isArray(s.items)?s.items.length:0),0):0;if(count!==coverage.retained_items)return null;
 return{label:'Lunch menu'+(count?' · '+count+' '+(count===1?'item':'items'):''),source_label:'Lunch menu on the official website',count,entire_business_offering:false};
}

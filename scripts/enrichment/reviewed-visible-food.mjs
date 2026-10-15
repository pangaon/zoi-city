/** Offline, explicitly reviewed official branch evidence. No fetch, lease or writer.
 * Raw source bytes are input data; scripts, styles and hidden DOM are not evidence. */
import {readFileSync} from 'node:fs';
import {canonical,sha256} from '../quality/evidence.mjs';
import {sourceURL} from '../quality/source-fetch.mjs';
import {inspectSourceDocument} from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {assessMachineSourceIdentity} from '../../supabase/functions/zoi-enrich/_source-identity.js';
import {reviewedFoodErrorDeferred} from '../../assets/enrichment/client-brief.mjs';
import {sourceHTMLRecipeHash} from './source-html.mjs';
import {extractRenderedSource,extractorHash} from './extractor.mjs';
export const visibleFoodRecipeHash=sha256(canonical({strategy:'reviewed-visible-food-v1',implementation:readFileSync(new URL(import.meta.url),'utf8'),extractor:extractorHash,source_capture_recipe:sourceHTMLRecipeHash}));
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const text=v=>String(v||'').replace(/\s+/g,' ').trim();
const projectedContext=row=>({listing_id:row.listing_id||row.id,name:row.name,entity_type:row.entity_type,website:row.website,address:object(row.existing_enrich)._lease_source_context?.address,city:object(row.existing_enrich)._lease_source_context?.city,country:object(row.existing_enrich)._lease_source_context?.country});
const context=row=>({...projectedContext(row),category_slug:row.category_slug,primary_category_id:row.primary_category_id,owner_user_id:row.owner_user_id,owner_workspace_id:row.owner_workspace_id,claim_status:row.claim_status});
const fail=reason=>{throw Error('visible_food_'+reason);};
const decode=v=>v.replace(/&#(?:x([0-9a-f]+)|(\d+));|&(amp|lt|gt|quot|apos|nbsp);/gi,(all,hex,decimal,named)=>{if(named)return({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[named.toLowerCase()];const n=parseInt(hex||decimal,hex?16:10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):all;});
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const blockTags=new Set(['html','body','div','p','section','article','header','footer','nav','ul','ol','li','h1','h2','h3','h4','h5','h6','table','tr','td','br']);
function visibleDOM(html){
 const clean=html.replace(/<!doctype[^>]*>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript|template|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const root={tag:'body',attrs:{},children:[],hidden:false},stack=[root],nodes=[];
 for(const token of clean.matchAll(/<\/?[a-z][\w:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/gi)){
  const raw=token[0];if(!raw.startsWith('<')){stack.at(-1).children.push(decode(raw));continue;}
  const tag=/^<\/?([\w:-]+)/.exec(raw)[1].toLowerCase();
  if(raw.startsWith('</')){if(voidTags.has(tag))continue;if(stack.at(-1).tag!==tag)fail('unbalanced_document');stack.pop();continue;}
  if(nodes.length>=30000||stack.length>=100)fail('document_structure_limit');
  const attrs={};for(const m of raw.matchAll(/\s([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){const key=m[1].toLowerCase();if(Object.hasOwn(attrs,key))fail('ambiguous_attribute');attrs[key]=decode(m[2]??m[3]??m[4]??'');}
  const hidden=stack.at(-1).hidden||Object.hasOwn(attrs,'hidden')||attrs['aria-hidden']==='true'||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attrs.style||''),node={tag,attrs,hidden,children:[],parent:stack.at(-1)};stack.at(-1).children.push(node);nodes.push(node);
  if(!voidTags.has(tag)&&!/\/\s*>$/.test(raw))stack.push(node);
 }
 if(stack.length!==1)fail('unbalanced_document');
 const content=node=>typeof node==='string'?node:node.hidden?'':(blockTags.has(node.tag)?' ':'')+node.children.map(content).join('')+(blockTags.has(node.tag)?' ':'');
 const value=node=>text(content(node));
 const aid=key=>{const found=nodes.filter(n=>!n.hidden&&n.attrs['data-aid']===key);if(found.length!==1)fail('ambiguous_field');return value(found[0]);};
 return{nodes,value,aid,body:value(root)};
}
function document(input,website){
 if(!input||input.hash_basis!=='decoded_utf8'||input.raw!==true||typeof input.html!=='string'||Buffer.byteLength(input.html)>1500000||!hash(input.sha256)||sha256(input.html)!==input.sha256||input.http_status!==200||!Number.isFinite(Date.parse(input.retrieved_at)))fail('raw_document_required');
 const url=sourceURL(input.url),registered=sourceURL(website);if(url.origin!==registered.origin)fail('source_origin_changed');
 const quality=inspectSourceDocument(input.html);if(quality.source_state!=='html_available'||quality.requires_rendering)fail('source_unavailable');
 const extracted=extractRenderedSource(input.html,url.href),title=input.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 if(extracted.aggregator||assessMachineSourceIdentity({website,finalUrl:url.href,title,name:input.expected_name,description:extracted.profile.description}).outcome!=='continue')fail('source_identity_hold');
 return{...input,url:url.href,quality,dom:visibleDOM(input.html),title};
}
export const visibleFoodSourceHeld=(prior,website)=>{
 const flagged=value=>value===true||value==='true';
 if(flagged(prior.blocked)||prior.status==='blocked'||['blocked','error'].includes(prior.crawl_status)||prior.blocked_reason==='source_scope_mismatch'||['scope_review_required','organization_identity_quarantine','source_scope_mismatch','source_challenge','challenge'].some(key=>flagged(prior[key]))||prior.identity_scope||prior.member||prior.association_member||prior.source_affiliation||['association_directory','association_member','supporting_publisher_profile'].includes(prior.source_kind))return true;
 const document=value=>{try{const url=new URL(value);return url.protocol+'//'+url.hostname.replace(/^www\./,'')+url.pathname.replace(/\/$/,'')+url.search;}catch{return null;}};
 if(prior.source_url)return !document(prior.source_url)||document(prior.source_url)!==document(website);
 return Object.keys(prior).some(key=>!['lease','_lease_source_context','provenance','checked_at','last_attempt_at','status','crawl_status'].includes(key));
};
function identityReview(review,row,branch,menu){
 const c=context(row),prior=object(row.existing_enrich);
 if(review?.schema!==1||review.verification!=='reviewed_official_visible_branch'||!review.reviewer||!Number.isFinite(Date.parse(review.reviewed_at))||review.source_fingerprint!==row.source_fingerprint||review.prior_machine_sha256!==sha256(canonical(prior))||canonical(review.canonical_context)!==canonical(c)||!c.address||!c.city||!c.country||!['business','vendor'].includes(c.entity_type))fail('review_context_changed');
 if(review.category_slug!==row.category_slug||!/(?:restaurant|taverna|baker)/i.test(review.category_slug||''))fail('family_review_required');
 if(review.branch_document_sha256!==branch.sha256||review.menu_document_sha256!==menu.sha256||review.branch_document_url!==branch.url||review.menu_document_url!==menu.url)fail('review_document_changed');
 if(review.branch_scope!=='single_branch'||review.scope_gaps?.length)fail('branch_scope_unconfirmed');
 const quotes=object(review.quotes),street=String(review.canonical_street||'');
 if(!/\d/.test(street)||!norm(c.address).includes(norm(street)))fail('canonical_street_required');
 for(const [field,canonicalValue]of [['name',c.name],['street',street],['city',c.city],['country',c.country]])if(typeof quotes[field]!=='string'||quotes[field].length>500||!branch.dom.body.includes(quotes[field])||!norm(quotes[field]).includes(norm(canonicalValue)))fail('literal_branch_quote_required');
 if(!branch.dom.nodes.some(n=>!n.hidden&&n.tag==='a'&&(()=>{try{return new URL(n.attrs.href,branch.url).href===menu.url;}catch{return false;}})()))fail('literal_menu_link_required');
 if(review.menu_scope?.kind!=='lunch'||review.menu_scope?.label!=='Lunch menu'||review.menu_scope?.entire_business_offering!==false||!menu.dom.nodes.some(n=>!n.hidden&&/^h[1-6]$/.test(n.tag)&&norm(menu.dom.value(n))==='lunch menu'))fail('menu_scope_required');
 return c;
}
function reviewedDataAidMenu(menu,review){
 if(review.offering_format!=='data-aid-menu-v1')fail('offering_format_unreviewed');
 const titles=menu.dom.nodes.filter(n=>!n.hidden&&/^MENU_SECTION\d+_ITEM\d+_TITLE$/.test(n.attrs['data-aid']||''));
 if(new Set(titles.map(n=>n.attrs['data-aid'])).size!==titles.length)fail('ambiguous_field');
 if(!titles.length||titles.length>300)fail('menu_items_limit');
 const sections=new Map();
 for(const node of titles){const[,si,ii]=node.attrs['data-aid'].match(/^MENU_SECTION(\d+)_ITEM(\d+)_TITLE$/),key='MENU_SECTION'+si+'_ITEM'+ii,name=menu.dom.value(node),price=menu.dom.aid(key+'_PRICE'),note=menu.dom.aid(key+'_DESC');
  if(!name||name.length>160||price.length>100||note.length>600||!/^\d+(?:[.,]\d{1,2})?$/.test(price))fail('menu_literal_bounds');
  if(!sections.has(si)){const section=menu.dom.aid('MENU_SECTION_TITLE_'+si);if(!section||section.length>100||sections.size>=20)fail('menu_section_limit');sections.set(si,{section,items:[]});}
  sections.get(si).items.push({name,price,note});
 }
 const result=[...sections.values()];if(Buffer.byteLength(JSON.stringify(result))>120000)fail('menu_bytes_limit');
 if(review.observed_items!==titles.length||review.menu_sha256!==sha256(canonical(result)))fail('review_offering_changed');
 return result;
}
export function createReviewedVisibleFoodCandidate({row,branchDocument,menuDocument,identityReview:review,parentReport,parentReportSha256}){
 const prior=object(row?.existing_enrich),current=context(row||{}),holdPrior=reviewedFoodErrorDeferred(prior)&&canonical(prior.source_identity?.canonical_context)===canonical(current)?{...prior,crawl_status:'review_required'}:prior;
 if(visibleFoodSourceHeld(holdPrior,row?.website))fail('source_hold_review_required');
 if(!row?.source_fingerprint||row.owner_managed!==false||row.owner_workspace_id!==null||row.owner_user_id!==null||!Number.isInteger(row.primary_category_id)||!Object.hasOwn(row,'claim_status')||!['unclaimed',null].includes(row.claim_status)||!hash(parentReportSha256))fail('eligible_canonical_record_required');
 if(!parentReport||sha256(canonical(parentReport))!==parentReportSha256||parentReport.capture_kind!=='source_html'||parentReport.listing_id!==(row.listing_id||row.id)||parentReport.website!==row.website)fail('parent_report_binding_required');
 const branch=document({...branchDocument,expected_name:row.name},row.website),menu=document({...menuDocument,expected_name:row.name},row.website),c=identityReview(review,row,branch,menu),items=reviewedDataAidMenu(menu,review),count=items.reduce((n,s)=>n+s.items.length,0),reviewHash=sha256(canonical(review));
 const identity={name:row.name,source_url:branch.url,verification:'reviewed_official_visible_branch',expected_entity_type:row.entity_type,category_slug:row.category_slug,ownership_verified:false,review_sha256:reviewHash,canonical_context_sha256:sha256(canonical(c)),canonical_context:c,reviewer:review.reviewer,reviewed_at:review.reviewed_at,evidence_source_url:branch.url,evidence_sha256:branch.sha256};
 const profile={menu:items,menu_url:menu.url,menu_source:menu.url,menu_source_format:'reviewed-visible-data-aid-fields',menu_total_items:count,menu_truncated:false};
 return{schema:2,capture_kind:'reviewed_visible_food',source_scope:'official_site',capture_recipe_sha256:visibleFoodRecipeHash,listing_id:c.listing_id,website:row.website,source_fingerprint:row.source_fingerprint,review_required:true,collected_at:review.reviewed_at,render:null,aggregator:false,source:{url:branch.url,title:branch.title,http_status:200,sha256:branch.sha256,...branch.quality},extractor_sha256:extractorHash,profile,images:[],provenance:Object.fromEntries(Object.keys(profile).map(k=>[k,'reviewed-visible-source:'+menu.url])),visible_food_review:review,parent_report_sha256:parentReportSha256,parent_report_binding:{listing_id:parentReport.listing_id,website:parentReport.website,source_sha256:parentReport.source?.sha256},food_offering:{state:'captured_pending_review',source_url:menu.url,source_sha256:menu.sha256,hash_basis:'decoded_utf8',linked_from_sha256:branch.sha256,primary_source_url:branch.url,primary_identity:identity,canonical_context:object(row.existing_enrich)._lease_source_context,kind:'structured_menu',menu_sha256:sha256(canonical(items)),source_format:'reviewed-visible-data-aid-fields',original_total:count,retained_items:count,truncated:false,total_state:'observed',retrieved_at:menu.retrieved_at,offering_scope:review.menu_scope,customer_journey_verified:false}};
}
export function validateReviewedVisibleFoodCandidate(report,review,lease){
 const evidence=report.visible_food_review,food=report.food_offering,identity=food?.primary_identity,c=evidence?.canonical_context,projected=projectedContext(lease);
 const branchURL=sourceURL(report.source?.url),menuURL=sourceURL(food?.source_url),registered=sourceURL(lease.website);if(branchURL.origin!==registered.origin||menuURL.origin!==registered.origin)fail('source_origin_changed');
 if(report.capture_kind!=='reviewed_visible_food'||report.capture_recipe_sha256!==visibleFoodRecipeHash||evidence?.schema!==1||evidence?.verification!=='reviewed_official_visible_branch'||!evidence.reviewer||!Number.isFinite(Date.parse(evidence.reviewed_at))||review.visible_branch_confirmed!==true||review.visible_branch_review_sha256!==sha256(canonical(evidence))||review.reviewer===evidence.reviewer)fail('independent_branch_review_required');
 if(!c||Object.entries(projected).some(([key,value])=>c[key]!==value)||c.owner_user_id!==null||c.owner_workspace_id!==null||!['unclaimed',null].includes(c.claim_status)||lease.owner_managed!==false||lease.owner_workspace_id!==null||lease.owner_user_id!==null||['category_slug','primary_category_id','claim_status'].some(key=>!Object.hasOwn(lease,key)||lease[key]!==c[key])||evidence.source_fingerprint!==lease.source_fingerprint||evidence.prior_machine_sha256!==sha256(canonical(lease.existing_enrich))||evidence.branch_scope!=='single_branch'||evidence.scope_gaps?.length||!hash(report.parent_report_sha256)||report.parent_report_binding?.listing_id!==c.listing_id||report.parent_report_binding?.website!==c.website)fail('review_context_changed');
 if(!identity||identity.verification!=='reviewed_official_visible_branch'||identity.review_sha256!==review.visible_branch_review_sha256||identity.reviewer!==evidence.reviewer||identity.reviewed_at!==evidence.reviewed_at||identity.canonical_context_sha256!==sha256(canonical(c))||canonical(identity.canonical_context)!==canonical(c)||identity.name!==lease.name||identity.expected_entity_type!==lease.entity_type||identity.category_slug!==evidence.category_slug||!/(?:restaurant|taverna|baker)/i.test(evidence.category_slug||'')||identity.source_url!==report.source?.url||identity.evidence_sha256!==report.source?.sha256||evidence.branch_document_sha256!==report.source?.sha256||evidence.menu_document_sha256!==food.source_sha256||evidence.branch_document_url!==report.source?.url||evidence.menu_document_url!==food.source_url)fail('review_identity_changed');
 if(evidence.menu_sha256!==food.menu_sha256||evidence.observed_items!==food.retained_items||canonical(evidence.menu_scope)!==canonical(food.offering_scope)||food.offering_scope?.kind!=='lunch'||food.offering_scope?.label!=='Lunch menu'||food.offering_scope?.entire_business_offering!==false)fail('review_offering_changed');
 return identity;
}

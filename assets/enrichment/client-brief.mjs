/** Deterministic research brief. Source extraction is evidence, not acceptance.
 * No network, model calls, owner writes, provider connection or publication. */
import { identityMatches } from './member-source.mjs';
const sections=['intro','offerings','gallery','calendar','media','socials','contact'];
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=(v,max=300)=>typeof v==='string'?v.trim().slice(0,max):'';
const list=v=>Array.isArray(v)?v:[];
const heldSource=p=>p?.blocked_reason==='source_scope_mismatch'||p?.scope_review_required===true||p?.scope_review_required==='true'||p?.organization_identity_quarantine===true||p?.organization_identity_quarantine==='true';
export const briefBlocked=profile=>profile?.blocked===true||profile?.blocked==='true'||profile?.status==='blocked'||profile?.crawl_status==='blocked';
export function briefURL(value){if(typeof value!=='string'||value.length>2048)return null;try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}}
function sameSource(a,b){try{const x=new URL(a),y=new URL(b);return x.protocol===y.protocol&&x.hostname.replace(/^www\./,'')===y.hostname.replace(/^www\./,'')&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'')&&x.search===y.search;}catch{return false;}}
function hasIdentity(identity,listing,url,proof){return identity.verification==='exact_name_typed_jsonld'&&identity.name===listing.name&&sameSource(identity.source_url,url)&&proof.source_identity==='exact_name_typed_jsonld'&&['Person','Physician','Dentist','Attorney','ProfessionalService','MusicGroup','LocalBusiness','Restaurant','Bakery','CafeOrCoffeeShop','Store','Hotel','LodgingBusiness','Church','Organization','School','NGO','SportsTeam'].includes(String(identity.schema_type).replace(/^https?:\/\/schema.org\//,''));}

export function buildClientBrief({listing,profile={},provenance={},sourceURL,checkedAt=new Date().toISOString(),sources=[]}){
 const p=object(profile),proof=object(provenance),url=briefURL(sourceURL),registered=briefURL(listing?.website);
 if(!url||!registered||!text(listing?.name)||!text(listing?.entity_type)||p.crawl_status==='error'||briefBlocked(p))return null;
 const member=object(p.member),matchedMember=member.provenance?.identity_match===true&&identityMatches(listing.name,member.name)&&sameSource(member.source_url,url);
 const matchedSource=hasIdentity(object(p.source_identity),listing,url,proof);
 const familyConflict=p.source_identity?.verification==='entity_family_review_required'&&p.source_identity?.name===listing.name&&sameSource(p.source_identity.source_url,url);
 // Redirects to another property or organization cannot compose this client.
 if(!sameSource(url,registered))return null;
 const evidence=(field)=>({field,source_url:list(sources).filter(s=>s.state==='fetched'&&briefURL(s.url)&&text(proof[field],2000).includes(s.url)).at(-1)?.url||url,retrieved_at:checkedAt,method:text(proof[field],240)||'identity_scoped_member',verification:'source_extracted_requires_review'});
 const has=field=>Object.hasOwn(p,field)&&!!text(proof[field],2000)&&proof[field]!=='aggregator-branding-excluded';
 const offerings=[];
 let offeringCount=0;
 const add=(kind,name,field,detail='',price='')=>{name=text(name,160);if(name){offeringCount++;if(offerings.length<30)offerings.push({kind,name,detail:text(detail,500),price:text(price,80)||null,evidence:evidence(field)});}};
 if(has('menu'))for(const group of list(p.menu))for(const item of list(group?.items))add('menu_item',item?.name,'menu',item?.note,item?.price);
 for(const field of ['rooms','dining','venues'])if(has(field))for(const item of list(p[field]))add(field,item?.name,field,item?.detail);
 if(has('services')&&!heldSource(p))for(const item of list(p.services))add('service',typeof item==='string'?item:item?.name||item?.title,'services',typeof item==='string'?'':item?.description||item?.summary);
 if(matchedMember)for(const specialty of list(member.specialties))add('specialty',specialty,'member');
 const actions=[];
 const link=(kind,label,value,field,state)=>{const href=briefURL(value);if(href&&has(field))actions.push({kind,label,url:href,state,evidence:evidence(field)});};
 link('menu','View published menu',p.menu_url,'menu_url','source_document');
 link('booking','Open booking provider',p.booking_url,'booking_url','external_handoff');
 link('order','Open ordering provider',p.order_url,'order_url','external_handoff');
 link('giving','Open source giving page',p.give_url,'give_url','external_handoff');
 if(has('phone')&&typeof p.phone==='string'&&/^\+?[\d ().-]{7,30}$/.test(p.phone))actions.push({kind:'phone',label:'Call',url:'tel:'+p.phone.replace(/[^+\d]/g,''),state:'contact_handoff',evidence:evidence('phone')});
 if(has('email')&&!p.email_conflict&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(p.email||''))actions.push({kind:'email',label:'Email',url:'mailto:'+p.email,state:'contact_handoff',evidence:evidence('email')});
 // An official source can be visited; this does not imply an integrated account.
 actions.push({kind:'website',label:matchedMember?'View source profile':'Visit source website',url,state:'source_handoff',evidence:{field:'website',source_url:registered,retrieved_at:checkedAt,verification:matchedMember?'identity_matched_member':'registered_source_identity_unverified'}});
 const visuals=[];
 for(const field of ['logo_url','hero_url','photo_url'])if(has(field)&&briefURL(p[field]))visuals.push({kind:field,url:briefURL(p[field]),visual_identity_verified:false,evidence:evidence(field)});
 if(has('photo_urls'))for(const value of list(p.photo_urls).slice(0,12)){const image=briefURL(value);if(image&&!visuals.some(v=>v.url===image))visuals.push({kind:'gallery',url:image,visual_identity_verified:false,evidence:evidence('photo_urls')});}
 const available=['intro'];
 if(offerings.length||actions.some(a=>a.kind==='menu'))available.push('offerings');
 if(visuals.some(v=>v.kind!=='logo_url'))available.push('gallery');
 if(has('hours')&&list(p.hours).length||actions.some(a=>a.kind==='booking'))available.push('calendar');
 if(['listen','embeds','video_urls'].some(field=>has(field)&&list(p[field]).length))available.push('media');
 if(has('social')&&Object.values(object(p.social)).some(briefURL))available.push('socials');
 if(actions.some(a=>a.state==='contact_handoff'))available.push('contact');
 // Move only sections with direct evidence ahead of unavailable/default sections.
 // Keep all sections available: owner clears and later operational content remain authoritative.
 const sectionOrder=[...new Set([...available,...sections])];
 const unknowns=['audience','differentiators','visual_identity_verification','operational_connections','rendered_home_acceptance','customer_journey_acceptance'];
 if(!matchedMember&&!matchedSource)unknowns.unshift('identity_verification');
 if(familyConflict)unknowns.unshift('entity_family_review');
 if(!offerings.length)unknowns.push('offering_details');
 if(!has('hours'))unknowns.push('current_hours');
 const needs=[];
 if(offerings.some(o=>o.kind==='menu_item'))needs.push({tool:'menu_editor',state:'requirement_only'});
 if(actions.some(a=>a.kind==='booking'))needs.push({tool:'booking_provider',state:'external_link_only'});
 if(offerings.some(o=>o.kind==='rooms'))needs.push({tool:'accommodation_inventory',state:'not_connected_by_source_extraction'});
 const brief={schema_version:1,status:'draft_requires_review',listing:{id:text(listing.listing_id||listing.id,80)||null,slug:text(listing.slug,200),name:text(listing.name),entity_type:text(listing.entity_type,80)},
  source:{registered_url:registered,url,retrieved_at:checkedAt,identity_match:matchedMember||matchedSource,scope:matchedMember?'individual_member':matchedSource?'exact_name_typed_source':'registered_source_requires_identity_review'},
  offering:offerings,audience:[],differentiators:[],description:has('description')?{text:text(p.description,1200),evidence:evidence('description')}:null,
  primary_actions:actions,visual_assets:visuals,tools_needed:needs,unknowns,
  composition:{section_order:sectionOrder,evidenced_sections:available,copy_generated:false,hidden_sections:[]},
  progress:{source_research:'partial',brief:'draft_requires_review',classification:familyConflict?'review_required':'not_accepted',composition:'evidence_arrangement_only',operational_connections:'unverified',acceptance:'not_reviewed'},
  identity_conflicts:familyConflict?[{stored_entity_type:listing.entity_type,source_schema_type:p.source_identity.schema_type,source_url:url,next_action:'Review the exact source identity and catalogue family before changing the client home.'}]:[],
  sources:list(sources).slice(0,3).map(s=>({url:briefURL(s.url),state:text(s.state,80),purpose:text(s.purpose,80)})).filter(s=>s.url),
  summary_coverage:{offering_count:offeringCount,offering_retained:offerings.length,visual_retained:visuals.length,bounded:true}};
 // Keep per-client additions bounded within the existing 2MB leased batch cap.
 // The complete menu/catalogue remains in its original field, not this summary.
 while(new TextEncoder().encode(JSON.stringify(brief)).byteLength>24000&&(offerings.length||visuals.length)){
  if(offerings.length)offerings.pop();else visuals.pop();
 }
 brief.summary_coverage.offering_retained=offerings.length;
 brief.summary_coverage.visual_retained=visuals.length;
 if(offerings.length<offeringCount)unknowns.push('additional_offerings_outside_bounded_summary');
 return brief;
}

/** Public arrangement consumes no draft claims, copy, media or actions. */
export function briefHomeDesign(entity){
 const enrich=object(entity?.profile?._enrich),brief=object(enrich.client_brief);
 if(brief.schema_version!==1||brief.status!=='draft_requires_review'||brief.source?.identity_match!==true||enrich.crawl_status==='error'||briefBlocked(enrich)||brief.listing?.id!==entity.id||brief.listing?.name!==entity.name||brief.listing?.entity_type!==entity.entity_type||!sameSource(brief.source?.registered_url,entity.website)||!sameSource(brief.source?.url,enrich.source_url)||!sameSource(brief.source?.url,entity.website))return null;
 const owner=object(entity.owner_content),ownerProfile=object(owner.profile),raw=object(entity.profile);
 const importedFields=['menu','menu_url','menu_image_urls','services','rooms','dining','venues','phone','email','hours','photos','photo_urls','gallery','photo_url','hero','hero_url','hero_image','logo_url','listen','embeds','video_urls','social','social_links','order_url','reserve_url','booking_url'];
 if(Object.hasOwn(entity,'services')||importedFields.some(field=>[owner,ownerProfile,raw].some(layer=>Object.hasOwn(layer,field))))return null;
 const order=brief.composition?.section_order,available=brief.composition?.evidenced_sections;
 if(!Array.isArray(order)||order.length!==sections.length||new Set(order).size!==sections.length||order.some(s=>!sections.includes(s))||!Array.isArray(available)||available.some(s=>!sections.includes(s)))return null;
 // Validate against evidence rebuilt from the current machine fields, not an
 // arbitrary stored draft order. No extra fields or generated copy enter design.
 const current=buildClientBrief({listing:{...entity,listing_id:entity.id},profile:enrich,provenance:enrich.provenance,sourceURL:enrich.source_url,checkedAt:brief.source.retrieved_at});
 if(!current||current.source.identity_match!==true||JSON.stringify(current.composition.section_order)!==JSON.stringify(order))return null;
 return {schema_version:1,section_order:order,hidden_sections:[],copy:{},item_order:{offerings:[]}};
}

/** Current source statements only. Owner/raw fields, including explicit clears,
 * remain authoritative. Does not approve credentials, availability or bookings. */
export function scopedSourceServices(entity){
 const raw=object(entity?.profile),p=object(raw._enrich),owner=object(entity?.owner_content);
 if([entity,owner,object(owner.profile),raw].some(layer=>Object.hasOwn(object(layer),'services'))||!Array.isArray(p.services)||!text(p.provenance?.services,2000)||p.provenance.services==='aggregator-branding-excluded'||p.crawl_status==='error'||briefBlocked(p)||heldSource(p)||p.source_affiliation||p.member||['association_directory','association_member','supporting_publisher_profile'].includes(p.source_kind))return [];
 try{const registered=new URL(entity.website),source=new URL(p.source_url),identity=new URL(p.source_identity?.source_url);if(registered.protocol!=='https:'||source.protocol!=='https:'||!sameSource(registered.href,source.href)||registered.search!==source.search||!sameSource(identity.href,source.href)||identity.search!==source.search)return [];}catch{return [];}
 if(p.source_identity?.expected_entity_type!==entity.entity_type||!hasIdentity(object(p.source_identity),entity,p.source_url,object(p.provenance)))return [];
 return p.services.map(item=>({name:text(typeof item==='string'?item:item?.name||item?.title,160),description:text(typeof item==='string'?'':item?.description||item?.summary,500)})).filter(item=>item.name).slice(0,30);
}

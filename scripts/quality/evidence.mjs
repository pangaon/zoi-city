import { sourceRepairIssue } from '../../supabase/functions/zoi-enrich/_document-quality.js';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {extractMemberSource,memberEnrichmentGuard,memberTextFromHTML} from '../../assets/enrichment/member-source.mjs';
import {extractAssociationCard} from '../../assets/enrichment/association-cards.mjs';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('en').replace(/[\p{P}\p{S}\s]+/gu,' ').trim();
// Canonical entity routes come from the deployed routing contract, excluding aliases.
const canonicalRoutes=new Set(JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8')).rewrites.filter(r=>r.destination==='/api/entity?slug=:slug').map(r=>r.source.replace('/:slug','')));
export function routeFor(row){if(!/^[a-z][a-z_]*$/.test(row.entity_type||'')||!row.slug||row.slug.includes('/'))throw Error('invalid_listing_route');const prefix='/'+(row.entity_type==='travel_place'?'travel-place':row.entity_type);if(!canonicalRoutes.has(prefix))throw Error('unsupported_listing_route');return prefix+'/'+encodeURIComponent(row.slug)}
export function classifySource(row,response){
 const basis={subject_name:row.name,source_url:response.url,http_status:response.status,source_fingerprint:row.source_fingerprint,source_sha256:sha256(response.text),identity_match:false,passed:false};
 if(response.status!==200)return{status:'retry',evidence:{...basis,reason:'source_http_'+response.status}};
 if(/one moment, please|request (?:is )?being verified|checking your browser|verify you are human|cf-chl-/i.test(response.text))return{status:'retry',evidence:{...basis,reason:'source_challenge'}};
 const repair=sourceRepairIssue(response.text);if(repair)return{status:'retry',evidence:{...basis,reason:repair.reason,repair}};
 const member=extractMemberSource({url:response.url,html:response.text,expectedName:row.name})||extractAssociationCard({url:response.url,html:response.text,expectedName:row.name});
 if(member)return{status:'verified',evidence:{...basis,passed:true,identity_match:true,source_role:'individual',method:member.provenance.method,source_fields:{name:member.name,profession:member.profession,role:member.affiliation?.role||null,portrait_url:member.portrait_url}}};
 const guarded=memberEnrichmentGuard({listing:{name:row.name,entity_type:row.entity_type,website:row.website,profile:{_enrich:row.existing_enrich||{}}},html:response.text,url:response.url});
 if(guarded.handled)return{status:'retry',evidence:{...basis,reason:'member_identity_not_confirmed'}};
 const roles={Person:'individual',MedicalClinic:'practice',Physician:'practice',Dentist:'practice',Attorney:'practice',LegalService:'practice',Organization:'organization',NGO:'organization',Church:'organization',LocalBusiness:'practice',Restaurant:'venue',Hotel:'venue',MusicVenue:'venue',Event:'event',MusicEvent:'event',Place:'place',TouristAttraction:'place',Product:'product'};
 const nodes=[];const visit=(x,depth=0)=>{if(!x||depth>8||nodes.length>500)return;if(Array.isArray(x)){x.forEach(v=>visit(v,depth+1));return}if(typeof x==='object'){nodes.push(x);if(x['@graph'])visit(x['@graph'],depth+1)}};
 for(const m of response.text.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]))}catch{}}
 const matches=nodes.filter(n=>norm(n.name)===norm(row.name)&&[].concat(n['@type']||[]).some(t=>roles[t]));if(matches.length!==1)return{status:'retry',evidence:{...basis,reason:matches.length?'ambiguous_source_identity':'source_identity_not_confirmed'}};
 const node=matches[0],role=[].concat(node['@type']).map(t=>roles[t]).find(Boolean),person=['professional','artist','creator','athlete'].includes(row.entity_type);
 if(person&&role!=='individual')return{status:'retry',evidence:{...basis,reason:'person_identity_type_not_confirmed'}};
 return{status:'verified',evidence:{...basis,passed:true,identity_match:true,source_role:role,method:'exact_name_typed_jsonld',source_fields:{name:node.name,type:node['@type']}}};
}
export function verifyDOM(row,http,browser,task='verification'){
 const route=routeFor(row),evidence={source_fingerprint:row.source_fingerprint,subject_name:row.name,route,http_status:http.status,passed:false,controls_checked:false};
 if(http.status!==200)return{status:'retry',evidence:{...evidence,reason:'canonical_http_'+http.status}};
 if(!browser?.screens?.length||browser.screens.length!==2||browser.screens.some(s=>!s.identityPresent||s.overflow||s.brokenImages||s.emptyControls||s.unsafeLinks||s.deadAnchors||s.httpOriginMismatch||s.untestedPrimary))return{status:'retry',evidence:{...evidence,reason:'rendered_page_checks_failed'}};
 if(!browser.control?.passed)return{status:'retry',evidence:{...evidence,reason:'interactive_control_not_confirmed'}};
 if(task==='design')return{status:'retry',evidence:{...evidence,reason:'design_source_section_review_required'}};
 return{status:'verified',evidence:{...evidence,passed:true,controls_checked:true,identity_match:true,viewports:[390,1440],control:browser.control.kind,method:'rendered_dom_and_safe_control',canonical_sha256:sha256(http.text)}};
}

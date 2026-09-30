/** Pure source parsing. Never fetches, mutates a listing, verifies a licence,
 * or treats organization metadata as the identity of a directory member. */
const CHMS='hellenicmedical.ca';
const ORG_SOCIALS=new Set(['facebook.com/hellenicmedical.ca','linkedin.com/company/hellenicmedical','instagram.com/hellenicmedical.ca']);
const plain=v=>String(v??'').replace(/\u00a0/g,' ').replace(/[\t ]+/g,' ').trim();
const decode=s=>String(s).replace(/&#(x[\da-f]+|\d+);?/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):''}).replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[n]));
const token=s=>plain(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z\u0370-\u03ff ]/g,' ').split(/\s+/).filter(x=>x&&!['dr','doctor','prof','rn','md','msc','bhsc','phd','frcpc','frcsc','ccfp'].includes(x));
export function identityMatches(expected,actual){const a=token(expected),b=token(actual);return a.length>=2&&b.length>=2&&a[0]===b[0]&&a.at(-1)===b.at(-1)}
export function sourceURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null}catch{return null}}
export function classifyMemberSource(listing){const u=sourceURL(listing?.website||listing?.profile?._enrich?.source_url),person=['professional','artist','creator'].includes(listing?.entity_type);if(!u||!person)return{kind:'not_member_source',host:u?.hostname||null};const member=/\/(profile|profiles|member|members|directory|people|team)\/[^/]+\/?$/i.test(u.pathname);return{kind:member?'third_party_member_candidate':'person_on_shared_site_requires_review',host:u.hostname.replace(/^www\./,''),member_path:member,global_metadata_safe:false}}
/** Block-oriented text only; scripts, navigation, footer and global head metadata
 * are deliberately discarded. The result is not HTML and must be escaped by UI. */
export function memberTextFromHTML(html){if(typeof html!=='string'||html.length>2_000_000)throw Error('member_source_too_large');return decode(html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|head|nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'\n').replace(/<(?:br\b[^>]*|\/(?:p|div|li|h[1-6]|section|article|tr|td|dt|dd))\s*>/gi,'\n').replace(/<[^>]*>/g,' ')).split(/\r?\n/).map(plain).filter(Boolean).join('\n')}
function normalizeEmail(value){const email=plain(value).replace(/^mailto:/i,'').split('?')[0];return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!/(?:notapplicable|example\.(?:com|org|invalid)|noreply|no-reply)/i.test(email)?email:null}
function normalizePhone(value){const raw=plain(value);if(!raw)return null;let digits=raw.replace(/\D/g,'');if(digits.length===10)return '+1'+digits;if(digits.length===11&&digits[0]==='1')return '+'+digits;return /^\+[1-9]\d{7,14}$/.test(raw)?raw:null}
function portrait(value){const u=sourceURL(value);return u&&u.hostname.replace(/^www\./,'')===CHMS&&/^\/wp-content\/uploads\/pp-avatar\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(u.pathname)?u.href:null}
export function extractMemberSource({url,html,text,images=[],expectedName,affiliation=null,checkedAt,method='official_profile_html'}){
 const u=sourceURL(url);if(!u||u.hostname.replace(/^www\./,'')!==CHMS||!/^\/profile\/[^/]+\/?$/i.test(u.pathname))return null;
 const raw=text??memberTextFromHTML(html);if(typeof raw!=='string'||raw.length>200000)throw Error('member_source_too_large');
 const lines=raw.split(/\r?\n/).map(plain).filter(Boolean);const start=lines.findIndex(x=>x.length<=160&&identityMatches(expectedName,x));if(start<0)return null;
 const end=lines.findIndex((x,i)=>i>start&&/^(newsletter|stay updated|useful links|social|©|handcrafted by)\b/i.test(x));const scope=lines.slice(start,end<0?lines.length:end);const fields={};
 const labels=['University','Graduation Year','Profession','Specialization','Subspecialization','Province','City','Practice Phone','Practice E-mail','Practice Email','Speaks Greek'];
 for(let i=1;i<scope.length;i++){const line=scope[i],match=/^([^:]+):\s*(.*)$/.exec(line);if(!match||!labels.includes(match[1]))continue;let value=match[2];if(!value&&scope[i+1]&&!/^[^:]+:/.test(scope[i+1]))value=scope[++i];fields[match[1]]=plain(value)}
 const profession=fields.Profession||null;if(!profession&&!fields.Specialization&&!fields.University)return null;
 const name=scope[0].replace(/,\s*(RN|MD|MSc|PhD|BHSc|FRCPC|FRCSC|CCFP)(?:\s*,.*)?$/i,'').trim();const credentials=scope[0].includes(',')?scope[0].slice(scope[0].indexOf(',')+1).trim().slice(0,100):null;
 const role=/^(Associate|Physician|Physician Trainee|Associate Trainee|Medical student|Student)(?:, Mentor)?$/i.test(scope[1]||'')?scope[1]:null;
 const scopedImages=[...images];
 if(!scopedImages.length&&typeof html==='string'){let section=html.replace(/<(script|style|head|nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');const cutoff=section.search(/Newsletter|Stay updated with our latest news/i);if(cutoff>=0)section=section.slice(0,cutoff);for(const match of section.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)){const image=portrait(decode(match[1]));if(image&&!scopedImages.includes(image))scopedImages.push(image)}}
 const foundImages=scopedImages.map(x=>typeof x==='string'?x:x.url||x.src).map(portrait).filter(Boolean);const image=foundImages.length===1?foundImages[0]:null;
 const grad=Number(fields['Graduation Year']);const education=fields.University?[{institution:fields.University,graduation_year:Number.isInteger(grad)&&grad>=1900&&grad<=new Date(checkedAt||Date.now()).getUTCFullYear()?grad:null}]:[];
 return{source_url:u.href,checked_at:checkedAt||new Date().toISOString(),name,profession,credentials,specialties:[fields.Specialization,fields.Subspecialization].filter(Boolean).flatMap(x=>x.split(/,\s*/)).filter(Boolean),education,languages:/^yes$/i.test(fields['Speaks Greek']||'')?['Greek']:[],city:fields.City||null,province:fields.Province||null,country:'Canada',portrait_url:image,phone:normalizePhone(fields['Practice Phone']),email:normalizeEmail(fields['Practice E-mail']||fields['Practice Email']),affiliation:affiliation?{...affiliation,role:role||affiliation.role||null,source_url:u.href}:null,provenance:{method,scope:'identity_matched_member_body',identity_match:true,portrait:image?'member_portrait_link':null,phone:fields['Practice Phone']?'practice_label':null,email:(fields['Practice E-mail']||fields['Practice Email'])?'practice_label':null,country:'Canadian society directory context',licence_verified:false}};
}
const socialKey=v=>{const u=sourceURL(v);return u?u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/+$/,''):''};
export function organizationContamination(listing){const e=listing?.profile?._enrich;if(listing?.entity_type!=='professional'||!e)return[];const host=sourceURL(e.source_url||listing.website)?.hostname.replace(/^www\./,'');if(host!==CHMS)return[];const out=[];if(/\/chms-default\.(?:jpg|png)(?:\?|$)/i.test(e.photo_url||''))out.push({field:'photo_url',value:e.photo_url,reason:'organization_default_image_on_person'});if(e.tagline==='Canadian Hellenic Medical Society')out.push({field:'tagline',value:e.tagline,reason:'organization_name_on_person'});if(/^CHMS connects Greek-heritage physicians, trainees, students/i.test(e.description||''))out.push({field:'description',value:e.description,reason:'organization_description_on_person'});for(const[k,v]of Object.entries(e.social||{}))if(ORG_SOCIALS.has(socialKey(v)))out.push({field:'social.'+k,value:v,reason:'organization_social_on_person'});if(e.email&&!normalizeEmail(e.email))out.push({field:'email',value:e.email,reason:'placeholder_email'});return out}

const ASSOCIATION_HOSTS=new Set(['hellenicmedical.ca','hellenicbar.org','hcla.ca','helleniclaw.org','hellenicprofessionalwomen.org']);
/** Call before generic extraction and same-origin supplementary pages.
 * A challenge/unknown member structure yields only crawl-status metadata; it
 * never replaces a previously reviewed member object with organization data.
 * Images must already have been scoped to this member (never site-wide OG).
 */
export function memberEnrichmentGuard({listing,html,url,images=[],checkedAt}){
 let u=sourceURL(url||listing?.website);
 if(!u){try{const candidate=new URL(url||listing?.website);if(candidate.protocol==='http:'&&!candidate.username&&!candidate.password)u=candidate}catch{}}
 const host=u?.hostname.replace(/^www\./,'');
 const person=['professional','artist','creator'].includes(listing?.entity_type);
 const pathMember=!!u&&/\/(profile|profiles|member|members|directory|people|team)\/[^/]+\/?$/i.test(u.pathname);
 const known=[...ASSOCIATION_HOSTS].some(domain=>host===domain||host?.endsWith('.'+domain))||listing?.profile?._enrich?.source_kind==='association_member'||listing?.source_kind==='association_member';
 if(!person||(!known&&!pathMember))return{handled:false,skipSupplementary:false};
 const metadata={source_kind:'association_member',identity_scope:'person'};
 if(!listing?.name)return{handled:true,skipSupplementary:true,profile:{...metadata,crawl_status:'identity_review_required',last_error:'member_name_missing'},provenance:{source_kind:'association_identity_guard'}};
 const member=extractMemberSource({url:u?.href,html,images,expectedName:listing.name,checkedAt,affiliation:listing.profile?._enrich?.member?.affiliation||null});
 if(!member)return{handled:true,skipSupplementary:true,profile:{...metadata,crawl_status:'identity_review_required',last_error:'member_profile_unavailable_or_unmatched'},provenance:{source_kind:'association_identity_guard'}};
 const previous=listing.profile?._enrich?.member;if(!member.portrait_url&&previous?.portrait_url&&identityMatches(listing.name,previous.name)&&sourceURL(previous.source_url)?.pathname.replace(/\/$/,'')===u.pathname.replace(/\/$/,'')){member.portrait_url=portrait(previous.portrait_url);member.provenance.portrait=member.portrait_url?'previous_reviewed_member_portrait':null;}
 return{handled:true,skipSupplementary:true,profile:{...metadata,member,crawl_status:'member_identity_matched',tagline:null,description:null,photo_url:member.portrait_url,hero_url:null,logo_url:null,photo_urls:[],social:{},phone:member.phone,email:member.email},provenance:{member:'identity_matched_member_body:'+u.href,source_kind:'association_identity_guard',social:'organization_social_excluded',photo_url:'member_scope_only'}};
}

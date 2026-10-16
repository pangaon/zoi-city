// @ts-ignore Shared published-field presence; explicit clears never revive fallbacks.
import {publishedField,publishedEmail} from '../../assets/homes/published-fields.mjs';
// @ts-ignore Existing canonical public media precedence and alias clears.
import {profileMedia} from '../../api/_profile-media.js';
import {foodForProfile} from './foodMenu.ts';
import {serviceOfferingsForProfile} from './serviceOfferings.ts';
// @ts-ignore The server-side contract validates version, listing identity and schema before publication.
import {publishedHomeDesign} from '../../api/_home-design.js';
// @ts-ignore Shared public address lookup; never invent a routed or reviewed destination.
import {publishedAddressLookup} from '../../assets/map-data/loader.mjs';
// @ts-ignore Shared pure official-site authority and quarantine contract.
import {selectedOfficialWebsite,officialSourceEntity,sourceIdentityContentHeld} from '../../assets/enrichment/official-source-policy.mjs';
// @ts-ignore Shared conservative phone placeholder guard.
import {placeholderPhone} from '../../supabase/functions/zoi-enrich/_phone.js';
// @ts-ignore Shared reviewed branch contact scope.
import {sharedBranchContactSource, BRANCH_CONTACT_FIELDS} from '../../assets/enrichment/branch-contact-scope.mjs';
// @ts-ignore Shared pure presentation contract.
import {phoneHref} from '../../assets/homes/phone.mjs';
// @ts-ignore Shared pure source-link classifier.
import {socialProfile} from '../../supabase/functions/zoi-enrich/_social.js';
// @ts-ignore Shared exact publisher identity scope.
import {publisherSocial} from '../../assets/enrichment/publisher-social.mjs';
// @ts-ignore Shared identity/provenance/branch guards; owner clears stay authoritative.
import {scopedSourceServices,sourceCopyPlaceholder} from '../../assets/enrichment/client-brief.mjs';
type RecordValue = Record<string, any>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
export function plain(value: unknown) { return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : ''; }
export function publicURL(value: unknown) {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|0\.|169\.254\.)/i.test(url.hostname)) return ''; return url.href; } catch { return ''; }
}
export function profileAction(value: unknown, kind: 'booking' | 'volunteer' | 'inquiry' | 'calendar' | 'group' | 'festival' | 'shows') {
  if(typeof value !== 'string')return '';
  const pattern=kind==='shows'?/^\/trips\/\?artist=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:kind==='festival'?/^\/festival\/\?event=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:kind==='calendar'?/^\/organization-calendar\/\?listing=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:kind==='group'?/^\/groups\/\?listing=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:kind==='inquiry'?/^\/inquiries\/\?listing=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:kind==='booking'?/^\/book\/\?listing=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:/^\/volunteer\/\?workspace=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  return pattern.exec(value)?.[1].toLowerCase() || '';
}
/** Canonical public identity only. Discovery rereads the current reviewed point. */
export function profileMapLink(value: {id?:unknown;slug?:unknown}) {
 const id=value?.id,slug=value?.slug;
 if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||typeof slug!=='string'||!slug||slug.length>240||/[\s/?#\\\u0000-\u001f]/.test(slug))return '';
 try{return 'zoi://explore/map?place='+encodeURIComponent(slug);}catch{return '';}
}
/** Publicly render only bounded property details linked to the selected official site.
 * These are catalogue facts, never availability or a reservation system. */
export function hospitalityCatalog(profile:RecordValue,website:string){
 let origin='';try{const site=new URL(website);if(site.protocol==='https:'&&!site.username&&!site.password)origin=site.origin;}catch{}
 const items=(key:string)=>{const value=profile[key];if(!origin||!Array.isArray(value))return[];const seen=new Set<string>();return value.slice(0,30).flatMap((row:unknown)=>{const item=object(row),name=plain(item.name),detail=plain(item.detail),source=publicURL(item.source);if(!name||name.length>160||detail.length>500||!source)return[];try{const url=new URL(source);if(url.origin!==origin||url.username||url.password||url.hash||url.search||seen.has(url.href))return[];seen.add(url.href);return[{id:url.href,name,detail,source:url.href}];}catch{return[];}});};
 const raw=Array.isArray(profile.amenities)?profile.amenities:[],seen=new Set<string>(),amenities=raw.flatMap((value:unknown)=>{const name=plain(value),key=name.toLowerCase();if(!name||name.length>120||seen.has(key)||seen.size>=20)return[];seen.add(key);return[name];});
 return{rooms:items('rooms'),dining:items('dining'),venues:items('venues'),amenities};
}
export function normalizeProfile(input: unknown) {
  const e = object(officialSourceEntity(object(Array.isArray(input) ? input[0] : input)));
  if (!plain(e.name)) return null;
  const raw = object(e.profile), enrichment = sourceIdentityContentHeld(e)?{}:object(raw._enrich), owner=object(e.owner_content), ownerProfile=object(owner.profile);
  const banned = /^(rating|rating_count|ratingvalue|reviewcount|aggregaterating|reviews?|stars|score|_enrich|_geo|_meta|provenance|source_url|checked_at|blocked|blocked_reason|last_error)$/i;
  const profile: RecordValue = {};
  for (const source of [enrichment, raw, ownerProfile]) for (const key of Object.keys(source)) if (!banned.test(key)) {
    if(source===enrichment&&['description','tagline'].includes(key)&&sourceCopyPlaceholder(source[key]))continue;
    if(source===enrichment&&sharedBranchContactSource(e,enrichment.source_url)&&BRANCH_CONTACT_FIELDS.has(key))continue;
    profile[key] = source===enrichment && ['social','social_links'].includes(key) ? Object.fromEntries(Object.entries(object(source[key])).flatMap(([name,value])=>{const match=socialProfile(value);return match&&!publisherSocial(enrichment.source_url,match.url)?[[name,match.url]]:[];})) : source[key];
  }
  const names: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X', twitter: 'X', spotify: 'Spotify', soundcloud: 'SoundCloud', telegram: 'Telegram', whatsapp: 'WhatsApp' };
  const social = Object.hasOwn(owner,'social_links')?object(owner.social_links):{ ...object(profile.social), ...object(profile.social_links), ...object(e.social_links) };
  const rawPhone=plain(Object.hasOwn(owner,'phone')?owner.phone:Object.hasOwn(ownerProfile,'phone')?ownerProfile.phone:Object.hasOwn(raw,'phone')?raw.phone:(!placeholderPhone(e.phone)&&e.phone)||profile.phone);
  const phone=placeholderPhone(rawPhone)?'':rawPhone;
  const seen = new Set<string>();
  const socials = Object.entries(names).flatMap(([key, label]) => { const url = publicURL(social[key]); if (!url || seen.has(url)) return []; seen.add(url); return [{ label, url }]; });
  const media=profileMedia(e,profile);
  const photo=publicURL(media.hero)||'';
  const logo=publicURL(media.logo)||'';
  const fieldsFromWebsite = Object.keys(enrichment).filter(key => !banned.test(key) && !(key in raw));
  const serviceOwner = [owner, ownerProfile, raw, e].find(layer => Object.hasOwn(layer, 'services'));
  const serviceValue = serviceOwner ? serviceOwner.services : scopedSourceServices(e);
  if (serviceOwner || Array.isArray(serviceValue) && serviceValue.length) profile.services = serviceValue; else delete profile.services;
  const services = Array.isArray(serviceValue) ? serviceValue.map((v: unknown) => plain(v) || plain(object(v).name) || plain(object(v).title)).filter(Boolean).slice(0, 30) : [];
  const booking = profileAction(e.booking_url, 'booking'), inquiry = profileAction(e.inquiry_url, 'inquiry');
  const addressLookup=publishedAddressLookup({s:plain(e.canonical_slug||e.slug),n:plain(e.name),addr:plain(e.address),city:plain(e.city),country:plain(e.country)});
  const publishedDesign=object(e.published_design).ok===true?publishedHomeDesign(e):null;
  const hotelCatalog=hospitalityCatalog(profile,publicURL(selectedOfficialWebsite(e)));
  return { ...hotelCatalog,food:foodForProfile(e), publishedDesign, addressLookup, showsArtist:profileAction(e.shows_url,'shows')===String(e.id||'').toLowerCase()?profileAction(e.shows_url,'shows'):'',festivalListing:profileAction(e.offer_url,'festival')===String(e.id||'').toLowerCase()?profileAction(e.offer_url,'festival'):'', calendarListing:profileAction(e.calendar_url,'calendar')===String(e.id||'').toLowerCase()?profileAction(e.calendar_url,'calendar'):'',
    groupListing:profileAction(e.group_url,'group')===String(e.id||'').toLowerCase()?profileAction(e.group_url,'group'):'',
    inquiryListing: inquiry === plain(e.id).toLowerCase() ? inquiry : '', bookingListing: booking === plain(e.id).toLowerCase() ? booking : '', volunteerWorkspace: profileAction(e.volunteer_url, 'volunteer'), geoPrecision: plain(e.geo_precision), id: plain(e.id), name: plain(e.name), slug: plain(e.canonical_slug || e.slug), type: plain(e.entity_type).replaceAll('_', ' '), category: plain(e.category_slug || e.category).toLowerCase(), description: plain(publishedField(e,'description',e.description || profile.about || profile.description)), location: [e.city, e.country].map(plain).filter(Boolean).join(' · '), address: plain(e.address), website: publicURL(selectedOfficialWebsite(e)), phone, phoneHref:phoneHref(phone), email: publishedEmail(e,e.email || profile.email), photo, logo, gallery: media.gallery.map(publicURL).filter(Boolean), socials, services, serviceOfferings:serviceOfferingsForProfile(e), verified: e.verification_status === 'verified', enrichmentNote: fieldsFromWebsite.length ? 'Some details were read from the business website and have not been confirmed by the owner.' : '', profile };
}

export function profileImageMode(width:number,height:number): 'center'|'cover' {return Number.isFinite(width)&&Number.isFinite(height)&&width>=480&&height>=240&&width/height>=0.85&&width/height<=1.8?'cover':'center';}
export function profileImageEventMode(event:any){const source=event?.nativeEvent?.source,target=event?.nativeEvent?.target;return profileImageMode(source?.width??target?.naturalWidth,source?.height??target?.naturalHeight);}

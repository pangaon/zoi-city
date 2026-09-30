// @ts-ignore Shared pure presentation contract.
import {phoneHref} from '../../assets/homes/phone.mjs';
// @ts-ignore Shared pure source-link classifier.
import {socialProfile} from '../../supabase/functions/zoi-enrich/_social.js';
// @ts-ignore Shared exact publisher identity scope.
import {publisherSocial} from '../../assets/enrichment/publisher-social.mjs';
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
export function normalizeProfile(input: unknown) {
  const e = object(Array.isArray(input) ? input[0] : input);
  if (!plain(e.name)) return null;
  const raw = object(e.profile), enrichment = object(raw._enrich), owner=object(e.owner_content), ownerProfile=object(owner.profile);
  const banned = /^(rating|rating_count|ratingvalue|reviewcount|aggregaterating|reviews?|stars|score|_enrich|_geo|_meta|provenance|source_url|checked_at|blocked|blocked_reason|last_error)$/i;
  const profile: RecordValue = {};
  for (const source of [enrichment, raw, ownerProfile]) for (const key of Object.keys(source)) if (!banned.test(key)) {
    profile[key] = source===enrichment && ['social','social_links'].includes(key) ? Object.fromEntries(Object.entries(object(source[key])).flatMap(([name,value])=>{const match=socialProfile(value);return match&&!publisherSocial(enrichment.source_url,match.url)?[[name,match.url]]:[];})) : source[key];
  }
  const names: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X', twitter: 'X', spotify: 'Spotify', soundcloud: 'SoundCloud', telegram: 'Telegram', whatsapp: 'WhatsApp' };
  const social = Object.hasOwn(owner,'social_links')?object(owner.social_links):{ ...object(profile.social), ...object(profile.social_links), ...object(e.social_links) };
  const phone=plain(Object.hasOwn(owner,'phone')?owner.phone:e.phone || profile.phone);
  const seen = new Set<string>();
  const socials = Object.entries(names).flatMap(([key, label]) => { const url = publicURL(social[key]); if (!url || seen.has(url)) return []; seen.add(url); return [{ label, url }]; });
  const photo = [e.hero_url, e.photo_url, e.photo, profile.hero_url, profile.photo_url].map(publicURL).find(value => value.startsWith('https://')) || '';
  const fieldsFromWebsite = Object.keys(enrichment).filter(key => !banned.test(key) && !(key in raw));
  const services = Array.isArray(profile.services) ? profile.services.map((v: unknown) => plain(v) || plain(object(v).name) || plain(object(v).title)).filter(Boolean).slice(0, 30) : [];
  const booking = profileAction(e.booking_url, 'booking'), inquiry = profileAction(e.inquiry_url, 'inquiry');
  return { showsArtist:profileAction(e.shows_url,'shows')===String(e.id||'').toLowerCase()?profileAction(e.shows_url,'shows'):'',festivalListing:profileAction(e.offer_url,'festival')===String(e.id||'').toLowerCase()?profileAction(e.offer_url,'festival'):'', calendarListing:profileAction(e.calendar_url,'calendar')===String(e.id||'').toLowerCase()?profileAction(e.calendar_url,'calendar'):'',
    groupListing:profileAction(e.group_url,'group')===String(e.id||'').toLowerCase()?profileAction(e.group_url,'group'):'',
    inquiryListing: inquiry === plain(e.id).toLowerCase() ? inquiry : '', bookingListing: booking === plain(e.id).toLowerCase() ? booking : '', volunteerWorkspace: profileAction(e.volunteer_url, 'volunteer'), geoPrecision: plain(e.geo_precision), id: plain(e.id), name: plain(e.name), slug: plain(e.canonical_slug || e.slug), type: plain(e.entity_type).replaceAll('_', ' '), description: plain(e.description || profile.about || profile.description), location: [e.city, e.country].map(plain).filter(Boolean).join(' · '), address: plain(e.address), website: publicURL(e.website || profile.website), phone, phoneHref:phoneHref(phone), email: plain(e.email || profile.email), photo, socials, services, verified: e.verification_status === 'verified', enrichmentNote: fieldsFromWebsite.length ? 'Some details were read from the business website and have not been confirmed by the owner.' : '', profile };
}

export function profileImageMode(width:number,height:number): 'center'|'cover' {return Number.isFinite(width)&&Number.isFinite(height)&&width>=480&&height>=240&&width/height>=0.85&&width/height<=1.8?'cover':'center';}
export function profileImageEventMode(event:any){const source=event?.nativeEvent?.source,target=event?.nativeEvent?.target;return profileImageMode(source?.width??target?.naturalWidth,source?.height??target?.naturalHeight);}

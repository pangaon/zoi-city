type RecordValue = Record<string, any>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
export function plain(value: unknown) { return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : ''; }
export function publicURL(value: unknown) {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|0\.|169\.254\.)/i.test(url.hostname)) return ''; return url.href; } catch { return ''; }
}
export function profileAction(value: unknown, kind: 'booking' | 'volunteer' | 'inquiry') {
  if(typeof value !== 'string')return '';
  const pattern=kind==='inquiry'?/^\/inquiries\/\?listing=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:kind==='booking'?/^\/book\/\?listing=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i:/^\/volunteer\/\?workspace=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  return pattern.exec(value)?.[1].toLowerCase() || '';
}
export function normalizeProfile(input: unknown) {
  const e = object(Array.isArray(input) ? input[0] : input);
  if (!plain(e.name)) return null;
  const raw = object(e.profile), enrichment = object(raw._enrich);
  const banned = /^(rating|rating_count|ratingvalue|reviewcount|aggregaterating|reviews?|stars|score|_enrich|_geo|_meta|provenance|source_url|checked_at|blocked|blocked_reason|last_error)$/i;
  const profile: RecordValue = {};
  for (const source of [enrichment, raw]) for (const key of Object.keys(source)) if (!banned.test(key)) profile[key] = source[key];
  const names: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X', twitter: 'X', spotify: 'Spotify', soundcloud: 'SoundCloud', telegram: 'Telegram', whatsapp: 'WhatsApp' };
  const social = { ...object(profile.social), ...object(e.social_links) };
  const seen = new Set<string>();
  const socials = Object.entries(names).flatMap(([key, label]) => { const url = publicURL(social[key]); if (!url || seen.has(url)) return []; seen.add(url); return [{ label, url }]; });
  const photo = [e.hero_url, e.photo_url, e.photo, profile.hero_url, profile.photo_url].map(publicURL).find(value => value.startsWith('https://')) || '';
  const fieldsFromWebsite = Object.keys(enrichment).filter(key => !banned.test(key) && !(key in raw));
  const services = Array.isArray(profile.services) ? profile.services.map((v: unknown) => plain(v) || plain(object(v).name) || plain(object(v).title)).filter(Boolean).slice(0, 30) : [];
  const booking = profileAction(e.booking_url, 'booking'), inquiry = profileAction(e.inquiry_url, 'inquiry');
  return { inquiryListing: inquiry === plain(e.id).toLowerCase() ? inquiry : '', bookingListing: booking === plain(e.id).toLowerCase() ? booking : '', volunteerWorkspace: profileAction(e.volunteer_url, 'volunteer'), geoPrecision: plain(e.geo_precision), id: plain(e.id), name: plain(e.name), slug: plain(e.canonical_slug || e.slug), type: plain(e.entity_type).replaceAll('_', ' '), description: plain(e.description || profile.about || profile.description), location: [e.city, e.country].map(plain).filter(Boolean).join(' · '), address: plain(e.address), website: publicURL(e.website || profile.website), phone: plain(e.phone || profile.phone), email: plain(e.email || profile.email), photo, socials, services, verified: e.verification_status === 'verified', enrichmentNote: fieldsFromWebsite.length ? 'Some details were read from the business website and have not been confirmed by the owner.' : '', profile };
}

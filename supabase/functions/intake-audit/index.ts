// intake-audit: Zoi business-intake report engine.
// Server-side fetch + HTML parse of a business website or social profile.
// CORS enabled, verify_jwt=false so the front-end can call it with the anon key.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function fetchHtml(url: string, ms = 8000): Promise<{ html: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,el;q=0.8',
      },
    });
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } finally {
    clearTimeout(t);
  }
}

function abs(base: string, href: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function decode(s: string): string {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .trim();
}

function meta(html: string, key: string, attr: 'property' | 'name' = 'property'): string | null {
  const re1 = new RegExp(
    `<meta[^>]*${attr}=[\"']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\"'][^>]*content=[\"']([^\"']*)[\"']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]*content=[\"']([^\"']*)[\"'][^>]*${attr}=[\"']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\"']`,
    'i',
  );
  const m = html.match(re1) || html.match(re2);
  return m ? decode(m[1]) : null;
}

function parseBrand(html: string, baseUrl: string) {
  const ogSite = meta(html, 'og:site_name');
  const ogTitle = meta(html, 'og:title');
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? decode(titleM[1].replace(/\s+/g, ' ')) : null;
  const name = ogSite || ogTitle || title || null;

  const tagline =
    meta(html, 'og:description') || meta(html, 'description', 'name') || null;

  let logo: string | null = meta(html, 'og:image');
  if (!logo) {
    const apple = html.match(/<link[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i);
    if (apple) logo = apple[1];
  }
  if (!logo) {
    const icon = html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["']/i);
    if (icon) logo = icon[1];
  }
  if (logo) logo = abs(baseUrl, decode(logo));

  const colors: string[] = [];
  const themeColor = meta(html, 'theme-color', 'name');
  if (themeColor) colors.push(themeColor);
  const hexCounts: Record<string, number> = {};
  const hexRe = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let hm: RegExpExecArray | null;
  while ((hm = hexRe.exec(html)) !== null) {
    const c = hm[0].toLowerCase();
    if (['#fff', '#ffffff', '#000', '#000000'].includes(c)) continue;
    hexCounts[c] = (hexCounts[c] || 0) + 1;
  }
  const topHex = Object.entries(hexCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);
  for (const c of topHex) if (!colors.includes(c)) colors.push(c);

  const h = html.toLowerCase();
  let platform = 'custom';
  if (/cdn\.shopify|myshopify|shopify-checkout|shopify\.com/.test(h)) platform = 'Shopify';
  else if (/square\.site|squareup\.com|squarespace-cdn|static1\.squarespace/.test(h) && /squarespace/.test(h)) platform = 'Squarespace';
  else if (/square\.site|squareup\.com/.test(h)) platform = 'Square';
  else if (/woocommerce/.test(h) && /wp-content/.test(h)) platform = 'WooCommerce';
  else if (/squarespace/.test(h)) platform = 'Squarespace';
  else if (/wix\.com|_wix|wixstatic|x-wix/.test(h)) platform = 'Wix';
  else if (/godaddy|secureserver\.net/.test(h)) platform = 'GoDaddy';
  else if (/wp-content|wp-includes|wordpress/.test(h)) platform = 'WordPress';

  return { name, tagline, logo, colors: colors.slice(0, 6), platform };
}

const SOCIAL_HOSTS: Record<string, RegExp> = {
  instagram: /(?:https?:)?\/\/(?:www\.)?instagram\.com\/[^"'<>\s)]+/gi,
  facebook: /(?:https?:)?\/\/(?:www\.|m\.)?facebook\.com\/[^"'<>\s)]+/gi,
  tiktok: /(?:https?:)?\/\/(?:www\.)?tiktok\.com\/[^"'<>\s)]+/gi,
  x: /(?:https?:)?\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'<>\s)]+/gi,
  youtube: /(?:https?:)?\/\/(?:www\.)?youtube\.com\/[^"'<>\s)]+/gi,
  linkedin: /(?:https?:)?\/\/(?:www\.)?linkedin\.com\/[^"'<>\s)]+/gi,
};

// platform paths that are NOT real profiles (SDK / widget / share / dev namespaces)
const SOCIAL_NOISE = /^(sharer|sharer\.php|share|share\.php|plugins|intent|tr|embed|home|login|dialog|2008|v\d+|connect|sdk|x-?fb-?ml|fbml|player_api|watch|hashtag|search|events|profile\.php)$/i;

function handleFrom(platform: string, url: string): string | null {
  try {
    const p = new URL(url.startsWith('http') ? url : 'https:' + url);
    const seg = p.pathname.split('/').filter(Boolean);
    if (!seg.length) return null;
    const first = seg[0];
    if (platform === 'youtube') {
      if (first === 'channel' || first === 'c' || first === 'user') return seg[1] ? '@' + seg[1] : null;
      if (SOCIAL_NOISE.test(first)) return null;
      return first.startsWith('@') ? first : '@' + first;
    }
    if (platform === 'linkedin') {
      if (first === 'company' || first === 'in' || first === 'school') return seg[1] ? seg.slice(0, 2).join('/') : null;
      return SOCIAL_NOISE.test(first) ? null : first;
    }
    if (platform === 'tiktok') {
      if (SOCIAL_NOISE.test(first)) return null;
      return first.startsWith('@') ? first : '@' + first;
    }
    if (platform === 'facebook' && first.toLowerCase() === 'profile.php') {
      const id = p.searchParams.get('id');
      return id ? 'profile:' + id : null;
    }
    if (SOCIAL_NOISE.test(first)) return null;
    return first;
  } catch {
    return null;
  }
}

function parseSocials(html: string) {
  const out: { platform: string; url: string; handle: string | null }[] = [];
  const seen = new Set<string>();
  for (const [platform, re] of Object.entries(SOCIAL_HOSTS)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let url = m[0].replace(/&amp;/g, '&').replace(/["'),.]+$/, '');
      if (url.startsWith('//')) url = 'https:' + url;
      const handle = handleFrom(platform, url);
      // require a real handle for x/instagram/tiktok/facebook/youtube/linkedin profiles
      if (!handle) continue;
      const key = platform + '|' + handle;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ platform, url, handle });
      if (out.length > 30) break;
    }
  }
  return out;
}

function parseContact(html: string) {
  const emails = new Set<string>();
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let em: RegExpExecArray | null;
  while ((em = emailRe.exec(html)) !== null) {
    const e = em[0].toLowerCase();
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(e)) continue;
    if (/sentry|wixpress|example\.com|domain\.com|email\.com|yourdomain|@2x|@3x|sentry\.io|\.png|placeholder/.test(e)) continue;
    if (/^(user|name|email|your|info)@(domain|example|email|site)/.test(e)) continue;
    emails.add(e);
  }
  // Phones: prefer tel: links, then mailto-adjacent text. Validate digit counts strictly.
  const telPhones = new Set<string>();
  const telRe = /tel:([+\d().\s-]{7,})/gi;
  let tm: RegExpExecArray | null;
  while ((tm = telRe.exec(html)) !== null) {
    const raw = tm[1].trim().replace(/\s+/g, ' ');
    const d = raw.replace(/\D/g, '');
    if (d.length >= 9 && d.length <= 15) telPhones.add(raw);
  }
  const phones = new Set<string>();
  if (telPhones.size === 0) {
    // fall back to text scan, but only accept tokens that look like real phones
    const text = html.replace(/<[^>]+>/g, ' ');
    // +CC ... (intl) OR Greek 10-digit grouped (2/6 prefix)
    const phoneRe = /(?:\+|00)\d{1,3}[\s().-]?(?:\d[\s().-]?){7,12}\d|\b(?:2|6)\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b|\b(?:2|6)\d{9}\b/g;
    let pm: RegExpExecArray | null;
    while ((pm = phoneRe.exec(text)) !== null) {
      const raw = pm[0].trim().replace(/\s+/g, ' ');
      const d = raw.replace(/\D/g, '');
      if (d.length < 10 || d.length > 15) continue;
      phones.add(raw);
      if (phones.size > 10) break;
    }
  }
  const finalPhones = telPhones.size ? telPhones : phones;
  return { emails: [...emails].slice(0, 10), phones: [...finalPhones].slice(0, 10) };
}

const BIZ_KEYWORDS: Record<string, string[]> = {
  restaurant: ['restaurant', 'menu', 'dine', 'cuisine', 'reservation', 'εστιατόριο'],
  taverna: ['taverna', 'ταβέρνα', 'meze', 'μεζέ', 'ouzo', 'tavern'],
  cafe: ['cafe', 'café', 'coffee', 'espresso', 'καφέ', 'καφετέρια'],
  bakery: ['bakery', 'patisserie', 'pastry', 'bread', 'φούρνος', 'ζαχαροπλαστείο', 'αρτοποιείο'],
  winery: ['winery', 'wine', 'vineyard', 'cellar', 'οινοποιείο', 'κρασί', 'οίνος'],
  salon: ['salon', 'spa', 'hair', 'beauty', 'barber', 'κομμωτήριο'],
  church: ['church', 'parish', 'orthodox', 'liturgy', 'εκκλησία', 'ιερός ναός'],
  hotel: ['hotel', 'rooms', 'suites', 'resort', 'accommodation', 'ξενοδοχείο', 'δωμάτια'],
  retail: ['shop', 'store', 'cart', 'product', 'buy now', 'κατάστημα', 'προϊόντα'],
  professional: ['law', 'attorney', 'consulting', 'services', 'clinic', 'doctor', 'γραφείο', 'υπηρεσίες'],
};

function parseContent(html: string) {
  const grab = (tag: string) => {
    const out: string[] = [];
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const t = decode(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      if (t && t.length > 1 && t.length < 120) out.push(t);
    }
    return out;
  };
  const h1 = grab('h1');
  const h2 = grab('h2');
  const navLabels: string[] = [];
  const navBlock = html.match(/<nav[\s\S]*?<\/nav>/gi);
  if (navBlock) {
    for (const nb of navBlock) {
      const aRe = /<a[^>]*>([\s\S]*?)<\/a>/gi;
      let am: RegExpExecArray | null;
      while ((am = aRe.exec(nb)) !== null) {
        const t = decode(am[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
        if (t && t.length > 1 && t.length < 40) navLabels.push(t);
      }
    }
  }
  const themesPool = [...h1, ...h2, ...navLabels.slice(0, 20)];
  const text = (html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).toLowerCase();
  const stop = new Set(['the','and','for','with','our','you','your','are','που','και','της','του','την','τον','των','στο','στη','this','that','from','all','more','have','will','can','about','νέα']);
  const freq: Record<string, number> = {};
  for (const w of text.match(/[a-zα-ωά-ώ]{4,}/gi) || []) {
    const lw = w.toLowerCase();
    if (stop.has(lw)) continue;
    freq[lw] = (freq[lw] || 0) + 1;
  }
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map((e) => e[0]);

  const content_themes = [...new Set([...h1, ...h2.slice(0, 6), ...navLabels.slice(0, 10)])].slice(0, 18);

  const scores: Record<string, number> = {};
  const all = (themesPool.join(' ') + ' ' + text).toLowerCase();
  for (const [type, kws] of Object.entries(BIZ_KEYWORDS)) {
    let s = 0;
    for (const kw of kws) { const c = all.split(kw.toLowerCase()).length - 1; s += c; }
    if (s) scores[type] = s;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const business_type = ranked.length ? ranked[0][0] : 'unknown';
  return { content_themes, top_keywords: topWords, business_type };
}

function parseBooking(html: string) {
  const h = html.toLowerCase();
  const booking: string[] = [];
  const bm: Record<string, RegExp> = {
    opentable: /opentable\.com/, resy: /resy\.com/, calendly: /calendly\.com/,
    acuity: /acuityscheduling|acuity\.com/, square_booking: /squareup\.com\/appointments|book\.squareup/,
    thefork: /thefork|lafourchette/, bookingcom: /booking\.com/,
  };
  for (const [k, re] of Object.entries(bm)) if (re.test(h)) booking.push(k);
  const commerce: string[] = [];
  const cm: Record<string, RegExp> = {
    stripe: /stripe\.com|js\.stripe/, paypal: /paypal\.com/, shopify_checkout: /shopify-checkout|cdn\.shopify/,
    add_to_cart: /add[\s-]?to[\s-]?cart|προσθήκη στο καλάθι/, buy_button: /buy[\s-]?now|αγορά/,
    woocommerce: /woocommerce/, square_store: /square\.site/,
  };
  for (const [k, re] of Object.entries(cm)) if (re.test(h)) commerce.push(k);
  return { booking, commerce };
}

function isSocialUrl(url: string): string | null {
  for (const [p, re] of Object.entries(SOCIAL_HOSTS)) {
    re.lastIndex = 0;
    if (re.test(url)) return p;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required' });

  let url = '';
  try {
    const body = await req.json();
    url = (body.url || '').toString().trim();
  } catch {
    return json({ ok: false, error: 'invalid JSON body' });
  }
  if (!url) return json({ ok: false, error: 'missing url' });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const fetched_at = new Date().toISOString();
  try {
    const { html, finalUrl } = await fetchHtml(url);
    const socialPlatform = isSocialUrl(finalUrl);

    const brand = parseBrand(html, finalUrl);
    const socials = parseSocials(html);
    const contact = parseContact(html);
    const content = parseContent(html);
    const bk = parseBooking(html);

    let social_profile: Record<string, unknown> | null = null;
    if (socialPlatform) {
      const ph = handleFrom(socialPlatform, finalUrl);
      social_profile = {
        platform: socialPlatform,
        url: finalUrl,
        handle: ph,
        title: meta(html, 'og:title') || brand.name,
        description: meta(html, 'og:description') || brand.tagline,
      };
      if (ph && !socials.find((s) => s.platform === socialPlatform && s.handle === ph)) {
        socials.unshift({ platform: socialPlatform, url: finalUrl, handle: ph });
      }
    }

    const enriched: Record<string, unknown>[] = [];
    const toEnrich = socials.filter((s) => s.url !== finalUrl).slice(0, 2);
    for (const s of toEnrich) {
      try {
        const r = await fetchHtml(s.url, 6000);
        enriched.push({
          platform: s.platform,
          url: s.url,
          handle: s.handle,
          og_title: meta(r.html, 'og:title'),
          og_description: meta(r.html, 'og:description'),
        });
      } catch (_e) { /* social often login-walled */ }
    }

    return json({
      ok: true,
      input_url: url,
      final_url: finalUrl,
      brand: { name: brand.name, tagline: brand.tagline, logo: brand.logo, colors: brand.colors, platform: brand.platform },
      socials,
      social_profile,
      social_enrichment: enriched,
      contact: { emails: contact.emails, phones: contact.phones },
      content_themes: content.content_themes,
      top_keywords: content.top_keywords,
      business_type: content.business_type,
      booking: bk.booking,
      commerce: bk.commerce,
      fetched_at,
    });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e), input_url: url, fetched_at });
  }
});

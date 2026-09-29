// Pure extraction: these are profile links, never evidence of a connected feed.
const domains = {
  'instagram.com': 'instagram', 'facebook.com': 'facebook',
  'tiktok.com': 'tiktok', 'youtube.com': 'youtube',
  'x.com': 'x', 'twitter.com': 'x', 'linkedin.com': 'linkedin',
  'spotify.com': 'spotify', 'soundcloud.com': 'soundcloud',
  'wa.me': 'whatsapp', 't.me': 'telegram',
};

function decode(value) {
  return value.replace(/&amp;/gi, '&').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
    const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}

export function socialProfile(raw) {
  if (typeof raw !== 'string') return null;
  let url;
  try {
    const value = decode(raw.trim());
    url = new URL(value.startsWith('//') ? 'https:' + value : value);
  } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const domain = Object.keys(domains).find(d => host === d || host.endsWith('.' + d));
  if (!domain) return null;
  const platform = domains[domain];
  const path = url.pathname.replace(/^\/+|\/+$/g, '');
  if (!path || /^(sharer(?:\.php)?|share(?:\.php)?|intent|dialog|plugins|embed|login|home|watch|hashtag|search|tr)(\/|$)/i.test(path)) return null;
  if (platform === 'instagram' && /^(p|reel|reels|stories|explore)(\/|$)/i.test(path)) return null;
  if (platform === 'facebook' && /(?:^|\/)(posts|videos|photos|reel|story\.php|photo\.php)(\/|$)/i.test(path)) return null;
  if (platform === 'x' && /\/status\//i.test(path)) return null;
  if (platform === 'tiktok' && /\/video\//i.test(path)) return null;
  if (platform === 'youtube' && !/^(@[^/]+|(?:channel|c|user)\/[^/]+)\/?$/i.test(path)) return null;
  if (platform === 'linkedin' && !/^(company|in|school)\/[^/]+\/?$/i.test(path)) return null;
  if (platform === 'spotify' && !/^(artist|user)\/[^/]+\/?$/i.test(path)) return null;
  const id = platform === 'facebook' && path.toLowerCase() === 'profile.php' ? url.searchParams.get('id') : null;
  if (path.toLowerCase() === 'profile.php' && (!id || !/^\d+$/.test(id))) return null;
  url.protocol = 'https:';
  url.search = '';
  url.hash = '';
  if (id) url.searchParams.set('id', id);
  return { platform, url: url.toString() };
}

export function extractSocialLinks(doc, sameAs = []) {
  const social = {};
  const sources = new Set();
  const add = (raw, source) => {
    const link = socialProfile(raw);
    if (!link || social[link.platform]) return;
    social[link.platform] = link.url;
    sources.add(source);
  };
  for (const raw of Array.isArray(sameAs) ? sameAs : [sameAs]) add(raw, 'jsonld');
  // Only anchors: asset URLs and embed scripts are not business profiles.
  const html = doc.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = match[0].match(/\s+href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (href) add(href[1] ?? href[2] ?? href[3], 'links');
  }
  return { social, source: [...sources].join('+') };
}

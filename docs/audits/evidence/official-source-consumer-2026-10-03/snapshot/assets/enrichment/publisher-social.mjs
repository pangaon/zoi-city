// Identity scope for already-imported publisher links, not a URL syntax test.
// These exact publisher accounts came from an AGFG restaurant detail page.
// A valid publisher profile must not become the restaurant's own social link.
export function publisherSocial(sourceURL, profileURL) {
  try {
    const source = new URL(sourceURL), profile = new URL(profileURL);
    if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password || source.port) return false;
    if (!['agfg.com.au', 'www.agfg.com.au'].includes(source.hostname.toLowerCase()) || !/^\/restaurant\/[^/]+-\d+\/?$/.test(source.pathname)) return false;
    const host = profile.hostname.toLowerCase(), path = profile.pathname.replace(/\/$/, '').toLowerCase();
    return (['facebook.com', 'www.facebook.com'].includes(host) && path === '/ausgoodfoodguide')
      || (['instagram.com', 'www.instagram.com'].includes(host) && path === '/ausgoodfood');
  } catch { return false; }
}

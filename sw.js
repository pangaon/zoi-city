/* Zoi service worker.
   Deliberately conservative: it caches the shell and the design system so a
   repeat visit paints instantly and a flaky connection still gets a page. It
   never caches API responses or listing HTML — directory data changes hourly and
   a stale listing is worse than a slow one. */
const V = 'zoi-v1';
const SHELL = [
  '/', '/explore', '/assets/zoi-theme.css', '/assets/zoi-theme.js',
  '/assets/zoi-core.js', '/assets/icons/icon-192.png', '/manifest.webmanifest'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Never serve stale data or stale listings.
  if (url.pathname.startsWith('/api/') || /^\/(business|church|professional|organization|creator|event|school|travel-place|venue|sports|artist|vendor)\//.test(url.pathname)) return;
  // Static assets: cache first, they are versioned by content in practice.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(V).then((c) => c.put(e.request, copy)).catch(() => {});
      return r;
    })));
    return;
  }
  // Pages: network first, fall back to cache so an offline visit still renders.
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(V).then((c) => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request)));
});

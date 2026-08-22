// Pure-logic helpers copied from the zoi.city pages (see _launch3/social/index.html)
// so they can be unit-tested without a browser or network.

// esc(): HTML-escape &, <, >, ", ' — the 5-entity variant used on the social/atlas pages.
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

// relTime(): relative timestamp used across pages.
//   < 60s  -> 'just now'
//   < 1h   -> 'Xm'
//   < 24h  -> 'Xh'
//   < 7d   -> 'Xd'
//   else   -> localized date (e.g. 'Aug 22')
// `now` is injectable for deterministic tests.
export function relTime(iso, now = Date.now()) {
  if (!iso) return '';
  const diff = now - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  if (d < 7) return d + 'd';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

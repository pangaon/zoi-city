// Only the public, argument-free country aggregate belongs in this cache.
// Warm-process protection; separate serverless instances do not share entries.
const entries = new Map();
const TTL = 60_000;

export async function publicCountryRead({ endpoint, timeoutMs, load }) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/rest/v1/rpc/explore_countries') throw new Error('invalid public country endpoint');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('invalid country timeout');
  // A short optional read must not impose its deadline on a required hub read.
  const key = url.href + '|' + timeoutMs;
  let entry = entries.get(key);
  if (entry?.value && entry.expires > Date.now()) return structuredClone(entry.value);
  if (!entry?.pending) {
    entry = {};
    entries.set(key, entry);
    entry.pending = Promise.resolve().then(load).then(rows => {
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row.country !== 'string')) {
        throw new Error('invalid public countries response');
      }
      entry.value = structuredClone(rows);
      entry.expires = Date.now() + TTL;
      entry.pending = null;
      return entry.value;
    }).catch(error => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
  }
  return structuredClone(await entry.pending);
}

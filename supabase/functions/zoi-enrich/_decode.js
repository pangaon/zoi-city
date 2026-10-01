// Bounded HTML encoding prescan. Transport declarations and BOM take priority;
// undeclared input retains the worker's UTF-8 default (no language guessing).
function supported(label) {
  try { return new TextDecoder(label).encoding; } catch { return null; }
}
function charset(value) {
  const parts = []; let part = '', quote = '', escaped = false;
  for (const char of String(value || '')) {
    if (escaped) { part += char; escaped = false; continue; }
    if (quote && char === '\\') { part += char; escaped = true; continue; }
    if (quote) { part += char; if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; part += char; continue; }
    if (char === ';') { parts.push(part); part = ''; } else part += char;
  }
  parts.push(part);
  for (const part of parts) {
    const match = /^\s*charset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s;]+))\s*$/i.exec(part);
    if (match) return match[1] !== undefined || match[2] !== undefined
      ? (match[1] ?? match[2]).replace(/\\(.)/g, '$1') : match[3];
  }
}
export function decodeSource(bytes, contentType = '') {
  let encoding = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 'utf-8'
    : bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : null;
  encoding ||= supported(charset(contentType) || 'invalid');
  if (!encoding && /^text\/html(?:\s*;|\s*$)/i.test(contentType)) {
    const head = new TextDecoder('windows-1252').decode(bytes.subarray(0, 1024));
    // Tokenize quoted attributes as a unit, skipping comments and raw-text tags.
    const tokens = /<!--[\s\S]*?(?:-->|$)|<(script|style|title|textarea)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|<[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi;
    for (const match of head.matchAll(tokens)) {
      if (!/^<meta[\s/]/i.test(match[0])) continue;
      const attrs = Object.create(null);
      for (const a of match[0].slice(5, -1).matchAll(/([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        const key = a[1].toLowerCase();
        if (!(key in attrs)) attrs[key] = a[2] ?? a[3] ?? a[4] ?? '';
      }
      let label = attrs.charset;
      if (!label && attrs['http-equiv']?.toLowerCase() === 'content-type') label = charset(attrs.content);
      const found = supported(label || 'invalid');
      if (found) { encoding = /^utf-16/.test(found) ? 'utf-8' : found; break; }
    }
  }
  return new TextDecoder(encoding || 'utf-8').decode(bytes);
}

#!/usr/bin/env node
// New read-only fourteen-record source capture. No lease, writer, mutation or acceptance.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {credentialFindings} from './check-source-credentials.mjs';
const root=resolve(process.argv[2]||'.');
const folder='docs/audits/evidence/source-takeover-fresh14-2026-10-03';
const out=resolve(root,folder,'source-facts');
const input=await readFile(resolve(root,folder,'current-public-records.json'));
const records=JSON.parse(input).rows;
if(records.length!==14||records.some(r=>r.has_owner_user||r.has_owner_workspace))throw Error('current_identity_owner_guard');
const redactPatterns = [
  /AIza[0-9A-Za-z_-]{35}/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
];
function sanitize(value) {
  let text = String(value);
  for (const pattern of redactPatterns) text = text.replace(pattern, '[REDACTED_CREDENTIAL]');
  if (credentialFindings(text).length) throw new Error('sanitization_incomplete');
  return text;
}
async function save(path, data) {
  const bytes = sanitize(JSON.stringify(data, null, 2) + '\n');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
function publicAddress(address) {
  if (address.includes(':')) return !/^(?:0*:|::|f[cd]|fe[89ab]|::ffff:)/i.test(address);
  const p = address.split('.').map(Number);
  return !(p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    p[0] === 169 && p[1] === 254 || p[0] === 172 && p[1] >= 16 && p[1] <= 31 ||
    p[0] === 192 && (p[1] === 168 || p[1] === 0) || p[0] === 100 && p[1] >= 64 && p[1] <= 127 ||
    p[0] === 198 && [18, 19].includes(p[1]));
}
async function safeUrl(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.port || isIP(u.hostname) ||
    !u.hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(u.hostname)) throw new Error('unsafe_url');
  const addresses = await lookup(u.hostname, { all: true });
  if (!addresses.length || addresses.some(x => !publicAddress(x.address))) throw new Error('unsafe_dns');
  return u;
}
function textContent(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|quot|#39|lt|gt);/g, x => ({'&nbsp;':' ', '&amp;':'&', '&quot;':'"', '&#39;':"'", '&lt;':'<', '&gt;':'>'}[x]))
    .replace(/\s+/g, ' ').trim();
}
function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
}
function project(html, finalUrl, name) {
  const title = textContent(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const headings = [...html.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => ({ level: +m[1], text: textContent(m[2]).slice(0, 260) })).slice(0, 40);
  const meta = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(match[0]), key = a.property || a.name;
    if (['description','og:title','og:description','og:url','og:image'].includes(key)) meta[key] = String(a.content || '').slice(0, 600);
  }
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attrs(m[0])).find(a => a.rel === 'canonical')?.href || null;
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => attrs(m[0])).filter(a => a.src && a.alt && a.alt.trim())
    .slice(0, 30).map(a => ({ url: new URL(a.src, finalUrl).href, alt: a.alt.slice(0, 180), width: a.width || null, height: a.height || null }));
  const body = textContent(html);
  const keys = name.toLowerCase().split(/\W+/).filter(x => x.length >= 4);
  const fragments = [];
  for (const key of [...new Set([...keys, 'greek school', 'greek wedding', 'avra miami', 'danforth', 'classical studies', 'modern greek', 'meet dr', 'willow lodge'])]) {
    const index = body.toLowerCase().indexOf(key);
    if (index >= 0) fragments.push({ term: key, excerpt: body.slice(Math.max(0, index - 100), index + 360) });
  }
  const status = [...body.matchAll(/.{0,100}\b(?:closed|closure|relocated|relocation|renamed|rebranded)\b.{0,300}/gi)].slice(0, 8).map(m => m[0]);
  const serviceTerms = ['ancient Greek', 'Southbourne', 'Stein Road', '17945', 'Hartford', 'Greek language', 'Danforth location'];
  const serviceEvidence = serviceTerms.flatMap(term => {
    const i = body.toLowerCase().indexOf(term.toLowerCase());
    return i < 0 ? [] : [{term, excerpt: body.slice(Math.max(0, i - 60), i + 300)}];
  });
  const riskTerms=['casino','kasino','καζίνο','καζινο','judi','togel','slot','jackpot','qq online','live draw','toto macau','game toto','company’s AI','in parallel','domain name','for sale'];
  const risk_excerpts=riskTerms.flatMap(term=>{const index=body.toLowerCase().indexOf(term.toLowerCase());return index<0?[]:[{term,excerpt:body.slice(Math.max(0,index-60),index+240)}];});
  return { title, headings, meta, canonical, images, identity_excerpts: fragments.slice(0, 10), status_excerpts: status, service_excerpts: serviceEvidence, risk_excerpts };
}
const cache = new Map();
async function capture(value, name) {
  if (cache.has(value)) return cache.get(value);
  const start = performance.now(), chain = [], captured_at = new Date().toISOString();
  let current = value;
  try {
    for (let i = 0; i < 5; i++) {
      await safeUrl(current);
      const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'ZoiSourceIdentityReview/1.0 (read-only public source verification)', Accept: 'text/html' } });
      chain.push({ url: current, status: res.status });
      if ([301,302,303,307,308].includes(res.status)) {
        const next = res.headers.get('location');
        await res.body?.cancel();
        if (!next) throw new Error('redirect_without_location');
        current = new URL(next, current).href; continue;
      }
      if (!res.ok || !/text\/html/i.test(res.headers.get('content-type') || '')) {
        await res.body?.cancel();
        throw new Error(`http_${res.status}_or_non_html`);
      }
      const reader = res.body.getReader(); let length = 0; const chunks = [];
      while (true) {
        const part = await reader.read(); if (part.done) break;
        length += part.value.length;
        if (length > 1500000) { await reader.cancel(); throw new Error('body_size_limit'); }
        chunks.push(part.value);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      const findingLocations = credentialFindings(raw); // Never retain original credentials/HTML.
      const html = sanitize(raw);
      const result = { input_url: value, final_url: current, captured_at, chain, elapsed_ms: Math.round(performance.now() - start),
        bytes_received: length, sanitization: { removed_count: findingLocations.length, removed_types: [...new Set(findingLocations.map(x => x.type))], retained_raw_html: false },
        source: project(html, current, name), outcome: 'fetched_identity_requires_human_review' };
      cache.set(value, result); return result;
    }
    throw new Error('redirect_limit');
  } catch (error) {
    const result = { input_url: value, captured_at, chain, elapsed_ms: Math.round(performance.now() - start), error: String(error.message).slice(0, 200), outcome: 'unverified_fetch_failed' };
    cache.set(value, result); return result;
  }
}

await mkdir(out,{recursive:true});
for(let offset=0;offset<records.length;offset+=3){
 await Promise.all(records.slice(offset,offset+3).map(async current=>{
  const row=current.public_record;
  const website=await capture(row.website,row.name);
  const imported=await capture(row.profile?._enrich?.source_url,row.name);
  await save(resolve(out,row.id+'.json'),{id:row.id,name:row.name,family:row.entity_type,current_row_hash:current.row_hash,current_records_sha256:createHash('sha256').update(input).digest('hex'),website,imported_source:imported,no_live_writes:true,no_source_acceptance:true});
  console.log(JSON.stringify({id:row.id,name:row.name,website_status:website.outcome,imported_status:imported.outcome}));
 }));
}

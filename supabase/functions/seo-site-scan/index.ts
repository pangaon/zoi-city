import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { storeReceipt, publicScanError } from "./receipt.ts";
import { vet } from "../zoi-enrich/_ssrf.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;
const MAX_HOPS = 3;
const hits = new Map<string, { start: number; count: number }>();

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control":"private, no-store" } });
}
function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }
function text(doc: string, re: RegExp) { return clean((doc.match(re) || [])[1] || ""); }
function checks(doc: string, url: string, elapsed: number) {
  const title = text(doc, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']+/i.test(doc) || /<meta[^>]+content=["'][^"']+["'][^>]*name=["']description["']/i.test(doc);
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["'][^"']+/i.test(doc);
  const og = /<meta[^>]+property=["']og:title["'][^>]*content=["'][^"']+/i.test(doc) || /<meta[^>]+content=["'][^"']+["'][^>]*property=["']og:title["']/i.test(doc);
  const jsonld = (doc.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length;
  const h1 = /<h1\b/i.test(doc);
  const links = (doc.match(/<a\b[^>]+href=/gi) || []).length;
  return [
    { label: "HTTP response", ok: true, detail: "200 OK" },
    { label: "Title", ok: !!title, detail: title || "Missing <title>" },
    { label: "Meta description", ok: description, detail: description ? "Present" : "Missing meta description" },
    { label: "Canonical URL", ok: canonical, detail: canonical ? "Present" : "Missing canonical link" },
    { label: "Open Graph title", ok: og, detail: og ? "Present" : "Missing og:title" },
    { label: "Structured data", ok: jsonld > 0, detail: `${jsonld} JSON-LD block${jsonld === 1 ? "" : "s"}` },
    { label: "Primary heading", ok: h1, detail: h1 ? "Present" : "Missing <h1>" },
    { label: "Internal links", ok: links > 2, detail: `${links} links found` },
    { label: "Response time", ok: elapsed < 1500, detail: `${elapsed} ms` },
  ];
}
async function fetchPage(start: URL) {
  let url = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url.toString(), {
        redirect: "manual", signal: controller.signal,
        headers: { "User-Agent": "ZoiIntelligenceBot/1.0 (+https://www.zoi.city)" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop === MAX_HOPS) throw new Error("too_many_redirects");
        const next = await vet(new URL(location, url).toString());
        if (!next.url) throw new Error(`redirect_refused:${next.why}`);
        url = next.url;
        continue;
      }
      if (!response.ok) throw new Error(`http_${response.status}`);
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!/html|xhtml/.test(contentType)) throw new Error("not_html");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("empty_response");
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > MAX_BYTES) throw new Error("response_too_large");
        chunks.push(part.value);
      }
      const body = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      return { url: url.toString(), html: new TextDecoder().decode(body) };
    } finally { clearTimeout(timer); }
  }
  throw new Error("too_many_redirects");
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  if(hits.size>=4096){for(const [key,value] of hits){if(now-value.start>3600000)hits.delete(key);}}
  if(hits.size>=4096&&!hits.has(ip))return json({error:'free_scan_capacity_reached'},429);
  const current = hits.get(ip);
  if (!current || now - current.start > 3600000) hits.set(ip, { start: now, count: 1 });
  else if (current.count >= 20) return json({ error: "free_scan_limit_reached", message: "The free test limit is 20 scans per hour." }, 429);
  else current.count++;
  try {
    const inputReader=request.body?.getReader();if(!inputReader)return json({error:'url_required'},400);
    const inputChunks:Uint8Array[]=[];let inputSize=0;
    while(true){const part=await inputReader.read();if(part.done)break;inputSize+=part.value.byteLength;if(inputSize>4096){await inputReader.cancel();return json({error:'request_too_large'},413);}inputChunks.push(part.value);}
    const inputBytes=new Uint8Array(inputSize);let inputOffset=0;for(const chunk of inputChunks){inputBytes.set(chunk,inputOffset);inputOffset+=chunk.byteLength;}
    const body=JSON.parse(new TextDecoder().decode(inputBytes));
    const raw = String(body?.url || "").trim();
    if(raw.length>2048)return json({error:'url_too_long'},400);
    if (!raw) return json({ error: "url_required" }, 400);
    const checked = await vet(raw);
    if (!checked.url) return json({ error: "url_refused", message: "Enter a publicly accessible HTTP or HTTPS website address." }, 400);
    const started = Date.now();
    const page = await fetchPage(checked.url);
    const elapsed = Date.now() - started;
    const report={ ok: true, mode: "free_test", url: page.url, requested_url:checked.url.toString(), checked_at: new Date().toISOString(), checks: checks(page.html, page.url, elapsed) };
    let save_receipt=null;
    try { save_receipt=await storeReceipt(report,ip,{base:Deno.env.get('SUPABASE_URL')||'',key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}); } catch { /* The measured free report remains available; saving is explicitly unavailable. */ }
    return json({...report,save_receipt,save_available:save_receipt!==null});
  } catch (error) {
    return json(publicScanError(error), 422);
  }
});

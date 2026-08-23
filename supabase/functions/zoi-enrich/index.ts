// zoi-enrich — website enrichment worker.
//
// Fetches the website each listing already publishes, extracts what the business
// has already said about itself, and writes it into profile._enrich through
// zoi.enrich_apply. Machine-derived data lands in its own namespace and can
// never overwrite anything an owner typed.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS IS THE SAFE REPLACEMENT FOR UN-STUBBING intake-audit.
//
// intake-audit was closed because it accepted a URL from the caller and fetched
// it — a textbook SSRF surface: point it at 169.254.169.254 and it reads cloud
// instance credentials. Nothing here re-opens that:
//
//   1. NO URL IS EVER ACCEPTED FROM A CALLER. The worker asks the database, via
//      zoi.enrich_queue, which listings are due; the database returns each
//      listing's own registered website. The request body controls batch size
//      and nothing else. This single property removes most of the attack.
//   2. Every URL is validated before a socket is opened: scheme, no embedded
//      credentials, no odd ports, no IP literals, no reserved or internal names.
//   3. Every hostname is resolved and every resulting address is checked against
//      the private, loopback, link-local, CGNAT, multicast and cloud-metadata
//      ranges — for both IPv4 and IPv6, including IPv4-mapped IPv6. If ANY
//      address for a host is blocked, the whole host is refused, so a record set
//      mixing a public and a private address cannot slip through.
//   4. Redirects are followed manually, three hops maximum, and every hop is
//      re-validated and re-resolved. Following redirects automatically is how
//      guarded fetchers still get walked into the metadata service.
//   5. Hard 8s timeout, 1.5MB response cap enforced while streaming, HTML
//      content types only.
//   6. robots.txt is honoured per host. One request per host at a time, plus a
//      global rate limit. Identifying User-Agent with a contact URL.
//   7. Fails closed: no kill switch set, no run.
//
// Residual risk, stated plainly: between resolving a hostname and connecting,
// DNS could change to a private address (rebinding). Closing that fully needs
// connect-time pinning, which fetch() does not expose. REQUIRE_DNS_GUARD=true
// (the default) at least guarantees we never knowingly resolve to a bad address,
// and the queue only ever contains domains an authenticated owner put on their
// own listing.
// ─────────────────────────────────────────────────────────────────────────────
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (provided by the platform)
//   ENRICH_ENABLED=on                        kill switch; anything else = refuse
//   REQUIRE_DNS_GUARD=true|false             default true. false runs with
//                                            name-based checks only. Do not.
//   ENRICH_BATCH=40                          listings per invocation
//
// Schedule hourly alongside the other workers. It is idempotent and resumable:
// zoi.enrich_queue orders by least-recently-checked, so repeated runs spread
// coverage instead of re-fetching the same hosts.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLED = (Deno.env.get("ENRICH_ENABLED") || "").toLowerCase() === "on";
const REQUIRE_DNS = (Deno.env.get("REQUIRE_DNS_GUARD") || "true").toLowerCase() !== "false";
const BATCH = Math.max(1, Math.min(200, Number(Deno.env.get("ENRICH_BATCH") || 40)));

const UA =
  "ZoiDirectoryBot/1.0 (+https://www.zoi.city; enriches a listing from the site " +
  "the business itself published; contact pangaon@gmail.com)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_HOPS = 3;

/* ── supabase ───────────────────────────────────────────────────────────── */
async function sbRpc(fn: string, args: Record<string, unknown> = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

/* ── SSRF guard ─────────────────────────────────────────────────────────────
   Lives in _ssrf.ts so it can be unit-tested against known-dangerous inputs
   rather than reasoned about. See that file's header. */
import { vet, dnsState } from "./_ssrf.ts";

/* ── politeness ─────────────────────────────────────────────────────────── */
const hostBusy = new Map<string, Promise<void>>();
let lastGlobal = 0;

async function globalGap(ms = 120) {
  const wait = lastGlobal + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGlobal = Date.now();
}

/** Serialise per host: never two sockets open to the same server. */
async function perHost<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const prev = hostBusy.get(host) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  hostBusy.set(host, prev.then(() => mine));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (hostBusy.get(host) === mine) hostBusy.delete(host);
  }
}

/* ── fetching ───────────────────────────────────────────────────────────── */

/** GET with a hard timeout and a byte cap enforced while streaming. */
async function getCapped(url: URL, accept: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await globalGap();
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",                 // every hop is re-vetted by hand
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: accept,
        "Accept-Language": "el,en;q=0.8",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return { redirect: loc, status: res.status } as const;
    }
    if (!res.ok) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return { status: res.status } as const;
    }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return { status: res.status, tooBig: true } as const;
    }
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, body: "", ct } as const;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {           // stop paying for a firehose
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
    let off = 0;
    for (const c of chunks) {
      if (off + c.byteLength > buf.length) break;
      buf.set(c, off);
      off += c.byteLength;
    }
    let enc = "utf-8";
    const m = ct.match(/charset=["']?([\w-]+)/);
    if (m) enc = m[1];
    let text = "";
    try {
      text = new TextDecoder(enc, { fatal: false }).decode(buf);
    } catch {
      text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    }
    return { status: res.status, body: text, ct } as const;
  } finally {
    clearTimeout(timer);
  }
}

/** Follow up to MAX_HOPS redirects, re-vetting each destination. */
async function fetchDoc(start: URL) {
  let url = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const r = await perHost(url.hostname, () =>
      getCapped(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1"));
    if ("redirect" in r && r.redirect) {
      if (hop === MAX_HOPS) return { error: "too-many-redirects" };
      let next: URL;
      try {
        next = new URL(r.redirect, url);
      } catch {
        return { error: "bad-redirect" };
      }
      // A redirect is a fresh, untrusted URL. Vet it exactly like the first.
      const v = await vet(next.toString());
      if (!v.url) return { error: `redirect-refused:${v.why}` };
      url = v.url;
      continue;
    }
    if (!("body" in r) || r.body === undefined) {
      return { error: `http${(r as { status?: number }).status ?? 0}` };
    }
    if (!/html|xml/.test(r.ct || "")) return { error: "not-html" };
    return { doc: r.body, finalUrl: url.toString() };
  }
  return { error: "too-many-redirects" };
}

/* ── robots.txt ─────────────────────────────────────────────────────────── */
const robotsCache = new Map<string, string[]>();

async function robotsAllows(u: URL): Promise<boolean> {
  const key = u.origin;
  let rules = robotsCache.get(key);
  if (!rules) {
    rules = [];
    try {
      const r = await perHost(u.hostname, () =>
        getCapped(new URL("/robots.txt", u.origin), "text/plain"));
      if ("body" in r && r.body) {
        // Only the groups that apply to us: our token, then the wildcard.
        let applies = false;
        for (const line of r.body.split(/\r?\n/).slice(0, 3000)) {
          const s = line.replace(/#.*$/, "").trim();
          if (!s) continue;
          const [rawK, ...rest] = s.split(":");
          const k = rawK.trim().toLowerCase();
          const v = rest.join(":").trim();
          if (k === "user-agent") {
            applies = v === "*" || /zoidirectorybot/i.test(v);
          } else if (applies && k === "disallow" && v) {
            rules.push(v);
          }
        }
      }
    } catch {
      rules = [];                                    // unreachable robots = allowed
    }
    robotsCache.set(key, rules);
  }
  const path = u.pathname + (u.search || "");
  for (const dis of rules) {
    if (dis === "/") return false;
    if (path.startsWith(dis)) return false;
  }
  return true;
}

/* ── extraction ─────────────────────────────────────────────────────────── */
// Aggregators describe businesses; they are not the business. Their contact
// details are usable, their branding is not theirs to give away.
const AGGREGATORS = new Set([
  "xo.gr", "vrisko.gr", "wikipedia.org", "en.wikipedia.org", "el.wikipedia.org",
  "facebook.com", "instagram.com", "linkedin.com", "yelp.com", "tripadvisor.com",
  "google.com", "linktr.ee", "youtube.com", "x.com", "twitter.com", "tiktok.com",
]);
const SOCIALS: Record<string, string> = {
  "instagram.com": "instagram", "facebook.com": "facebook", "tiktok.com": "tiktok",
  "youtube.com": "youtube", "x.com": "x", "twitter.com": "x",
  "linkedin.com": "linkedin", "spotify.com": "spotify", "soundcloud.com": "soundcloud",
  "wa.me": "whatsapp", "t.me": "telegram",
};
const DAYS: Record<string, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
  friday: "fri", saturday: "sat", sunday: "sun",
};

const unent = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

function metaTag(doc: string, key: string, attr = "property"): string | null {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const re of [
    new RegExp(`<meta[^>]*${attr}=["']${esc}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${esc}["']`, "i"),
  ]) {
    const m = doc.match(re);
    if (m?.[1]) return unent(m[1]).trim() || null;
  }
  return null;
}

function ldNodes(doc: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc))) {
    let v: unknown;
    try {
      v = JSON.parse(m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "").trim());
    } catch { continue; }
    const stack = [v];
    let guard = 0;
    while (stack.length && guard++ < 400) {
      const cur = stack.pop();
      if (Array.isArray(cur)) stack.push(...cur);
      else if (cur && typeof cur === "object") {
        const o = cur as Record<string, unknown>;
        out.push(o);
        for (const k of ["@graph", "mainEntity", "itemListElement"]) {
          if (o[k]) stack.push(o[k]);
        }
      }
    }
  }
  return out;
}

const digits = (s: string) => (s || "").replace(/\D/g, "");

function extract(doc: string, finalUrl: string) {
  const host = new URL(finalUrl).hostname.toLowerCase().replace(/^www\./, "");
  const isAgg = AGGREGATORS.has(host);
  const profile: Record<string, unknown> = {};
  const provenance: Record<string, string> = {};
  const put = (k: string, v: unknown, src: string) => {
    if (v === null || v === undefined || v === "" ||
        (Array.isArray(v) && !v.length) ||
        (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length)) return;
    if (k in profile) return;                       // first, most-trusted wins
    profile[k] = v;
    provenance[k] = src;
  };

  const biz = ldNodes(doc).find((n) => {
    const t = Array.isArray(n["@type"]) ? (n["@type"] as string[]).join(" ") : String(n["@type"] ?? "");
    return /LocalBusiness|Restaurant|Store|Hotel|Church|Organization|Dentist|Physician|Attorney|School|Cafe|Bakery|FoodEstablishment|ProfessionalService|TouristAttraction|MusicGroup|SportsTeam|NGO/i.test(t);
  });

  if (biz) {
    if (typeof biz.description === "string") put("description", unent(biz.description).trim().slice(0, 1200), "jsonld");
    if (typeof biz.slogan === "string") put("tagline", biz.slogan.trim().slice(0, 160), "jsonld");
    if (typeof biz.telephone === "string" && digits(biz.telephone).length >= 7) put("phone", biz.telephone.trim(), "jsonld");
    if (typeof biz.email === "string" && biz.email.includes("@")) put("email", biz.email.replace("mailto:", "").trim(), "jsonld");
    if (typeof biz.priceRange === "string") put("price_range", biz.priceRange.trim().slice(0, 12), "jsonld");

    const spec = biz.openingHoursSpecification;
    const specs = Array.isArray(spec) ? spec : spec ? [spec] : [];
    const hours: { day: string; open: string; close: string }[] = [];
    for (const sp of specs as Record<string, unknown>[]) {
      const days = Array.isArray(sp?.dayOfWeek) ? sp.dayOfWeek : sp?.dayOfWeek ? [sp.dayOfWeek] : [];
      const o = String(sp?.opens ?? "").slice(0, 5);
      const c = String(sp?.closes ?? "").slice(0, 5);
      for (const d of days as string[]) {
        const key = DAYS[String(d).split("/").pop()!.toLowerCase()];
        if (key && o && c && !hours.some((h) => h.day === key)) hours.push({ day: key, open: o, close: c });
      }
    }
    put("hours", hours, "jsonld");

    const addr = biz.address as Record<string, unknown> | undefined;
    if (addr && typeof addr === "object") {
      const a: Record<string, string> = {};
      for (const [k, v] of [["street", "streetAddress"], ["city", "addressLocality"],
                            ["region", "addressRegion"], ["postcode", "postalCode"],
                            ["country", "addressCountry"]]) {
        if (addr[v]) a[k] = String(addr[v]).trim().slice(0, 120);
      }
      put("address_parts", a, "jsonld");
    }
    const geo = biz.geo as Record<string, unknown> | undefined;
    if (geo) {
      const lat = Number(geo.latitude), lng = Number(geo.longitude);
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
          !(lat === 0 && lng === 0)) {
        put("geo", { lat: +lat.toFixed(6), lng: +lng.toFixed(6) }, "jsonld");
      }
    }
    let img = biz.image ?? biz.logo;
    if (Array.isArray(img)) img = img[0];
    if (img && typeof img === "object") img = (img as Record<string, unknown>).url;
    if (typeof img === "string" && img.startsWith("https://")) put("photo_url", img, "jsonld");
  }

  if (!isAgg) {
    put("tagline", metaTag(doc, "og:site_name"), "og");
    put("description", (metaTag(doc, "og:description") || metaTag(doc, "description", "name") || "").slice(0, 1200), "og");
    const im = metaTag(doc, "og:image");
    if (im && im.startsWith("https://")) put("photo_url", im, "og");
  }

  const tel = [...doc.matchAll(/tel:([+\d][\d().\s\-\/]{6,24})/gi)]
    .map((m) => m[1].trim()).filter((p) => digits(p).length >= 7 && digits(p).length <= 15);
  if (tel.length) put("phone", tel[0], "tel-link");
  const mail = [...doc.matchAll(/mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/gi)]
    .map((m) => m[1]).filter((e) => !/example\.|sentry|wixpress/i.test(e));
  if (mail.length) put("email", mail[0], "mailto-link");

  const social: Record<string, string> = {};
  for (const m of doc.matchAll(/href=["'](https?:\/\/[^"'>\s]+)["']/gi)) {
    let h = "", path = "";
    try {
      const u = new URL(unent(m[1]));
      h = u.hostname.toLowerCase().replace(/^www\./, "");
      path = u.pathname.replace(/^\/|\/$/g, "");
    } catch { continue; }
    for (const [dom, name] of Object.entries(SOCIALS)) {
      if (h !== dom && !h.endsWith("." + dom)) continue;
      if (!path || /^(sharer|share|intent|dialog|plugins|embed|login|home|watch|hashtag|search|profile\.php|tr)(\/|$)/i.test(path)) break;
      if (!social[name]) social[name] = unent(m[1]).split("?")[0].slice(0, 220);
      break;
    }
  }
  put("social", social, "links");

  for (const m of doc.matchAll(/href=["']([^"'>\s]+)["'][^>]*>([\s\S]{0,90}?)<\/a>/gi)) {
    const label = unent(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().toLowerCase();
    let abs = "";
    try { abs = new URL(m[1], finalUrl).toString(); } catch { continue; }
    if (!/^https?:/.test(abs)) continue;
    for (const [re, key] of [
      [/\b(book|reserve|reservation|κράτηση|ραντεβού)\b/, "booking_url"],
      [/\b(menu|μενού|κατάλογος)\b/, "menu_url"],
      [/\b(order|delivery|παραγγελ)\b/, "order_url"],
      [/\b(donate|δωρεά|stewardship)\b/, "give_url"],
    ] as [RegExp, string][]) {
      if (re.test(label)) put(key, abs.slice(0, 240), "page-link");
    }
  }

  const lang = doc.match(/<html[^>]+lang=["']([a-zA-Z\-]{2,8})["']/);
  if (lang) put("site_lang", lang[1].toLowerCase(), "html-lang");

  return { profile, provenance, aggregator: isAgg, host };
}

/* ── caller authentication ──────────────────────────────────────────────────
   Security must not depend on a deploy flag. Deployed with --no-verify-jwt this
   endpoint would otherwise be an open crawl trigger: anyone could make Zoi fetch
   other people's websites on demand, repeatedly, from our address and under our
   User-Agent. That is our reputation and our egress, not theirs to spend.

   So the worker checks for itself. Only the service role key gets in, which is
   what the scheduler already has. */
function timingSafeEqual(a: string, b: string): boolean {
  // Same length check first is unavoidable; the loop below then does not
  // short-circuit on the first differing byte.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorised(req: Request): boolean {
  const raw = req.headers.get("authorization") || "";
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if (!token || !SERVICE) return false;
  return timingSafeEqual(token, SERVICE);
}

/* ── the run ────────────────────────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (!authorised(req)) {
    return new Response(
      JSON.stringify({ ok: false, error: "unauthorised" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!ENABLED) {
    // Fail closed, like the other six side-effect functions.
    return new Response(
      JSON.stringify({ ok: false, error: "ENRICH_ENABLED is not 'on' — refusing to run" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let limit = BATCH;
  try {
    const b = await req.json();
    // The ONLY thing a caller may influence. Never a URL.
    if (b && typeof b.limit === "number") limit = Math.max(1, Math.min(200, Math.floor(b.limit)));
  } catch { /* no body is fine */ }

  const started = Date.now();
  const stats: Record<string, number> = {};
  const bump = (k: string) => (stats[k] = (stats[k] || 0) + 1);
  const batch: Record<string, unknown>[] = [];

  let queue: { slug: string; website: string }[] = [];
  try {
    queue = (await sbRpc("enrich_queue", { p_limit: limit })) ?? [];
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: `enrich_queue: ${String(e).slice(0, 200)}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  for (const row of queue) {
    if (Date.now() - started > 110_000) { bump("stopped-time-budget"); break; }

    const v = await vet(row.website);
    if (!v.url) {
      bump("refused:" + v.why);
      // Record the refusal so the queue stops returning it every hour.
      batch.push({ slug: row.slug, website: row.website,
                   profile: { blocked: "true", blocked_reason: v.why } , provenance: {} });
      continue;
    }
    try {
      if (!(await robotsAllows(v.url))) {
        bump("robots-disallow");
        batch.push({ slug: row.slug, website: v.url.toString(),
                     profile: { blocked: "true", blocked_reason: "robots" }, provenance: {} });
        continue;
      }
      const got = await fetchDoc(v.url);
      if ("error" in got && got.error) {
        bump(got.error);
        // 403/404 mean this host will not talk to a declared bot. Stop asking.
        const permanent = /^http(40[134]|41[0-9]|45[0-9])$/.test(got.error);
        batch.push({ slug: row.slug, website: v.url.toString(),
                     profile: permanent
                       ? { blocked: "true", blocked_reason: got.error }
                       : { last_error: got.error },
                     provenance: {} });
        continue;
      }
      const { profile, provenance, aggregator } = extract(got.doc!, got.finalUrl!);
      if (aggregator) {
        for (const k of ["tagline", "description", "photo_url"]) {
          delete profile[k]; delete provenance[k];
        }
      }
      if (!Object.keys(profile).length) { bump("nothing-usable"); continue; }
      for (const k of Object.keys(profile)) bump("field:" + k);
      bump("ok");
      batch.push({ slug: row.slug, website: got.finalUrl, profile, provenance });
    } catch (e) {
      bump("error:" + String(e).slice(0, 40));
    }
  }

  let applied = 0;
  if (batch.length) {
    try {
      const res = await sbRpc("enrich_apply", { p_batch: batch });
      applied = Array.isArray(res) ? res.length : batch.length;
    } catch (e) {
      return new Response(JSON.stringify({
        ok: false, error: `enrich_apply: ${String(e).slice(0, 200)}`,
        queued: queue.length, stats,
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({
    ok: true, queued: queue.length, applied,
    dns_guard: dnsState() === null ? "unused" : dnsState() ? "enforced" : "unavailable",
    ms: Date.now() - started, stats,
  }, null, 1), { headers: { "Content-Type": "application/json" } });
});

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
//      or selects at most three stored listing IDs for an authorized canary.
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
// (the default) at least guarantees we never knowingly resolve to a bad address.
//
// THAT RISK GREW WHEN SELF-SERVE INTAKE SHIPPED (migration 0038).
// This paragraph used to end "and the queue only ever contains domains an
// authenticated owner put on their own listing", which was the reason rebinding
// was tolerable: every domain in the queue belonged to someone who had already
// proven they controlled the listing. public.intake_submit now lets any signed-in
// account put an arbitrary domain in the queue, so an attacker can choose the
// hostname we resolve. The chain is: register a domain, answer the first lookup
// with a public address and the second with an internal one, submit it.
//
// What still stands in the way, and what does not:
//   - the content-type gate rejects anything that is not html/xml, which rules
//     out the EC2, GCP and Azure metadata services (text/plain and json)
//   - it does NOT rule out an internal service that serves HTML — a CI server,
//     a dashboard, a router admin page
//   - public.intake_status returns a fixed projection of business fields, so a
//     rebound page cannot be read back out through the product
//
// The application cannot close this on its own. The fix is network egress
// control: run this worker where RFC1918, 127/8, 169.254/16, and the IPv6
// equivalents are not routable, so a rebind resolves to an address the host
// physically cannot reach. Until that exists, treat intake-sourced domains as
// the lower-trust tier they are.
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

import { inspectSourceDocument } from './_document-quality.js';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLED = (Deno.env.get("ENRICH_ENABLED") || "").toLowerCase() === "on";
const REQUIRE_DNS = (Deno.env.get("REQUIRE_DNS_GUARD") || "true").toLowerCase() !== "false";
const BATCH = Math.max(1, Math.min(200, Number(Deno.env.get("ENRICH_BATCH") || 40)));
// A dedicated shared secret, so authentication does not depend on which flavour
// of service key the platform happens to inject. Projects on the newer API-key
// system have several, and SUPABASE_SERVICE_ROLE_KEY is not necessarily the one
// a caller has to hand — comparing against it alone produced a 401 on a
// perfectly legitimate call from pg_cron.
const ENRICH_TOKEN = Deno.env.get("ENRICH_TOKEN") || "";

const UA =
  "ZoiDirectoryBot/1.0 (+https://www.zoi.city; enriches a listing from the site " +
  "the business itself published; contact pangaon@gmail.com)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_HOPS = 3;

/* ── supabase ───────────────────────────────────────────────────────────── */
const INVOCATION_MS = 110_000;
const RPC_MS = 15_000;
function assertDeadline(deadline: number) {
  if (Date.now() >= deadline) throw new Error("invocation_deadline_exceeded");
}
async function boundedIO<T>(deadline: number, maximumMs: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  assertDeadline(deadline);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("operation_deadline_exceeded")); }, Math.min(maximumMs, deadline - Date.now()));
  });
  try { return await Promise.race([expiry, work(controller.signal)]); }
  finally { clearTimeout(timer!); controller.abort(); }
}
async function sbRpc(fn: string, args: Record<string, unknown> = {}, deadline = Date.now() + RPC_MS) {
  return await boundedIO(deadline, RPC_MS, async signal => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST", signal,
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    // Body consumption shares the same deadline as connection/headers.
    const t = await r.text();
    if (!r.ok) throw new Error(`${fn}: ${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  });
}

/* ── SSRF guard ─────────────────────────────────────────────────────────────
   Lives in _ssrf.ts so it can be unit-tested against known-dangerous inputs
   rather than reasoned about. See that file's header. */
import { vet, dnsState } from "./_ssrf.ts";
import { extractSocialLinks } from "./_social.js";
import { extractPublicMedia } from "./_media.js";
import { memberLeaseGuard } from "./_member.js";
import { extractStructuredMenu } from "./_menus.js";
import { extractSiteImages, supplementaryPages, imageIdentity } from "./_images.js";
import { confirmedEnrichmentReceipts, enrichmentSample } from "./_receipts.js";

/* ── politeness ─────────────────────────────────────────────────────────── */
const hostBusy = new Map<string, Promise<void>>();
let lastGlobal = 0;

async function globalGap(ms = 120) {
  const wait = lastGlobal + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGlobal = Date.now();
}

/** Serialise per host: never two sockets open to the same server. */
async function perHost<T>(host: string, fn: () => Promise<T>, deadline = Infinity): Promise<T> {
  const prev = hostBusy.get(host) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  const tail = prev.then(() => mine);
  hostBusy.set(host, tail);
  void tail.then(() => { if (hostBusy.get(host) === tail) hostBusy.delete(host); });
  try {
    await boundedIO(deadline, INVOCATION_MS, () => prev);
    assertDeadline(deadline);
    return await fn();
  } finally {
    release();
  }
}

/* ── fetching ───────────────────────────────────────────────────────────── */

/** GET with a hard timeout and a byte cap enforced while streaming. */
async function getCapped(url: URL, accept: string, deadline = Infinity) {
  return await boundedIO(deadline, TIMEOUT_MS, async signal => {
    await globalGap();
    assertDeadline(deadline);
    signal.throwIfAborted();
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",                 // every hop is re-vetted by hand
      signal,
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
  });
}

/** Follow up to MAX_HOPS redirects, re-vetting each destination. */
async function fetchDoc(start: URL, deadline = Infinity) {
  let url = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const r = await perHost(url.hostname, () =>
      getCapped(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", deadline), deadline);
    if ("redirect" in r && r.redirect) {
      if (hop === MAX_HOPS) return { error: "too-many-redirects" };
      let next: URL;
      try {
        next = new URL(r.redirect, url);
      } catch {
        return { error: "bad-redirect" };
      }
      // A redirect is a fresh, untrusted URL. Vet it exactly like the first.
      const v = await boundedIO(deadline, TIMEOUT_MS, () => vet(next.toString(), Math.min(deadline, Date.now() + TIMEOUT_MS)));
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

async function robotsAllows(u: URL, deadline = Infinity): Promise<boolean> {
  assertDeadline(deadline);
  const key = u.origin;
  let rules = robotsCache.get(key);
  if (!rules) {
    rules = [];
    try {
      const r = await perHost(u.hostname, () =>
        getCapped(new URL("/robots.txt", u.origin), "text/plain", deadline), deadline);
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
      assertDeadline(deadline);
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
const DAYS: Record<string, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
  friday: "fri", saturday: "sat", sunday: "sun",
};

const unent = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

// Match the opening quote with its closing quote; apostrophes inside double
// quoted attributes (and double quotes inside single quoted ones) are content.
function quotedAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([^\s=<>]+)\s*=\s*("[^"]*"|'[^']*')/g)) {
    const key = match[1].toLowerCase();
    if (!(key in attrs)) attrs[key] = unent(match[2].slice(1, -1));
  }
  return attrs;
}
function metaTag(doc: string, key: string, attr = "property"): string | null {
  for (const match of doc.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attrs = quotedAttributes(match[0]);
    if (attrs[attr]?.toLowerCase() === key.toLowerCase()) return attrs.content?.trim() || null;
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
  const isAgg = [...AGGREGATORS].some(domain => host === domain || host.endsWith("." + domain));
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

  if (!isAgg) {
    const structuredMenu = extractStructuredMenu(doc, finalUrl);
    if (structuredMenu) for (const [key, value] of Object.entries(structuredMenu)) put(key, value, (structuredMenu.menu_source_format === "schema.org" ? "jsonld-menu:" : "html-product-menu:") + finalUrl);
  }

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
    if (typeof biz.servesCuisine === "string") put("cuisine", biz.servesCuisine.trim().slice(0, 100), "jsonld");
    else if (Array.isArray(biz.servesCuisine)) put("cuisine", (biz.servesCuisine as string[]).slice(0, 5).join(", "), "jsonld");

    if (typeof biz.hasMenu === "string" && biz.hasMenu.startsWith("http")) put("menu_url", biz.hasMenu.trim(), "jsonld");
    if (typeof biz.menu === "string" && biz.menu.startsWith("http")) put("menu_url", biz.menu.trim(), "jsonld");
    if (typeof biz.acceptsReservations === "string" && biz.acceptsReservations.startsWith("http")) put("booking_url", biz.acceptsReservations.trim(), "jsonld");
  }

  if (!isAgg) {
    put("tagline", metaTag(doc, "og:site_name"), "og");
    put("description", (metaTag(doc, "og:description") || metaTag(doc, "description", "name") || "").slice(0, 1200), "og");
    const imagery = extractSiteImages(doc, finalUrl, biz || {});
    // A successful current crawl replaces only machine imagery, including stale bad fallbacks.
    for (const key of ["logo_url", "photo_url", "hero_url"]) profile[key] = null;
    profile.photo_urls = [];
    if (imagery.logo) { profile.logo_url = imagery.logo.url; provenance.logo_url = imagery.logo.source; }
    if (imagery.hero) {
      profile.photo_url = imagery.hero.url; profile.hero_url = imagery.hero.url;
      provenance.photo_url = imagery.hero.source; provenance.hero_url = imagery.hero.source;
    }
    if (imagery.photos.length) { profile.photo_urls = imagery.photos.map(p => p.url); provenance.photo_urls = "deduplicated-site-images"; }
    if (imagery.menuImages.length) { profile.menu_image_urls = imagery.menuImages.map(p => p.url); provenance.menu_image_urls = "source-menu-images"; }

  }

  const tel = [...doc.matchAll(/tel:([+\d][\d().\s\-\/]{6,24})/gi)]
    .map((m) => m[1].trim()).filter((p) => digits(p).length >= 7 && digits(p).length <= 15);
  if (tel.length) put("phone", tel[0], "tel-link");
  const contactDoc = doc.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<([a-z][\w:-]*)\b[^>]*(?:\shidden(?:\s|=|>)|aria-hidden\s*=\s*["']true["']|style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden))[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const mail = [...new Set([...contactDoc.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)]
    .filter(m => !/\bhidden(?:\s|=|>)/i.test(m[0]) && !/aria-hidden\s*=\s*["']true/i.test(m[0]))
    .map(m => quotedAttributes(m[0]).href || "")
    .map(href => href.match(/^mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})(?:\?|$)/i)?.[1]?.toLowerCase())
    .filter((email): email is string => !!email && !/example\.|sentry|wixpress/i.test(email)))];
  const structuredEmail = typeof profile.email === "string" ? profile.email.toLowerCase() : null;
  // Disagreement is evidence for review, not permission to pick the first link
  // (which may belong to a site designer or another location).
  profile.email_conflict = null;
  if ((structuredEmail && mail.some(email => email !== structuredEmail)) || (!structuredEmail && mail.length > 1)) {
    profile.email = null;
    profile.email_conflict = { structured: structuredEmail, linked: mail, source_url: finalUrl };
    provenance.email = "conflicting-source-emails";
    provenance.email_conflict = "jsonld-and-anchor-review:" + finalUrl;
  } else if (mail.length === 1) put("email", mail[0], "mailto-link");

  const { social, source: socialSource } = extractSocialLinks(doc, biz?.sameAs);
  put("social", social, socialSource);

  for (const m of doc.matchAll(/href=["']([^"'>\s]+)["'][^>]*>([\s\S]{0,90}?)<\/a>/gi)) {
    const label = unent(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().toLowerCase();
    let abs = "";
    try { abs = new URL(m[1], finalUrl).toString(); } catch { continue; }
    if (!/^https?:/.test(abs)) continue;
    for (const [re, key] of [
      [/\b(book|reserve|reservation|κράτηση|ραντεβού)\b/, "booking_url"],
      [/\b(menu|speisekarte|speisen|μενού|κατάλογος)\b/, "menu_url"],
      [/\b(order|delivery|παραγγελ)\b/, "order_url"],
      [/\b(donate|δωρεά|stewardship)\b/, "give_url"],
    ] as [RegExp, string][]) {
      if (re.test(label)) put(key, abs.slice(0, 240), "page-link");
    }
  }

  const media = extractPublicMedia(doc);
  put("listen", media.listen, "page-media-link");
  put("embeds", media.embeds, "page-media-link");
  put("video_urls", media.video_urls, "page-media-link");

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
  const bearer = raw.replace(/^Bearer\s+/i, "").trim();
  const header = (req.headers.get("x-enrich-token") || "").trim();
  // Accept the dedicated secret from either header, or the service role key.
  // Every branch is a constant-time compare and an empty expected value can
  // never match, so a missing secret does not open the door.
  for (const supplied of [bearer, header]) {
    if (!supplied) continue;
    if (ENRICH_TOKEN && timingSafeEqual(supplied, ENRICH_TOKEN)) return true;
    if (SERVICE && timingSafeEqual(supplied, SERVICE)) return true;
  }
  return false;
}

/* ── the run ────────────────────────────────────────────────────────────── */
Deno.serve(async (req) => {
  const started = Date.now();
  const deadline = started + INVOCATION_MS;
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
  let sample: string[] | null = null;
  try {
    const b = await boundedIO(deadline, RPC_MS, () => req.json());
    // Caller can bound the batch or select max3 existing listing IDs. Never a URL.
    if (b?.sample_ids !== undefined) sample = enrichmentSample(b.sample_ids);
    if (b && typeof b.limit === "number") limit = Math.max(1, Math.min(200, Math.floor(b.limit)));
  } catch (e) {
    if (req.body !== null) return new Response(JSON.stringify({ok:false,error:e instanceof Error && e.message === "invalid_enrichment_sample" ? e.message : "invalid_enrichment_request"}), {status:400,headers:{"Content-Type":"application/json"}});
  }

  const stats: Record<string, number> = {};
  const bump = (k: string) => (stats[k] = (stats[k] || 0) + 1);
  const batch: Record<string, unknown>[] = [];

  let queue: { slug: string; website: string; lease_id: string; name?: string; entity_type?: string; existing_enrich?: Record<string, unknown> }[] = [];
  try {
    queue = (sample ? await sbRpc("enrich_sample_lease", {p_ids:sample}, deadline) : await sbRpc("enrich_queue_lease", { p_limit: limit }, deadline)) ?? [];
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: `enrich_queue_lease: ${String(e).slice(0, 200)}`, outcome: "unknown", reconciliation_required: true }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  for (const row of queue) {
    if (Date.now() >= deadline - RPC_MS) { bump("stopped-time-budget"); break; }

    const identity = memberLeaseGuard(row);
    const identityStatus = identity.handled ? identity.profile : {};
    let v;
    try { v = await boundedIO(deadline - RPC_MS, TIMEOUT_MS, () => vet(row.website, Math.min(deadline - RPC_MS, Date.now() + TIMEOUT_MS))); }
    catch { bump("stopped-time-budget"); break; }
    if (!v.url) {
      bump("refused:" + v.why);
      // Record the refusal so the queue stops returning it every hour.
      batch.push({ slug: row.slug, website: row.website, lease_id: row.lease_id,
                   profile: { ...identityStatus, crawl_status: "error", last_error: "refused:" + v.why, blocked: "true", blocked_reason: v.why } , provenance: {} });
      continue;
    }
    try {
      if (!(await robotsAllows(v.url, deadline - RPC_MS))) {
        bump("robots-disallow");
        batch.push({ slug: row.slug, website: v.url.toString(), lease_id: row.lease_id,
                     profile: { ...identityStatus, crawl_status: "error", last_error: "robots", blocked: "true", blocked_reason: "robots" }, provenance: {} });
        continue;
      }
      const got = await fetchDoc(v.url, deadline - RPC_MS);
      if ("error" in got && got.error) {
        bump(got.error);
        // 403/404 mean this host will not talk to a declared bot. Stop asking.
        const permanent = /^http(40[134]|41[0-9]|45[0-9])$/.test(got.error);
        batch.push({ slug: row.slug, website: v.url.toString(), lease_id: row.lease_id,
                     profile: permanent
                       ? { ...identityStatus, crawl_status: "error", last_error: got.error, blocked: "true", blocked_reason: got.error }
            : { ...identityStatus, crawl_status: "error", last_error: got.error },
                     provenance: {} });
        continue;
      }
      // Preserve existing machine evidence on a JS-only shell. Generic title/meta
      // text does not prove a successful crawl and must not clear a prior gallery.
      const documentState = inspectSourceDocument(got.doc!);
      if (documentState.source_state === "source_challenge") {
        bump("source-challenge");
        batch.push({ slug: row.slug, website: got.finalUrl, lease_id: row.lease_id,
          profile: { ...identityStatus, crawl_status: "error", last_error: "source_challenge" },
          provenance: {} });
        continue;
      }
      if (documentState.requires_rendering) {
        bump("javascript-render-required");
        batch.push({ slug: row.slug, website: got.finalUrl, lease_id: row.lease_id,
          profile: { ...identityStatus, crawl_status: "error", last_error: "javascript_render_required" },
          provenance: {} });
        continue;
      }
      const member = memberLeaseGuard(row, got.doc!, got.finalUrl!);
      if (member.handled) {
        bump(member.profile?.last_error === "source_scope_mismatch" ? "source-scope-mismatch" : member.profile && "member" in member.profile ? "member-identity-matched" : "member-review-required");
        batch.push({ slug: row.slug, website: got.finalUrl, lease_id: row.lease_id, profile: member.profile, provenance: member.provenance });
        continue; // Never run generic metadata or supplementary crawls for a person on a member source.
      }
      const { profile, provenance, aggregator } = extract(got.doc!, got.finalUrl!);
      if (!aggregator) {
        // At most two explicit same-origin pages (menu first); each keeps robots, DNS, redirect,
        // byte and timeout guards. No search-engine discovery or guessed URLs.
        for (const page of supplementaryPages(got.doc!, got.finalUrl!)) {
          if (Date.now() - started > 90_000) break;
          if (page.purpose === "menu" && Array.isArray(profile.menu) && profile.menu.length) continue;
          if (page.purpose === "gallery" && Array.isArray(profile.photo_urls) && profile.photo_urls.length >= 6) continue;
          if (page.purpose === "contact" && profile.phone && profile.email && Object.keys((profile.social || {}) as object).length >= 2) continue;
          const pageVet = await boundedIO(deadline - RPC_MS, TIMEOUT_MS, () => vet(page.url, Math.min(deadline - RPC_MS, Date.now() + TIMEOUT_MS)));
          if (!pageVet.url) { bump("supplement-refused"); continue; }
          const pageUrl = pageVet.url;
          if (!(await robotsAllows(pageUrl, deadline - RPC_MS))) continue;
          const extra = await fetchDoc(pageUrl, deadline - RPC_MS);
          if (!extra.doc || !extra.finalUrl || new URL(extra.finalUrl).origin !== new URL(got.finalUrl!).origin) { bump("supplement-unavailable"); continue; }
          const next = extract(extra.doc, extra.finalUrl);
          for (const key of ["phone", "email", "logo_url", "photo_url", "hero_url", "menu_url", "booking_url", "menu", "menu_source", "menu_source_format"]) {
            if (key === "email" && (profile.email_conflict || next.profile.email_conflict)) {
              profile.email = null; profile.email_conflict = profile.email_conflict || next.profile.email_conflict; provenance.email = "conflicting-source-emails"; provenance.email_conflict = provenance.email_conflict || next.provenance.email_conflict; continue;
            }
            if (!profile[key] && next.profile[key]) { profile[key] = next.profile[key]; provenance[key] = next.provenance[key] + ":" + extra.finalUrl; }
          }
          profile.social = { ...(next.profile.social || {}) as object, ...(profile.social || {}) as object };
          if (next.profile.social) provenance.social = "same-origin-pages";
          const photos = [...(Array.isArray(profile.photo_urls) ? profile.photo_urls : []), ...(Array.isArray(next.profile.photo_urls) ? next.profile.photo_urls : [])];
          const keys = new Set(); profile.photo_urls = photos.filter(u => { const key = imageIdentity(u); if (keys.has(key)) return false; keys.add(key); return true; }).slice(0, 12);
          if ((profile.photo_urls as string[]).length) provenance.photo_urls = "same-origin-pages";
          bump("supplement:" + page.purpose);
        }
      }
      if (aggregator) {
        for (const k of ["tagline", "description", "photo_url", "hero_url", "logo_url", "photo_urls"]) {
          profile[k] = k === "photo_urls" ? [] : null; provenance[k] = "aggregator-branding-excluded";
        }
      }
      if (!Object.keys(profile).length) {
        bump("nothing-usable");
        batch.push({ slug: row.slug, website: got.finalUrl, lease_id: row.lease_id,
          profile: { crawl_status: "checked_no_data" }, provenance: {} });
        continue;
      }
      for (const k of Object.keys(profile)) bump("field:" + k);
      bump("ok");
      batch.push({ slug: row.slug, website: got.finalUrl, lease_id: row.lease_id, profile, provenance });
    } catch (e) {
      const error = String(e).slice(0, 160);
      bump("error:" + error.slice(0, 40));
      batch.push({ slug: row.slug, website: v.url.toString(), lease_id: row.lease_id,
        profile: { ...identityStatus, crawl_status: "error", last_error: error }, provenance: {} });
    }
  }

  let applied = 0;
  if (batch.length) {
    if (Date.now() >= deadline) return new Response(JSON.stringify({
      ok: false, error: "invocation_deadline_exceeded", outcome: "not_attempted",
      queued: queue.length, reconciliation_required: true,
      leases: batch.map(row => ({slug: row.slug, lease_id: row.lease_id})),
    }), {status: 503, headers: {"Content-Type": "application/json"}});
    try {
      const res = await sbRpc("enrich_apply", { p_batch: batch }, deadline);
      const receipt = confirmedEnrichmentReceipts(batch, res);
      applied = receipt.applied;
      if (receipt.rejected) stats["lease-rejected"] = receipt.rejected;
    } catch (e) {
      return new Response(JSON.stringify({
        ok: false, error: `enrich_apply: ${String(e).slice(0, 200)}`,
        queued: queue.length, stats, outcome: "unknown", reconciliation_required: true,
        leases: batch.map(row => ({slug: row.slug, lease_id: row.lease_id})),
      }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({
    ok: !stats["lease-rejected"] && (!sample || queue.length === sample.length), queued: queue.length, applied,
    unprocessed: queue.length - batch.length, sample_requested: sample?.length ?? null,
    dns_guard: dnsState() === null ? "unused" : dnsState() ? "enforced" : "unavailable",
    ms: Date.now() - started, stats,
  }, null, 1), { headers: { "Content-Type": "application/json" } });
});

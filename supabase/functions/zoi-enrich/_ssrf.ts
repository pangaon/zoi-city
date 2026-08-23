// _ssrf.ts — the SSRF guard for zoi-enrich, kept separate so it can be tested.
//
// intake-audit was stubbed because it fetched a URL handed to it by a caller.
// This module is the reason its replacement is safe. Every function here is
// pure except hostAddressesSafe, which resolves DNS.
//
// Tested by _ssrf_test.ts — run: deno test --allow-net supabase/functions/zoi-enrich/
// The table-level invariants are additionally asserted from the Node suite in
// tests/unit/ssrf.test.mjs, so CI catches a deleted range without needing Deno.

const REQUIRE_DNS = (Deno.env.get("REQUIRE_DNS_GUARD") || "true").toLowerCase() !== "false";

export const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],        // this network
  ["10.0.0.0", 8],       // private
  ["100.64.0.0", 10],    // carrier NAT
  ["127.0.0.0", 8],      // loopback
  ["169.254.0.0", 16],   // link-local — includes 169.254.169.254 metadata
  ["172.16.0.0", 12],    // private
  ["192.0.0.0", 24],     // IETF protocol assignments
  ["192.0.2.0", 24],     // documentation
  ["192.88.99.0", 24],   // 6to4 relay anycast
  ["192.168.0.0", 16],   // private
  ["198.18.0.0", 15],    // benchmarking
  ["198.51.100.0", 24],  // documentation
  ["203.0.113.0", 24],   // documentation
  ["224.0.0.0", 4],      // multicast
  ["240.0.0.0", 4],      // reserved
];

export const RESERVED_SUFFIX = [
  ".local", ".localhost", ".internal", ".intranet", ".lan", ".home",
  ".home.arpa", ".corp", ".private", ".test", ".example", ".invalid", ".onion",
];
export const RESERVED_NAMES = new Set([
  "localhost", "metadata", "metadata.google.internal",
  "instance-data", "169.254.169.254",
]);

export function v4ToInt(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const part of p) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = Number(part);
    if (v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

export function blockedV4(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return true;                       // unparseable: refuse
  if (n === 0xffffffff) return true;                 // broadcast
  for (const [base, bits] of BLOCKED_V4) {
    const b = v4ToInt(base)!;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((n & mask) === (b & mask)) return true;
  }
  return false;
}

export function blockedV6(raw: string): boolean {
  const ip = raw.toLowerCase().split("%")[0];        // drop any zone id
  // IPv4-mapped and IPv4-compatible must be judged as IPv4, or ::ffff:127.0.0.1
  // walks straight through an IPv6-only check.
  const mapped = ip.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return blockedV4(mapped[1]);
  if (ip === "::" || ip === "::1") return true;
  if (/^f[cd]/.test(ip)) return true;                // fc00::/7 unique-local
  if (/^fe[89ab]/.test(ip)) return true;             // fe80::/10 link-local
  if (/^ff/.test(ip)) return true;                   // ff00::/8 multicast
  if (ip.startsWith("2001:db8")) return true;        // documentation
  if (ip.startsWith("64:ff9b")) return true;         // NAT64
  if (ip.startsWith("100:")) return true;            // discard-only
  if (ip.startsWith("fd00:ec2")) return true;        // EC2 IMDSv6
  return false;
}

export let dnsUsable: boolean | null = null;
export const dnsState = () => dnsUsable;

/** Resolve a hostname and refuse the host if ANY address is blocked. */
export async function hostAddressesSafe(host: string): Promise<{ ok: boolean; why?: string }> {
  if (typeof (Deno as { resolveDns?: unknown }).resolveDns !== "function") {
    dnsUsable = false;
    return REQUIRE_DNS
      ? { ok: false, why: "dns-guard-unavailable" }
      : { ok: true };
  }
  let any = false;
  for (const type of ["A", "AAAA"] as const) {
    let addrs: string[] = [];
    try {
      addrs = await Deno.resolveDns(host, type);
    } catch {
      continue;                                       // no record of this type
    }
    for (const a of addrs) {
      any = true;
      if (type === "A" ? blockedV4(a) : blockedV6(a)) {
        return { ok: false, why: `blocked-address:${a}` };
      }
    }
  }
  dnsUsable = true;
  if (!any) return { ok: false, why: "dns-no-records" };
  return { ok: true };
}

/** Full pre-flight on a URL. Returns a normalised URL or a refusal reason. */
export async function vet(raw: string): Promise<{ url?: URL; why?: string }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { why: "unparseable-url" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { why: `scheme:${u.protocol}` };
  if (u.username || u.password) return { why: "credentials-in-url" };
  if (u.port && u.port !== "80" && u.port !== "443") return { why: `port:${u.port}` };

  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { why: "no-host" };
  if (RESERVED_NAMES.has(host)) return { why: "reserved-name" };
  for (const s of RESERVED_SUFFIX) if (host.endsWith(s)) return { why: `reserved-tld:${s}` };
  // IP literals are never a business website, and they bypass name checks.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { why: "ip-literal-v4" };
  if (host.includes(":") || u.hostname.startsWith("[")) return { why: "ip-literal-v6" };
  if (!host.includes(".")) return { why: "no-dot-in-host" };

  const dns = await hostAddressesSafe(host);
  if (!dns.ok) return { why: dns.why };
  return { url: u };
}


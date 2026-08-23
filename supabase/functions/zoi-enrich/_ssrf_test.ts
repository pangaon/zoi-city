// Behavioural tests for the SSRF guard.
//
// These are the tests that decide whether zoi-enrich is safe to deploy. Each
// case below is an actual technique used to walk a server-side fetcher into a
// private network, so a failure here is not a style problem.
//
//   deno test --allow-net --allow-env supabase/functions/zoi-enrich/_ssrf_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { blockedV4, blockedV6, v4ToInt, vet, RESERVED_NAMES, RESERVED_SUFFIX } from "./_ssrf.ts";

Deno.test("IPv4: every private, reserved and metadata range is blocked", () => {
  for (const ip of [
    "0.0.0.0", "0.1.2.3",
    "10.0.0.1", "10.255.255.255",
    "100.64.0.1", "100.127.255.255",          // carrier NAT
    "127.0.0.1", "127.1.2.3",                 // loopback
    "169.254.169.254",                        // AWS/GCP/Azure metadata
    "169.254.0.1",
    "172.16.0.1", "172.31.255.255",
    "192.0.0.1", "192.0.2.5", "192.88.99.1",
    "192.168.0.1", "192.168.255.255",
    "198.18.0.1", "198.51.100.5", "203.0.113.9",
    "224.0.0.1", "239.255.255.255",           // multicast
    "240.0.0.1", "255.255.255.255",
  ]) {
    assert(blockedV4(ip), `${ip} must be blocked`);
  }
});

Deno.test("IPv4: ordinary public addresses are allowed", () => {
  for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.15.255.255",
                    "172.32.0.1", "100.63.255.255", "100.128.0.1", "11.0.0.1"]) {
    assertEquals(blockedV4(ip), false, `${ip} should be allowed`);
  }
});

Deno.test("IPv4: unparseable input is refused, never allowed by accident", () => {
  for (const junk of ["", "1.2.3", "1.2.3.4.5", "999.1.1.1", "a.b.c.d",
                      "1.2.3.-1", "0x7f.0.0.1", "1.2.3.04x"]) {
    assert(blockedV4(junk), `${junk} must not be treated as safe`);
  }
  assertEquals(v4ToInt("255.255.255.255"), 4294967295);
  assertEquals(v4ToInt("0.0.0.0"), 0);
  assertEquals(v4ToInt("1.2.3.4"), 16909060);
});

Deno.test("IPv6: loopback, ULA, link-local, multicast and metadata are blocked", () => {
  for (const ip of ["::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::abcd",
                    "ff02::1", "2001:db8::1", "64:ff9b::1.2.3.4", "100::1",
                    "fd00:ec2::254"]) {
    assert(blockedV6(ip), `${ip} must be blocked`);
  }
});

Deno.test("IPv6: an IPv4-mapped address is judged as IPv4", () => {
  // ::ffff:127.0.0.1 is the classic way past an IPv6-only check.
  assert(blockedV6("::ffff:127.0.0.1"), "mapped loopback must be blocked");
  assert(blockedV6("::ffff:169.254.169.254"), "mapped metadata must be blocked");
  assert(blockedV6("::ffff:10.0.0.1"), "mapped private must be blocked");
  assert(blockedV6("::127.0.0.1"), "compat loopback must be blocked");
  assertEquals(blockedV6("::ffff:8.8.8.8"), false, "mapped public is fine");
  // a zone id must not defeat the check
  assert(blockedV6("fe80::1%eth0"), "zone id must not bypass link-local");
});

Deno.test("IPv6: ordinary public addresses are allowed", () => {
  for (const ip of ["2606:4700:4700::1111", "2a00:1450:4001:80f::200e", "2001:4860:4860::8888"]) {
    assertEquals(blockedV6(ip), false, `${ip} should be allowed`);
  }
});

Deno.test("vet: refuses everything that is not a plain public website", async () => {
  const cases: [string, string][] = [
    ["file:///etc/passwd", "scheme"],
    ["gopher://x.com/", "scheme"],
    ["ftp://example.com/", "scheme"],
    ["http://user:pass@example.com/", "credentials-in-url"],
    ["http://example.com:22/", "port"],
    ["http://example.com:6379/", "port"],
    ["http://127.0.0.1/", "ip-literal-v4"],
    // Blocked by the reserved-name list before the IP-literal check even runs.
    // Two independent rules catch it; the test asserts the refusal, not which one.
    ["http://169.254.169.254/latest/meta-data/", "reserved-name"],
    ["http://[::1]/", "ip-literal-v6"],
    ["http://localhost/", "reserved-name"],
    ["http://metadata.google.internal/", "reserved-name"],
    ["http://router.local/", "reserved-tld"],
    ["http://db.internal/", "reserved-tld"],
    ["http://thing.lan/", "reserved-tld"],
    ["http://intranet/", "no-dot-in-host"],
    ["not a url", "unparseable-url"],
  ];
  for (const [url, expect] of cases) {
    const r = await vet(url);
    assertEquals(r.url, undefined, `${url} must be refused`);
    assert(r.why?.startsWith(expect) || r.why === expect,
      `${url}: expected ${expect}, got ${r.why}`);
  }
});

Deno.test("vet: a real public website passes and is normalised", async () => {
  const r = await vet("https://example.com/about?x=1");
  assert(r.url, `example.com should pass, got ${r.why}`);
  assertEquals(r.url!.hostname, "example.com");
  assertEquals(r.url!.protocol, "https:");
});

Deno.test("vet: a hostname that resolves into a blocked range is refused", async () => {
  // localtest.me and its subdomains resolve to 127.0.0.1 in public DNS. This is
  // exactly the shape of attack a name-only check misses, so it must be the DNS
  // layer that catches it.
  const r = await vet("http://anything.localtest.me/");
  assertEquals(r.url, undefined, "a public name pointing at loopback must be refused");
  assert(/blocked-address|dns/.test(r.why ?? ""), `expected a DNS refusal, got ${r.why}`);
});

Deno.test("the guard tables still cover the ranges that matter", () => {
  assert(RESERVED_NAMES.has("localhost"));
  assert(RESERVED_NAMES.has("metadata.google.internal"));
  assert(RESERVED_NAMES.has("169.254.169.254"));
  for (const s of [".local", ".internal", ".lan", ".home.arpa"]) {
    assert(RESERVED_SUFFIX.includes(s), `${s} must stay in the reserved list`);
  }
});

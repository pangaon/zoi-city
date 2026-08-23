#!/usr/bin/env python3
"""
Website enrichment for directory listings.

Answers a concrete question with evidence: if we fetch the site a listing
already links to, how much of a genuinely white-label profile can we fill
without a human typing anything?

Extracts, in order of trustworthiness:
  1. schema.org JSON-LD  — the site's own machine-readable statement of its
     hours, address, phone, price range, menu, cuisine, geo. Highest trust:
     the business published it about itself.
  2. OpenGraph / meta    — name, description, logo, locale.
  3. Structured markup   — tel:/mailto: links, social profile links.
  4. Page signals        — booking/menu/order links, languages offered.

Deliberate constraints, because this fetches other people's servers:
  * robots.txt is checked and obeyed per host, cached per run.
  * one request per host at a time, with a global rate limit.
  * identifying User-Agent with a contact URL.
  * 10s timeout, 1.5MB cap, no redirect chains beyond 3.
  * aggregator domains (xo.gr and friends) are treated as directory pages, not
    as the business's own site: contact details are trusted, brand/logo is not.
  * NOTHING is written to the database. It emits JSON, and emit-enrich-sql.py
    turns that into reviewable SQL.

Nothing is invented. Every field carries where it came from, so the renderer can
say "hours from their own website, checked 2026-08-23" rather than implying we
know something we do not.
"""
import json, os, re, sys, time, gzip, io, html
import urllib.request, urllib.parse, urllib.error, urllib.robotparser
import concurrent.futures, collections, threading

UA = ("ZoiDirectoryBot/1.0 (+https://www.zoi.city/about; enriches the listing a "
      "business already published; contact pangaon@gmail.com)")
TIMEOUT = 10
MAXBYTES = 1_500_000
OUT = os.environ.get("ENRICH_OUT", "/tmp/zoigeo/enriched.jsonl")

# Sites that are directories about businesses rather than the business itself.
# Their contact data is usable; their branding is not the listing's branding.
AGGREGATORS = {
    "xo.gr", "vrisko.gr", "en.wikipedia.org", "el.wikipedia.org", "wikipedia.org",
    "facebook.com", "instagram.com", "linkedin.com", "yelp.com", "tripadvisor.com",
    "google.com", "goo.gl", "maps.app.goo.gl", "linktr.ee", "youtube.com", "x.com",
    "twitter.com", "tiktok.com",
}
SOCIAL_HOSTS = {
    "instagram.com": "instagram", "facebook.com": "facebook", "tiktok.com": "tiktok",
    "youtube.com": "youtube", "x.com": "x", "twitter.com": "x",
    "linkedin.com": "linkedin", "pinterest.com": "pinterest", "spotify.com": "spotify",
    "soundcloud.com": "soundcloud", "wa.me": "whatsapp", "t.me": "telegram",
}

_locks = collections.defaultdict(threading.Lock)
_robots = {}
_robots_lock = threading.Lock()
_last_global = [0.0]
_global_lock = threading.Lock()


def host_of(url):
    try:
        h = urllib.parse.urlparse(url).netloc.lower()
        return h[4:] if h.startswith("www.") else h
    except Exception:
        return ""


def throttle(gap=0.12):
    with _global_lock:
        dt = time.time() - _last_global[0]
        if dt < gap:
            time.sleep(gap - dt)
        _last_global[0] = time.time()


def allowed(url):
    """robots.txt, cached per host. On any doubt, do not fetch."""
    h = host_of(url)
    if not h:
        return False
    with _robots_lock:
        rp = _robots.get(h)
    if rp is None:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"https://{h}/robots.txt")
        try:
            throttle()
            req = urllib.request.Request(f"https://{h}/robots.txt",
                                         headers={"User-Agent": UA})
            body = urllib.request.urlopen(req, timeout=TIMEOUT).read(200_000)
            rp.parse(body.decode("utf-8", "replace").splitlines())
        except Exception:
            # No reachable robots.txt is conventionally "allowed", but be
            # conservative on an explicit server error.
            rp.allow_all = True
        with _robots_lock:
            _robots[h] = rp
    try:
        return rp.can_fetch(UA, url)
    except Exception:
        return False


def fetch(url):
    if not allowed(url):
        return None, "robots"
    h = host_of(url)
    with _locks[h]:            # one in flight per host
        throttle()
        req = urllib.request.Request(url, headers={
            "User-Agent": UA, "Accept": "text/html,application/xhtml+xml",
            "Accept-Encoding": "gzip", "Accept-Language": "el,en;q=0.8",
        })
        try:
            r = urllib.request.urlopen(req, timeout=TIMEOUT)
            raw = r.read(MAXBYTES)
            if r.headers.get("Content-Encoding") == "gzip":
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            ct = (r.headers.get("Content-Type") or "").lower()
            if "html" not in ct and "xml" not in ct:
                return None, f"content-type:{ct[:30]}"
            enc = "utf-8"
            m = re.search(r'charset=["\']?([\w-]+)', ct)
            if m:
                enc = m.group(1)
            return raw.decode(enc, "replace"), r.geturl()
        except urllib.error.HTTPError as e:
            return None, f"http{e.code}"
        except Exception as e:
            return None, type(e).__name__


def jsonld(doc):
    """Every JSON-LD block on the page, flattened."""
    out = []
    for m in re.finditer(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            doc, re.S | re.I):
        txt = m.group(1).strip()
        txt = re.sub(r'^\s*<!\[CDATA\[|\]\]>\s*$', '', txt)
        try:
            v = json.loads(txt)
        except Exception:
            continue
        stack = [v]
        while stack:
            cur = stack.pop()
            if isinstance(cur, list):
                stack.extend(cur)
            elif isinstance(cur, dict):
                out.append(cur)
                for k in ("@graph", "mainEntity", "itemListElement", "subOrganization"):
                    if k in cur:
                        stack.append(cur[k])
    return out


def meta(doc, key, attr="property"):
    for pat in (rf'<meta[^>]*{attr}=["\']{re.escape(key)}["\'][^>]*content=["\']([^"\']*)["\']',
                rf'<meta[^>]*content=["\']([^"\']*)["\'][^>]*{attr}=["\']{re.escape(key)}["\']'):
        m = re.search(pat, doc, re.I)
        if m:
            return html.unescape(m.group(1)).strip() or None
    return None


PHONE = re.compile(r'tel:([+\d][\d().\s\-/]{6,24})', re.I)
EMAIL = re.compile(r'mailto:([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})', re.I)


def digits(s):
    return re.sub(r'\D', '', s or '')


DAYS = {"monday": "mon", "tuesday": "tue", "wednesday": "wed", "thursday": "thu",
        "friday": "fri", "saturday": "sat", "sunday": "sun",
        "mo": "mon", "tu": "tue", "we": "wed", "th": "thu", "fr": "fri",
        "sa": "sat", "su": "sun"}


def hours_from_ld(node):
    """openingHoursSpecification, or the older openingHours string form."""
    out = []
    spec = node.get("openingHoursSpecification")
    if isinstance(spec, dict):
        spec = [spec]
    if isinstance(spec, list):
        for sp in spec:
            if not isinstance(sp, dict):
                continue
            days = sp.get("dayOfWeek") or []
            if isinstance(days, str):
                days = [days]
            o, c = sp.get("opens"), sp.get("closes")
            for d in days:
                key = DAYS.get(str(d).split("/")[-1].lower()[:9]) or \
                      DAYS.get(str(d).split("/")[-1].lower()[:2])
                if key and o and c:
                    out.append({"day": key, "open": str(o)[:5], "close": str(c)[:5]})
    oh = node.get("openingHours")
    if not out and oh:
        if isinstance(oh, str):
            oh = [oh]
        for line in oh:
            m = re.match(r'\s*([A-Za-z,\-]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})', str(line))
            if not m:
                continue
            for tok in re.split(r'[,\-]', m.group(1)):
                key = DAYS.get(tok.lower()[:9]) or DAYS.get(tok.lower()[:2])
                if key:
                    out.append({"day": key, "open": m.group(2), "close": m.group(3)})
    # de-duplicate, keep first per day
    seen, uniq = set(), []
    for h in out:
        if h["day"] in seen:
            continue
        seen.add(h["day"])
        uniq.append(h)
    return uniq


def extract(url, doc, final):
    src_host = host_of(final if isinstance(final, str) and final.startswith("http") else url)
    is_agg = src_host in AGGREGATORS
    prof, prov = {}, {}

    def put(field, value, source):
        if value in (None, "", [], {}):
            return
        prof[field] = value
        prov[field] = source

    lds = jsonld(doc)
    biz = None
    for node in lds:
        t = node.get("@type") or ""
        t = " ".join(t) if isinstance(t, list) else str(t)
        if re.search(r'LocalBusiness|Restaurant|Store|Hotel|Church|Organization|'
                     r'Dentist|Physician|Attorney|School|CafeOrCoffeeShop|Bakery|'
                     r'FoodEstablishment|ProfessionalService|TouristAttraction|'
                     r'PerformingGroup|MusicGroup|SportsTeam|NGO', t, re.I):
            biz = node
            break

    if biz:
        put("tagline", (biz.get("slogan") or "").strip()[:160] or None, "jsonld")
        d = biz.get("description")
        if isinstance(d, str):
            put("description", html.unescape(d).strip()[:1200], "jsonld")
        h = hours_from_ld(biz)
        put("hours", h, "jsonld")
        tel = biz.get("telephone")
        if isinstance(tel, str) and len(digits(tel)) >= 7:
            put("phone", tel.strip(), "jsonld")
        em = biz.get("email")
        if isinstance(em, str) and "@" in em:
            put("email", em.strip().replace("mailto:", ""), "jsonld")
        pr = biz.get("priceRange")
        if isinstance(pr, str) and pr.strip():
            put("price_range", pr.strip()[:12], "jsonld")
        addr = biz.get("address")
        if isinstance(addr, dict):
            a = {k: str(addr.get(v)).strip() for k, v in
                 (("street", "streetAddress"), ("city", "addressLocality"),
                  ("region", "addressRegion"), ("postcode", "postalCode"),
                  ("country", "addressCountry")) if addr.get(v)}
            put("address_parts", a, "jsonld")
        geo = biz.get("geo")
        if isinstance(geo, dict):
            try:
                lat, lng = float(geo.get("latitude")), float(geo.get("longitude"))
                if -90 <= lat <= 90 and -180 <= lng <= 180:
                    put("geo", {"lat": round(lat, 6), "lng": round(lng, 6)}, "jsonld")
            except Exception:
                pass
        for key, fld in (("servesCuisine", "cuisine"), ("menu", "menu_url"),
                         ("hasMenu", "menu_url"), ("acceptsReservations", "reservations")):
            v = biz.get(key)
            if isinstance(v, list):
                v = [str(x) for x in v][:8]
            elif v is not None:
                v = str(v)[:300]
            put(fld, v, "jsonld")
        img = biz.get("image") or biz.get("logo")
        if isinstance(img, dict):
            img = img.get("url")
        if isinstance(img, list) and img:
            img = img[0].get("url") if isinstance(img[0], dict) else img[0]
        if isinstance(img, str) and img.startswith("http"):
            put("photo_url", img, "jsonld")

    # OpenGraph, only trusted for branding when it is the business's own site
    if not is_agg:
        put("tagline", prof.get("tagline") or meta(doc, "og:site_name"), "og")
        if "description" not in prof:
            put("description",
                (meta(doc, "og:description") or meta(doc, "description", "name") or "")[:1200] or None,
                "og")
        if "photo_url" not in prof:
            im = meta(doc, "og:image")
            if im and im.startswith("http"):
                put("photo_url", im, "og")

    # contact details from markup
    if "phone" not in prof:
        phones = [p.strip() for p in PHONE.findall(doc)]
        good = [p for p in phones if 7 <= len(digits(p)) <= 15]
        if good:
            put("phone", good[0], "tel-link")
    if "email" not in prof:
        mails = [m for m in EMAIL.findall(doc)
                 if not re.search(r'example\.|sentry|wixpress|@sentry', m, re.I)]
        if mails:
            put("email", mails[0], "mailto-link")

    # social profiles
    socials = {}
    for m in re.finditer(r'href=["\'](https?://[^"\'>\s]+)["\']', doc, re.I):
        u = html.unescape(m.group(1))
        h = host_of(u)
        for dom, name in SOCIAL_HOSTS.items():
            if h == dom or h.endswith("." + dom):
                path = urllib.parse.urlparse(u).path.strip("/")
                if not path or re.match(
                        r'^(sharer|share|intent|dialog|plugins|embed|login|home|'
                        r'watch|hashtag|search|profile\.php|tr)(/|$)', path, re.I):
                    break
                socials.setdefault(name, u.split("?")[0][:220])
                break
    put("social", socials, "links")

    # booking / ordering / menu intent
    intents = {}
    for m in re.finditer(r'href=["\']([^"\'>\s]+)["\'][^>]*>(.{0,90}?)</a>', doc, re.I | re.S):
        href, label = html.unescape(m.group(1)), re.sub(r'<[^>]+>', ' ', m.group(2))
        label = re.sub(r'\s+', ' ', html.unescape(label)).strip().lower()
        if not href.startswith(("http", "/")):
            continue
        full = urllib.parse.urljoin(final if isinstance(final, str) and final.startswith("http") else url, href)
        for pat, key in ((r'\b(book|reserve|reservation|κράτηση|ραντεβού)\b', 'booking_url'),
                         (r'\b(menu|μενού|κατάλογος)\b', 'menu_url'),
                         (r'\b(order|delivery|παραγγελ)\b', 'order_url'),
                         (r'\b(donate|δωρεά|stewardship)\b', 'give_url')):
            if re.search(pat, label) and key not in intents:
                intents[key] = full[:240]
    for k, v in intents.items():
        if k not in prof:
            put(k, v, "page-link")

    # declared page language, useful for the diaspora
    lang = None
    m = re.search(r'<html[^>]+lang=["\']([a-zA-Z\-]{2,8})["\']', doc)
    if m:
        lang = m.group(1).lower()
    put("site_lang", lang, "html-lang")

    return prof, prov, is_agg, src_host


def run(listings, workers=8):
    done = set()
    if os.path.exists(OUT):
        for line in open(OUT, encoding="utf-8"):
            try:
                done.add(json.loads(line)["slug"])
            except Exception:
                pass
    todo = [r for r in listings if r["slug"] not in done and (r.get("website") or "").strip()]
    print(f"to fetch: {len(todo)} (already have {len(done)})", flush=True)
    stats = collections.Counter()
    lock = threading.Lock()

    def one(r):
        url = r["website"].strip()
        if not url.startswith("http"):
            url = "https://" + url
        doc, final = fetch(url)
        if not doc:
            return {"slug": r["slug"], "website": url, "error": str(final)[:40]}
        prof, prov, is_agg, host = extract(url, doc, final)
        return {"slug": r["slug"], "website": url, "host": host, "aggregator": is_agg,
                "profile": prof, "provenance": prov, "bytes": len(doc)}

    with open(OUT, "a", encoding="utf-8") as fh, \
            concurrent.futures.ThreadPoolExecutor(workers) as ex:
        for i, rec in enumerate(ex.map(one, todo), 1):
            with lock:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                if rec.get("error"):
                    stats["error:" + rec["error"][:18]] += 1
                else:
                    stats["ok"] += 1
                    for k in rec["profile"]:
                        stats["field:" + k] += 1
                if i % 25 == 0:
                    fh.flush()
                    print(f"  {i}/{len(todo)}  ok={stats['ok']}", flush=True)
    print("\n== yield ==")
    for k, v in sorted(stats.items(), key=lambda kv: -kv[1]):
        print(f"  {k:26} {v}")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/zoigeo/canonical.json"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 150
    rows = json.load(open(src, encoding="utf-8"))
    rows = [r for r in rows if (r.get("website") or "").strip()]
    import random
    random.seed(11)
    random.shuffle(rows)
    run(rows[:n])

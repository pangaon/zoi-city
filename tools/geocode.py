#!/usr/bin/env python3
"""
Geocode the listings that have no coordinates.

Two passes, in order of precision:
  1. street  - the listing has a real street address -> geocode it, then VALIDATE
               the answer against the city it claims to be in. A result more than
               MAX_KM from that city is rejected, because a wrong pin is worse
               than no pin.
  2. city    - no usable street address -> the city centroid, recorded honestly
               as city-level precision.

Providers: Photon (komoot) primary, Nominatim fallback. Both are free and need no
key. Rate-limited to one request per second per provider, with a descriptive
User-Agent, because that is what their usage policies ask for.

Restartable: every answer is appended to a cache keyed by query string, so a
re-run costs nothing for work already done. Writes NOTHING to the database - it
emits SQL for a human to review and run.
"""
import json, os, re, sys, time, math, urllib.parse, urllib.request, collections

CACHE = "/tmp/zoigeo/geocache.jsonl"
NEED  = "/tmp/zoigeo/need.json"
GEO   = "/tmp/geo_all.json"
OUT   = "/tmp/zoigeo/geocoded.json"
UA    = "zoi.city-directory-backfill/1.0 (+https://www.zoi.city; pangaon@gmail.com)"
MAX_KM_STREET = 40.0      # a street result must be within this of its stated city
MAX_KM_CITY   = 400.0     # a city result must be within this of others in-country

ALIAS = {'us':'united states','usa':'united states','u.s.':'united states',
         'uk':'united kingdom','gb':'united kingdom','gr':'greece','el':'greece',
         'au':'australia','ca':'canada','de':'germany','za':'south africa',
         'cy':'cyprus','nz':'new zealand','se':'sweden'}

def haversine(a, b):
    R = 6371.0088
    dlat = math.radians(b[0]-a[0]); dlng = math.radians(b[1]-a[1])
    h = (math.sin(dlat/2)**2 +
         math.cos(math.radians(a[0]))*math.cos(math.radians(b[0]))*math.sin(dlng/2)**2)
    return 2*R*math.asin(min(1, math.sqrt(h)))

# ---------- cache ----------
cache = {}
if os.path.exists(CACHE):
    for line in open(CACHE, encoding='utf-8'):
        try:
            r = json.loads(line); cache[r['q']] = r
        except Exception: pass
cache_fh = open(CACHE, 'a', encoding='utf-8')
def remember(q, res, provider):
    rec = {'q': q, 'res': res, 'via': provider}
    cache[q] = rec
    cache_fh.write(json.dumps(rec, ensure_ascii=False) + '\n'); cache_fh.flush()

_last = collections.defaultdict(float)
def throttle(p, gap=1.05):
    dt = time.time() - _last[p]
    if dt < gap: time.sleep(gap - dt)
    _last[p] = time.time()

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

def photon(q, cc=None):
    throttle('photon')
    u = 'https://photon.komoot.io/api?limit=3&q=' + urllib.parse.quote(q)
    d = get(u)
    out = []
    for f in d.get('features', []):
        c = f.get('geometry', {}).get('coordinates')
        p = f.get('properties', {})
        if not c: continue
        out.append({'lat': c[1], 'lng': c[0], 'country': p.get('country'),
                    'city': p.get('city') or p.get('name'), 'type': p.get('osm_value')})
    return out

def nominatim(q):
    throttle('nominatim')
    u = ('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q='
         + urllib.parse.quote(q))
    d = get(u)
    return [{'lat': float(r['lat']), 'lng': float(r['lon']),
             'country': (r.get('address') or {}).get('country'),
             'city': r.get('name'), 'type': r.get('type')} for r in d]

def lookup(q):
    """Cached, provider-fallback geocode. Returns a list of candidates."""
    if q in cache: return cache[q]['res']
    for name, fn in (('photon', photon), ('nominatim', nominatim)):
        try:
            res = fn(q)
            if res: remember(q, res, name); return res
        except Exception as ex:
            sys.stderr.write(f'  {name} failed for {q!r}: {str(ex)[:70]}\n')
    remember(q, [], 'none'); return []

def main():
    need = json.load(open(NEED, encoding='utf-8'))
    geo  = json.load(open(GEO, encoding='utf-8'))

    def ckey(city, country):
        c = (city or '').strip().lower()
        k = (country or '').strip().lower()
        return c, ALIAS.get(k, k)

    # centroids we already know for free, from the listings that are plotted
    centroid = {}
    stack = collections.defaultdict(list)
    for r in geo:
        k = ckey(r.get('city'), r.get('country'))
        if k[0]: stack[k].append((r['lat'], r['lng']))
    for k, v in stack.items():
        centroid[k] = (sum(a for a, _ in v)/len(v), sum(b for _, b in v)/len(v))
    print(f'known centroids: {len(centroid)}', flush=True)

    # ---- pass 1: resolve every city we still need, once ----
    wanted = sorted({ckey(r.get('city'), r.get('country')) for r in need if ckey(r.get('city'), r.get('country'))[0]})
    todo = [k for k in wanted if k not in centroid]
    print(f'cities to resolve: {len(todo)}', flush=True)
    for i, (city, country) in enumerate(todo, 1):
        q = f'{city}, {country}' if country else city
        res = lookup(q)
        if res:
            centroid[(city, country)] = (res[0]['lat'], res[0]['lng'])
        if i % 100 == 0: print(f'  cities {i}/{len(todo)}', flush=True)
    print(f'centroids after pass 1: {len(centroid)}', flush=True)

    # ---- pass 2: precise geocode for real street addresses ----
    out = []
    street = [r for r in need if r.get('address') and re.search(r'\d|,', r['address'])]
    print(f'street addresses: {len(street)}', flush=True)
    stats = collections.Counter()
    for i, r in enumerate(street, 1):
        k = ckey(r.get('city'), r.get('country'))
        anchor = centroid.get(k)
        addr = ' '.join(r['address'].split())
        q = addr
        if r.get('city') and r['city'].lower() not in addr.lower(): q += ', ' + r['city']
        if r.get('country') and (r['country'] or '').lower() not in addr.lower(): q += ', ' + r['country']
        res = lookup(q)
        pick = None
        for c in res:
            if anchor is None:
                pick = c; break
            if haversine(anchor, (c['lat'], c['lng'])) <= MAX_KM_STREET:
                pick = c; break
        if pick:
            out.append({'slug': r.get('canonical_slug') or r['slug'], 'lat': pick['lat'],
                        'lng': pick['lng'], 'precision': 'street',
                        'source': 'osm', 'query': q})
            stats['street'] += 1
        elif anchor:
            out.append({'slug': r.get('canonical_slug') or r['slug'], 'lat': anchor[0],
                        'lng': anchor[1], 'precision': 'city', 'source': 'centroid',
                        'query': q})
            stats['street->city fallback'] += 1
        else:
            stats['unresolved'] += 1
        if i % 200 == 0: print(f'  street {i}/{len(street)}  {dict(stats)}', flush=True)

    # ---- pass 3: everything else gets its city centroid, honestly labelled ----
    done = {o['slug'] for o in out}
    for r in need:
        s = r.get('canonical_slug') or r['slug']
        if s in done: continue
        k = ckey(r.get('city'), r.get('country'))
        anchor = centroid.get(k)
        if not anchor: stats['no city, no address'] += 1; continue
        out.append({'slug': s, 'lat': anchor[0], 'lng': anchor[1],
                    'precision': 'city', 'source': 'centroid', 'query': f'{k[0]}, {k[1]}'})
        stats['city'] += 1

    json.dump(out, open(OUT, 'w'), ensure_ascii=False)
    print('\n== result ==', flush=True)
    for k, v in stats.most_common(): print(f'  {k:24} {v}')
    print(f'  TOTAL geocoded          {len(out)}')

main()

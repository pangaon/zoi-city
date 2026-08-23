#!/usr/bin/env python3
"""
Build a city -> state/province lookup.

Why this and not per-listing reverse geocoding: there are ~9,500 listings with
coordinates but only ~1,900 distinct cities. Resolving the city once and applying
it to every listing in it is five times less work, hits the providers five times
less hard, and gives exactly the same answer — a listing's state is a property of
its city.

Reads city+country+coords we already have, asks OSM for the administrative
hierarchy, writes city -> {region, region_code, country_code}.
"""
import json, os, time, urllib.parse, urllib.request, collections, sys

OUT = "/tmp/zoigeo/city_regions.jsonl"
UA = ("ZoiDirectoryBot/1.0 (+https://www.zoi.city; building a state/province index "
      "for a Greek community directory; contact pangaon@gmail.com)")

def get(url, tries=3):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            return json.loads(urllib.request.urlopen(req, timeout=25).read())
        except Exception:
            if t == tries - 1: return None
            time.sleep(1.5 * (t + 1))

done = set()
if os.path.exists(OUT):
    for line in open(OUT, encoding="utf-8"):
        try: done.add(json.loads(line)["key"])
        except Exception: pass

rows = json.load(open("/tmp/geo_all.json", encoding="utf-8"))
cities = {}
for r in rows:
    c = (r.get("city") or "").strip()
    k = (r.get("country") or "").strip()
    if not c: continue
    cities.setdefault(f"{c.lower()}|{k.lower()}", (c, k, r["lat"], r["lng"]))

todo = [(k, v) for k, v in sorted(cities.items()) if k not in done]
print(f"cities: {len(cities)}  already done: {len(done)}  to do: {len(todo)}", flush=True)

with open(OUT, "a", encoding="utf-8") as fh:
    for i, (key, (city, country, lat, lng)) in enumerate(todo, 1):
        # Nominatim reverse gives the full admin hierarchy in one call.
        time.sleep(1.05)   # their stated limit
        d = get("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=8&addressdetails=1"
                f"&lat={lat}&lon={lng}")
        a = (d or {}).get("address") or {}
        rec = {
            "key": key, "city": city, "country_in": country,
            "region": a.get("state") or a.get("province") or a.get("region") or a.get("state_district"),
            "region_code": (a.get("ISO3166-2-lvl4") or "").split("-")[-1] or None,
            "country": a.get("country"), "country_code": (a.get("country_code") or "").upper() or None,
        }
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        if i % 100 == 0:
            fh.flush()
            print(f"  {i}/{len(todo)}", flush=True)
print("done", flush=True)

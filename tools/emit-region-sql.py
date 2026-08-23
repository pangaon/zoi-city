#!/usr/bin/env python3
"""city_regions.jsonl -> SQL that stamps region/region_code onto every listing."""
import json, sys, collections
SRC="/tmp/zoigeo/city_regions.jsonl"
OUT=sys.argv[1] if len(sys.argv)>1 else "supabase/migrations/0009_region_backfill.sql"
rows=[json.loads(l) for l in open(SRC,encoding='utf-8')]
ok=[r for r in rows if r.get('region')]
seen=set(); vals=[]
def q(x): return "'"+str(x).replace("'","''")+"'"
for r in ok:
    city,country = r['key'].split('|',1)
    if (city,country) in seen: continue
    seen.add((city,country))
    vals.append(f"({q(city)},{q(country)},{q(r['region'])},{q(r.get('region_code') or '')})")
BATCH=700
parts=[f"""-- Region backfill: {len(vals)} city/country pairs -> region + region_code.
-- Resolved once per city from OpenStreetMap's administrative hierarchy, because a
-- city's state does not change. Idempotent: matches on lowered city+country and
-- only writes where the value actually differs, so the no-op trigger keeps the
-- heap clean and re-running costs nothing.

BEGIN;
"""]
for i in range(0,len(vals),BATCH):
    chunk=vals[i:i+BATCH]
    parts.append("UPDATE zoi.listings l SET region = g.region,\n"
                 "       region_code = nullif(g.region_code,'')\n"
                 "FROM (VALUES\n    " + ",\n    ".join(chunk) + "\n) AS g(city, country, region, region_code)\n"
                 "WHERE lower(l.city) = g.city\n"
                 "  AND lower(coalesce(l.country,'')) = g.country\n"
                 "  AND (l.region IS DISTINCT FROM g.region\n"
                 "       OR l.region_code IS DISTINCT FROM nullif(g.region_code,''));\n\n")
parts.append("""SELECT count(*) FILTER (WHERE region IS NOT NULL) AS with_region,
       count(DISTINCT region)                             AS distinct_regions,
       count(*)                                           AS total
  FROM zoi.listings WHERE publish_status='published';

-- COMMIT;
""")
open(OUT,'w',encoding='utf-8').write("".join(parts))
print(f"  wrote {OUT}: {len(vals)} cities, {len(ok)} resolved of {len(rows)}")

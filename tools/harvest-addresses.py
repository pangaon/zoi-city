#!/usr/bin/env python3
"""
Harvest every listing's address from the public RPCs into one JSONL file.

Step 1 of geocoding. Deliberately read-only and restartable: it appends to the
output and skips slugs already present, so an interrupted run resumes.
"""
import json, os, sys, urllib.request, urllib.error, concurrent.futures, time

BASE = "https://csebihpaychdkanjjsmz.supabase.co"
KEY  = "sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j"
OUT  = sys.argv[1] if len(sys.argv) > 1 else "/tmp/zoigeo/addresses.jsonl"

def rpc(fn, params, tries=4):
    body = json.dumps(params).encode()
    for t in range(tries):
        try:
            req = urllib.request.Request(f"{BASE}/rest/v1/rpc/{fn}", data=body, headers={
                "apikey": KEY, "Authorization": "Bearer " + KEY,
                "Content-Type": "application/json", "Accept": "application/json"})
            return json.loads(urllib.request.urlopen(req, timeout=45).read())
        except Exception:
            if t == tries - 1: raise
            time.sleep(1.5 * (t + 1))

def all_slugs():
    """seo_index caps at 1000 rows per call, so page until a short page."""
    out, off = [], 0
    while True:
        page = rpc("seo_index", {"p_limit": 1000, "p_offset": off})
        if not page: break
        out += page
        if len(page) < 1000: break
        off += 1000
        if off > 40000: break
    seen, uniq = set(), []
    for r in out:
        if r["slug"] in seen: continue
        seen.add(r["slug"]); uniq.append(r)
    return uniq

FIELDS = ("slug","canonical_slug","entity_type","name","address","city","country",
          "category_slug","latitude","longitude","phone","website")

def fetch(slug):
    try:
        d = rpc("seo_entity", {"p_slug": slug}, tries=3)
        e = d[0] if isinstance(d, list) and d else d
        if not isinstance(e, dict): return None
        return {k: e.get(k) for k in FIELDS}
    except Exception as ex:
        return {"slug": slug, "_error": str(ex)[:120]}

def main():
    done = set()
    if os.path.exists(OUT):
        for line in open(OUT, encoding="utf-8"):
            try: done.add(json.loads(line).get("slug"))
            except Exception: pass
    idx = all_slugs()
    print(f"index: {len(idx)} listings; already harvested {len(done)}", flush=True)
    todo = [r["slug"] for r in idx if r["slug"] not in done]
    print(f"to fetch: {len(todo)}", flush=True)
    n = 0
    with open(OUT, "a", encoding="utf-8") as fh, \
         concurrent.futures.ThreadPoolExecutor(16) as ex:
        for rec in ex.map(fetch, todo):
            if rec is None: continue
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n += 1
            if n % 500 == 0: fh.flush(); print(f"  {n}/{len(todo)}", flush=True)
    print(f"done: wrote {n} rows to {OUT}", flush=True)

main()

# Actual production global map after covering-index install

The ordinary live map completed Kenya, Cyprus and Australia record previews and canonical-home navigation at 390 and 1440 pixels without response fixtures, route overlays, sign-in or live data mutations. This is bounded functional and rendered acceptance, not global GIS accuracy or cold-cache acceptance.

## Current production evidence

`docs/audits/evidence/map-feed-index-production-2026-10-03/settled-final/report.json` retains actual request parameters, statuses, elapsed times, relevant public record fields, current reviewed-point receipts, camera/selection state, rendered map state, canonical destinations and page errors. Deployed map HTML/loader/preview hashes are recorded separately in that report. Fresh contexts disable service workers so an old worker cannot substitute stale assets; corresponding browser warnings are retained.

| Width | First usable selected profile | Full feed settled | Feed reads | Observed feed latency range |
|---|---:|---:|---:|---:|
| 390 | 3,131 ms | 4,982 ms | 17 | 361–801 ms |
| 1440 | 2,552 ms | 3,622 ms | 17 | 201–711 ms |

Each run fetched 15 full 1,000-row pages, one 205-row terminal page and one empty parallel terminal request. The loaded map feed is 15,205 records. Its actual coverage disclosure lists 2,205 positions eligible for street display after full-cohort checks and 33,014 directory records. Eligible display positions are not automatically receipt-backed routing destinations. The preview was usable while the feed loaded; completing the feed preserved the Yamas selection, URL, camera and zoom. The original `run-final-v2` separately recorded a successful 9,601 ms phone feed with an individual successful read as slow as 3,449 ms. That slower observation is retained, not replaced by the final faster run.

There were zero page errors and genuine public RPC failures in the final settled runs. One cancelled phone autocomplete request is retained separately as `net::ERR_ABORTED`; submitting/selecting a current query retires its old suggestion request. No failed feed call is placed in that cancellation category. Console records retain service-worker blocking and software-renderer GPU readback warnings; no zero-warning claim is made.

- Kenya: actual Yamas `84bdafb9-966b-489a-a4d3-0dc3dc92acf9` has no published address/coordinates/current receipt. The preview offers its actual home without numerical Directions or an invented address lookup. Canonical `/business/ke-nairobi-yamas-greek-restaurant` renders its real branding and marketing heading “A taste of Greece in Nairobi”.
- Cyprus: actual Amara `361c983b-29aa-4b4a-8bfa-ca4a17993e40` feed and fresh home read retain street coordinates 34.7136232,33.1552567 and published address “Amathountos, Limassol”. Its CURRENT `geography_reviewed_point` is null. The preview correctly retains published-address lookup and withholds numerical Directions. The independent direct public receipt read is retained in `current-receipts.json`. Earlier routing approval is not current proof. Restoring reviewed routing requires root-owned source/receipt investigation; this lane did not change coordinates or receipts.
- Australia: Olympia `eed95c0e-ef1d-4376-9335-418b56227e99` returns actual request `20e503d8-7879-482c-9fac-38875684337d` and exact -33.8818077,151.2192239. The preview completes the fresh home/proof reads, exposes that exact numerical Directions destination and opens the actual `/travel-place/25hours-hotel-sydney-the-olympia-paddington` home. This is a real receipt, not a controlled shape.

The final screenshots wait for actual camera idle, loaded tiles, rendered map state and fonts. Olympia phone/desktop and Amara desktop were visually inspected: the selected marker and real basemap are visible, with usable preview actions. All six settled states record `loaded=true`, `tiles_loaded=true`, `moving=false` and nonempty rendered features. The blank phone basemap frame in `run-final-v2` was captured before movement/tiles settled; it remains negative visual evidence and is not accepted as a rendered map pass.

## Preserved earlier observations

The independent index packet’s `actual-four-public-readers.json` still records four first post-install HTTP500/57014 results around 3.3–3.5 seconds. Its later settled offset 6000–9000 reads took 704–883 ms. Those unchanged artifacts are referenced in this manifest. This browser evidence does not explain away the earlier failures, prove cold performance or guarantee that all future pages will meet a deadline.

The new verifier’s earlier failed runs are retained: `run` confused Fetch Response.status with Playwright Response.status(); `run-v2` assumed marketing H1 equals listing name; `run-v3` read closed details as visible text; `run-v4` waited for a phone row before opening its intentionally collapsed sheet. `run-v5` required Amara’s old numerical routing despite its current absent receipt. `run-v6` incorrectly classed superseded autocomplete cancellation as a backend failure; `run-final` checked an asynchronously captured receipt array too early. These are explicitly distinguished from production outages. Final assertions wait for fresh actual receipts and use visible canonical branding without weakening record/coordinate identity checks.

## Replay

Run from the repository with the existing Playwright installation:

```
NODE_PATH=/workspaces/zoi-city/.recovery/community-release/node_modules QA_OUTPUT_DIR=/tmp/map-feed-production-review node tests/browser/map-feed-index-production/verify.cjs
```

The runner has no interception/fake-response code and performs only public reads, normal controls and canonical links. Future live records/receipts can change; do not overwrite this frozen evidence. No runtime correction or schema change is part of this packet.

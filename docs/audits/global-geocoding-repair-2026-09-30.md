# Global geocoding audit and bounded repair proposal

Read-only audit on 2026-09-30. No geocoding provider requests, paid calls, coordinate changes, owner changes or map-code edits were made. The aggregate snapshot is `global-geocoding-inventory-2026-09-30.json`; it includes every current public-eligible country bucket. This later snapshot differs from the earlier listing inventory because ingestion continued.

## Observed scope

28,949 public-eligible records across 85 country buckets, including unknown/unnormalized country labels:

- 14,536 have no complete coordinate pair.
- 10,276 have coordinates labelled city precision; 2,386 street; 1,697 approximate; 50 unknown; 4 neighbourhood.
- 9,352 missing/nonstreet records have some base or machine address. These are candidates for **address validation**, not 9,352 verified addresses.
- 25 records have conflicting column and `_geo` precision values. No stored coordinate pair is outside numeric latitude/longitude ranges; this does not establish geographic correctness.
- 9,127 located records have no `_geo` provider/method provenance; 3,449 record city-centroid/OpenStreetMap; 1,837 record address-geocode/OpenStreetMap. Provenance counts and canonical precision counts measure different things.

| Country | Public eligible | Missing coordinates | City precision | Address candidates |
|---|---:|---:|---:|---:|
| Greece | 9,671 | 5,643 | 3,073 | 2,804 |
| United States | 7,623 | 2,963 | 3,298 | 1,757 |
| United Kingdom | 2,273 | 1,662 | 282 | 1,657 |
| Canada | 1,916 | 542 | 830 | 794 |
| Australia | 1,810 | 813 | 500 | 843 |
| Germany | 824 | 531 | 167 | 383 |
| Cyprus | 437 | 138 | 151 | 172 |
| South Africa | 288 | 80 | 108 | 136 |
| Belgium | 247 | 220 | 24 | 107 |
| Italy | 222 | 221 | 0 | 39 |
| France | 170 | 124 | 46 | 99 |

All remaining buckets are in the JSON, not excluded from scope. The `Unknown` bucket alone contains 2,095 public-eligible records and needs country identity repair before address geocoding.

## Existing assignments and weak points

`tools/geocode.py` is an offline operator script, not a durable application queue. It reads `/tmp` files, caches locally, tries public Photon then public Nominatim, and emits output for `tools/emit-geocode-sql.py`. No geocoding/location RPC appeared in the production `public`/`zoi` function inventory, and no active provider integration was located in API, scripts, edge functions or CI. This does not establish that no external account exists; billing/provider dashboards were not inspected.

The historical `0002_geocode_backfill.sql` proposed 5,859 writes (2,027 street, 3,832 city). Current observations are not proof every historical proposed row was applied.

The script derives a city anchor by averaging already-plotted listings, potentially propagating earlier bad pins. It classifies an address as street-like merely because it contains a digit or comma. It accepts the first returned candidate within 40km of that anchor, or any first candidate if no anchor exists; it does not require matching house number, street, locality, country or feature type. A 40km proximity test cannot establish a building or street address. Nominatim requests omit `addressdetails=1`, and its returned country field is generally unavailable to the current comparison code. Photon results discard useful provider identity/address detail.

On failure it assigns the city anchor to the listing coordinates, honestly labelled `city` in `_geo`, but still storing an area centre in the place-location fields. The SQL emitter only guards NULL coordinates and slug, not exact UUID/source fingerprint/owner status/address version. It overwrites `_geo`, loses the original query/provider distinction, and treats partial pairs as replaceable. It does not revisit incorrect non-NULL locations. It is unsuitable for unattended global repair as written.

The canonical read path prefers the explicit `geo_precision` column and falls back to `_geo.precision` when the column is `none`. Conflicts need review; presence of an address must never promote an approximate pin to exact. Discovery specialist owns map presentation corrections separately.

## Provider constraints checked today

The existing tools use public endpoints without API keys. Free access is not an unlimited production entitlement or availability commitment. [Nominatim's current usage policy](https://operations.osmfoundation.org/policies/nominatim/) discourages large bulk jobs, requires caching and a single machine/thread for permitted small batches, limits recurring or longer-than-day scripts to four requests per minute, and prohibits autocomplete and generic geocoding facilities offered by no-code/AI-building platforms. Its use requires an informed application-owner decision; it should not become this global suite's default backend. Do not send private addresses or contact details to public geocoders.

[Photon's official project](https://github.com/komoot/photon) describes its public server as a demo with reasonable-use throttling, possible bans and no availability guarantee. It recommends private deployment for larger workloads. The current global self-hosting guidance estimates roughly 95GB disk and recommends 64GB RAM, so self-hosting has infrastructure cost even without per-query fees. A licensed managed provider or scoped self-hosted instance requires an explicit provider/budget decision; no unverified tariff or configured paid account is claimed here.

## Proposed workflow, reusing existing quality operations

1. Derive per-profile address-repair tasks from the existing inventory/quality report chain. Include exact listing UUID, public eligibility, source identity, source URL/date, address hash, current coordinate pair/precision, owner-content hash and quality fingerprint. Do not introduce another independent listing registry.
2. Prefer exact coordinates explicitly published by the business's own verified structured data/contact map, checking that the place and address match. Then consider an approved geocoder for the verified **public business address**. Street text alone, a third-party directory brand, a postcode centroid or a city match cannot certify a door.
3. Retain provider/version, query components, returned feature/address components, precision class, stable provider feature ID where permitted, licence/retention constraints and immutable source evidence. Cache only as provider terms allow. Require house number/street/locality/country consistency; handle aliases and transliteration explicitly. Conflicting or multiple plausible candidates go to review. A closed PO box, service area, virtual office, school campus or mall unit needs separate treatment.
4. Keep place coordinates separate from area context. An unresolved address stays unresolved; city context supports browsing but must not replace a place pin. A verified campus or building centroid is not a verified entrance or accessibility route.
5. Use a small extension of the existing lease/finish pattern for a geolocation task, with a dedicated reviewed apply function rather than broad `enrich_apply` or generated direct SQL. The apply operation must compare exact UUID, source/address fingerprint, old coordinate pair, precision, owner hash and lease expiry under row lock; refuse owner-managed or changed records; write coordinates and one canonical provenance record atomically. Preserve a before-image for exact rollback, pending artifact for ambiguous receipts, and never blindly retry a write.
6. Before activation: test swapped latitude/longitude, country mismatch, same-name cities across countries, numeric/postal-only addresses, multiple branches, moved/closed businesses, partial coordinate pairs, antimeridian, Unicode/transliterated streets, changed source, owner correction during lease, deletion/private status, provider429/timeouts, malformed results, duplicate receipt and lost-response reconciliation.
7. First canary: at most three independently verified public addresses from **three countries**, selected after source review, no cost-bearing provider call without configured budget. Require separate source-match, map rendering and directions-target evidence for each. A successful canary permits a capped, country-balanced queue; it does not justify mass write or call all 85 buckets verified.

The existing script should remain an historical manual tool until these guards and a suitable provider are in place. The current deliverable is a measured global repair plan, not a running geocoding service.

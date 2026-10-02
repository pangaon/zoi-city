# Legacy discovery visibility correction · separate candidate

Fresh installed definitions, ownership, ACLs and full-definition hashes are retained in `evidence/discovery-legacy-reader-preflight-2026-10-02.json`. This candidate is separate from the five-count geography/index packet and does not modify its files. No production write, migration application, restart, grant change or deployment was performed by this lane.

## Exact correction and consumers

CLI-created migration `20261002223454_discovery_legacy_reader_visibility.sql` changes only visibility predicates in two current SQL functions. The direct JSON `explore_geo(text,text,text,text,integer)` gains moderation IN clean/cleared while retaining its existing published/nonhidden checks. `dir_browse(text,text,integer,integer)` changes clean-only to clean/cleared and adds the nonhidden gate. Both replacements guard exact installed full-definition hashes, postgres ownership and ACLs before either function is changed. Existing SQL language, STABLE/security-definer status, empty search paths, signatures/defaults, return fields and grants remain intact.

The active `explore_geo(integer,integer)` map reader is not replaced. Its source and metadata remain byte-for-byte unchanged in isolated testing; production source shows that it already inherits moderation clean/cleared and duplicate visibility through `zoi.v_public_listings`. The active map uses that integer overload. This packet does not promise that GIS coordinates, source precision, clustering, global mapping coverage or the map experience are complete.

Current `explore/app/index.html` calls dir_browse for nearby/recommended clients, events, parish selection, creators and businesses (including lines1237,1608,1664,1726,1881). Projection and ordering are retained for those consumers: exact UUID, coalesced owner display name, raw city/country, category, website/phone, editable brand logo/colors/tagline, rating/count, bookable/sells_products defaults, claim and verification fields. JSON map keeps the UUID, name, stored canonical path or existing `/p/<slug>` fallback, lat/lng, entity type, city and nullable verified flag. No ID, path, alias-normalization, ranking, default limit or locality behavior is rewritten in order to fix visibility.

## Isolated proof

`node tests/database/discovery-legacy-reader-visibility.integration.mjs` passes 12 groups on PostgreSQL16 with 4,803 controlled records and 3,520-byte wide payloads. It first reproduces all three concrete defects with the actual installed bodies: a cleared sparse parish is missing from dir_browse, a hidden event is exposed, and a pending mapped record is returned by direct JSON explore_geo.

Expected outputs are then obtained from those exact installed functions on a physically eligible-only corpus. Cleared records become clean only during this controlled oracle stage to compensate for old dir_browse's omission; no projected or ranked field is changed. The original corpus is restored byte-for-byte before applying the candidate. This oracle checks the existing deployed projection/filter/ranking contracts without inventing a new renderer or rewriting the reader query as the expected implementation.

- 70 directory comparisons cover each recommendation/event/parish/client type, sparse and populated records, Unicode, NULL/empty/local city and wildcard filters, raw country aliases, unchanged brand projection, ordered ratings/completeness/names, negative/NULL/default/clamped limits and offsets, and empty pages.
- 21 JSON map comparisons cover stored canonical paths and existing fallbacks, exact IDs, nullable coordinates, zero coordinates, verification/trust/ID ranking, full-text and substring/wildcard queries, raw country alias distinctions, city/type filters, and existing NULL/min/max limit behavior.
- Changed bodies or widened execute grants refuse the whole migration before either function replacement. Metadata and listing digests prove return/default/security/ownership/ACL/data preservation; the active integer reader body is unchanged.
- An eligible sparse parish exercises all existing public roles. Direct private listing-table access is refused. Owner name, display name, path, website, phone, logo/colors/tagline edits appear through the existing fields. Explicit brand clears remain clear, and current hiding removes the record from both readers immediately.
- Empty table returns the existing empty shapes; replay against already-replaced bodies fails closed.

Controlled evidence: `evidence/discovery-legacy-reader-visibility-isolated-2026-10-02.json`, retained database log and exact file hashes in `evidence/discovery-legacy-visibility-candidate/manifest-2026-10-02.json`. The fixture's helper for geo_precision_canon is only enough to compile the untouched integer body; this is definition-preservation evidence, not acceptance of that helper's real production precision behavior.

## Remaining acceptance

Lead must independently review the separate packet, revalidate installed prerequisites and apply it using the release's migration-state checks. The migration has bounded 5-second lock and 30-second statement timeouts and performs no index build or table updates. Observe authoritative state after any uncertain result before retrying.

After application, verify function/ACL readback and actual public reader behavior, then exercise the ordinary recommendation, event and parish consumers with real eligible/sparse records. No live customer-facing consumer journey or production reliability claim is inferred from this controlled SQL suite. No frontend, native, provider or mapping-quality work was added to this packet.

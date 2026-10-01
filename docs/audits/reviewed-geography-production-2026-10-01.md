# Reviewed geography writer and first production correction

## Applied schema and security

Local migration `20261001035423_reviewed_geography_apply.sql` was applied to production as migration `20261001041402`, name `reviewed_geography_apply`. SQL SHA256 `efd477760fb2bd62e433748a741c5ed9745db9c2d8dd9509f35e4053f554d08b`.

The lead independently reviewed the reviewer's source-path canonicalization correction and reran all eight actual PostgreSQL test groups. Literal/encoded traversal, sibling properties, ownership transfer, stale or mismatched evidence, malformed profile JSON, concurrent competing writes, exact retry and guarded reversal are exercised. Only the service role may apply or reverse reviewed coordinates; production privilege checks confirmed anonymous/authenticated execute false for all three functions, empty search paths. The evidence ledger is private with RLS and no application-role grants.

Security advisor output retains existing platform warnings. The new ledger adds one expected RLS-without-policy INFO because application roles must never query it directly; it is accessed through the privileged reviewed writer. No new geography function warning was present. This is not a database-wide security clearance. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Stalactites correction

Exact listing `054dd95e-5253-4a86-9630-fe91c3f29c90`. Sources: official restaurant and City of Melbourne named-restaurant page independently publish the same point and address. Separate specialist collection and reviewer artifact are retained; the numeric envelope is explicitly a reviewer-defined plausibility guard, not an official municipal boundary or surveyed entrance.

Before apply, current whole-row snapshot `0673cf29fcc77e2ea8ff1e82919661fe` and quality fingerprint `ac41a1c6802308fb9ecb47f5df2f7ce7` matched the frozen evidence. Record remained published, clean, eligible and unowned.

Applied once under service_role with request `59ca1977-37f5-4d02-8a35-c2cb68346be6`:

- Previous approximate point: latitude -37.8136, longitude 144.9631.
- Reviewed venue point: latitude -37.8110808, longitude 144.9670491; precision street.
- Exact report hash: `3a429c55350155a034a51553d5918c81af76ac85e316599ad9d7f122e6d19498`.
- Resulting whole-row snapshot: `81d165fe5f031baebfa84992f8ef0967`.
- Unrelated profile hash before/after: `3ae5d799797fc2a8def5a023352c83a5`, unchanged.

The new private ledger retains old geographic fields, source/review evidence and receipt. An exact guarded reversal is available while the row remains unchanged and unowned; no reversal was performed on production. Coordinate request preparation preserves report bytes and explicit request identity; it makes no network call and is not authorization by itself.

Public map/browser acceptance is assigned separately to the independent specialist. Database success alone does not close that acceptance. This is one verified source correction, not completion of worldwide geocoding. AMARA, Parkview and other source candidates remain review work.

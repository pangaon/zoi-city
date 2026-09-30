# All published profile inventory — 30 September 2026

**28,933 individual profile reports** were generated across all 12 entity types, matching the expected published-row count and rejecting duplicate IDs. This is a read-only stored-metadata inventory: **0 source visits, 0 rendered visits, 0 exercised journeys, 0 quality receipts or listing writes**. It is not a completed visual or functional audit.

Snapshot SHA256: `e23072b5fccb386f22f979d7ec70f646d78fe4292f5340a88c2e6a168241f294`.

Each report contains its listing ID, slug, entity type, current stored source fingerprint, public eligibility, owner-managed flag, existing quality task states, capability hints, and specialist follow-ups. Source, rendered and journey evidence are separate and explicitly unvisited in this run. Every report references the existing `listing_quality_checklist` RPC; the inventory does not invent criterion signoffs. Pages were read over an interval, not one database transaction.

Private retained artifacts:

- Individual reports: `/workspaces/zoi-city/.recovery/quality-inventory-20260930/final/profiles/<listing-id>.json`
- Specialist index: `/workspaces/zoi-city/.recovery/quality-inventory-20260930/final/repair-plan.json`
- Summary: `/workspaces/zoi-city/.recovery/quality-inventory-20260930/final/summary.json`
- Input pages: `/workspaces/zoi-city/.recovery/quality-inventory-20260930/snapshot-v2/`

The compact committed aggregate is [all-published-profile-inventory-2026-09-30.json](all-published-profile-inventory-2026-09-30.json). The 28,933 individual reports are intentionally kept out of the public repository. The release lead also archived the private evidence separately.

## Specialist priorities

1. **Source enrichment:** 3,494 records lack a stored source reference; 23,318 lack a primary image in the inspected fields; 16,308 lack direct contact in those fields. Review canonical source identity and owner clears first. These are metadata hints, not proof every category renderer lacks the capability. Fix shared extraction/projection defects before individual overrides.
2. **Location:** 14,503 records lack coordinates. Resolve official street/venue evidence; never present a city centroid as an exact venue pin. There is no automatic geocoding side effect in enrichment apply.
3. **Classification:**the stored classification task is not currently verified for 28,932 records. Reuse source fingerprints and existing checklist evidence; this count does not negate unrelated human knowledge or separate criterion evidence.
4. **Design and journey QA:**all 28,933 stored design/verification task states are not verified in this inventory. Open the actual public route on desktop/mobile, inspect images and empty states, exercise controls, and record evidence independently before signoff.
5. **Visibility:** 28 published records are not public-eligible. Review moderation/visibility; do not force them public during enrichment.

Assembly is resumable and immutable:

```sh
node scripts/quality/inventory-reports.mjs <snapshot-directory> <output-directory> <expected-record-count>
```

The repair-plan is a per-profile specialist work index, not an assertion that repairs have run. Subsequent source, visual and customer-journey evidence must update the existing quality system. Background full-inventory repair remains separate from this completed inventory export.

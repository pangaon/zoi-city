# Per-listing master checklist

Candidate migration 20260930074014, not deployed. Extends existing quality leases and receipts; no duplicate task queue, no owner content changes.

## Criteria and coverage

Versioned master criteria include shared identity/source, visual desktop/mobile, accessibility, SEO, functional empty/error journeys, owner edit→preview→publish→public read, explicit clear/conflict/retry/account switching and source imports preserving owner edits. Family criteria add menu/prices, restaurant hours/address/photos/service channels, parish programmes, music playback/shows, creator collaboration, professional identity, venue layout/admission and bakery products. All existing real category slugs receive a category-specific journey criterion, in addition to shared/family requirements. Slug mapping uses exact live taxonomy values read on 2026-09-30; ambiguous broad categories remain general rather than pretending they are restaurants.

`listing_quality_checklist(p_listing)` is service-only and computes each listing’s pending criteria without seeding 31k rows. `zoi.v_listing_quality_checklists` provides service reporting; query by listing IDs/keyset pages rather than aggregate all detailed JSON unnecessarily. New listings automatically get their existing category criteria. A newly created category requires its category master criterion to be added; shared criteria still apply in the meantime. Current seed category criterion is a category-specific acceptance requirement, not a claim that every category has a bespoke automated test implementation.

Status: pending, pending_recheck, blocked, blocked_visibility, awaiting_independent_review, signed_off. Complete requires every applicable criterion signed off. No field existence or HTTP200 creates a pass. Seven-day evidence expiry forces recheck.

## Evidence write

`listing_quality_criterion_record(p_request,p_listing,p_criterion,p_revision,p_stage,p_actor,p_specialist,p_lease,p_fingerprint,p_commit,p_status,p_evidence)` returns `{ok,id,already}`. Existing exact UUID request retries return the same receipt; changed payload rejected.

Specialist stage requires an unexpired existing classification/design/verification lease of the criterion’s task with current original lease fingerprint. It does not consume that lease; normal task finish remains separate. Reviewer stage references the exact passed specialist receipt, uses a different attested worker identity and at least one independently hashed artifact, and must match release commit/revision/source fingerprint. Actor strings are trusted service-pipeline attestations, not cryptographic proof of human identity. Never label machine checks human signoff.

Evidence `{kind:'source'|'render'|'journey',performed:boolean,observations:string20..6000,refs:[{uri:HTTPS artifact URI,sha256:64hex}],blockers:[]}`. Max12 refs/16KB JSON; public/customer roles cannot call or edit ledger. Keep private credentials/customer data out of artifacts. Passing requires performed=true and zero blockers, but the backend does not pretend it can determine whether an artifact proves the requirement. Independent specialist/reviewer execution and artifact inspection are operational requirements.

Source fingerprint includes existing listing fingerprint, relevant base row values and machine source facts, excluding worker lease fields. Owner changes and source changes invalidate earlier signoff without touching content. Hidden/flagged/unpublished listings remain represented as blocked visibility.

## Shared changes and existing pipeline

`listing_quality_criterion_revise(key,expected_revision,requirement)` appends a revision; all affected listings immediately show pending without bulk writes. Release workflow must explicitly revise each affected criterion when shared behavior changes. It does not automatically infer affected functionality from Git diffs.

`listing_quality_criteria_requeue(after UUID|null,limit1..20)` scans one keyset page and resets only previously verified existing coarse task receipts that now need criterion recheck, preserving active leases, blocked/retry policies and owner fields. Continue via returned next_after. Then reuse existing `listing_quality_task_lease` and `listing_quality_task_finish`. Independent reviewer work consumes the specialist evidence ledger, not a new queue. A source fetch alone never signs off a journey.

Restaurant audit `{id,fields:{images,menu,hours,address,contact}}` uses presence states rendered/no_available_profile_data/owner_explicit_clear/source_present_but_not_rendered/identity_artwork_not_venue_photo. `sourcePresenceEvidence` explicitly marks this insufficient for signoff; actual source identity, visual and journey artifacts must follow.

## Tests and release manifest

11 real isolated PostgreSQL checks: all-row pending, private grants, blocker refusal, idempotency, independent reviewer, no false listing completion, changed request rejection, owner/source invalidation, shared revision, hidden visibility, exact category mapping, and bounded existing-queue recheck preserving owner wording. Two unit tests cover truthful summaries and presence-only rejection.

Files:
- supabase/migrations/20260930074014_listing_quality_criterion_signoffs.sql
- assets/quality/CONTRACT.md
- assets/quality/checklist.mjs
- tests/database/listing-quality-criteria.integration.mjs
- tests/unit/quality-checklist.test.mjs

No production signoffs have been created. Historical coarse verified states are not imported as criterion passes.

# Independent Toronto catalogue / route review

Reviewed lead-owned vercel.json and events/giannis-ploutarchos-andromache-toronto-2027/index.html, plus artist-owned ops/toronto-event-catalog-proposal.sql and docs/audits/toronto-event-catalog-proposal-2026-10-01.md. Read-only review; no database operation executed.

## Accepted source changes

The two exact singular /event/... redirects target the existing plural /events/.../ interactive experience. Both slash variants are covered and rules precede the generic event rewrite. No other event is redirected. The destination file exists and still mounts the existing signature experience and signature-room container; no duplicate generic page is introduced. The HTML change adds only a canonical URL matching its existing OG URL. The intentionally retained noindex remains a publication limitation, not a claim of completed SEO.

The destination has no query replacement or fragment. Vercel documents query pass-through unless explicitly replaced (https://vercel.com/docs/routing/redirects). Browser fragments are not sent to the redirect server; a fragmentless Location preserves the incoming fragment in normal browser navigation. Existing destination anchors include #sig-request, #signature-room and #signature-save. An arbitrary #room or #offerings is not made valid by this redirect: it can remain in the URL without corresponding to a Toronto element. The change promises route compatibility, not new fragment aliases.

## Proposal safeguards and evidence

The SQL is BEGIN/ROLLBACK by default, uses one advisory lock, validates the exact Signature organizer ID/slug/type/website and category, rejects likely duplicate identity/source/name/location, and inserts one database-generated ID without upserting another record. It grants no user/workspace ownership and creates no table inventory, holds, payment policy or coordinates. Post-insert checks reject ownership, bookable, coordinates or claim-status drift. The organizer relationship is descriptive profile data only.

Independently compared retained official HTML, poster and source-facts SHA256: all three match the proposal audit. Official retained HTML states March 20 and Parkview Manor and ten seats per table/booth; the 2027 year is explicitly sourced to the retained poster/source module. No currency or fee inference is inserted. The proposal's published status is catalogue visibility, not a booking capability. No live customer values were read in this review.

## Required integration proof / limitations

Source-level route and proposal review passes. Neither the rollback proposal nor deployed Vercel behavior was executed by this reviewer. Root should verify real production Location and query retention, browser fragment target, search → singular route → existing room, organizer link, and table-selection → group flow at phone/desktop widths before catalogue acceptance. Effective canonical_path after database triggers must be read back, and the generated event ID must not imply configured inventory or owner authority. Native handoff and complete SEO acceptance remain separate.

No blocker in the bounded route/canonical change or default-rollback proposal was identified. Full event readiness remains open.

# Shared identity and event page release — 1 October 2026

Commit6f3c6480fcf0974d1885a21ff9d1f7d46d4f2803 is on main. CI36854870801 passed; Vercel2tAALSGDNCyjm2PrwfAo9nWsnrmG succeeded. Nine served modules/pages match reviewed local bytes exactly (/tmp/identity-event-production-bytes.json).

Shared actor identity now resolves UUID or empty, rejects conflicting metadata/JWT UUIDs, and never uses email/raw token as scope. Unresolved sessions preserve anonymous public Community browsing while refusing private reads. Community, Business home and locality fence refresh before sending. Community clears previous-account private dialog fields immediately for auth/storage/focus changes while preserving same-account drafts.

Independent controlled evidence:14 focused units, six actual consumer browser cases, extracted queued wrapper transport tests, default locality refresh-switch zero-fetch test,18 private-dialog switch cases and12 same-account close/reopen checks. Tests use synthetic sessions, not production account mutation. Post-download equality establishes served code identity, not live private backend availability.

Event family fallback preserves Signature/Parkview family tools after owner website edits/clears, without borrowing curated imagery or event details after source mismatch. Twelve focused units and16 actual handler/renderer controlled journeys passed. Full release initially caught two obsolete null expectations; these were changed only for website mismatch and now assert generic content without curated leakage. Other visibility/type rejection gates remain. Final staged tree5456a93e065588415997f5d00bf94271758e39c3 passed269 node:test files and two standalone suites. Actual production owner save remains unverified during the database incident.

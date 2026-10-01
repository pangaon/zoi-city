# Owner onboarding and selected-listing context — 2026-10-01

Candidate, not a production deployment claim.

Guided intake already emits workspace and exact listing in its authorized draft editor link. Three later transitions lost that identity: native `openOwnerEditor` verified a specific listing but omitted it from the browser URL; the shared editor silently substituted its first authorized listing if the requested ID disappeared; and Retry after a failed content read called boot without the requested ID. The suite design hash route also discarded the query string (root owns that separate integration).

The shared editor now treats explicit listing intent as binding. Missing, malformed or duplicate IDs show an unavailable message and explicit authorized choices; no different business is loaded implicitly. No-ID entry retains its ordinary first-choice behavior. Read retry retains the same ID. Successful exact loads call `ctx.onListingSelected({workspaceId,listingId})`; root’s shell owns the guarded history/currentRoute update. Standalone mounting uses the same selected query fields locally. Native authorized web handoff now carries both workspace and listing, never auth credentials.

Evidence: eight intake/handoff focused checks pass. Actual shared editor mounted at 390/1440 loads the second of two businesses, preserves it after a failed-read Retry, makes zero private-content reads after access disappears, then loads the first only after explicit chooser activation. The fixture contains synthetic records and controlled RPCs, not a real production owner session. Zero page errors. No provider requests or mutations.

Files: `assets/suite/bizpage.js`, `mobile/src/ownerEditorHandoff.ts`, `mobile/tests/ownerEditorHandoff.test.mjs`, `tests/unit/intake-draft.test.mjs`, `tests/browser/owner-listing-intent/`. Root owns `social/index.html` query/callback integration. Physical native browser opening and production authenticated intake→publication remain distinct acceptance gaps.

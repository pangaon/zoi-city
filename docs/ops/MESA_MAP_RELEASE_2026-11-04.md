# MESA connected festival map — 4 November 2026

## Scope

This extends the existing Zoi festival operator and applicant suite. It is not a separate vendor database or a replacement for the business home editor. Organizers compose a measured SVG booth plan; applicants propose a business they currently manage; organizers accept it; a separate publication exposes only the visitor-safe map and current published business identity.

Supported web controls: six stand templates (market, food, florist, photo booth, DJ, community), drag/keyboard positioning, dimensions/rotation, approved application allocation, bounded undo/redo, account-scoped same-tab recovery, save versus publish, connection review/revocation, public stand list/selection, zoom/fit, stand-specific sharing and copyable come-visit captions. Captions are text and links; automatic promotional video is not implemented.

Entry points: `/social/festival` for the current workspace organizer; `/festival/` for the current applicant; `/festival/?event=HOST_LISTING_UUID&view=map` for a published visitor map. The organizer supplies the actual host ID. No real event, application or business was invented to populate a test link.

## Verification boundaries

- Isolated PostgreSQL: 17 groups exercise the actual migration and existing current-session/workspace/home authority function bodies. The public home projection is a documented synthetic stub in this harness.
- Pure frontend/model: 12 Node tests cover geometry, immutable editing/history, public redaction, URL safety, escaping, existing overlaps and revoked-access error classification.
- Isolated browser: real frontend modules with in-memory synthetic RPC responses; nine groups, desktop/390px, light/dark, twelve screenshots. This is not production Auth or live-provider acceptance.
- Source, rendered screenshots, exercised synthetic behavior, hosted schema and production deployment must be recorded separately. Do not infer a live real-event organizer/vendor journey from these fixtures.

## Release and recovery

Apply only `supabase/migrations/20261104183348_mesa_festival_maps.sql`, after the isolated contract passes. Never replay the repository's historical operations request files or blanket-push migrations. This is additive: four private RLS tables, guarded RPCs and no changes to existing application/commercial data. Roll back the web deployment to its prior exact Vercel revision if needed; preserve saved map and audit records. Revoke the new RPC entry points separately if a backend defect warrants containment; do not drop user drafts/audit data.

Keep the five pre-existing main commits ahead of the previously live Zoi revision. They are not MESA scope, and their old operational request files must not execute again.

## Remaining product scope

Rich owner-managed booth presentations/media and badge membership, automatic come-visit video rendering/distribution, quotes/contracts/invoices/payments, rental stock/crew/vehicles/logistics, imported venue drawings/3D, church/hall/vendor permissioned availability matching, wedding/baptism confirmed bookings and native implementation remain open. Existing `docs/recovery-scope.json` remains authoritative and was not replaced by this milestone. Web availability does not imply installed iOS/Android parity.

GoodEvent references and capability distinctions are recorded in George OS `docs/research/GOODEVENT_TO_ZOI_2026-11-04.md`. Research used official video metadata/descriptions/chapters and product pages; full video playback/transcripts and the entire channel were not available for verification.

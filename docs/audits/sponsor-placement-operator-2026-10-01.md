# Sponsor artwork in the existing festival operator

Candidate implementation, 1 October 2026. No production sponsor approvals, storage uploads, customer writes or payment actions.

## Changed journey

Approved sponsor application cards in the existing festival operator expose Manage artwork for owner/admin. The embedded editor loads the exact event's current configuration, artwork and permission. It supports initial front/side configuration, new or existing drafts, HTTPS image and website references, explicit UTC scheduling, draft preview, save, separate approval, and revoke. Allocation approval never substitutes for artwork approval. Existing festival CSS supplies aligned controls, rounded cards and responsive layout.

The module uses the reviewed frozen RPC contract, without schema changes. Current versions are supplied on every mutation. Conflicts preserve typed edits and require refreshing authoritative current versions. Edits invalidate the preview and approval button until saved. Editing saved artwork resets server approval to draft.

Before sending, an exact request with stable UUID and payload is preserved in session storage under actor/workspace/event. Storage failure prevents sending. Unknown results lock further edits; Check receipt and Retry exact request retain the original identity. A missing receipt is not cancellation. Remount recovers the pending request. Confirmed historical receipts are followed by current operator refresh; a failed refresh after confirmation says so without resending. Response identity/version/status is checked before treating a request as confirmed.

Account changes remove private UI, abort listeners and fence late results. The parent operator receives the same account fence. A pending request remains scoped to its original actor for later recovery, never displayed to the new account. Existing event/permission authorization remains server-enforced.

## Exercised evidence

`node tests/browser/festival-placements/verify.cjs` passes 390 and 1440 widths against the actual operator, artwork module and festival stylesheet with a controlled backend transport. Cases: application entry, initial configuration, preview/save, approval/revoke, lost committed response and remount/receipt, retained conflicting draft, missing receipt/exact retry with unchanged nonce, blocked session storage preventing send, read-only role downgrade, account cleanup and late result after account switch. Both report zero page errors. Preview screenshots `/tmp/sponsor-artwork-preview-{390,1440}.png`; 390 screenshot inspected for readable labels, controls and contained artwork. `node --check` on both modules and `git diff --check` pass.

Frozen hashes:

- operator.mjs `764bd98dc3192e0d848f7eb52dd47ea29014ef309c7e1c972751f68ec372fecd`
- placements.mjs `5ef4918986d0b8d285e7f83d57d5e73cef8617fdfe265c990d7a2f7ae6fa01dc`
- verify.cjs `472fb48eec58a9921ba0c838c5d445e57af71a07fd9ce4146ceab38bb67dd903`

## Remaining boundaries

These are source/rendered/controlled-journey checks, not production transactions. The backend remains unapplied in this lane. Root owns integration and public room consumption, expiry/revoke polling and final deployment evidence. No dedicated native editor exists; this implementation is the responsive web operator, with native handoff not exercised here. External images are references, not byte-validated uploads or immutable approved assets. Broken images receive a visible preview fallback. There is no payment collection, table assignment or proof that a real Toronto/Montréal sponsor has been approved.

Independent review caught authorization denial during receipt/read recovery retaining old private UI. Corrected every denied read/mutation path to clear both embedded editor and parent operator while retaining the original actor-scoped request for recovery. Added a real browser regression: unconfirmed request → viewer denial on receipt → private UI removed → restored owner remount → exact retry. Both widths pass. Pending storage now has a 16 KB bound and UUID/version/action/exact argument-shape validation before any retry.

Final review follow-ups: confirmed mutation followed by forbidden authoritative reload now clears private state, as does parent operator Refresh denial. Added both browser cases. Child artwork exposes unsaved state; parent refresh/new/edit/filter/pagination/application decisions and switching artwork guard destructive navigation, as do child new/select actions. Cancelling parent Refresh demonstrably preserves typed artwork. Final suite runs 16 journeys per width with zero page errors; no backend or public-room changes.

The equivalent parent saved() refresh-denial catch now uses the same access-loss cleanup. Added actual parent application-action confirmation followed by denied operator reload; final 17 journeys per width pass.

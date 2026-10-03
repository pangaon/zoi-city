# Independent owner source-health acceptance — 2026-10-03

Accepted the exact frozen frontend candidate, manifest `d02062a7d33eb11de5760254d4cf9e69bb0eecb4cdc3b96199e26321fb8362e0`. All 370 retained files were reconstructed into an independent snapshot and every size/SHA matched. No producer file, runtime, schema or customer record was changed by this reviewer.

## Source review

The three candidate runtime files are `assets/suite/source-health.mjs`, `assets/suite/source-health.css`, and `assets/suite/bizpage.js`. The dependency map identifies ten static/dynamic import edges, all retained in the producer manifest, including the existing official-source policy, owner projection, session identity, public profile/editor, and owner media/editor modules. The existing `assets/enrichment/official-source-policy.mjs` supplies outward URL selection; the new panel does not invent another public authority policy. Held imported links are displayed as text and have no outward anchors. Source-host rendering uses textContent; reviewing does not fetch a source, verify ownership, remove a hold, or mutate enrichment evidence.

Website actions edit the existing Page details draft. The existing authenticated `home_content_get` snapshot and `home_content_save` CAS/request receipt flow remain authoritative. Owner/profile presence has priority over imported defaults, including same-host owner edits and explicit null/empty clears. Current account/workspace fences run before and after auth/RPC waits. Source module failure leaves Page details usable and offers a fresh-module retry. Disposal removes listeners and stale private panel content.

## Rendered evidence

Independently replayed real browser modules from the retained snapshot at 390 and 1440 pixels. Inspected the phone/desktop Page details composition and both-theme source-review screenshots under `evidence/source-health-owner-independent-2026-10-03/replay/`. The panel text, focused buttons, wrapping saved address, removed-link state and light/dark tokens are readable. Phone controls stack with adequate touch areas and zero horizontal overflow. Desktop source panel stays within the Page details column; the existing public preview is separate. This is owner-editor rendering, not a claim of all category public-home design coverage.

## Exercised journeys

- Exact producer unit command: 28 tests pass. Includes owner precedence, null/empty clears, source quarantine, invalid draft warnings, sparse model and existing public owner/media policy.
- Producer browser replay: 14 controlled DOM journeys pass. Four model families at both widths exercise owner edit/save, keyboard restore, explicit clear/save/reload and actual shared public-policy selection. The other cases exercise sparse sources, lost response replay with exact request ID/payload, CAS conflict preservation, private read refusal, account removal and optional module failure/retry.
- Separate reviewer browser verifier: 20 controlled DOM journeys pass. At each width, account and workspace changes are injected during auth, private read and private write waits. Auth changes cause zero writer calls; late private replies never repopulate the panel or display successful publication. Remount during an outstanding save does not replace the fresh snapshot with the old response. Backend write refusal preserves unsaved text and prevents another write without reloading authority. Wrong-listing receipt retains uncertain-save recovery and disables further draft edits. Delayed optional-module retry cannot restore a private panel after account change.

All browser network traffic is restricted to the isolated local fixture. These are actual DOM/runtime checks with controlled backend responses, not proof of an authorized production customer edit, source-provider fetch, native owner tools or live public-page readback. Release/cache integration and current production acceptance remain with the lead. The newly installed fourteen source repairs are a separate packet and are not silently included in this verdict.

## Reproduce

Reconstruct the producer `manifest.json` entries from its relative `snapshot` mapping, verifying SHA and bytes first. In that snapshot:

```sh
node --test tests/unit/source-health.test.mjs tests/unit/owner-entity.test.mjs tests/unit/owner-home-content.test.mjs tests/unit/public-owner-media.test.mjs tests/unit/official-source-policy.test.mjs
QA_OUTPUT_DIR=<independent-output> NODE_PATH=<checkout>/node_modules node tests/browser/source-health-owner/verify.cjs
```

Reviewer negatives, in this checkout (runtime source remains the independent snapshot):

```sh
QA_SNAPSHOT=<reconstructed-snapshot> NODE_PATH=<checkout>/node_modules node docs/audits/evidence/source-health-owner-independent-2026-10-03/verify-negatives.cjs
```

Retained receipts, logs, JSON reports, screenshots and the independently authored verifier are under `docs/audits/evidence/source-health-owner-independent-2026-10-03/`.

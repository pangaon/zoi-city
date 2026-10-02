# Parea roster independent acceptance — 2026-10-02

Reviewed the new memory-only multi-recipient planner, existing host client, retained host writer and actual composed host/contact/share/payment UI. No implementation edits, customer writes or live API probes.

## Found and corrected blocker

Original frozen host `c050a578…` checked connection, actor and route but not ownership of its contents. During a held authentication refresh, replacing the connected host container with an unrelated tool still dispatched one guest write and redrew the old private roster over the replacement. Retained adversary `tests/browser/parea-roster/surface-independent.cjs` reproduced `{writes:1,replacement:0,roster:1}` at 390 pixels (`/tmp/parea-roster-surface-independent.log`).

Producer corrected the host to a captured child surface with synchronous pending-removal checks before dispatch, permanent disposal and cleanup of that child alone. Corrected host SHA256 `bafeab4213c53c155a76725e401f7162541d7f0029911e48d9939b38197ead4a`. Independent rerun at 390/1440 now shows `{writes:0,replacement:1,roster:0}` and passes the remaining journey (`/tmp/parea-final-surface-independent.log`). Producer fixture also exercises remove/reinsert, account and route changes across held refresh; fresh independent full run passes both widths (`/tmp/parea-final-verify.log`).

## Source, rendering and exercised behavior

Existing retained `event_host_guest_save` locks allocation/settings, validates current host/ownership, checks guest version and total active quantity against allocation quota, then writes a per-request payload-bound receipt. The browser plan does not substitute for this authority or claim a bulk atomic transaction. Each request uses its own guest ID, version zero and random token. Client receipt validation checks identity/quantity/version; tokens remain in memory and URL fragments, while durable pending markers contain only request identity and kind.

Actual controlled module chain passed: configured table min/max/default → Operations contact name reuse → quantities 3/2/1 → explicit review → first saved, second committed but response lost, third not sent → exact recovery without duplicate → new review saves remaining recipient → Maria-specific private link → another guest session accepts exactly two tickets → organizer-enabled pay-at-door preference stays unpaid. Reduced quota stops all writes. Reload resolves the existing ambiguous request without restoring unsaved names or lost secret tokens; replacement-link controls remain available for confirmed unclaimed guests. Sixteen planner/host/client/recovery units also passed (`/tmp/parea-roster-unit-independent.log`).

Phone roster screenshot `/tmp/parea-final-verify/390-roster.png` visually inspected: separate recipient cards, quantities and CAD amounts, clear “not sent” state, usable share actions and visible draft/reload explanation. Source furniture/table inventory is not generated or changed by this feature.

## Acceptance boundary

Corrected local candidate accepted for integration. CSS `054c6418…` and planner `08c8fc7d…` unchanged from producer freeze. Browser transports are controlled; retained writer source was inspected but not reapplied or live-transacted here. Production organizer ownership/configured inventory, payment-policy backend release, provider delivery, admission issuance and native device use remain separate gates. Pay-at-door is a saved unpaid preference, not payment collection. Operations contacts are not automatically Audience identities/consents. Parent owns release and cache chains.

Additional independent permanent-removal case: the captured child is removed and immediately reinserted while refresh is held. At both widths the resumed action sends zero writes and leaves that reattached child empty. This runs alongside connected-parent replacement in the retained independent fixture; all four adversarial cases pass on `bafeab4213…`.

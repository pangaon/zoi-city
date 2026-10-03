# Native Parea operating candidate

This candidate replaces the existing native browser handoff with the host and guest operation inside the Events suite. It uses the existing allocation, guest, claim, receipt, cancellation and payment-preference RPCs. It does not activate inventory, issue admission tickets, collect payments or send messages automatically.

The host assigns whole quantities such as 3/1/5 at the actual per-guest price. Each saved recipient gets a separate random capability. The host explicitly opens the device share sheet or reveals the private link. A guest pastes the canonical invitation, reviews current details, claims it and chooses an unpaid door arrangement only when the current organiser policy allows it. The payment policy version, deadline, claim holder and allocation expiry remain authoritative.

The native adapter injects a strict JSON clone into the shared host client; it does not install a global structuredClone polyfill. The payment validator comes directly from the shared pure client. Names and capabilities remain in the mounted account/event view. Durable storage contains only validated nonce/scope references; persistence is confirmed before dispatch. Lost responses reuse the original request. Reopening recovers the exact receipt; an unknown request can be cancelled explicitly. A lost unclaimed link can be replaced with the current guest version. Sharing or link display rechecks current guest status/version and allocation authority first.

Account, workspace, event, foreground/remount and token-await boundaries invalidate private continuation. Read failures clear private detail and disable editing. A failed durable clear blocks the next operation. Current allocation detail also updates the host overview counts after a successful save or recovery.

## Separate evidence

- **Installed source:** `evidence/native-parea-producer-2026-10-03/current-authority-*.json` and the authority packet retain the actual existing function definitions. The Toronto and Montréal activation inventory is retained in `evidence/event-suite-inventory-2026-10-03/showcase-activation.json`: both examples lacked owner/inventory/allocation configuration when read. This candidate cannot make them bookable through client code.
- **Rendered and exercised native UI:** the actual compiled Expo App runs host 3/1/5, lost-response reconciliation, unique private links, explicit sharing, guest claim, unpaid choice recovery, organiser policy change and signedout clearing at 390 and 1440. A separate fixture exercises absent/expired allocations, unmount during a pending response, changed guest versions, unsupported sharing, denied private reads and exact unknown-request cancellation. These fixtures control the API responses and do not prove production RPC reachability or physical device sharing. Screenshots and traces are retained in this evidence directory; all actors are synthetic.
- **Real SQL journey:** `native-parea-sql-strict.log` runs the actual native clients against retained real PostgreSQL writer definitions plus the draft current-session migration. It exercises real quota/pricing, 3/1/5, lost committed responses, exact nonce reuse/remount, unique capability hashes, holder binding, a genuinely observed row wait followed by allocation expiry, cancellation versus replay and policy invalidation. It asserts zero money rows. The original strict expired-session failure is retained separately as `session-gap-failure.log`.
- **Build:** focused/full native unit results, TypeScript and iOS/Android/web export results are retained separately. An export is compilation evidence, not a physical iPhone/Android acceptance result.

## Release boundaries

The new authority migration must pass independent review and be installed before native release. Root owns schema application, integration and deployment. Real event owner/inventory activation, physical device secure storage/share behaviour, contact picker availability, provider email/SMS delivery and connected online payment are separate outstanding gates. This candidate provides manual recipient entry and explicit share handoff, not delivery receipts or contact-address-book access.

## Reproduction

From the repository root, run `node --test mobile/tests/nativeParea*.test.mjs`, `PGPORT=15567 node tests/database/event-table-current-session.integration.mjs`, and `PAREA_AUTHORITY_MIGRATION=1 PGPORT=15568 node tests/database/native-parea-journey.integration.mjs`. These PostgreSQL tests create and remove isolated local clusters; they do not query or write live customer data.

From `mobile`, run `node --test tests/*.test.mjs`, `npx tsc --noEmit`, and `./node_modules/.bin/expo export --platform all --output-dir /tmp/zoi-parea-review-export --clear --max-workers 2`.

Start the actual App from `mobile` with `CI=1 ./node_modules/.bin/expo start --web --port 8204 --clear --max-workers 2`. From the repository root, run both scripts in `tests/browser/native-parea-journey`, setting `EXPO_ORIGIN` and `QA_OUTPUT_DIR` if needed. CI mode disables file watching: restart Metro after source changes. Reviewers must compile their immutable snapshot and use a separate port/output directory.

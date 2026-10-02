# Native Parea independent acceptance · 2026-10-02

Accepted for integration at these source hashes, independently reviewed and exercised:

- `mobile/src/Tickets.tsx`: `854b528ceb2f42211f8c5c8848dc0ffb3f5d33f3b07b41246dd8720f8c621321`
- `mobile/src/eventHostLink.ts`: `ee98c6e9f78261641f53ae68f6dd3b4bb5c9e2f9d3d08e86890a3eb8b6bf90be`
- `mobile/src/NativePareaHandoff.tsx`: `392baad43fdd6d5dac120c0d0f724eb75bc081ce3f060092ec96f4f2bf1f86a1`

Source review confirms host internal profile is independently read through zoi_me, never inferred from Auth UUID. Every listed allocation and subsequent detail is bound to event/profile/allocation. Quantity, expiry, currency and no-payment envelopes fail closed. Recipient input accepts only the selected event's HTTPS www.zoi.city host route with a 64-hex claim fragment. The fragment is an existing private invitation capability, not an app session token. It remains memory-only; errors and completed handoff clear it. Recipient handoff repeats the authenticated preview and compares reviewed quantity/table/price/expiry/status before opening. Host route is explicitly event-level and asks the user to select their group in the browser.

Tickets keys the component to event, Auth actor and workspace. Its captured scope and unmount retirement gate both sides of token refresh and response through scopedEventHostRpc. No mutation RPC was added. This preserves current organizer role/inventory proof and separate browser authentication.

Independent execution:

- `node --test mobile/tests/eventHostLink.test.mjs mobile/tests/pareaHandoff.test.mjs mobile/tests/eventHostTransport.test.mjs`: 17 passed. Includes real SessionClient held refresh actor/workspace changes, failed refresh, late response, malformed identity and unsupported writer rejection.
- `EXPO_ORIGIN=http://localhost:8198 node tests/browser/native-parea/verify.cjs`: actual Expo native components at390/1440 passed current host8/3/2/3 counts, recipient2/current amount, exact keyboard browser handoff, empty/expired groups, invalid input zero proof reads, wrong returned event, changed table rejection and held preview during real workspace navigation.
- Existing native-event-host verifier on8198: all4 owner/viewer phone/desktop cases passed.
- Mobile TypeScript check passed.

Logs: `/tmp/native-parea-independent-{units,browser,host,ts}.log`. The independent phone capture `/tmp/native-parea-independent/390-preview.png` was visually inspected: masked input, readable group and invitation quantities, wrapped labels and no horizontal clipping. Browser requests used controlled contracts; no live customer API, messages, payment or claim occurred.

This accepts native review and browser handoff, not native editing/payment, installed iOS/Android binaries, physical-device behavior, event-service activation or production backend readiness. The existing100-allocation reader bound remains. Invitation acceptance is not paid admission.

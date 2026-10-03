# Native owner source review and private authority recovery

The original 78e49 native owner candidate remains immutable. This separate derivative fixes the independently reproduced HTTP400 authority refusal that left private drafts visible after foreground/session expiry. Actual SessionClient now carries an optional stable safe `ApiError.code` only on three owner and seven existing Company/document RPC paths. Exact safe authority messages retain their actual HTTP status; SQL details/hints, provider bodies, unknown messages, unrelated RPCs/Auth and generic transport400/503 are never reclassified as definite authority failures.

Owner refusal purges rows, snapshot, draft and immutable memory retry payload. Its nonce/scope/version reference remains solely for subsequent authorized recovery. Reviewer-owned Operations and Documents overlays clear their scoped private state; document confirmed-upload refresh refuses access rather than silently retaining private record state. Installed shared Company authority emits `company_permission_denied`; the combined handlers include that exact contract.

Source evidence: unchanged existing owner writers and original retained PG11 lifecycle; authorizer backend correction is a separate root-installed/reviewed packet, not claimed by this frontend. Native uses the current accepted held-content/source-review and Company dependencies; no schema, communications, customer transactions or production writes.

Rendered evidence: newly restarted compiled Expo App at390/1440, inspected final refusal screenshots: no owner draft/contact fields, no duplicate refusal notice, clean existing app tokens. The earlier browser-combined screenshot came from a stale pre-restart Metro instance and is historical only. Final accepted render is browser-persistent/.

Exercised journey evidence: original28 edit/source-choice/clear/public-model/reopen/CAS/lost-response/remount/role/account journeys plus20 actual HTTP400 suite_session_unavailable/invitation_unavailable refusal phases (open, foreground, pre-save, during-save, pending retry) at390/1440, all48 pass. Definite rejection causes no successful publication UI or new unauthorized writes; lost network retry still preserves the original request. Exact RPC/code/status privacy tests30 and full native444 pass. TypeScript and web/iOS/Android exports pass; all three source maps match ten actual combined modules byte for byte. Company/Documents adversarial runtime acceptance is independently owned by youth_review and remains a separate evidence packet.

Reproduction from frozen snapshot:

```sh
cd mobile
node --test tests/businessOwnerAuthority.test.mjs tests/businessOwner.test.mjs tests/session.test.mjs
node --test tests/*.test.mjs
npx tsc --noEmit
CI=1 npx expo export --platform all --output-dir /tmp/native-owner-review-export --max-workers 2 --source-maps
CI=1 npx expo start --web --port 8233 --max-workers 2
```

From snapshot root: `EXPO_ORIGIN=http://localhost:8233 OWNER_SOURCE_EVIDENCE=/tmp/native-owner-review-ui NODE_PATH=/workspaces/zoi-city/node_modules node tests/browser/native-owner-source/verify.cjs`.

Original owner frozen snapshot is copied then overlaid; the two reviewer classifiers are dependencies with retained exact hashes, not implementation owned by this producer. No physical device, store distribution or authenticated live customer edit/public readback acceptance. Local exports persist under producer evidence/exports outside the staged owned-file list; map hashes/ten source hashes are retained in combined-export-source-proof.json.

Independent Place diagnostics review also retained: exact frozen f642 API body against f52 baseline13-file closure, six original and four extra timeout/network/invalidJSON/403 cases pass. It adds safe diagnostics, not a performance fix. Actual intermittent country/region503 remains open. Missing import failure from producer's overlay-only snapshot is retained, then corrected in the independent dependency closure without editing producer bytes.

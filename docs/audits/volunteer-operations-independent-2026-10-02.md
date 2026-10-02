# Independent volunteer operations acceptance — 2026-10-02

Original acceptance below is superseded by the installed-capability addendum at the end. Accepted as a local coherent database, web and native candidate only at the final addendum hashes. No production database reads or writes were performed by this reviewer. Application still requires healthy exact-definition preflight and the current workspace-authority dependency; this is not live service acceptance.

## Frozen contract

Final migration `20261002180000_volunteer_shift_operations.sql`: `f6ebb39968ab2ff34286a5bf77e8d0435779b9e50152cc8ff5ebefab6da1251a`; database fixture: `d68de8163b87c4296c0d8bbe873d3c2361cc132ef4cd93cf2e91ee49a0ca72da`. This supersedes the earlier candidate that disabled legacy program/shift saves.

Legacy public signatures and result shapes remain available to installed clients. They authorize using current locked workspace membership, invoke retained validation/CAS writers, and recheck the current session after record waits. Failed post-wait checks roll back both changes and audit entries. Old create calls remain nonrecoverable after uncertain responses; modern web/native clients exclusively use exact actor/workspace/request/operation/target/payload receipts and never fall back to a legacy write.

Attendance is separate from signup and capacity. Correction requires a note; cancellation/rejoin resets current attendance while historical receipt replay cannot reapply it. Current clock eligibility follows lock waits. Lock ordering follows workspace, actor receipt, program, shift, registration. Direct table grants remain denied. Finite receipt capacity remains a disclosed operational limitation.

## Independently exercised evidence

Final `node tests/database/volunteer-shift-operations.integration.mjs`: 23 isolated PostgreSQL groups passed, retained in `/tmp/volunteer-final-independent.log`. Includes installed-client create/update/read and CAS, paused/viewer denial, revoked/deleted/expired sessions, actual workspace and record lock waits, rollback, signup capacity and time boundaries, cancellation/attendance serialization, replay and tombstones.

Unchanged coherent UI/native packet independently passed: 22 shared/native unit tests; operator/public full journey at 390/1440; 16 public scope cases; 12 ownership cases; six delayed-import cases; actual Social shell cases; actual Expo-web native forms at 390/1440. Native journey exercised lost create, leave/reopen/recovery, shift, arrival/completion/correction, held workspace switch and 401 private clearing. Phone operator and native screenshots were inspected. Logs: `/tmp/volunteer-{units,web,native,public,ownership,import-ownership,actual-shell}-independent.log`.

Web core `dc67f9287e500157d56ffd4854fadae313121ec0ac58f0662585d1795e31501b`; roster `1196bdc584981fdba3a6d686c64435d8a717690cc73aca5def7f1e8da28b1487`; shared model `49a499c5019faf84729d4aab95ffcdbb6e3bba6e59ce71a52825d560f85578dc`; wrapper `2ebb814ec2e31b7de8b367d58f898f5cdd6405b3d1abb6b2191b91c1954796f1`. Native Volunteer `aac389d2fc0a4a95ac03d95ceb87c9c7dfb968be44b44e926b034c64d13ed482`, helper `dd7c93dec89474337c819ee0928c29526d86e3bf939e7dad038aa537cabbee94`.

These browser journeys use controlled API persistence; isolated SQL evidence is separate. No real signup, message delivery, payment, installed-app upgrade, signed mobile build or physical-device execution is claimed. Root owns exact-index build and release verification.

## Final installed-capability acceptance (supersedes all prior hashes)

Independently accepted revised local packet after the previously missing deployment capability boundary was added. `org_programs_list` emits exact `capabilities.volunteer_operations:1`, workspace, internal actor profile and current role in the same atomic migration as the modern operation/roster definitions. Its existing current-authority helper locks membership and verifies the current session; the capability is not inferred from a successful legacy list response. This is an installed API version contract, not a production installation claim.

Both clients require the exact numeric version and valid scoped profile/known role envelope before modern roster/save/request dispatch. Legacy scoped schedules can remain read-only; old unscoped envelopes are refused. Initial recovery load reads local storage only. Missing capability retains the pending marker, disables recovery, and sends no unsupported operation. Explicit availability refresh can enable exact recovery. Web guards recheck availability after refresh; native current checks include capability across token refresh. No legacy writer fallback was introduced in modern clients.

Independent final checks passed: 23 isolated PostgreSQL groups including legacy compatibility and current-session scoped capability; 24 shared/native units; 14 web pending-marker capability cases (legacy, absent, malformed, unknown version, invalid profile, role, workspace at both widths); full web operator/public journey at390/1440; actual Expo native journey at390/1440 including absent-before-create, pending-remount absent gate, enabled recovery, attendance and denial. Logs `/tmp/volunteer-capability-{pg,units,web,journey,native}-independent.log`. Existing prior ownership/public-scope evidence remains separate; root owns exact-index regression/export. No backend request was made by the reviewer outside controlled local fixtures.

Final hashes:
- SQL `0e4ca5b114919c71ae3f908b4497426197134ad1c984daec32daf2140054f21e`
- PG fixture `13a221e3d7a9e297abb0821ed140adb5ffa69b73595a3765a96c83e8888024a6`
- web core `1e76621dc757885c1f76c665e8e77d6d70de6247ebf24312594ad842e5a37fbd`
- roster `a63c6bfc9d05431deced1b06bb8f2a16ab7a7e5c642e63ccbee5435f7932fc67`
- shared model `92217d892457db3530c5d0bc2c4e8cb906438b95bca7901434bcab7d21b4cea2`
- native Volunteer `872f9160849a34ec7f8a8df47b991fc7b8461ecd7402f0f663b1b65dbb5b7e95`
- native recovery helper `9d375b136322af9f72cd565bce9962d0d0fa5c417d520b4f0a7dc8faee5ef452`

Production exact-definition/dependency preflight and database application remain separate gates. Legacy installed clients retain their preexisting nonrecoverable create behavior; deployment of source alone does not update installed binaries.

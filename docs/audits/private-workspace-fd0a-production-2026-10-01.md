# Private workspace production acceptance — fd0a6ac, 1 October 2026

Release `fd0a6ac24d5af7c0ad9b3d5d73b4eec8a31f20e9` was independently checked after the lead confirmed Vercel success.

The original creator privacy reproduction was rerun against the actual deployed `assets/creator/studio.mjs` at 390 and 1440 pixels. Only the local `C` adapter was synthetic: it returned a synthetic campaign, then changed its actor to null and emitted account/storage/focus events. No real login, client record or write was used. Both widths now remove the synthetic private campaign and display “Your account changed” with Reload shared work. The prior `retained:true` result is now `retained:false`.

Deployed `assets/creator/studio.mjs`, `assets/creator/customer.mjs` and `assets/inquiries/workspace.mjs` returned 200 and byte-matched the tested release archive `/tmp/zoi-private-access-release-gnd6x95i` exactly. Evidence: `/tmp/private-fd0a-parity.json`.

Actual signed-out `/creator/` and `/inquiries/` returned 200 at both widths, displayed their expected sign-in forms, and produced no captured page errors or horizontal document overflow. No OTP or message was sent. Evidence: `/tmp/private-fd0a-entries.mjs`, `/tmp/private-fd0a-entries.json`, `/tmp/private-fd0a-{390,1440}-{creator,inquiries}.png`. The original reproduction script/results are `/tmp/creator-scope-repro.mjs` and `/tmp/creator-scope-repro.json` (now containing the corrected result).

Disposition: the originally reproduced deployed creator private-DOM retention defect is corrected. This check does not claim authenticated production campaign mutation, live revocation of a real workspace member, durable uncertain-write recovery, or physical native-app distribution. Those remain separate from the local mounted browser and native Expo-web candidate evidence. Browser sessions closed.

# iOS restoration capture (prepared; never run by the author)

This is a manual EAS Workflows packet, not a TestFlight replacement. It creates
one unsigned standalone iOS **simulator** build using existing `preview`, then
reuses that exact `build_id` in two real simulator/Maestro jobs. There is no
submit, OTA update, Apple API, signing key, device registration, account login,
location request, cart change, order or message step.

Root must first commit/review these six files and verify existing EAS project
access, GitHub linking, available included build credit and macOS workflow
allowance. Use a clean protected commit. From the **mobile** project directory:

```sh
eas workflow:validate .eas/workflows/app-store-restoration.yml --non-interactive
# Root only, after explicit authorization of the single build and capture run:
eas workflow:run .eas/workflows/app-store-restoration.yml --ref FULL_PROTECTED_COMMIT -F expected_commit=FULL_PROTECTED_COMMIT -F confirm_capture=true --non-interactive
```

`confirm_capture` defaults false. There are no automatic triggers, retries or
second-build fallback. Validation itself uses Expo's authenticated server API;
it was deliberately not invoked by the source author. The locally available
CLI's `workflow:run --help` confirms `--ref` uses the exact remote committed
source and does not upload the local directory. Do not run this from the dirty
source-author worktree or use an unpinned local upload.

The 171 capture-runtime/config/asset SHA256 pins are from Apple build2 source
`6c2f013d3ffa3a1d39dda6922c433de39d3550d4`. Source checks run before the build
and each test. The four eagerly imported Profile.tsx/profile.ts/serviceOfferings.ts/
ServiceOfferings.tsx modules are pinned separately to their exact accepted current
SHA values, plus the recursively resolved local native/shared dependencies, all exact6c2f. Their screens
are not entered, but their newer code is part of this simulator bundle. This is
**not** a claim the new simulator bundle is Apple's signed build2. An unexpected
change in any pinned module/config/asset refuses rather than refreshing pins.
Root should retain actual EAS build source/fingerprint metadata and download/hash
the simulator application archive using supported EAS tooling after the run;
this source packet does not invent a binary SHA before the artifact exists.

Targets are `iPhone 16 Pro Max` (1320×2868 portrait) and
`iPad Pro 13-inch (M4)` (2064×2752 portrait). EAS's documented
`device_identifier` accepts simulator names, and the test runner is pinned to
`macos-tahoe-26.5-xcode-26.6` with Maestro2.6.1. Exact installed device availability
cannot be proved without the first actual worker. If either name is unavailable,
the job must fail: never substitute another device, resize, crop or label an
Android/browser image as iOS. Apple lists these exact pixel sizes as accepted.
The iPhone target is the requested primary6.9-inch class; iPad is the13-inch class.

Both jobs run the same read-only flow: fresh welcome → Skip → Home → native
Map → Expand/Close → Home → BuyGreek (no store-content interaction) → Close →
relaunch without welcome. Screenshots are taken only after relevant UI assertions.
Live network/map/store failures remain failures; no mocks or retry disguises.
The actual iOS accessibility tree/selectors and public data reliability are still
unexercised prerequisites. A successful loading indicator transition alone does
not establish the store catalogue or route calculation: root must inspect pixels.

EAS retains original screenshots and test logs in each job's **Maestro Test
Results** artifact. Additional `restoration-iphone-source-and-sha` and
`restoration-ipad-source-and-sha` artifacts retain source/dimension/digest receipts.
The checker requires all five original screenshots at the exact target size,
valid chunk boundaries/CRCs, complete IHDR/IDAT/IEND, bounded successful zlib
decoding of exactly the expected scanlines, and legal PNG filter bytes. Invalid,
truncated, trailing-stream, corrupt or header-only files are refused.
Apple disallows alpha: a PNG alpha/indexed/transparency channel fails validation,
leaving the original Maestro artifact available. Any later Apple-ready export
requires separately reviewed conversion with no crop, scaling or UI changes;
there is no silent image manipulation here. Only visually approved current
screenshots should replace the old2019 assets. No Apple upload is included.

Cost boundary: one medium iOS simulator build, one short Linux preflight, two
medium macOS Maestro jobs, zero test retries. Expo bills builds and workflow
compute against their respective account allowances; remaining allowance and
final duration were not read by the author. Root must verify these fit existing
included credits before launch; nothing here caps provider billing automatically.
This packet neither restores the removed App Store app nor reenables TestFlight.

Primary references checked2026-10-16:

- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/eas/workflows/pre-packaged-jobs/#maestro
- https://docs.expo.dev/eas/workflows/syntax/
- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.expo.dev/build-reference/simulators/
- https://docs.expo.dev/billing/usage-based-pricing/
- https://docs.maestro.dev/reference/commands-available/launchapp
- https://docs.maestro.dev/reference/commands-available/takescreenshot
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

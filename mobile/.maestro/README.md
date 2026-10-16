# iOS restoration capture (prepared; never run by this author)

This is a manual EAS Workflows packet, not a TestFlight replacement. It creates
one unsigned standalone iOS **simulator** build using existing `preview`, then
reuses that exact `build_id` in two real simulator/Maestro jobs. There is no
submit, OTA update, Apple API, signing key, device registration, account login,
location request, cart change, payment, order or message step. Opening the existing
store cart page is read-only; this flow never adds or removes a product.

Root must first commit/review these six files and verify existing EAS project
access, available included build credit and macOS workflow allowance. GitHub
linking is optional for the supported local-upload path below. Use a **clean
protected commit** with the independently accepted runtime overlay. From mobile:

```sh
# Use the supported pinned CLI25.0.0. Its server validation must explicitly pass.
eas workflow:validate .eas/workflows/app-store-restoration.yml --non-interactive
REF="$(git rev-parse HEAD)"
PIN_SHA="$(node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('.maestro/restoration-source.json')).digest('hex'))")"
# Keep the operator receipt outside the repository/upload.
EXPECTED_CAPTURE_COMMIT="$REF" EXPECTED_SOURCE_MANIFEST_SHA="$PIN_SHA" CAPTURE_EVIDENCE_DIR=/home/codespace/.cache/zoi/APPROVED-RUN-private-preflight node .maestro/source-check.mjs --local-preflight
# Root only, after explicit authorization of the single build and capture run:
# Deliberately omit --ref: this uploads local sources without a GitHub link.
eas workflow:run .eas/workflows/app-store-restoration.yml -F expected_commit="$REF" -F expected_source_manifest_sha="$PIN_SHA" -F confirm_capture=true --non-interactive
```

`confirm_capture` defaults false. There are no automatic triggers, retries or
second-build fallback. Do not run from a dirty checkout. Local preflight checks
exact HEAD, clean tracked/untracked state and every source pin, then records all
six workflow/guard file SHA values in the private operator receipt. It makes no
tracked/untracked-file exceptions and requires its receipt outside the repository.
Receipt destinations resolve against the real repository and nearest existing
ancestor, refuse symlinked components and final files, and create private output
using an exclusive temporary file plus atomic no-overwrite publication. Use a
fresh receipt directory for each attempt; existing receipts are never overwritten.
Normal Git-ignored generated files are not enumerated as untracked by Git. Root
must separately check the EAS upload inclusion rules; the planned explicit
`.private-credentials` exclusion is a root prerequisite, not a change in this
packet. Git cleanliness alone does not prove an upload contains no ignored files.

The CLI packages local sources as GCS project input. Current `.easignore` removes
`.git`; therefore every cloud hook uses explicit `--worker-hash`, which never
requires Git. It verifies the caller's exact manifest digest and all source pins.
Receipts distinguish the **sender-asserted commit**, locally verified commit/tree
(local mode only), actual worker file hashes and optional provider commit metadata.
A present provider commit must be a full matching SHA; absence remains null and
is never filled from the caller's assertion. Neither worker mode nor an expected
input claims provider-verified Git identity. Compare all six worker packet hashes
against the local operator receipt and retain actual workflow/build IDs. The CLI
25 server validation already accepted V2; this revised YAML still needs fresh
root server validation before use. No new upload/run has been executed.

The original 171 runtime/config/asset, 74 shared-dependency and four eager
Profile/service pins remain intact. `accepted_source_overlays` adds only the exact
reviewed Welcome V3, editorial Home/chrome, account-core V2, App header, identity
config, map-loader and current commerce files. Their source/independent-review digests are retained
with each finite file set. New Welcome/Account modules, both original brand images
and their provenance, and `app.config.js` explicitly join the source graph.
The checker binds the complete original graph to an immutable digest, then applies
only these seven exact overlay scopes. It refuses altered baseline pins, omitted
new assets, an added file or an unknown overlay instead of refreshing hashes.

The current commerce overlay pins the exact ten independently accepted catalogue,
store host, API and regression-test files. Root's final cancellation/generation
repair and its narrow independent review are recorded separately from the original
commerce review. The founder submit-target delta also has its own accepted digest;
it changes no capture identity. Neither acceptance establishes live API deployment,
actual store content, native cookies or a completed shopping transaction.
Any new source change still refuses; future pending commerce holds refuse even if
an operator restores old matching source. This prepared candidate authorizes no
simulator build, capture run, provider action or submission.

The workflow stays on the existing `preview` simulator profile and canonical
`com.usgreekscan.zoi` app ID. `founder-testflight` / `city.zoi.app` is separate.
The source guard rejects a founder identity flag or a different supplied build
profile, and still checks exact manifest digest, clean local upload and worker
file hashes. This newer source bundle is **not** Apple's signed build2.
Root should retain actual EAS build source/fingerprint metadata and download/hash
the simulator archive after an authorized run; no binary SHA is invented here.

Targets are `iPhone 16 Pro Max` (1320×2868 portrait) and
`iPad Pro 13-inch (M4)` (2064×2752 portrait). EAS's documented
`device_identifier` accepts simulator names, and the test runner is pinned to
`macos-tahoe-26.5-xcode-26.6` with Maestro2.6.1. Exact installed device availability
cannot be proved without the first actual worker. If either name is unavailable,
the job must fail: never substitute another device, resize, crop or label an
Android/browser image as iOS. Apple lists these exact pixel sizes as accepted.
The iPhone target is the requested primary6.9-inch class; iPad is the13-inch class.

Both jobs run the same read-only flow: fresh single-screen welcome → Explore →
Home → native Map → Expand/Close → Home → native BuyGreek catalogue → existing
Store & cart page → Close → relaunch without welcome. The five screenshots retain
their original artifact names; `05-buygreek` now records the actual catalogue
with product accessibility labels after loading/error checks. The following cart
page visit checks native wrapper recovery and actual store content without
changing the cart. Live catalogue/store content and native accessibility selectors
still require an actual authorized simulator run; these are prepared selectors.
The `Your cart` / `Shopping cart` content assertion is deliberately a failure if the
live store or its accessibility tree differs, rather than accepting wrapper text.

Welcome V3 supersedes the old three-step Continue/Previous/Skip/Let’s-go flow.
Capture uses `Explore Zoi`, waits for `Opening Zoi…` to disappear and verifies the
current `LIFE, TOGETHER.` screen. Relaunch must omit `Explore Zoi`. Captures are taken
only after their relevant UI assertions.
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
- https://docs.expo.dev/eas/workflows/automating-eas-cli/
- https://docs.expo.dev/eas/workflows/environment/
- https://docs.expo.dev/eas/workflows/syntax/
- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.expo.dev/build-reference/simulators/
- https://docs.expo.dev/billing/usage-based-pricing/
- https://docs.maestro.dev/reference/commands-available/launchapp
- https://docs.maestro.dev/reference/commands-available/takescreenshot
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

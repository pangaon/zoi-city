# Native map layout and directions acceptance

This fixture mounts the actual Discovery screen, native shared models, AppChrome,
location controller and web MapLibre backend. It uses local actual MapLibre code
and a deliberately empty basemap style (no production tiles). The existing retained
anonymous Hellenic 151-item home and exact retained reviewed-point literal are
replayed through a controlled public-read boundary. Auth identity, home settings,
OS permissions, Back dispatch and transport are controlled. This is not installed
Android/iOS, production Auth, source revalidation or external route acceptance.

The direct embedded-document cases use the actual generated HTML and actual
embedded module, replacing only its static asset origin and basemap style locally.
They check actual44px SDK controls and same-instance camera preservation on resize.
No external network, upload, account, provider, SQL, build or device operation runs.

Use an existing installed dependency tree; no install is required:

```sh
ln -s /workspaces/zoi-native-location-work/mobile/node_modules mobile/node_modules
BUNDLE_PATH=/home/codespace/.cache/zoi/YOUR-UNIQUE/discovery.js node mobile/tests/native-map-ux-browser/build.cjs
BUNDLE_PATH=/home/codespace/.cache/zoi/YOUR-UNIQUE/discovery.js OUTPUT_DIR=/home/codespace/.cache/zoi/YOUR-UNIQUE/browser node mobile/tests/native-map-ux-browser/verify.mjs
mobile/node_modules/.bin/tsc --noEmit -p mobile
cd mobile
node --test tests/*.test.mjs
```

Run Node tests from `mobile`: one retained test uses a cwd-relative fixture.
A sparse checkout must materialize these existing read-only files:

- docs/audits/native-backend-dependencies-2026-09-30.json
- docs/audits/evidence/native-discovery-media-producer-2026-10-03/home_entity.json
- docs/audits/evidence/native-discovery-media-producer-2026-10-03/explore_search.json
- docs/audits/evidence/source-health-owner-independent-fresh14-2026-10-03/cafe-boulis-astoria.json

The18 mounted journeys cover390×900,390×390,844×390 and1440×900 at
font1/2; map-first selected context,44px controls, intentional filters/details,
no GPS on disclosure/expansion, same backend/camera, persistent Close, Escape/
controlled hardware Back, focus/chrome restoration, all four travel modes through
focused tests, explicit origin versus originless preview intent, read retry,
stale selection refusal, permission denial, account disposal, List→Map, sparse/
unmapped/approximate/long Greek content and embedded resizing. On a short phone
or long font2 content the selected text/actions scroll in full; they are not all
claimed to fit simultaneously into390px height. Source photo is in intentional
place details. Map backend only remounts on existing explicit retry or screen/
account change, never expansion. Platform-correct AppState subscriptions use
real RN-web AppState in this fixture; only Android subscribes focus/blur.

Screenshots show the controlled basemap; an empty background is not a claim of
live tile rendering. Google Maps receives a destination/travel-mode request;
this does not prove provider route calculation, ETA or live navigation. New
native artifact and actual installed/device acceptance remain root-owned.

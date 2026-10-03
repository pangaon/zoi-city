# Native Discovery shared media readiness — 2026-10-03

The native Discovery card previously trusted only SQL photo_url and selected-place detail showed no image. Signature has a real approved shared hero despite NULL SQL photo_url, so web and native disagreed. Native now consumes the exact existing publicListingMedia decision for both surfaces. This corrects the shared projection consumer for every family; no new native curated IDs, source aliases, database writes or schema are introduced.

Owned runtime is mobile/src/discoveryMedia.ts plus the narrow Photo/import/selected-detail change in mobile/src/Discovery.tsx. The adapter exports only URI/kind/fit/backdrop, keeps owner edits and explicit clears authoritative, uses current source/quarantine rules, preserves logo-fit/backdrop and event-poster containment, and adds no raw or private fields. The renderer associates failure state and native Image keys with the current URI, uses a compact card image and rounded detail image, and leaves no empty detail rectangle when media is absent or fails. Existing map, account and saved-home logic is unchanged.

## Source evidence

Retained evidence lives in docs/audits/evidence/native-discovery-media-producer-2026-10-03. Fresh actual anonymous home_entity and explore_search reads returned Signature ID 9d969028-74cb-4b49-97f1-58eba8fc0e69 with SQL photo_url NULL; bounded explore media_input was present. Both shared projections select the same approved original Wix hero and logo. Fresh original hero fetch 200 JPEG 3000×1996 (568120 bytes), logo 200 PNG 1307×887 (71910 bytes), exact SHA/URLs/dates in source-images.json. The hero was decoded and visually inspected as official red-light live performance photography. A retained wrong-parameter-read.json documents an initial investigator p_query typo; actual native p_q is correct and that404 is not a feature failure.

## Rendered and exercised evidence

browser-final.log records 24 actual compiled Expo journeys: 12 modes × 390 px touch / 1440 px desktop. Retained screenshots visually checked: actual photograph/card/detail at both widths, photo-clear retained identity logo on phone, plus sparse and poster states. The fixture uses actual source bytes and real UI but controlled transport responses. It separately checks decode, current source selection, no old URI after mounted photo→website changes, broken-image removal, no overflow, no JS errors and no private RPC. These are local controlled journeys, not public production-write acceptance.

units-focused-final.log: 9 adapter groups. native-units-final.log: 380 complete mobile tests pass. typescript-final.log:zero diagnostics, command exit 0. export-final.log:actual web+iOS+Android export succeeds; emitted bundle hashes in export-artifacts.json. map-existing-journey.log: 2 complete persisted home/temporary area/canonical profile/precision/map touch/retry/stale-search journeys. map-existing-privacy.log: 2 account-switch/held response/malformed home/stale selection/incomplete map journeys. map-existing-clusters.log: 2 actual MapLibre cluster expansion/exact-pin/failing SDK retry journeys. Existing map images copied as regression-native-discovery-* artifacts. No new claimed street coordinates or provider capabilities.

## Remaining release gates

Independent exact-candidate review and parent-owned release/production artifact acceptance remain open. Physical iOS/Android image decode, native Maps keys/signing/gestures, OS Share and real destination handoff remain untested here. Existing source collection/owner publication coverage remains separate; a curated record does not certify every record. Parea/current-session authority is a separate frozen candidate under review and is not modified or approved by this media work.

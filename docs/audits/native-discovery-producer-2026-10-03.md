# Native personal Discovery and map candidate

Status: implemented candidate for independent review; no release, private production writes or physical device acceptance performed by this lane.

The native application's Discover tab now keeps the user's saved private home separate from an explicit temporary browsing area. It reads the existing authenticated `community_me` receipt and saves through the existing versioned `community_preferences_save` writer. The home editor reuses Community settings, but offers the relevant private fields without mixing public identity or unrelated controls into the Discovery journey. City/country suggestions are reused in both temporary browsing and private preferences. A choice fills both fields; temporary browsing performs no preference mutation. Query intent, Everywhere and Back to my home remain explicit. Public sharing includes the selected canonical place URL and no private home/topics.

Search uses the existing shared autocomplete controller and canonical place resolver. Search, selected-place and private-home replies are scoped across waits and account changes. Settings refresh clears stale forms before reading. An interrupted save tells the user to refresh and confirm the authoritative version before retrying; no automatic second write is issued. The underlying writer's expected-version guard protects a response lost after commit. Explicit null/empty clears remain supported.

The map is an actual interactive map rather than a fabricated globe/pin display. Web export uses the existing MapLibre SDK and attributed basemap; iOS/Android compile Expo's recommended real map component. Both reuse the existing pure geography contract. Only street-level points become individual pins. Coarse city locations and unmapped places remain usable in lists with clear location status. Global cohort validation runs before scoped filtering; incomplete paged feeds cannot produce precise pins. Real viewport clusters display actual place counts, expand on selection, and never scatter city centroids into invented street positions. Selected place identity is read freshly; coordinate Directions require a matching separately reviewed point receipt. Otherwise the action uses the published address or an explicitly labelled name-only Maps search. This is a provider handoff, not connected turn-by-turn navigation.

## Source evidence

`evidence/native-discovery-producer-2026-10-03/public-contract.json` retains three bounded anonymous production RPC reads: search, geography and city suggestions. This establishes current response shape only. The retained Signature search row has no projected photo; it is recorded as an existing source/projection gap, not solved by inventing a hero. The broader search/media lane owns that shared correction. Native results accept supplied HTTPS imagery, display logos with contain geometry and preserve a clean sparse fallback.

Expo SDK 57's official map documentation recommends `react-native-maps` 1.27.2: https://docs.expo.dev/versions/v57.0.0/sdk/map-view/. The installed package and lockfile use that version. No native provider keys or device-location permission were added. The shared web provider preserves MapLibre, OpenFreeMap, OpenMapTiles and OpenStreetMap attribution.

## Rendered evidence

Retained 390/1440 screenshots show the actual compiled Expo application, branded home controls, clear street map with attribution, selected place actions and signed-out state. They use explicitly synthetic places/accounts intercepted at the transport boundary. Screenshots are not production listing or signed-in customer acceptance. The producer visually inspected phone home, phone and desktop map, and the phone cluster-expanded map; table/catalogue mocks are not claimed as enriched customer records.

## Exercised evidence

- 21 focused Discovery/model/session tests and 339 full native unit tests pass.
- TypeScript and final iOS, Android and web JavaScript exports pass.
- 10 fresh isolated PostgreSQL checks execute the existing preference writer and ACLs: private/internal identity, persistence, other-account isolation, concurrent version conflict, lost-response duplicate rejection, null clears, locality validation, topic validation, anonymous denial and direct private table denial.
- Persisted journey passes at 390 and 1440: saved home, temporary autocomplete, global query suggestions, canonical preview/profile return, actual touch/mouse map selection, reviewed/address/name-only Maps routes, lost-save refresh without duplicate write, reload persistence, null clears, failed search retry and stale reply suppression.
- Account/privacy journey passes at both widths: held home reply across sign-out, second account's home, malformed/failed receipt recovery, stale selected reply, denied selection and incomplete paged map safety/retry.
- Actual MapLibre cluster journey passes at both widths: failed SDK retry, numeric two-place cluster expanded by touch/mouse, individual exact pin selection, no signed-out private calls. The fixture observes the actual SDK with a test-only constructor wrapper; the runtime exports no test globals.

The initial Metro compile exposed missing watch folders for the reused map and autocomplete modules. Those directories were added with parent approval, and actual bundles/exports were rerun. TypeScript rejected browser-style autofill tokens; native supported locality/country tokens and iOS text content types replaced them. Exercising private autocomplete caught a batched field update hazard, fixed using functional preference state updates, then rerun in the actual journey. Early test selector errors were fixture defects and are not listed as passing acceptance.

## Remaining release gates

Independent immutable-candidate review and lead integration/deployment remain required. Physical iOS/Android map gestures, accessibility and sharing have not been exercised. Standalone Android requires the documented Google Maps key/signing restriction setup; no binary or store acceptance is claimed. Provider destination acceptance, offline tiles and large feed performance on physical hardware remain unverified. Native Home remains its existing generic feed; this candidate personalizes Discover/maps and the existing Community locality contract. Interests shape Community and are shown explicitly in Discovery rather than secretly excluding search results. City suggestions are bounded to the first 100 published city rows with manual any-area entry. Hash-bearing map links retain the existing web handoff; plain Discover/Explore/map links enter the new native journey.

Reproduction commands, fixture scope and SDK limits are in `tests/browser/native-discovery/README.md`. Root retains all release and live-write ownership.

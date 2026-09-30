# Native acceptance and capability gaps — 30 September 2026

This is a source inventory and bounded acceptance record, not a claim of full native parity. A browser running the Expo web export is not physical iOS/Android acceptance.

## Current preview build status — supersedes the earlier 5ec7d1d baseline

The release lead confirmed both preview builds for `7592a434e757fa9a85c8dc42013e0c70539f8ea9` **FINISHED** on 30 September 2026. The exact source passed 167 tests, TypeScript and all three platform exports. Physical-device acceptance remains pending.

- Android build `ed7b5d2e-b251-4855-ae97-9efea756df05`: [APK](https://expo.dev/artifacts/eas/UHg3xRbLLsbJVlp1GmQVLuNTKeWFtH3T_wN4mdLIum4.apk), internal preview rather than a store release.
- iOS build `d53afae5-2168-4679-b26c-2c8b8780aeeb`: [simulator archive](https://expo.dev/artifacts/eas/prgi-XW4YVoZykWOOLQo1re5EeGD9weJ7saS4W8neSQ.tar.gz). Requires an iOS Simulator on Mac; this is not a physical-iPhone/TestFlight artifact.
- [Twenty-tester runbook](../docs/audits/tester-readiness-2026-09-30.md) distinguishes production reads, mocked interaction evidence and still-blocked transactions. No new cloud build was requested for this documentation update.

## Included navigation and recovery fixes; device acceptance still pending

- Community keeps the intended public screen/question composer through explicit sign-in and Continue. Cancellation/account changes clear navigation; reactions/publication are never replayed automatically.
- Artist sign-in returns to the same public profile, without voting. Discover retains query/filter through Back and tab changes.
- An unresolved guest ticket request blocks a fresh signed-in request. Guest recovery stays anonymous; account recovery stays authenticated.
- Up to five confirmed ticket nonce references per account/event are stored locally for up to one year, without contact data or cached ticket status. Reopening requires a fresh status read; cancelled/unavailable states are explicit. This is not a cross-device wallet, email receipt service or refund flow.
- Confirmed artist-show cards open the event identified by the server's slug. Unicode slugs survive the route without transliteration or identity guessing.
- Map deep links open the existing web map, retaining only supported public search/place/view context. There is no native MapLibre map screen or native turn-by-turn navigation.

## Existing native surfaces requiring device acceptance

| Surface | Present in source | Remaining acceptance / limits |
|---|---|---|
| Discovery and profiles | Public search, current canonical slug, source-backed artist catalog/gallery, profile detail | Source duplicates remain a data repair task. Search has no dedicated artist filter. Full category editorial designs are web experiences. |
| Community | Feed, profiles, follow/save/like, comments, settings, reports, notifications, media picker/upload | Physical picker/playback/background lifecycle and accessibility acceptance remain. No social-provider feed aggregation claim. |
| Artists | Verified catalog links, city interest, confirmed appearances and trip planning | Provider links are external playback; no native background audio. Combined music/TV/radio catalog is a labelled web handoff. Live account writes were not tested in this audit. |
| Tickets | Free GA idempotent request/recovery, named seats/holds/status/cancellation | Paid ticket checkout is a website handoff subject to provider availability. No GA cross-device wallet or native GA cancellation/refund UI. Device interrupted-network acceptance remains. |
| Trips and event planning | Private itinerary and existing event coordination flows | Auth-origin resume outside Community/profile still needs work. No travel-time, transport booking or supplier availability inference. |
| Venue studio | Local layout, 2D/3D geometry, reference images, import/export | Device-local draft, not deployed inventory or ticket holds. Saved drafts remain account-scoped on device; account-switch UI clears. No native measured/immersive Matterport tour. |
| Business home | Basic owned profile edits and selected music fields | Structured menus/promotions/media/design/reordering use the authenticated browser editor. No full native owner-design editor. |
| Customer/business work | Bookings/operator availability, enquiries, creator briefs/deliverables, bio links, operations, documents, timekeeping, priorities | Real-device uploads/download shares, timers/foreground restore, permission revocation and interrupted operations still require acceptance. No filing/legal-signature/trust-accounting claims. |
| Community organizations | Calendar, adult groups, guardian programmes, volunteers, festival packages/applications | Guardian backend is deployed (73344); device acceptance pending. Personal Orthodox/nameday preferences are a labelled web handoff; no bulk greeting sender. |
| Commerce | Product/cart-related existing Shop flow | Configured payment availability remains authoritative. No claim of native merchant fulfillment, global tax/shipping/returns or tagged-photo commerce parity. |

## Web workspace modules without an equivalent native editor

Source comparison against the 24 scripts registered by `social/index.html`: standalone Audience management (operations contacts are not the same suite), external-social Composer, Publishing calendar, AI assistant, Email campaigns, Adult leagues, Properties, Analytics, Connected accounts and Workspace/team settings. Native has existing account/workspace selection but not full workspace/team administration. These may be reached through the web workspace; their own backend/provider gates still apply. Native Community publishing is separate from external-social publishing.

Company formation/registry filing, legal signature, external-provider publishing/analytics, background media, automatic nameday messages, and store submission are not completed by the current native source/build. No claim that unavailable integrations become functional merely by opening a web page.

## Evidence boundaries

166 native tests plus the added map test, TypeScript and isolated web export are local checks. Private fixtures intercept every Supabase request and perform no real sign-in, email, reservation or trip write. They verify UI state/transport selection against contract-shaped replies; they do not independently prove live database authorization. Historical metadata evidence lists 130 RPCs at its recorded timestamp; that count is not a complete current end-to-end acceptance result.

Three-journey audit: guest/account ticket recovery; private trip/venue account switching; artist-show event navigation with a Unicode canonical slug. Real-provider playback, physical iOS/Android interaction and live authenticated ticket mutations remain untested in this pass.

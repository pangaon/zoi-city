# Community music candidate acceptance

The Community listening room consumes the reviewed `ARTIST_SOURCES` catalogue. It provides artist selection, sourced releases ordered by known year, explicit Spotify player loading, previous/next selection, a browser-local queue, and up to eight named browser-local playlists. Queue and playlist changes never claim account sync, Spotify playlist creation, publication, ticket ownership or continuous radio playback. Copy conversation prepares text only.

Entry: `/community/#music`. Optional `music_artist=<reviewedUUID>` and `music_release=<reviewedReleaseID>` select known catalogue entries without loading any provider iframe. Unknown IDs do not create content. Feed, sidebar and mobile navigation continue to work; leaving Music unloads the iframe. Hiding the page also unloads it. Reduced-motion preferences are respected.

Local browser acceptance against the integrated candidate on port4192:
- 390px and1440px: document width exactly viewport width; no horizontal overflow. Mobile hero/artist cards and desktop release/player layout inspected visually, including dark theme.
- Queue add and named playlist save survived an actual browser reload; no iframe loaded on reload.
- Actual Spotify album iframe loaded its catalogue and playback controls. Audio playback/region-specific subscription access was not tested or claimed.
- Next selected another release and removed the previous iframe; it did not autoplay.
- Enter selected a release, moved focus to Open Spotify player, and Enter opened that player.
- Back to conversations removed the iframe, restored feed visibility and returned focus to the Music entry button.
- Injected local browser storage refusal showed “Added for this tab only; device storage is unavailable.” No persistence success was claimed.
- Image failures have a textual/visual fallback; provider failure retains a clearly labelled external Spotify link and a repeatable open-player button.
- Four pure-model tests verify actual catalogue allowlisting, stored-ID validation/deduplication, independent playlist snapshots, and rejected storage writes.

Evidence screenshots (local QA, not production):
- `/home/codespace/.agent-browser/tmp/screenshots/screenshot-1790747613691.png` mobile390.
- `/home/codespace/.agent-browser/tmp/screenshots/screenshot-1790747699281.png` desktop provider.
- `/home/codespace/.agent-browser/tmp/screenshots/screenshot-1790747714888.png` dark desktop.

Outstanding: native iOS/Android implementation, broader artist coverage, provider-backed release synchronization, actual licensed/public radio source discovery, account-synced/shared playlists and direct music-post metadata. Existing copy-and-paste posts use the real community composer; this module does not publish on behalf of a user. No cloud builds or production deployment performed by this task.

## Floating player upgrade (supersedes initial inline/teardown behaviour)

Shared module `music-player.mjs` now renders a rounded translucent glass panel with artwork, source attribution, drag grip, keyboard movement, reset and explicit Close. Its CSS loads automatically for reuse in artist homes. API: `createMusicPlayer({onClose})`, then `.open({title,artist,image,embed,url})`, `.close()`, `.destroy()`.

Compact preserves the exact iframe DOM node and contentWindow, resizing the fully visible Spotify player to152px; Expand restores352px. It does not reload or intentionally stop playback. Spotify's official oEmbed for the actual Ethniki Odos track returned height152, matching its [documented oEmbed example](https://developer.spotify.com/documentation/embeds/reference/oembed). Close/Escape explicitly remove the player. Queue edits and returning to Community conversations preserve the visible floating player. Page-hidden behaviour still explicitly closes the provider player; background listening is not claimed.

Browser checks: pointer drag moved(998,92)→(598,222); ArrowLeft moved10px and saved the local position; corrupt stored(999999,-9000) safely clamped to(1008,76) at1440px. Escape removed iframe and restored focus to Open Spotify player. Mobile expanded rectangle was x12..378,bottom762 while navigation started778.5; no overlap or horizontal overflow. Compact actual sameFrame=true/sameWindow=true/height152/displayblock. Dark theme retains the light glass panel's contrasting dark text. Two added model tests cover corrupt/default/resize bounds and keyboard deltas; six music model tests pass overall.

Screenshots before compact refinement: desktop floating1790748002054, mobile expanded1790748024632. Final dark compact desktop1790748226917 (all under `/home/codespace/.agent-browser/tmp/screenshots/screenshot-<number>.png`). No production deployment or audio-output verification claimed.

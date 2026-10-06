# Community public entry — producer candidate

Isolated baseline: 1f9a7c1, worktree community-public-experience-20261006. Root owns integration and independent acceptance. This is a producer report, not production acceptance.

The existing Agora already supports anonymous feeds, topics/search, attributed posts, retry/empty states and an explicit Music player. This packet preserves those modules and adds a page-local welcome, direct keyboard-accessible feed and Music actions, an explicit browse/sign-in distinction, rounded surfaces and theme-aware typography. Mobile artist names no longer inherit nowrap clipping. The existing attributed listening-room portraits remain the source of imagery; no synthetic community posts, numbers or new provider claims were introduced.

Only community/index.html and new public-experience CSS/module are runtime changes. No authentication, shared navigation, feed, Music, storage or RPC implementation changed. The enhancement observes initial shell mounting only and disconnects once installed. Music's existing delegated action handles the added button; no extra player loads. CSS supports reduced motion and 44px composer/topic controls.

## Evidence

- Source: existing reviewed ARTIST_SOURCES and music.mjs provide portraits and Spotify credit. Their URLs and attribution are unchanged. No fresh source/provider verification is claimed.
- Render: retained phone dark and desktop light screenshots; all four width/theme captures available in /tmp/community-public-experience. External image requests were deliberately blocked, exercising the existing missing-artwork fallback. These captures do not prove currently available remote imagery.
- Journey: `node tests/browser/community-public-experience/verify.cjs` passes 390/1440 × light/dark using actual Community/Music modules and controlled RPC data. Checks slow503 → Retry → empty, populated post, keyboard feed focus, Music open/back, zero embedded provider frames before selection, anonymous-only RPC startup, save→explicit existing sign-in dialog, no page errors or horizontal overflow. No OTP sent, sign-in performed, provider playback or production API checked.

Evidence and exact hashes: evidence/community-public-experience-2026-10-06/manifest.json, report.json and journeys.log. Syntax check passes. Authenticated posting, real provider playback and live feed population retain their existing contracts and are outside this visual packet.

Root review correction: generated header placeholder Z replaced page-locally with the exact existing blue Greek Z/olive asset assets/brand/zoi-logo.png, visually inspected. All four browser cases assert original placeholder removed and actual logo naturalWidth > 0; screenshots updated. No shared branding/auth modules modified.

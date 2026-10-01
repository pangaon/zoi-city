# Artist media production acceptance — 0f29bc0

Read-only independent review on 2026-10-01. Production `app.mjs?v=20261001-source-video`, `render.mjs?v=20261001-source-video`, `artist-video.mjs` and `model.mjs` match commit `0f29bc0d22ace7d2b79c09e2a2097b0b11113461` byte for byte.

`PRODUCTION_ASSETS=1 node tests/browser/artist-source-video/verify.mjs` passed eight combinations (four designs at390/1440). The server uses local renderer fixture data, anonymous controlled core, and fetches actual deployed asset bytes. Singlevideo URL/title/fallback, close/Escape, focus return, iframe removal and no overflow/pageerrors all pass. This does not prove a real catalogue singlevideo or provider playback.

`node tests/browser/artist-source-video/verify-production.mjs` exercised actual published pages at390/1440:
- Ano Kato `/artist/ano-kato-vries` retains the real published YouTube user-channel link. No singlevideo button or fabricated iframe.
- Dalaras `/artist/giorgos-dalaras-athens-a558f2` opens the actual curated playlist `PLAXA5VvNzb2SL6Etpi8rNgO-Qt98luRtX`, with artist identity from current hydration; Escape unloads iframe and returns focus.

External provider requests were deliberately blocked. No playback, messages, database writes, or provider-account actions occurred. Screenshots `/tmp/artist-production-dalaras-{390,1440}.png`; deployed-asset fixture screenshots `/tmp/artist-production-video-{template}-{width}.png`.

Two initial direct-page checks failed because the test's allowlist omitted canonical www.zoi.city asset requests and then assumed the display spelling “Giorgos Dalaras.” Corrected the harness to allow both owned hosts and assert the authoritative hydrated artist name; final checks pass. These were harness defects, not production fixes.

# Independent public widget review — 2026-09-30

Reviewer: enrichment specialist, independent of widget implementation. Read-only review of `api/widget.js`, `api/_public-widget.js`, `assets/widgets/`, `widgets/index.html`, and the widget-specific `vercel.json` framing exception. No implementation files changed.

## Accepted code evidence

- Endpoint fetches only the fixed public `home_entity` RPC using the fixed publishable key. Incoming cookies and authorization are not forwarded; builder lookup explicitly omits credentials. No private account/configuration store or privileged key was found.
- Published/clean-or-cleared visibility, supported artist/event type and exact UUID matching precede output. Resolver exposes only ID, canonical slug, type and name. Unknown/error responses do not disclose upstream internals.
- HTML values are escaped; embedded JSON escapes `<`. Media URLs are normalized by the shared narrow Spotify/YouTube parser and revalidated before iframe creation. The widget CSP denies general sources, forms and objects and limits provider frames. External links use noopener/noreferrer.
- Global frame denial remains for other routes. Only `/api/widget` and `/api/widget/` are exempt, and that endpoint supplies its own HTTPS framing policy.
- Owner media presence/explicit clears and published hidden sections are respected. Manually exercised populated Giannis artist projections: owner photo null clears image; owner_media null clears playback; spotify_url/youtube_url null clears playback; social_links null clears inherited playback.
- Sparse/unavailable cards retain honest public-profile messaging. Builder explicitly excludes booking, payment, analytics and account-connection capabilities. Music is click-to-load, with direct provider handoff and provider-dependent playback/sign-in copy.

`node --test tests/unit/public-widget.test.mjs`: 7 tests passed independently, including identity/visibility, owner media clear, hidden sections, escaping, URL validation, endpoint failure handling and exact frame-rule scope. Additional owner-clear checks above were direct model executions, not browser or production mutations.

## Acceptance limits

No material blocker found in this code review. This does not certify deployed external embedding, actual Vercel header precedence, provider playback, or the builder's complete browser journey. Those are separate evidence owned by browser/release verification. At review time no production embedding verification had been performed by this reviewer. A loaded card is a public snapshot until it is loaded again; this code does not add realtime updates or withdraw content already displayed in an existing frame.

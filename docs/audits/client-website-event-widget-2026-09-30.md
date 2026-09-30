# Client website public-share widget — candidate acceptance

Current state (2026-09-30): implemented locally, awaiting root release and live header acceptance. Reachable builder `/widgets/`; it accepts canonical public `/artist/…` and `/event/…` links, resolves the current public identity, previews the card and produces copyable iframe code. It does not accept business or curated `/events/…` pages as event records.

## Verified candidate

- Public read-only `home_entity` projection requires published + clean/cleared, supported type and exact ID. Resolver returns only ID, canonical slug, type and name. Hidden/unavailable records fail closed; upstream failure reveals no raw data. No user cookies, writes, invented inventory or tracking.
- Published design hides and explicit owner media clears suppress fallback playback. Poster metadata uses contain; photographs retain crop. Provider iframe is created only after an explicit click; close/pagehide/visibility removes it. Direct Spotify/YouTube fallback remains available. Provider sign-in and full playback are not promised.
- Builder validates Zoi HTTPS canonical URLs, aborts outdated requests, clears stale preview/code on edits, supports clipboard failure via manual selection. No saved owner configuration is implied.
- Root-owned Vercel header exception is exact `/api/widget` (optional trailing slash). Other routes retain frame denial. Enforced widget CSP permits HTTPS ancestors and only supported provider frames.
- Nine focused unit tests passed: visibility/identity, private field minimization, owner media clear, design hides, HTML escaping, canonical URL parsing, endpoint failures/type mismatch, sparse records, poster treatment, and exact frame-policy boundary.
- Browser 390/1440: actual handler against live anonymous OPA event data, builder resolution and preview, full poster with `object-fit:contain`, zero page horizontal overflow, editing removes previous iframe, separate HTTPS parent origin displays the widget. No provider requests before interaction. Screenshots `.qa-widget/builder-{390,1440}.png`, `client-{390,1440}.png`; results `.qa-widget/results.json`.
- Browser fixtures separately cover sparse/no-player, unavailable state, provider network blocked, direct fallback, user-click iframe creation and close removal at both widths. Evidence `.qa-widget/edge-results.json`. These test provider failure handling, not successful Spotify playback.

The browser tests route the candidate handler/assets at the actual Zoi origin and an independent HTTPS parent origin. This verifies browser CSP behavior locally, **not deployed Vercel headers**. Root must verify response headers and cross-origin install after deployment. No client website has been modified.

## Remaining scope

No saved widget configuration, domain allowlist registration, owner revoke switch, styling settings, event-artist lineup projection or autoheight handshake. Public withdrawal is checked on each new uncached request; already open cards do not poll. Fixed-height iframe can scroll. Site-wide entry-point integration remains open; `/widgets/` is directly reachable. The earlier owner-configured concept below remains future work, not delivered functionality.

## Historical proposal (before this implementation)

# Client website event widget: bounded reuse assessment

Status: proposed, not built or connected to a client website. No new route or production writes in this pass.

Existing reusable pieces:
- `assets/homes/templates/events/signature-home.mjs`: source-matched company next-concert card, actual on-Zoi concert destination; curated announcement, not mutually confirmed appearance or ticket inventory.
- `assets/trips/event-artists.mjs` and `event_artists`: public current dual-confirmed event artists; owner-hidden sections excluded by host integration. Provider playback only on explicit action with current public owner media precedence.
- `assets/community/music-player.mjs`: compact provider player. This is media displayed within Zoi, not an already-distributed client-site widget.
- `assets/homes/public-media.mjs` and owner media writer: actual authorized media links/clears. They do not grant a third-party site permission to frame arbitrary Zoi pages.

No dedicated outbound embed/widget endpoint or installation UI was found in the inspected route/API/template paths. Do not advertise an installable widget yet.

Smallest next end-to-end implementation:
1. Current owner/admin selects an owned listing and an actual published event/approved source announcement. Keep these relation types explicit; never promote an announcement to confirmed artist appearance.
2. Save a versioned widget configuration with authorized listing ownership, selected event ID, allowed client origins, enabled state, restrained theme and effective dates. Preview shares the identical public projection; no fake stock, holds or checkout.
3. Serve a dedicated read-only iframe document exposing only selected public fields. Preserve owner clears, hide controls and moderation/publication/current ownership; unconfigured/expired/hidden becomes a compact unavailable state. Include a useful direct event link.
4. Set narrowly scoped frame-ancestors for configured origins; keep existing full-home framing policy. No tokens in embed code, no third-party session writes or implicit tracking. Bounded rate/cache policy; short revalidation on withdrawal.
5. Optional autoheight message validates exact origin, source window and numeric bounded dimensions. Provider playback is click-initiated; authentication/booking navigates explicitly to Zoi rather than pretending third-party cookies work.
6. Owner receives copyable installation code only after a real configuration save receipt. Test external-origin install, mobile width, keyboard, blocked embeds, owner transfer, revoke, hidden event, expired dates, absent provider and stale cache.

Open: configuration table/RPC, origin ownership policy, dedicated route/CSP, revoke propagation and actual external-site acceptance. The Signature card is visual reuse, not proof these operations exist.

## Proposed first public-share implementation

A narrower independently usable increment is a **public share widget**, distinct from an owner-configured install: immutable listing ID plus current canonical slug, anonymous `home_entity` with exact ID/type equality, existing published design and owner media precedence, whitelisted name/image/links and current dual-confirmed event artists. Only artist/event entities are accepted; Signature's company announcement must not pretend to be an event database row.

Proposed files: `api/widget.js`, `api/_public-widget.js`, `assets/widgets/public.mjs`, `assets/widgets/public.css`, `widgets/index.html`, `assets/widgets/builder.mjs`, focused tests. Owner integration can offer a link to that public builder but cannot label it a saved widget configuration.

Existing deployment headers globally set `X-Frame-Options: DENY` and `Cross-Origin-Resource-Policy: same-site`. A real external iframe requires a narrowly reviewed route exception and a dedicated enforced CSP. The proposed public-share scope allows HTTPS frame ancestors only, no authentication or writes, bounded no-store public reads, explicit user-initiated provider player, and links opening the actual Zoi home. All other routes retain framing protection. Deployment must test actual cross-origin response headers, not assume a local iframe success proves hosting behavior. No wildcard change to full-site security.

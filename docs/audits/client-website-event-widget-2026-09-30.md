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

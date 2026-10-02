# Artist owner catalogue — 2 October 2026

## Confirmed operational gap

The existing music editor in `_vertical-forms.js` exposes `merch`, `releases[{title,date,url}]` and `tour[{title,date,url}]`. Retained `home_content_save` and `public_owner_content` definitions explicitly accept/project those fields. A controlled post-save row with both profile and owner_content.profile populated produced empty shop, releases and shows in the actual music adapter. This was a shared transformation failure, not missing source research.

## Correction

The existing owner content adapter now maps explicit owner or persisted profile recordings and show collections into public owner catalogue rows. Presence replaces curated defaults, including null/empty/invalid collection clears. No website scraper data is treated as an owner collection. Safe outbound links retain original titles and valid dates; no city, timezone, performance time, cover artwork, Spotify identifier, booking availability or payment integration is invented. Future valid owner show dates appear consistently in the hero and public show section; past/invalid dates do not become future events. Owner recordings use deliberate provider navigation rather than unsupported embedded players. Existing curated listening/player behavior is preserved when owner collections are absent.

The prior store packet is superseded: the actual editable field `merch` is now honored, including authoritative clears, alongside legacy shop_url compatibility. Existing versioned writer/schema/editor remain unchanged. No new fields or migrations are required.

## Actual journey evidence

`node --test tests/unit/music-*.test.mjs`: 56 passed (`/tmp/music-owner-family.log`). This includes generic/curated source behavior, owner presence/clear precedence, malformed URLs, invalid/past dates and hero consistency.

`node tests/browser/music-owner-catalogue/verify.cjs`: actual existing Business home editor at 390 and1440 adds recordings/shows/merch, invokes the versioned writer contract, remounts/readbacks, opens canonical public page, exercises keyboard navigation to three exact controlled providers, then clears/saves/remounts and verifies public removal. The real editor serializes empty repeat collections as null; assertions match that contract. Actual database persistence is controlled, not a live write. Original attempt expecting [] was corrected after observing actual null writer payload; runtime already honored null.

Visual inspection found the source show-row’s three-column layout squeezed the owner two-column row. A dedicated responsive class now gives the owner title/date full phone width and keeps touch actions clear. Phone and desktop public screenshots were inspected after correction. Hero copy now reflects the same published owner date. Artifacts `/tmp/music-owner-catalogue/{390,1440}-{editor,public,cleared}.png`.

## Scope and pending release

No production reads/writes, source assignments or deployment. Native uses existing public artist-home browser handoff; no new native commerce/player surface was implemented. This is an external provider/show-details journey, not a connected booking engine. Generic owner `embeds`, Apple/Bandcamp/SoundCloud and press-kit projections remain separate inventory gaps; this correction covers the bounded recording/show/merch workflow. Lead owns cache integration and independent review. Source proposals from `greek-artist-followthrough-2026-10-02.md` remain unapplied.

Independent review caught a design-precedence edge: populated owner recordings must not reopen an explicitly hidden Listen section. The correction preserves `design.hidden_sections` and adds an exact section/navigation regression. Final music suite: 57 tests passed. Render hash is `b763494fb243fd8b01676ba0f76bb2f116038e6e9fa12f0ea1ba162a805a9c4a`; prior freeze hash superseded only for this renderer.

# Reusable creator homes

`renderCreatorHome({entity,template,design})` is a pure HTML renderer. Templates: atelier,concierge,table,parea; set matching `body[data-template]` and load `/assets/homes/templates/creator/style.css`. After mounting call `mountCreatorActions(entity)` from `client.mjs` once per page. It attaches local shortlist, personal reminder downloads, gallery and prepared-enquiry controls, never performs a provider transaction. Static review routes are generated from this exact renderer.

Minimal entity shape:
- `id` actual listing UUID; `slug`; `name`; `alias`; `role`; `bio` public sourced wording.
- `website`, `story_url`, `shows_url`, `contact_url`: official HTTPS destinations.
- `email`: verified public contact; required for prepared-email flow. Do not substitute guessed contact information.
- `portrait`, `character_photo`, `wide_photo`: official HTTPS image URLs. Portrait is the actual creator; additional photos should match supplied alt/presentation context. Current showcase photography describes Peter’s comedy persona and must not be blindly copied to unrelated creators.
- `channels:[{id,title,subtitle,url,image}]` real official channel links; no simulated feed or metrics.
- `socials:[{id,label,description,url}]` verified official accounts.
- `shows:[{id,city,country,date:YYYY-MM-DD,venue,url}]` source-listed dates and official ticket provider links. NOT Zoi-confirmed booking/availability records. Filter stale dates in the adapter. Personal calendar downloads are explicitly all-day reminders, never invented start times.
- `source_checked_at` source date.

Design uses approved `copy` fields, `section_order`, `hidden_sections`; intro always remains. Unknown section IDs ignored, each known section rendered once. Section IDs intro/offerings/gallery/calendar/media/socials/contact. Offerings currently carries sourced creator background, not invented packages; no operational offering record ordering is implied. The root owner editor controls persisted draft/preview/publication and immutable history. Link `/social/#home-design` only opens the real authorized editor; it does not assert ownership of the showcased creator.

The current Peter Kypri record is unclaimed and inquiry_availability=false. Public flow prepares a brief for the verified public email, explicitly not sent; official ticket purchase occurs on each provider. Existing platform inquiries and Creator Studio workflows may be shown only when actual ownership/opt-in records enable them. Do not claim this creator joined Zoi, accepted a brief or authorized these designs. Use private QA-owned records for editor/operational mutation acceptance.

Shared client model exports `proposal`, `calendarReminder`, `validSavedShows`, `safeLink`. Proposal is a local draft with status prepared-not-sent. Saved dates are device-local explicit choices, shared across the four designs for the same listing. Copy/download failure never produces a sent/booking claim.

Canonical-home rendering defaults to Concierge and omits showcase design-switcher/source-record/disclaimer UI. Pass `reviewMode:true` only for comparison pages; optional `templateUrls` maps selector destinations. Hidden sections also remove matching header/hero/dock anchors. The canonical route must supply its own source/content adapter and publication state; rendering this module alone does not publish a design.

## Acceptance evidence (local candidate)
All four compositions inspected at390px and1440px; exact viewport width/no horizontal overflow. Actual source images load. Shared workflow exercised in browser: Sydney city filter→save locally→switch design→saved-only Sydney persists; personal ICS download; valid proposal→encoded official email link→clipboard copy at390px; gallery keyboard Enter/Escape restores trigger focus. Five pure model/render checks pass. No external email, ticket purchase or public mutation was performed. Canonical owner editor integration/deployment remains root release work; these local checks are not production or native device acceptance.

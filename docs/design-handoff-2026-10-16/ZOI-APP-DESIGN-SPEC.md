# Zoi — Aegean Glass
## Full mobile product design and Codex implementation specification

Version 1.0 • 16 October 2026 • Prepared for George Hatzis

**Delivery type:** design and implementation handoff, not a claim that these screens or integrations are deployed. Concept imagery uses fictional example businesses, content and numbers. The actual implementation must use verified records. Numeric sizes, motion values and performance budgets below are proposed product requirements, not measurements of the current build.

## 1. Product mandate

Zoi is an everyday ecosystem for Greeks around the world: community, discovery, individual business experiences, useful creative and business tools, commerce, events and culture. It must work for a resident looking for dinner, a creator publishing a reel, a barber managing appointments, an organizer selling tickets and an owner improving their website.

Do not turn this into a directory, a social-feed clone, a generic business dashboard or a collection of disconnected external links. Build one connected product. A member discovers something meaningful, takes an action, receives a real outcome and can find it again. An owner understands what needs attention and completes work without entering the same information repeatedly.

Every business is a client. Its website, verified identity, offerings, imagery and operational needs determine its own experience. Shared engineering is required; identical page composition with different names is not acceptable.

### Scope authority and current-code grounding

Read the current `AGENTS.md`, `docs/specialists/zoi-delivery/SKILL.md`, its applicable role references, `docs/recovery-scope.json` and `docs/recovery-delivery-board.json` before implementation. Existing requirements survive this handoff. Reconcile differences explicitly; do not silently discard scope or reset progress.

The following were retrieved from `pangaon/zoi-city` during preparation:

- `docs/recovery-scope.json`: blob `59dac0a3ab5891805cf8bab2c2949b081ba78623`.
- `docs/specialists/zoi-delivery/SKILL.md`: blob `73c0d4da10454698bfdb76875aba1d28f049ad29`.
- `docs/audits/zoi-logo-source-and-surfaces-2026-09-30.md`: blob `ed5f6c326b391a176b8beaf0b561eaec5da35fe7`.
- `mobile/app.json`: blob `22e97d722a724e28351805783d9febfed40ad7de`; app name Zoi; scheme `zoi`; existing Android/iOS identity `com.usgreekscan.zoi`. Preserve identity and the upgrade path. Recheck current files before changes.

These are repository facts, not production/runtime verification. The fetched native configuration specifies light appearance; implementing dark mode is work to verify, not an existing capability to assume.

## 2. Art direction: expressive, calm, unmistakably Zoi

### Visual character

- Cobalt light, Aegean depth, pearl-white content, midnight-blue dark mode and small olive accents.
- Beautiful, source-appropriate photography with editorial composition. Warm people, authentic local businesses and real cultural life. Geography changes the content; not every experience is a Santorini postcard.
- Floating glass navigation, selectors and contextual toolbars. Opaque or nearly opaque reading surfaces.
- An editorial display face in occasional discovery/client hero moments; highly readable sans-serif for tasks, forms, statistics and navigation.
- Purposeful asymmetry in editorial layouts; precise alignment in operations. No rows of empty oversized cards, excessive pills or ornamental charts.
- A screen's main action should be identifiable immediately. Premium means carefully resolved details and reliable behavior, not more decoration.

### Reference-image authority

The detailed home and Studio concepts are art-direction references. The overview boards establish breadth only; they are not pixel-perfect screen specifications. This written specification and tokens govern typography, accessibility, navigation and behavior when generated imagery conflicts with them.

Do not copy generated numbers, addresses, business claims, sample dates or ratings into production. Do not reproduce the exaggerated header/logo proportions or tightly packed tool rows in concept images. Final working layouts must meet the measurements and text-scaling rules below.

## 3. Exact identity and brand assets

Use the approved raster masters already in the repository:

- `assets/brand/zoi-blue-olive-gloss-master.png` for large expressive placements where it remains crisp.
- `assets/brand/zoi-blue-olive-flat-master.png` and existing approved derivatives for smaller controls, favicons and icons.
- `assets/brand/source-manifest.json` for source provenance and derivative verification.

The supplied mark is cobalt Greek zeta/circular geometry with the olive/leaf accent. Do not substitute a Latin Z, gold serif Z, text glyph, stock olive, or newly generated approximation. A copy of the approved glossy source is included in this package. This is raster artwork; do not call it vector.

Use the actual asset in shipped interfaces. Image generation is for direction and permitted illustrative assets, not production logo reconstruction. Preserve aspect ratio and transparency. Never tint, distort or place the mark on low-contrast imagery. Add an appropriate neutral/glass backing when necessary.

Default header mark: 28–32 logical units high; 40 for a welcome screen; 56 maximum for an intentional brand opening. Clear space: at least one quarter of the visible mark height. Reserve image dimensions to prevent layout shift. Client logos belong to clients and must never be replaced by Zoi's identity.

## 4. Design tokens and layout rules

The accompanying `design-tokens.json` is the proposed semantic contract. Map it to the existing token system instead of building a second theme engine. Validate contrast in actual composites.

| Token | Light | Dark | Purpose |
|---|---|---|---|
| canvas | #F6F7FB | #081525 | App background |
| surface | #FFFFFF | #122339 | Reading and task surfaces |
| elevated | #FFFFFF | #192D46 | Modal/popup surface |
| ink | #14243A | #F4F7FC | Primary text |
| muted ink | #516177 | #B3C1D3 | Supporting text; verify actual background |
| primary | #075BFA | #87B2FF | Accessible action/link role |
| primary fill | #075BFA | #075BFA | Filled actions with white text |
| olive | #61782D | #BBD184 | Restrained brand accent |
| border | #DCE3EE | #36506E | Separators, not sole status cue |
| positive | #176B4B | #7AD7B0 | Confirmed success only |
| warning | #855100 | #FFD080 | Needs attention |
| negative | #B42332 | #FF9EA7 | Errors/destructive actions |

### Geometry

- Base spacing: 4. Use 4/8/12/16/20/24/32/40/48. Avoid arbitrary per-screen numbers.
- Phone horizontal gutter: 20; compact phone: 16; tablet: 24–32. Body content follows one vertical axis.
- Radius: inputs 12; standard cards 20; hero media 28; sheets 28; pills 999. Do not make every object a pill.
- Primary button: at least 48 high. Inputs: at least 52 high at default text size, grow with content. Icons: 20–24 visual size inside at least 48×48 interactive area.
- App toolbar: approximately 56 high excluding safe area; accommodate larger text rather than clipping.
- Floating bottom navigation: approximately 64 high plus accessible label needs, inset 12–16 horizontally. Respect actual bottom safe area. Scroll padding includes the full overlay height and at least 16 additional units.
- Forms: one column on phones. Two columns on sufficiently wide screens only for closely related short values. Long addresses, descriptions and validation messages remain full width.
- Long Greek or business names wrap naturally. Do not split words to force cards into narrow columns. No horizontal page overflow at 320 logical units.

### Typography

Use platform text rendering and a Greek-capable sans-serif. Default preference: system body typography with a verified, licensed Greek-capable editorial serif for display; Noto Sans/Noto Serif are candidates to verify and bundle if required. Do not silently substitute missing Greek glyphs.

| Role | Default size / line height | Use |
|---|---|---|
| Editorial display | 36 / 40 | Occasional discovery hero; 32 on compact widths |
| Page heading | 28 / 34 | One per task screen |
| Section heading | 22 / 28 | Content grouping |
| Card heading | 18 / 24 | Titles and action summaries |
| Body | 16 / 24 | Forms, descriptions, messages |
| Label | 14 / 20 | Controls and supporting labels |
| Caption | 12 / 16 | Nonessential metadata only |

Allow system text scaling. Do not cap it to conceal layout defects. At large sizes, stack rows, expand cards and make sheets scrollable. Critical labels may not be reduced to caption size to fit.

## 5. Glass, depth and motion specification

### Glass roles

1. **Navigation glass:** floating tab bar, location/context pill, compact media controls. Light starting fill white 86%; dark starting fill #0B1B31 at 90%; subtle blur; a fine rim and quiet shadow. Adjust opacity upward until text remains readable over every tested background.
2. **Context glass:** map selection controls, image overlays and short actionable summaries. Pair with local scrims and clearly bounded hit areas.
3. **Solid content:** forms, invoices, long paragraphs, conversation bodies, menus, detailed metrics and confirmation screens. Never let moving video compete with important text.

Web starting blur: 20px; native blur intensity is a platform-specific implementation detail, not the same unit. Use supported native materials where the installed stack supports them; otherwise implement a visually consistent fallback. Do not force expensive custom shader effects into scrolling lists.

Reduced transparency removes blur and uses opaque semantic surfaces. Reduced motion removes parallax, shimmer, scaling and large spatial transitions. Dark mode is redesigned using semantic roles, not an inverted screenshot.

### Motion

- Press feedback: 100–140ms, subtle opacity or up to 0.98 scale; no movement under reduced motion.
- Selection changes: 160–200ms. Keep labels stationary when practical.
- Sheet entry: 240–300ms; native interaction/back behavior takes precedence.
- Screen transition: 220–300ms; no mandatory splash delay.
- AI/media jobs: real phase information and determinate progress when known. Never animate an invented completion percentage.
- Haptics for a small set of meaningful confirmations and selections; respect platform preferences.
- No animated backgrounds behind forms, finance-like tasks, customer records or navigation labels.

## 6. Information architecture and context

### Member shell

Five fixed destinations: **Home · Explore · Create · Inbox · You**. Labels stay visible. Create opens a purpose sheet, not a fake destination feed. Closing it restores the previous selected tab and scroll position.

- Home: Following, For you and Nearby feed modes, editorial editions, relevant community content and real next actions.
- Explore: search, map/list, businesses, people, events, shops, stays, services, culture and categories.
- Create: post, photo/carousel, reel/video, story, community event or Studio draft subject to role and capability.
- Inbox: messages, requests and updates with useful filters and privacy controls.
- You: own profile, saved items, bookings, orders, tickets, memberships, preferences and Manage a business.

Parea is an organized community destination accessible through Home, Explore, search and saved groups. Reels is a media surface within Home/Explore; it does not need a sixth root tab.

### Owner shell

Explicitly enter **Manage [business]**. Display current workspace and role. Five destinations: **Overview · Content · Customers · Tools · More**.

- Overview: today's work, exceptions and a few meaningful measures.
- Content: Studio, media library, drafts, approval and publishing calendar.
- Customers: conversations, contacts, enquiries, bookings and orders appropriate to this business.
- Tools: website, visibility, analytics, campaigns, automations and sector operations.
- More: brand, team, integrations, billing, documents, settings and exit to personal mode.

Do not expose every tool equally. Owners pin frequently used tools; defaults depend on verified business type. A restaurant and creator need different overview priorities.

### Context rules

Switching context updates navigation, data, available actions, drafts and permissions together. Never show a stale business badge over another business's data. Drafts remain scoped. Reconfirm action context before publication/payment/destructive actions. A suspended or revoked role loses access immediately on the next server-authorized action.

Deep links retain their intended public destination through authentication. Client-home subsection tabs never replace or imitate the main tab bar. Booking/checkout may use a focused full-screen flow with clear back/cancel behavior.

## 7. Flagship screen layouts

### H01 — Home

Default phone layout: safe area; 56-high header with actual logo, location pill and inbox/notification access; 28–36 heading with maximum two lines; three-option feed control; one 4:3 or 5:4 editorial media feature; compact useful destinations; mixed community feed. Do not make the greeting fill half the first viewport.

Hero content is locale-relevant and source-backed. Sponsorship is labeled. The primary card has one main action and optional save. Subsequent feed items retain author, time, media, accessible caption, relevant entity link and familiar engagement actions. Preserve feed position when returning from details.

Home without personalized data shows useful editorial content and a gentle interest prompt, not invented activity. Location is manually selectable; device location is requested only for a relevant action.

### E02 — Explore map

Map occupies the available canvas; a top search bar and category filter occupy predictable safe zones. A bottom sheet has collapsed preview, medium results and expanded list states. Map markers and cards are two views of the same query. Selection persists between them.

Never fabricate street precision for city/region-only records. Display approximate areas distinctly. Show search extent and a deliberate Search this area action when appropriate; do not constantly requery on every animation. Distance requires a legitimate origin. Directions opens a supported route workflow with explicit mode and destination.

### C01 — Individual client home

Compact Zoi navigation; client-owned brand and hero; verified identity and location; 2–4 relevant subsection tabs; actual offerings; social proof only when supported; primary action sticky above safe area where appropriate. Client brand may alter typography, palette, shape and composition inside an accessible shared shell.

The first viewport must answer who this is, what they offer, where/for whom they operate, and what the user can do. Sparse sources produce a deliberate compact home, not a large empty template or invented services.

### O01 — Owner overview

Header includes workspace and role. Put Needs attention before metrics. Show a maximum of three priority tasks above the fold, then two meaningful indicators and a recent-activity list. Every task opens its actual record. Example indicators are conceptual only; zero/unavailable/delayed are distinct states.

### ST02 — Studio editor

Top: back, artifact title, version/save state. Center: actual editable canvas/media preview with selection feedback. Bottom: contextual tools and persistent review/export actions. Tool palettes open as sheets above the keyboard and safe area. Layers, history and brand assets remain accessible without permanently squeezing the canvas.

The default mobile editor is progressive: choose format → content/media → refine → preview → export/publish. Advanced layers, timeline and transitions remain optional panels. Tablet can show layers, canvas and properties side by side.

### V02 — Website finding

Title describes the observed problem. Show affected URL, scan time, evidence, user impact and proposed change. Present before/after text or visual preview. Distinguish Apply to my Zoi home from an external-site instruction. Application requires appropriate authorization, produces a revision and is followed by verification. No invented SEO or AI visibility scores.

## 8. Full screen and state inventory

Each ID below is an acceptance item. Resolve it to actual current routes instead of blindly creating these names as new paths. Nested screens may share components; they still need distinct behavior and verification.

| ID | Screen | Required content and action | Essential failure/recovery |
|---|---|---|---|
| ON01 | Welcome | Short value proposition; explore or sign in; skip | Offline explanation; no permission wall |
| ON02 | Sign in / create account | Existing supported methods; retained destination | Invalid/expired credentials; retry without duplicate account |
| ON03 | Recovery / verification | Clear next step and resend cooldown | Expired link; account enumeration protection |
| ON04 | Interests / location / language | Optional choices; manual city; Greek/English | Denied location; missing city; skip |
| ON05 | Context chooser | Personal, creator, managed organizations | Revoked membership; no businesses yet |
| H01 | Home | Relevant editorial/community content; feed mode | Empty, stale, offline and retry |
| H02 | Post detail | Author, media, caption, linked entity, replies | Removed post; blocked author; media failure |
| H03 | Comments | Thread, reply, edit/delete own content | Failed send retains text; pagination |
| H04 | Reels viewer | Play/pause, captions, creator, actions, entity CTA | Buffering, data saver, unavailable media |
| H05 | Story viewer | Progress, pause, caption, accessible close | Expired story; reduced motion |
| H06 | Notifications | Grouped updates; unread control; destination | Deleted destination; offline read state |
| E01 | Global search | People, business, events, content, services | No results; spelling/filter recovery |
| E02 | Map/list | Shared selection; area search; approximate precision | No GPS; unresolved address; provider failure |
| E03 | Filters | Geography, category and applicable availability | Conflicting filters; clear all; retained selection |
| E04 | City/category edition | Editorial story, useful local entities, scope | Sparse city; sponsored placement disclosure |
| E05 | Saved collections | Places, posts, products, events; collection edit | Removed items; sync conflict |
| C01 | Client home | Unique offering, brand, navigation, primary CTA | Sparse/unclaimed/closed business; safe fallback |
| C02 | Gallery/media | Fit appropriate to image role; attribution | Broken image; no imagery; accessible controls |
| C03 | Offering detail | Real description, price/unit, availability | Expired offer; unavailable provider |
| C04 | Reviews | Eligible review basis, ordering, report | No reviews; pending moderation; no fake aggregate |
| C05 | Contact/enquiry | Appropriate minimal form; response expectation | Uncertain send; no duplicate enquiry |
| C06 | Claim/ownership | Evidence and review state; invitation handling | Dispute, duplicate claim, rejected evidence |
| B01 | Restaurant menu | Categories, dishes, prices, dietary info if verified | Sold out; stale menu; no invented allergens |
| B02 | Restaurant reservation | Party/date/time; actual slot or enquiry mode | Slot lost; closed day; conflicting selection |
| B03 | Restaurant order | Options, quantity, pickup/delivery, cart | Unavailable item; delivery boundary; changed price |
| B04 | Appointment services | Duration, price, practitioner, location | No staff/slots; variable price explanation |
| B05 | Appointment slot | Availability, timezone, deposit/cancellation | Concurrent booking; expired hold; payment failure |
| B06 | Booking confirmation | Confirmed/requested status, reference, manage | Uncertain payment; cancellation/refund state |
| B07 | Home-service request | Scope, service area, photos, preferred time | Unsupported area; quote not confirmed booking |
| B08 | Home-service progress | Accepted quote, assigned provider, status | Reassignment, dispute, cancellation |
| B09 | Stay search/detail | Dates, guests, units, real stock, policies | Minimum stay; no inventory; changed price |
| B10 | Professional intake | Matter/service, documents, consent, next step | Restricted document; confidential sharing |
| P01 | Parea directory | Groups by interests/location; join type | No matching groups; private group preview |
| P02 | Group home | Purpose, rules, posts, events, membership | Join pending; muted/removed member |
| P03 | Group administration | Roles, requests, reports, announcements | Unauthorized action; audit history |
| P04 | Member/creator profile | Identity, work, posts, links, follow/message | Private profile, block, impersonation report |
| P05 | Media kit/collaboration | Real audience data, offerings, enquiry | Unconnected stats; expired offer |
| CR01 | Create sheet | Allowed formats; recent drafts | Unsupported role; draft restoration |
| CR02 | Post/carousel composer | Text, media order, alt text, audience | Upload interrupted; invalid media; preserved draft |
| CR03 | Video/reel composer | Trim, cover, captions, audio rights | Processing failure; caption correction |
| CR04 | Story composer | Media/text; preview; duration rules | Expired draft assets; unsupported effects |
| CR05 | Publication review | Identity, audience, destination, preview | Missing permission; content validation |
| I01 | Inbox | Messages, requests, updates; unread filters | Empty, blocked sender, offline |
| I02 | Conversation | Messages, attachments, linked records | Sending/failed/uncertain; resend without duplicates |
| I03 | Message requests | Accept, decline, report, block | Abuse protection; no automatic contact sharing |
| Y01 | You | Profile, saved, bookings, tickets, orders, workspace | Signed out; account restrictions |
| Y02 | Profile editor | Public/private distinction; preview | Validation; stale save; explicit clear preserved |
| Y03 | Preferences | Language, accessibility, notifications, privacy | System permission unavailable; clear instructions |
| Y04 | Account/security | Sessions, recovery, export/delete pathways | Reauthentication; deletion status/recovery policy |
| O01 | Owner overview | Tasks, sector KPIs, activity | Stale/no data; role-specific visibility |
| O02 | Workspace switch | Organizations, role, personal return | Unsent draft; revoked access; stale cache |
| O03 | Brand library | Approved logos, colors, type, media rights | Missing source; unsafe contrast; rollback |
| O04 | Team and roles | Invite, role scope, revoke, audit | Expired invite; last-owner safeguard |
| O05 | Home editor | Section composition, offerings, assets, preview | Conflict; explicit clears; missing source |
| O06 | Publish revision | Diff, device preview, approval, publish | Lost response; stale revision; rollback |
| EN01 | Website intake | Source URL, identity match, scope | Invalid domain; access denied; duplicate entity |
| EN02 | Enrichment progress | Actual phases, evidence, cancel/retry | Blocked crawl; partial extraction; timeout |
| EN03 | Source review | Field/media evidence, accept/edit/reject | Contradictions; rights issue; owner override |
| EN04 | Client design brief | Offering, audience, identity, priorities | Missing identity; no arbitrary inferred facts |
| ST01 | Studio start | Goal, format, brand, source assets, saved drafts | Unconnected provider; credit/budget limit |
| ST02 | Design editor | Editable layers, text, image, crop, history | Autosave failure; conflict; missing font/media |
| ST03 | Video editor | Timeline, trim, captions, audio, cover | Interrupted processing; incompatible export |
| ST04 | AI task | Context, source, draft result, edit, cost status | Provider error; unsafe prompt injection; cancel |
| ST05 | Media library | Originals, derivatives, rights, search | Pending processing; failed upload; delete dependencies |
| ST06 | Export | Format, resolution, selected pages, progress | Timeout; partial output; retry without recharging |
| PU01 | Content calendar | Draft/scheduled/published; timezone; filters | Failed job; disconnected account |
| PU02 | Channel connection | Provider, account identity, scopes, health | OAuth denied/expired; wrong account |
| PU03 | Publish/schedule | Destination variants, approval, final preview | Partial success; retry failed destinations only |
| PU04 | Delivery detail | Provider receipt, live URL, actual errors | Unknown result; reconciliation before retry |
| CU01 | Contacts | Search, source, consent, tags, lifecycle | Duplicates; opt-out; restricted fields |
| CU02 | Contact timeline | Enquiries, bookings, orders, messages | Wrong workspace; redacted data |
| CU03 | Pipeline | Stages, owners, next actions, activity | Concurrent moves; stale permissions |
| EM01 | Email campaign | Audience, exclusions, content, preview | Missing consent/suppression; disconnected service |
| EM02 | Email review/report | Test, approval, schedule, receipt, metrics | Bounce/suppression; unknown delivery |
| V01 | Website scan | Domain, scope, progress, previous scans | Crawl blocked; partial scan; unavailable integration |
| V02 | Finding/change preview | URL, evidence, impact, before/after | Unsupported external write; owner edit conflict |
| V03 | Apply/rescan | Revision, approval, result, verification | Failed write; rollback; problem persists |
| AN01 | Performance | Source, period, currency/timezone, measures | Zero/unavailable/delayed differentiated |
| AN02 | Attribution detail | Event path, definition, limitations | Missing identity/consent; unattributed event |
| AU01 | Automation builder | Trigger, conditions, actions, approval | Invalid scope; loop/cost guard |
| AU02 | Automation runs | Step state, outputs, retry, pause | Partial completion; revoked access |
| SH01 | BuyGreek storefront | Products, sellers, collections, search | Unavailable item; unsupported shipping |
| SH02 | Product detail | Variants, real price/currency, stock, seller | Variant sold out; changed price |
| SH03 | Cart/checkout | Totals, fees, delivery, authorized payment | Inventory race; payment uncertainty |
| SH04 | Orders/returns | Order state, tracking, request/refund | Partial fulfillment; provider delay |
| EV01 | Event detail | Organizer, time/zone, location, prices, access | Cancelled/rescheduled; sold out |
| EV02 | Seat/table selection | Accessible 2D source inventory; optional 3D | Hold lost/expired; no available adjacent seats |
| EV03 | Group allocation | Whole-ticket quotas, invitations, accepted/paid | Expiry, revoked allocation, duplicate claim |
| EV04 | Event checkout | Real hold, buyer details, price, confirmation | Duplicate webhook; uncertain charge; release hold |
| EV05 | Ticket wallet/check-in | Ticket validity, QR, offline rules | Used/revoked ticket; offline conflict |
| EV06 | Event operations | Orders, inventory, staff roles, notices | Unauthorized price change; stale inventory |
| RC01 | Recipe detail | Creator, ingredients, servings, steps, media | Missing source; unavailable product match |
| RC02 | Cook-along | Step focus, timers, optional voice, shopping list | Background timer; interrupted session |
| OR01 | Parish/cultural home | Calendar, programs, giving, volunteering | Closed registration; restricted member record |
| OR02 | Dance/school programs | Classes, rosters, attendance, consent | Minor data restriction; waitlist |
| SP01 | League/team hub | Season, fixtures, standings, venue, roster | Disputed result; postponed match |
| AD01 | Business administration | Documents, obligations, supported providers | Unsupported jurisdiction; no false filing claim |
| AD02 | Integrations/billing | Provider health, plan, usage, invoices | Expired access; failed payment; limit reached |
| MD01 | Report/block/moderation | Reason, evidence, outcome, appeal path | Unauthorized access; safe retention |

## 9. Every client gets its own experience

### Required client design brief

Persist a source-bound brief containing: canonical entity ID; verified website(s); exact name and logo; geography/service area; offering taxonomy; services/products/prices with dates; intended customer tasks; brand palette and usable type; image roles and rights; differentiators actually supported; operational integrations; owner edits; unknowns; prioritized layout; explanation of the design decisions.

The renderer consumes this brief and existing shared content contracts. A bespoke design must be possible without per-record forks. Use reusable composition primitives and sector operations, not a new copied application for each business.

### Sector compositions

| Client | Art direction | First useful content | Primary real journey |
|---|---|---|---|
| Restaurant | Food-led, atmosphere and menu hierarchy | Menu, current hours, dining experience | Reserve/order/enquire according to actual capability |
| Barber/stylist | Portfolio, craft, practitioner identity | Services, durations, team, transparent price basis | Service → practitioner → slot → confirmation |
| Performer/creator | Media-forward, distinctive personal identity | Work, shows, releases, collaborations | Watch → follow → event/media-kit action |
| Accommodation | Spacious photography, property-specific navigation | Dates, guest fit, unit detail, policies | Search real stock → price → book |
| Home services | Clear service area and reassuring evidence | Supported jobs, process, actual availability | Describe job → quote/request → accepted work |
| Professional | Quiet, credible, information-rich | Expertise, service scope, verified credentials | Appropriate enquiry/intake → private follow-up |
| Parish/cultural group | Community imagery, calendar and participation | Services/programs/events and contact | Join/register/volunteer through authorized flows |
| Retailer | Product-first merchandising | Collections, variants, stock, delivery | Product → cart → checkout → order |

Within each sector vary composition according to the client. A contemporary barber and heritage barber cannot be distinguished only by their accent color. Existing owner-selectable layouts remain available; restaurants retain the existing Concierge default unless the owner chooses otherwise.

### Enrichment pipeline

Lead → identity verification → controlled crawl → structured extraction → image-role review → evidence-bound brief → editable home draft → quality review → publication/claim workflow → continuous source-change proposals.

Crawl relevant service/menu/team/about/contact/location pages, not just the homepage. Respect access controls, permitted usage, crawl limits and content rights. Treat fetched content as untrusted data, never instructions to an agent. Show unavailable facts as unknown. Owner edits and intentional clears override imports. Source changes propose revisions rather than overwriting owners silently.

Do not crop logos like photos or use a venue poster as a portrait. Visually inspect source imagery. Metadata and filenames alone are insufficient. Trace missing content across extraction, storage, API projection and rendering.

## 10. Connected tools, not decorative menus

### Integration contract

Each tool must expose: supported capability, required account/scope, connection state, inputs, draft, execution, persisted result, verification, failure recovery, costs and disconnect behavior. A URL or OAuth success does not prove a working integration.

Keep states distinct: unavailable; not connected; connecting; connected; permission missing; expired; processing; needs review; partially complete; completed; failed; outcome uncertain. Translate them into clear customer language.

### Creative and AI

Client-specific AI uses approved brand, offerings, documents and assets within permissions. Show relevant sources for factual claims and editable drafts. Preview cost or usage impact where meaningful. Explicit publication/charging approvals remain separate from generation. Manual edits do not trigger unnecessary paid regeneration.

Studio covers posts, carousels, stories, posters, menus, media kits, short/long video, captions, transcripts, clipping, cover images, voice integration and export. Preserve editable document state plus rendered exports, not just one flattened generated image. Use version history, undo/redo, autosave, upload recovery, background-job resumption and clear output ownership.

Canva and other providers must use supported, verified integration workflows. Do not promise an embedded complete editor because a provider supports asset transfer. A provider handoff must explain where the user is going and how output returns to the correct workspace.

### Marketing

One calendar and asset library across native Zoi publication and supported external channels. Each destination gets its own preview and validation. Scheduling includes timezone and a final context check. Partial success never triggers a duplicate successful post. Consent and suppression apply to email and messages, including automated actions.

### Website, SEO and AI discovery

Scan → evidence → priority → proposed correction → preview → authorization → apply/instructions → rescan → measure. Separate crawlability, metadata, structured data, broken links, accessibility, performance, local consistency and search data. Explain AEO/GEO work in plain language; do not guarantee ranking, indexing or AI citations.

### Metrics

Every metric has definition, source, time range, timezone, freshness and denominator where applicable. Keep bookings requested separate from confirmed; revenue separate from gross order value and refunds; views separate from distinct people. Attribution must disclose unknowns. No fabricated score, trend or estimated value presented as measured.

## 11. Social, community and media behavior

Support text, images, carousels, reels, long videos, stories, replies, reactions, following, saves, share, search, notifications and appropriate private/group conversations. Reuse one post/content model where sensible while allowing distinct media presentation.

The Zoi distinction is meaningful connection: a food reel links to its restaurant/recipe/product; an artist clip links to verified shows; a business update links to an actual offering; a group announcement links to its program. Linked entities must be real and authorized.

Users control recommendation interests, geography and feed mode. Explain why a recommendation appears; provide hide/not-interested/report controls. Do not infer sensitive identity from a surname or force cultural affiliation. Sponsorship is visibly disclosed.

Implement resumable upload, actual processing state, thumbnails, appropriate encodings, adaptive delivery where supported, captions, rights fields, CDN access controls and deletion. Pause invisible media, avoid preloading many full videos and preserve user playback preferences. Failed posting retains the draft. An uncertain publish result is reconciled before retry.

Reporting, blocking, spam controls, impersonation protection, moderation and appeals are part of the release. Age-appropriate and guardian-consent flows must precede protected child records. Do not populate the community with fabricated engagement or copied unauthorized media.

## 12. Commerce, events and special suites

### Commerce

Use existing BuyGreek/Shopify architecture and current authorized APIs; this specification makes no claim of API access. Customer shopping and store administration are separate authorization contexts. Preserve real stock, seller identity, variants, currency, fees, shipping, taxes supplied by the appropriate system, payments, refunds, fulfillment and payouts. Never mark a payment successful based only on returning to the app.

### Events and venue experiences

Maintain one authoritative inventory and seat/layout model. Accessible 2D selection is always available; 3D is optional enhancement. Real expiring holds, seat availability, whole-ticket group allocation, split-payment status, checkout, QR issuance and check-in must reconcile server-side.

Preserve existing Signature requirements: source-based Toronto/Montreal differences; approved venue furniture; actual event branding and sponsorship; guest groups; quantity allocations; genuine organizer approval. Toronto's white lounges and pink sponsor-lounge treatments must not be flattened into Montreal's black-cloth setup. Do not invent dimensions, availability or equipment from imagery.

### Culture and daily-life suites

Retain recipe/cook-along servings, timers, voice option, shopping lists and creator attribution; dance groups, auditions, costume inventory and rehearsals; parish programs, volunteering and giving; schools with guardian controls; sports season/fixture/roster/result-dispute workflows; travel, stays and artists; business records and supported administration providers. Use focused sector tools instead of exposing them all on every home screen.

## 13. Photography, video and high-resolution assets

### Role-specific art direction

- Zoi editorial: authentic contemporary community, craft, food, work and culture across the diaspora. A city edition uses imagery appropriate to that place.
- Business hero: actual business photography or owner-approved material. Never present generated interiors/staff as photographs of a real client.
- Product: accurate item/color/variant; consistent background and scale. Never generate false product details.
- Creator: creator-owned portrait/work, consent and attribution as applicable.
- Logo: contain with intentional padding; never stretch or crop letters.
- Poster/menu: fit readable entire composition; provide zoom/full-screen view.

### Asset manifest

For every asset store: asset ID, tenant/entity ID, source URL or upload identity, original dimensions, MIME, rights/consent status, alt text, focal point, role, source date, transformation lineage, derivative sizes, processing state and deletion status.

Keep originals. Generate derivatives once per source/version/transform. Prefer modern efficient formats where supported and keep appropriate fallbacks. Strip unnecessary sensitive metadata from public derivatives. Never call an interpolated upscale a higher-detail original.

| Use | Layout ratio | Desired source/export when available |
|---|---|---|
| Full-width client hero | 4:3 or client-specific cinematic crop | At least 1600px wide source preferred |
| Tall editorial feature | 4:5 | 1600×2000 or better source preferred |
| Feed image | 4:5, 1:1 or original supported ratio | 1080px delivery variant; preserve original |
| Story/reel artwork | 9:16 | 1080×1920 minimum target export |
| Avatar | 1:1 | 256/512 derivatives; source retained |
| Poster/print download | Original intended aspect | Pixel size/density matched to actual output |
| Screen design exports | Actual 390×844 logical reference | 1170×2532 at 3× from rendered implementation |

These are production targets, not claims about every attached image. The package manifest records the actual generated-image dimensions. Do not stretch the provided concepts into fake 4K deliverables. High-resolution implementation screenshots must come from the actual rendered interface; they are not proof of functioning APIs.

## 14. Component contracts

| Component | Variants | Mandatory behavior |
|---|---|---|
| BrandHeader | member, owner, client, immersive | Exact logo; safe area; role/context; long title |
| GlassTabBar | member/owner; light/dark/opaque | Labels; selected state; badges; keyboard handling |
| ContextSwitcher | personal/business; role badge | Server-validated access; draft warning; cache isolation |
| ActionButton | primary/secondary/quiet/destructive | Loading, disabled reason, focus, no duplicate submit |
| MediaCard | editorial/post/product/event | Role-aware fit; alt; skeleton; fallback; attribution |
| EntityCard | business/person/group | Real identity; one main action; no false verification |
| OfferingCard | menu/service/product/ticket | Price basis/currency; availability; appropriate CTA |
| BottomSheet | compact/medium/full | Focus management; safe area; keyboard; dismiss/recovery |
| FilterBar | category/chips/segmented | Count/selection; clear; no clipped required labels |
| FormField | text/select/date/money/upload | Visible label; inline error; preserved input |
| StatusBadge | operational/provider/verification | Meaning via text/icon, not only color |
| JobProgress | upload/crawl/AI/publish | Actual phase; retry/cancel; resume; unknown duration |
| EvidencePanel | website/source/metric | Source/date/evidence; expandable technical details |
| MetricTile | measured/zero/unavailable/delayed | Definition, range, freshness; drill-through |
| RevisionPreview | content/website/brand | Before/after; approvals; stale-write recovery |
| EmptyState | first-use/no-results/no-access | Specific explanation and one useful next action |
| ErrorState | local/network/provider/permission | Preserve work; actionable retry; safe incident reference |
| PermissionPrompt | location/media/push | Contextual rationale; decline supported |
| UploadQueue | image/video/document | Persisted job; partial failure; background/resume |

Use existing accessible component primitives where possible. Document props, state transitions, semantic labels, analytics events, content limits and platform variations. A component is not complete with only its default happy state.

## 15. State, data and operational contracts

### Shared state model

Account → memberships → explicit workspace → entities → offerings/content → customer actions → operational records → metrics. Use stable IDs and one authoritative writer per concern. UI states must reflect server truth, not optimistic assumptions that cannot be reconciled.

Optimistic updates are suitable for reversible local interaction with reconciliation; payments, publication, booking confirmation and access changes require authoritative results. On lost responses, use an operation ID to check outcome before retrying.

Common loading sequence: retained content if available → clearly marked stale content where needed → skeleton for first load → actionable error/retry. Do not replace useful cached content with an endless spinner.

Drafts belong to the current account/workspace and persist through ordinary interruption. A success toast means persistence was confirmed. Autosave distinguishes saving, saved, failed and conflict. Explicit owner clears are durable decisions.

### Instrumentation

Define events such as discovery_open, entity_open, offering_open, enquiry_submit, booking_confirmed, asset_exported, publish_confirmed, scan_completed and change_verified. Keep operational records separate from analytics events. Do not include private message bodies, financial details, secrets or sensitive documents in telemetry.

Measure complete task success and failure, not only clicks. Record environment, release and sanitized correlation IDs. Link founder dashboard evidence to actual deployment/build and operation result.

## 16. Accessibility, localization and responsive adaptation

- Target WCAG 2.2 AA for web surfaces and corresponding accessible native journeys. Normal text contrast at least 4.5:1; large text at least 3:1. Verify text against composited glass/image backgrounds, not just token swatches.
- Use 48 logical-unit interactive targets as the Zoi default. Adjacent controls have adequate separation. Screen-reader name, role, state and action are explicit.
- Support VoiceOver/TalkBack, keyboard navigation on web/tablet, visible focus, proper reading order and announced validation/job changes. No gesture-only action without a visible alternative.
- Caption video; provide relevant alt text. Do not hide essential content only in imagery. Charts have summaries and accessible data views.
- Respect reduced motion, reduced transparency, increased contrast and data-saving preferences. Test high text scaling and long translations.
- Greek and English are first-class. Preserve accents, localized punctuation, dates, numbers, pluralization and appropriate search behavior. Use locale-aware formatting and currency labels; do not assume all diaspora users are in Greece or Canada.
- Store times with sufficient zone context. Display event/business timezone where it could differ from the user's. Confirm scheduled publication time explicitly.
- At compact widths, content stacks. At tablet widths, use rail/list-detail/editor panels where they improve tasks. Do not stretch phone cards across the whole tablet. Respect split-screen and landscape where supported by the product.

## 17. Performance, security and privacy requirements

### Proposed measurable budgets

Choose and record representative midrange Android and supported iPhone devices plus test network conditions before measurement. Target 60fps for primary interaction, approximately 16.7ms per frame; record missed frames in actual captures. Target p95 visible tap feedback under 100ms for local actions. Fetch and processing latency must be measured separately; do not hide slow jobs behind fake completion.

Use virtualized feeds, appropriately sized images, bounded video prefetch, cached thumbnails, cancellation of obsolete requests and limited simultaneous blur surfaces. Set initial media transfer budgets by screen and validate them before release. Do not claim a budget passed without traces.

### Security/UI boundaries

Authorize every private record and action server-side. Scope storage, caches, jobs and exports to the correct tenant. Keep tokens and provider credentials out of clients, logs and image metadata. Verify encryption configuration and secure mobile credential storage rather than relying on UI badges.

Handle malicious uploaded documents and crawled content as untrusted input. Enforce allowed fetch destinations and file validation. Use scoped permissions, constrained AI tools, bounded retries and spending controls. Account deletion and disconnect must stop affected background work according to defined retention rules.

Public profiles cannot reveal owner email, customer details, raw import/debug fields or private source records. Admin/founder tools stay separate from public pages. Claims such as verified, secured, delivered and confirmed require defined evidence.

## 18. Acceptance scenarios and release gates

For every scenario record test identity/role, fixtures, platform, exact build/deployment, steps, observed result, screenshots where relevant and unresolved limitations.

1. New visitor opens a business deep link, explores without unnecessary signup, signs in when acting and returns to the same intended action.
2. A member changes city; map/list, editorial content and relevant filters agree without pretending precise location for approximate records.
3. A barber client and restaurant client render materially different source-informed homes and complete the correct service-specific journeys.
4. An owner edits a price, clears a field, previews, publishes and sees the same update on web/iOS/Android. Later crawling does not undo that decision.
5. A source import hits contradictory identity or unavailable imagery; the reviewer sees evidence and no false public facts appear.
6. Studio creates an editable artifact from approved assets; draft survives interruption; export is retrievable; publication receives a real provider result.
7. One publication destination succeeds and another fails; retry does not duplicate the successful post.
8. A website finding shows evidence, produces an authorized revision and rescans. An external site without write access gets clear instructions rather than fake success.
9. A video upload is interrupted, resumed, processed and played with captions; private content remains private.
10. A booking slot or event seat is requested concurrently; one authoritative result wins; losers receive a usable recovery path without duplicate charge.
11. A shopper sees a price/stock change before checkout and receives accurate order and refund status.
12. A user reports/blocks abusive content; the relevant views and notifications respect the action.
13. Owner switches workspaces during a pending task; data and task remain properly scoped. Revoked role cannot finish an unauthorized write.
14. Greek long names and large text work at compact widths; sheets, keyboard, navigation and sticky CTAs never hide essential controls.
15. Light/dark, reduced transparency and reduced motion are visually inspected. No unapproved replacement logo appears anywhere.
16. Offline, expired session, provider refusal, slow network and uncertain-write outcomes preserve work and explain recovery.

### Visual acceptance

Inspect every inventory screen and important sheet in its real implementation. Use populated, sparse, long-content, empty, error, loading and permission-limited fixtures. Capture complete flows rather than only landing screens. Test representative phone widths 320/360/390/430, tablet and desktop adaptations where applicable; these are test targets, not assumed device coverage.

Reject clipped labels, unreadable glass, mismatched logo, invented facts, duplicate navigation, unavailable actions masquerading as enabled, blank tool destinations, overflowing numbers, image-role mistakes, inaccessible dismiss controls and unsaved work reported as saved.

### Shipping evidence

Source implemented, web deployed, native build created, device tested and store/public distribution are different milestones. Attach evidence to the exact artifact tested. Store review is external. No public release or unapproved spending is inferred solely from this design handoff; follow the user's existing execution authorization and required gates.

## 19. Codex execution sequence and required deliverables

1. Reconcile current scope/routes/components/providers and exact logo assets. Record concrete gaps without beginning another open-ended audit.
2. Establish shared tokens, brand shell, accessibility modes, typography, media roles and component states. Keep existing routes working.
3. Implement three reference journeys completely: member discovery → client action; owner source → individual home → edit/publish; owner Studio → review → actual supported publication/export.
4. Apply shared system and sector-specific compositions across the inventory. Complete the social, commerce, events, growth and operational journeys without replacing them with placeholders.
5. Verify genuine integrations, adverse states, permissions, responsive/native performance and visual quality. Correct findings.
6. Release through existing authorized controls, verify the actual destination and update the delivery dashboard. Continue remaining scope explicitly.

Required repository deliverables: reconciled screen/route map; shared tokens and components; asset provenance manifest; actual implemented screens; persisted job/revision flows; screen-state evidence; provider capability matrix; end-to-end results; release/build manifest; remaining-work and exact owner-action list.

The founder dashboard must show useful plain-English outcomes with Open/Test links. Status cannot be inferred from number of files touched or tests run. Unsupported and unverified items stay open.

Do not ask George to choose routine spacing, icon sizes, component patterns, database field names or sensible recovery behavior. Make professional decisions within this specification. Escalate only a real product conflict, missing external authority/access or spending decision, with a concrete proposal ready to review.

## 20. App opening and launch sequence

The welcome image is an interactive first-use screen, not the native operating-system launch screen. Never hold users on branding while the app is already usable.

| Stage | Visual treatment | Action / routing | Acceptance |
|---|---|---|---|
| L00 Native launch | Exact approved mark, quiet pearl or navy background; no fake progress, text buttons or photographic dependency | OS-controlled handoff to app initialization | No mandatory timer or extra network request just to dismiss |
| L01 Bootstrap | Same stable background; accessible short status only if actual work takes time | Restore session, read pending link and resolve access | Bounded work; errors recover; no endless spinner |
| L02 First-use welcome | Cinematic art direction, exact mark, concise promise, Explore Zoi / Sign in / language | Explore without forced account creation | Buttons visible on compact phone and large text; no permission requests |
| L03 Returning member | Restore last permitted root context and useful cached content | Open pending link first when valid; otherwise retained Home | No repeated onboarding; no stale private content after logout |
| L04 Returning owner | Restore authorized workspace and last safe destination | Role revalidation before private action; clear context | Revoked membership returns safely to chooser/personal mode |
| L05 Deep-link destination | Show entity/content with correct public shell | Authenticate only for action requiring it; resume intent once | No homepage detour; no repeated submit after login |
| L06 Expired session | Plain explanation and sign-in action; preserve permitted drafts | Reauthenticate; verify workspace; resume safe task | Private data not flashed; pending operation outcome reconciled |
| L07 Offline startup | Cached permitted content plus honest Offline status | Explore cached content; retry connection; queue permitted drafts | No false live availability/booking/payment status |
| L08 Optional setup | Language, city, interests and profile choices one clear task at a time | Skip available; manual city without GPS | No all-permissions-at-once gate |

### Opening motion storyboard

The operating-system launch screen is static. The app may use a short 180–250ms fade into the ready screen, respecting reduced motion. If the welcome is used, one restrained image reveal is optional; no looping liquid animation, forced delay or sound. Tap feedback is immediate. Background illustration cannot delay navigation. Use a local lightweight fallback when media is unavailable.

### Welcome layout contract

At 390×844 logical reference: safe area; brand region with 40–56 high mark; headline around 32/36 with controlled wrapping; concise explanation; one meaningful art region; bottom action surface with 48-high Explore Zoi button and 48-high sign-in target; language/privacy beneath or in a small accessible footer. Decorative content yields space first on compact screens. The photograph is allowed to crop; buttons and copy are not.

The generated welcome study uses a more expansive logo and photography for art direction. Use these layout constraints in the actual app. The custom serif Zoi text shown by a generator is not an approved replacement wordmark; use existing approved wordmark assets or existing product typography until a wordmark is explicitly approved.

### More surfaces: required visual treatments

- Event detail: dark atmospheric media, readable date/venue information, accessible inventory selection and a clear purchase review action. The supplied event illustration is fictional and cannot become a real seating plan. Actual 2D inventory remains authoritative; a 3D/illustrated preview needs a labeled alternative and cannot substitute for accessible selection.
- BuyGreek: editorial makers and real product photography, explicit seller and currency, legible cards and useful collection filters. Resolve BuyGreek's own approved identity before production; the concept's typography is not a new approved logo. Actual stock/prices come from the commerce system.
- Creator: creator-first identity, portrait/media, clear follow and contact, work/show tabs, media-kit path and disclosed commercial relationships. Avoid generic restaurant-style hero/buttons.
- Accommodation: property-specific imagery, unit/date/guest controls, transparent price basis and real inventory. A request-to-book must not look like instant confirmation.
- Booking: focused service/date/staff flow; reliable hold/expiry behavior; dedicated confirmation and manage-booking screens. Do not hide a form inside an overdecorated profile.
- Source review and website improvements: readable evidence/diff surfaces with glass navigation only; proposed changes, applied revisions and verified outcomes remain separate.

## 21. Music, singers, long-form video and professional networking

These are first-class product surfaces, not external links added to a generic profile. Use a shared identity/content graph but distinct viewing and operating experiences. A singer's app-within-Zoi can have Music, Videos, Shows, Journal, Shop and About; a professional's can have Expertise, Work, Articles and Contact. Keep subsection navigation compact and progressively expose extra sections.

### Music and artist experience

The artist controls approved identity, imagery, bio, catalog, credits, show links, merchandise and fan updates. Publish only music, lyrics, artwork and video for which the necessary rights and access exist. A provider embed or link is not an owned streaming catalog. Distinguish native playback, permitted embedded playback, preview-only and external-provider handoff.

Music surfaces include artist home, release detail, track player, queue, lyrics where licensed, credits, saved library, playlists, shows, merchandise and artist administration. Persist playback position appropriately; coordinate audio focus so a reel and a song do not play over each other. Background audio, lock-screen controls, downloads, casting and picture-in-picture require actual platform/provider support and implementation; never expose working-looking controls without those capabilities.

The fetched native configuration disables video background playback and picture-in-picture. Treat any new background/player behavior as an explicit implementation and verification task, not a current feature. Offline downloads require appropriate rights, storage management and revocation rules. Playback denial must explain why without pretending a track played.

An artist's ticket journey links to the correct event and authoritative inventory. Artist merchandise uses real seller/catalog records. Follow, paid membership, professional connection and ticket purchase are different relationships and cannot be silently substituted.

### Long-form viewing and channels

Provide a dedicated watch surface with source-appropriate aspect ratio, playback controls, captions, quality options where supported, chapter navigation, description, creator identity, related work and comments. Miniplayer is optional and must never obstruct checkout or typing. Preserve playback position and account privacy. Live streaming is a separate capability with ingestion, latency, moderation and rights requirements; a video page is not evidence of live support.

### Professional network

Member profiles can expose an optional professional layer: actual roles, portfolio, services, publications, credentials where verified, collaboration preferences and explicit availability. Provide connection requests separate from follows, messages governed by recipient controls, real opportunities/briefs and application/introduction status. Do not invent endorsements, employers, verified credentials or job openings.

### Social format contract

| Format | Zoi purpose | Presentation | Important distinction |
|---|---|---|---|
| Conversation/post | Community and relationships | Readable mixed feed and discussion | Public post vs private group |
| Photo/carousel | Story, work and offerings | Intentional media crop; swipe count; alt text | Media object vs linked actual product |
| Reel | Short discovery and creativity | Full-screen controlled playback | Entertainment vs sponsored offer |
| Long video | Shows, learning and deeper stories | Watch page, chapters, captions | Stream availability vs uploaded metadata |
| Professional article | Expertise and collaboration | Comfortable reading and author context | Opinion vs verified credentials |
| Music | Artist catalog and fan relationship | Player, release, queue, credits | Owned/licensed playback vs external link |
| Story | Short-lived updates | Accessible timed viewer with pause | Expiry and retention explained |
| Live session | Real-time participation if supported | Explicit live status and moderated chat | Scheduled event is not an active live stream |

Use one coherent Zoi social identity and shared moderation/reporting. Do not copy another platform's logos, trade dress or exact screen composition. Familiar interaction conventions can coexist with original design and meaningful links into the Zoi ecosystem.

### Additional acceptance inventory

| ID | Screen | Required content and action | Essential failure/recovery |
|---|---|---|---|
| MU01 | Artist home | Bespoke identity, catalog, shows, follow, merch | No catalog; unclaimed artist; unavailable content |
| MU02 | Release detail | Cover, tracks, credits, availability, save | Territory/provider restriction; removed track |
| MU03 | Full music player | Play/pause, seek, previous/next, current source | Buffering, interruption, audio-focus conflict |
| MU04 | Queue | Reorder, remove, clear, next track | Unavailable next item; concurrent library edit |
| MU05 | Lyrics/credits | Authorized text/credit source, readable display | Lyrics unavailable; correction/report |
| MU06 | Music library | Saved tracks, releases, artists, playlists | Sign out privacy; deleted catalog item |
| MU07 | Playlist editor | Name, visibility, order, artwork, collaborators | Conflict; rights-restricted item |
| MU08 | Artist shows | Real event list, geography, tickets | Cancelled/rescheduled show; stale links |
| MU09 | Artist merchandise | Actual seller items, variants, cart | Sold out; unrelated seller mismatch |
| MU10 | Artist catalog manager | Upload, metadata, ownership/rights, publish | Processing failure; missing rights; takedown |
| MU11 | Artist fan updates | Explicit audience/preferences; draft/send | Revoked permission; unsubscribed fan |
| MU12 | Playback settings | Data use, audio preferences, supported options | Unsupported background/download capability |
| VD01 | Watch home | Followed channels, relevant long videos, continue | No watch history; deleted media |
| VD02 | Watch detail | Player, captions, chapters, author, comments | Media failure; private/deleted video |
| VD03 | Channel home | Creator branding, series, videos, about | Empty channel; impersonation report |
| VD04 | Series/playlist | Ordered videos and progress | Missing episode; restricted item |
| VD05 | Video search | Query, topic, duration, creator | Empty results; unavailable media |
| VD06 | Captions/quality | Real available tracks and encodings | Unsupported language; failed quality switch |
| VD07 | Live session | Actual live state, moderation, latency state | Stream ended; reconnect; reporting |
| VD08 | Creator video manager | Upload, thumbnail, captions, rights, release | Incomplete processing; false-live prevention |
| PN01 | Professional home | People, articles, opportunities, interests | Sparse network; no fabricated recommendations |
| PN02 | Professional profile | Roles, expertise, portfolio, contact preferences | Unverified credentials; privacy restrictions |
| PN03 | Connection requests | Accept/decline/withdraw, recipient context | Duplicate request; blocked account |
| PN04 | Opportunity detail | Real brief, organizer, terms, application | Closed brief; scam report; missing terms |
| PN05 | Application/introduction | Relevant work, message, consent, status | Failed send; withdrawn opportunity |
| PN06 | Article reader/editor | Draft, formatting, author, accessible read | Autosave failure; publication permissions |
| PN07 | Collaboration workspace | Participants, brief, files, milestones | Revoked access; disputed deliverable |
| BC01 | Barber appointment details | Chosen service/staff/time/location/policy | Slot changes; price/duration changes |
| BC02 | Barber reschedule/cancel | Allowed options and real booking state | Cutoff reached; refund/provider delay |
| BC03 | Barber owner calendar | Staff schedule, requests, blocked times | Double booking; permission-limited staff |
| BC04 | Restaurant item options | Real modifiers/allergens if verified | Sold-out option; changed menu |
| BC05 | Restaurant order status | Accepted/preparing/ready/fulfilled states | Rejection, cancellation, uncertain payment |
| BC06 | Restaurant owner operations | Reservations, menu, hours, fulfillment | Overbooking; unconfirmed order |
| BC07 | Stay room detail | Unit photos, capacity, dates, price basis | Unit unavailable; unsupported dates |
| BC08 | Stay checkout/manage | Guest details, policies, confirmation | Hold expiry; payment uncertainty; cancellation |
| BC09 | Stay owner inventory | Units, rates, restrictions, calendar | Channel conflict; stale external stock |
| BC10 | Home-service quote review | Scope, price basis, provider, acceptance | Revised quote; unsupported service area |
| BC11 | Professional document exchange | Private files, access, expiry, audit | Unauthorized sharing; invalid attachment |
| BC12 | Retail seller operations | Stock, orders, fulfillment, refunds | Partial fulfillment; inventory race |
| TK01 | Ticket quantity/price | Available types, fees, accessible options | Stock changed; quantity exceeds allocation |
| TK02 | Ticket buyer review | Buyer details, amount, hold, policy | Hold expiry; missing buyer data |
| TK03 | Ticket confirmation | Authoritative booking/receipt, wallet | Payment pending; duplicate webhook |
| TK04 | Ticket transfer | Eligible recipient, transfer state, revoke | Already used; transfer restriction |
| TK05 | Check-in scanner | Actual ticket validation and staff scope | Offline conflict; duplicate/invalid ticket |
| TK06 | Refund/reschedule notice | Actual organizer policy/state | Provider delay; disputed request |
| MP01 | Map search bounds | Explicit search area and result extent | Antimeridian/worldwide search; sparse area |
| MP02 | Map place details | Verified place, precision, actions | Approximate location; missing coordinates |
| MP03 | Directions handoff | Origin, destination, mode, provider | GPS denied; provider unavailable |
| MP04 | Saved places/itinerary | Ordered actual entities and notes | Deleted place; route limit; no fake optimization |
| TL01 | Tool library | Role/sector-relevant tools, pin/search | Unsupported tool; missing connection |
| TL02 | Tool job detail | Input, actual phases, output, retry/cancel | Partial result; quota; outcome uncertain |
| TL03 | Form builder | Fields, consent, preview, publish, submissions | Invalid configuration; spam; private responses |
| TL04 | Automation approval | Proposed action scope, recipients, cost | Revoked permission; looping trigger |
| TL05 | Provider repair | Exact account/scopes/error, reconnect | Wrong workspace account; repeated denial |

### Bespoke-profile implementation boundary

Create shared primitives for brand headers, editorial modules, offering menus, players, bookings, galleries, events and operational status. Compose them from a client-specific brief. A page is not bespoke solely because it uses a different accent. The brief must influence which information leads, image composition, typography hierarchy, subsection navigation, primary action and follow-up workflow.

Add sector extensions for fitness/wellness, education, venues, tourism guides, associations, professional services and other verified types using real offerings and supported operations. Do not expose sensitive regulated intake or promise specialist capabilities without appropriate implementation. Unknown business types receive a thoughtful source-derived offering/enquiry experience and a review task; never invent an industry toolset.

### Concept corrections to carry into code

Some generated studies use oversized logos, serif utility labels, compressed controls or inconsistent tab selection. Correct these using the token/navigation rules. The website-tools study visually mixes a description finding with a title change: implement them as separate accurately named findings. The map artwork is illustrative, not geospatial evidence. Event seating art is not an inventory model. The artist miniplayer must obey actual playback state. No screenshot detail overrides business truth or accessibility.

## 22. Research basis and boundaries

Research checked 16 October 2026. These references inform the direction; the Zoi-specific measurements and architecture above are design recommendations.

1. Apple, **Materials**: https://developer.apple.com/design/human-interface-guidelines/materials — supports treating Liquid Glass as a control/navigation material rather than applying translucency indiscriminately to content.
2. Apple, **Adopting Liquid Glass**: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass — platform adoption and user appearance/accessibility settings. Verify current compatibility against the installed native stack.
3. Google Design, **Better, Easier, Emotional UX**: https://design.google/library/expressive-material-design-google-research — expressive shape/color/containment can establish hierarchy; familiar patterns and visible action labels remain important. This specification does not claim Google's research results apply automatically to Zoi.
4. Material Design, **Motion overview**: https://m3.material.io/styles/motion/overview/how-it-works — reference for purposeful motion; Zoi timings remain proposed values to test.
5. W3C, **Understanding SC 1.4.3 Contrast (Minimum)**: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html — normal-text 4.5:1 and large-text 3:1 contrast thresholds.
6. Current Zoi scope: https://github.com/pangaon/zoi-city/blob/main/docs/recovery-scope.json — full ecosystem and individualized-client requirements; refresh before implementation.
7. Current Zoi delivery instructions: https://github.com/pangaon/zoi-city/blob/main/docs/specialists/zoi-delivery/SKILL.md — owner-safe enrichment, actual outcomes, sector design and evidence requirements.
8. Logo provenance: https://github.com/pangaon/zoi-city/blob/main/docs/audits/zoi-logo-source-and-surfaces-2026-09-30.md — approved blue/olive masters and derivative history; historical audit passages are not current deployment claims.

**Final acceptance:** the visual system is recognizable as Zoi; each client feels individually considered; everyday tasks are easy to find and complete; every advertised action has a real outcome; and web/native quality is supported by evidence.

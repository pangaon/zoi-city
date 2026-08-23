# Consolidation plan — every surface, one verdict each

Audit date 2026-08-23, against `main` @ `2836d98`. Every claim below is from the
code, not from a page's own marketing copy. Where I could not verify something
from the repo (mostly "does this RPC exist on the server"), I say so.

The owner's read is correct: the site grew by accretion and there are duplicate
surfaces. But two of the three overlaps he named are not the overlaps they look
like, and the real duplication is somewhere he did not name. Details in §2.

---

## 1. Inventory

RPC counts are distinct named RPCs actually invoked by that surface. "Reachable
from" is inbound links found in the repo, not aspiration.

| Surface | What it really does | Real data or demo | RPCs used | Reachable from | Verdict |
|---|---|---|---|---|---|
| `/` (47KB) | Front door: live platform stats, nameday chip, WebGL globe, waitlist funnel, FAQ + schema.org | **Real.** No fabricated numbers. But 4 tiles sell shipped features as "Next / Get early access" | 4 — `home_stats`, `explore_geo`, `zoi_namedays_today`, `waitlist_join` | global nav, sitemap, PWA start_url | **KEEP** (copy fix) |
| `/explore` (47KB) | Canonical directory: live search, type/city filters, sort, in-page claim, fresh listings, category browse | **Real** | 7 — `explore_search`, `explore_cities`, `explore_fresh`, `dir_counts`, `home_stats`, `zoi_claim_entity`, `zoi_me` | global nav, home, sitemap, sw.js precache, manifest | **KEEP** — canonical |
| `/explore/app` (208KB) | Legacy directory SPA: bilingual EL/EN, in-page entity pages, follow, my-zoi, magazine, reviews, onboarding, admin claims | **Mixed/stale.** Banner at L2158 admits "demo data and simulated actions" | 27, most legacy (`dir_search`, `dir_browse`, `zoi_my_zoi`, `zoi_magazine`, `namedays_week_network`…) — existence unverified | **one link only**: `explore/index.html:241` | **RETIRE** |
| `/explore/map` (54KB) | MapLibre vector map of the directory, collapsible mobile sheet, category chips, `m-*` namespaced CSS | **Real** | 2 — `explore_geo`, `home_stats` | home, `/explore`, sitemap, manifest shortcut | **KEEP** — a view of `/explore` |
| `/community` (32KB) | Social feed: OTP sign-in, posts, place-tagging over the directory, likes, threaded comments | **Real** | 8 — `feed_list/post/like/delete/comment/comments_list`, `explore_search`, `zoi_namedays_today` | global nav, home, sitemap-absent | **KEEP** — canonical |
| `/social` (23KB shell + 10 modules, ~500KB) | Business suite shell: auth, workspace switch, module registry, 10 modules | **Real** | 4 shell + ~30 across modules | global nav (as "Business"), home ×8, `/apps/` | **KEEP** — canonical; **router needs rebuild** |
| ↳ `suite/composer.js` (106KB) | Multi-network composer: threads, media, first comment, hashtag sets, templates, UTM short links, liturgical prompts, best-time from real queue slots | **Real** | 11 | `/social` | KEEP |
| ↳ `suite/calendar.js` (97KB) | Content calendar + queue slots + liturgical overlay | **Real** | 6 | `/social` | KEEP |
| ↳ `suite/analytics.js` (62KB) | Cadence, longest silence, queue adherence, posting-time heatmap, post composition, liturgical coverage, ticket + community rollups. Engagement explicitly gated behind "connect your accounts" — renders **no** numbers it does not have | **Real** (7 RPCs via `safeRpc`, failures degrade to labelled empty) | 7 — `social_stats`, `social_list_posts`, `tickets_dashboard`, `tickets_event_stats`, `community_stats`, `home_stats`, `slot_list` | `/social` | KEEP |
| ↳ `suite/bio.js` (48KB) | Link-in-bio editor, publishes to `/b/:slug` | **Real** | 2 | `/social` | KEEP |
| ↳ `suite/email.js` (26KB) | Campaign composer, drafts, scheduling (send is credential-gated) | **Real** | 6 | `/social` | KEEP |
| ↳ `suite/audience.js` (28KB) | Contacts CRM, tags, namedays, CSV import | **Real** | 4 | `/social` | KEEP |
| ↳ `suite/bizpage.js` (42KB) | Business page editor → `zoi.listings` → `/p/:slug` | **Real**, but calls the *old* `bizpage_save` — cannot write `profile` | 2 | `/social` | KEEP + fix (see §4.1) |
| ↳ `suite/connect.js` (27KB) | OAuth account connection for 6 external networks; says "not yet available" honestly | **Real** | 2 | `/social` | KEEP + extend (§4.2) |
| ↳ `suite/settings.js`, `suite/ai.js` | Workspace rename, AI voice profile / presets | **Real** (AI generation credential-gated) | 4 | `/social` | KEEP |
| ↳ `suite/_vertical-forms.js` (14KB) | Per-vertical `profile` editor schema — the write side of the 26 verticals | **Real logic, zero users** | — | **NOTHING. Loaded by no page, referenced by no module.** | **WIRE IN** (§4.1) |
| `/tickets` (138KB + 3 libs, 90KB) | Organiser dashboard, public event page, reservations, door mode, local QR encode/decode, offline check-in queue, honest server-gated payment wall | **Real.** 11 RPCs; asserts its libs loaded; `tickets_reserve` rejects priced tiers server-side | 11 | global nav, home, `/apps/` | **KEEP** — canonical |
| `/apps/` (22KB) | Launcher hub. Honest: every prototype tile is labelled "Preview" and says where the live product is | **Real copy, no data** | 0 | footers of `/explore`, `/community`, `/tickets`, itself. **Not** in any primary nav; **not** linked from `/` | **MERGE** → `/labs` |
| `/apps/business-pro` (247KB) | 16-view operator dashboard concept: overview, calendar, composer, analytics, inbox, listening, audience, intake report, brand kit, templates, maker, library, approvals, plans | **100% demo.** Zero `fetch`, zero `rpc`, zero storage. 4 fabricated tenants, invented industry medians, invented engagement rates attributed to **real named parishes**, and a `Math.random()` best-time heatmap | **0** | `/apps/`, `social/index.html:246` | **RETIRE** |
| `/apps/event-os` (250KB) | Event operator cockpit: dashboard, 2D floor builder, 3D room, box office, event modes, guests, live ops, sponsors, event page, white-label settings | **1 real RPC, everything else demo** — and it *synthesises* sold/revenue from a hash of the event name (L862-869) | 1 — `ev_upcoming` | `/apps/`, `tickets/index.html:469` | **MERGE** → `/tickets` |
| `/apps/tickets-studio` (391KB) | Event page + cart, seat-map **renderer**, real three.js room, staff scanner, sales dashboard, create-event wizard, my-events, attendee messaging | **100% demo.** Zero network calls, zero persistence. 30 fake attendees with emails, `GROSS_REVENUE = 60475`. Has **no seat-map designer** — its own roadmap card lists "Draw your own room" as the *next unbuilt* run (L1200) | **0** | `/apps/`, `tickets/index.html:468` | **RETIRE** |
| `/apps/intelligence` (39KB) | SEO / GEO / AI-citation dashboard: ecosystem score, issue queue, scan results, JSON-LD + llms.txt generators | **100% sample.** It calls `seo_dashboard()` — which its own "what's new vs reused" panel (L409) lists under *to build*. Falls back to `SAMPLE` every load | 1 (non-existent) | `/apps/`, `social/index.html:247` | **RETIRE page, keep spec** |
| `/apps/command-center` (56KB) | Internal platform ops: directory explorer, review queue, source registry, ingestion pipeline, coverage/SEO drill-down, trend signals, leads/claims/reviews inbox | **Real RPCs if they exist** (unverified), behind a **placeholder** gate | 2 — `zoi_admin_dashboard`, `zoi_admin_inbox` | `/apps/` | **REBUILD** as `/admin` — see §5 risk 1 |
| `/b/:slug` (7KB) | Public link-in-bio page, output of `suite/bio.js` | **Real** | 1 — `bio_get` | `suite/bio.js`, shared links | **KEEP** |
| `/l/:slug` (2KB) | Short-link resolver, output of `composer.js` UTM tagging | **Real**, `noindex`, https-only redirect guard | 1 — `link_resolve` | `composer.js` | **KEEP** |
| `api/entity.js` (29KB) + `_verticals.js` (46KB) + `_orthocal.js` | Server-rendered listing pages across 12 URL shapes, 26 verticals, renderer-enforced compliance gates, computed Orthodox calendar | **Real** | 2 — `seo_entity`, `seo_related` | `vercel.json` × 14 rewrites, sitemap | **KEEP** |
| `api/place.js` (19KB) | Server-rendered country/region/city/category hubs — the link layer between the sitemap and 8,000 leaves | **Real** | 5 | `vercel.json` × 8 rewrites, sitemap | **KEEP** |
| `api/sitemap.js` (8KB) | `/sitemap.xml`: 3 static URLs + hubs + all listings | **Real** | 4 | `robots.txt` | **KEEP** + add `/community`, `/tickets` |

### Design-system compliance

`tests/unit/design-system.test.mjs` records 29 known class collisions. **23 of
the 29 are in surfaces this plan retires or rebuilds**: `apps/business-pro` 5,
`explore/app` 5, `apps/index` 5, `apps/event-os` 3, `apps/intelligence` 2,
`apps/tickets-studio` 2, `apps/command-center` 1. The 6 that remain are the ones
worth actually fixing — `tickets` 4, `community` 1, `social` 1. Retiring the
prototypes is the cheapest way to clear four-fifths of that baseline.

Palette compliance splits three ways:

- **Compliant:** `/`, `/explore`, `/community`, `/social`, `/tickets`, `/b`,
  `/l`, `/apps/` (no own vars at all), `/explore/map` (own vars, but correctly
  `m-*` namespaced).
- **Bridged** — declares its own names but aliases them onto shared tokens
  (`--ink:var(--bg)`): `apps/event-os`, `apps/tickets-studio`. Acceptable.
  Both still overwrite the *global* `--gold` at runtime for white-labelling,
  which leaks into the shared theme.
- **Off-system:** `apps/business-pro` — 630 lines of inline CSS, **350 raw
  six-digit hex literals** (`#0A4D8C` ×37, `#B8893B` ×35), a full parallel brand
  palette in JS. `apps/command-center` and `apps/intelligence` — entirely
  private palettes (`--panel`, `--ink-2`, `--surface-2`) with no bridge to
  `zoi-theme.css` at all. `explore/app` — its own `--marble1/--pig/--aeg` set.

---

## 2. The overlaps the owner named, settled

### 2.1 `/apps/intelligence` vs `suite/analytics.js` — **not the same job**

The names collide; the code does not. `suite/analytics.js` measures *the
workspace's own publishing behaviour* — cadence, longest silence, queue
adherence, posting-time heatmap, liturgical coverage — from 7 real RPCs, and
refuses to display engagement it cannot source. `/apps/intelligence` measures
*the directory's technical SEO* — JSON-LD validity, meta coverage, canonical
paths, AI-citation readiness — and is 100% sample data because its one RPC
(`seo_dashboard`) does not exist; the page's own audit panel lists it as
work-to-do.

So this is not a duplicate. It is a **spec wearing a dashboard's clothes**, and
its subject matter now overlaps something else entirely: the real SEO layer
shipped after it, in `api/entity.js` + `api/place.js` + `api/sitemap.js`. Those
*do* the work; nothing measures it.

**Verdict: retire the page. Keep the spec.** Move the 12-check list, the
reuse-vs-new inventory and the `llms.txt` shape into
`docs/seo-measurement.md` as the backlog item they are. Do **not** move a
"cohort chart" into analytics — there is nothing in Intelligence that belongs in
a publishing analytics module. When `seo_dashboard()` is built, its home is a
new suite module (`presence`), not `analytics`.

### 2.2 `/apps/command-center` vs `/apps/business-pro` vs `/social` — **not three of anything**

Three different audiences:

- **`/social`** is per-workspace, multi-tenant, authenticated, real. The product.
- **`/apps/business-pro`** is a *concept sketch* of the same audience. Zero
  network calls. It is not a third operator view; it is a mock of the first one.
- **`/apps/command-center`** is **internal staff tooling** — ingestion pipeline,
  source registry, human review queue, claim moderation, coverage drill-down.
  Nothing in `/social` does this and nothing should: it is cross-tenant.

**Verdict:** `business-pro` retires into `/social`. `command-center` is the only
one of the five prototypes with a job nothing else does — but it cannot stay
where it is (§5, risk 1). Rebuild it at `/admin`.

### 2.3 `/apps/event-os` vs `/apps/tickets-studio` vs `/tickets` — **yes, three, and the winner is clear**

`/tickets` is the real one, confirmed: 11 RPCs, three committed libraries
(`lib.js`, `qr.js`, `door.js`) with a startup assertion that they loaded, a local
QR encoder, an offline door-mode queue, and a payment gate that reads
`suite_config` and states in the UI that `tickets_reserve` rejects priced tiers
*server-side*. Its dashboard comment says "every number on screen comes from
`tickets_dashboard`". That is the honest one.

The surprise: **`tickets-studio` has no seat-map designer.** `renderVenueSvg`
(L5332) walks a read-only `VENUES` literal and emits SVG; the only interaction is
`selectMapZone`. No drag, no add, no delete, no persistence. Its own roadmap card
(L1200) lists "Run 15 — Draw your own room (venue builder)" as **next**, i.e.
unbuilt. It is a 6,000-line storyboard.

**The real designer is in `event-os`** (L1550–1810): marquee select, pan,
cursor-anchored zoom, keyboard nudge/delete/duplicate with toast-undo, snap grid,
align, `clampToVenue`, and four working geometry algorithms —
`autoTierByStage()` (sorts tables by Euclidean distance to the stage centroid,
cuts vip/prem/std at 25%/60%), `fillToCapacity()`, `autoSeatGuests()` (bin-packs
RSVP party sizes into table seat counts), `autoGridBooths()`. That is real code
with two clean coupling seams.

**Verdict:** `/tickets` wins. `event-os` merges into it (floor builder + event
modes + festival vendor-booth fields). `tickets-studio` retires, contributing
three narrow assets: `renderVenueSvg`, the three.js room, and the `VENUES` dual
`plan`+`s3` zone schema.

Neither prototype contains run-of-show, budget, or staffing — 0 grep hits. If
those were the reason to keep them, they are not there.

### 2.4 `/explore/app` vs `/explore` — **yes, and `/explore` wins on everything except one thing**

`/explore` is 47KB against 208KB, uses 7 current RPCs against 27 mostly-legacy
ones, is design-system compliant, and is the one in the sitemap, the service
worker precache and the PWA manifest. `/explore/app` additionally renders entity
pages *inside the SPA* — a job `api/entity.js` now does server-side across 12 URL
shapes with compliance gates, which is strictly better.

The one real regression: `/explore/app` has **239 bilingual EL/EN branches**;
`/explore` has **zero**. The rebuild dropped Greek-language UI entirely from the
directory. That is worth recovering, and it is the only thing in that file that
is.

**Verdict: RETIRE.** What is lost: the EL/EN toggle (salvage it), and
`zoi_my_zoi` / `zoi_magazine` / follow-place / in-page reviews — none of which
have a live home and several of whose RPCs are probably gone. One inbound link
(`explore/index.html:241`), which this plan removes.

### 2.5 The duplication nobody named: `/community` vs `suite/composer.js`

`connect.js` supports six external networks — facebook, instagram, linkedin,
tiktok, twitter/x, youtube — **all six credential-gated and inert**.
Meanwhile `/community` is a working feed with real posts. The composer cannot
post to it: zero references to `feed_post` or "community" anywhere in
`composer.js`.

So the flagship composer's entire publish path is switched off, while the one
channel that works today is not wired to it. This is the highest-value change in
the whole document and it is not a consolidation — it is a connection. See §4.2.

---

## 3. Recommended information architecture

The global nav is already right and already consistent — the same five links
appear in all 12 top-level pages, and every prototype's header correctly points
at `/social` and `/tickets`. **Do not change the nav.** Change what is under it.

```
Directory    /explore                  search, filters, claim
             /explore/map              the map view
             /in/…  /c/…               server-rendered place + category hubs
             /business|church|…/:slug  server-rendered listing pages

Community    /community                the feed

Business     /social                   the suite shell
             /social/composer          ← URL-addressable modules (new)
             /social/calendar
             /social/analytics
             /social/audience
             /social/email
             /social/bio               publishes → /b/:slug
             /social/page              publishes → /p/:slug   (+ vertical forms)
             /social/ai
             /social/accounts
             /social/settings
             /b/:slug   /l/:slug       public outputs

Tickets      /tickets                  organiser + public + door
             /tickets/floor            ← floor builder, merged from event-os

Marketplace  /#marketplace             → buygreek.shop (unbuilt, honestly labelled)

Internal     /admin                    ← rebuilt command-center, server-gated
Footer only  /labs                     ← whatever survives as a labelled preview
```

### Redirects

`vercel.json` today has **26 rewrites and zero redirects**. Every retirement
below needs a `redirects` block added — a rewrite would silently serve the wrong
page under the old URL, which is worse than a 404.

| From | To | Code |
|---|---|---|
| `/explore/app` and `/explore/app/*` | `/explore` | 301 |
| `/apps/business-pro/*` | `/social/analytics` | 301 |
| `/apps/intelligence/*` | `/social/page` | 301 |
| `/apps/tickets-studio/*` | `/tickets` | 301 |
| `/apps/event-os/*` | `/tickets` | 301 (→ `/tickets/floor` once it exists) |
| `/apps/command-center/*` | `/admin` | 302 while `/admin` is being built; 301 after |
| `/apps` and `/apps/` | `/labs` | 301 |

301 is right for the prototypes because they are `noindex` anyway (except
`tickets-studio` — see §5, risk 2) so there is no ranking to preserve, only
bookmarks and the links inside `/social` and `/tickets`.

`/social/:module` needs a rewrite to `/social/index.html`, and the shell needs to
read the path — that dependency is why §4.3 comes before the redirects that
target it.

---

## 4. Sequenced plan

Ordering rule: **things that add capability before things that remove surface**,
because every removal step needs somewhere honest to point.

### 4.1 Wire `_vertical-forms.js` into `bizpage.js` — *large, do first*

Not a consolidation, but it is the reason half the consolidation is worth doing,
and it is 90% built and shipping nothing.

`docs/verticals/README.md` names this the item that "gates everything":
> `bizpage_save` takes description/phone/hours/photo/social but no `profile`
> jsonb; `seo_entity` returns it but nothing sets it.

Since then, `supabase/migrations/0003_profile_writable.sql` added
`public.bizpage_save_profile`, and `assets/suite/_vertical-forms.js` (14KB, the
most recently modified file in the repo) implements the per-vertical form schema
with `_enrich` pre-fill and an explicit unconfirmed→owner-confirmed promotion.
It is **fully unit-tested** — `tests/unit/vertical-forms.test.mjs` contributes
several of the 183 passing tests ("enrichment pre-fills the form", "clean()
cannot store a rating", "the shared fields every vertical gets are actually
shared"). **And nothing loads it.** `bizpage.js:824` still calls the old
`bizpage_save`. Built, tested, green in CI, reachable by no user.

- `assets/suite/bizpage.js` — lazy-load `_vertical-forms` via the existing
  `loadLib` pattern (copy from `composer.js:113`), render `fieldsFor(vertical)`,
  switch the write to `bizpage_save_profile`.
- `social/index.html` — no change needed if `loadLib` is used.
- New test: assert every module referenced by a `loadLib` call exists on disk.
  That single test would have caught this orphan.

Depends on: nothing. Unblocks: all 26 verticals, and the enrichment chain having
a human confirmation step.

### 4.2 Add Zoi Community as a composer channel — *medium*

- `assets/suite/connect.js` — add a `zoi` channel that is always available (no
  OAuth, it is our own feed).
- `assets/suite/composer.js` — allow it as a publish target, calling `feed_post`.
- Server side: needs `feed_post` to accept a workspace attribution, or a new
  `feed_post_as_workspace`. **This is the one step in the plan that needs a
  migration I have not verified is possible** — `feed_post` today posts as a
  profile, not a workspace.

Depends on: a DB decision. Unblocks: the composer having a real publish path
before any OAuth credential lands, and `analytics.js` having real engagement to
show (likes and comments on our own feed are data we own).

### 4.3 Make `/social` modules URL-addressable — *medium, blocks all redirects*

Today the active module lives in `localStorage['zoi_suite_tab']`
(`social/index.html:295`). There is no URL for a module, so
`/apps/intelligence → /social?m=analytics` **cannot currently work** — the
query string is ignored.

- `social/index.html` — `selectModule()` writes `history.replaceState` to
  `/social/<id>`; boot reads `location.pathname` first, falls back to
  `localStorage`, then to the first module.
- `vercel.json` — rewrite `/social/:module` → `/social/index.html`.
- `tests/unit/routing.test.mjs` — assert every registered module id has a
  resolvable path.

Depends on: nothing. **Blocks:** 4.5, 4.6, 4.7.

### 4.4 Fix the homepage's four dishonest tiles — *small*

`index.html:341/348/355` sell **Business Page**, **Email** and **AI Studio** as
"Next · Get early access" behind a waitlist. All three are shipped modules
(`bizpage.js`, `email.js`, `ai.js`). The site is collecting waitlist signups for
features a visitor could use in the next click.

- `index.html` — repoint those three to `/social/page`, `/social/email`,
  `/social/ai`, status chip "Live". Leave tile 03 (Storefront) on the waitlist;
  BuyGreek genuinely is not built.
- Also add `/community` and `/tickets` to `api/sitemap.js` — neither is in the
  sitemap today.

Depends on: 4.3 for the deep links. Independent otherwise.

### 4.5 Retire `/explore/app` — *small*

- Delete `explore/app/index.html` (208KB).
- `explore/index.html:241` — delete the "Open the classic directory" hint.
- `explore/index.html:485` — delete "or the classic directory has deeper
  filters" from the empty state.
- `vercel.json` — add the 301.
- `tests/pages/run.mjs` — remove the `/explore/app/` entry (it asserts `noindex`
  and `Classic prototype`, both of which vanish).
- `tests/unit/design-system.test.mjs` — remove the 5 `explore/app` entries from
  `KNOWN`. The second test in that file *fails* on stale baseline entries, so
  this is mandatory, not optional.
- `REPO-STRUCTURE.md` — Phase 3 is now done; update it.

Follow-up, separately sized: port the EL/EN toggle from `explore/app` into
`/explore`. That is a real localisation job (239 branches), not part of the
retirement.

### 4.6 Retire `business-pro`, `intelligence`, `tickets-studio` — *small each, plus salvage*

Delete the three files (678KB — 43% of all HTML in the repo). Then:

- `social/index.html:246-247` — delete both `.advlink` entries.
- `tickets/index.html:467-472` — delete the `.tk-advanced` block (or repoint it
  at `/tickets/floor` after 4.7).
- `apps/index.html` — remove the three tiles.
- `vercel.json` — 301s.
- `tests/unit/design-system.test.mjs` — remove 9 `KNOWN` entries.

**Salvage before deleting** (each is its own follow-up ticket, sized separately):

| From | What | Where it lands | Why |
|---|---|---|---|
| business-pro L2394-2551 | Intake report: 8-section generated audit, `gradeFor()` letter grade from ER-vs-median ratio, prioritised opportunities, `starterPlan(dow)` → draft posts | new `suite/intake.js` | Nothing in the repo does this. **But it only becomes honest once a provider OAuth lands** — every input today is invented. Build it *after* 4.2 gives it real feed engagement. |
| business-pro L2494-2501 | Benchmark-vs-median bar: self-scaling filled bar with a median tick overlaid | `suite/analytics.js` | Genuinely good reusable dataviz primitive. Needs a *sourced* median — do not ship the invented `benchER` numbers. |
| business-pro L789-882 | `TYPEKIT` per-vertical config schema (cadence, pillars, formats, CTA, audience tag) | merge into `_vertical-forms.js` `VERTICALS` | The **schema** is the asset; the numbers are fabricated. |
| business-pro L1266-1313 | Workspace switcher with live re-theming (`applyWorkspace` recomputes CSS vars + mesh gradients) | `social/index.html` | This is the white-label / re-skinnable wedge the product strategy needs. **Scope the vars** — it writes global `--gold`. |
| intelligence L409 | The 12-check scan list, reuse-vs-new inventory, `llms.txt` shape | `docs/seo-measurement.md` | It is a backlog spec. Write it down, delete the fake dashboard. |
| tickets-studio L5332 / L4011 / L4846 | `renderVenueSvg`, the three.js room + orbit/raycast picking, the `VENUES` dual `plan`+`s3` zone schema | with 4.7 | Renderer closes over three module globals (`SECTIONS`, `TYPE_COLOR`, `selectedZoneId`) and reads `sec.total - sec.taken` — swapping `SECTIONS` for `tickets_types_list` rows is bounded but real work. |

**Do not salvage:** business-pro's composer "predictive score" (L1748) — an
additive heuristic with invented weights, presented as a number. That is a
fabricated metric, and `composer.js` already ships the honest version of the same
idea as a checklist. Also do not salvage its `FEASTS` table (L1180): four
hardcoded Greek strings keyed by day-of-month **for June 2026 only**, when the
repo already ships a computed Julian-Paschalion calendar in
`assets/suite/_orthocal.js`.

### 4.7 Merge `event-os` into `/tickets`, then retire it — *large*

New `/tickets/floor` (or a `suite`-style module under `/tickets`), carrying:

- The floor editor, `apps/event-os/index.html` L1550-1810 — marquee/pan/zoom,
  keyboard ops, snap grid, align, duplicate-with-undo.
- The layout algorithms, L1731-1793 — `autoTierByStage`, `fillToCapacity`,
  `autoSeatGuests`, `autoGridBooths`, `parishSections`.
- `MODECFG`, L703-750 — one declarative object that reconfigures fields, quick
  actions and palette per event type (`concert|banquet|gala|festival|church`).
  Pure data, zero demo coupling, directly liftable. This is the best single idea
  in either prototype.
- `ELTYPES` (L681) and `TTIERS` (L701) element specs.
- Festival vendor-booth fields (L734: `vendor / fee / power / water`) — the one
  management surface `/tickets` genuinely lacks.
- `renderVenueSvg` + the three.js room from tickets-studio for the read-only
  patron-facing view.

Two coupling seams to cut: `fillToCapacity` reads `curEvent.cap`,
`autoSeatGuests` reads the module-global `guests`. Both parameterise trivially.

Then: **backend work this needs** — a venue/zone table and a
`tickets_layout_save/load` RPC pair. Without persistence this is a toy again.
`docs/verticals/README.md` already lists a venue vertical with `spaces[]` and
per-layout capacity; the zone schema should be one thing, not two.

Do **not** carry over: `applyBrand()` (L783) overwrites global `--gold`;
`realToEvent()` (L858-869) synthesises sold/revenue from a hash of the event
name — that is exactly the fabrication the project rule forbids, and it must not
travel with the code.

Depends on: 4.6's salvage. Blocks: the `event-os` 301 becoming `/tickets/floor`.

### 4.8 Rebuild `command-center` as `/admin` — *large, but see §5 risk 1*

The **security fix is urgent and independent of the rebuild** — do it in 4.0,
before everything else. The rebuild proper:

- Server-side gate: `/admin` renders nothing until an authenticated
  `zoi.current_profile` with a staff role is proven. Admin RPCs must check the
  role themselves, not trust the page.
- Port the six sections (directory explorer, review queue, source registry,
  ingestion pipeline, coverage/SEO, leads/claims/reviews).
- Drop the `window.cowork.callMcpTool` path entirely — that is dev-environment
  scaffolding that has no business in a deployed page.
- Rebuild on `zoi-theme.css` tokens; its current palette is fully private.
- This is the natural home for the **Intelligence** spec once
  `seo_dashboard()` exists — coverage measurement is platform ops, not a
  tenant feature.

### 4.9 `/apps/` → `/labs` — *small, last*

Once only `command-center` is left and it has moved to `/admin`, `/apps/` has
nothing to launch that the global nav does not already reach. Either:

- **Preferred:** delete it, 301 `/apps → /` , and remove "Advanced tools" from
  the four footers that link it (`explore`, `community`, `tickets`, `apps`).
- Or keep it as `/labs` if there will be a next prototype. If so, make `/labs`
  the *only* place a prototype may be linked from — no more `.advlink` in the
  suite sidebar, no more `.tk-advanced` row in `/tickets`. One door.

---

## 5. Risks, and what I am not sure about

### Risk 1 — `command-center`'s gate is a placeholder, and it calls admin RPCs with the public key. Treat as P0.

`apps/command-center/index.html:300`:
```js
const GATE_HASH="a20405ad…"; // PLACEHOLDER = SHA-256 of "change me before launch" — replace
```
The passphrase is documented in the source. Worse, the gate is client-side
(`assertUnlocked()` throws in JS) while the fetch at L327 sends the **anon**
publishable key to `zoi_admin_dashboard` — so the gate protects nothing a `curl`
cannot skip. The page's own comment claims "The gate is enforced in the data
layer (assertUnlocked) — no admin RPC can run"; that is not what the code does.

I **could not verify from this repo** whether `zoi_admin_dashboard` and
`zoi_admin_inbox` are themselves role-gated server-side. If they are, the
exposure is cosmetic. If they are not, the platform ops dashboard —
claims, leads, reviews, source registry — is world-readable.

**Action before anything else in this plan:** run
`curl -s -X POST $BASE/rest/v1/rpc/zoi_admin_dashboard -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -d '{}'`
with the publishable key. If that returns data, take `/apps/command-center/`
offline the same day and audit the RPC grants. This is a five-minute check and it
gates the rest.

### Risk 2 — `apps/tickets-studio` is missing its `noindex`

Every other prototype carries
`<meta name="robots" content="noindex,nofollow">` with the comment "OPERATOR
TOOL: never public". `apps/tickets-studio/index.html` — 391KB, 30 fake attendees
with plausible email addresses, `GROSS_REVENUE = 60475`, a fake verified
organiser badge — **has no robots meta at all**, and `robots.txt` is
`Allow: /` for everyone including GPTBot, ClaudeBot and PerplexityBot. Fabricated
Greek event data is available for indexing and citation right now. `apps/index.html`
also has no `noindex`, and it links there.

It is not in `sitemap.xml`, which limits discovery, but that is luck not design.
Add the meta today, independent of the retirement.

### Risk 3 — `explore/app` can un-quarantine itself

`STATUS-TRUTH.md` describes `/explore/app` as hard `noindex`. It is not.
`explore/app/index.html:988` calls `site_indexable()` and, if that RPC returns
true, rewrites the robots meta to `index,follow`. Fail-closed on error, so the
current risk is low — but a flag flip anywhere could publish a 208KB page whose
own banner says it uses "demo data and simulated actions". The retirement in 4.5
closes this; until then, know that the guarantee in the docs is weaker than the
docs say.

### Risk 4 — the network test suites are already stale and will not tell you

`tests/pages/run.mjs` and `tests/contract/run.mjs` are named `run.mjs`, and
`scripts/run-tests.mjs` only collects `*.test.mjs`. **Neither runs in `npm test`
or in CI.** Three of `tests/pages/run.mjs`'s assertions are already false against
this working tree:

- `/social` must contain `function switchWorkspace` → **0 occurrences** in
  `social/index.html`.
- `/tickets` must contain `'online payment is being enabled'` → **0
  occurrences** (the tickets rebuild changed the copy).
- `/explore/app/` must contain `'Classic prototype'` → true today, false after 4.5.

They pass only because they hit production, which is behind the working tree.
Either wire them into CI against a preview deployment and fix the assertions, or
delete them — a test that cannot fail is worse than no test.

### Risk 5 — what actually breaks

- **`/social` sidebar and `/tickets` advanced row** are the only in-product links
  to prototypes. Both are edited in 4.6. Miss either and you ship a 301 loop
  into a redirect from inside the app.
- **`sw.js` precaches `/` and `/explore`** only, so no retirement invalidates the
  service worker. But a returning PWA user with a cached `/apps/` page will keep
  seeing it (network-first with cache fallback, so only when offline). Bumping
  `V = 'zoi-v1'` on the retirement commit clears it.
- **`design-system.test.mjs` fails loudly if `KNOWN` is not pruned** — by design
  ("otherwise the list rots into a permanent excuse"). Every deletion step must
  edit that list in the same commit.
- **`vercel.json` gains its first `redirects` key.** `routing.test.mjs` validates
  `rewrites` only; extend it to validate `redirects` in the same shape, and
  preview-deploy before merging, per `DEPLOY.md`.

### What I could not verify

- **Whether `zoi_admin_dashboard`, `zoi_admin_inbox`, `ev_upcoming`,
  `social_stats` and `site_indexable` exist and how they are gated.** Only 11 of
  the ~90 RPCs the frontend calls have SQL in `supabase/migrations/` (0001–0011);
  the other 120 migrations are still not repo-committed, which `DEPLOY.md`
  already flags as an open Wave-1 gap. Every "unverified" in the inventory traces
  back to that one gap. Closing it (`supabase db pull`) would make an audit like
  this checkable instead of inferential.
- **Whether `feed_post` can attribute a post to a workspace** — 4.2's blocker.
- **Whether the recorded design-system collisions actually change rendering.**
  The test file says as much: a grouped selector looks like a collision to static
  analysis without being one. Needs a browser, not a grep.

### Greek-hardcoding in platform layers

The re-skinnable goal holds up better than expected. `zoi-core.js`,
`zoi-theme.js`, `zoi-search.js` and `api/place.js`/`api/sitemap.js` are
culture-neutral apart from display strings. `api/_verticals.js` keeps its
Orthodox logic in one function (`liturgicalBlock`) over a separate calendar
module — the right shape.

The offenders are concentrated in the surfaces this plan retires, so the
consolidation fixes most of it for free. The one that matters after that:
`suite/composer.js` has 33 Greek-specific references (nameday prompts, Greek
hashtag groups, liturgical greeting logic). Those are *content*, and they should
live in a locale pack the composer loads — the same way it already lazy-loads
`_orthocal.js` — rather than inline constants. Worth a ticket; not urgent.

---

## Do these three first

1. **Curl `zoi_admin_dashboard` with the publishable key** (Risk 1). Five
   minutes. Everything else waits on the answer.
2. **Add `noindex` to `apps/tickets-studio/index.html` and `apps/index.html`**
   (Risk 2). One line each.
3. **Wire `_vertical-forms.js` into `bizpage.js`** (§4.1). The largest piece of
   finished, shipping-nothing work in the repo, and the thing
   `docs/verticals/README.md` says gates all 26 verticals.

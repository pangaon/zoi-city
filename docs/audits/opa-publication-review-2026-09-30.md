# OPA Productions and Montréal concert — live acceptance

**Current state (2026-09-30 19:42 UTC, release bb17cad): both normal public routes are live. Exact search, cards, Quick look, canonical pages, official artwork, floor-plan viewing and private enquiry journey passed production checks at 390/1440. Poster cropping in cards/Quick look and substring-first search ranking are corrected. Ticket inventory, reservations and payments are not configured.**

See the final dated recheck below for URLs, evidence and remaining operational gaps. Earlier sections document the reviewed pre-release state; their rollback/uncommitted statements are historical.

## Historical source and publication proposal

Official homepage, about page, contact page and Montréal event page were freshly retrieved September 30, 2026. The event poster was visually inspected again: March 26, 2027, Palace Convention Centre, Montréal, telephone 514-969-7375. Official page text/title/URL retain 2026; this conflict is explicitly retained. No time, price, stock or checkout is inferred. Company office location is unknown and left null; event venue is Laval at the published address. No map coordinates are invented.

Identity search covered normalized promoter name, official website/source domain, email, telephone and target slugs. No existing identity found. Guarded proposal repeats these checks inside an advisory-locked transaction and fails rather than overwriting existing data. Two deterministic IDs identify the new promoter and concert. Both are unclaimed and unverified; source inspection does not create an owner or verification badge.

Three authentic official image assets are retained locally with byte hashes, dimensions and exact source URLs in `assets/events/opa/source-assets.json`. Official HTTP works; its HTTPS hostname certificate fails. No certificate validation was bypassed. The concert poster is announcement artwork, not a venue photograph. The floor plan remains a published reference, not live inventory. No Toronto couches, prices or layout are imported.

Production rollback validation passed for both rows: published status, exact public canonical projection, no owners, no coordinates, bookable false. The proposal ended ROLLBACK and has not committed anything. Root owns reviewed commit and deployment. Shared generic promoter renderer is being implemented by root; these source facts alone do not establish rendered or journey acceptance.

Expected routes:
- `/business/opa-productions`
- `/event/giannis-ploutarchos-andromache-montreal-2027`

Source evidence:
- http://www.opaproductions.com/
- http://www.opaproductions.com/about.php
- http://www.opaproductions.com/contactus.php
- http://www.opaproductions.com/plut-andro-2026-montreal-floor-plan.html

Required post-release checks: actual poster and logo load, source notice visible, event link resolves, date/venue correct, organizer telephone/email actions correct, mobile card and request journey usable. No online payment or reservation completion may be claimed.

## Local rendered and exercised evidence

Local canonical-renderer fixtures at `.qa-opa/promoter.html` and `.qa-opa/event.html` were checked at 390 and 1440 pixels. Both have no horizontal overflow or uncaught page errors. Actual local official asset bytes were routed into the fixture; this is not a production asset check. Promoter logo/poster load; canonical concert and organizer links, telephone, email and official HTTP links are correct. Event date conflict is visible.

The concert card was clicked through its normal `/event/giannis-ploutarchos-andromache-montreal-2027` URL with a local fixture response. Floor-plan dialog loaded the complete 1548×903 source image; Escape closed it and restored focus to its button. A three-person enquiry retained the date, venue and entered question and explicitly said prepared, not sent. No message or payment was sent. Root corrected poster hero fit after QA found source artwork cropped; poster-specific rounded-corner clipping was additionally reported for final correction. Browser closed after checks.

## Production acceptance and image projection correction

After root published the two records, actual www.zoi.city promoter/event pages passed 390/1440 checks: no overflow or page errors; correct official artwork, contacts, source conflict, floorplan dialog and private enquiry journey. Exact Explore search “OPA Productions” returns both records. Broad “OPA” search ranks substring matches before the new promoter; this was a shared ranking issue; bb17cad now ranks name relevance before pagination as verified below.

Explore originally lacked event artwork because both new records had profile.hero_url but null top-level photo_url. Root authorized the exact guarded correction in `ops/opa-public-photo-projection-proposal.sql`. ROLLBACK validation passed, then the reviewed transaction was committed. Separate persistent SELECT at 2026-09-30 19:11:15 UTC confirmed both public photo URLs match the existing reviewed poster; both remain unclaimed with null owners. No other field was intentionally changed. Actual Explore and Quick look now load artwork, and Open full page reaches the canonical OPA profile. Quick-look media currently crops the poster into its standard cover shape; full-page artwork remains fully visible. This was a shared presentation issue, not a missing asset; corrected in bb17cad as verified below.

## Independent live recheck — 2026-09-30 19:42 UTC

Both normal routes are live:
- https://www.zoi.city/business/opa-productions
- https://www.zoi.city/event/giannis-ploutarchos-andromache-montreal-2027

Fresh source retrieval returned HTTP 200 for the official logo, poster and floor plan; SHA-256 hashes still exactly match the retained originals. Fresh database/public projection read confirms the same two IDs, published/unclaimed status, no assigned owner, no invented coordinates, and `bookable=false`. Event date is 2027-03-26 and venue Palace Convention Centre, Laval; source-date conflict remains visible.

After release bb17cad, actual production search at 390/1440 places exact “OPA Productions” first, then its concert. Both card images and Quick look use contain and load the full poster. Mobile dialog width is 364px in a 390px viewport; desktop is 638px. Escape closes it, Open full page resolves correctly, and no page errors occurred. Explicit business/Canada filters remained active. Broad OPA search now prioritizes legitimate OPA prefixes over KOPA/Europa substring matches; many legitimate OPA brands still require a refined query.

The live mobile promoter concert link was exercised again through the normal event URL. Floor-plan dialog decoded the actual 1548×903 image; Escape restored focus. A three-person enquiry preserved the correct date, venue and user question and remained explicitly prepared, not sent. No outbound email/SMS or transaction was attempted. Browser closed.

Remaining material gaps: this is a published organizer home and concert announcement/contact journey, not an operational ticket sale. No owner has claimed/configured this event, no approved ticket prices or table inventory exist, and no reservation/payment is offered. Seating remains the official image reference rather than a selectable reconstructed room. The source 2026/2027 disagreement must be resolved before sales activation. Gallery thumbnail crops are decorative previews; full artwork is available in the enlarged viewer. Official source HTTP is retained rather than rewriting to a failing HTTPS hostname.

Evidence: `.qa-opa/production-results.json`, `.qa-opa/released-search.json`, `.qa-opa/latest-live-journey.json`; screenshots `/tmp/opa-live-{promoter,event}-{390,1440}.png` and `/tmp/opa-released-quicklook-{390,1440}.png`.

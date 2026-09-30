# OPA Productions and Montréal concert publication candidate

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

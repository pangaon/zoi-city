# OPA official tour hub — primary-source review

Reviewed30September2026. Read-only source research; no bookings, messages or data writes.

## Confirmed itinerary

Official OPA PRODUCTIONS Facebook page https://www.facebook.com/OPAPRODUCTIONS displayed a public tour post (relative timestamp “4 days ago”) linking reel https://www.facebook.com/reel/1072742392332973/. Its19-second video was loaded logged-out; the frame at15seconds was visually inspected. It explicitly says USA CANADA TOUR / MARCH2027 with Giannis Ploutarchos and Andromache, and lists:

| Date2027 | City |
|---|---|
| March5 | San Francisco |
| March6 | Los Angeles |
| March12 | Detroit |
| March13 | Chicago |
| March19 | Boston |
| March20 | Toronto |
| March26 | Montreal |
| March27 | Atlantic City |

Evidence: `/workspaces/zoi-city/.recovery/logs/opa-reel-frame15.png`. The visible official post points to OpaProductions.com and514-969-7375. A visitor's Atlantic City pricing question is not organiser evidence and was not used as a price/booking source. No tour-specific external booking links were present in the visible post.

## Official hub and conflict

http://www.opaproductions.com returns200. Its homepage links the current tour poster directly:
http://www.opaproductions.com/images/events/Plout2027_Final_Announce-2.jpg

Visually reviewed unchanged local copy `/workspaces/zoi-city/.recovery/logs/opa-2027-tour.jpg`: March2027 NorthAmericanTour announcement, full details coming soon; it does not itself list eight cities/dates.

The tour's “More information” link is http://www.opaproductions.com/plut-andro-2026-montreal-floor-plan.html. It visibly prints “Friday, March26th,2026 Palace Convention Centre”, despite the linked homepage poster and official reel announcing2027. Calendar check: March26,2026 isThursday, March26,2027 isFriday. This strongly suggests a stale textual year but must remain recorded as a source conflict rather than silently rewritten. Root separately verified Montreal floorplan/poster2027 evidence.

Page venue/address: Palace Convention Centre,1717leCorbusierBlvd,LavalQC H7S2K7. Its booking path is contact: `tel:5149697375` and `mailto:info@opaproductions.com`. No online checkout or ticket inventory appeared in fetched public HTML. Floorplan source:
http://www.opaproductions.com/images/events/Fl.Plan_MTL_Ploutarchos-Andromachi_NP_V1-929.jpg

Homepage also links `dalara2026.html` and `past-shows.php`; these were not treated as Ploutarchos2027 tour stops. Official social links include https://www.instagram.com/opa_productions/ and historicFacebookpage169870222951.

## Transport/access boundaries

HTTPS www.opaproductions.com fails hostname certificate validation in curl; the web reader returned502. HTTP succeeded without certificate bypass. Never accept payments/contact forms over this legacy HTTP path or claim its checkout is secure. This is a source-link issue, not permission to weaken TLS checks. Facebook web-reader throttled; normal logged-out browser displayed the official page after dismissing login prompt. Browser stayed logged-out. Search engine returned irrelevant matches; none were used.

Raw public HTML evidence: `.recovery/logs/opa-official-home.html`, `opa-montreal-current.html`. Browser closed after review. No venue, seatingprice, availability or checkout for the six otherUS stops is inferred from this itinerary alone; separate city evidence belongs to their specialists.

# Bounded production route availability — 2026-09-30

20 meaningful routes, maximum3 simultaneous requests, anonymous GET only. No customer mutations. This checks document availability/redirects and response timing, not JavaScript API journeys, source completeness, checkout, authentication or every listing.

Checked 2026-09-30T10:34:22.644Z. 19 final responses were 200; /categories/ returned 404. No 500 responses or timeouts. Timings 10–521ms including followed redirects. These are one sample, not latency guarantees.

|Route|Final status|Duration ms|Redirects|
|---|---|---|---|
|/|200|228|none|
|/explore?type=travel_place|200|165|none|
|/explore/map/|200|171|none|
|/community/|200|45|none|
|/apps/intelligence/|200|40|none|
|/shop/|200|62|none|
|/categories/|404|10|none|
|/c/restaurants|200|371|308 → https://www.zoi.city/categories/restaurants|
|/church/saint-sophia-greek-orthodox-cathedral-washington-dc|200|291|none|
|/artist/giorgos-dalaras-athens-a558f2|200|117|none|
|/artist/thanos-petrelis-athens-78ee3f|200|521|none|
|/creator/peter-kypri-cypriot-smurf-london|200|83|none|
|/business/signatureproductions-6aa61d|200|86|none|
|/venue/parkview-manor-banquet-hall-north-york|200|170|none|
|/professional/ageliki-tzakis|200|83|none|
|/organization/canadian-hellenic-medical-society|200|167|none|
|/business/12-islands-greek-taverna-stirling|200|187|none|
|/business/fournos-bakery-johannesburg|200|76|none|
|/book/?listing=b3c30c82-5b2e-4731-bc07-83e076f4b0a1|200|39|none|
|/social/|200|44|none|

Sanitized evidence with actual canonical metadata/final URLs: .recovery/logs/public-route20-final.json. The /categories/ landing route is missing; individual category routes work. This needs routing review before calling the sample fully passing. The next10:45UTC cron result remains a separate pending check.

Routing review: no categories index directory or bare-hub rewrite exists; the configured category pages require a category slug. A targeted literal-link scan found no navigation href to the bare hub. Existing `/c/:path*` redirect can reach it for an empty suffix. Recommend exact bare `/categories` and `/categories/` redirects to the existing `/explore/` category browser, preserving all specific category routes. Root owns the routing change.

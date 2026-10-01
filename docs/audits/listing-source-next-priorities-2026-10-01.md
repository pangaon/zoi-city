# Next shared listing source priorities

Scope references: recovery-scope.json category-wide enrichment, owner tools and public journey continuity; recovery-delivery-board.json listings lane. This audit does not replace Greek artist/tour sourcing, individual source verification, map recovery or other open work.

## P1: Curated event/venue identities lose family experience after owner website change
Retained source identities: SIGNATURE and PARKVIEW in assets/homes/templates/events/data.mjs. Controlled post-save entity.website and owner_content.website agree on a new HTTPS destination. eventHomeContent returns null for these exact IDs, although identical sparse promoter/venue records return generic event-family content. Explicit curated-ID exclusion in api/_event-home.js prevents safe fallback.

Actual api/entity.js browser harness, tests/browser/listing-source-next-audit/events.mjs, runs390/1440 × two families × populated/sparse (8cases). API home_entity is intercepted in Node; external browser calls/destinations are controlled. Populated records have zero #event-home roots; sparse records retain one. Actual outbound links still work in all8 cases. Therefore the defect is loss of family-specific guest tools/design and preview support, NOT a blank page or broken outbound URL. Public handler falls back to its legacy generic listing. home-preview.js would instead return409 home_preview_not_supported if no other family renderer accepts.

Node source/render reproduction additionally confirms explicit clear and HTTP newsite trigger the same exact-ID exclusion. Evidence /tmp/listing-source-events-audit/report.json; screenshots retained in that directory. No actual customer website was changed.

Proposed ownership: api/_event-home.js and focused unit/browser tests. Match curated source against resolved explicit owner website; preserve strong source identity checks; use genericEventData after source change/clear, without old curated photos, contacts, event claims or room data. Known promoter identity can supply family eligibility only when owner has not explicitly changed business_type. Root retains API/dependency cache versions.

## P2: Church navigation drops legitimate HTTP websites
Actual church renderer and local client at390/1440 × populated/sparse × HTTP/HTTPS:8 controlled cases. HTTPS destinations render and click through; HTTP destinations are absent in both populated and sparse cases. Source fixture identity PARISH in church/data.mjs with explicit controlled post-save newwebsite. Evidence /tmp/listing-source-next-audit/report.json and tests/browser/listing-source-next-audit/verify.mjs. Adapter uses httpsUrl for navigation and parishContent revalidates all links as HTTPS. Media and payment/embed URLs must remain separately validated if navigation repair proceeds.

Church top-level owner.website overlay is not applied before source matching outside the quarantine branch; this is source-inspection evidence, not yet a separate exercised journey. Do not label that subcase accepted until reproduced.

## Boundaries
No production DB probes/writes/deployments. These are deterministic projection/renderer regressions, not claims of currently changed live Signature/Parkview/Parish websites. All broader individual source and Greek artist backlog remains open.

## P1 implementation candidate
api/_event-home.js now matches retained curated sources against resolved owner website, then falls back to generic family content after mismatch/clear. Explicit owner business_type change/clear suppresses curated Signature eligibility; a known Signature ID only supplies missing promoter family context. No curated source constants are copied into generic fallback.

12 relevant unit tests pass, including overlay-only and actual post-save changes/clears, untouched curated positives, unrelated business-type changes and sparse/hidden records.16 browser cases through the actual api/entity.js handler pass at390/1440, populated/sparse Signature/Parkview, newHTTPSwebsite/clear. Every case retains event-home; positive external links click to controlled destination, clears omit them. Promoter cases exercise inquiry availability with a controlled disabled response; venue cases prepare a private enquiry and verify note contents. No inquiry is sent. Evidence /tmp/listing-source-events-audit/report.json. Initial harness attempted a venue form on promoter pages; corrected fixture to exercise the actual family-specific action rather than inventing a shared form.

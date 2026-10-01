# Independent event and venue owner-source fallback review

Accepted bounded candidate 2026-10-01. api/_event-home.js SHA256 `147462c310d47a28781d76836aef507c350b6d8e042cdbc6a71c35b7da3231f9`.

Source review confirms curated identity requires exact retained ID, family and resolved owner-aware website source. Owner website replacement/clear no longer excludes known Signature or Parkview IDs from generic family rendering. Explicit owner business_type override, including clear or unrelated type, takes precedence over inferred Signature promoter eligibility. Generic fallback uses current entity fields; it does not copy curated contacts, imagery, shows or floor plans. Existing visibility/moderation gates remain.

Independently ran 12 relevant units successfully (event-owner-source-fallback, event-generic-home, event-home-templates); /tmp/event-source-units-independent.log. Overlay-only and post-save website changes/clears, retained curated positives, unrelated business type and sparse/hidden cases are covered.

Independently ran 16 controlled browser journeys through actual api/entity.js at 390/1440: populated/sparse promoter/venue × website replacement/clear. /tmp/event-source-independent/report.json and /tmp/event-source-browser-independent.log. Every case retains #event-home; positive external destinations are actually clicked through context-intercepted popups; clears omit the link. Promoter inquiry checks correctly report controlled disabled availability; venue requests prepare a private note containing entered details. All overflow checks false. Inspected phone Parkview prepared-note screenshot: readable form and explicit prepared-not-sent notice; footer links wrap onto another line without horizontal overflow.

Node home_entity and browser provider transports are controlled. This is not a production owner edit, live inquiry, booking or full event category acceptance. Original defect was fallback to the legacy listing, not a blank page. The correction preserves family tools after website changes while avoiding stale curated source claims. P2 church navigation remains a separate candidate.

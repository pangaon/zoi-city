# Signature concert startup

Production read-only browser recording reproduced the flash on the actual destination:
`/events/giannis-ploutarchos-andromache-toronto-2027/`.
There was **no redirect**. Initial HTML displayed “Opening your night…” and the
private-save panel; the actual event hero was inserted only after the module graph
loaded. In this browser sample, DOMContentLoaded was361ms and the poster request
started360ms. Lounge/concert styles were requested after their DOM was inserted.
These observations identify real staging/layout changes, not an extra route.

The candidate emits the real shared customer shell into static HTML, including
poster, heading and event facts. Client mount reuses that shell and initializes
interactive planning without replacing the hero. Poster dimensions1205×1478 and
an early image preload are explicit; both room styles are available in the head.
No fake progress, delay, inventory or reservation is added. Published per-guest
pricing replaces an unsupported universal standard-table-capacity claim.

Evidence: `.recovery/logs/signature-start-before.webm`, `signature-start-after.webm`
and `signature-start-after-390.png`. Local390 browser: one hero, one poster,
no horizontal overflow, no duplicate scene styles. Local resource timings are not
claimed comparable to production network performance. Independent mobile acceptance
is supplied by QA separately. Tests:18 passed across startup, bridge, private-plan
and planning suites. No customer writes were made.

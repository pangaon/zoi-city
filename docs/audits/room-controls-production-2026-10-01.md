# Paired room phone controls release — 2026-10-01

CI36858402919 succeeded. Commit f873fb336ad173cd7b6f3eaf57af12f6d98d80b2 deployed through Vercel9yDnP7e1LvQcrtbYj8thReuqdR8J. Three served stylesheets match reviewed bytes, including existing renderer stylesheet URLs and new shared import query. Evidence /tmp/room-controls-production-bytes.json. Static responses require revalidation; renderer JS/geometry were unchanged.

Isolated staged tree e0d92025603e9aea779dc55597abf7d2f48cc2d3 passed full local verification:273 node:test files and two standalone suites plus HTML/inline checks, /tmp/room-controls-staged-check.log. Lead independently exercised four390/1440 actual-renderer journeys, inspected both phone fullscreen screenshots, and confirmed visible44px hit-testable controls after fullscreen focus. /tmp/paired-room-controls-root holds captures/results.

This is scoped toolbar acceptance. It does not claim all visual requirements are resolved: label-to-footprint association remains under investigation, and Montreal canonical event page503 prevents live room acceptance. Local Montreal fixture uses real current renderer and retained source plan, distinct from a working production route.

Follow-up found a possible overlay-origin regression: fixed mobile marker top64px versus fullscreen canvas padding118px. Toolbar visibility tests did not assert canvas/marker origin alignment. Specialist is measuring and correcting coordinate space before any further label styling. Do not treat this release as complete label-position acceptance.

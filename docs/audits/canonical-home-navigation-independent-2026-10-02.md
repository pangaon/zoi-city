# Canonical navigation — independent review — 2 October 2026

Root inspected the early-head helper and both successful response branches in `api/entity.js`. The helper adds only normal/reduced-motion CSS, keeps an existing inline policy authoritative and is idempotent. Errors and redirects are untouched. It adds no global error suppression and makes no changes to client artwork or source identity.

The exact combined runtime tree `5096f44ee4383742490391745f3366f851aa5f5a` passed HTML/inline checks, 1,635 unit cases and the complete local runner (291 node:test files plus two standalone suites). Independent actual-handler browser verification passed Signature, sparse venue, sparse artist and generic fallback at 390/1440 in normal/reduced motion: 16 journeys with query/fragment and back/forward preserved. Normal incoming transitions reached ready and finished; reduced motion opted out. The existing four Toronto navigation/error-visibility regression journeys also passed.

Logs: `/tmp/zoi-organizer-navigation-unit.log`, `/tmp/zoi-organizer-navigation-local.log`, `/tmp/zoi-home-nav-independent.log`, `/tmp/zoi-home-nav-regression.log`. The controlled navigation fixture blocks external image hosts and does not establish image delivery or real search reliability. Production canonical response and actual browser verification remain a required release follow-up.

This repairs incoming eligibility for all successful canonical families handled by `api/entity.js`. Other independent document handlers and the intermittent Explore search HTTP 500/slowness remain open.

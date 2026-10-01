# Hotel owner catalogue — deployed module evidence

Release `14bf6d87fb3dfd27f3788fecc04d08c1a97246cf`, read-only production verification on 2026-10-01. No customer writes, authenticated owner saves, database mutations or provider calls.

## Deployed identity

Downloaded actual `https://www.zoi.city/social/` HTML. Its script references point to both catalogue modules with `v=20261001-hospitality-catalog`. Downloaded those exact versioned URLs, compared hashes to the accepted candidate:

- `_vertical-forms.js`: `afc4d08d80de312d3df5a262094999af187f245c2e603a12dd9e1a096fd60469`.
- `_vertical-ui.js`: `cb879cd7c7741e5652909ba4243eba2cfc59873004523cd0b8c173584968950f`.

Retained downloads: `/tmp/zoi-hotel-owner-production-14bf6d8/social.html` and `assets/suite/` under that directory. Both byte matches confirmed before browser execution.

## Exercised deployed module journey

Mounted these downloaded production bytes in the isolated owner-editor fixture, using the existing `tests/browser/hospitality-owner-catalog/verify.mjs` logic with only its asset root redirected to the retained downloads. Temporary launcher removed after execution. No application RPC was invoked by this component-level fixture.

All four scenarios passed: 390/1440, light/dark. Each exercised source suggestion exclusion until acceptance, accepted source rooms, stable reorder IDs, catalogue preview, explicit empty clears of rooms and amenities, sparse owner addition, snapshot reload, removal of the last row, and mixed explicit/legacy IDs retaining uniqueness through reorder. No page errors or horizontal overflow.

Screenshots: `/tmp/hotel-owner-production-14bf6d8-{dark,light}-{390,1440}.png`.

## What this establishes

Production social HTML loads the accepted versioned catalogue modules, and those exact deployed bytes perform the component journeys in isolation. Source suggestions here are labelled synthetic hotel.test fixture data, not newly verified business information. The local actual PostgreSQL writer evidence and independent review remain documented separately. Lead reports remote migration `20261001034216` applied; this audit did not independently apply or execute it.

An authenticated real production owner edit→save→reload has not been performed, and is not implied by these tests. No native physical-device or live hotel booking journey is claimed.

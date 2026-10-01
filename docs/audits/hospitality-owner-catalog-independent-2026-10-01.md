# Hospitality owner catalogue independent review

Review of frozen candidate, 1 October 2026. No production mutations, schema application or implementation edits.

## Independently exercised

18 focused/existing vertical unit checks, six isolated PostgreSQL journey groups, and four browser editor scenarios (390/1440, dark/light) passed. Commands are in the implementation audit. The browser loads actual editor scripts in a controlled host using synthetic hotel.test source suggestions and theme variables; it is not the complete authenticated production suite or public hotel rendering journey.

Read migration replacement anchors and existing fixture writer paths: authorization, version and request replay remain in underlying functions. The validator is called by both versioned and legacy profile writes. Catalogue keys reach owner projection, []/null remain explicit, and machine enrichment remains intact. Invalid catalogue rejects transaction before base changes; stale version, changed replay, revoked role and transferred ownership reject. Internal helper execution is revoked from anonymous/authenticated roles. No booking inventory/provider connection is added.

Visually inspected `/tmp/hotel-owner-dark-390.png` and `/tmp/hotel-owner-light-1440.png`: separated rows, labelled fields, readable source links and contained layout. Images themselves are not previewed by this text/link catalogue preview.

## Findings requiring correction

1. Existing rows missing IDs use `field.k + '-' + rows.length`. Mounting `{rooms:[{id:'rooms-1',name:'Owner A'},{name:'Legacy B'}]}` yields duplicate IDs and `editor.read()` throws `Each offering needs a distinct identifier.` Reproduced using actual browser editor at both widths. Use collision-free identifiers for missing IDs, retaining them through reorder/save/reload.
2. Client validator uses ordinary `{}` for `seen`. A valid row `{id:'constructor',name:'Suite'}` fails as a duplicate because the inherited prototype member is truthy. Reproduced directly with the actual forms script. Use Set or a null-prototype map and cover prototype-named values.

Specialist and lead notified. Acceptance pending corrected candidate and regression evidence. No claim of actual owner production save/reload or category-wide population.

## Final corrected candidate accepted for integration

Both findings corrected: all explicit IDs are reserved before missing-ID assignment; generated fallback is collision-free and persists on the mounted row. Validator uses a null-prototype map. Independently reran 19 unit checks and four browser scenarios, including mixed legacy/explicit IDs, all passing. SQL unchanged from six independently passing PostgreSQL groups.

Accepted forms SHA256 `afc4d08d80de312d3df5a262094999af187f245c2e603a12dd9e1a096fd60469`; UI `cb879cd7c7741e5652909ba4243eba2cfc59873004523cd0b8c173584968950f`; migration `979478af7c556527d55a0c5f8ffc7e7a755f3a1f29c1b7912658d1a2a68a5837`. Release and authenticated production exercise remain lead-owned.

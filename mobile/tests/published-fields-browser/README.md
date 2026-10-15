Controlled actual native BusinessProfile/Food verification of published field
presence. It reuses the unchanged frozen native Food fixture boundary/Text scale
adapter, real Profile, shared canonical Food/media models and new field selector.

```sh
BUNDLE_PATH=/tmp/independent-presence.js node mobile/tests/published-fields-browser/build.cjs
BUNDLE_PATH=/tmp/independent-presence.js OUTPUT_DIR=/tmp/independent-presence \
node mobile/tests/published-fields-browser/verify.mjs
node --test tests/unit/published-field-presence.test.mjs
(cd mobile && node --test tests/*.test.mjs)
mobile/node_modules/.bin/tsc --noEmit -p mobile
```

Browser dependencies can be overridden with ZOI_PLAYWRIGHT_MODULE and
CHROMIUM_EXECUTABLE_PATH. No installs, production reads, Auth, database writes,
provider submissions, EAS or ADB occur. The only network is localhost; exact
replacement image is fulfilled with a labelled synthetic fixture SVG, all other
external image requests are recorded and refused. Linking records local handoffs.

36 cases cover owner base / owner.profile / raw profile, each with null, empty,
invalid and replacement email/description/photo, at390px1×/2× and844px2×.
They mount actual home_entity Profile read, verify header/current canonical
model, full-source tail search and private question actions. Cleared/invalid
email has no header or question email link; replacement drafts target only the
new email. Cleared photos never request the old URL; website handoff remains.

RN Web uses the frozen fixture-only text scaling adapter. Actual native font
metrics, keyboard and screen readers require root's later installed acceptance.
The original native Food14 and manual Food packets remain immutable; their
copied prerequisites and exact hashes are listed separately in the follow-up
owner audit. api/entity.js contact/description hunks must be integrated with the
other author's disjoint canonical redirect hunk, never by whole-file overwrite.

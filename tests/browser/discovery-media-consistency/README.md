`node tests/browser/discovery-media-consistency/audit.cjs`

OUTPUT_DIR and CHROMIUM_EXECUTABLE_PATH supported. BASELINE=1 deliberately restores the old Explore truthy-photo conditional and must fail the first clear assertion; omit for acceptance.

48 controlled actual-UI scenarios across restaurant/artist and390/1440. Exercises Explore card→quick look→current full-page renderer, null/invalid owner clear, replacement, omitted fields, sparse media, pending image retention and stale held-clear after close/reopen. Public RPC responses and deterministic image bytes are fixtures; no live data or visual-photo acceptance claimed.

Source-backed cases compare nullable/omitted base photos, owner clear, profile photo/hero clear and gallery clear against both actual full-page adapters. Nullable home_entity.photo_url is not treated as proof of owner deletion.

# Existing artist editor → public catalogue

Run `node tests/browser/music-owner-catalogue/verify.cjs`. Optional `QA_OUTPUT`, `CHROMIUM_EXECUTABLE_PATH`.

Loads actual Business home suite, vertical field schema/UI, versioned home_content_get/save call sites and canonical music renderer/app. Controlled RPC implements existing exact workspace/listing/version/request receipt shapes and persists profile across editor remount/readback. No production DB calls or provider writes. Public response reconstructs the whitelisted persisted profile and owner_content.profile; this is controlled-contract evidence, not a current deployed database query.

390/1440: sparse editor add recording/show/merch → save → fresh editor mount/readback → public page → keyboard exact provider links → remove/clear → save actual null values → readback → public removal. Screenshots/logs `/tmp/music-owner-catalogue` and `/tmp/music-owner-browser.log`. No invented covers, cities, times or provider playback.

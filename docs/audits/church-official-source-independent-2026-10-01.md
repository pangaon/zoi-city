# Independent church official website review

Accepted 2026-10-01 for the bounded navigation/owner-source correction. Reviewed current api/_church-home.js SHA256 10c5dd638dc87e935818271f48204adcddfc7852dd04dc2ee3b8ec2e80f2f2c3 (includes parent cache integration) and church/model.mjs 8dbb8f67f54e0fae1935fde1f3db49312f45a47bdd0a109243532f14ace49e33.

Explicit owner website is resolved before curated/reviewed source matching. HTTP/HTTPS are permitted only for site/contact navigation. Clear or unsafe owner override cannot revive the old curated website, contacts, photographs or schedule. Giving, calendar, broadcast and media retain their existing HTTPS validators. Shared navigation validator rejects credentials and unsafe schemes.

Independent 33 church unit tests passed; /tmp/church-source-units-independent.log. Independent 24 actual renderer/client cases passed at390/1440: populated/sparse parish, HTTP/HTTPS/clear, owner-overlay-only and post-save base state. Report /tmp/church-source-independent/report.json; log /tmp/church-source-browser-independent.log. Destination links actually opened controlled browser-context popups; old retained website anchors absent; clears omitted destination. Every overflow result false. Inspected populated phone owner-overlay HTTP screenshot: readable family layout with sparse photos/ministry state and current official-contact action.

These are controlled fixtures, not changes to a live parish or live provider traffic. No live giving, livestream playback, parish inquiry submission or source re-enrichment is claimed. This does not close broader church content accuracy or design work. Parent owns final release/cache validation.

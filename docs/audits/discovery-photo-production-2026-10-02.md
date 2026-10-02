# Discovery media release and live Yamas journey — 2026-10-02

Commit f254190e611253be43abcb5f255d93974b46df33 is live. GitHub CI37018672726 passed and Vercel22AEe5cwJXoEqen1K9GAd64v3vki reports READY with zoi.city aliases. Served Explore, shared profile-preview and map-preview bytes match the accepted release. Exact staged tree953e63ef96f53f8a860168014794400e7f196b78 passed273 node:test files, two standalone suites, JS/HTML checks and48 actual controlled media journeys.

Live Yamas search → Quick Look → canonical full restaurant home passed at390/1440 after earlier route503. Quick Look and full-page hero match the actual https://www.yamas.co.ke/images/flavors-of-greece.png; the hero loads at1920px, restaurant logo at792px. No page errors observed. Lazy below-fold gallery images were not scrolled into view, so their load state is unverified. Real owner edit/clear was not performed. Retained screenshots/results: docs/audits/evidence/live-yamas-2026-10-02/.

The initial live verifier used an incorrect .card selector and then waited for a JSON script to become visible; both verifier errors were corrected to the actual .lcard and attached-script condition. The resulting failures were not treated as application defects or suppressed.

Database migration history also read successfully in this window and remained at20261001101810; no pending schema was applied. Intermittent profile availability is improved in this bounded journey but not established durably across all families. Source quality, every gallery item, owner persistence, native devices and the full profile catalog remain separate open requirements.
